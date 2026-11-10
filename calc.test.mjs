// Запуск: node calc.test.mjs
import assert from 'node:assert/strict';
import { monthCount, rateFor, fill22, isBackup, textOn } from './calc.js';

const levels = [{ from: 10, rate: 1 }, { from: 2, rate: 0.25 }, { from: 15, rate: 1.5 }, { from: 5, rate: 0.5 }];
assert.deepEqual(rateFor(0, levels), { rate: 0, next: { from: 2, rate: 0.25 } });
assert.deepEqual(rateFor(2, levels), { rate: 0.25, next: { from: 5, rate: 0.5 } });
assert.deepEqual(rateFor(12, levels), { rate: 1, next: { from: 15, rate: 1.5 } });
assert.deepEqual(rateFor(20, levels), { rate: 1.5, next: null });
assert.deepEqual(rateFor(3, []), { rate: 0, next: null });

// 2/2 с 1 ноября 2026: 1–2 работа, 3–4 выходные, … 30 ноября — работа (16 дней)
const days = { '2026-10-31': 2 };
fill22(days, 2026, 10, '2026-11-01', 1);
assert.equal(days['2026-11-01'], 1);
assert.equal(days['2026-11-02'], 1);
assert.equal(days['2026-11-03'], undefined);
assert.equal(days['2026-11-30'], 1);
assert.equal(days['2026-10-31'], 2, 'другой месяц не трогаем');
assert.deepEqual(monthCount(days, 2026, 10), { first: 16, second: 0, total: 16 });

// декабрь с той же датой начала продолжает цикл: 29–30 ноября работа → 1–2 декабря выходные
fill22(days, 2026, 11, '2026-11-01', 3);
assert.equal(days['2026-12-01'], undefined);
assert.equal(days['2026-12-03'], 3);
assert.equal(days['2026-12-31'], 3);
assert.equal(monthCount(days, 2026, 11).total, 2 * 15, 'обе смены = 2 смены в счёт');

// старт в середине месяца: дни до старта не трогаем, выходные после старта очищаем
const mid = { '2026-11-05': 2, '2026-11-12': 1 };
fill22(mid, 2026, 10, '2026-11-10', 1);
assert.equal(mid['2026-11-05'], 2);
assert.equal(mid['2026-11-12'], undefined);
assert.equal(mid['2026-11-10'], 1);

// переход на летнее/зимнее время не сбивает цикл (UTC)
const dst = {};
fill22(dst, 2026, 2, '2026-03-01', 1);
assert.equal(dst['2026-03-29'], 1);
assert.equal(dst['2026-03-31'], undefined);

const good = { settings: { s1: { start: '09:00', end: '14:00' }, s2: { start: '14:30', end: '20:00' }, salary: 0, levels }, days: { '2026-11-01': 3 } };
assert.ok(isBackup(good));
assert.ok(!isBackup(null));
assert.ok(!isBackup({ ...good, days: { '2026-11-01': 4 } }));
assert.ok(!isBackup({ ...good, settings: { ...good.settings, s1: { start: '<b>', end: '14:00' } } }));
assert.ok(isBackup({ ...good, settings: { ...good.settings, colors: { s1: '#0e7490', s2: '#BE123C', s3: '#6d28d9' }, theme: 'dark' } }));
assert.ok(!isBackup({ ...good, settings: { ...good.settings, colors: { s1: 'red;x:1', s2: '#be123c', s3: '#6d28d9' } } }));
assert.ok(!isBackup({ ...good, settings: { ...good.settings, theme: 'neon' } }));

assert.equal(textOn('#0e7490'), '#ffffff');
assert.equal(textOn('#000000'), '#ffffff');
assert.equal(textOn('#facc15'), '#0f172a');
assert.equal(textOn('#ffffff'), '#0f172a');

console.log('ok');
