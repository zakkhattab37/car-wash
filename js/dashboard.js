import { num, qty, esc, day, daysAgo, egDate, time, sum, statuses, find } from './utils.js';
import { cashBalance, lowStock } from './ledger.js';
import { icon, button, heading, metrics, panel, badge, statusBadge, table, empty, coin, orderLink } from './ui.js';
const colors = ['#116C78', '#295C98', '#734EA1', '#99600B', '#0D719F', '#487023', '#A13A64', '#566974'];
const legend = series => '<div class="chart-legend">' + series.map(item =>
  '<span><i class="dot" style="background:' + item.color + '"></i>' + esc(item.label) + '</span>').join('') + '</div>';
let disposeAnalytics;

export function clearAnalytics() {
  disposeAnalytics?.();
  disposeAnalytics = undefined;
}

function activitySeries(data, count) {
  const dates = Array.from({ length: count }, (_, i) => daysAgo(count - i - 1));
  const grouped = new Map(dates.map(date => [date, [0, 0, 0, 0]]));
  for (const row of data.transactions) {
    const values = grouped.get(day(row.date));
    if (!values) continue;
    if (row.type === 'استرداد') values[0] -= row.amount;
    else values[row.direction === 1 ? 0 : 1] += row.amount;
  }
  for (const row of data.orders) {
    const values = grouped.get(day(row.date));
    if (values && row.status !== statuses[4]) values[2]++;
  }
  for (const row of data.movements) {
    const values = grouped.get(day(row.date));
    if (values && row.type === 'استهلاك') values[3] += row.cost;
    if (values && row.type === 'إرجاع استهلاك') values[3] -= row.cost;
  }
  return { labels: dates.map(date => egDate(date, { day: 'numeric', month: 'short' })), series: [
    { label: 'الإيرادات', color: colors[0], data: dates.map(date => grouped.get(date)[0]) },
    { label: 'المصروفات', color: colors[3], data: dates.map(date => grouped.get(date)[1]) },
    { label: 'طلبات الغسيل', color: colors[1], data: dates.map(date => grouped.get(date)[2]) },
    { label: 'تكلفة الاستهلاك', color: colors[2], data: dates.map(date => grouped.get(date)[3]) }
  ] };
}
const ranges = [['7','٧ أيام'], ['30','٣٠ يوماً']];
const modes = [['money','المالية'], ['orders','الطلبات'], ['usage','الاستهلاك']];
const segmented = (items, active, action) => '<div class="segmented">' + items.map(([value, text]) =>
  '<button type="button" class="' + (value === active ? 'active' : '') + '" aria-pressed="' + (value === active) + '" data-action="' + action + '" data-key="' + value + '">' + text + '</button>').join('') + '</div>';
export const stockAlerts = items => items.length ? '<div class="alert-list">' + items.map(item =>
  '<div class="alert-row"><div><span class="mini-icon tone-amber">' + icon('package', 17) + '</span><span><strong>' + esc(item.name) + '</strong><small>الحد الأدنى ' + qty(item.min) + ' ' + esc(item.unit) + '</small></span></div>' +
  badge(qty(item.quantity) + ' ' + item.unit + ' متبقي', item.quantity === 0 ? 'red' : 'amber') + '</div>').join('') + '</div>' : empty('جميع المواد أعلى من الحد الأدنى.');
const authoredAlerts = data => lowStock(data).map(item => ({...item, min: item.minimum ?? data.settings.minimum}));
const mini = (title, count, glyph, tone) => '<div class="summary-mini"><span class="mini-icon tone-' + tone + '">' + icon(glyph, 16) +
  '</span><span><strong>' + num(count) + '</strong><small>' + title + '</small></span></div>';
function quick(text, sub, glyph, tone, action) {
  return '<button type="button" class="quick-row" data-action="' + action + '"><div><span class="mini-icon tone-' + tone + '">' +
    icon(glyph, 17) + '</span><span><strong>' + text + '</strong><small>' + sub + '</small></span></div>' + icon('chevron-left', 15) + '</button>';
}

export function dashboard(ctx) {
  const data = ctx.data, filter = ctx.filters;
  const today = day(), yesterday = daysAgo(1), unit = data.settings.currency;
  const todaysOrders = data.orders.filter(order => day(order.date) === today);
  const active = data.orders.filter(order => statuses.slice(0, 3).includes(order.status)).length;
  const complete = data.orders.filter(order => order.status === statuses[3] && day(order.completed) === today).length;
  const alerts = authoredAlerts(data);
  const allOrders = data.orders.filter(order => order.status !== statuses[4]);
  const todayCars = new Set(todaysOrders.filter(order => order.status !== statuses[4]).map(order => order.carId)).size;
  const yesterdayCars = new Set(allOrders.filter(order => day(order.date) === yesterday).map(order => order.carId)).size;
  const counts = new Map();
  for (const order of allOrders) for (const service of order.services) {
    const latestName = find(data.services, service.id)?.name || service.name;
    counts.set(latestName, (counts.get(latestName) ?? 0) + 1);
  }
  const ranked = [...counts].sort((a, b) => b[1] - a[1]);
  const popular = ranked.length > 5 ? [...ranked.slice(0, 5), ['خدمات أخرى', sum(ranked.slice(5), row => row[1])]] : ranked;
  const totalServices = sum(popular, row => row[1]);
  const received = date => sum(data.transactions.filter(row => day(row.date) === date && (row.direction === 1 || row.type === 'استرداد')), row => row.amount * row.direction);
  const spending = date => sum(data.transactions.filter(row => day(row.date) === date && row.direction === -1 && row.type !== 'استرداد'), row => row.amount);
  const trend = (a, b, suffix = '', good = a >= b) => '<b class="' + (good ? 'text-green' : 'text-amber') + '">' +
    icon(a >= b ? 'trending-up' : 'trending-down', 13) + ' ' + (a === b ? '' : a > b ? '+' : '−') + num(Math.abs(a - b)) +
    (suffix ? ' ' + esc(suffix) : '') + '</b> مقارنة بالأمس';
  const mode = filter.mode || 'money', range = filter.range || '7';
  const activity = activitySeries(data, Number(range));
  const displayed = mode === 'orders' ? activity.series.slice(2, 3) : mode === 'usage' ? activity.series.slice(3) : activity.series.slice(0, 2);
  const recent = data.orders.slice(0, 6).map(order => {
    const customer = find(data.customers, order.customerId), car = find(data.cars, order.carId);
    return [orderLink(order), '<span class="cell-name"><span class="avatar round">' + esc(customer?.name[0] || '؟') + '</span>' + esc(customer?.name) + '</span>',
      esc(car?.make + ' ' + car?.model), esc(order.services.map(item => item.name).join('، ')),
      statusBadge(order.status), '<strong>' + esc(coin(data, order.total)) + '</strong>', esc(time(order.date))];
  });
  const transactions = data.transactions.slice(0, 5);
  const tx = transactions.length ? '<div class="alert-list">' + transactions.map(row => '<div class="alert-row"><div><span class="mini-icon tone-' +
    (row.direction > 0 ? 'green' : 'amber') + '">' + icon(row.direction > 0 ? 'trending-up' : 'trending-down', 16) +
    '</span><span><strong>' + esc(row.description) + '</strong><small>' + esc(row.method) + ' · ' + esc(time(row.date)) +
    '</small></span></div><strong class="' + (row.direction > 0 ? 'text-green' : 'text-amber') + '">' +
    (row.direction > 0 ? '+' : '−') + ' ' + esc(coin(data, row.amount)) + '</strong></div>').join('') + '</div>' : empty('لا توجد معاملات مالية بعد.');
  return heading('لوحة التحكم', 'نظرة عامة على أداء المغسلة وحركة التشغيل اليومية.', '<span class="date-chip">' +
    icon('calendar', 16) + esc(egDate(new Date(), { dateStyle: 'full' })) + '</span>' +
    button('تسجيل غسلة جديدة', 'order-new', { style: 'primary', glyph: 'plus' })) +
    metrics([
      { title: 'سيارات اليوم', value: num(todayCars), icon: 'car', tone: 'teal', footer: trend(todayCars, yesterdayCars) },
      { title: 'إيرادات اليوم', value: num(received(today)), unit, icon: 'banknote', tone: 'green', footer: trend(received(today), received(yesterday), unit) },
      { title: 'مصروفات اليوم', value: num(spending(today)), unit, icon: 'receipt', tone: 'amber', footer: trend(spending(today), spending(yesterday), unit, spending(today) <= spending(yesterday)) },
      { title: 'رصيد الخزينة', value: num(cashBalance(data)), unit, icon: 'wallet', tone: 'blue', footer: 'الرصيد النقدي المتاح' }
    ]) +
    '<div class="dashboard-grid charts">' +
    panel('نظرة على الأداء', '<div class="chart-box" id="activity-chart" aria-label="رسم بياني للأداء"></div>' + legend(displayed),
      segmented(modes, mode, 'chart-mode') + segmented(ranges, range, 'chart-range'), 'حركة التشغيل خلال الفترة المحددة') +
    panel('الخدمات الأكثر طلباً', '<div class="chart-box donut-holder"><div class="analytics-plot" id="services-chart" aria-label="توزيع خدمات الغسيل"></div>' +
      '<div class="donut-center"><strong>' + num(totalServices) + '</strong><small>إجمالي الخدمات</small></div></div>' +
      '<div class="donut-legend">' + popular.map(([name, count], index) => '<div><i class="dot" style="background:' + colors[index] + '"></i><span>' + esc(name) + '</span><strong>' + num(count) + '</strong></div>').join('') + '</div>',
      '', 'توزيع الخدمات في الطلبات المسجلة') + '</div>' +
    '<div class="summary-strip">' + mini('إجمالي العملاء', data.customers.length, 'users-round', 'teal') +
    mini('طلبات قيد التنفيذ', active, 'clock', 'blue') + mini('مكتملة اليوم', complete, 'circle-check', 'green') +
    mini('مواد منخفضة', alerts.length, 'triangle-alert', 'amber') +
    mini('حضور اليوم', data.attendance.filter(row => row.date === today && row.state === 'حضور' && find(data.employees, row.employeeId)?.active).length, 'badge-check', 'purple') + '</div>' +
    '<div class="dashboard-grid">' +
    panel('أحدث طلبات الغسيل', table(['الطلب','العميل','السيارة','الخدمة','الحالة','المبلغ','الوقت'], recent),
      button('عرض الطلبات', 'go', { key: 'orders' })) +
    panel('تنبيهات المخزون', stockAlerts(alerts.slice(0, 5)), badge(num(alerts.length) + ' مواد', alerts.length ? 'amber' : 'green')) + '</div>' +
    '<div class="dashboard-grid">' + panel('آخر حركات الخزينة', tx, button('حركة الخزينة', 'go', { key: 'finance' })) +
    panel('إجراءات سريعة', '<div class="quick-list">' +
      quick('إضافة عميل', 'تسجيل بيانات عميل جديد', 'user-plus', 'teal', 'customer-new') +
      quick('تسجيل مشتريات', 'إضافة كمية وتسجيل دفعة', 'package', 'blue', 'purchase-new') +
      quick('تسجيل مصروف', 'إضافة حركة مالية للخزينة', 'wallet', 'amber', 'expense-new') + '</div>') + '</div>' +
    '<template id="chart-data">' + esc(JSON.stringify({ labels: activity.labels, displayed, mode, unit, popular })) + '</template>';
}

export function mountDashboard() {
  const root = document.querySelector('#chart-data');
  if (!root) return;
  const activity = document.querySelector('#activity-chart');
  const services = document.querySelector('#services-chart');
  import('../assets/analytics.js').then(({ mountAnalytics }) => {
    if (root.isConnected) {
      const data = JSON.parse(root.content.textContent);
      disposeAnalytics = mountAnalytics(activity, services, { ...data, palette: colors });
    }
  }).catch(error => {
    if (!root.isConnected) return;
    activity.textContent = 'تعذر تحميل الرسم البياني.';
    services.textContent = 'تعذر تحميل الرسم البياني.';
    console.error(error);
  });
}
export const dashboardActions = {
  'chart-range': (ctx, key) => ctx.setFilter('range', key),
  'chart-mode': (ctx, key) => ctx.setFilter('mode', key),
  notifications: ctx => ctx.modal({ title: 'تنبيهات المخزون', body: stockAlerts(authoredAlerts(ctx.data)) +
    '<div class="form-actions">' + button('فتح المخزون', 'go', { key: 'inventory' }) + '</div>' })
};

