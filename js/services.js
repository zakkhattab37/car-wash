import { categories, amount, label, id, esc, find, matches, num, required, qty } from './utils.js';
import { heading, button, panel, table, badge, searchBox, selectFilter, formGrid, field, notes, numeric, values, coin, facts, stamp, iconButton } from './ui.js';
import { materialRow, readMaterials, setRowUnit } from './material-fields.js';

export function services(ctx) {
  const data = ctx.data, { q = '', state = '' } = ctx.filters;
  const rows = data.services.filter(item => matches(q, item.name, item.description) && (!state || (state === 'on') === item.active));
  return heading('خدمات الغسيل', 'اضبط أسعار الخدمات والمدد واستهلاك المواد لكل فئة سيارة.',
    button('إضافة خدمة', 'service-new', { glyph: 'plus', style: 'primary' })) +
    panel('قائمة الخدمات', '<div class="toolbar">' + searchBox('q', 'البحث باسم الخدمة', q) +
      selectFilter('state', 'جميع الحالات', [['on','نشطة'],['off','متوقفة']], state) + '</div>' +
      table(['الخدمة','السعر الأساسي','المدة','المواد الافتراضية','تخصيص الفئات','الحالة',''], rows.map(item => [
        '<button type="button" class="text-btn" data-action="service-view" data-key="' + esc(item.id) + '">' + esc(item.name) + '</button>',
        esc(coin(data, item.price)), num(item.duration) + ' دقيقة', num(item.materials.length), num(Object.keys(item.variants).length),
        badge(item.active ? 'نشطة' : 'متوقفة', item.active ? 'green' : 'muted'),
        '<div class="inline-actions">' + iconButton('تعديل الخدمة', 'pencil', 'service-edit', item.id) +
          button(item.active ? 'إيقاف' : 'تفعيل', 'service-toggle', { key: item.id }) + '</div>'
      ]), 'لا توجد خدمات تطابق البحث.'), stamp(rows.length));
}

function view(ctx, key) {
  const data = ctx.data, item = find(data.services, key);
  required(item, 'تعذر العثور على الخدمة.');
  const materialText = materials => materials.map(row => {
    const material = find(data.materials, row.materialId);
    return (material?.name || '') + ' · ' + qty(row.quantity) + ' ' + row.unit;
  }).join('، ');
  ctx.modal({ title: item.name, body: facts([['الوصف', item.description || '—'], ['السعر الأساسي', coin(data, item.price)],
    ['المدة', num(item.duration) + ' دقيقة'], ['الحالة', item.active ? 'نشطة' : 'متوقفة'], ['المواد الافتراضية', materialText(item.materials) || '—']]) +
    table(['الفئة','السعر','المواد'], Object.entries(item.variants).map(([category, variant]) => [esc(category),
      variant.price === undefined ? 'السعر الأساسي' : esc(coin(data, variant.price)),
      variant.materials === undefined ? 'المواد الافتراضية' : esc(materialText(variant.materials) || 'دون مواد')]), 'لم تُضبط أسعار أو كميات حسب الفئة.') +
    '<div class="form-actions">' + button('تعديل الخدمة', 'service-edit', { key, glyph: 'pencil' }) + '</div>' });
}

function edit(ctx, key) {
  const materialList = ctx.data.materials;
  const item = find(ctx.data.services, key) || { price: '', duration: 30, active: true, materials: [], variants: {} };
  const group = (index, rows) => '<div data-service-group="' + index + '">' + rows.map(row => materialRow(materialList, row, index)).join('') + '</div>';
  const add = index => button('إضافة مادة', 'service-add-row', { key: String(index), glyph: 'plus', disabled: !materialList.length });
  let root;
  ctx.modal({ title: key ? 'تعديل الخدمة' : 'إضافة خدمة غسيل', large: true, submit: 'حفظ الخدمة',
    body: formGrid(field('name', 'اسم الخدمة', item.name), numeric('price', 'السعر الأساسي', item.price),
      numeric('duration', 'المدة بالدقائق', item.duration, 1), field('active', 'الحالة', item.active ? 'on' : 'off', { items: [['on','نشطة'],['off','متوقفة']] }),
      notes('description', 'الوصف', item.description)) + '<div class="form-section"><div class="section-head"><h3>المواد الافتراضية</h3>' +
    add('base') + '</div>' + group('base', item.materials) + '</div><div class="form-section"><h3>الأسعار والمواد حسب الفئة</h3>' +
    '<p class="form-note">اترك سعر الفئة فارغاً لاستخدام السعر الأساسي. فعّل تخصيص المواد لتحديد كميات مختلفة أو خدمة دون استهلاك.</p>' +
    categories.map((category, index) => {
      const variant = item.variants[category] || {};
      const hasMaterials = variant.materials !== undefined;
      return '<details class="variant" ' + (variant.price !== undefined || hasMaterials ? 'open' : '') + '><summary>' + esc(category) + '</summary>' +
        formGrid(field('price-' + index, 'سعر الفئة', variant.price, { optional: true, attrs: 'inputmode="decimal"' }),
        '<label class="check-option"><input name="override-' + index + '" type="checkbox"' + (hasMaterials ? ' checked' : '') + '> تخصيص المواد لهذه الفئة</label>') +
        '<div data-override-group="' + index + '"' + (hasMaterials ? '' : ' hidden') + '><div class="form-actions">' +
        add(index) + '</div>' + group(String(index), variant.materials || []) + '</div></details>';
    }).join('') + '</div>',
    setup: form => {
      root = form;
      root.addEventListener('change', event => {
        const input = event.target;
        if (input.matches('[data-material]')) setRowUnit(input, materialList);
        if (input.name?.startsWith('override-')) root.querySelector('[data-override-group="' + input.name.slice(9) + '"]').hidden = !input.checked;
      });
    },
    localActions: { 'service-add-row': value => root.querySelector('[data-service-group="' + value + '"]').insertAdjacentHTML('beforeend', materialRow(materialList, {}, value)) },
    onSubmit: async form => {
      const value = values(form);
      const variants = {};
      categories.forEach((category, index) => {
        const price = value['price-' + index], override = value['override-' + index];
        if (price.trim() || override) variants[category] = {
          ...(price.trim() ? { price: amount(price, 0, 'سعر الفئة') } : {}),
          ...(override ? { materials: readMaterials(form, String(index)) } : {})
        };
      });
      const record = { id: key || id('S'), name: label(value.name, 'اسم الخدمة'), description: value.description.trim(),
        price: amount(value.price, 0, 'سعر الخدمة'), duration: amount(value.duration, 1, 'مدة الخدمة'),
        active: value.active === 'on', materials: readMaterials(form, 'base'), variants };
      await ctx.mutate(data => {
        const current = find(data.services, key);
        if (current) Object.assign(current, record);
        else data.services.unshift(record);
      }, 'تم حفظ الخدمة.', { close: true });
    } });
}
export const serviceActions = {
  'service-view': view, 'service-new': ctx => edit(ctx), 'service-edit': edit,
  'service-toggle': (ctx, key) => {
    const item = find(ctx.data.services, key);
    if (item.active) ctx.confirm('إيقاف الخدمة', 'ستتوقف إضافة هذه الخدمة إلى طلبات جديدة.', () =>
      ctx.mutate(data => { find(data.services, key).active = false; }, 'تم إيقاف الخدمة.', { close: true }));
    else return ctx.mutate(data => { find(data.services, key).active = true; }, 'تم تفعيل الخدمة.');
  }
};
