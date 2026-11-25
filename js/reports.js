import { day, daysAgo, between, sum, num, qty, esc, dateLabel, statuses, find, orderRef, time } from './utils.js';
import { button, heading, panel, table, dateFilter, selectFilter, coin, metrics, csv, printContent, stamp } from './ui.js';

const kinds = [
  ['daily','طلبات الغسيل اليومية'], ['monthly','طلبات الغسيل الشهرية'], ['revenue','الإيرادات والتحصيل'],
  ['expenses','المصروفات'], ['profit','الربحية'], ['consumption','استهلاك المواد'], ['valuation','تقييم المخزون'],
  ['performance','أداء الموظفين'], ['visits','زيارات العملاء'], ['popular','الخدمات الأكثر طلباً'],
  ['due','المدفوعات المستحقة'], ['closing','إغلاقات الخزينة']
];
function report(ctx) {
  const data = ctx.data, { kind = 'daily', from = daysAgo(29), to = day() } = ctx.filters;
  const valid = !from || !to || from <= to;
  const inRange = value => valid && between(value, from, to);
  const orders = data.orders.filter(row => inRange(day(row.date)));
  const completed = data.orders.filter(row => row.completed && inRange(day(row.completed)) && row.status === statuses[3]);
  const transactions = data.transactions.filter(row => inRange(day(row.date)));
  const movements = data.movements.filter(row => inRange(day(row.date)));
  const sales = sum(completed, row => row.total);
  const paid = sum(transactions.filter(row => row.direction === 1 || row.type === 'استرداد'), row => row.amount * row.direction);
  const expense = sum(transactions.filter(row => row.direction === -1 && row.type !== 'استرداد'), row => row.amount);
  const name = (rows, key) => find(rows, key)?.name || '—';
  const currency = data.settings.currency;
  const cash = value => num(value) + ' ' + currency;
  const txRows = list => list.map(row => [dateLabel(row.date) + ' · ' + time(row.date), row.type, row.description, row.method, cash(row.amount * row.direction), row.reference || '—']);
  let headings, rows, description = '';
  if (kind === 'daily' || kind === 'monthly') {
    const month = kind === 'monthly';
    headings = [month ? 'الشهر' : 'اليوم', 'الطلبات', 'مكتملة', 'قيد التنفيذ', 'ملغاة', 'قيمة الطلبات المكتملة'];
    const keys = [...new Set(orders.map(row => day(row.date).slice(0, month ? 7 : 10)))].sort().reverse();
    rows = keys.map(key => {
      const items = orders.filter(row => day(row.date).startsWith(key));
      const done = items.filter(row => row.status === statuses[3]);
      return [month ? key : dateLabel(key), num(items.length), num(done.length),
        num(items.filter(row => statuses.slice(0, 3).includes(row.status)).length), num(items.filter(row => row.status === statuses[4]).length),
        cash(sum(done, row => row.total))];
    });
    description = 'التجميع حسب تاريخ تسجيل الطلب وحالته الحالية.';
  } else if (kind === 'revenue' || kind === 'expenses') {
    headings = ['التاريخ','النوع','البيان','الدفع','المبلغ','المرجع'];
    rows = txRows(transactions.filter(row => kind === 'revenue' ? row.direction === 1 || row.type === 'استرداد' : row.direction === -1 && row.type !== 'استرداد'));
    description = 'الحركات المسجلة حسب تاريخ التحصيل أو الصرف.';
  } else if (kind === 'profit') {
    const manual = sum(transactions.filter(row => row.type === 'إيراد يدوي'), row => row.amount);
    const salaries = sum(transactions.filter(row => row.type === 'رواتب'), row => row.amount);
    const overhead = sum(transactions.filter(row => row.type === 'مصروفات'), row => row.amount);
    const cost = sum(movements, row => row.type === 'استهلاك' ? row.cost : row.type === 'إرجاع استهلاك' ? -row.cost : 0);
    headings = ['البند','القيمة'];
    rows = [['قيمة الطلبات المكتملة', sales], ['إيراد يدوي', manual], ['تكلفة الاستهلاك بعد المرتجعات', -cost],
      ['الرواتب', -salaries], ['المصروفات الإضافية', -overhead], ['تقدير صافي التشغيل', sales + manual - cost - salaries - overhead]]
      .map(([label, value]) => [label, cash(value)]);
    description = 'التقدير يعتمد على الطلبات المكتملة بعد الخصم وتكلفة المواد المستهلكة والرواتب والمصروفات الإضافية.';
  } else if (kind === 'consumption') {
    headings = ['التاريخ','المادة','الحركة','الكمية','التكلفة','الموظف','الطلب'];
    rows = movements.filter(row => ['استهلاك','إرجاع استهلاك'].includes(row.type)).map(row => [
      dateLabel(row.date), name(data.materials, row.materialId), row.type, qty(Math.abs(row.quantity)) + ' ' + row.unit,
      cash(row.cost * (row.type === 'استهلاك' ? 1 : -1)), name(data.employees, row.employeeId),
      find(data.orders, row.reference) ? orderRef(find(data.orders, row.reference)) : row.reference
    ]);
  } else if (kind === 'valuation') {
    headings = ['المادة','التصنيف','الرصيد','تكلفة الوحدة','القيمة'];
    rows = data.materials.map(row => [row.name, row.category, qty(row.quantity) + ' ' + row.unit, cash(row.cost), cash(row.quantity * row.cost)]);
    rows.push(['إجمالي قيمة المخزون','—','—','—',cash(sum(data.materials, row => row.quantity * row.cost))]);
    description = 'يعرض هذا التقرير الرصيد الحالي وتكلفة الوحدة الحالية.';
  } else if (kind === 'performance') {
    headings = ['الموظف','الطلبات المكتملة','قيمتها','الحضور','الغياب'];
    rows = data.employees.map(employee => {
      const done = completed.filter(row => row.employeeId === employee.id);
      const attendance = data.attendance.filter(row => row.employeeId === employee.id && inRange(row.date));
      return [employee.name, num(done.length), cash(sum(done, row => row.total)), num(attendance.filter(row => row.state === 'حضور').length),
        num(attendance.filter(row => row.state === 'غياب').length)];
    });
  } else if (kind === 'visits') {
    headings = ['العميل','المحمول','الطلب','تاريخ الزيارة','الخدمات','المدفوع'];
    rows = completed.map(order => [name(data.customers, order.customerId), find(data.customers, order.customerId)?.phone,
      orderRef(order), dateLabel(order.completed), order.services.map(item => item.name).join('، '), cash(order.paid)]);
  } else if (kind === 'popular') {
    const counts = new Map();
    for (const order of orders) if (order.status !== statuses[4]) for (const service of order.services) {
      const entry = counts.get(service.id) || { name: name(data.services, service.id), count: 0, total: 0 };
      entry.count++;
      entry.total += service.price;
      counts.set(service.id, entry);
    }
    headings = ['الخدمة','مرات الاختيار','قيمة الخدمات قبل الخصم'];
    rows = [...counts.values()].sort((a,b) => b.count - a.count).map(item => [item.name, num(item.count), cash(item.total)]);
  } else if (kind === 'due') {
    headings = ['الطلب','العميل','التاريخ','الإجمالي','المدفوع','المتبقي'];
    rows = completed.filter(order => order.total > order.paid).map(order => [orderRef(order), name(data.customers, order.customerId),
      dateLabel(order.completed), cash(order.total), cash(order.paid), cash(order.total - order.paid)]);
    description = 'الرصيد المستحق الحالي للطلبات المكتملة في الفترة المختارة.';
  } else {
    headings = ['اليوم','النقد المتوقع','النقد المعدود','فرق الإغلاق','المسؤول','ملاحظات'];
    rows = data.closings.filter(row => inRange(row.date)).map(row => [dateLabel(row.date), cash(row.expected), cash(row.actual),
      cash(row.difference), row.user, row.notes || '—']);
  }
  if (!valid && kind !== 'valuation') rows = [];
  return { kind, from, to, valid, headings, rows, description, title: kinds.find(row => row[0] === kind)[1],
    totals: { orders: orders.length, sales, paid, expense } };
}
export function reports(ctx) {
  const view = report(ctx), currency = ctx.data.settings.currency;
  const toolbar = '<div class="toolbar">' + selectFilter('kind', 'اختيار التقرير', kinds, view.kind) +
    (view.kind === 'valuation' ? '' : dateFilter('from', 'من تاريخ', view.from) + dateFilter('to', 'إلى تاريخ', view.to)) + '</div>';
  return heading('التقارير', 'استعرض مؤشرات التشغيل والمال خلال فترة محددة وصدّر النتائج.',
    button('طباعة التقرير', 'report-print', { glyph: 'printer', disabled: !view.rows.length }) +
    button('تصدير CSV', 'report-csv', { glyph: 'download', style: 'primary', disabled: !view.rows.length })) +
    metrics([{ title: 'الطلبات المسجلة', value: num(view.totals.orders), icon: 'car' },
      { title: 'قيمة الغسيل المكتمل', value: num(view.totals.sales), unit: currency, icon: 'banknote', tone: 'green' },
      { title: 'صافي التحصيل', value: num(view.totals.paid), unit: currency, icon: 'wallet', tone: 'blue' },
      { title: 'المصروفات المدفوعة', value: num(view.totals.expense), unit: currency, icon: 'receipt', tone: 'amber' }]) +
    panel(view.title, toolbar + table(view.headings, view.rows.map(row => row.map(esc)),
      view.valid ? 'لا توجد سجلات في الفترة المحددة.' : 'يجب أن يسبق تاريخ البداية تاريخ النهاية.'), stamp(view.rows.length), view.description);
}
export const reportActions = {
  'report-csv': ctx => { const view = report(ctx); csv(view.title, view.headings, view.rows); },
  'report-print': ctx => {
    const view = report(ctx);
    const period = view.kind === 'valuation' ? 'التقييم الحالي' : 'الفترة من ' + (view.from ? dateLabel(view.from) : 'البداية') +
      ' إلى ' + (view.to ? dateLabel(view.to) : 'اليوم');
    printContent('<h1>' + esc(ctx.data.settings.name) + '</h1><h2>' + esc(view.title) + '</h2><p>' + esc(period) + '</p><p>' +
      esc(view.description) + '</p>' + table(view.headings, view.rows.map(row => row.map(esc))));
  }
};
