document.documentElement.classList.toggle('android-app', navigator.userAgent.includes('BlackjackAndroid'));
import './style.css';
import { t, setLanguage, type LanguageChoice } from './i18n';
import { cardScale, volumePercent } from './preferences';
import { Blackjack, total, type GameState } from './engine';
import { TableScene } from './scene';
import { TableAudio } from './table-audio';
import { TitleMusic } from './title-music';

const read = <T>(key: string, fallback: T): T => { try { return JSON.parse(localStorage.getItem(key) ?? 'null') ?? fallback; } catch { return fallback; } };
const save = (key: string, value: unknown) => { try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* Private browsing can deny storage; the round still works. */ } };
const defaultPreferences = { sound: false, musicVolume: 65, sfxVolume: 65, motion: true, fast: false, scale: 120, crt: true, dialogue: true, language: 'auto' as LanguageChoice, filter: 'green' as 'none' | 'green' | 'sepia', scaleVersion: 2 };
const storedPreferences = read<Partial<typeof defaultPreferences>>('blackjack-settings-v1', {});
const preferences = { ...defaultPreferences, ...storedPreferences };
preferences.musicVolume = volumePercent(preferences.musicVolume);
preferences.sfxVolume = volumePercent(preferences.sfxVolume);
if (storedPreferences.scaleVersion !== 2 && Object.hasOwn(storedPreferences, 'scale')) {
  preferences.scale = Math.min(120, Math.max(85, Math.round((85 + (preferences.scale - 85) * 35 / 15) / 5) * 5));
  preferences.scaleVersion = 2;
}
if (!['none', 'green', 'sepia'].includes(preferences.filter)) preferences.filter = 'green';
if (!preferences.crt && !storedPreferences.filter) preferences.filter = 'none';
if (!['auto', 'ru', 'en'].includes(preferences.language)) preferences.language = 'auto';
preferences.scale = Number.isFinite(preferences.scale) ? Math.max(85, Math.min(120, preferences.scale)) : 120;
setLanguage(preferences.language);
const systemReduced = matchMedia('(prefers-reduced-motion: reduce)');
const savedBank = read<number>('blackjack-bank-v1', 2000);
const initialBank = Number.isFinite(savedBank) && savedBank >= 0 && savedBank <= 1e9 ? Math.floor(savedBank) : 2000;
const history = read<number[]>('blackjack-history-v1', []).filter(n => Number.isFinite(n)).slice(-12);
document.querySelector<HTMLDivElement>('#app')!.innerHTML = `

<main class="shell">
  <section class="table-wrap" aria-label="Игровой стол">
    <div class="board"><button class="icon-button table-menu" id="menu-open" aria-label="Открыть меню" aria-haspopup="dialog"><span aria-hidden="true">☰</span></button><div class="canvas-viewport" role="region" aria-label="Карты на столе" tabindex="0"><div id="canvas" class="canvas-host"></div></div><div class="balance-panel"><div class="small-label">ВАШ БАЛАНС</div><div class="bank"><span id="bank">2 000</span><span class="bank-unit">ФИШЕК</span></div></div><div class="dealer-message" id="dealer-bubble"><div class="small-label">БЛЕКДЖЕК</div><div class="dealer-line" id="dealer-line">«Ну что, проверим твою удачу?»</div></div><div class="status-row"><div class="status" id="status" role="status" aria-live="polite">Загрузка стола…</div><div class="history" id="history" aria-label="Последние результаты"></div><div class="round-count" id="round">РАЗДАЧА 001</div></div><section class="control-panel" aria-label="Ставки и действия"><button class="bet-toggle" id="bet-toggle" aria-label="Настроить ставку" aria-expanded="false" aria-controls="bet-panel"><span class="bet-token" aria-hidden="true"></span><span><small>СТАВКА</small><b id="stake-value">100</b></span><svg class="bet-edit" aria-hidden="true" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="m15 5 4 4M4 20l4-1 12-12a2.8 2.8 0 0 0-4-4L4 15z"/></svg></button><div class="bet-area" id="bet-panel" role="group" aria-label="Настройка ставки" inert><div class="bet-value"><div><div class="small-label">СТАВКА</div><div class="wager" id="wager">100</div></div><div class="bet-adjust"><button class="mini" id="bet-less" aria-label="Уменьшить ставку на 10">−10</button><button class="mini" id="bet-more" aria-label="Увеличить ставку на 10">+10</button></div></div><div class="chips" aria-label="Выбрать ставку">${[10,25,50,100,500].filter(n=>n!==25).map(n=>`<button class="chip" data-bet="${n}" aria-label="Ставка ${n} фишек">${n}</button>`).join('')}</div><button class="mini max-bet" id="bet-max" aria-label="Максимальная ставка">MAX</button></div><div class="actions"><button class="action" id="hit" hidden>Ещё карту <kbd>H</kbd></button><button class="action" id="stand" hidden>Хватит <kbd>S</kbd></button><button class="action secondary" id="double" hidden>Удвоить ×2</button><button class="action secondary" id="split" hidden>Разделить</button><button class="action primary" id="deal">Раздать карты <kbd>↵</kbd></button><button class="action primary" id="refill" hidden>Новые фишки</button></div></section><div class="loader" id="loader"><strong>After Hours</strong><span id="loading-text">ГОТОВИМ СТОЛ</span><div class="loading-bar"><i id="loading-progress"></i></div></div></div>

  </section>
<div id="card-summary" class="sr-only" aria-live="polite"></div>
</main>
<section id="welcome" class="welcome" role="dialog" aria-modal="true" aria-labelledby="welcome-title">
  <div class="welcome-audio-actions"><button id="welcome-settings" class="welcome-audio" aria-haspopup="dialog">Настройки</button><button id="welcome-sound" class="welcome-audio" aria-pressed="false">Звук выкл.</button></div>
  <picture class="welcome-visual"><source media="(min-width:840px)" srcset="${import.meta.env.BASE_URL}title-screen.webp"><img class="welcome-art" src="${import.meta.env.BASE_URL}title-screen-mobile.webp" alt="Блекджек за ночным карточным столом" fetchpriority="high"></picture>
  <div class="welcome-shade"></div>
  <div class="welcome-content">
    <header class="welcome-heading"><span class="welcome-emblem" aria-hidden="true">♠</span><h1 id="welcome-title">BLACKJACK</h1><p class="welcome-subtitle">AFTER HOURS</p><span class="welcome-rule" aria-hidden="true"></span></header>
    <div class="welcome-bottom"><p class="welcome-invite">Ваше место за столом.</p><button id="welcome-start" class="welcome-start" disabled>Готовим стол…</button><p id="welcome-status" class="welcome-status" role="status">Раскладываем карты</p><p class="welcome-note">Только виртуальные фишки</p></div>
  </div>
</section>
<dialog id="menu-dialog" aria-labelledby="menu-title"><button class="close" aria-label="Закрыть">×</button><h2 id="menu-title">За столом</h2><nav class="menu-items" aria-label="Меню игры"><button class="utility" id="sound" aria-pressed="false">Звук выкл.</button><button class="utility" id="settings-open">Настройки</button><button class="utility" id="rules-open">Правила</button><button class="utility" id="reset-open">Новая сессия</button></nav><p>6 колод · блэкджек платит 3:2<br>Игра на виртуальные фишки<br><span id="app-version"></span></p></dialog>
<dialog id="rules-dialog" aria-labelledby="rules-title"><button class="close" aria-label="Закрыть">×</button><h2 id="rules-title">За этим столом</h2><p>Наберите больше дилера, но не больше 21. Туз стоит 1 или 11, картинки — 10.</p><ul><li>Шесть колод. Дилер останавливается на любой 17, включая мягкую.</li><li>Блэкджек на первых двух картах платит 3:2. Обычная победа — 1:1, ничья возвращает ставку.</li><li>Удвоение на двух картах: ставка ×2, затем ровно одна карта.</li><li>Одинаковые ранги можно разделить до трёх рук при достаточном балансе. Тузам после разделения — по одной карте, без повторного разделения.</li><li>21 после разделения считается обычной победой, а не блэкджеком.</li><li>Страховки и сдачи нет. Ставки от 10 до 500 с шагом 10.</li></ul><p>Клавиши: Enter — раздать, H — ещё карту, S — хватит, D — удвоить, P — разделить. Ставки блокируются во время раздачи.</p><p>Баланс сохраняется после завершённой раздачи. При перезагрузке незавершённая раздача отменяется.</p></dialog>
<dialog id="settings-dialog" aria-labelledby="settings-title"><button class="close" aria-label="Закрыть">×</button><h2 id="settings-title">В вашем темпе</h2><label class="setting">Звук<input type="checkbox" id="pref-sound"></label><label class="setting volume-setting"><span>Громкость музыки</span><output id="musicVolume-output" for="pref-musicVolume">65%</output><input type="range" id="pref-musicVolume" min="0" max="100" step="1" value="65" aria-label="Громкость музыки"></label><label class="setting volume-setting"><span>Громкость эффектов (SFX)</span><output id="sfxVolume-output" for="pref-sfxVolume">65%</output><input type="range" id="pref-sfxVolume" min="0" max="100" step="1" value="65" aria-label="Громкость эффектов (SFX)"></label><label class="setting">Анимации<input type="checkbox" id="pref-motion"></label><label class="setting">Цветовой фильтр<select id="pref-filter"><option value="none">Без фильтра</option><option value="green">Зелёный</option><option value="sepia">Сепия</option></select></label><label class="setting">Язык<select id="pref-language"><option value="auto">По региону</option><option value="ru">Русский</option><option value="en">English</option></select></label><label class="setting">Реплики Блекджек<input type="checkbox" id="pref-dialogue"></label><label class="setting">Быстрая раздача<input type="checkbox" id="pref-fast"></label><label class="setting">Размер карт <output id="scale-output">120%</output><input type="range" id="pref-scale" min="85" max="120" step="5" aria-label="Размер карт"></label><p>Системная настройка уменьшения движения учитывается автоматически. Все настройки сохраняются на этом устройстве.</p></dialog>
<dialog id="reset-dialog" aria-labelledby="reset-title"><button class="close" aria-label="Закрыть">×</button><h2 id="reset-title">Начать новую сессию?</h2><p>Баланс станет равен 2 000 фишек, история сессии очистится.</p><div class="dialog-actions"><button class="action" id="reset-cancel">Остаться</button><button class="action primary" id="reset-confirm">Новая сессия</button></div></dialog>`;
document.querySelector('#app-version')!.textContent = `Версия ${__APP_VERSION__}`;
// Capture static copy once so switching languages preserves controls and focus.
const staticCopy: {node: Text; source: string}[] = [];
const walker = document.createTreeWalker(document.querySelector('#app')!, NodeFilter.SHOW_TEXT);
while (walker.nextNode()) {
  const node = walker.currentNode as Text;
  if (/[А-Яа-яЁё]/.test(node.data) && !node.parentElement?.closest('#status,#dealer-line,#round,#history,#welcome-start,#welcome-status,#loading-text')) staticCopy.push({node, source: node.data});
}
const staticAttributes = Array.from(document.querySelectorAll('[aria-label], [alt]')).flatMap(node =>
  ['aria-label', 'alt'].filter(name => node.hasAttribute(name)).map(name => ({node, name, source: node.getAttribute(name)!})));
function translateInterface() {
  setLanguage(preferences.language);
  for (const {node, source} of staticCopy) node.data = t(source);
  for (const {node, name, source} of staticAttributes) node.setAttribute(name, t(source));
}
translateInterface();
for (const id of ['welcome-start', 'welcome-status', 'loading-text']) {
  const node = document.getElementById(id)!;
  node.textContent = t(node.textContent ?? '');
}
const el = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
const button = (id: string) => el<HTMLButtonElement>(id);
const format = (n: number) => n.toLocaleString(document.documentElement.lang === 'ru' ? 'ru-RU' : 'en-US');
const scene = new TableScene(el('canvas'));
let betOpen = false;
let welcomed = false;
const tableShell = document.querySelector<HTMLElement>('.shell')!;
tableShell.inert = true;
let ready = false, lastCompleted = 0;
const tableAudio = new TableAudio();
const titleMusic = new TitleMusic(import.meta.env.BASE_URL);
function sound(kind: 'card' | 'flip' | 'chip' | 'win') {
  tableAudio.play(kind);
}
function unlockAudio() {
  tableAudio.unlock(preferences.sound);
  titleMusic.setEnabled(preferences.sound && !welcomed && !document.hidden);
}
const game = new Blackjack(initialBank, ms => new Promise(r => setTimeout(r, systemReduced.matches || !preferences.motion ? 0 : preferences.fast ? ms * .32 : ms)));
function settings() {
  translateInterface();
  tableAudio.setVolume(preferences.sfxVolume);
  titleMusic.setVolume(preferences.musicVolume);
  for (const key of ['musicVolume', 'sfxVolume'] as const) {
    el<HTMLInputElement>('pref-' + key).value = String(preferences[key]);
    el<HTMLInputElement>('pref-' + key).setAttribute('aria-valuetext', preferences[key] + '%');
    el<HTMLOutputElement>(key + '-output').value = preferences[key] + '%';
  }
  document.documentElement.dataset.filter = preferences.filter;
  el<HTMLSelectElement>('pref-filter').value = preferences.filter;
  el<HTMLSelectElement>('pref-language').value = preferences.language;
  el('dealer-bubble').hidden = !preferences.dialogue;
  scene.reduced = systemReduced.matches || !preferences.motion; scene.cardScale = cardScale(preferences.scale);
  for (const key of ['sound','motion','fast','dialogue'] as const) el<HTMLInputElement>('pref-' + key).checked = preferences[key];
  el<HTMLInputElement>('pref-scale').value = String(preferences.scale); el('scale-output').textContent = preferences.scale + '%';
  button('sound').textContent = t(preferences.sound ? 'Звук вкл.' : 'Звук выкл.'); button('sound').setAttribute('aria-pressed', String(preferences.sound));
  button('welcome-sound').textContent = t(preferences.sound ? 'Звук вкл.' : 'Звук выкл.');
  button('welcome-sound').setAttribute('aria-pressed', String(preferences.sound));
  save('blackjack-settings-v1', preferences); if (ready) scene.render(game.state, true);
}
function summary(s: GameState) {
  const names = ['','туз','двойка','тройка','четвёрка','пятёрка','шестёрка','семёрка','восьмёрка','девятка','десятка','валет','дама','король'];
  const suits = {hearts:'червей', diamonds:'бубен', clubs:'треф', spades:'пик'};
  const cardName = (c: {rank:number;suit:keyof typeof suits}) => `${names[c.rank]} ${suits[c.suit]}`;
  const visible = s.reveal ? s.dealer : s.dealer.slice(0,1);
  return `Дилер: ${visible.map(cardName).join(', ')}${s.dealer.length > 1 && !s.reveal ? ', закрытая карта' : ''}. ${s.hands.map((h,i)=>`Рука ${i+1}: ${h.cards.map(cardName).join(', ')}, ${total(h.cards).value} очков`).join('. ')}`;
}
function render(s: GameState, cue?: 'card'|'flip'|'chip'|'win') {
  if (ready) scene.render(s);
  if (cue) { sound(cue); if (ready) scene.cue(cue); }
  el('bank').textContent = format(s.bank); el('bank').style.setProperty('--bank-digits', String(format(s.bank).length)); el('wager').textContent = format(s.wager); el('stake-value').textContent=format(s.wager);
  const play = s.phase === 'player';
  el('app').dataset.phase = s.phase;
  for (const id of ['hit','stand','double','split']) button(id).hidden = !play;
  for (const id of ['hit','stand']) button(id).disabled = !ready || !game.canAct;
  button('double').disabled = !ready || !game.canDouble; button('split').disabled = !ready || !game.canSplit;
  button('deal').hidden = play; button('deal').disabled = !ready || s.busy || !['betting','result'].includes(s.phase) || s.bank < s.wager;
  button('deal').textContent = t(s.phase === 'result' ? 'Следующая раздача ↵' : s.busy ? 'Сдаём карты…' : 'Раздать карты ↵');
  button('refill').hidden = !(s.bank < 10 && !s.busy && s.phase !== 'player'); if (!button('refill').hidden) button('deal').hidden = true;
  const canBet = ready && !s.busy && ['betting','result'].includes(s.phase);
  if(!canBet) setBetOpen(false);
  button('bet-toggle').disabled=!canBet;
  button('bet-toggle').setAttribute('aria-label',t(`Настроить ставку, ${format(s.wager)} фишек`));
  document.querySelectorAll<HTMLButtonElement>('[data-bet]').forEach(b => { b.disabled = !canBet || Number(b.dataset.bet) > s.bank; b.classList.toggle('selected', Number(b.dataset.bet) === s.wager); b.setAttribute('aria-pressed', String(Number(b.dataset.bet) === s.wager)); });
  for (const id of ['bet-less','bet-more','bet-max']) button(id).disabled = !canBet || s.bank < 10;
  button('reset-open').disabled = s.busy || s.phase === 'player';
  let status = !ready ? 'Загрузка стола…' : 'Выберите ставку и начните раздачу';
  let line = '«Ну что, проверим твою удачу?»';
  if (s.phase === 'dealing') { status = 'Блекджек сдаёт карты…'; line = '«Посмотрим, что тебе достанется.»'; }
  if (play) { status = `Ваш ход${s.hands.length > 1 ? ` · рука ${s.active + 1} из ${s.hands.length}` : ''} — ещё карту или хватит?`; line = '«Рискнёшь ещё раз?»'; }
  if (s.phase === 'dealer') { status = 'Ход дилера…'; line = '«Теперь моя очередь.»'; }
  if (s.phase === 'result') {
    const bj = s.hands.some(h=>h.outcome === 'blackjack');
    status = `${bj ? 'Блэкджек! ' : ''}${s.delta > 0 ? `Вы выиграли ${format(s.delta)} фишек` : s.delta < 0 ? `Проигрыш ${format(-s.delta)} фишек` : 'Ничья — ставка возвращена'}`;
    const winnerLines = ['«Хм. На этот раз твоя взяла.»', '«Неплохо. Но вечер ещё не закончен.»', '«Забирай фишки. Пока везёт.»'];
    const loserLines = ['«Ха. Фишки остаются у меня.»', '«Дом умеет ждать. Ещё раз?»', '«Кажется, сегодня мой вечер.»'];
    line = s.delta > 0 ? winnerLines[(s.round - 1) % winnerLines.length] : s.delta < 0 ? loserLines[(s.round - 1) % loserLines.length] : '«На этот раз — поровну.»';
    if (s.round !== lastCompleted) {
      lastCompleted = s.round; history.push(Math.sign(s.delta)); if (history.length > 12) history.shift();
      save('blackjack-bank-v1', s.bank); save('blackjack-history-v1', history);
    }
  }
  if (s.bank < 10 && s.phase === 'result') status += ' · можно начать с новыми фишками';
  el('status').textContent = t(status); el('status').classList.toggle('win', s.phase === 'result' && s.delta > 0);
  line=t(line).replace(/^«|»$/g,'');
  if(el('dealer-line').textContent!==line){
    el('dealer-line').textContent=line;
    if(preferences.dialogue&&!scene.reduced){el('dealer-bubble').getAnimations().forEach(a=>a.cancel());el('dealer-bubble').animate([{opacity:0,transform:'translateY(5px) scale(.98)'},{opacity:1,transform:'translateY(0) scale(1)'}],{duration:220,easing:'ease-out'});}
  } el('round').textContent = t(`РАЗДАЧА ${String(Math.max(1,s.round)).padStart(3,'0')}`);
  el('history').innerHTML = t('<b class="history-label">ПОСЛЕДНИЕ</b>' + history.map(n=>`<span data-result="${n>0?'win':n<0?'lose':'push'}" title="${n>0?'Победа':n<0?'Проигрыш':'Ничья'}"></span>`).join(''));
  el('card-summary').textContent = t(summary(s));
}
function setBetOpen(open:boolean){
  betOpen=open; el('app').classList.toggle('bet-open',open);button('bet-toggle').setAttribute('aria-expanded',String(open));el('bet-panel').inert=!open;
}
button('bet-toggle').onclick=()=>setBetOpen(!betOpen);
document.addEventListener('click',e=>{if(betOpen&&!(e.target as Element).closest('#bet-panel,#bet-toggle'))setBetOpen(false);});
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&betOpen){setBetOpen(false);button('bet-toggle').focus();e.preventDefault();}});
game.onChange = render;
async function action(fn: () => Promise<void>) {
  if (!ready) return; unlockAudio();
  try { await fn(); } catch (error) { console.error(error); el('status').textContent = t('Не удалось завершить действие. Обновите страницу: незавершённая раздача отменится.'); }
}
button('deal').onclick = () => void action(()=>game.deal()); button('hit').onclick = () => void action(()=>game.hit());
button('stand').onclick = () => void action(()=>game.stand()); button('double').onclick = () => void action(()=>game.double()); button('split').onclick = () => void action(()=>game.split());
document.querySelectorAll<HTMLButtonElement>('[data-bet]').forEach(b=>b.onclick=()=>{ unlockAudio(); game.bet(Number(b.dataset.bet)); });
button('bet-less').onclick=()=>game.bet(game.state.wager-10); button('bet-more').onclick=()=>game.bet(game.state.wager+10); button('bet-max').onclick=()=>game.bet(Math.min(500,game.state.bank));
button('welcome-start').onclick = () => {
  if (!ready) return;
  welcomed = true;
  el('welcome').hidden = true;
  tableShell.inert = false;
  unlockAudio();
  button('deal').focus({ preventScroll: true });
};
button('menu-open').onclick=()=>el<HTMLDialogElement>('menu-dialog').showModal();
button('welcome-settings').onclick=()=>el<HTMLDialogElement>('settings-dialog').showModal();
for (const name of ['rules','settings','reset']) button(name+'-open').onclick=()=>{el<HTMLDialogElement>('menu-dialog').close();el<HTMLDialogElement>(name+'-dialog').showModal();};
document.querySelectorAll<HTMLDialogElement>('dialog').forEach(d=>{ d.querySelector<HTMLButtonElement>('.close')!.onclick=()=>d.close(); d.addEventListener('click', e=>{ if (e.target===d) { const r=d.getBoundingClientRect(); if (e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom) d.close(); } }); });
document.querySelectorAll<HTMLDialogElement>('dialog').forEach(d=>d.addEventListener('close',()=>requestAnimationFrame(()=>{if(!document.querySelector('dialog[open]')) button(welcomed ? 'menu-open' : 'welcome-settings').focus({preventScroll:true});})));
button('reset-cancel').onclick=()=>el<HTMLDialogElement>('reset-dialog').close();
function reset() { game.reset(); history.length=0; lastCompleted=0; save('blackjack-bank-v1',game.state.bank); save('blackjack-history-v1',history); render(game.state); }
button('reset-confirm').onclick=()=>{ reset(); el<HTMLDialogElement>('reset-dialog').close(); }; button('refill').onclick=reset;
button('sound').onclick=()=>{ preferences.sound=!preferences.sound; unlockAudio(); settings(); };
button('welcome-sound').onclick=()=>{ preferences.sound=!preferences.sound; unlockAudio(); settings(); };
// Browsers allow audio after a gesture. Saved sound preferences remain respected.
document.addEventListener('pointerdown',()=>{ if (!welcomed && preferences.sound) unlockAudio(); },{passive:true});
document.addEventListener('keydown',()=>{ if (!welcomed && preferences.sound) unlockAudio(); });
document.addEventListener('visibilitychange',()=>{
  titleMusic.setEnabled(preferences.sound && !welcomed && !document.hidden);
});
for (const key of ['sound','motion','fast','dialogue'] as const) el<HTMLInputElement>('pref-'+key).onchange=e=>{ preferences[key]=(e.target as HTMLInputElement).checked; unlockAudio(); settings(); };
el<HTMLInputElement>('pref-scale').oninput=e=>{ preferences.scale=Number((e.target as HTMLInputElement).value); settings(); };
for (const key of ['musicVolume', 'sfxVolume'] as const) el<HTMLInputElement>('pref-' + key).oninput=e=>{
  preferences[key] = volumePercent(Number((e.target as HTMLInputElement).value));
  settings();
  unlockAudio();
};
el<HTMLSelectElement>('pref-filter').onchange=e=>{ preferences.filter=(e.target as HTMLSelectElement).value as typeof preferences.filter; settings(); };
el<HTMLSelectElement>('pref-language').onchange=e=>{ preferences.language=(e.target as HTMLSelectElement).value as LanguageChoice; settings(); render(game.state); };
systemReduced.addEventListener('change',settings);
document.addEventListener('keydown',e=>{
  if (!welcomed || e.repeat || e.ctrlKey || e.metaKey || e.altKey || document.querySelector('dialog[open]') || /INPUT|SELECT|TEXTAREA|BUTTON/.test((e.target as HTMLElement).tagName)) return;
  const actions: Record<string,()=>Promise<void>> = {Enter:()=>game.deal(),h:()=>game.hit(),s:()=>game.stand(),d:()=>game.double(),p:()=>game.split()};
  const fn=actions[e.key.length===1?e.key.toLowerCase():e.key]; if(fn){e.preventDefault();void action(fn);}
});
settings(); render(game.state);
void scene.init(value=>{el('loading-text').textContent=t(`ГОТОВИМ СТОЛ · ${value}%`);el('loading-progress').style.width=value+'%';}).then(()=>{
  ready=true; settings(); el('loader').hidden=true; render(game.state);
  button('welcome-start').disabled=false; button('welcome-start').textContent=t('За игровой стол');
  el('welcome-status').textContent='';
}).catch(error=>{console.error(error);el('welcome-status').textContent=t('Не удалось подготовить стол. Попробуйте ещё раз.');button('welcome-start').disabled=false;button('welcome-start').textContent=t('Повторить');button('welcome-start').onclick=()=>location.reload();el('loader').innerHTML=t('<div class="error">Не удалось загрузить стол.<br>Проверьте соединение и обновите страницу.</div>');});
