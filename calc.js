// Логика без DOM — проверяется в calc.test.mjs
export const pad = n => String(n).padStart(2, '0');
export const dayKey = (y, m, d) => `${y}-${pad(m + 1)}-${pad(d)}`; // m: 0–11
export const daysInMonth = (y, m) => new Date(y, m + 1, 0).getDate();

// Отметка дня — битовая маска: 1 = 1-я смена, 2 = 2-я, 3 = обе
export function monthCount(days, y, m) {
  const prefix = `${y}-${pad(m + 1)}-`;
  let first = 0, second = 0;
  for (const [k, mask] of Object.entries(days)) {
    if (!k.startsWith(prefix)) continue;
    if (mask & 1) first++;
    if (mask & 2) second++;
  }
  return { first, second, total: first + second };
}

// Ставка — по наибольшему набранному порогу; next — следующий порог, если есть
export function rateFor(count, levels) {
  let rate = 0, next = null;
  for (const l of [...levels].sort((a, b) => a.from - b.from)) {
    if (count >= l.from) rate = l.rate;
    else { next = l; break; }
  }
  return { rate, next };
}

const DAY = 86400000;
const utc = iso => { const [y, m, d] = iso.split('-').map(Number); return Date.UTC(y, m - 1, d); };

// 2/2 от startISO (первый из двух рабочих дней). Меняет только дни месяца y/m начиная с startISO,
// поэтому следующий месяц с той же датой начала продолжает график без сбоя.
export function fill22(days, y, m, startISO, mask) {
  const start = utc(startISO);
  for (let d = 1; d <= daysInMonth(y, m); d++) {
    const diff = (Date.UTC(y, m, d) - start) / DAY;
    if (diff < 0) continue;
    const k = dayKey(y, m, d);
    if (diff % 4 < 2) days[k] = mask; else delete days[k];
  }
  return days;
}

// Белый или тёмный текст — что контрастнее на этой заливке (формула WCAG)
const lum = hex => {
  const [r, g, b] = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map(v => v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const DARK = '#0f172a';
export const textOn = hex => 1.05 / (lum(hex) + 0.05) >= (lum(hex) + 0.05) / (lum(DARK) + 0.05) ? '#ffffff' : DARK;

// Проверка файла резервной копии перед импортом. colors и theme — необязательны (старые копии без них).
const TIME = /^\d\d:\d\d$/;
const HEX = /^#[0-9a-f]{6}$/i;
export function isBackup(d) {
  const s = d?.settings;
  return !!s && [s.s1, s.s2].every(x => TIME.test(x?.start) && TIME.test(x?.end))
    && (s.colors === undefined || ['s1', 's2', 's3'].every(k => HEX.test(s.colors?.[k])))
    && (s.theme === undefined || ['auto', 'light', 'dark'].includes(s.theme))
    && Number.isFinite(s.salary)
    && Array.isArray(s.levels) && s.levels.every(l => Number.isFinite(l?.from) && Number.isFinite(l?.rate))
    && !!d.days && typeof d.days === 'object'
    && Object.entries(d.days).every(([k, v]) => /^\d{4}-\d\d-\d\d$/.test(k) && [1, 2, 3].includes(v));
}
