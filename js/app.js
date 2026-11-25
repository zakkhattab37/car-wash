import { money, dateLabel, esc, find, day, num, matches, orderRef, operator, roles, statuses } from './utils.js';
import { load, update, onStorage } from './storage.js';
import { icon, iconButton, button, table, empty } from './ui.js';
import { dashboard, mountDashboard, clearAnalytics, dashboardActions } from './dashboard.js';
import { customers, customerActions } from './customers.js';
import { orders, orderActions } from './orders.js';
import { services, serviceActions } from './services.js';
import { inventory, inventoryActions } from './inventory.js';
import { finance, financeActions } from './finance.js';
import { employees, employeeActions } from './employees.js';
import { reports, reportActions } from './reports.js';
import { settings, settingsActions } from './settings.js';

const pages = {
  dashboard: { title: 'لوحة التحكم', icon: 'layout-dashboard', view: dashboard },
  customers: { title: 'العملاء والسيارات', icon: 'users-round', view: customers, actions: customerActions },
  orders: { title: 'التسجيل اليومي', icon: 'clipboard-list', view: orders, actions: orderActions },
  services: { title: 'خدمات الغسيل', icon: 'droplets', view: services, actions: serviceActions },
  inventory: { title: 'المخزون', icon: 'boxes', view: inventory, actions: inventoryActions },
  finance: { title: 'الخزينة', icon: 'wallet', view: finance, actions: financeActions },
  employees: { title: 'الموظفون', icon: 'badge-check', view: employees, actions: employeeActions },
  reports: { title: 'التقارير', icon: 'chart-no-axes-column-increasing', view: reports, actions: reportActions },
  settings: { title: 'الإعدادات', icon: 'settings', view: settings }
};
const access = [Object.keys(pages), ['customers','orders'], ['inventory']];
const footer = document.querySelector('.app-footer');
const content = document.querySelector('#content');
const sidebar = document.querySelector('#sidebar');
const sidebarHandle = document.querySelector('#sidebar-handle');
const topbar = document.querySelector('#topbar');
const backdrop = document.querySelector('#backdrop');
const dialog = document.querySelector('#modal');
const toasts = document.querySelector('#toasts');
const narrow = matchMedia('(max-width: 930px)');
const stateFilters = {};
let state, page, dialogActions = {}, dialogBack, drawer = false;
let sidebarDrag;

function sidebarLimits() {
  const max = Math.floor(innerWidth * (narrow.matches ? .83 : .45));
  return narrow.matches
    ? { closed: 0, min: Math.min(200, max), max }
    : { closed: 69, min: 190, max: Math.min(480, max) };
}

function sidebarWidth() {
  return narrow.matches && !drawer ? 0 : Math.round(sidebar.getBoundingClientRect().width);
}

function updateSidebarHandle(width = sidebarWidth()) {
  const { closed, min, max } = sidebarLimits();
  sidebarHandle.setAttribute('aria-valuemin', closed);
  sidebarHandle.setAttribute('aria-valuemax', max);
  sidebarHandle.setAttribute('aria-valuenow', width);
  sidebarHandle.setAttribute('aria-valuetext', width < min ? 'مغلقة' : num(width) + ' بكسل');
}

function setSidebarWidth(width) {
  const { closed, min, max } = sidebarLimits();
  const open = width >= (closed + min) / 2;
  const size = Math.round(Math.min(max, Math.max(min, width)));
  if (open) {
    const property = narrow.matches ? '--mobile-sidebar-width' : '--desktop-sidebar-width';
    document.body.style.setProperty(property, size + 'px');
  }
  if (!narrow.matches) document.body.classList.toggle('collapsed', !open);
  setDrawer(open);
  updateSidebarHandle(open ? size : closed);
}

sidebarHandle.addEventListener('pointerdown', event => {
  if (!event.isPrimary || event.button !== 0 || sidebarDrag) return;
  sidebarDrag = { pointer: event.pointerId, start: event.clientX, width: sidebarWidth() };
  sidebarHandle.setPointerCapture(event.pointerId);
});
sidebarHandle.addEventListener('pointermove', event => {
  if (sidebarDrag?.pointer !== event.pointerId) return;
  const delta = sidebarDrag.start - event.clientX;
  if (!document.body.classList.contains('sidebar-dragging') && Math.abs(delta) < 5) return;
  const { closed, max } = sidebarLimits();
  const width = Math.round(Math.min(max, Math.max(closed, sidebarDrag.width + delta)));
  document.body.style.setProperty('--sidebar-drag-width', width + 'px');
  document.body.classList.add('sidebar-dragging');
  updateSidebarHandle(width);
});
function finishSidebarDrag(event) {
  if (sidebarDrag?.pointer !== event.pointerId) return;
  const moved = document.body.classList.contains('sidebar-dragging');
  const width = sidebarDrag.width + sidebarDrag.start - event.clientX;
  sidebarDrag = undefined;
  if (moved && event.type === 'pointerup') setSidebarWidth(width);
  document.body.classList.remove('sidebar-dragging');
  document.body.style.removeProperty('--sidebar-drag-width');
  requestAnimationFrame(() => updateSidebarHandle());
}
for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) {
  sidebarHandle.addEventListener(type, finishSidebarDrag);
}
sidebar.addEventListener('transitionend', event => {
  if (event.target === sidebar && event.propertyName === 'width') updateSidebarHandle();
});
sidebarHandle.addEventListener('keydown', event => {
  const { closed, min, max } = sidebarLimits();
  const width = sidebarWidth();
  const step = event.shiftKey ? 48 : 16;
  const next = {
    ArrowLeft: width < min ? min : width + step,
    ArrowRight: width <= min ? closed : Math.max(min, width - step),
    Home: closed, End: max
  }[event.key];
  if (next === undefined) return;
  event.preventDefault();
  setSidebarWidth(next);
});
const currentRoute = () => location.hash.slice(1);

function notify(message, type = 'success') {
  const toast = document.createElement('div');
  toast.className = 'toast' + (type === 'error' ? ' error' : '');
  toast.innerHTML = icon(type === 'error' ? 'triangle-alert' : 'circle-check', 18) + '<span>' + esc(message) + '</span>';
  toasts.append(toast);
  setTimeout(() => { toast.classList.add('out'); setTimeout(() => toast.remove(), 170); }, 3200);
}
function closeModal() {
  if (dialog.open) dialog.close();
  dialogActions = {};
  dialogBack = null;
}
function setDrawer(value) {
  drawer = value && narrow.matches;
  document.body.classList.toggle('drawer-open', drawer);
  backdrop.hidden = !drawer;
  sidebar.inert = narrow.matches && !drawer;
  updateSidebarHandle();
  const toggle = topbar.querySelector('[data-action="sidebar-toggle"]');
  if (toggle) {
    const open = narrow.matches ? drawer : !document.body.classList.contains('collapsed');
    const label = open ? 'إغلاق القائمة' : 'فتح القائمة';
    toggle.setAttribute('aria-expanded', String(open));
    toggle.setAttribute('aria-label', label);
    toggle.title = label;
    toggle.innerHTML = icon(open ? 'x' : 'menu', 18) + '<span>' + label + '</span>';
  }
}
function shell() {
  const s = state.settings;
  const role = roles[s.role];
  const selected = pages[page];
  const items = Object.entries(pages).filter(([key]) => ctx.can(key));
  const count = state.orders.filter(order => statuses.slice(0, 3).includes(order.status)).length;
  const links = entries => entries.map(([key, entry]) => '<a class="nav-link' + (page === key ? ' active' : '') + '" href="#' +
    key + '" title="' + entry.title + '"' + (page === key ? ' aria-current="page"' : '') + '>' + icon(entry.icon, 19) +
    '<span class="nav-text">' + entry.title + '</span>' + (key === 'orders' && count ? '<span class="nav-count">' + num(count) + '</span>' : '') + '</a>').join('');
  const navGroup = (title, entries) => !entries.length ? '' : '<p class="side-label">' + title + '</p><nav class="side-nav" aria-label="' + title + '">' + links(entries) + '</nav>';
  sidebar.innerHTML = '<a class="brand" href="#' + access[s.role][0] + '"><img src="' + esc(s.logo || 'assets/mark.svg') +
    '" alt=""><span class="brand-text"><strong>' + esc(s.name === 'مغسلة البشمهندس' ? 'البشمهندس' : s.name) +
    '</strong><small>نظام إدارة المغسلة</small></span></a><div class="side-body">' +
    navGroup('التشغيل', items.filter(([key]) => ['dashboard','customers','orders','services','inventory','finance'].includes(key))) +
    navGroup('الإدارة', items.filter(([key]) => ['employees','reports','settings'].includes(key))) + '</div>' +
    '<div class="side-footer"><div class="branch"><span class="branch-icon">' + icon('car', 17) +
    '</span><span class="branch-text"><strong>الفرع الرئيسي</strong><small>' + esc(s.address) + '</small></span></div></div>';
  topbar.innerHTML = '<div class="top-group"><button type="button" class="btn sidebar-toggle" data-action="sidebar-toggle" aria-controls="sidebar"></button>' +
    '<div class="breadcrumb"><span>الإدارة</span>' + icon('chevron-left', 13) + '<strong>' + selected.title + '</strong></div></div>' +
    '<div class="top-group"><button type="button" class="btn top-search" data-action="global-search" aria-label="بحث شامل">' +
    icon('search', 17) + '<span>بحث سريع</span><kbd>Ctrl K</kbd></button>' +
    (ctx.can('inventory') ? iconButton('تنبيهات المخزون', 'bell', 'notifications') : '') +
    '<span class="top-divider"></span><button class="profile" type="button" data-action="profile" aria-label="حساب التشغيل التجريبي">' +
    '<span class="avatar">أم</span><span><strong>' + operator + '</strong><small>' + role + '</small></span>' + icon('chevron-down', 14) + '</button></div>';
  const notifications = topbar.querySelector('[data-action="notifications"]');
  notifications?.classList.toggle('has-alert', state.materials.some(row => row.quantity <= (row.minimum ?? s.minimum)));
  footer.firstElementChild.textContent = s.name + ' لإدارة مغاسل السيارات';
  setDrawer(drawer);
  document.title = selected.title + ' | ' + s.name;
}
function render({ animate = false, chrome = true } = {}) {
  if (chrome) shell();
  clearAnalytics();
  const focused = content.contains(document.activeElement) ? document.activeElement : null;
  const fieldKey = focused?.dataset.filter;
  const tabAction = focused?.matches('button[aria-pressed][data-action]') ? focused.dataset.action : null;
  const caret = focused?.type === 'search' ? [focused.selectionStart, focused.selectionEnd] : null;
  content.innerHTML = pages[page].view(ctx);
  content.setAttribute('aria-busy', 'false');
  if (animate) {
    content.classList.remove('animate-page');
    void content.offsetWidth;
    content.classList.add('animate-page');
  }
  if (fieldKey) {
    const replaced = content.querySelector('[data-filter="' + CSS.escape(fieldKey) + '"]');
    replaced?.focus({ preventScroll: true });
    if (caret && replaced?.type === 'search') replaced.setSelectionRange(...caret);
  } else if (tabAction) {
    content.querySelector('[data-action="' + CSS.escape(tabAction) + '"][data-key="' +
      CSS.escape(focused.dataset.key) + '"]')?.focus({ preventScroll: true });
  }
  if (page === 'dashboard') mountDashboard();
}
function go(key, { focus = false } = {}) {
  const next = ctx.can(key) ? key : access[state.settings.role][0];
  const changed = next !== page;
  page = next;
  if (location.hash !== '#' + next) history.replaceState(null, '', '#' + next);
  closeModal();
  setDrawer(false);
  render({ animate: changed });
  if (changed) window.scrollTo(0, 0);
  if (focus) content.focus({ preventScroll: true });
}
function showModal({ title, body, submit, danger, onBack, onSubmit, setup, large, localActions = {} }) {
  dialogActions = localActions;
  dialogBack = onBack || null;
  dialog.classList.toggle('large', Boolean(large));
  dialog.setAttribute('aria-labelledby', 'dialog-title');
  dialog.innerHTML = '<header class="modal-head"><h2 id="dialog-title">' + esc(title) + '</h2>' + iconButton('إغلاق', 'x', 'modal-close') +
    '</header><div class="modal-body">' + (onSubmit ? '<form novalidate>' + body + '<p class="modal-error" role="alert" hidden></p>' +
      '<div class="form-actions">' + button(onBack ? 'رجوع' : 'إغلاق', 'modal-close') + '<button type="submit" class="btn btn-' +
      (danger ? 'danger' : 'primary') + '">' + esc(submit || 'حفظ') + '</button></div></form>' : body) + '</div>';
  if (!dialog.open) dialog.showModal();
  dialog.scrollTop = 0;
  const root = dialog.querySelector('form') || dialog.querySelector('.modal-body');
  if (onSubmit) root.addEventListener('submit', async event => {
    event.preventDefault();
    const submitButton = root.querySelector('button[type="submit"]'), errorBox = root.querySelector('.modal-error');
    if (submitButton.disabled) return;
    errorBox.hidden = true;
    const invalid = [...root.elements].find(element => element.willValidate && !element.validity.valid);
    if (invalid) {
      const fieldLabel = invalid.closest('label')?.querySelector('span')?.textContent;
      errorBox.textContent = fieldLabel ? 'راجع حقل ' + fieldLabel + '.' : 'أكمل الحقول المطلوبة.';
      errorBox.hidden = false;
      invalid.focus();
      return;
    }
    submitButton.disabled = true;
    try { await onSubmit(root); }
    catch (error) {
      errorBox.textContent = error.name === 'QuotaExceededError' ? 'مساحة التخزين المحلية ممتلئة.' : error.message || 'تعذر حفظ البيانات.';
      errorBox.hidden = false;
      errorBox.scrollIntoView({ block: 'nearest' });
    }
    finally { submitButton.disabled = false; }
  });
  setup?.(root);
  const focus = root.querySelector('input[type="search"], [autofocus]') || dialog.querySelector('.modal-head button');
  focus?.focus({ preventScroll: true });
}
const ctx = {
  get data() { return state; },
  get filters() { return stateFilters[page] ||= {}; },
  can(key) { return (access[state?.settings.role] || access[0]).includes(key); },
  setFilters(values) { Object.assign(ctx.filters, values); render({ chrome: false }); },
  setFilter(key, value) { ctx.setFilters({ [key]: value }); },
  go,
  modal: showModal,
  confirm(title, text, commit) { showModal({ title, body: '<p>' + esc(text) + '</p>', submit: 'تأكيد', danger: true, onSubmit: commit }); },
  async mutate(change, message, { close = false } = {}) {
    state = await update(change);
    if (close) closeModal();
    if (!ctx.can(page)) go(access[state.settings.role][0]);
    else render();
    if (message) {
      notify(message);
      const row = content.querySelector('tbody tr');
      row?.classList.add('row-in');
    }
  },
  dispatch(action, key) { return dispatch(action, key); }
};
function search() {
  showModal({ title: 'بحث سريع', large: true, body: '<label class="search-field">' + icon('search', 18) +
    '<input type="search" placeholder="اسم العميل، رقم الطلب، أو اسم المادة" aria-label="البحث في النظام"></label><div class="form-section" data-results></div>',
    setup: root => {
      const input = root.querySelector('input');
      const results = root.querySelector('[data-results]');
      const searchRecords = () => {
        const query = input.value.trim();
        if (!query) { results.innerHTML = empty('اكتب كلمة للبحث في سجلات الوحدات المتاحة.'); return; }
        const rows = [];
        if (ctx.can('customers')) for (const row of state.customers.filter(row => matches(query, row.name, row.phone, row.secondary)).slice(0, 7)) {
          rows.push(['عميل', esc(row.name), esc(row.phone), button('فتح', 'customer-view', { key: row.id })]);
        }
        if (ctx.can('orders')) for (const row of state.orders.filter(row => {
          const customer = find(state.customers, row.customerId), car = find(state.cars, row.carId);
          return matches(query, orderRef(row), row.number, customer?.name, customer?.phone, car?.plate);
        }).slice(0, 7)) {
          rows.push(['طلب غسيل', esc(orderRef(row)), esc(find(state.customers, row.customerId)?.name), button('فتح', 'order-view', { key: row.id })]);
        }
        if (ctx.can('inventory')) for (const row of state.materials.filter(row => matches(query, row.name, row.category)).slice(0, 7)) {
          rows.push(['مادة', esc(row.name), esc(row.category), button('فتح', 'material-view', { key: row.id })]);
        }
        results.innerHTML = table(['النوع','النتيجة','البيانات',''], rows, 'لم يُعثر على نتائج مطابقة.');
      };
      input.addEventListener('input', searchRecords);
      searchRecords();
    } });
}
const common = {
  go: (_, key) => go(key),
  profile: settingsActions.profile,
  'global-search': search,
  'modal-close': () => { const back = dialogBack; if (back) back(); else closeModal(); },
  'sidebar-toggle': () => {
    if (narrow.matches) setDrawer(!drawer);
    else {
      document.body.classList.toggle('collapsed');
      setDrawer(false);
    }
    if (drawer) sidebar.querySelector('.nav-link.active')?.focus();
  },
  'remove-row': (_, __, target) => {
    const row = target.closest('.repeat-row');
    row.classList.add('row-out');
    setTimeout(() => row.remove(), 130);
  }
};
const dashboardPermission = { notifications: 'inventory', 'chart-range': 'dashboard', 'chart-mode': 'dashboard' };
const registry = Object.fromEntries(Object.entries(pages).flatMap(([name, entry]) =>
  Object.entries(entry.actions || {}).map(([action, handler]) => [action, [name, handler]])));
for (const [action, handler] of Object.entries(dashboardActions)) registry[action] = [dashboardPermission[action], handler];
for (const [action, handler] of Object.entries(settingsActions)) if (action !== 'profile') registry[action] = ['settings', handler];

async function dispatch(action, key, target) {
  try {
    if (dialog.open && dialogActions[action]) return await dialogActions[action](key, target);
    if (common[action]) return await common[action](ctx, key, target);
    const record = registry[action];
    if (record && ctx.can(record[0])) return await record[1](ctx, key, target);
    if (record) notify('هذه العملية غير متاحة للدور الحالي.', 'error');
  } catch (error) { notify(error.message || 'تعذر تنفيذ العملية.', 'error'); }
}
document.addEventListener('click', event => {
  const target = event.target.closest('[data-action]');
  if (target) dispatch(target.dataset.action, target.dataset.key, target);
  if (event.target.closest('.nav-link, .brand')) setDrawer(false);
});
dialog.addEventListener('cancel', event => { event.preventDefault(); dispatch('modal-close'); });
backdrop.addEventListener('click', () => setDrawer(false));
narrow.addEventListener('change', () => setDrawer(false));
window.addEventListener('resize', () => updateSidebarHandle());
content.addEventListener('input', event => {
  const input = event.target;
  if (input.dataset.filter && input.type === 'search') ctx.setFilter(input.dataset.filter, input.value);
});
content.addEventListener('change', event => {
  const input = event.target;
  if (input.dataset.filter && input.type !== 'search' && (input.dataset.filter !== 'kind' || input.value)) ctx.setFilter(input.dataset.filter, input.value);
});
document.addEventListener('keydown', event => {
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
    event.preventDefault();
    if (!dialog.open) search();
  } else if (event.key === 'Escape' && drawer) setDrawer(false);
});
window.addEventListener('hashchange', () => go(currentRoute(), { focus: true }));
onStorage(next => {
  state = next;
  if (ctx.can(page)) render();
  else go(access[state.settings.role][0]);
});
try {
  state = load();
  go(currentRoute());
} catch (error) {
  content.setAttribute('aria-busy', 'false');
  content.innerHTML = empty('تعذر تحميل بيانات المغسلة. تحقق من توفر التخزين المحلي ثم أعد تحميل الصفحة.');
  console.error(error);
}

