import { id, units, methods, required, amount, label, find, matches, qty, num, day, esc, sum, dateLabel, time, compatible, convert, stockRound, now } from './utils.js';
import { purchase, movement, lowStock } from './ledger.js';
import { heading, button, panel, table, tabs, searchBox, selectFilter, metrics, badge, iconButton, facts, formGrid, field, numeric, values, coin, stamp, options } from './ui.js';

const groups = [['stock','جميع المواد'], ['low','المواد منخفضة المخزون'], ['purchases','المشتريات'], ['movement','حركة المخزون']];
const movementTypes = ['رصيد أولي', 'شراء', 'استهلاك', 'فاقد', 'تسوية', 'إرجاع استهلاك'];
export function inventory(ctx) {
  const data = ctx.data, { tab = 'stock', q = '', type = '' } = ctx.filters;
  const low = lowStock(data), materialName = key => find(data.materials, key)?.name || '—';
  let headers, rows, types = [];
  if (tab === 'movement') {
    headers = ['التاريخ','المادة','الحركة','الكمية','الرصيد','التكلفة','الموظف','المرجع','السبب'];
    types = movementTypes;
    rows = data.movements.filter(row => (!type || row.type === type) && matches(q, materialName(row.materialId), row.reference, row.description))
      .map(row => [dateLabel(row.date) + ' · ' + time(row.date), esc(materialName(row.materialId)), esc(row.type),
        '<strong class="' + (row.quantity > 0 ? 'text-green' : 'text-amber') + '">' + (row.quantity > 0 ? '+' : '−') + qty(Math.abs(row.quantity)) + ' ' + esc(row.unit) + '</strong>',
        qty(row.balance), esc(coin(data, row.cost)), esc(find(data.employees, row.employeeId)?.name || '—'),
        row.reference ? iconButton('تفاصيل المرجع', 'eye', 'stock-reference', row.id) : '—', esc(row.description)]);
  } else if (tab === 'purchases') {
    headers = ['التاريخ','المادة','الكمية','المورد','المبلغ المدفوع','طريقة الدفع','المرجع'];
    rows = data.purchases.filter(row => matches(q, materialName(row.materialId), row.supplier, row.id))
      .map(row => [dateLabel(row.date), esc(materialName(row.materialId)), qty(row.quantity) + ' ' + esc(row.unit), esc(row.supplier || '—'),
        esc(coin(data, row.total)), esc(row.method), iconButton('تفاصيل الشراء', 'eye', 'purchase-view', row.id)]);
  } else {
    headers = ['المادة','التصنيف','المتاح','الحد الأدنى','تكلفة الوحدة','القيمة','الحالة',''];
    types = [...new Set(data.materials.map(row => row.category))];
    rows = (tab === 'low' ? low : data.materials).filter(row => (!type || row.category === type) &&
      matches(q, row.name, row.category, row.supplier)).map(row => [
      '<button class="text-btn" type="button" data-action="material-view" data-key="' + esc(row.id) + '">' + esc(row.name) + '</button>',
      esc(row.category), qty(row.quantity) + ' ' + esc(row.unit), qty(row.minimum ?? data.settings.minimum),
      esc(coin(data, row.cost)), esc(coin(data, row.quantity * row.cost)),
      badge(low.includes(row) ? 'مخزون منخفض' : 'متوفر', low.includes(row) ? 'amber' : 'green'),
      '<div class="inline-actions">' + iconButton('تعديل المادة', 'pencil', 'material-edit', row.id) +
        iconButton('تسوية المخزون', 'boxes', 'stock-adjust', row.id) + '</div>']);
  }
  return heading('المخزون', 'تابع المواد والمشتريات وتسويات المخزون واستهلاك الطلبات.',
    button('إضافة مادة', 'material-new', { glyph: 'plus' }) + button('تسجيل مشتريات', 'purchase-new', { glyph: 'plus', style: 'primary' })) +
    metrics([{ title: 'إجمالي المواد', value: num(data.materials.length), icon: 'boxes' },
      { title: 'قيمة المخزون', value: num(sum(data.materials, row => row.quantity * row.cost)), unit: data.settings.currency, icon: 'wallet', tone: 'green' },
      { title: 'مواد منخفضة', value: num(low.length), icon: 'triangle-alert', tone: 'amber' },
      { title: 'المشتريات المسجلة', value: num(data.purchases.length), icon: 'receipt', tone: 'blue' }]) +
    panel('إدارة المخزون', tabs(groups, tab, 'stock-tab') + '<div class="toolbar">' + searchBox('q', 'البحث في المخزون', q) +
      (types.length ? selectFilter('type', tab === 'movement' ? 'جميع الحركات' : 'جميع التصنيفات', types, type) : '') + '</div>' +
      table(headers, rows, 'لا توجد سجلات تطابق البحث.'), stamp(rows.length));
}
function materialForm(ctx, key) {
  const row = find(ctx.data.materials, key) || { unit: units[0], cost: 0, minimum: null };
  ctx.modal({ title: key ? 'تعديل المادة' : 'إضافة مادة', submit: 'حفظ المادة', body: formGrid(
    field('name', 'اسم المادة', row.name), field('category', 'التصنيف', row.category),
    key ? field('unit', 'وحدة المخزون', row.unit, { optional: true, attrs: 'readonly' }) : field('unit', 'وحدة المخزون', row.unit, { items: units }),
    numeric('cost', 'تكلفة الوحدة', row.cost),
    ...(!key ? [numeric('quantity', 'الرصيد الأولي', 0)] : []),
    field('minimum', 'حد التنبيه الخاص (اختياري)', row.minimum ?? '', { optional: true, attrs: 'inputmode="decimal"',
      placeholder: 'الحد العام ' + qty(ctx.data.settings.minimum) }),
    field('supplier', 'المورد', row.supplier, { optional: true })
  ), onSubmit: async form => {
    const value = values(form);
    const record = { name: label(value.name, 'اسم المادة'), category: label(value.category, 'التصنيف'),
      cost: amount(value.cost, 0, 'تكلفة الوحدة'), minimum: value.minimum.trim() ? amount(value.minimum, 0, 'حد التنبيه') : null, supplier: value.supplier.trim() };
    await ctx.mutate(data => {
      const current = find(data.materials, key);
      if (current) Object.assign(current, record);
      else {
        const initial = stockRound(amount(value.quantity, 0, 'الرصيد الأولي'));
        const material = { ...record, id: id('M'), quantity: 0, unit: value.unit, purchasePrice: 0, lastPurchase: '' };
        data.materials.unshift(material);
        if (initial > 0) movement(data, material, { type: 'رصيد أولي', quantity: initial, description: 'رصيد تأسيس المادة' });
      }
    }, 'تم حفظ المادة.', { close: true });
  } });
}
function unitSetup(root, data) {
  root.elements.materialId?.addEventListener('change', event => {
    const row = find(data.materials, event.target.value);
    if (row) {
      root.elements.unit.innerHTML = options(compatible(row.unit), row.unit);
      if (root.elements.supplier) root.elements.supplier.value = row.supplier;
    }
  });
}
function purchaseForm(ctx, key) {
  const data = ctx.data, selected = find(data.materials, key) || data.materials[0];
  required(selected, 'أضف مادة إلى المخزون قبل تسجيل مشتريات.');
  ctx.modal({ title: 'تسجيل مشتريات مواد', submit: 'تسجيل الشراء', body: formGrid(
    field('materialId', 'المادة', selected.id, { items: data.materials.map(row => [row.id,row.name]) }),
    numeric('quantity', 'الكمية المشتراة', '', .000001),
    field('unit', 'وحدة الكمية', selected.unit, { items: compatible(selected.unit) }),
    numeric('total', 'إجمالي المبلغ المدفوع', '', .01),
    field('supplier', 'المورد', selected.supplier, { optional: true }),
    field('method', 'طريقة الدفع', methods[0], { items: methods })
  ), setup: root => unitSetup(root, data), onSubmit: async form => {
    const value = values(form);
    await ctx.mutate(latest => { purchase(latest, { ...value, quantity: amount(value.quantity, .000001, 'الكمية'),
      total: amount(value.total, .01, 'المبلغ') }); }, 'تم تسجيل الشراء وتحديث المخزون والخزينة.', { close: true });
  } });
}
function adjust(ctx, key) {
  const data = ctx.data, row = find(data.materials, key);
  ctx.modal({ title: 'تسوية مخزون ' + row.name, submit: 'تأكيد التسوية', body: formGrid(
    field('kind', 'نوع الحركة', 'increase', { items: [['increase','زيادة يدوية'], ['waste','تالف أو فاقد'], ['set','تعيين رصيد الجرد']] }),
    numeric('quantity', 'الكمية أو الرصيد الفعلي', ''), field('unit', 'وحدة الكمية', row.unit, { items: compatible(row.unit) }),
    field('reason', 'سبب التسوية', '', { type: 'textarea', wide: true })
  ), onSubmit: async form => {
    const value = values(form), reason = label(value.reason, 'سبب التسوية');
    await ctx.mutate(latest => {
      const material = find(latest.materials, key);
      const quantity = convert(amount(value.quantity, value.kind === 'set' ? 0 : .000001, 'الكمية'), value.unit, material.unit);
      movement(latest, material, { type: value.kind === 'waste' ? 'فاقد' : 'تسوية',
        quantity: value.kind === 'set' ? quantity - material.quantity : value.kind === 'waste' ? -quantity : quantity, description: reason });
    }, 'تم تسجيل حركة المخزون.', { close: true });
  } });
}
function detail(ctx, key) {
  const data = ctx.data, row = find(data.materials, key);
  ctx.modal({ title: row.name, body: facts([['معرّف المادة', row.id], ['التصنيف', row.category], ['المتاح', qty(row.quantity) + ' ' + row.unit],
    ['تكلفة الوحدة', coin(data, row.cost)], ['آخر سعر شراء', coin(data, row.purchasePrice)], ['آخر شراء', dateLabel(row.lastPurchase)],
    ['المورد', row.supplier || '—'], ['حد التنبيه', qty(row.minimum ?? data.settings.minimum)]]) + '<div class="form-actions">' +
    button('شراء المادة', 'purchase-new', { key, glyph: 'plus', style: 'primary' }) + button('تسوية المخزون', 'stock-adjust', { key }) +
    button('تعديل المادة', 'material-edit', { key, glyph: 'pencil' }) + '</div>' });
}
function purchaseView(ctx, key) {
  const data = ctx.data, row = find(data.purchases, key);
  ctx.modal({ title: 'تفاصيل الشراء', body: facts([['المرجع', row.id], ['المادة', find(data.materials, row.materialId)?.name],
    ['الكمية', qty(row.quantity) + ' ' + row.unit], ['المورد', row.supplier || '—'], ['المدفوع', coin(data, row.total)],
    ['طريقة الدفع', row.method], ['التاريخ', dateLabel(row.date) + ' · ' + time(row.date)]]) });
}
export const inventoryActions = {
  'stock-tab': (ctx, key) => ctx.setFilters({ tab: key, type: '' }),
  'material-new': ctx => materialForm(ctx), 'material-edit': materialForm, 'material-view': detail,
  'purchase-new': purchaseForm, 'purchase-view': purchaseView, 'stock-adjust': adjust,
  'stock-reference': (ctx, key) => {
    const row = find(ctx.data.movements, key);
    if (find(ctx.data.purchases, row.reference)) purchaseView(ctx, row.reference);
    else if (ctx.can('orders')) ctx.dispatch('order-view', row.reference);
    else ctx.modal({ title: 'مرجع حركة المخزون', body: facts([['المرجع', row.reference], ['السبب', row.description]]) });
  }
};

