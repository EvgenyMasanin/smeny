import { pad, dayKey, daysInMonth, monthCount, rateFor, fill22, isBackup } from './calc.js';

const STORE = 'smeny-v1';
const MONTHS = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'];
const WEEK = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
const LABEL = ['', '1', '2', '1+2'];
const SPOKEN = ['нет смены', '1-я смена', '2-я смена', 'обе смены'];
const COLOR = ['#f1f5f9', '#2563eb', '#c2410c', '#7c3aed'];
const DEFAULTS = {
  s1: { start: '09:00', end: '14:00' },
  s2: { start: '14:30', end: '20:00' },
  salary: 0,
  levels: [{ from: 2, rate: 0.25 }, { from: 5, rate: 0.5 }, { from: 10, rate: 1 }, { from: 15, rate: 1.5 }],
};

const $ = s => document.querySelector(s);
const el = (tag, cls = '', text = '') => Object.assign(document.createElement(tag), { className: cls, textContent: text });
const num = n => n.toLocaleString('ru-RU');
const time = t => t.replace(/^0/, '');
const span = s => `${time(s.start)}–${time(s.end)}`;
const plural = (n, one, few, many) => {
  const a = n % 10, b = n % 100;
  return a === 1 && b !== 11 ? one : a >= 2 && a <= 4 && (b < 12 || b > 14) ? few : many;
};

let state;
try { state = JSON.parse(localStorage.getItem(STORE)); } catch {}
const firstRun = !state;
state ??= { settings: structuredClone(DEFAULTS), days: {}, fill: null };

function save() {
  try { localStorage.setItem(STORE, JSON.stringify(state)); }
  catch { alert('Не удалось сохранить данные на телефоне. Сохраните резервную копию в настройках.'); }
}

const today = new Date();
const todayKey = dayKey(today.getFullYear(), today.getMonth(), today.getDate());
let y = today.getFullYear(), m = today.getMonth();
const dayName = new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'long' });

// ---------- Календарь ----------

function render() {
  $('#title').textContent = `${MONTHS[m]} ${y}`;
  const grid = $('#grid');
  grid.replaceChildren(...WEEK.map(w => el('div', 'wd', w)));
  const offset = (new Date(y, m, 1).getDay() + 6) % 7; // неделя с понедельника
  for (let i = 0; i < offset; i++) grid.append(el('div'));
  for (let d = 1; d <= daysInMonth(y, m); d++) {
    const k = dayKey(y, m, d), mask = state.days[k] || 0;
    const b = el('button', `day s${mask}${k === todayKey ? ' today' : ''}`);
    b.append(el('span', '', d), el('small', '', LABEL[mask]));
    b.ariaLabel = `${dayName.format(new Date(y, m, d))}, ${SPOKEN[mask]}`;
    b.onclick = () => {
      const next = (mask + 1) % 4;
      if (next) state.days[k] = next; else delete state.days[k];
      save(); render();
    };
    grid.append(b);
  }

  const { s1, s2 } = state.settings;
  $('#legend').replaceChildren(...[[1, s1], [2, s2]].map(([i, s]) => {
    const item = el('span', '', `${i}-я смена ${span(s)}`);
    item.prepend(Object.assign(el('span', 'chip', i), { style: `background:${COLOR[i]}` }));
    return item;
  }));

  renderSummary();
}

function renderSummary() {
  const { first, second, total } = monthCount(state.days, y, m);
  const { salary, levels } = state.settings;
  const { rate, next } = rateFor(total, levels);
  const box = $('#summary');
  box.replaceChildren(
    el('div', 'big', `${total} ${plural(total, 'смена', 'смены', 'смен')}`),
    el('div', 'muted', `1-я: ${first} · 2-я: ${second}`),
  );
  const row = (label, value) => { const r = el('div', 'row'); r.append(el('span', '', label), el('b', '', value)); box.append(r); };
  if (levels.length) row('Ставка', rate ? num(rate) : 'не набрана');
  row('Заработок', salary ? `${num(Math.round(salary * rate))} ₽` : 'укажите оклад в настройках');
  if (next) {
    const left = next.from - total;
    box.append(el('p', 'hint', `До ставки ${num(next.rate)} — ещё ${left} ${plural(left, 'смена', 'смены', 'смен')}`));
  }
}

$('#prev').onclick = () => { if (--m < 0) { m = 11; y--; } render(); };
$('#next').onclick = () => { if (++m > 11) { m = 0; y++; } render(); };

// ---------- Заполнить 2/2 ----------

const fillDlg = $('#fillDlg'), fillForm = $('#fillForm');
$('#fillBtn').onclick = () => {
  fillForm.start.value = state.fill?.start ?? dayKey(y, m, 1);
  fillForm.mask.value = state.fill?.mask ?? 1;
  $('#fillNote').textContent = `Отметки за ${MONTHS[m].toLowerCase()} начиная с этой даты заменятся графиком. Для следующего месяца нажмите «Заполнить» ещё раз с той же датой — график продолжится.`;
  fillDlg.returnValue = '';
  fillDlg.showModal();
};
fillDlg.onclose = () => {
  if (fillDlg.returnValue !== 'ok') return;
  const start = fillForm.start.value, mask = Number(fillForm.mask.value);
  if (start > dayKey(y, m, daysInMonth(y, m))) return alert('Дата начала позже этого месяца — заполнять нечего.');
  fill22(state.days, y, m, start, mask);
  state.fill = { start, mask };
  save(); render();
};

// ---------- Настройки ----------

const setDlg = $('#settingsDlg'), setForm = $('#settingsForm');

function levelRow(l = {}) {
  const row = el('div', 'level');
  const from = Object.assign(el('input'), { type: 'number', min: 1, step: 1, inputMode: 'numeric', required: true, value: l.from ?? '', name: 'from', ariaLabel: 'Число смен' });
  const rate = Object.assign(el('input'), { inputMode: 'decimal', pattern: '\\d+([.,]\\d+)?', required: true, value: l.rate == null ? '' : String(l.rate).replace('.', ','), name: 'rate', ariaLabel: 'Ставка' });
  const del = Object.assign(el('button', '', '×'), { type: 'button', ariaLabel: 'Удалить порог', onclick: () => row.remove() });
  row.append('от', from, 'смен →', rate, del);
  return row;
}

function fillSettingsForm() {
  const s = state.settings;
  setForm.s1start.value = s.s1.start; setForm.s1end.value = s.s1.end;
  setForm.s2start.value = s.s2.start; setForm.s2end.value = s.s2.end;
  setForm.salary.value = s.salary || '';
  $('#levels').replaceChildren(...s.levels.map(levelRow));
}

function openSettings() {
  fillSettingsForm();
  setDlg.returnValue = '';
  setDlg.showModal();
}

$('#settingsBtn').onclick = openSettings;
$('#addLevel').onclick = () => $('#levels').append(levelRow());

setDlg.onclose = () => {
  if (setDlg.returnValue !== 'save') return;
  state.settings = {
    s1: { start: setForm.s1start.value, end: setForm.s1end.value },
    s2: { start: setForm.s2start.value, end: setForm.s2end.value },
    salary: Number(setForm.salary.value.replace(/\s/g, '')) || 0,
    levels: [...$('#levels').children].map(r => ({
      from: Number(r.querySelector('[name=from]').value),
      rate: Number(r.querySelector('[name=rate]').value.replace(',', '.')),
    })),
  };
  save(); render();
};

// ---------- Файлы: картинка и резервная копия ----------

// File собирается синхронно: iOS разрешает share() только сразу после нажатия
function shareFile(file) {
  if (navigator.canShare?.({ files: [file] })) return navigator.share({ files: [file] }).catch(() => {});
  const a = Object.assign(el('a'), { href: URL.createObjectURL(file), download: file.name });
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

$('#exportBtn').onclick = () =>
  shareFile(new File([JSON.stringify(state)], `smeny-${todayKey}.json`, { type: 'application/json' }));

$('#importFile').onchange = async e => {
  const file = e.target.files[0];
  e.target.value = '';
  if (!file) return;
  let data;
  try { data = JSON.parse(await file.text()); } catch {}
  if (!isBackup(data)) return alert('Это не файл резервной копии календаря смен.');
  if (!confirm('Заменить все текущие данные данными из файла?')) return;
  state = data;
  save(); fillSettingsForm(); render();
};

const FONT = '-apple-system, system-ui, sans-serif';

function drawMonth() {
  const W = 1080, P = 56, C = (W - 2 * P) / 7;
  const offset = (new Date(y, m, 1).getDay() + 6) % 7, dim = daysInMonth(y, m);
  const top = P + 150, rows = Math.ceil((offset + dim) / 7);
  const H = top + rows * C + 230;
  const cv = Object.assign(document.createElement('canvas'), { width: W, height: H });
  const g = cv.getContext('2d');
  g.fillStyle = '#fff'; g.fillRect(0, 0, W, H);
  g.textBaseline = 'middle';

  g.fillStyle = '#0f172a'; g.font = `700 64px ${FONT}`;
  g.fillText(`${MONTHS[m]} ${y}`, P, P + 36);

  g.textAlign = 'center'; g.fillStyle = '#64748b'; g.font = `600 32px ${FONT}`;
  WEEK.forEach((w, i) => g.fillText(w, P + C * i + C / 2, top - 36));

  for (let d = 1; d <= dim; d++) {
    const i = offset + d - 1, x = P + (i % 7) * C, yy = top + Math.floor(i / 7) * C;
    const mask = state.days[dayKey(y, m, d)] || 0;
    g.fillStyle = COLOR[mask];
    g.beginPath(); g.roundRect(x + 6, yy + 6, C - 12, C - 12, 20); g.fill();
    g.fillStyle = mask ? '#fff' : '#334155';
    g.font = `600 40px ${FONT}`; g.fillText(d, x + C / 2, yy + C * 0.36);
    if (mask) { g.font = `800 30px ${FONT}`; g.fillText(LABEL[mask], x + C / 2, yy + C * 0.7); }
  }

  const { s1, s2 } = state.settings;
  let ly = top + rows * C + 50;
  g.textAlign = 'left'; g.font = `500 34px ${FONT}`;
  for (const [i, text] of [[1, `1-я смена ${span(s1)}`], [2, `2-я смена ${span(s2)}`]]) {
    g.fillStyle = COLOR[i]; g.beginPath(); g.roundRect(P, ly - 20, 40, 40, 8); g.fill();
    g.fillStyle = '#0f172a'; g.fillText(text, P + 60, ly);
    ly += 56;
  }
  const { total } = monthCount(state.days, y, m);
  g.font = `700 34px ${FONT}`;
  g.fillText(`${total} ${plural(total, 'смена', 'смены', 'смен')} в месяце`, P, ly + 10);
  return cv;
}

$('#shareBtn').onclick = () => {
  const b64 = drawMonth().toDataURL('image/png').split(',')[1];
  const bytes = Uint8Array.from(atob(b64), c => c.charCodeAt(0));
  shareFile(new File([bytes], `grafik-${y}-${pad(m + 1)}.png`, { type: 'image/png' }));
};

// ---------- Старт ----------

render();
if (firstRun) { $('#firstHint').hidden = false; openSettings(); }
navigator.storage?.persist?.(); // просим iOS не вычищать данные при нехватке места
if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js');
