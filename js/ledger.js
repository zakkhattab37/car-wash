import { id, day, now, operator, methods, required, round, stockRound, sum, find, convert } from './utils.js';

export function transaction(data, entry) {
  const amount = round(entry.amount);
  required(amount > 0 && methods.includes(entry.method), 'أدخل مبلغاً وطريقة دفع صالحة.');
  const row = { id: id('TX'), date: now(), user: operator, ...entry, amount };
  data.transactions.unshift(row);
  return row;
}

export function movement(data, material, entry) {
  const quantity = stockRound(entry.quantity);
  const balance = stockRound(material.quantity + quantity);
  required(quantity !== 0 && balance >= 0, 'الكمية غير متاحة في المخزون لمادة ' + material.name + '.');
  const row = { id: id('MOV'), date: now(), unit: material.unit, cost: Math.abs(quantity) * material.cost,
    user: operator, ...entry, quantity, materialId: material.id, balance };
  material.quantity = balance;
  data.movements.unshift(row);
  return row;
}

export function purchase(data, entry) {
  const material = find(data.materials, entry.materialId);
  required(material, 'اختر مادة من المخزون.');
  const quantity = stockRound(convert(entry.quantity, entry.unit, material.unit));
  const total = round(entry.total);
  required(quantity > 0 && total > 0 && methods.includes(entry.method), 'أدخل كمية وتكلفة وطريقة دفع صالحة.');
  const row = { id: id('PUR'), ...entry, quantity, total, unit: material.unit, date: entry.date ?? now() };
  const description = 'شراء ' + material.name;
  material.cost = (material.quantity * material.cost + total) / (material.quantity + quantity);
  material.purchasePrice = total;
  material.lastPurchase = day(row.date);
  if (row.supplier) material.supplier = row.supplier;
  movement(data, material, { type: 'شراء', quantity, cost: total, reference: row.id, description, date: row.date });
  transaction(data, { type: 'مشتريات', direction: -1, amount: total, method: row.method, reference: row.id, description, date: row.date });
  data.purchases.unshift(row);
  return row;
}

export function salary(data, entry) {
  const employee = find(data.employees, entry.employeeId);
  const total = round(entry.base + entry.bonus - entry.deduction);
  required(employee && total > 0 && methods.includes(entry.method), 'أدخل بيانات راتب وطريقة دفع صالحة.');
  const row = { id: id('SAL'), ...entry, total, date: entry.date ?? now() };
  transaction(data, { type: 'رواتب', direction: -1, amount: total, method: row.method, reference: row.id,
    description: 'راتب ' + employee.name, date: row.date });
  data.salaries.unshift(row);
  return row;
}

export function netTransactions(data, method, cutoff) {
  return sum(data.transactions.filter(row => (!method || row.method === method) && (!cutoff || day(row.date) <= cutoff)),
    row => row.amount * row.direction);
}
export const cashBalance = (data, cutoff) => round(data.settings.opening + netTransactions(data, methods[0], cutoff));
export const lowStock = data => data.materials.filter(item => item.quantity <= (item.minimum ?? data.settings.minimum));

