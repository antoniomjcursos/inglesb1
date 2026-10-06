/* Cuaderno de inglés B1 — loads data/index.json and every unit it lists, then renders
   the home page, one page per unit, and search results.
   Nothing in the JSON files is trusted as HTML: text is escaped and only *cursiva* and **negrita** are formatted. */
(function () {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const view = $('view'), q = $('q'), notice = $('notice'), toastEl = $('toast'),
        menu = $('menu'), burger = $('burger'), hdr = $('hdr');
  const DATA_ROOT = 'data/';
  const TYPES = { vocabulary: { label: 'Vocabulario', home: 'vocabulario' }, grammar: { label: 'Gramática', home: 'gramatica' } };
  let INDEX = { title: 'Cuaderno de inglés B1', units: [] };
  let UNITS = [];
  let quizOn = false;
  let tocObserver = null;

  /* ---------- text helpers ---------- */
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  // Spanish-style pronunciation: the stressed syllable is written in CAPITALS in the JSON
  const stress = (h) => h.replace(/[A-ZÁÉÍÓÚÜÑ]+/g, (m) => '<b>' + m.toLowerCase() + '</b>');
  const pron = (s) => stress(esc(s));
  // *cursiva*, **negrita**, and «pronunciaciones» with capitals get the same stress marking
  const md = (s) => esc(s).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>').replace(/\*(.+?)\*/g, '<i>$1</i>')
    .replace(/«([^»<]*[A-ZÁÉÍÓÚ][^»<]*)»/g, (m, x) => '«' + stress(x) + '»');
  const norm = (s) => String(s ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  const words = (n) => n + (n === 1 ? ' palabra' : ' palabras');
  const apartados = (n) => n + (n === 1 ? ' apartado' : ' apartados');
  const itemsOf = (u) => (u.sections || []).flatMap((s) => s.items || []);
  const sizeOf = (u) => u.type === 'vocabulary' ? words(itemsOf(u).length) : apartados((u.sections || []).length);
  const iconImg = (name, size, alt) => name
    ? `<img src="icons/${esc(name)}.svg" alt="${esc(alt || '')}" width="${size}" height="${size}" loading="lazy">` : '';
  const unitIcon = (u) => u.icon || ((u.sections || [])[0]?.items || []).find((i) => i.icon)?.icon || 'red-apple';
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
    try { INDEX = await getJSON(DATA_ROOT + 'index.json'); }
    catch (e) {
      notice.hidden = false;
      notice.innerHTML = location.protocol === 'file:'
        ? 'Esta página necesita un servidor para leer sus archivos JSON. Ábrela desde GitHub Pages o, en tu ordenador, ejecuta <code>python3 -m http.server</code> en la carpeta del proyecto y entra en <code>http://localhost:8000</code>.'
        : 'No se ha podido cargar <code>data/index.json</code>: ' + esc(e.message);
      return;
    }
    const results = await Promise.allSettled((INDEX.units || []).map((p) => getJSON(DATA_ROOT + p)));
    const failed = [];
    results.forEach((r, i) => r.status === 'fulfilled' ? UNITS.push(r.value) : failed.push(INDEX.units[i]));
    if (failed.length) {
      notice.hidden = false;
      notice.textContent = 'No se han podido cargar: ' + failed.join(', ') + '. Revisa que el archivo exista y que el JSON sea válido (python3 scripts/validate.py).';
    }
    if (INDEX.title) $('hdr').querySelector('.brand-txt').textContent = INDEX.title.replace(/\s*B1$/, '');
    buildMenu();
    route();
  }

  /* ---------- header menu ---------- */
  function buildMenu() {
    Object.keys(TYPES).forEach((type) => {
      const panel = $('dd-' + type);
      const us = UNITS.filter((u) => u.type === type);
      panel.innerHTML = us.map((u) =>
        `<a class="m-item" href="#${esc(u.id)}" data-id="${esc(u.id)}">${iconImg(unitIcon(u), 36)}<span><b>${esc(u.title_es || u.title)}</b><small>${esc(u.title)} · ${sizeOf(u)}</small></span></a>`).join('')
        + `<a class="m-all" href="#${TYPES[type].home}">Ver todos los temas de ${TYPES[type].label.toLowerCase()} →</a>`;
      panel.previousElementSibling.closest('.m-drop').hidden = !us.length;
    });
  }
  function closeDrops(except) {
    menu.querySelectorAll('.m-btn').forEach((b) => {
      if (b === except) return;
      b.setAttribute('aria-expanded', 'false'); $(b.getAttribute('aria-controls')).hidden = true;
    });
  }
  function closeMenu() {
    closeDrops(); menu.classList.remove('open');
    burger.setAttribute('aria-expanded', 'false'); burger.setAttribute('aria-label', 'Abrir menú');
    document.body.style.overflow = '';
  }
  menu.addEventListener('click', (e) => {
    const b = e.target.closest('.m-btn');
    if (b) {
      const open = b.getAttribute('aria-expanded') !== 'true';
      closeDrops(b);
      b.setAttribute('aria-expanded', String(open)); $(b.getAttribute('aria-controls')).hidden = !open;
      return;
    }
    if (e.target.closest('a')) closeMenu();
  });
  burger.addEventListener('click', () => {
    const open = !menu.classList.contains('open');
    if (!open) { closeMenu(); return; }
    menu.classList.add('open'); burger.setAttribute('aria-expanded', 'true'); burger.setAttribute('aria-label', 'Cerrar menú');
    document.body.style.overflow = 'hidden';
    // on phones both lists start open: the menu *is* the table of contents
    menu.querySelectorAll('.m-btn').forEach((b) => { b.setAttribute('aria-expanded', 'true'); $(b.getAttribute('aria-controls')).hidden = false; });
  });
  document.addEventListener('click', (e) => { if (!menu.classList.contains('open') && !e.target.closest('.m-drop')) closeDrops(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeMenu(); });

  function markNav(active) {
    menu.querySelector('[data-nav="inicio"]').classList.toggle('on', active === 'inicio');
    menu.querySelectorAll('.m-btn').forEach((b) => b.classList.toggle('on', b.dataset.nav === active));
  }

  /* ---------- routing ---------- */
  function route() {
    const id = decodeURIComponent(location.hash.slice(1)) || 'inicio';
    q.value = '';
    const unit = UNITS.find((u) => u.id === id);
    menu.querySelectorAll('.m-item').forEach((a) => a.toggleAttribute('aria-current', !!unit && a.dataset.id === unit.id));
    if (unit) { renderUnit(unit); window.scrollTo(0, 0); return; }
    renderHome();
    const target = id === 'vocabulario' || id === 'gramatica' ? $('sec-' + id) : null;
    if (target) target.scrollIntoView(); else window.scrollTo(0, 0);
  }
  window.addEventListener('hashchange', route);

  /* ---------- home ---------- */
  function renderHome() {
    markNav('inicio');
    document.title = INDEX.title || 'Cuaderno de inglés B1';
    const vocab = UNITS.filter((u) => u.type === 'vocabulary'), gram = UNITS.filter((u) => u.type === 'grammar');
    const nWords = vocab.reduce((a, u) => a + itemsOf(u).length, 0);
    const mosaic = vocab.flatMap((u) => (u.sections || []).map((s) => (s.items || []).find((i) => i.icon)?.icon)).filter(Boolean)
      .filter((v, i, a) => a.indexOf(v) === i).slice(0, 12);
    const card = (u) => `<a class="card" href="#${esc(u.id)}">${iconImg(unitIcon(u), 52)}
      <div><h3>${esc(u.title_es || u.title)}</h3><span class="en">${esc(u.title)}</span>
      ${u.description ? `<p>${md(u.description)}</p>` : ''}<span class="n">${sizeOf(u)}</span></div></a>`;
    view.innerHTML = `
      <section class="hero"><div class="wrap hero-in">
        <div>
          <p class="eyebrow">Inglés · Nivel B1</p>
          <h1>${esc(INDEX.title || 'Cuaderno de inglés B1')}</h1>
          <p class="lede">Vocabulario por temas con imagen, pronunciación oficial y «a la española», traducción y audio. Y la gramática que vamos viendo en clase, con ejemplos y errores típicos.</p>
          <div class="hero-cta">
            ${vocab[0] ? `<a class="btn primary" href="#vocabulario">Ver vocabulario</a>` : ''}
            ${gram[0] ? `<a class="btn" href="#gramatica">Ver gramática</a>` : ''}
          </div>
          <div class="stats">
            <div><b>${nWords}</b><span>palabras y expresiones</span></div>
            <div><b>${vocab.length}</b><span>temas de vocabulario</span></div>
            <div><b>${gram.length}</b><span>temas de gramática</span></div>
          </div>
        </div>
        <div class="mosaic" aria-hidden="true">${mosaic.map((i) => `<span>${iconImg(i, 40)}</span>`).join('')}</div>
      </div></section>
      <div class="wrap">
        ${vocab.length ? `<section class="home-sec" id="sec-vocabulario"><h2>Vocabulario</h2><p class="sub">Elige un tema. También puedes buscar cualquier palabra desde la barra de arriba.</p><div class="cards">${vocab.map(card).join('')}</div></section>` : ''}
        ${gram.length ? `<section class="home-sec" id="sec-gramatica"><h2>Gramática</h2><p class="sub">Explicación, estructura, ejemplos con audio y errores típicos.</p><div class="cards">${gram.map(card).join('')}</div></section>` : ''}
        <section class="key-card" aria-labelledby="key-h">
          <h2 id="key-h">Cómo leer la pronunciación</h2>
          <div class="key-grid">
            <div><span class="ipa">/ˈ/</span> En el AFI, la sílaba que sigue lleva el acento. <span class="ipa">/ː/</span> vocal larga; <span class="ipa">/ə/</span> vocal débil, casi muda.</div>
            <div>En la versión española, la <b>negrita</b> es la sílaba fuerte. Las vocales dobles (<b>ii</b>, <b>uu</b>, <b>aa</b>, <b>oo</b>) se alargan.</div>
            <div><b>zz</b> = una «s» que zumba, como una abeja (<i>cheese</i>). <b>z</b> = nuestra «z» de «zapato» (<i>healthy</i>).</div>
            <div><b>y</b> = la «y» fuerte de «¡yo!» (<i>ginger</i>). <b>zh</b> = la «ll» argentina de «yo» (<i>aubergine</i>).</div>
            <div><b>j</b> = «h» aspirada suave, nunca la «j» fuerte (<i>honey</i>). <b>sh</b> = «chsss» (<i>fish</i>).</div>
            <div><b>d</b> suave, como en «nada», para la «th» de <i>the</i>.</div>
          </div>
        </section>
      </div>`;
  }

  /* ---------- unit page ---------- */
  function row(unit, it, where) {
    const icon = it.icon ? iconImg(it.icon, 56)
      : `<span class="ph" aria-hidden="true">${esc(it.en.replace(/^(It's|I'm|I)\s+/i, '').charAt(0).toUpperCase())}</span>`;
    const ex = it.example
      ? `<div class="ex">${md(it.example)} ${sayBtn(it.example, it.example, true)}${it.example_es ? `<br><span>${md(it.example_es)}</span>` : ''}</div>` : '';
    return `<tr>
      <td class="pic">${icon}</td>
      <td class="w">${where ? `<p class="unit-label"><a href="#${esc(unit.id)}">${esc(where)}</a></p>` : ''}<div class="word">${esc(it.en)}</div>${it.note ? `<div class="note">${md(it.note)}</div>` : ''}${ex}</td>
      <td class="pr"><div class="ipa">/${esc(it.ipa)}/</div><span class="sp">${pron(it.pron)}</span></td>
      <td class="es-cell"><span class="es">${md(it.es)}</span><button class="reveal" type="button">Mostrar traducción</button></td>
      <td class="act">${sayBtn(it.say || it.en, it.en)}</td>
    </tr>`;
  }
  const table = (rowsHtml) => `<div class="tbl"><table>
      <thead><tr><th>Imagen</th><th>Inglés</th><th>Pronunciación</th><th>Español</th><th><span class="sr">Escuchar</span></th></tr></thead>
      <tbody>${rowsHtml}</tbody></table></div>`;
  function grammarSection(s) {
    const forms = (s.forms || []).map((f) =>
      `<div class="form"><span class="lbl">${esc(f.label)}</span><code>${esc(f.pattern)}</code>${f.example ? `<span class="fx">${esc(f.example)}</span>` : ''}</div>`).join('');
    const kw = (s.keywords || []).map((k) => `<span>${esc(k)}</span>`).join('');
    const exs = (s.examples || []).map((e) =>
      `<li>${sayBtn(e.en, e.en, true)}<div><div class="en">${esc(e.en)}</div><div class="tr">${md(e.es)}</div>${e.note ? `<div class="tr">${md(e.note)}</div>` : ''}</div></li>`).join('');
    const mist = (s.mistakes || []).map((m) =>
      `<div class="mi"><span class="w"><span class="sr">Incorrecto: </span>${esc(m.wrong)}</span><span class="r"><span class="sr">Correcto: </span>${esc(m.right)}</span>${m.why ? `<span class="why">${md(m.why)}</span>` : ''}</div>`).join('');
    const tables = (s.tables || []).map((t) => `<div class="gt">
        ${t.title ? `<p class="gt-title">${md(t.title)}</p>` : ''}
        <div class="gt-scroll"><table class="gtable">
          ${t.head ? `<thead><tr>${t.head.map((h) => `<th>${md(h)}</th>`).join('')}</tr></thead>` : ''}
          <tbody>${(t.rows || []).map((r) => `<tr>${r.map((c, i) => `<td${t.head && t.head[i] ? ` data-h="${esc(t.head[i].replace(/\*/g, ''))}"` : ''}>${md(c)}</td>`).join('')}</tr>`).join('')}</tbody>
        </table></div>
        ${t.note ? `<p class="gt-note">${md(t.note)}</p>` : ''}
      </div>`).join('');
    const list = (arr) => `<ul class="tips">${arr.map((x) => `<li>${md(x)}</li>`).join('')}</ul>`;
    const practice = (s.practice || []).map((p, i) =>
      `<li class="pq"><span class="pq-n">${i + 1}</span><span class="pq-q">${md(p.q).replace(/_{3,}/g, '<span class="gap">______</span>')}</span>
        <button class="pq-btn" type="button" aria-expanded="false">Ver respuesta</button>
        <span class="pq-a" hidden><b>${md(p.a)}</b>${p.why ? ` · ${md(p.why)}` : ''}</span></li>`).join('');
    return `<section id="s-${esc(s.id)}" data-sec="${esc(s.id)}">
      <h2 class="sec">${esc(s.title)} <small>${esc(s.title_es || '')}</small></h2>
      <div class="g-card">
        ${s.use ? `<p class="g-use">${md(s.use)}</p>` : ''}
        ${forms ? `<div><p class="g-h">Estructura</p><div class="forms">${forms}</div></div>` : ''}
        ${tables ? `<div><p class="g-h">Tablas</p><div class="gts">${tables}</div></div>` : ''}
        ${kw ? `<div><p class="g-h">Palabras clave</p><div class="kw">${kw}</div></div>` : ''}
        ${exs ? `<div><p class="g-h">Ejemplos</p><ul class="exs">${exs}</ul></div>` : ''}
        ${(s.exceptions || []).length ? `<div class="box warn"><p class="g-h">Excepciones</p>${list(s.exceptions)}</div>` : ''}
        ${(s.tips || []).length ? `<div class="box"><p class="g-h">Recuerda</p>${list(s.tips)}</div>` : ''}
        ${mist ? `<div><p class="g-h">Errores típicos</p><div class="mist">${mist}</div></div>` : ''}
        ${practice ? `<div><p class="g-h">Practica</p><ol class="practice">${practice}</ol></div>` : ''}
      </div></section>`;
  }
  function renderUnit(unit) {
    markNav(unit.type);
    const T = TYPES[unit.type] || TYPES.vocabulary;
    document.title = (unit.title_es || unit.title) + ' · ' + (INDEX.title || 'Cuaderno de inglés B1');
    const isVocab = unit.type === 'vocabulary';
    const opts = isVocab ? `<div class="opts-wrap"><h2>Opciones</h2><div class="opts">
        <label class="ctl"><input id="quiz" type="checkbox"${quizOn ? ' checked' : ''}> Modo repaso (ocultar el español)</label>
      </div></div>` : '';
    view.innerHTML = `
      <div class="band"><div class="wrap band-in">
        ${iconImg(unitIcon(unit), 72)}
        <div>
          <p class="crumbs"><a href="#inicio">Inicio</a> › <a href="#${T.home}">${T.label}</a></p>
          <h1>${esc(unit.title_es || unit.title)}</h1>
          <p class="en">${esc(unit.title)}${unit.description ? ' · ' + md(unit.description) : ''} · ${sizeOf(unit)}</p>
        </div>
      </div></div>
      <div class="wrap layout">
        <aside class="side">
          <nav class="toc-wrap" aria-label="En este tema"><h2>En este tema</h2><ul class="toc" id="toc"></ul></nav>
          ${opts}
        </aside>
        <div class="content" id="content"></div>
      </div>`;
    const draw = () => {
      let html = '', toc = '';
      (unit.sections || []).forEach((s) => {
        if (!isVocab) { html += grammarSection(s); toc += `<li><a href="#" data-go="${esc(s.id)}">${esc(s.title_es || s.title)}</a></li>`; return; }
        const items = s.items || [];
        if (!items.length) return;
        html += `<section id="s-${esc(s.id)}" data-sec="${esc(s.id)}">
          <h2 class="sec">${esc(s.title)} <small>${esc(s.title_es || '')}</small><span class="count">${words(items.length)}</span></h2>
          ${table(items.map((it) => row(unit, it)).join(''))}</section>`;
        toc += `<li><a href="#" data-go="${esc(s.id)}"><span>${esc(s.title_es || s.title)}</span><small>${items.length}</small></a></li>`;
      });
      $('content').innerHTML = html || '<p class="empty">Este tema todavía no tiene palabras.</p>';
      $('toc').innerHTML = toc;
      watchToc();
    };
    draw();
    if ($('quiz')) $('quiz').addEventListener('change', (e) => setQuiz(e.target.checked));
  }
  function setQuiz(on) {
    quizOn = on;
    document.body.classList.toggle('quiz', on);
    view.querySelectorAll('tr.show').forEach((r) => r.classList.remove('show'));
  }
  // highlight the section being read in the side index
  function watchToc() {
    if (tocObserver) tocObserver.disconnect();
    if (!('IntersectionObserver' in window)) return;
    const links = new Map([...view.querySelectorAll('.toc a')].map((a) => [a.dataset.go, a]));
    tocObserver = new IntersectionObserver((entries) => {
      entries.forEach((en) => {
        if (!en.isIntersecting) return;
        links.forEach((a) => a.classList.remove('on'));
        const a = links.get(en.target.dataset.sec);
        if (a) { a.classList.add('on'); if (a.parentElement.parentElement.scrollWidth > a.parentElement.parentElement.clientWidth) a.scrollIntoView({ block: 'nearest', inline: 'nearest' }); }
      });
    }, { rootMargin: `-${hdr.offsetHeight + 10}px 0px -65% 0px` });
    view.querySelectorAll('section[data-sec]').forEach((s) => tocObserver.observe(s));
  }

  /* ---------- search ---------- */
  function renderSearch(text) {
    markNav('');
    const t = norm(text);
    const hits = [];
    UNITS.filter((u) => u.type === 'vocabulary').forEach((u) => (u.sections || []).forEach((s) => (s.items || []).forEach((it) => {
      if (norm([it.en, it.es, it.note].join(' ')).includes(t)) hits.push({ u, s, it });
    })));
    view.innerHTML = `
      <div class="band"><div class="wrap band-in"><div>
        <p class="crumbs"><a href="#inicio">Inicio</a> › Búsqueda</p>
        <h1>«${esc(text)}»</h1>
        <p class="en">${hits.length ? words(hits.length) + ' en todo el vocabulario' : 'Sin resultados'}</p>
      </div></div></div>
      <div class="wrap layout" style="grid-template-columns:minmax(0,1fr)"><div class="content">
        ${hits.length ? table(hits.map((h) => row(h.u, h.it, (h.u.title_es || h.u.title) + ' › ' + (h.s.title_es || h.s.title))).join(''))
          : '<p class="empty">No hay ninguna palabra que coincida. Prueba en inglés o en español, sin tildes si quieres.</p>'}
      </div></div>`;
  }
  q.addEventListener('input', () => {
    const v = q.value.trim();
    if (v) { renderSearch(v); window.scrollTo(0, 0); }
    else route();
  });
  q.addEventListener('keydown', (e) => { if (e.key === 'Escape') { q.value = ''; route(); } });

  /* ---------- clicks inside the page ---------- */
  view.addEventListener('click', (e) => {
    const go = e.target.closest('a[data-go]');
    if (go) {
      e.preventDefault();
      const sec = $('s-' + go.dataset.go);
      if (sec) sec.scrollIntoView({ block: 'start' });
      return;
    }
    const pb = e.target.closest('.pq-btn');
    if (pb) {
      const ans = pb.nextElementSibling, open = ans.hidden;
      ans.hidden = !open; pb.setAttribute('aria-expanded', String(open)); pb.textContent = open ? 'Ocultar' : 'Ver respuesta';
      return;
    }
    const r = e.target.closest('.reveal');
    if (r) { r.closest('tr').classList.add('show'); return; }
    const b = e.target.closest('.say');
    if (b) speak(b.dataset.say, b);
  });

  // header height drives sticky offsets and anchor scrolling
  const setHdr = () => document.documentElement.style.setProperty('--hdr-h', hdr.offsetHeight + 'px');
  if ('ResizeObserver' in window) new ResizeObserver(setHdr).observe(hdr); else setHdr();

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
    // only warn when the device lists its voices and none of them is English
    if (pickVoice() && !voice) { toast(NO_VOICE); return; }
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text.replace(/[…/]/g, ', '));
    u.lang = 'en-GB'; u.rate = 0.85; if (voice) u.voice = voice;
    view.querySelectorAll('.say.on').forEach((x) => x.classList.remove('on'));
    btn.classList.add('on');
    u.onend = () => btn.classList.remove('on');
    u.onerror = (ev) => {
      btn.classList.remove('on');
      if (ev.error !== 'interrupted' && ev.error !== 'canceled') toast('No se ha podido reproducir el audio (' + ev.error + '). ' + NO_VOICE);
    };
    speechSynthesis.speak(u);
  }

  load();
})();
