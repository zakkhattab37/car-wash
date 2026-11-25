import { id, find, day, esc, matches, phone, label, required, categories, dateLabel, num, sum, statuses, normalize } from './utils.js';
import { button, iconButton, heading, panel, table, field, notes, formGrid, searchBox, selectFilter, facts, values, orderLink, statusBadge, coin, stamp } from './ui.js';

export function customerForm(ctx, key, after, onBack) {
  const record = find(ctx.data.customers, key) || {};
  ctx.modal({ title: key ? 'تعديل بيانات العميل' : 'إضافة عميل', submit: key ? 'حفظ التعديلات' : 'حفظ العميل',
    onBack, body: formGrid(
      field('name', 'اسم العميل بالكامل', record.name), field('phone', 'رقم المحمول', record.phone, { type: 'tel', placeholder: '01XXXXXXXXX' }),
      field('secondary', 'رقم محمول إضافي', record.secondary, { type: 'tel', optional: true }),
      field('registered', 'تاريخ التسجيل', record.registered || day(), { type: 'date' }), notes('notes', 'ملاحظات', record.notes)
    ), onSubmit: async form => {
      const value = values(form);
      const entry = { id: key || id('C'), name: label(value.name, 'اسم العميل'), phone: phone(value.phone),
        secondary: phone(value.secondary, true), registered: value.registered, notes: value.notes.trim() };
      await ctx.mutate(data => {
        const numbers = [entry.phone, entry.secondary].filter(Boolean);
        required(!data.customers.some(row => row.id !== key && numbers.some(number => number === row.phone || number === row.secondary)),
          'رقم المحمول مسجل لعميل آخر.');
        const customer = find(data.customers, key);
        if (customer) Object.assign(customer, entry);
        else data.customers.unshift(entry);
      }, key ? 'تم حفظ بيانات العميل.' : 'تم تسجيل العميل.', { close: true });
      after?.(entry.id);
    } });
}

export function carForm(ctx, customerId, key, after, onBack) {
  const record = find(ctx.data.cars, key) || {};
  const owner = find(ctx.data.customers, customerId);
  required(owner, 'اختر العميل أولاً.');
  ctx.modal({ title: key ? 'تعديل بيانات السيارة' : 'إضافة سيارة', submit: 'حفظ السيارة', onBack,
    body: '<p class="form-note">العميل · ' + esc(owner.name) + '</p>' + formGrid(
      field('make', 'الشركة المصنعة', record.make), field('model', 'الطراز', record.model),
      field('category', 'فئة السيارة', record.category, { items: categories, placeholder: 'اختر الفئة' }),
      field('color', 'اللون', record.color), field('plate', 'رقم اللوحة', record.plate, { placeholder: 'س م ر ١٢٦٣' }),
      notes('notes', 'ملاحظات', record.notes)
    ), onSubmit: async form => {
      const value = values(form);
      const entry = { id: key || id('V'), customerId, make: label(value.make, 'الشركة المصنعة'),
        model: label(value.model, 'الطراز'), category: value.category, color: label(value.color, 'اللون'),
        plate: label(value.plate, 'رقم اللوحة'), notes: value.notes.trim() };
      await ctx.mutate(data => {
        required(find(data.customers, customerId), 'تعذر العثور على العميل.');
        const plateKey = plate => normalize(plate).replace(/\s/g, '');
        required(!data.cars.some(row => row.id !== key && plateKey(row.plate) === plateKey(entry.plate)),
          'رقم اللوحة مسجل لسيارة أخرى.');
        const car = find(data.cars, key);
        if (car) Object.assign(car, entry);
        else data.cars.unshift(entry);
      }, 'تم حفظ السيارة.', { close: true });
      after?.(entry.id);
    } });
}

export function customerProfile(ctx, key) {
  const data = ctx.data, customer = find(data.customers, key);
  required(customer, 'تعذر العثور على العميل.');
  const cars = data.cars.filter(row => row.customerId === key);
  const orders = data.orders.filter(row => row.customerId === key);
  const completed = orders.filter(row => row.status === statuses[3]);
  ctx.modal({ title: customer.name, large: true, body: facts([
    ['الرقم التعريفي', customer.id], ['المحمول', customer.phone], ['المحمول الإضافي', customer.secondary || '—'],
    ['التسجيل', dateLabel(customer.registered)], ['إجمالي الزيارات', num(completed.length)],
    ['إجمالي المدفوعات', coin(data, sum(completed, row => row.paid))], ['ملاحظات', customer.notes || '—']
  ]) + '<div class="form-actions">' +
  button('تعديل العميل', 'customer-edit', { key, glyph: 'pencil' }) +
  button('إضافة سيارة', 'car-new', { key, glyph: 'plus' }) +
  button('تسجيل غسلة', 'customer-order', { key, glyph: 'plus', style: 'primary' }) + '</div>' +
  '<div class="form-section"><h3>السيارات المسجلة</h3>' + table(['السيارة','الفئة','اللون','اللوحة','ملاحظات',''], cars.map(car => [
    esc(car.make + ' ' + car.model), esc(car.category), esc(car.color), esc(car.plate), esc(car.notes || '—'), iconButton('تعديل السيارة', 'pencil', 'car-edit', car.id)
  ]), 'أضف أول سيارة للعميل لبدء تسجيل الطلبات.') + '</div><div class="form-section"><h3>سجل الغسيل</h3>' +
  table(['الطلب','التاريخ','الخدمات','الحالة','المدفوع'], orders.map(order => [
    orderLink(order), dateLabel(order.date), esc(order.services.map(row => row.name).join('، ')), statusBadge(order.status), esc(coin(data, order.paid))
  ]), 'لا توجد طلبات غسيل لهذا العميل.') + '</div>' });
}

export function customers(ctx) {
  const data = ctx.data, { q = '', category = '' } = ctx.filters;
  const rows = data.customers.map(customer => ({ customer, cars: data.cars.filter(row => row.customerId === customer.id) }))
    .filter(({ customer, cars }) => (!category || cars.some(row => row.category === category)) &&
      matches(q, customer.name, customer.phone, customer.secondary, ...cars.flatMap(car => [car.plate, car.make, car.model])));
  return heading('العملاء والسيارات', 'إدارة ملفات العملاء والسيارات المسجلة والاطلاع على سجل الغسيل.',
    button('إضافة عميل', 'customer-new', { glyph: 'plus', style: 'primary' })) +
    panel('جميع العملاء', '<div class="toolbar">' + searchBox('q', 'الاسم، المحمول أو رقم اللوحة', q) +
      selectFilter('category', 'جميع فئات السيارات', categories, category) + '</div>' +
      table(['العميل','رقم المحمول','السيارات','تاريخ التسجيل',''], rows.map(({ customer, cars }) => [
        '<button type="button" class="text-btn" data-action="customer-view" data-key="' + esc(customer.id) + '">' + esc(customer.name) + '</button>',
        '<span class="ltr">' + esc(customer.phone) + '</span>', num(cars.length), dateLabel(customer.registered),
        '<div class="inline-actions">' + iconButton('بيانات العميل', 'eye', 'customer-view', customer.id) +
          iconButton('تعديل العميل', 'pencil', 'customer-edit', customer.id) + '</div>'
      ]), 'لا توجد نتائج. جرّب اسماً أو رقم هاتف مختلفاً.'), stamp(rows.length));
}
export const customerActions = {
  'customer-new': ctx => customerForm(ctx),
  'customer-view': customerProfile,
  'customer-edit': (ctx, key) => customerForm(ctx, key, () => customerProfile(ctx, key), () => customerProfile(ctx, key)),
  'car-new': (ctx, key) => carForm(ctx, key, null, () => customerProfile(ctx, key), () => customerProfile(ctx, key)),
  'car-edit': (ctx, key) => {
    const car = find(ctx.data.cars, key);
    required(car, 'تعذر العثور على السيارة.');
    carForm(ctx, car.customerId, key, () => customerProfile(ctx, car.customerId), () => customerProfile(ctx, car.customerId));
  },
  'customer-order': (ctx, key) => ctx.dispatch('order-new', key)
};

