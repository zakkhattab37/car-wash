import { esc, money, num, orderRef, paymentStatus, statuses } from './utils.js';

export function icon(name, size = 20) {
  return '<i aria-hidden="true" class="app-icon app-icon-' + esc(name) + '" style="font-size:' + size + 'px"></i>';
}
export const button = (text, action, { style = 'secondary', glyph, key, disabled = false } = {}) =>
  '<button type="button" class="btn btn-' + style + '" data-action="' + esc(action) + '"' + (key ? ' data-key="' + esc(key) + '"' : '') + (disabled ? ' disabled' : '') + '>' + (glyph ? icon(glyph, 17) : '') + esc(text) + '</button>';
export const iconButton = (title, glyph, action, key = '') =>
  '<button type="button" class="icon-btn" title="' + esc(title) + '" aria-label="' + esc(title) + '" data-action="' + esc(action) + '" data-key="' + esc(key) + '">' + icon(glyph, 19) + '</button>';
export const badge = (text, tone = 'muted') => '<span class="badge badge-' + tone + '">' + esc(text) + '</span>';
export const statusBadge = value => badge(value, ['amber','cyan','purple','green','red'][statuses.indexOf(value)] || 'muted');
export const paymentBadge = order => badge(paymentStatus(order), order.paid >= order.total ? 'green' : order.paid > 0 ? 'amber' : 'muted');
export function heading(title, description, actions = '') {
  return '<div class="page-heading"><div><h1>' + esc(title) + '</h1><p>' + esc(description) + '</p></div><div class="page-actions">' + actions + '</div></div>';
}
export const panel = (title, body, actions = '', description = '') =>
  '<section class="panel"><div class="panel-head"><div><h2>' + esc(title) + '</h2>' + (description ? '<p>' + esc(description) + '</p>' : '') +
  '</div><div class="panel-actions">' + actions + '</div></div>' + body + '</section>';
export const empty = (message = 'لا توجد سجلات لعرضها.') => '<div class="empty">' + icon('package', 26) + '<p>' + esc(message) + '</p></div>';
export function table(headings, rows, message) {
  if (!rows.length) return empty(message);
  return '<div class="table-wrap"><table><thead><tr>' + headings.map(value => '<th scope="col">' + esc(value) + '</th>').join('') +
    '</tr></thead><tbody>' + rows.map(row => '<tr>' + row.map(value => '<td>' + value + '</td>').join('') + '</tr>').join('') +
    '</tbody></table></div>';
}
export const options = (items, selected = '', placeholder) => (placeholder ? '<option value="">' + esc(placeholder) + '</option>' : '') +
  items.map(item => {
    const [value, label] = Array.isArray(item) ? item : [item, item];
    return '<option value="' + esc(value) + '"' + (String(value) === String(selected) ? ' selected' : '') + '>' + esc(label) + '</option>';
  }).join('');
export function field(name, title, value = '', config = {}) {
  const { type = 'text', optional = false, wide = false, items, placeholder, attrs = '' } = config;
  const common = ' name="' + esc(name) + '"' + (optional ? '' : ' required') + ' ' + attrs;
  let control;
  if (type === 'textarea') control = '<textarea' + common + ' rows="3">' + esc(value) + '</textarea>';
  else if (items) control = '<select' + common + '>' + options(items, value, placeholder) + '</select>';
  else control = '<input type="' + type + '"' + common + ' value="' + esc(value) + '"' + (placeholder ? ' placeholder="' + esc(placeholder) + '"' : '') + '>';
  return '<label class="field' + (wide ? ' wide' : '') + '"><span>' + esc(title) + '</span>' + control + '</label>';
}
export const numeric = (name, title, value = '', min = 0) => field(name, title, value, { type: 'text', attrs: 'inputmode="decimal" data-min="' + min + '"' });
export const notes = (name = 'notes', title = 'ملاحظات', value = '') => field(name, title, value, { type: 'textarea', optional: true, wide: true });
export const formGrid = (...fields) => '<div class="form-grid">' + fields.join('') + '</div>';
export const metrics = items => '<div class="metrics">' + items.map(item => '<article class="metric"><div class="metric-top"><span class="metric-icon tone-' + (item.tone || 'teal') + '">' + icon(item.icon) + '</span><span>' + esc(item.title) + '</span></div><strong class="metric-value">' + esc(item.value) + (item.unit ? ' <small>' + esc(item.unit) + '</small>' : '') + '</strong>' + (item.footer ? '<div class="metric-foot">' + item.footer + '</div>' : '') + '</article>').join('') + '</div>';
export const facts = items => '<dl class="facts">' + items.map(([title, value]) => '<div><dt>' + esc(title) + '</dt><dd>' + esc(value) + '</dd></div>').join('') + '</dl>';
export const searchBox = (key, placeholder, value = '') => '<label class="search-field">' + icon('search', 18) + '<input type="search" data-filter="' + key + '" value="' + esc(value) + '" placeholder="' + esc(placeholder) + '" aria-label="' + esc(placeholder) + '"></label>';
export const selectFilter = (key, label, items, value = '') => '<select aria-label="' + esc(label) + '" data-filter="' + key + '">' + options(items, value, label) + '</select>';
export const dateFilter = (key, title, value = '') => '<label class="field date-filter"><span>' + esc(title) + '</span><input type="date" data-filter="' + key + '" value="' + esc(value) + '"></label>';
export const tabs = (items, active, action) => '<div class="tabs" aria-label="التصنيفات">' + items.map(([value, label]) =>
  '<button type="button" class="tab' + (value === active ? ' active' : '') + '" aria-pressed="' + (value === active) + '" data-action="' + action + '" data-key="' + esc(value) + '">' + esc(label) + '</button>').join('') + '</div>';
export const orderLink = order => '<button class="text-btn ref" type="button" data-action="order-view" data-key="' + esc(order.id) + '">' + esc(orderRef(order)) + '</button>';
export const values = form => Object.fromEntries(new FormData(form));
export const normalizedText = text => text.trim();
export const coin = (data, value) => money(value, data.settings.currency);
export function csv(title, headers, rows) {
  const quote = value => '"' + String(value ?? '').replace(/^[=+@\-\t\r]/, prefix => "'" + prefix).replaceAll('"', '""') + '"';
  const blob = new Blob(['\ufeff' + [headers, ...rows].map(row => row.map(quote).join(',')).join('\r\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const anchor = Object.assign(document.createElement('a'), { href: url, download: title + '.csv' });
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export function printContent(html) {
  document.querySelector('#print-area').innerHTML = html;
  window.print();
}
export const stamp = count => '<span class="muted">' + num(count) + ' سجل</span>';

