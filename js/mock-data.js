import { categories, methods, statuses, daysAgo, day, round, servicePrice, serviceMaterials } from './utils.js';
import { createOrder, completeOrder } from './order-logic.js';
import { purchase, salary, transaction, cashBalance } from './ledger.js';

const first = ['محمد', 'أحمد', 'محمود', 'عمر', 'كريم', 'يوسف', 'مصطفى', 'عبد الرحمن', 'ياسمين', 'نور', 'ندى', 'مريم', 'حسام', 'هاني', 'خالد', 'علي'];
const last = ['منصور', 'حسن', 'سمير', 'عبد الله', 'سعيد', 'عادل', 'إبراهيم', 'فوزي', 'صبري', 'جمال', 'شريف', 'صلاح', 'طارق'];
const carModels = [
  ['هيونداي','إلنترا',1], ['تويوتا','كورولا',1], ['كيا','سبورتاج',2], ['نيسان','صني',1],
  ['مرسيدس','سي ٢٠٠',1], ['بي إم دبليو','إكس ٣',2], ['رينو','لوجان',1], ['شيفروليه','أوبترا',1],
  ['فيات','تيبو',1], ['سوزوكي','سويفت',0], ['أوبل','أسترا',1], ['ميتسوبيشي','إكسباندر',3],
  ['إم جي','زد إس',2], ['سكودا','أوكتافيا',1], ['تويوتا','هايس',3], ['نيسان','جوك',0]
];
const materials = [
  ['شامبو الغسيل','منظفات','لتر',35,55,5], ['ملمع الإطارات','تلميع','لتر',13,95,3],
  ['منظف الزجاج','منظفات','لتر',16,45,3], ['منظف الفرش','منظفات','لتر',15,85,3],
  ['شمع التلميع','تلميع','كيلو جرام',3,220,2], ['منظف المحرك','منظفات','لتر',14,70,3],
  ['مناشف مايكروفايبر','أدوات','قطعة',35,30,8], ['معطر السيارات','معطرات','مللي لتر',2400,0.13,500],
  ['إسفنج الغسيل','أدوات','قطعة',3,18,5], ['قفازات حماية','أدوات','قطعة',10,7,10],
  ['مزيل البقع','منظفات','لتر',9,90,2], ['منظف الجنوط','منظفات','لتر',12,65,4],
  ['فرشاة داخلية','أدوات','قطعة',15,28,5], ['ملمع التابلوه','تلميع','لتر',10,77,2],
  ['مسحوق التنظيف','منظفات','كيلو جرام',8,61,2], ['أكياس مخلفات','أدوات','قطعة',75,2,10],
  ['ملمس المطاط','تلميع','لتر',2,45,3], ['مناديل تلميع','أدوات','قطعة',40,4,10],
  ['منظف الجلد','منظفات','لتر',6,105,2], ['طلاء الحماية','تلميع','لتر',4,320,1]
];
const services = [
  ['غسيل خارجي','غسيل الهيكل الخارجي والجنوط وتجفيف السيارة.',120,25,[[0,180,'مللي لتر']]],
  ['غسيل داخلي','تنظيف المقصورة والزجاج وإزالة الأتربة.',150,35,[[2,90,'مللي لتر'],[7,10,'مللي لتر']]],
  ['غسيل شامل','غسيل خارجي وداخلي مع تلميع الإطارات.',240,55,[[0,250,'مللي لتر'],[1,85,'مللي لتر'],[2,80,'مللي لتر']]],
  ['غسيل الموتور','تنظيف سطح المحرك وإزالة الدهون.',170,35,[[5,160,'مللي لتر']]],
  ['تلميع السيارة','تلميع الهيكل مع طبقة واقية من الشمع.',360,60,[[4,45,'جرام']]],
  ['تنظيف الفرش','تنظيف عميق لمقاعد السيارة والأقمشة.',300,55,[[3,140,'مللي لتر']]],
  ['تنظيف بالبخار','تنظيف الزوايا والمقصورة بالبخار.',280,45,[[3,60,'مللي لتر']]],
  ['تلميع الإطارات','تنظيف وتلميع الإطارات والجنوط.',80,15,[[1,70,'مللي لتر']]]
];
const iso = (offset, hour = 11, minute = 0) => new Date(daysAgo(offset) + 'T' + String(hour).padStart(2, '0') + ':' + String(minute).padStart(2, '0') + ':00Z').toISOString();
const mockPhone = index => '0100000' + String(index).padStart(4, '0');

export function seed() {
  const data = {
    settings: { name: 'مغسلة البشمهندس', phone: mockPhone(0), address: 'مدينة نصر، القاهرة',
      hours: 'يومياً من ٩ صباحاً إلى ١٠ مساءً', currency: 'ج.م', opening: 3500, minimum: 3,
      receipt: 'شكراً لزيارتكم. نتمنى لكم رحلة آمنة!', logo: '', role: 0 },
    nextOrder: 1001, customers: [], cars: [], employees: [], materials: [], services: [], orders: [],
    transactions: [], movements: [], purchases: [], salaries: [], attendance: [], closings: []
  };
  for (let i = 0; i < 32; i++) {
    data.customers.push({ id: 'C-' + (i + 1), name: first[i % first.length] + ' ' + last[i % last.length],
      phone: mockPhone(i + 101), secondary: i % 7 === 0 ? mockPhone(i + 301) : '',
      registered: daysAgo(110 - i * 2), notes: i % 9 === 0 ? 'يفضل الحجز في الفترة الصباحية.' : '' });
  }
  for (let i = 0; i < 48; i++) {
    const [make, model, category] = carModels[i % carModels.length];
    data.cars.push({ id: 'V-' + (i + 1), customerId: data.customers[(i * 7) % 32].id, make, model,
      category: categories[category], color: ['أبيض','أسود','فضي','رمادي','أزرق'][i % 5],
      plate: ['س م ر','ق ن د','ط ل ب','م ر هـ','ب س ع'][i % 5] + ' ' + (1263 + i * 31), notes: '' });
  }
  for (let i = 0; i < 10; i++) {
    const employee = { id: 'E-' + (i + 1), name: first[(i + 2) % first.length] + ' ' + last[(i + 4) % last.length],
      national: '••••••••••' + String(1000 + i * 17), phone: mockPhone(i + 201), address: 'القاهرة',
      job: i === 0 ? 'مشرف تشغيل' : i < 8 ? 'فني غسيل' : 'فني تلميع', hired: daysAgo(290 - i * 12),
      rate: i % 3 ? 4200 + i * 150 : 220, period: i % 3 ? 'شهري' : 'يومي', active: i < 9, notes: '' };
    data.employees.push(employee);
    for (let offset = 0; offset < 14; offset++) {
      if (!employee.active && offset < 4) continue;
      data.attendance.push({ id: 'ATT-' + i + '-' + offset, employeeId: employee.id, date: daysAgo(offset),
        state: (i + offset) % 9 === 0 ? 'غياب' : 'حضور', notes: '' });
    }
  }
  data.materials = materials.map(([name, category, unit, quantity, cost, minimum], i) => ({
    id: 'M-' + (i + 1), name, category, unit, quantity, cost, minimum, purchasePrice: quantity * cost,
    supplier: ['توريدات النيل','المتحدة للمنظفات','المركز المصري للتوريدات'][i % 3], lastPurchase: daysAgo(35)
  }));
  data.services = services.map(([name, description, price, duration, defaults], i) => {
    const materials = defaults.map(([index, quantity, unit]) => ({ materialId: data.materials[index].id, quantity, unit }));
    return { id: 'S-' + (i + 1), name, description, price, duration, materials, active: true,
      variants: { 'دفع رباعي': { price: price + 40, materials: materials.map(row => ({ ...row, quantity: row.quantity * 1.2 })) },
        'فان': { price: price + 60 } } };
  });
  for (let offset = 34; offset >= 0; offset--) {
    if ([30, 23, 16, 9, 4].includes(offset)) {
      const material = data.materials[[0,1,3,5,2][[30,23,16,9,4].indexOf(offset)]];
      purchase(data, { materialId: material.id, unit: material.unit, quantity: 6, total: round(material.cost * 6),
        supplier: material.supplier, method: offset % 2 ? methods[1] : methods[0], date: iso(offset, 7) });
    }
    if ([28, 13].includes(offset)) {
      data.employees.slice(0, 5).forEach(employee => salary(data, { employeeId: employee.id, base: employee.rate,
        bonus: 0, deduction: 0, method: methods[1], date: iso(offset, 8) }));
    }
    if ([28,18,12,6,2,0].includes(offset)) transaction(data, { type: 'مصروفات', direction: -1,
      amount: [185, 280, 350, 540][offset % 4], description: offset % 3 ? 'مصاريف تشغيل وصيانة' : 'مستلزمات تشغيل المغسلة',
      reference: '', method: methods[0], date: iso(offset, 8, 30) });
    const count = offset === 0 ? 16 : [5, 3, 5, 6, 2, 4, 3][offset % 7];
    for (let j = 0; j < count; j++) {
      const n = data.nextOrder - 1001;
      const car = data.cars[(n * 17) % data.cars.length];
      const service = data.services[(n * 3 + j) % 8];
      const method = methods[n % methods.length];
      const date = iso(offset, 7 + Math.floor(j / 2), j % 2 ? 36 : 12);
      const order = createOrder(data, { customerId: car.customerId, carId: car.id,
        employeeId: data.employees[(n + j) % 9].id, services: [{ id: service.id, name: service.name, price: servicePrice(service, car.category) }],
        materials: serviceMaterials(service, car.category), discount: n % 7 === 0 ? 20 : 0, method, date });
      if (offset === 0 && j >= 11) order.status = [statuses[4], statuses[0], statuses[2], statuses[1], statuses[1]][j - 11];
      else if (n % 19 === 0 && offset) { order.status = statuses[4]; order.cancelReason = 'إلغاء الحجز بطلب العميل'; order.cancelled = date; }
      else completeOrder(data, order, { amount: n % 14 === 0 ? 0 : n % 8 === 0 ? round(order.total / 2) : order.total, method, date });
    }
  }
  const closingDay = daysAgo(1);
  const expected = cashBalance(data, closingDay);
  data.closings.push({ id: 'CL-1', date: closingDay, expected, actual: expected, difference: 0, notes: '', user: 'أحمد منصور' });
  return data;
}

