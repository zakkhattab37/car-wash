import { id, day, esc, num, digits, phone, label, amount, find, matches, sum, statuses, methods, required, dateLabel } from './utils.js';
import { salary } from './ledger.js';
import { heading, button, panel, table, tabs, searchBox, selectFilter, dateFilter, field, numeric, formGrid, notes, badge, iconButton, facts, values, coin, orderLink, statusBadge, stamp } from './ui.js';

const groups = [['people','جميع الموظفين'], ['attendance','الحضور والغياب'], ['salary','الرواتب']];
export function employees(ctx) {
  const data = ctx.data, { tab = 'people', q = '', date = day(), state = '' } = ctx.filters;
  const shortlist = data.employees.filter(row => matches(q, row.name, row.phone, row.job));
  let headers, rows;
  if (tab === 'attendance') {
    headers = ['الموظف','الوظيفة','التاريخ','الحالة','ملاحظات',''];
    rows = shortlist.filter(employee => {
      const record = data.attendance.find(row => row.employeeId === employee.id && row.date === date);
      return (employee.active || record) && (!state || (record?.state || 'غير مسجل') === state);
    }).map(employee => {
      const record = data.attendance.find(row => row.employeeId === employee.id && row.date === date);
      return [esc(employee.name), esc(employee.job), dateLabel(date), badge(record?.state || 'غير مسجل',
        record?.state === 'حضور' ? 'green' : record?.state === 'غياب' ? 'amber' : 'muted'),
        esc(record?.notes || '—'), button(record ? 'تعديل الحضور' : 'تسجيل الحالة', 'attendance-new', { key: employee.id })];
    });
  } else if (tab === 'salary') {
    headers = ['الموظف','الفترة','الأساسي','المكافأة','الخصم','صافي الدفع','الوسيلة','تاريخ الدفع'];
    rows = data.salaries.filter(row => shortlist.some(employee => employee.id === row.employeeId))
      .map(row => [esc(find(data.employees, row.employeeId)?.name), esc(row.period || '—'), esc(coin(data, row.base)),
        esc(coin(data, row.bonus)), esc(coin(data, row.deduction)), esc(coin(data, row.total)), esc(row.method), dateLabel(row.date)]);
  } else {
    headers = ['الموظف','المحمول','الوظيفة','التعيين','الراتب','الحالة',''];
    rows = shortlist.filter(employee => !state || (state === 'on') === employee.active).map(employee => [
      '<button class="text-btn" type="button" data-action="employee-view" data-key="' + esc(employee.id) + '">' + esc(employee.name) + '</button>',
      '<span class="ltr">' + esc(employee.phone) + '</span>', esc(employee.job), dateLabel(employee.hired),
      esc(coin(data, employee.rate) + ' · ' + employee.period), badge(employee.active ? 'نشط' : 'غير نشط', employee.active ? 'green' : 'muted'),
      '<div class="inline-actions">' + iconButton('تعديل الموظف', 'pencil', 'employee-edit', employee.id) +
        iconButton('عرض ملف الموظف', 'eye', 'employee-view', employee.id) + '</div>'
    ]);
  }
  return heading('الموظفون', 'تابع ملفات الموظفين والحضور ومستحقات الرواتب وأداء الغسيل.',
    button('تسجيل راتب', 'salary-new', { glyph: 'wallet' }) + button('إضافة موظف', 'employee-new', { glyph: 'plus', style: 'primary' })) +
    panel('إدارة الموظفين', tabs(groups, tab, 'employees-tab') + '<div class="toolbar">' + searchBox('q', 'البحث باسم الموظف أو المحمول', q) +
      (tab === 'attendance' ? dateFilter('date', 'تاريخ الحضور', date) +
        selectFilter('state', 'جميع حالات الحضور', ['حضور','غياب','غير مسجل'], state) : tab === 'people' ?
        selectFilter('state', 'جميع الحالات', [['on','نشط'],['off','غير نشط']], state) : '') + '</div>' +
      table(headers, rows, 'لا توجد سجلات تطابق البحث.'), stamp(rows.length));
}
function employeeForm(ctx, key) {
  const row = find(ctx.data.employees, key) || { active: true, period: 'شهري' };
  ctx.modal({ title: key ? 'تعديل الموظف' : 'إضافة موظف', submit: 'حفظ الموظف', body: formGrid(
    field('name', 'الاسم بالكامل', row.name), field('phone', 'رقم المحمول', row.phone, { type: 'tel' }),
    field('national', 'آخر ٤ أرقام من الرقم القومي التجريبي', row.national?.slice(-4), { attrs: 'inputmode="numeric" maxlength="4"' }),
    field('address', 'العنوان', row.address), field('job', 'المسمى الوظيفي', row.job), field('hired', 'تاريخ التعيين', row.hired || day(), { type: 'date' }),
    numeric('rate', 'الأجر الأساسي', row.rate), field('period', 'دورية الأجر', row.period, { items: ['شهري','يومي'] }),
    ...(!key ? [field('active', 'الحالة', row.active ? 'yes' : 'no', { items: [['yes','نشط'],['no','غير نشط']] })] : []),
    notes('notes', 'ملاحظات', row.notes)), onSubmit: async form => {
      const value = values(form), national = digits(value.national);
      required(/^\d{4}$/.test(national), 'أدخل آخر ٤ أرقام فقط للرقم القومي التجريبي.');
      const entry = { id: key || id('E'), name: label(value.name, 'اسم الموظف'), phone: phone(value.phone),
        national: '••••••••••' + national, address: label(value.address, 'العنوان'), job: label(value.job, 'المسمى الوظيفي'),
        hired: value.hired, rate: amount(value.rate, 0, 'الأجر'), period: value.period, notes: value.notes.trim() };
      await ctx.mutate(latest => {
        const current = find(latest.employees, key);
        if (current) Object.assign(current, entry);
        else latest.employees.unshift({ ...entry, active: value.active === 'yes' });
      }, 'تم حفظ بيانات الموظف.', { close: true });
    } });
}
function employeeView(ctx, key) {
  const data = ctx.data, row = find(data.employees, key);
  const orders = data.orders.filter(order => order.employeeId === key);
  const completed = orders.filter(order => order.status === statuses[3]);
  const attendance = data.attendance.filter(record => record.employeeId === key).sort((a,b) => b.date.localeCompare(a.date));
  const salaries = data.salaries.filter(record => record.employeeId === key);
  ctx.modal({ title: row.name, large: true, body: facts([
    ['الرقم التعريفي', row.id], ['الرقم القومي التجريبي', row.national], ['المحمول', row.phone], ['العنوان', row.address],
    ['الوظيفة', row.job], ['التعيين', dateLabel(row.hired)], ['الراتب', coin(data, row.rate) + ' · ' + row.period],
    ['الحالة', row.active ? 'نشط' : 'غير نشط'], ['الطلبات المكتملة', num(completed.length)], ['ملاحظات', row.notes || '—']
  ]) + '<div class="form-actions">' + button('تعديل الموظف', 'employee-edit', { key, glyph: 'pencil' }) +
    button('تسجيل حضور', 'attendance-new', { key }) + button('تسجيل راتب', 'salary-new', { key }) +
    button(row.active ? 'إيقاف الموظف' : 'تفعيل الموظف', 'employee-toggle', { key, style: row.active ? 'danger' : 'secondary' }) + '</div>' +
    '<div class="form-section"><h3>الطلبات المسندة</h3>' + table(['الطلب','التاريخ','الحالة','الإجمالي'], orders.map(order => [
      orderLink(order), dateLabel(order.date), statusBadge(order.status), esc(coin(data, order.total))])) + '</div>' +
    '<div class="form-section"><h3>سجل الحضور</h3>' + table(['التاريخ','الحالة','ملاحظات'], attendance.map(row => [
      dateLabel(row.date), esc(row.state), esc(row.notes || '—')])) + '</div>' +
    '<div class="form-section"><h3>تاريخ صرف الرواتب</h3>' + table(['التاريخ','الفترة','أساسي','مكافأة','خصم','المدفوع'], salaries.map(row => [
      dateLabel(row.date), esc(row.period || '—'), esc(coin(data, row.base)), esc(coin(data, row.bonus)), esc(coin(data, row.deduction)), esc(coin(data, row.total))])) + '</div>' });
}
function attendanceForm(ctx, key) {
  const chosen = ctx.filters.date || day();
  const data = ctx.data, row = find(data.employees, key);
  const attendance = date => data.attendance.find(item => item.employeeId === key && item.date === date);
  ctx.modal({ title: 'حضور وغياب ' + row.name, submit: 'حفظ الحالة', body: formGrid(
    field('date', 'التاريخ', chosen, { type: 'date', attrs: 'max="' + day() + '"' }),
    field('state', 'الحالة', attendance(chosen)?.state || 'حضور', { items: ['حضور','غياب'] }),
    notes('notes', 'ملاحظات', attendance(chosen)?.notes)), setup: root => {
      root.elements.date.addEventListener('change', () => {
        const item = attendance(root.elements.date.value);
        root.elements.state.value = item?.state || 'حضور';
        root.elements.notes.value = item?.notes || '';
      });
    }, onSubmit: async form => {
      const value = values(form);
      required(value.date <= day(), 'اختر تاريخ الحضور حتى اليوم.');
      await ctx.mutate(data => {
        const record = data.attendance.find(item => item.employeeId === key && item.date === value.date);
        if (record) Object.assign(record, { state: value.state, notes: value.notes.trim() });
        else data.attendance.unshift({ id: id('ATT'), employeeId: key, state: value.state, date: value.date, notes: value.notes.trim() });
      }, 'تم تحديث سجل الحضور.', { close: true });
    } });
}
function salaryForm(ctx, key) {
  const data = ctx.data, row = find(data.employees, key) || data.employees.find(row => row.active);
  required(row, 'أضف موظفاً أولاً.');
  const list = data.employees.filter(employee => employee.active || employee.id === key);
  ctx.modal({ title: 'تسجيل دفع راتب', submit: 'تأكيد دفع الراتب', body: formGrid(
    field('employeeId', 'الموظف', row.id, { items: list.map(row => [row.id, row.name]) }),
    field('period', 'فترة الاستحقاق', '', { placeholder: 'مثال: راتب نوفمبر' }), numeric('base', 'الأجر الأساسي', row.rate),
    numeric('bonus', 'المكافأة', 0), numeric('deduction', 'الخصم', 0), field('method', 'طريقة الدفع', methods[0], { items: methods })
  ) + '<div class="order-total"><span>صافي المدفوع</span><strong data-salary-total></strong></div>',
    setup: root => {
      const show = () => {
        const value = values(root);
        try { root.querySelector('[data-salary-total]').textContent = coin(data, amount(value.base) + amount(value.bonus) - amount(value.deduction)); }
        catch { root.querySelector('[data-salary-total]').textContent = '—'; }
      };
      root.elements.employeeId.addEventListener('change', () => { root.elements.base.value = find(data.employees, root.elements.employeeId.value).rate; show(); });
      root.addEventListener('input', show); show();
    }, onSubmit: async form => {
      const value = values(form);
      await ctx.mutate(latest => { salary(latest, { employeeId: value.employeeId, period: label(value.period, 'فترة الاستحقاق'),
        base: amount(value.base, 0, 'الأجر الأساسي'), bonus: amount(value.bonus, 0, 'قيمة المكافأة'),
        deduction: amount(value.deduction, 0, 'قيمة الخصم'), method: value.method }); }, 'تم تسجيل الراتب وتحديث الخزينة.', { close: true });
    } });
}
export const employeeActions = {
  'employees-tab': (ctx, key) => ctx.setFilters({ tab: key, state: '' }),
  'employee-new': ctx => employeeForm(ctx), 'employee-edit': employeeForm, 'employee-view': employeeView,
  'attendance-new': attendanceForm, 'salary-new': salaryForm,
  'employee-toggle': (ctx, key) => {
    const row = find(ctx.data.employees, key);
    const change = () => ctx.mutate(data => { find(data.employees, key).active = !row.active; },
      row.active ? 'تم إيقاف الموظف.' : 'تم تفعيل الموظف.', { close: true });
    if (row.active) ctx.confirm('إيقاف الموظف', 'سيُستبعد الموظف من إسناد الطلبات الجديدة مع حفظ سجله.', change);
    else return change();
  }
};


