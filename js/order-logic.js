import { id, statuses, methods, now, round, stockRound, sum, find, convert, required, orderRef } from './utils.js';
import { movement, transaction } from './ledger.js';

export function createOrder(data, input) {
  required(find(data.customers, input.customerId) && find(data.cars, input.carId)?.customerId === input.customerId,
    'اختر عميلاً وسيارة مسجلة له.');
  required(find(data.employees, input.employeeId)?.active, 'اختر موظفاً نشطاً.');
  required(input.services.length && input.services.every(service => find(data.services, service.id)?.active), 'اختر خدمة غسيل نشطة.');
  required(methods.includes(input.method), 'اختر طريقة الدفع.');
  const subtotal = round(sum(input.services, service => service.price));
  required(input.discount >= 0 && input.discount <= subtotal, 'يجب ألا يتجاوز الخصم إجمالي الخدمات.');
  const row = { id: id('ORD'), number: data.nextOrder++, date: now(), ...input, subtotal,
    total: round(subtotal - input.discount), paid: 0, status: statuses[0] };
  data.orders.unshift(row);
  return row;
}

export function payOrder(data, order, amount, method, date = now()) {
  const value = round(amount);
  required(order?.status === statuses[3], 'استكمل الطلب قبل تسجيل الدفع.');
  required(value > 0 && value <= round(order.total - order.paid), 'أدخل مبلغاً أكبر من صفر ولا يتجاوز المتبقي.');
  transaction(data, { type: 'غسيل', direction: 1, amount: value, method, reference: order.id,
    description: 'دفعة طلب ' + orderRef(order), date });
  order.paid = round(order.paid + value);
  order.method = method;
}

export function completeOrder(data, order, { amount = 0, method = order?.method, date = now() } = {}) {
  required(order && statuses.slice(0, 3).includes(order.status), 'حالة الطلب لا تسمح بالإكمال.');
  required(amount >= 0 && round(amount) <= order.total && methods.includes(method), 'راجع المبلغ المدفوع وطريقة الدفع.');
  const deductions = new Map();
  for (const row of order.materials) {
    const material = find(data.materials, row.materialId);
    required(material && Number.isFinite(row.quantity) && row.quantity > 0, 'راجع المواد والكميات المستهلكة.');
    const quantity = convert(row.quantity, row.unit, material.unit);
    deductions.set(material, (deductions.get(material) ?? 0) + quantity);
  }
  for (const [material, quantity] of deductions) {
    required(stockRound(quantity) <= material.quantity, 'المخزون غير كافٍ لإكمال الطلب: ' + material.name);
    required(stockRound(quantity) > 0, 'الكمية أقل من دقة المخزون: ' + material.name);
  }
  for (const [material, quantity] of deductions) {
    movement(data, material, { type: 'استهلاك', quantity: -stockRound(quantity), reference: order.id,
      employeeId: order.employeeId, description: 'استهلاك طلب ' + orderRef(order), date });
  }
  order.status = statuses[3];
  order.completed = date;
  order.method = method;
  if (round(amount) > 0) payOrder(data, order, amount, method, date);
}

export function refundOrder(data, order, amount, method, date = now()) {
  const value = round(amount);
  required(order?.status === statuses[3] && value > 0, 'أدخل مبلغ استرداد لطلب مكتمل.');
  const available = round(sum(data.transactions.filter(row => row.reference === order.id && row.method === method),
    row => row.amount * row.direction));
  required(value <= available, 'المبلغ يتجاوز صافي المبالغ المستلمة بهذه الطريقة.');
  transaction(data, { type: 'استرداد', direction: -1, amount: value, method, reference: order.id,
    description: 'استرداد طلب ' + orderRef(order), date });
  order.paid = round(order.paid - value);
}

export function cancelOrder(data, order, reason, restore = false) {
  required(order && order.status !== statuses[4] && reason.trim(), 'أدخل سبب إلغاء الطلب.');
  const date = now();
  if (order.status === statuses[3]) {
    for (const method of methods) {
      const net = round(sum(data.transactions.filter(row => row.reference === order.id && row.method === method),
        row => row.amount * row.direction));
      if (net > 0) refundOrder(data, order, net, method, date);
    }
    if (restore) {
      for (const row of data.movements.filter(row => row.reference === order.id && row.type === 'استهلاك')) {
        movement(data, find(data.materials, row.materialId), { type: 'إرجاع استهلاك', quantity: -row.quantity,
          reference: order.id, employeeId: order.employeeId, cost: row.cost, description: reason, date });
      }
    }
  }
  order.cancelled = date;
  order.cancelReason = reason;
  order.status = statuses[4];
}

