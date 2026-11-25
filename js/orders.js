import { esc, qty, time, dateLabel, sum, round, find, matches, methods, statuses, orderRef, servicePrice, serviceMaterials, required, label, amount, parseAmount } from './utils.js';
import { button, heading, panel, table, searchBox, tabs, selectFilter, field, numeric, formGrid, notes, iconButton, badge, statusBadge,
  paymentBadge, facts, values, orderLink, coin, options, printContent, stamp } from './ui.js';
import { materialRow, readMaterials, setRowUnit } from './material-fields.js';
import { customerForm, carForm } from './customers.js';
import { createOrder, completeOrder, payOrder, refundOrder, cancelOrder } from './order-logic.js';

const groups = [['all','جميع الطلبات'], ['active','الطلبات الحالية'], ['done','الطلبات المكتملة'], ['cancel','الطلبات الملغاة']];
const carName = car => car ? car.make + ' ' + car.model : '—';
const open = order => statuses.slice(0, 3).includes(order.status);
const methodField = (method = methods[0]) => field('method', 'طريقة الدفع', method, { items: methods });
const orderTable = (data, rows) => table(['الطلب','العميل','السيارة','الخدمة','الموظف','الحالة','الدفع','الإجمالي','التاريخ',''], rows.map(order => {
  const customer = find(data.customers, order.customerId), car = find(data.cars, order.carId), employee = find(data.employees, order.employeeId);
  return [orderLink(order), esc(customer?.name), esc(carName(car) + ' · ' + (car?.plate || '')),
    esc(order.services.map(service => service.name).join('، ')), esc(employee?.name), statusBadge(order.status),
    order.status === statuses[4] ? '—' : paymentBadge(order), esc(coin(data, order.total)), dateLabel(order.date),
    iconButton('تفاصيل الطلب', 'ellipsis', 'order-view', order.id)];
}), 'لا توجد طلبات تطابق خيارات البحث.');

export function orders(ctx) {
  const data = ctx.data, { q = '', tab = 'all', status = '' } = ctx.filters;
  const groupMatch = order => tab === 'all' || tab === 'active' && open(order) ||
    tab === 'done' && order.status === statuses[3] || tab === 'cancel' && order.status === statuses[4];
  const rows = data.orders.filter(order => {
    if (!groupMatch(order) || status && order.status !== status) return false;
    const customer = find(data.customers, order.customerId), car = find(data.cars, order.carId);
    return matches(q, orderRef(order), order.number, customer?.name, customer?.phone, car?.plate, carName(car));
  });
  const options = tab === 'active' ? statuses.slice(0, 3) : statuses;
  return heading('التسجيل اليومي', 'سجّل الغسلات وتابع حالة السيارات والمدفوعات من مكان واحد.',
    button('تسجيل غسلة جديدة', 'order-new', { style: 'primary', glyph: 'plus' })) +
    panel('طلبات الغسيل', tabs(groups, tab, 'orders-tab') + '<div class="toolbar">' +
      searchBox('q', 'ابحث بالعميل أو اللوحة أو رقم الطلب', q) +
      (tab === 'all' || tab === 'active' ? selectFilter('status', 'جميع الحالات', options, status) : '') +
      '</div>' + orderTable(data, rows), stamp(rows.length));
}

function orderForm(ctx, draft = {}, key) {
  const data = ctx.data;
  const owner = find(data.customers, draft.customerId);
  const cars = owner ? data.cars.filter(car => car.customerId === owner.id) : [];
  const car = find(cars, draft.carId);
  if (draft.materialCategory === undefined) draft.materialCategory = car?.category || '';
  const availableServices = data.services.filter(service => service.active || draft.serviceSnapshots?.[service.id]);
  const employeeChoices = data.employees.filter(employee => employee.active || employee.id === draft.originalEmployeeId)
    .map(employee => [employee.id, employee.name + (employee.active ? '' : ' · غير نشط')]);
  const customerChoices = query => data.customers.filter(customer => customer.id === draft.customerId ||
    matches(query, customer.name, customer.phone, customer.secondary)).map(customer => [customer.id, customer.name + ' · ' + customer.phone]);
  const rowList = () => (draft.materials || []).map(row => materialRow(data.materials, row)).join('');
  const price = service => (!service.active || draft.originalCarId === draft.carId) && draft.serviceSnapshots?.[service.id]
    ? draft.serviceSnapshots[service.id].price : servicePrice(service, car?.category);
  const serviceList = () => !availableServices.length ? '<p class="form-note">فعّل خدمة غسيل من صفحة الخدمات أولاً.</p>' :
    '<div class="check-grid">' + availableServices.map(service => '<label class="check-option"><input type="checkbox" name="service" value="' +
      esc(service.id) + '"' + (draft.serviceIds?.includes(service.id) ? ' checked' : '') + '> <span>' + esc(service.name) + (service.active ? '' : ' · متوقفة') + '</span><small>' +
      esc(coin(data, price(service))) + '</small></label>').join('') + '</div>';
  const totals = root => {
    const total = sum(draft.serviceIds || [], serviceId => {
      const service = find(availableServices, serviceId);
      return service ? price(service) : 0;
    });
    const discount = parseAmount(draft.discount) || 0;
    root.querySelector('[data-total]').textContent = coin(data, Math.max(0, round(total - discount)));
    root.querySelector('[data-subtotal]').textContent = coin(data, total);
  };
  function capture(root) {
    const fields = values(root);
    Object.assign(draft, { query: fields.query, customerId: fields.customerId, carId: fields.carId,
      employeeId: fields.employeeId, method: fields.method, discount: fields.discount, notes: fields.notes,
      serviceIds: new FormData(root).getAll('service'), materials: readMaterials(root, 'actual', false) });
  }
  function suggestions(category) {
    return (draft.serviceIds || []).flatMap(serviceId => {
      const service = find(availableServices, serviceId);
      return service ? serviceMaterials(service, category).map(row => ({ ...row, quantity: Math.round(row.quantity * 1e6) / 1e6 })) : [];
    });
  }
  function refreshCar() {
    const category = find(data.cars, draft.carId)?.category;
    if (category && category !== draft.materialCategory) {
      const original = suggestions(draft.materialCategory);
      if (draft.materials.length === original.length && original.every((row, index) => {
        const actual = draft.materials[index];
        return row.materialId === actual.materialId && row.unit === actual.unit && row.quantity === parseAmount(actual.quantity);
      })) draft.materials = suggestions(category);
      draft.materialCategory = category;
    }
    resume();
  }
  function toggleSuggestion(serviceId, checked) {
    const service = find(availableServices, serviceId);
    if (!service) return;
    const defaults = serviceMaterials(service, car?.category).map(row => ({ ...row, quantity: Math.round(row.quantity * 1e6) / 1e6 }));
    if (checked) draft.materials.push(...defaults);
    else for (const item of defaults) {
      const index = draft.materials.findIndex(row => row.materialId === item.materialId && row.unit === item.unit && parseAmount(row.quantity) === item.quantity);
      if (index !== -1) draft.materials.splice(index, 1);
    }
  }
  let currentForm;
  const resume = () => orderForm(ctx, draft, key);
  ctx.modal({ title: key ? 'تعديل طلب الغسيل' : 'تسجيل غسلة جديدة', large: true, submit: key ? 'حفظ الطلب' : 'تسجيل الطلب',
    body: formGrid(
      field('query', 'البحث عن عميل', draft.query || '', { type: 'search', optional: true, placeholder: 'اكتب الاسم أو رقم المحمول' }),
      field('customerId', 'العميل', draft.customerId || '', { items: customerChoices(draft.query || ''), placeholder: 'اختر العميل' }),
      field('carId', 'سيارة العميل', draft.carId || '', { items: cars.map(item => [item.id, carName(item) + ' · ' + item.plate]), placeholder: 'اختر السيارة' }),
      field('employeeId', 'الموظف المسؤول', draft.employeeId || '', { items: employeeChoices, placeholder: 'اختر الموظف' })
    ) + '<div class="form-actions">' + button('تسجيل عميل سريع', 'draft-new-customer', { glyph: 'user-plus' }) +
      button('إضافة سيارة للعميل', 'draft-new-car', { glyph: 'car', disabled: !owner }) + '</div>' +
      '<div class="form-section"><h3>خدمات الغسيل</h3>' + serviceList() + '</div>' +
      '<div class="form-section"><div class="section-head"><h3>المواد المستهلكة</h3><div class="inline-actions">' +
      button('استعادة المقترحات', 'draft-suggest') + button('إضافة مادة', 'draft-add', { glyph: 'plus', disabled: !data.materials.length }) +
      '</div></div><p class="form-note">عدّل الكميات الفعلية قبل الإكمال. يُخصم الاستهلاك عند إكمال الطلب.</p><div data-material-list>' +
      rowList() + '</div></div><div class="form-section">' + formGrid(numeric('discount', 'الخصم', draft.discount ?? 0), methodField(draft.method),
      notes('notes', 'ملاحظات الطلب', draft.notes)) + '</div><div class="order-total"><span>إجمالي الخدمات <b data-subtotal></b></span>' +
      '<span>بعد الخصم <strong data-total></strong></span></div>',
    setup: root => {
      currentForm = root;
      totals(root);
      root.addEventListener('input', event => {
        const input = event.target;
        if (input.name === 'query') {
          const select = root.elements.customerId;
          capture(root);
          select.innerHTML = options(customerChoices(input.value), draft.customerId, 'اختر العميل');
        }
        if (input.name === 'discount') { capture(root); totals(root); }
      });
      root.addEventListener('change', event => {
        const input = event.target;
        capture(root);
        if (input.name === 'customerId') { draft.carId = ''; resume(); }
        if (input.name === 'carId') refreshCar();
        if (input.name === 'service') {
          toggleSuggestion(input.value, input.checked);
          root.querySelector('[data-material-list]').innerHTML = rowList();
          totals(root);
        }
        if (input.matches('[data-material]')) setRowUnit(input, data.materials);
      });
    },
    localActions: {
      'draft-new-customer': () => {
        capture(currentForm);
        customerForm(ctx, null, customerId => { Object.assign(draft, { customerId, carId: '', query: '' }); resume(); }, resume);
      },
      'draft-new-car': () => {
        capture(currentForm);
        carForm(ctx, draft.customerId, null, carId => { draft.carId = carId; refreshCar(); }, resume);
      },
      'draft-suggest': () => {
        capture(currentForm);
        draft.materials = suggestions(draft.materialCategory);
        currentForm.querySelector('[data-material-list]').innerHTML = rowList();
      },
      'draft-add': () => currentForm.querySelector('[data-material-list]').insertAdjacentHTML('beforeend', materialRow(data.materials))
    },
    onSubmit: async root => {
      capture(root);
      const materials = readMaterials(root, 'actual');
      let result;
      await ctx.mutate(latest => {
        const car = find(latest.cars, draft.carId);
        const current = key ? find(latest.orders, key) : null;
        if (key) required(current && open(current), 'الطلب مغلق. حدّث القائمة.');
        const services = draft.serviceIds.map(serviceId => {
          const service = find(latest.services, serviceId);
          const snapshot = current?.services.find(item => item.id === serviceId);
          if (snapshot && (!service?.active || current.carId === draft.carId)) return snapshot;
          required(service?.active, 'أعد اختيار خدمات الغسيل النشطة.');
          return { id: service.id, name: service.name, price: servicePrice(service, car?.category) };
        });
        const input = { customerId: draft.customerId, carId: draft.carId, employeeId: draft.employeeId,
          services, materials, discount: round(amount(draft.discount, 0, 'قيمة الخصم')), method: draft.method, notes: draft.notes.trim() };
        if (current) {
          result = current;
          const employee = find(latest.employees, input.employeeId);
          required(car?.customerId === input.customerId && services.length && employee && (employee.active || employee.id === current.employeeId),
            'راجع السيارة والخدمات والموظف.');
          const subtotal = round(sum(services, row => row.price));
          required(input.discount <= subtotal, 'يجب ألا يتجاوز الخصم إجمالي الخدمات.');
          Object.assign(result, input, { subtotal, total: round(subtotal - input.discount) });
        } else result = createOrder(latest, input);
      }, key ? 'تم تحديث طلب الغسيل.' : 'تم تسجيل طلب الغسيل.', { close: true });
      if (!key) ctx.go('orders');
      orderView(ctx, result.id);
    }
  });
}

function orderView(ctx, key) {
  const data = ctx.data, order = find(data.orders, key);
  required(order, 'تعذر العثور على الطلب.');
  const customer = find(data.customers, order.customerId), car = find(data.cars, order.carId);
  const transactions = data.transactions.filter(row => row.reference === key);
  const hasDue = order.status === statuses[3] && order.paid < order.total;
  const actions = [];
  if (open(order)) {
    if (order.status === statuses[0]) actions.push(button('بدء الغسيل', 'order-advance', { key, style: 'primary' }));
    if (order.status === statuses[1]) actions.push(button('جاهزة للاستلام', 'order-advance', { key, style: 'primary' }));
    actions.push(button('إكمال الطلب', 'order-complete', { key, style: order.status === statuses[2] ? 'primary' : 'secondary' }));
    actions.push(button('تعديل الطلب', 'order-edit', { key, glyph: 'pencil' }));
  }
  if (hasDue) actions.push(button('تسجيل دفعة', 'order-pay', { key, style: 'primary' }));
  if (order.status === statuses[3] && order.paid > 0) actions.push(button('استرداد مبلغ', 'order-refund', { key }));
  actions.push(button('طباعة الإيصال', 'order-print', { key, glyph: 'printer' }));
  if (order.status !== statuses[4]) actions.push(button('إلغاء الطلب', 'order-cancel', { key, style: 'danger' }));
  ctx.modal({ title: 'طلب غسيل ' + orderRef(order), large: true, body: '<div class="inline-actions" style="margin-bottom:10px">' +
    statusBadge(order.status) + (order.status === statuses[4] ? '' : paymentBadge(order)) + '</div>' + facts([
      ['العميل', customer?.name], ['السيارة', carName(car)], ['اللوحة', car?.plate], ['الموظف', find(data.employees, order.employeeId)?.name],
      ['تاريخ التسجيل', dateLabel(order.date) + ' · ' + time(order.date)], ['الإجمالي', coin(data, order.total)],
      ['المدفوع', coin(data, order.paid)], ['المتبقي', coin(data, order.status === statuses[4] ? 0 : order.total - order.paid)],
      ...(order.cancelReason ? [['سبب الإلغاء', order.cancelReason]] : []), ...(order.notes ? [['ملاحظات', order.notes]] : [])
    ]) + '<div class="form-actions">' + actions.join('') + '</div><div class="form-section"><h3>الخدمات والخصم</h3>' +
    table(['الخدمة','السعر'], [...order.services.map(row => [esc(row.name), esc(coin(data, row.price))]), ['الخصم', esc(coin(data, order.discount))]]) +
    '</div><div class="form-section"><h3>المواد المسجلة</h3>' + table(['المادة','الكمية','الوحدة'], order.materials.map(row => [
      esc(find(data.materials, row.materialId)?.name), qty(row.quantity), esc(row.unit)
    ]), 'لم تُسجّل مواد لهذا الطلب.') + '</div><div class="form-section"><h3>الدفعات والاستردادات</h3>' +
    table(['الحركة','المبلغ','طريقة الدفع','التاريخ'], transactions.map(row => [esc(row.type), esc(coin(data, row.amount * row.direction)),
      esc(row.method), dateLabel(row.date)]), 'لا توجد دفعات مسجلة.') + '</div>' });
}

function paymentForm(ctx, key, mode) {
  const order = find(ctx.data.orders, key), remaining = round(order.total - order.paid);
  const complete = mode === 'complete', refund = mode === 'refund';
  const title = complete ? 'إكمال الطلب وتسجيل الدفع' : refund ? 'استرداد مبلغ' : 'تسجيل دفعة';
  const back = () => orderView(ctx, key);
  ctx.modal({ title, submit: title, danger: refund, onBack: back, body:
    '<p class="form-note">' + (complete ? 'سيُخصم الاستهلاك عند تأكيد الإكمال. أدخل صفراً لتسجيل الطلب غير مدفوع.' :
      refund ? 'سيُسجل الاسترداد على وسيلة الدفع المختارة ويُعاد فتح المبلغ المستحق.' : 'المتبقي على العميل ' + esc(coin(ctx.data, remaining))) + '</p>' +
    formGrid(numeric('amount', refund ? 'المبلغ المسترد' : 'المبلغ المقبوض', refund ? '' : remaining), methodField(order.method)),
    onSubmit: async root => {
      const value = values(root), payment = amount(value.amount, complete ? 0 : .01, 'المبلغ');
      await ctx.mutate(data => {
        const latest = find(data.orders, key);
        required(latest?.status === order.status && latest.paid === order.paid,
          'تغيرت حالة الطلب أو الدفعات. ارجع إلى تفاصيله لعرض أحدث البيانات.');
        if (complete) completeOrder(data, latest, { amount: payment, method: value.method });
        else if (refund) refundOrder(data, latest, payment, value.method);
        else payOrder(data, latest, payment, value.method);
      }, complete ? 'تم إكمال الطلب وتحديث المخزون والخزينة.' : refund ? 'تم تسجيل الاسترداد.' : 'تم تسجيل الدفعة.', { close: true });
      back();
    } });
}

function printReceipt(ctx, key) {
  const data = ctx.data, order = find(data.orders, key), settings = data.settings;
  const customer = find(data.customers, order.customerId);
  const car = find(data.cars, order.carId);
  const payments = data.transactions.filter(row => row.reference === key);
  printContent((settings.logo ? '<img class="print-logo" alt="" src="' + esc(settings.logo) + '">' : '') +
    '<h1>' + esc(settings.name) + '</h1><p>' + esc(settings.address + ' · ' + settings.phone) + '</p><h2>إيصال غسيل ' +
    esc(orderRef(order)) + '</h2><p>' + esc(dateLabel(order.date) + ' · ' + time(order.date) + ' · ' + order.status) + '</p><p>' +
    esc(customer?.name + ' · ' + carName(car) + ' · ' + car?.plate) + '</p>' +
    table(['الخدمة','المبلغ'], [...order.services.map(row => [esc(row.name), esc(coin(data, row.price))]), ['الخصم', esc(coin(data, order.discount))],
      ['الإجمالي', esc(coin(data, order.total))], ['المدفوع', esc(coin(data, order.paid))],
      ['المتبقي', esc(coin(data, order.status === statuses[4] ? 0 : order.total - order.paid))]]) +
    (payments.length ? table(['حركة الدفع','الطريقة','المبلغ'], payments.map(row => [
      esc(row.type), esc(row.method), esc(coin(data, row.amount * row.direction))
    ])) : '<p>طريقة الدفع المحددة · ' + esc(order.method) + '</p>') + '<p>' + esc(settings.receipt) + '</p>');
}

export const orderActions = {
  'orders-tab': (ctx, key) => ctx.setFilters({ tab: key, status: '' }),
  'order-new': (ctx, key) => orderForm(ctx, key ? { customerId: key, carId: ctx.data.cars.find(car => car.customerId === key)?.id } : {}),
  'order-view': orderView,
  'order-edit': (ctx, key) => {
    const order = find(ctx.data.orders, key);
    required(order && open(order), 'لا يمكن تعديل طلب مغلق.');
    orderForm(ctx, { ...order, originalCarId: order.carId, originalEmployeeId: order.employeeId, serviceIds: order.services.map(row => row.id),
      serviceSnapshots: Object.fromEntries(order.services.map(row => [row.id, row])) }, key);
  },
  'order-advance': async (ctx, key) => {
    const expected = find(ctx.data.orders, key)?.status;
    await ctx.mutate(data => {
      const order = find(data.orders, key);
      required(order?.status === expected && [statuses[0], statuses[1]].includes(expected), 'تم تغيير حالة الطلب. حدّث القائمة.');
      order.status = statuses[statuses.indexOf(expected) + 1];
    }, 'تم تحديث حالة الطلب.');
    orderView(ctx, key);
  },
  'order-complete': (ctx, key) => paymentForm(ctx, key, 'complete'),
  'order-pay': (ctx, key) => paymentForm(ctx, key, 'pay'),
  'order-refund': (ctx, key) => paymentForm(ctx, key, 'refund'),
  'order-print': printReceipt,
  'order-cancel': (ctx, key) => {
    const expected = find(ctx.data.orders, key);
    const completed = expected?.status === statuses[3];
    ctx.modal({ title: 'تأكيد إلغاء الطلب', submit: 'إلغاء الطلب', danger: true, onBack: () => orderView(ctx, key),
      body: (completed ? '<p class="form-note">سيُسترد صافي الدفعات لكل وسيلة دفع. أعد الكميات إلى المخزون فقط إذا أمكن استرجاعها فعلياً.</p>' : '') +
        field('reason', 'سبب الإلغاء', '', { type: 'textarea' }) + (completed ?
          '<label class="check-option"><input type="checkbox" name="restore"> إرجاع المواد المستهلكة إلى المخزون</label>' : ''),
      onSubmit: async form => {
        const value = values(form);
        await ctx.mutate(data => {
          const order = find(data.orders, key);
          required(order?.status === expected?.status && order?.paid === expected?.paid,
            'تغيرت حالة الطلب أو الدفعات. راجع تفاصيل الطلب قبل الإلغاء.');
          cancelOrder(data, order, label(value.reason, 'سبب الإلغاء'), !!value.restore);
        },
          'تم إلغاء الطلب.', { close: true });
        orderView(ctx, key);
      } });
  }
};

