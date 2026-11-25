import { day, now, operator, id, methods, statuses, sum, round, num, esc, dateLabel, time, find, matches, required, label, amount } from './utils.js';
import { transaction, cashBalance, netTransactions } from './ledger.js';
import { heading, button, panel, metrics, table, tabs, searchBox, selectFilter, field, numeric, notes, formGrid, facts, values, coin, badge, stamp, iconButton } from './ui.js';

export function financialSummary(data) {
  const completed = data.orders.filter(order => order.status === statuses[3]);
  const transactions = data.transactions;
  const sales = sum(completed, order => order.total);
  const spending = type => sum(transactions.filter(row => row.direction === -1 && row.type === type), row => row.amount);
  const cost = sum(data.movements, row => row.type === 'استهلاك' ? row.cost : row.type === 'إرجاع استهلاك' ? -row.cost : 0);
  const collected = method => sum(transactions.filter(row => (row.direction === 1 || row.type === 'استرداد') &&
    (method ? row.method === method : row.method !== methods[0])), row => row.amount * row.direction);
  return { sales, purchases: spending('مشتريات'), salaries: spending('رواتب'), expenses: spending('مصروفات'),
    cashReceived: collected(methods[0]), electronicReceived: collected(), electronicNet: netTransactions(data) - netTransactions(data, methods[0]),
    due: sum(completed, order => order.total - order.paid), cost,
    profit: sales + sum(transactions.filter(row => row.type === 'إيراد يدوي'), row => row.amount) - cost - spending('رواتب') - spending('مصروفات') };
}
const groups = [['all','حركة الخزينة'], ['income','الإيرادات'], ['expense','المصروفات'], ['purchase','مشتريات المواد'],
  ['salary','الرواتب'], ['closing','الإغلاق اليومي']];
const groupCheck = {
  all: () => true,
  income: row => row.direction === 1 || row.type === 'استرداد',
  expense: row => row.type === 'مصروفات',
  purchase: row => row.type === 'مشتريات',
  salary: row => row.type === 'رواتب'
};
export function finance(ctx) {
  const data = ctx.data, { tab = 'all', q = '', method = '' } = ctx.filters;
  const summary = financialSummary(data), today = day(), closing = data.closings.find(row => row.date === today);
  const transactions = data.transactions.filter(row => groupCheck[tab]?.(row) && (!method || row.method === method) &&
    matches(q, row.description, row.type, row.reference, row.user));
  const closingRows = data.closings.filter(row => matches(q, row.date, dateLabel(row.date), row.notes, row.user));
  const cashStats = tab === 'closing' ? facts([
    ['إغلاق اليوم', closing ? 'تم الإغلاق' : 'بانتظار الإغلاق'], ['النقد المتوقع اليوم', coin(data, cashBalance(data, today))],
    ['النقد المعدود', closing ? coin(data, closing.actual) : '—'], ['الفرق المسجل', closing ? coin(data, closing.difference) : '—']
  ]) : facts([
    ['الرصيد الافتتاحي', coin(data, data.settings.opening)], ['المقبوضات النقدية', coin(data, summary.cashReceived)],
    ['المقبوضات الإلكترونية', coin(data, summary.electronicReceived)], ['صافي الحركة الإلكترونية', coin(data, summary.electronicNet)],
    ['مشتريات المواد', coin(data, summary.purchases)], ['الرواتب', coin(data, summary.salaries)], ['مصروفات إضافية', coin(data, summary.expenses)],
    ['تكلفة المواد المستهلكة', coin(data, summary.cost)]
  ]);
  return heading('الخزينة', 'راقب التحصيل والمصروفات وأغلق النقد الفعلي في نهاية اليوم.',
    button('تسجيل مصروف', 'expense-new', { glyph: 'receipt' }) + button('إضافة إيراد', 'income-new', { glyph: 'plus', style: 'primary' })) +
    metrics([
      { title: 'رصيد النقد الفعلي', value: num(cashBalance(data)), unit: data.settings.currency, icon: 'wallet' },
      { title: 'إيرادات الغسيل المستحقة', value: num(summary.sales), unit: data.settings.currency, icon: 'banknote', tone: 'green' },
      { title: 'مستحقات على العملاء', value: num(summary.due), unit: data.settings.currency, icon: 'clock', tone: 'amber' },
      { title: 'تقدير صافي التشغيل', value: num(summary.profit), unit: data.settings.currency, icon: 'trending-up', tone: 'blue' }
    ]) + '<div class="stack">' + panel(tab === 'closing' ? 'النقد عند الإغلاق' : 'ملخص المقبوضات والمصروفات',
      '<div class="panel-body">' + cashStats + '</div>', tab === 'closing' ? button('تسجيل إغلاق', 'closing-new', { glyph: 'calendar' }) : '') +
    panel('سجل الخزينة', tabs(groups, tab, 'finance-tab') + '<div class="toolbar">' + searchBox('q', 'البحث في سجل الخزينة', q) +
      (tab === 'closing' ? '' : selectFilter('method', 'جميع وسائل الدفع', methods, method)) + '</div>' +
      (tab === 'closing' ? table(['التاريخ','النقد المتوقع','النقد المعدود','الفرق','المسؤول','الملاحظات'], closingRows.map(row => [
        dateLabel(row.date), esc(coin(data, row.expected)), esc(coin(data, row.actual)), badge(coin(data, row.difference), row.difference === 0 ? 'green' : 'amber'),
        esc(row.user), esc(row.notes || '—')
      ]), 'لا توجد إغلاقات تطابق البحث.') : table(['التاريخ والوقت','البيان','النوع','المبلغ','الدفع','المسؤول',''], transactions.map(row => [
        dateLabel(row.date) + ' · ' + time(row.date), esc(row.description), esc(row.type),
        '<strong class="' + (row.direction > 0 ? 'text-green' : 'text-amber') + '">' + (row.direction > 0 ? '+' : '−') + ' ' + esc(coin(data, row.amount)) + '</strong>',
        esc(row.method), esc(row.user), iconButton('عرض الحركة', 'eye', 'transaction-view', row.id)
      ]), 'لا توجد معاملات تطابق البحث.')), stamp(tab === 'closing' ? closingRows.length : transactions.length)) + '</div>';
}
function manual(ctx, isIncome) {
  const title = isIncome ? 'إضافة إيراد يدوي' : 'تسجيل مصروف إضافي';
  ctx.modal({ title, submit: 'حفظ الحركة', body: formGrid(
    numeric('amount', 'المبلغ', '', .01), field('method', 'طريقة الدفع', methods[0], { items: methods }),
    field('description', 'وصف الحركة', '', { type: 'textarea', wide: true })
  ), onSubmit: async form => {
    const value = values(form);
    await ctx.mutate(data => { transaction(data, { type: isIncome ? 'إيراد يدوي' : 'مصروفات', direction: isIncome ? 1 : -1,
      amount: amount(value.amount, .01, 'المبلغ'), method: value.method, description: label(value.description, 'وصف الحركة'), reference: '' }); },
    'تم تسجيل الحركة المالية.', { close: true });
  } });
}
function closingForm(ctx) {
  const date = day(), current = ctx.data.closings.find(row => row.date === date);
  let expected = cashBalance(ctx.data, date);
  ctx.modal({ title: 'تسجيل الإغلاق اليومي', submit: 'تأكيد الإغلاق',
    body: formGrid(field('date', 'تاريخ الإغلاق', date, { type: 'date', attrs: 'max="' + date + '"' }),
      numeric('actual', 'النقد المعدود', ''), notes()) +
      '<div class="order-total"><span>النقد المتوقع <b data-expected></b></span><span>الفرق <strong data-difference></strong></span></div>',
    setup: form => {
      const refresh = () => {
        expected = cashBalance(ctx.data, form.elements.date.value || date);
        const count = form.elements.actual.value;
        let difference = '—';
        try { difference = coin(ctx.data, round(amount(count, 0) - expected)); } catch {}
        form.querySelector('[data-expected]').textContent = coin(ctx.data, expected);
        form.querySelector('[data-difference]').textContent = difference;
      };
      form.addEventListener('input', refresh); refresh();
    },
    onSubmit: async form => {
      const value = values(form), actual = round(amount(value.actual, 0, 'النقد المعدود'));
      await ctx.mutate(data => {
        required(value.date <= day() && !data.closings.some(row => row.date === value.date), 'تاريخ غير صالح أو يوجد إغلاق مسجل بالفعل لهذا اليوم.');
        const expected = cashBalance(data, value.date);
        data.closings.unshift({ id: id('CL'), date: value.date, actual, expected, difference: round(actual - expected), user: operator, notes: value.notes.trim() });
      }, 'تم تسجيل الإغلاق اليومي.', { close: true });
    } });
}
export const financeActions = {
  'finance-tab': (ctx, key) => ctx.setFilters({ tab: key, method: '' }),
  'expense-new': ctx => manual(ctx, false), 'income-new': ctx => manual(ctx, true), 'closing-new': closingForm,
  'transaction-view': (ctx, key) => {
    const data = ctx.data, row = find(data.transactions, key);
    const order = find(data.orders, row.reference);
    const purchase = find(data.purchases, row.reference);
    ctx.modal({ title: 'تفاصيل الحركة المالية', body: facts([
      ['المعرّف', row.id], ['النوع', row.type], ['المبلغ', coin(data, row.amount * row.direction)], ['طريقة الدفع', row.method],
      ['البيان', row.description], ['المرجع', row.reference || '—'], ['الوقت', dateLabel(row.date) + ' · ' + time(row.date)], ['المسؤول', row.user]
    ]) + (order || purchase ? '<div class="form-actions">' + button('فتح المرجع', order ? 'order-view' : 'purchase-view', { key: row.reference }) + '</div>' : '') });
  }
};

