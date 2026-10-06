/* Cuaderno de inglés B1 — loads data/index.json and every unit it lists, then renders them.
   Nothing in the JSON files is trusted as HTML: text is escaped and only *cursiva* and **negrita** are formatted. */
(function () {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const list = $('list'), cats = $('cats'), unitsNav = $('units'), q = $('q'), src = $('src'),
        quiz = $('quiz'), quizWrap = $('quiz-wrap'), empty = $('empty'), notice = $('notice'), toastEl = $('toast');
  const DATA_ROOT = 'data/';
  const TYPE_LABEL = { vocabulary: 'Vocabulario', grammar: 'Gramática' };
  let UNITS = [];      // loaded unit objects, in index order
  let current = null;  // unit being shown

  /* ---------- text helpers ---------- */
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  // Spanish-style pronunciation: the stressed syllable is written in CAPITALS in the JSON
  const stress = (h) => h.replace(/[A-ZÁÉÍÓÚÜÑ]+/g, (m) => '<b>' + m.toLowerCase() + '</b>');
  const pron = (s) => stress(esc(s));
  // notes: *cursiva*, **negrita**, and «pronunciaciones» with capitals get the same stress marking
  const md = (s) => esc(s).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>').replace(/\*(.+?)\*/g, '<i>$1</i>')
    .replace(/«([^»<]*[A-ZÁÉÍÓÚ][^»<]*)»/g, (m, x) => '«' + stress(x) + '»');
  const norm = (s) => String(s ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  const plural = (n) => n + (n === 1 ? ' palabra' : ' palabras');
  const SPK = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M11 5 6 9H3v6h3l5 4z"/><path d="M15.5 8.5a5 5 0 0 1 0 7"/><path d="M18.5 5.5a9 9 0 0 1 0 13"/></svg>';
  const sayBtn = (text, label, small) =>
    `<button class="say${small ? ' sm' : ''}" type="button" data-say="${esc(text)}" aria-label="Escuchar: ${esc(label || text)}">${SPK}</button>`;

  function toast(msg) {
    toastEl.textContent = msg; toastEl.hidden = false;
    clearTimeout(toast.t); toast.t = setTimeout(() => { toastEl.hidden = true; }, 5000);
  }

  /* ---------- loading ---------- */
  async function getJSON(path) {
    const r = await fetch(path, { cache: 'no-cache' });
    if (!r.ok) throw new Error(path + ' (' + r.status + ')');
    return r.json();
  }
  async function load() {
    let index;
    try { index = await getJSON(DATA_ROOT + 'index.json'); }
    catch (e) {
      notice.hidden = false;
      notice.innerHTML = location.protocol === 'file:'
        ? 'Esta página necesita un servidor para leer sus archivos JSON. Ábrela desde GitHub Pages o, en tu ordenador, ejecuta <code>python3 -m http.server</code> en la carpeta del proyecto y entra en <code>http://localhost:8000</code>.'
        : 'No se ha podido cargar <code>data/index.json</code>: ' + esc(e.message);
      return;
    }
    const results = await Promise.allSettled(index.units.map((p) => getJSON(DATA_ROOT + p)));
    const failed = [];
    results.forEach((r, i) => r.status === 'fulfilled' ? UNITS.push(r.value) : failed.push(index.units[i]));
    if (failed.length) { notice.hidden = false; notice.textContent = 'No se han podido cargar: ' + failed.join(', ') + '. Revisa que el archivo exista y que el JSON sea válido.'; }
    renderNav();
    route();
  }

  /* ---------- navigation ---------- */
  function renderNav() {
    const html = [];
    ['vocabulary', 'grammar'].forEach((type) => {
      const us = UNITS.filter((u) => u.type === type);
      if (!us.length) return;
      html.push(`<span class="group">${TYPE_LABEL[type]}</span>`);
      us.forEach((u) => html.push(`<a href="#${esc(u.id)}" data-id="${esc(u.id)}">${esc(u.title_es || u.title)}</a>`));
    });
    unitsNav.innerHTML = html.join('');
  }
  function route() {
    const id = decodeURIComponent(location.hash.slice(1));
    current = UNITS.find((u) => u.id === id) || UNITS[0];
    if (!current) return;
    unitsNav.querySelectorAll('a').forEach((a) => {
      if (a.dataset.id === current.id) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
    });
    $('unit-title').textContent = current.title_es || current.title;
    $('unit-desc').textContent = [current.title, current.description].filter(Boolean).join(' — ');
    document.querySelector('.eyebrow').textContent = `Inglés · ${current.level || 'B1'} · ${TYPE_LABEL[current.type] || ''}`;
    document.title = (current.title_es || current.title) + ' · Cuaderno de inglés B1';
    // source filter
    const sources = Object.entries(current.sources || {});
    src.innerHTML = '<option value="">Todas las palabras</option>' + sources.map(([k, v]) => `<option value="${esc(k)}">Solo: ${esc(v)}</option>`).join('');
    src.value = '';
    src.hidden = current.type !== 'vocabulary' || sources.length < 2;
    quizWrap.hidden = current.type !== 'vocabulary';
    $('key').hidden = current.type !== 'vocabulary';
    q.value = '';
    render();
  }
  window.addEventListener('hashchange', route);

  /* ---------- rendering ---------- */
  function tagFor(unit, key) {
    if (!key || !unit.sources || !(key in unit.sources)) return '';
    const i = Object.keys(unit.sources).indexOf(key) % 3;
    const label = key.charAt(0).toUpperCase() + key.slice(1);
    return `<span class="tag tag-${i}" title="${esc(unit.sources[key])}">${esc(label)}</span>`;
  }
  function row(unit, it) {
    const say = it.say || it.en;
    const icon = it.icon
      ? `<img src="icons/${esc(it.icon)}.svg" alt="" width="56" height="56" loading="lazy">`
      : `<span class="ph" aria-hidden="true">${esc(it.en.replace(/^(It's|I'm|I)\s+/i, '').charAt(0).toUpperCase())}</span>`;
    const ex = it.example
      ? `<div class="ex">${md(it.example)} ${sayBtn(it.example, it.example, true)}${it.example_es ? `<br><span>${md(it.example_es)}</span>` : ''}</div>` : '';
    return `<tr>
      <td class="pic">${icon}</td>
      <td class="w"><div class="word">${esc(it.en)}${tagFor(unit, it.source)}</div>${it.note ? `<div class="note">${md(it.note)}</div>` : ''}${ex}</td>
      <td class="pr"><div class="ipa">/${esc(it.ipa)}/</div><span class="sp">${pron(it.pron)}</span></td>
      <td class="es-cell"><span class="es">${md(it.es)}</span><button class="reveal" type="button">Mostrar traducción</button></td>
      <td class="act">${sayBtn(say, it.en)}</td>
    </tr>`;
  }
  function vocabSection(unit, s, items, label) {
    return `<section data-sec="${esc(s.id)}">
      ${label ? `<p class="unit-label">${esc(label)}</p>` : ''}
      <h2>${esc(s.title)} <small>${esc(s.title_es || '')}</small><span class="count">${plural(items.length)}</span></h2>
      <div class="tbl"><table>
        <thead><tr><th>Imagen</th><th>Inglés</th><th>Pronunciación</th><th>Español</th><th><span class="sr">Escuchar</span></th></tr></thead>
        <tbody>${items.map((it) => row(unit, it)).join('')}</tbody>
      </table></div></section>`;
  }
  function grammarSection(s) {
    const forms = (s.forms || []).map((f) =>
      `<div class="form"><span class="lbl">${esc(f.label)}</span><code>${esc(f.pattern)}</code>${f.example ? `<span class="fx">${esc(f.example)}</span>` : ''}</div>`).join('');
    const kw = (s.keywords || []).map((k) => `<span>${esc(k)}</span>`).join('');
    const exs = (s.examples || []).map((e) =>
      `<li>${sayBtn(e.en, e.en, true)}<div><div class="en">${esc(e.en)}</div><div class="tr">${md(e.es)}</div>${e.note ? `<div class="tr">${md(e.note)}</div>` : ''}</div></li>`).join('');
    const mist = (s.mistakes || []).map((m) =>
      `<div class="mi"><span class="w">${esc(m.wrong)}</span><span class="r">${esc(m.right)}</span>${m.why ? `<span class="why">${md(m.why)}</span>` : ''}</div>`).join('');
    return `<section data-sec="${esc(s.id)}">
      <h2>${esc(s.title)} <small>${esc(s.title_es || '')}</small></h2>
      <div class="g-card">
        ${s.use ? `<p class="g-use">${md(s.use)}</p>` : ''}
        ${forms ? `<div><p class="g-h">Estructura</p><div class="forms">${forms}</div></div>` : ''}
        ${kw ? `<div><p class="g-h">Palabras clave</p><div class="kw">${kw}</div></div>` : ''}
        ${exs ? `<div><p class="g-h">Ejemplos</p><ul class="exs">${exs}</ul></div>` : ''}
        ${mist ? `<div><p class="g-h">Errores típicos</p><div class="mist">${mist}</div></div>` : ''}
      </div></section>`;
  }
  function render() {
    const t = norm(q.value.trim());
    const f = src.value;
    let html = '', total = 0, chips = [];
    if (t) {
      // global search across every vocabulary unit
      UNITS.filter((u) => u.type === 'vocabulary').forEach((u) => (u.sections || []).forEach((s) => {
        const items = (s.items || []).filter((it) => norm([it.en, it.es, it.note].join(' ')).includes(t));
        if (!items.length) return;
        total += items.length;
        html += vocabSection(u, s, items, u.title_es || u.title);
      }));
      cats.hidden = true;
    } else if (current.type === 'grammar') {
      (current.sections || []).forEach((s) => { html += grammarSection(s); chips.push(s); total++; });
      cats.hidden = false;
    } else {
      (current.sections || []).forEach((s) => {
        const items = (s.items || []).filter((it) => !f || it.source === f);
        if (!items.length) return;
        total += items.length; chips.push(s);
        html += vocabSection(current, s, items);
      });
      cats.hidden = false;
    }
    list.innerHTML = html;
    cats.innerHTML = chips.map((s) => `<a href="#" data-go="${esc(s.id)}">${esc(s.title_es || s.title)}</a>`).join('');
    empty.hidden = total > 0;
  }

  /* ---------- interactions ---------- */
  q.addEventListener('input', render);
  src.addEventListener('change', render);
  quiz.addEventListener('change', () => {
    document.body.classList.toggle('quiz', quiz.checked);
    list.querySelectorAll('tr.show').forEach((r) => r.classList.remove('show'));
  });
  cats.addEventListener('click', (e) => {
    const a = e.target.closest('a[data-go]'); if (!a) return;
    e.preventDefault();
    const sec = list.querySelector(`section[data-sec="${CSS.escape(a.dataset.go)}"]`);
    if (sec) sec.scrollIntoView({ block: 'start' });
  });
  list.addEventListener('click', (e) => {
    const r = e.target.closest('.reveal');
    if (r) { r.closest('tr').classList.add('show'); return; }
    const b = e.target.closest('.say');
    if (b) speak(b.dataset.say, b);
  });

  // keep the sticky bar height in a CSS variable so section titles never hide under it
  const bar = $('bar');
  const setBar = () => document.documentElement.style.setProperty('--bar-h', bar.offsetHeight + 'px');
  if ('ResizeObserver' in window) new ResizeObserver(setBar).observe(bar); else setBar();

  /* ---------- audio ---------- */
  const NO_VOICE = 'Tu dispositivo no tiene ninguna voz en inglés instalada. Añádela en los ajustes de idioma o de texto a voz de tu sistema.';
  let voice = null;
  const pickVoice = () => {
    const v = speechSynthesis.getVoices();
    voice = v.find((x) => /en[-_]GB/i.test(x.lang)) || v.find((x) => /^en/i.test(x.lang)) || null;
    return v.length;
  };
  if ('speechSynthesis' in window) { pickVoice(); speechSynthesis.onvoiceschanged = pickVoice; }
  function speak(text, btn) {
    if (!('speechSynthesis' in window)) { toast('Este navegador no puede leer en voz alta.'); return; }
    const count = pickVoice();
    if (count && !voice) { toast(NO_VOICE); return; }
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text.replace(/[…/]/g, ', '));
    u.lang = 'en-GB'; u.rate = 0.85; if (voice) u.voice = voice;
    let started = false;
    u.onstart = () => { started = true; };
    btn.classList.add('on');
    u.onend = () => btn.classList.remove('on');
    u.onerror = () => { btn.classList.remove('on'); toast(NO_VOICE); };
    speechSynthesis.speak(u);
    setTimeout(() => { if (!started && !speechSynthesis.speaking) { btn.classList.remove('on'); toast(NO_VOICE); } }, 2500);
  }

  load();
})();
