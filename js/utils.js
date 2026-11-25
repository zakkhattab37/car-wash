export const statuses = ['في الانتظار', 'جاري الغسيل', 'جاهزة للاستلام', 'مكتملة', 'ملغاة'];
export const methods = ['نقدي', 'بطاقة بنكية', 'إنستا باي', 'محفظة إلكترونية'];
export const categories = ['صغيرة', 'سيدان', 'دفع رباعي', 'فان'];
export const units = ['لتر', 'مللي لتر', 'كيلو جرام', 'جرام', 'قطعة'];
export const roles = ['مدير النظام', 'الكاشير', 'مسؤول المخزون'];
export const operator = 'أحمد منصور';
const nf = new Intl.NumberFormat('ar-EG', { maximumFractionDigits: 2 });
export const num = value => nf.format(Number(value) || 0);
export const qty = value => new Intl.NumberFormat('ar-EG', { maximumFractionDigits: 6 }).format(value);
export const money = (value, currency = 'ج.م') => num(value) + ' ' + currency;
export const egDate = (date = new Date(), options = {}) => new Intl.DateTimeFormat('ar-EG', {
  timeZone: 'Africa/Cairo', ...options
}).format(new Date(date));
export const day = (date = new Date()) => new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Africa/Cairo', year: 'numeric', month: '2-digit', day: '2-digit'
}).format(new Date(date));
export function daysAgo(days) {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() - days);
  return day(date);
}
export const time = (date = new Date()) => egDate(date, { hour: 'numeric', minute: '2-digit' });
export const dateLabel = date => date ? egDate(date, { day: 'numeric', month: 'short', year: 'numeric' }) : '—';
export const now = () => new Date().toISOString();
export const id = prefix => prefix + '-' + crypto.randomUUID();
export const round = value => Math.round((value + Number.EPSILON) * 100) / 100;
export const stockRound = value => Math.round(value * 1000000) / 1000000;
export const sum = (items, mapper = x => x) => items.reduce((total, item) => total + mapper(item), 0);
export const find = (items, key) => items.find(item => item.id === key);
export const required = (condition, message) => { if (!condition) throw new Error(message); };
export const esc = (value = '') => String(value ?? '').replace(/[&<>"']/g, char => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
})[char]);
export const digits = value => String(value ?? '').replace(/[٠-٩۰-۹]/g, char => String(char.charCodeAt(0) % 16));
export const normalize = value => digits(value).toLowerCase().normalize('NFKD')
  .replace(/[\u064B-\u065F\u0670\u0640]/g, '').replace(/[أإآٱ]/g, 'ا').replace(/ى/g, 'ي').trim();
export const matches = (query, ...values) => normalize(query).split(/\s+/).every(term =>
  values.some(value => normalize(value).includes(term)));
export function phone(value, optional = false) {
  const clean = digits(value).replace(/[\s()-]/g, '').replace(/^(?:\+20|0020)/, '0');
  required((optional && !clean) || /^(010|011|012|015)\d{8}$/.test(clean), 'أدخل رقم محمول مصري صحيحاً من ١١ رقماً.');
  return clean;
}
export function parseAmount(value) {
  const text = digits(value).replace(/[\u061C\u200E\u200F]/g, '').trim().replace(/[٫,]/g, '.');
  if (!/^[+-]?(?:(?:\d+|\d{1,3}(?:٬\d{3})+)(?:\.\d*)?|\.\d+)$/.test(text)) return NaN;
  return Number(text.replaceAll('٬', ''));
}
export function amount(value, min = 0, label = 'القيمة') {
  const number = parseAmount(value);
  required(Number.isFinite(number) && number >= min, 'أدخل ' + label + ' صحيحة.');
  return number;
}
export function label(value, name) {
  const clean = String(value ?? '').trim();
  required(clean, 'أدخل ' + name + '.');
  return clean;
}
const unitGroups = { 'لتر': ['volume', 1000], 'مللي لتر': ['volume', 1], 'كيلو جرام': ['mass', 1000], 'جرام': ['mass', 1], 'قطعة': ['count', 1] };
export const compatible = unit => units.filter(other => unitGroups[other]?.[0] === unitGroups[unit]?.[0]);
export function convert(value, from, to) {
  required(unitGroups[from] && unitGroups[from][0] === unitGroups[to]?.[0], 'وحدة القياس لا تتوافق مع وحدة المادة.');
  return value * unitGroups[from][1] / unitGroups[to][1];
}
export const between = (value, from, to) => !!value && (!from || value >= from) && (!to || value <= to);
export const orderRef = order => '#' + num(order.number);
export const paymentStatus = order => order.paid >= order.total ? 'مدفوع' : order.paid > 0 ? 'مدفوع جزئياً' : 'غير مدفوع';
export const servicePrice = (service, category) => service.variants?.[category]?.price ?? service.price;
export const serviceMaterials = (service, category) => service.variants?.[category]?.materials ?? service.materials;

