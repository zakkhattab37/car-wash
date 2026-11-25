import { roles, esc, phone, label, amount, required } from './utils.js';
import { seed } from './mock-data.js';
import { heading, button, panel, formGrid, field, numeric, notes, facts, values } from './ui.js';

const permissions = [
  ['مدير النظام','الوصول إلى جميع وحدات النظام.'],
  ['الكاشير','العملاء والسيارات، تسجيل الغسيل، تحصيل الدفعات، وطباعة الإيصالات.'],
  ['مسؤول المخزون','المواد والمشتريات وحركات المخزون والتسويات.']
];
export function settings(ctx) {
  const data = ctx.data, s = data.settings;
  return heading('الإعدادات', 'خصّص بيانات المغسلة والإيصالات وإعدادات التشغيل.') +
    '<div class="stack">' +
    panel('بيانات المغسلة والإيصالات', '<div class="panel-body">' + facts([
      ['اسم المغسلة',s.name],['المحمول',s.phone],['العنوان',s.address],['أوقات العمل',s.hours],
      ['العملة الافتراضية',s.currency],['حد المخزون العام',s.minimum],['الرصيد النقدي الافتتاحي',s.opening],['رسالة الإيصال',s.receipt || '—']
    ]) + (s.logo ? '<img class="settings-logo" alt="شعار المغسلة" src="' + esc(s.logo) + '">' : '') + '</div>',
    button('تعديل الإعدادات', 'settings-edit', { glyph: 'pencil', style: 'primary' })) +
    panel('المستخدمون والصلاحيات', '<div class="panel-body">' + facts(permissions) +
      '<p class="form-note">اختيار الدور يطبّق صلاحيات تجريبية في هذه الواجهة. يمكنك تبديل الدور من قائمة الحساب.</p></div>',
      button('تبديل الدور التجريبي', 'profile', { glyph: 'shield' })) +
    panel('بيانات العرض', '<div class="panel-body"><p class="form-note">تعيد هذه العملية إنشاء سجلات العرض وتحذف التعديلات المخزنة في هذا المتصفح.</p></div>',
      button('إعادة ضبط البيانات', 'settings-reset', { glyph: 'trash', style: 'danger' })) + '</div>';
}
function edit(ctx) {
  const s = ctx.data.settings;
  ctx.modal({ title: 'تعديل بيانات المغسلة', submit: 'حفظ الإعدادات', large: true, body: formGrid(
    field('name','اسم المغسلة',s.name), field('phone','رقم المحمول',s.phone,{ type:'tel' }), field('address','العنوان',s.address),
    field('hours','أوقات العمل',s.hours), field('currency','اختصار العملة',s.currency,{ attrs:'maxlength="12"' }),
    numeric('opening','الرصيد النقدي الافتتاحي',s.opening), numeric('minimum','الحد العام لتنبيه المخزون',s.minimum),
    '<label class="field"><span>شعار المغسلة</span><input type="file" name="logo" accept="image/png,image/jpeg,image/webp"></label>',
    ...(s.logo ? ['<label class="check-option"><input type="checkbox" name="removeLogo"> إزالة الشعار الحالي</label>'] : []),
    notes('receipt','رسالة تذييل الإيصال',s.receipt)
  ), onSubmit: async form => {
    const value = values(form);
    let logo;
    if (value.removeLogo) logo = '';
    if (value.logo?.size) {
      required(['image/png','image/jpeg','image/webp'].includes(value.logo.type) && value.logo.size <= 500000,
        'اختر صورة PNG أو JPG أو WebP بحجم لا يتجاوز ٥٠٠ كيلوبايت.');
      logo = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onerror = () => reject(new Error('تعذرت قراءة ملف الشعار.'));
        reader.onload = () => resolve(reader.result);
        reader.readAsDataURL(value.logo);
      });
    }
    const record = { name: label(value.name,'اسم المغسلة'), phone: phone(value.phone), address: label(value.address,'العنوان'),
      hours: label(value.hours,'أوقات العمل'), currency: label(value.currency,'العملة'), opening: amount(value.opening,0,'الرصيد الافتتاحي'),
      minimum: amount(value.minimum,0,'حد المخزون'), receipt: value.receipt.trim(), ...(logo === undefined ? {} : {logo}) };
    await ctx.mutate(data => { Object.assign(data.settings, record); }, 'تم حفظ الإعدادات.', { close: true });
  } });
}
export const settingsActions = {
  'settings-edit': edit,
  'settings-reset': ctx => ctx.confirm('إعادة ضبط بيانات العرض', 'ستُستبدل سجلات هذا المتصفح ببيانات العرض الأصلية. هل تريد المتابعة؟',
    () => ctx.mutate(() => seed(), 'تمت استعادة بيانات العرض.', { close: true })),
  profile: ctx => ctx.modal({ title: 'حساب التشغيل التجريبي', submit: 'تطبيق الدور',
    body: '<p class="form-note">استخدم الأدوار لاستعراض صلاحيات التشغيل في النسخة التجريبية.</p>' +
      field('role','دور المستخدم',ctx.data.settings.role,{ items: roles.map((role, i) => [i,role]) }) +
      '<div class="form-section">' + facts(permissions) + '</div>',
    onSubmit: async form => {
      const role = Number(values(form).role);
      required(roles[role], 'اختر دوراً صالحاً.');
      await ctx.mutate(data => { data.settings.role = role; }, 'تم تطبيق صلاحيات ' + roles[role] + '.', { close: true });
    } })
};

