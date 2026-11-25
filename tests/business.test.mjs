import assert from 'node:assert/strict';
import { test } from 'node:test';
import { cashBalance, lowStock, purchase, salary } from '../js/ledger.js';
import { seed } from '../js/mock-data.js';
import { cancelOrder, completeOrder, createOrder, payOrder, refundOrder } from '../js/order-logic.js';
import { load, update } from '../js/storage.js';
import { amount, convert, methods, phone, statuses } from '../js/utils.js';

function wash(data, quantity) {
  const car = data.cars[0];
  return createOrder(data, {
    customerId: car.customerId, carId: car.id, employeeId: data.employees[0].id,
    services: [{ id: data.services[0].id, price: 120 }],
    materials: [{ materialId: data.materials[0].id, quantity, unit: 'مللي لتر' }],
    discount: 20, method: methods[0],
  });
}

test('accepts Arabic phone numbers and grouped monetary amounts', () => {
  assert.equal(phone('+٢٠ ١٠٠٠٠٠٩٠٠١'), '01000009001');
  assert.equal(amount('٢٬٥٠٠٫٥٠'), 2500.5);
  assert.equal(amount('۱۲,۵'), 12.5);
  assert.throws(() => amount('٢٬٥٠'));
  assert.throws(() => amount('0x10'));
  assert.throws(() => phone('123'));
  assert.equal(convert(250, 'مللي لتر', 'لتر'), .25);
  assert.throws(() => convert(1, 'لتر', 'قطعة'));
});

test('rejects insufficient stock without updating the order or ledger', () => {
  const data = seed();
  const material = data.materials[0];
  material.quantity = 10;
  const order = wash(data, 10250);
  const balance = cashBalance(data);
  const previousMovements = data.movements.length;
  assert.throws(() => completeOrder(data, order, { amount: 40 }), /المخزون غير كافٍ/);
  assert.equal(material.quantity, 10);
  assert.equal(order.status, statuses[0]);
  assert.equal(data.movements.length, previousMovements);
  assert.equal(cashBalance(data), balance);
});

test('completes only once, splits payments, and reverses the wash on cancellation', () => {
  const data = seed();
  const material = data.materials[0];
  material.quantity = 10;
  const balance = cashBalance(data);
  const order = wash(data, 250);
  completeOrder(data, order, { amount: 40 });
  assert.equal(material.quantity, 9.75);
  assert.throws(() => completeOrder(data, order, { amount: 40 }));
  payOrder(data, order, 60, methods[2]);
  assert.equal(order.paid, 100);
  assert.equal(cashBalance(data), balance + 40);
  assert.throws(() => payOrder(data, order, 1, methods[2]));
  assert.throws(() => refundOrder(data, order, 41, methods[0]));
  refundOrder(data, order, 10, methods[0]);
  assert.equal(cashBalance(data), balance + 30);
  cancelOrder(data, order, 'إلغاء تجريبي', true);
  assert.equal(material.quantity, 10);
  assert.equal(order.paid, 0);
  assert.equal(order.status, statuses[4]);
  assert.equal(cashBalance(data), balance);
  assert.throws(() => cancelOrder(data, order, 'إلغاء مكرر', true));
});

test('purchases update stock and payroll posts the net amount to the cash ledger', () => {
  const data = seed();
  const material = data.materials[0];
  material.quantity = 10;
  material.minimum = 10;
  assert(lowStock(data).includes(material));
  const balance = cashBalance(data);
  const receipt = purchase(data, { materialId: material.id, unit: 'مللي لتر', quantity: 500, total: 25, method: methods[0] });
  assert.equal(material.quantity, 10.5);
  assert(!lowStock(data).includes(material));
  assert.equal(data.transactions[0].reference, receipt.id);
  const payroll = salary(data, { employeeId: data.employees[0].id, base: 300, bonus: 20, deduction: 10, method: methods[0] });
  assert.equal(payroll.total, 310);
  assert.equal(data.transactions[0].reference, payroll.id);
  assert.equal(cashBalance(data), balance - 335);
});

test('a failed write preserves stored records and concurrent edits are serialized', async t => {
  const records = new Map();
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: { getItem: key => records.get(key), setItem: (key, value) => records.set(key, value) },
  });
  t.after(() => {
    if (descriptor) Object.defineProperty(globalThis, 'localStorage', descriptor);
    else delete globalThis.localStorage;
  });
  const original = load().settings.opening;
  await assert.rejects(update(data => { data.settings.opening = 0; throw new Error('rollback'); }), /rollback/);
  assert.equal(load().settings.opening, original);
  await Promise.all([
    update(data => { data.settings.opening += 10; }),
    update(data => { data.settings.opening += 20; }),
  ]);
  assert.equal(load().settings.opening, original + 30);
});
