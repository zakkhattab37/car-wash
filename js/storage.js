import { seed } from './mock-data.js';
const key = 'bashmohandes-wash-v1';

export function load() {
  const saved = localStorage.getItem(key);
  if (saved) return JSON.parse(saved);
  const initial = seed();
  save(initial);
  return initial;
}

export function save(data) {
  localStorage.setItem(key, JSON.stringify(data));
}

export async function update(action) {
  const commit = () => {
    const current = load();
    const next = action(current) ?? current;
    save(next);
    return next;
  };
  if (!navigator.locks?.request) return commit();
  const result = await navigator.locks.request(key, () => {
    try {
      return { data: commit() };
    } catch (error) {
      return { error };
    }
  });
  if ('error' in result) throw result.error;
  return result.data;
}

export function onStorage(callback) {
  window.addEventListener('storage', event => {
    if (event.key === key) callback(load());
  });
}

