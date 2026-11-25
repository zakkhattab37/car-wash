import { amount, compatible, esc, find, required, stockRound } from './utils.js';
import { iconButton, options } from './ui.js';

export function materialRow(materials, row = {}, group = 'actual') {
  const material = find(materials, row.materialId) || materials[0];
  if (!material) return '';
  return '<div class="repeat-row" data-row="' + esc(group) + '"><select aria-label="المادة" data-material>' +
    options(materials.map(item => [item.id, item.name]), material.id) + '</select><input aria-label="الكمية" inputmode="decimal" data-quantity value="' +
    esc(row.quantity ?? '') + '" placeholder="الكمية"><select aria-label="الوحدة" data-unit>' +
    options(compatible(material.unit), row.unit || material.unit) + '</select>' + iconButton('إزالة المادة', 'trash', 'remove-row') + '</div>';
}
export function setRowUnit(input, materials) {
  const row = input.closest('.repeat-row');
  const material = find(materials, input.value);
  if (row && material) row.querySelector('[data-unit]').innerHTML = options(compatible(material.unit), material.unit);
}
export function readMaterials(root, group, strict = true) {
  return [...root.querySelectorAll('[data-row="' + group + '"]:not(.row-out)')].map(element => {
    const value = element.querySelector('[data-quantity]').value;
    const quantity = strict ? stockRound(amount(value, .000001, 'كمية المادة')) : value;
    const materialId = element.querySelector('[data-material]').value, unit = element.querySelector('[data-unit]').value;
    if (strict) required(materialId && unit, 'اختر المادة ووحدة القياس.');
    return { materialId, quantity, unit };
  });
}

