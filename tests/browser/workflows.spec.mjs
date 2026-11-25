import { readFile } from 'node:fs/promises';
import { expect, test } from '@playwright/test';

const action = (scope, name) => scope.locator('[data-action="' + name + '"]');
const dialog = page => page.getByRole('dialog');
const field = (page, name) => dialog(page).locator('[name="' + name + '"]');
const submit = page => dialog(page).locator('button[type="submit"]').click();
const close = page => dialog(page).locator('.modal-head button').click();

async function openPage(page, section) {
  await page.goto('/#' + section);
  await expect(page.locator('nav [aria-current="page"]')).toHaveAttribute('href', '#' + section);
}

test('registers a customer and car, completes a wash, and records split payments and a refund', async ({ page }) => {
  await page.addInitScript(() => {
    window.print = () => { document.querySelector('#print-area').dataset.printRequested = 'true'; };
  });
  await openPage(page, 'dashboard');
  await action(page, 'order-new').click();
  await action(dialog(page), 'draft-new-customer').click();
  await field(page, 'name').fill('عميل الاختبار الآلي');
  await field(page, 'phone').fill('123');
  await submit(page);
  await expect(dialog(page).getByRole('alert')).toContainText('رقم محمول مصري');
  await field(page, 'phone').fill('٠١٠٠٠٠٠٩٠٠٢');
  await submit(page);
  await action(dialog(page), 'draft-new-car').click();
  await field(page, 'make').fill('تويوتا');
  await field(page, 'model').fill('كورولا');
  await field(page, 'category').selectOption({ label: 'سيدان' });
  await field(page, 'color').fill('أبيض');
  await field(page, 'plate').fill('خ ت ر ٩٠٠٢');
  await submit(page);
  await field(page, 'employeeId').selectOption({ index: 1 });
  await dialog(page).getByRole('checkbox', { name: /غسيل خارجي/ }).check();
  await dialog(page).getByRole('textbox', { name: 'الكمية', exact: true }).fill('٢٥٠');
  await field(page, 'discount').fill('٢٠');
  await expect(dialog(page).locator('[data-total]')).toContainText('١٠٠');
  await submit(page);
  await action(dialog(page), 'order-complete').click();
  await field(page, 'amount').fill('٤٠');
  await submit(page);
  await expect(dialog(page).getByText('مدفوع جزئياً', { exact: true })).toBeVisible();
  await action(dialog(page), 'order-pay').click();
  await field(page, 'method').selectOption({ label: 'إنستا باي' });
  await submit(page);
  await expect(dialog(page).getByText('مدفوع', { exact: true })).toBeVisible();
  await action(dialog(page), 'order-refund').click();
  await field(page, 'amount').fill('١٠');
  await submit(page);
  await expect(dialog(page).getByText('مدفوع جزئياً', { exact: true })).toBeVisible();
  await action(dialog(page), 'order-print').click();
  await expect(page.locator('#print-area')).toHaveAttribute('data-print-requested', 'true');
  await expect(page.locator('#print-area')).toContainText('عميل الاختبار الآلي');
  await close(page);
  await page.reload();
  await page.getByRole('searchbox', { name: /ابحث بالعميل/ }).fill('عميل الاختبار الآلي');
  await expect(page.getByRole('row').filter({ hasText: 'عميل الاختبار الآلي' })).toHaveCount(1);
});

test('keeps a deactivated service on an existing order while saving an edit', async ({ page }) => {
  await openPage(page, 'orders');
  await page.getByRole('button', { name: 'الطلبات الحالية', exact: true }).click();
  const row = page.locator('tbody tr').first();
  const service = (await row.locator('td').nth(3).innerText()).trim();
  const ref = (await row.locator('td').first().innerText()).trim();
  await openPage(page, 'services');
  const serviceRow = page.getByRole('row').filter({ has: page.getByRole('button', { name: service, exact: true }) });
  await action(serviceRow, 'service-toggle').click();
  await submit(page);
  await expect(action(serviceRow, 'service-toggle')).toHaveText('تفعيل');
  await openPage(page, 'orders');
  await page.getByRole('button', { name: ref, exact: true }).click();
  await action(dialog(page), 'order-edit').click();
  await expect(dialog(page).getByRole('checkbox', { name: new RegExp(service + '.*متوقفة') })).toBeChecked();
  await field(page, 'notes').fill('تعديل بعد إيقاف الخدمة');
  await submit(page);
  await expect(dialog(page)).toContainText('تعديل بعد إيقاف الخدمة');
});

test('records a purchase, manual revenue, cash closing, and exports a report', async ({ page }) => {
  await openPage(page, 'inventory');
  await action(page, 'purchase-new').click();
  await field(page, 'quantity').fill('١');
  await field(page, 'total').fill('١٢');
  await submit(page);
  await expect(page.getByText('تم تسجيل الشراء وتحديث المخزون والخزينة.', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'المشتريات', exact: true }).click();
  await expect(page.locator('tbody tr').first()).toContainText('١٢ ج.م');
  await openPage(page, 'finance');
  await action(page, 'income-new').click();
  await field(page, 'amount').fill('٢٬٥٠٠٫٥٠');
  await field(page, 'description').fill('إيراد للاختبار الآلي');
  await submit(page);
  await expect(page.getByRole('row').filter({ hasText: 'إيراد للاختبار الآلي' })).toContainText('٢٬٥٠٠٫٥');
  await page.getByRole('button', { name: 'الإغلاق اليومي', exact: true }).click();
  await action(page, 'closing-new').click();
  await field(page, 'actual').fill('٥٠٠٠');
  await submit(page);
  await expect(page.getByText('تم تسجيل الإغلاق اليومي.', { exact: true })).toBeVisible();
  await openPage(page, 'reports');
  await page.locator('[data-filter="kind"]').selectOption({ label: 'الإيرادات والتحصيل' });
  await expect(page.getByText('إيراد للاختبار الآلي', { exact: true })).toBeVisible();
  const downloaded = page.waitForEvent('download');
  await action(page, 'report-csv').click();
  const file = await downloaded;
  expect(file.suggestedFilename()).toMatch(/\.csv$/);
  expect(await readFile(await file.path(), 'utf8')).toContain('إيراد للاختبار الآلي');
});

test('records attendance and payroll and finds records through global search', async ({ page }) => {
  await openPage(page, 'employees');
  await action(page, 'salary-new').click();
  await field(page, 'period').fill('فترة الاختبار الآلي');
  await field(page, 'base').fill('٢٥');
  await submit(page);
  await expect(page.getByText('تم تسجيل الراتب وتحديث الخزينة.', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'الحضور والغياب', exact: true }).click();
  await action(page, 'attendance-new').first().click();
  await field(page, 'state').selectOption({ label: 'حضور' });
  await field(page, 'notes').fill('مراجعة حضور آلية');
  await submit(page);
  await expect(page.getByText('مراجعة حضور آلية', { exact: true })).toBeVisible();
  await action(page, 'global-search').click();
  await dialog(page).getByRole('searchbox').fill('شامبو');
  await expect(dialog(page).getByRole('row').filter({ hasText: 'شامبو' }).first()).toBeVisible();
});

test('creates a stock item, records waste, and configures a service with a vehicle price', async ({ page }) => {
  await openPage(page, 'inventory');
  await action(page, 'material-new').click();
  await field(page, 'name').fill('منظف الاختبار الآلي');
  await field(page, 'category').fill('منظفات');
  await field(page, 'unit').selectOption({ label: 'لتر' });
  await field(page, 'cost').fill('١٠');
  await field(page, 'quantity').fill('٣');
  await field(page, 'minimum').fill('٢');
  await submit(page);
  await page.getByRole('button', { name: 'منظف الاختبار الآلي', exact: true }).click();
  await action(dialog(page), 'stock-adjust').click();
  await field(page, 'kind').selectOption('waste');
  await field(page, 'quantity').fill('١');
  await field(page, 'reason').fill('تسوية الاختبار الآلي');
  await submit(page);
  await page.getByRole('button', { name: 'المواد منخفضة المخزون', exact: true }).click();
  await expect(page.getByRole('row').filter({ hasText: 'منظف الاختبار الآلي' })).toContainText('٢ لتر');

  await openPage(page, 'services');
  await action(page, 'service-new').click();
  await field(page, 'name').fill('غسيل الاختبار الآلي');
  await field(page, 'price').fill('٩٠');
  await field(page, 'duration').fill('٢٠');
  await action(dialog(page), 'service-add-row').filter({ visible: true }).first().click();
  await dialog(page).locator('[data-material]').selectOption({ label: 'منظف الاختبار الآلي' });
  await dialog(page).locator('[data-quantity]').fill('٠٫٥');
  await dialog(page).getByText('سيدان', { exact: true }).click();
  const sedan = dialog(page).locator('details').filter({ hasText: 'سيدان' });
  await sedan.locator('input[name^="price-"]').fill('١١٠');
  await submit(page);
  await page.getByRole('button', { name: 'غسيل الاختبار الآلي', exact: true }).click();
  await expect(dialog(page)).toContainText('منظف الاختبار الآلي');
  await expect(dialog(page)).toContainText('١١٠');
});

test('saves settings, switches demo permissions, and restores the administrator role', async ({ page }) => {
  await openPage(page, 'settings');
  await action(page, 'settings-edit').click();
  await field(page, 'name').fill('مغسلة الاختبار الآلي');
  await submit(page);
  await expect(page.locator('.brand')).toContainText('مغسلة الاختبار الآلي');
  await page.reload();
  await expect(page.locator('.brand')).toContainText('مغسلة الاختبار الآلي');
  await action(page.locator('#topbar'), 'profile').click();
  await field(page, 'role').selectOption({ label: 'مسؤول المخزون' });
  await submit(page);
  await expect(page).toHaveURL(/#inventory$/);
  await expect(page.locator('.side-nav .nav-link')).toHaveCount(1);
  await page.goto('/#finance');
  await expect(page).toHaveURL(/#inventory$/);
  await action(page.locator('#topbar'), 'profile').click();
  await field(page, 'role').selectOption({ label: 'مدير النظام' });
  await submit(page);
  await expect(page.locator('.side-nav .nav-link')).toHaveCount(9);
});

test('operates analytics filters and the responsive sidebar', async ({ page }) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await openPage(page, 'dashboard');
  await expect(page.locator('.recharts-surface')).toHaveCount(2);
  await page.getByRole('button', { name: '٣٠ يوماً', exact: true }).click();
  await expect(page.getByRole('button', { name: '٣٠ يوماً', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: 'الطلبات', exact: true }).click();
  await expect(page.locator('.recharts-bar')).toBeVisible();

  const toggle = action(page, 'sidebar-toggle');
  await toggle.click();
  await expect(toggle).toHaveAttribute('aria-expanded', 'false');
  await page.getByRole('separator').press('End');
  await expect(toggle).toHaveAttribute('aria-expanded', 'true');
  await expect(page.getByRole('separator')).toHaveAttribute('aria-valuenow', '480');

  await page.setViewportSize({ width: 390, height: 844 });
  await expect(toggle).toHaveAttribute('aria-expanded', 'false');
  const handle = page.getByRole('separator');
  await expect.poll(async () => (await handle.boundingBox()).x).toBeGreaterThan(360);
  const edge = await handle.boundingBox();
  const y = edge.y + 100;
  await page.mouse.move(edge.x + 4, y);
  await page.mouse.down();
  await page.mouse.move(edge.x - 220, y, { steps: 8 });
  await page.mouse.up();
  await expect(toggle).toHaveAttribute('aria-expanded', 'true');
  await page.locator('#backdrop').click({ position: { x: 12, y: 120 } });
  await expect(toggle).toHaveAttribute('aria-expanded', 'false');
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  expect(errors).toEqual([]);
});
