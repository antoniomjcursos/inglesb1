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

  /* ---------- text helpers ---------- */
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  // Spanish-style pronunciation: the stressed syllable is written in CAPITALS in the JSON
  const stress = (h) => h.replace(/[A-ZÁÉÍÓÚÜÑ]+/g, (m) => '<b>' + m.toLowerCase() + '</b>');
  const pron = (s) => stress(esc(s));
  // *cursiva*, **negrita**, and «pronunciaciones» with capitals get the same stress marking
  // (only when a capital follows another letter, e.g. «CHÓK-lat», so titles like «Futuro» stay as they are)
  const md = (s) => esc(s).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>').replace(/\*(.+?)\*/g, '<i>$1</i>')
    .replace(/«([^»<]*[A-ZÁÉÍÓÚ][^»<]*)»/g, (m, x) => (/[a-záéíóúüñA-ZÁÉÍÓÚÜÑ][A-ZÁÉÍÓÚÜÑ]/.test(x) ? '«' + stress(x) + '»' : m));
  const norm = (s) => String(s ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  const words = (n) => n + (n === 1 ? ' palabra' : ' palabras');
  const apartados = (n) => n + (n === 1 ? ' apartado' : ' apartados');
  // a section holds "items", "groups" (sub-sections with their own items), or both
  const secItems = (s) => [...(s.items || []), ...(s.groups || []).flatMap((g) => g.items || [])];
  const itemsOf = (u) => (u.sections || []).flatMap(secItems);
  // words are always shown in alphabetical order, ignoring "the", "a", "to" and brackets at the start
  const sortKey = (en) => norm(en).replace(/^\([^)]*\)\s*/, '').replace(/^(the|a|an|to)\s+/, '').replace(/[^a-z0-9 ]/g, '').trim();
  const alpha = (arr) => [...(arr || [])].sort((a, b) => sortKey(a.en).localeCompare(sortKey(b.en), 'en'));
  const sizeOf = (u) => u.type === 'vocabulary' ? words(itemsOf(u).length) : apartados((u.sections || []).length);
  const iconImg = (name, size, alt) => name
    ? `<img src="icons/${esc(name)}.svg" alt="${esc(alt || '')}" width="${size}" height="${size}" loading="lazy">` : '';
  const unitIcon = (u) => u.icon || itemsOf(u).find((i) => i.icon)?.icon || 'red-apple';
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
    const rl = menu.querySelector('[data-nav="repaso"]'); if (rl) rl.classList.toggle('on', active === 'repaso');
    menu.querySelectorAll('.m-btn').forEach((b) => b.classList.toggle('on', b.dataset.nav === active));
  }

  /* ---------- routing ---------- */
  function route() {
    const id = decodeURIComponent(location.hash.slice(1)) || 'inicio';
    q.value = '';
    if (id === 'repaso') { renderReview(); return; }
    const unit = UNITS.find((u) => u.id === id) || null;
    menu.querySelectorAll('.m-item').forEach((a) => a.toggleAttribute('aria-current', !!unit && a.dataset.id === unit.id));
    renderTree(unit, id);
  }
  window.addEventListener('hashchange', route);

  /* ---------- the tree: Vocabulario / Gramática → temas → secciones → subsecciones → palabras ---------- */
  let openState = {};
  try { openState = JSON.parse(localStorage.getItem('tree-open') || '{}') || {}; } catch (e) { openState = {}; }
  const saveOpen = () => { try { localStorage.setItem('tree-open', JSON.stringify(openState)); } catch (e) { /* storage unavailable */ } };
  const isOpen = (k, def) => (k in openState ? openState[k] : def);
  const domId = (k) => 'n-' + k.replace(/[^a-z0-9]+/gi, '-');
  const LAZY = new Map();   // branch contents are only built when the branch is opened
  function node(key, level, head, count, def, body) {
    const open = isOpen(key, def);
    LAZY.set(key, body);
    return `<details class="node lv${level}" id="${domId(key)}" data-k="${esc(key)}"${open ? ' open' : ''}>
      <summary class="node-h"><span class="tw" aria-hidden="true"></span>${head}${count ? `<span class="count">${count}</span>` : ''}</summary>
      <div class="node-body">${open ? body() : ''}</div></details>`;
  }
  function fill(d) {
    const body = d.querySelector(':scope > .node-body');
    if (body && !body.childElementCount && LAZY.has(d.dataset.k)) body.innerHTML = LAZY.get(d.dataset.k)();
  }
  const title = (tag, main, sub) => `<${tag} class="sec">${esc(main)}${sub ? ` <small>${esc(sub)}</small>` : ''}</${tag}>`;
  const wordsTable = (unit, items) => table(alpha(items).map((it) => row(unit, it)).join(''));
  function unitBody(u) {
    const isV = u.type === 'vocabulary';
    let html = u.description ? `<p class="unit-desc">${md(u.description)}</p>` : '';
    (u.sections || []).forEach((s) => {
      const k = 's:' + u.id + ':' + s.id;
      if (!isV) { html += node(k, 3, title('h3', s.title, s.title_es), '', false, () => grammarBody(s, u)); return; }
      const total = secItems(s).length;
      if (!total) return;
      html += node(k, 3, title('h3', s.title, s.title_es), words(total), false, () => {
        let inner = (s.items || []).length ? wordsTable(u, s.items) : '';
        (s.groups || []).forEach((g) => {
          if (!(g.items || []).length) return;
          inner += node(k + ':' + g.id, 4, title('h4', g.title, g.title_es), words(g.items.length), false, () => wordsTable(u, g.items));
        });
        return inner;
      });
    });
    return html;
  }
  function treeHtml() {
    let html = '';
    Object.keys(TYPES).forEach((type) => {
      const us = UNITS.filter((u) => u.type === type);
      if (!us.length) return;
      html += node('t:' + type, 1, title('h2', TYPES[type].label), us.length + (us.length === 1 ? ' tema' : ' temas'), true, () =>
        us.map((u) => node('u:' + u.id, 2, `${iconImg(unitIcon(u), 36)}${title('h3', u.title_es || u.title, u.title)}`, sizeOf(u), false, () => unitBody(u))).join(''));
    });
    return html;
  }
  function renderTree(focus, id) {
    markNav(focus ? focus.type : 'inicio');
    document.title = focus ? (focus.title_es || focus.title) + ' · ' + (INDEX.title || 'Cuaderno de inglés B1') : (INDEX.title || 'Cuaderno de inglés B1');
    // the branch asked for in the address is always open
    const want = focus ? ['t:' + focus.type, 'u:' + focus.id]
      : id === 'vocabulario' ? ['t:vocabulary'] : id === 'gramatica' ? ['t:grammar'] : [];
    want.forEach((k) => { openState[k] = true; });
    if (want.length) saveOpen();
    LAZY.clear();
    const isHome = !focus && !want.length;
    const vocab = UNITS.filter((u) => u.type === 'vocabulary'), gram = UNITS.filter((u) => u.type === 'grammar');
    const nWords = vocab.reduce((a, u) => a + itemsOf(u).length, 0);
    const mosaic = vocab.flatMap((u) => (u.sections || []).map((s) => secItems(s).find((i) => i.icon)?.icon)).filter(Boolean)
      .filter((v, i, a) => a.indexOf(v) === i).slice(0, 12);
    const heroHtml = `
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
      </div></section>`;
    view.innerHTML = `
      ${isHome ? heroHtml : ''}
      <div class="wrap tree-wrap">
        <div class="tree-tools">
          <label class="ctl"><input id="quiz" type="checkbox"${quizOn ? ' checked' : ''}> Ocultar el español</label>
          <a class="tt-btn tt-review" href="#repaso">Repasar con tarjetas</a>
          <span class="tt-gap"></span>
          <button type="button" class="tt-btn" data-tree="open">Expandir todo</button>
          <button type="button" class="tt-btn" data-tree="close">Contraer todo</button>
        </div>
        <div class="tree" id="tree">${treeHtml()}</div>
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
    $('quiz').addEventListener('change', (e) => setQuiz(e.target.checked));
    const target = want.length ? $(domId(want[want.length - 1])) : null;
    if (target) {
      const y = target.getBoundingClientRect().top + window.scrollY - hdr.offsetHeight - 12;
      window.scrollTo({ top: Math.max(0, y), behavior: 'instant' });
    } else window.scrollTo(0, 0);
  }
  // open/close bookkeeping for every branch
  view.addEventListener('toggle', (e) => {
    const d = e.target;
    if (!d.matches || !d.matches('details.node[data-k]')) return;
    if (d.open) fill(d);
    openState[d.dataset.k] = d.open;
    saveOpen();
  }, true);
  function setTree(open) {
    const tree = $('tree');
    if (!tree) return;
    if (open) {
      let closed;
      // opening a branch builds its children, which may hold more closed branches
      while ((closed = [...tree.querySelectorAll('details.node:not([open])')]).length) {
        closed.forEach((d) => { d.open = true; fill(d); openState[d.dataset.k] = true; });
      }
    } else {
      tree.querySelectorAll('details.node').forEach((d) => { d.open = false; openState[d.dataset.k] = false; });
    }
    saveOpen();
  }
  function setQuiz(on) {
    quizOn = on;
    document.body.classList.toggle('quiz', on);
    view.querySelectorAll('tr.show').forEach((r) => r.classList.remove('show'));
  }

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
  /* ---------- irregular verbs: table and random test ---------- */
  const formCell = (w, ipa, p) => w === '—' ? '<span class="vt-none">—</span>'
    : `<div class="vt-w"><b>${esc(w)}</b> ${sayBtn(w, w, true)}</div><div class="ipa">/${esc(ipa)}/</div><span class="sp">${pron(p)}</span>`;
  function verbTable(verbs) {
    const rows = alpha(verbs).map((v) => `<tr>
        <td class="vt-es">${md(v.es)}${v.note ? `<div class="note">${md(v.note)}</div>` : ''}</td>
        <td>${formCell(v.en, v.ipa, v.pron)}</td>
        <td>${formCell(v.past, v.past_ipa, v.past_pron)}</td>
        <td>${formCell(v.pp, v.pp_ipa, v.pp_pron)}</td></tr>`).join('');
    return `<div class="gt-scroll"><table class="gtable vtable">
      <thead><tr><th>Español</th><th>Infinitivo</th><th>Pasado</th><th>Participio</th></tr></thead><tbody>${rows}</tbody></table></div>`;
  }
  const QUIZ = new Map();   // quiz id -> verb list
  function quizRows(verbs, n) {
    const pool = verbs.filter((v) => v.pp !== '—' && v.past !== '—');
    for (let i = pool.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [pool[i], pool[j]] = [pool[j], pool[i]]; }
    return pool.slice(0, n).map((v, i) => `<li class="qz-row" data-en="${esc(v.en)}">
        <span class="qz-n">${i + 1}</span>
        <span class="qz-v"><b>${esc(v.en)}</b> <small>${esc(v.es)}</small></span>
        <label><span class="sr">Pasado de ${esc(v.en)}</span><input type="text" class="qz-in" data-k="past" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="pasado"></label>
        <label><span class="sr">Participio de ${esc(v.en)}</span><input type="text" class="qz-in" data-k="pp" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="participio"></label>
        <span class="qz-fix" hidden></span></li>`).join('');
  }
  function quizHtml(id, verbs, n) {
    QUIZ.set(id, { verbs, n });
    return `<div class="quiz" data-quiz="${esc(id)}">
      <ol class="qz-list">${quizRows(verbs, n)}</ol>
      <div class="qz-bar"><button type="button" class="btn primary" data-qz="check">Comprobar</button>
        <button type="button" class="btn" data-qz="new">Nuevo test</button><span class="qz-score" role="status"></span></div></div>`;
  }
  const answerOk = (given, correct) => {
    const g = norm(given).replace(/\s+/g, ' ').trim();
    if (!g) return false;
    const options = correct.split('/').map((x) => norm(x).trim());
    return options.includes(g) || g.split(/\s*\/\s*/).every((x) => options.includes(x));
  };
  function checkQuiz(box) {
    const { verbs } = QUIZ.get(box.dataset.quiz) || { verbs: [] };
    let ok = 0, total = 0;
    box.querySelectorAll('.qz-row').forEach((row) => {
      const v = verbs.find((x) => x.en === row.dataset.en);
      if (!v) return;
      const fixes = [];
      row.querySelectorAll('.qz-in').forEach((inp) => {
        const correct = v[inp.dataset.k];
        const good = answerOk(inp.value, correct);
        total++; if (good) ok++;
        inp.classList.toggle('ok', good); inp.classList.toggle('bad', !good);
        if (!good) fixes.push(correct);
      });
      const fix = row.querySelector('.qz-fix');
      fix.hidden = !fixes.length;
      fix.textContent = fixes.length ? `${v.en} – ${v.past} – ${v.pp}` : '';
    });
    box.querySelector('.qz-score').textContent = `${ok} de ${total} correctas`;
  }

  function grammarBody(s, u) {
    const forms = (s.forms || []).map((f) =>
      `<div class="form"><span class="lbl">${esc(f.label)}</span><code>${esc(f.pattern)}</code>${f.example ? `<span class="fx">${esc(f.example)}</span>` : ''}</div>`).join('');
    const kw = (s.keywords || []).map((k) => `<span>${esc(k)}</span>`).join('');
    const exs = (s.examples || []).map((e) =>
      `<li>${sayBtn(e.en, e.en, true)}<div><div class="en">${esc(e.en)}</div><div class="tr">${md(e.es)}</div>${e.note ? `<div class="tr">${md(e.note)}</div>` : ''}</div></li>`).join('');
    const mist = (s.mistakes || []).map((m) =>
      `<div class="mi"><span class="w"><span class="sr">Incorrecto: </span>${esc(m.wrong)}</span><span class="r"><span class="sr">Correcto: </span>${esc(m.right)}</span>${m.why ? `<span class="why">${md(m.why)}</span>` : ''}</div>`).join('');
    const gtable = (t) => `<div class="gt-scroll"><table class="gtable">
          ${t.head ? `<thead><tr>${t.head.map((h) => `<th>${md(h)}</th>`).join('')}</tr></thead>` : ''}
          <tbody>${(t.rows || []).map((r) => `<tr>${r.map((c) => `<td>${md(c)}</td>`).join('')}</tr>`).join('')}</tbody>
        </table></div>`;
    const summary = s.summary ? `<div class="g-summary"><p class="g-h">Resumen</p>${gtable(s.summary)}</div>` : '';
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
    const verbs = s.verbs ? `<div><p class="g-h">Verbos</p>${verbTable(s.verbs)}</div>` : '';
    let quiz = '';
    if (s.quiz && u) {
      const src = (u.sections || []).find((x) => x.id === s.quiz.source) || s;
      quiz = `<div><p class="g-h">Test</p>${quizHtml(u.id + ':' + s.id, src.verbs || [], s.quiz.count || 10)}</div>`;
    }
    return `
      <div class="g-card">
        ${summary}
        ${s.use ? `<p class="g-use">${md(s.use)}</p>` : ''}
        ${verbs}
        ${quiz}
        ${forms ? `<div><p class="g-h">Estructura</p><div class="forms">${forms}</div></div>` : ''}
        ${tables ? `<div><p class="g-h">Tablas</p><div class="gts">${tables}</div></div>` : ''}
        ${kw ? `<div><p class="g-h">Palabras clave</p><div class="kw">${kw}</div></div>` : ''}
        ${exs ? `<div><p class="g-h">Ejemplos</p><ul class="exs">${exs}</ul></div>` : ''}
        ${(s.exceptions || []).length ? `<div class="box warn"><p class="g-h">Excepciones</p>${list(s.exceptions)}</div>` : ''}
        ${(s.tips || []).length ? `<div class="box"><p class="g-h">Recuerda</p>${list(s.tips)}</div>` : ''}
        ${mist ? `<div><p class="g-h">Errores típicos</p><div class="mist">${mist}</div></div>` : ''}
        ${practice ? `<div><p class="g-h">Practica</p><ol class="practice">${practice}</ol></div>` : ''}
      </div>`;
  }
  /* ---------- search ---------- */
  function renderSearch(text) {
    markNav('');
    const t = norm(text);
    const hits = [];
    UNITS.filter((u) => u.type === 'vocabulary').forEach((u) => (u.sections || []).forEach((s) => {
      [{ s, items: s.items || [] }, ...(s.groups || []).map((g) => ({ s: g, parent: s, items: g.items || [] }))].forEach((blk) => blk.items.forEach((it) => {
        if (norm([it.en, it.es, it.note].join(' ')).includes(t)) hits.push({ u, s: blk.s, parent: blk.parent, it });
      }));
    }));
    hits.sort((a, b) => sortKey(a.it.en).localeCompare(sortKey(b.it.en), 'en'));
    view.innerHTML = `
      <div class="band"><div class="wrap band-in"><div>
        <p class="crumbs"><a href="#inicio">Inicio</a> › Búsqueda</p>
        <h1>«${esc(text)}»</h1>
        <p class="en">${hits.length ? words(hits.length) + ' en todo el vocabulario' : 'Sin resultados'}</p>
      </div></div></div>
      <div class="wrap layout single"><div class="content">
        ${hits.length ? table(hits.map((h) => row(h.u, h.it, [h.u.title_es || h.u.title, h.parent && (h.parent.title_es || h.parent.title), h.s.title_es || h.s.title].filter(Boolean).join(' › '))).join(''))
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
    const tt = e.target.closest('[data-tree]');
    if (tt) { setTree(tt.dataset.tree === 'open'); return; }
    const qz = e.target.closest('[data-qz]');
    if (qz) {
      const box = qz.closest('.quiz');
      if (qz.dataset.qz === 'check') checkQuiz(box);
      else {
        const { verbs, n } = QUIZ.get(box.dataset.quiz);
        box.querySelector('.qz-list').innerHTML = quizRows(verbs, n);
        box.querySelector('.qz-score').textContent = '';
        const first = box.querySelector('.qz-in'); if (first) first.focus();
      }
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
    if (btn) btn.classList.add('on');
    u.onend = () => btn && btn.classList.remove('on');
    u.onerror = (ev) => {
      if (btn) btn.classList.remove('on');
      if (ev.error !== 'interrupted' && ev.error !== 'canceled') toast('No se ha podido reproducir el audio (' + ev.error + '). ' + NO_VOICE);
    };
    speechSynthesis.speak(u);
  }

  /* ---------- Repaso: flashcards of vocabulary and grammar, chosen from the tree ---------- */
  const REV_KEY = 'review-settings';
  let REV = { kind: 'vocabulary', sel: { vocabulary: [], grammar: [] }, hard: { vocabulary: [], grammar: [] }, dir: 'en-es', order: 'list', icons: true, audio: false,
              parts: { summary: true, examples: true, practice: true, mistakes: true, verbs: true } };
  try { REV = Object.assign(REV, JSON.parse(localStorage.getItem(REV_KEY) || '{}')); } catch (e) { /* defaults */ }
  const saveRev = () => { try { localStorage.setItem(REV_KEY, JSON.stringify(REV)); } catch (e) { /* storage unavailable */ } };
  if (!REV.hard || typeof REV.hard !== 'object') REV.hard = { vocabulary: [], grammar: [] };
  REV.hard.vocabulary = REV.hard.vocabulary || []; REV.hard.grammar = REV.hard.grammar || [];
  let deck = [], pos = 0, shown = false, hardMode = false, optsOpen = false;
  const plain = (t) => String(t ?? '').replace(/\*+/g, '');
  const hardSet = () => new Set(REV.hard[REV.kind]);
  function toggleHard(id, on) {
    const set = hardSet();
    if (on === undefined) on = !set.has(id);
    if (on) set.add(id); else set.delete(id);
    REV.hard[REV.kind] = [...set]; saveRev();
  }

  // the leaves of the selection tree: blocks of vocabulary or grammar sections
  function leavesOf(u) {
    const out = [];
    (u.sections || []).forEach((s) => {
      if (u.type === 'vocabulary') {
        if ((s.items || []).length) out.push({ key: `s:${u.id}:${s.id}`, u, s, items: s.items });
        (s.groups || []).forEach((g) => { if ((g.items || []).length) out.push({ key: `g:${u.id}:${s.id}:${g.id}`, u, s, g, items: g.items }); });
      } else out.push({ key: `s:${u.id}:${s.id}`, u, s });
    });
    return out;
  }
  const PARTS = [['summary', 'Resúmenes'], ['examples', 'Ejemplos'], ['practice', 'Ejercicios'], ['mistakes', 'Errores típicos'], ['verbs', 'Verbos irregulares']];
  function grammarCards(u, s, allParts) {
    const cards = [], where = `${u.title_es || u.title} › ${s.title_es || s.title}`, en2es = REV.dir === 'en-es';
    const P = allParts ? { summary: true, examples: true, practice: true, mistakes: true, verbs: true } : REV.parts;
    const id = (t, k) => `${u.id}|${s.id}|${t}|${k}`;
    if (P.summary && s.summary) (s.summary.rows || []).forEach((r, i) => {
      if (!r[0] || !r[1]) return;
      cards.push({ id: id('sum', i), label: `${plain(s.title)}: ${plain(r[0])}`, where, front: `<p class="rv-kicker">${esc(s.title)}</p><p class="rv-main">${md(r[0])}</p>`,
                   back: `<p class="rv-ans">${md(r[1])}</p>${r[2] ? `<p class="rv-ex">${md(r[2])}</p>` : ''}` });
    });
    if (P.examples) (s.examples || []).forEach((e, i) => cards.push(en2es
      ? { id: id('ex', i), label: e.en, where, say: e.en, front: `<p class="rv-main rv-sent">${esc(e.en)}</p>`, back: `<p class="rv-ans">${md(e.es)}</p>${e.note ? `<p class="rv-ex">${md(e.note)}</p>` : ''}` }
      : { id: id('ex', i), label: e.en, where, say: e.en, sayOnBack: true, front: `<p class="rv-main rv-sent">${md(e.es)}</p>`, back: `<p class="rv-ans">${esc(e.en)}</p>${e.note ? `<p class="rv-ex">${md(e.note)}</p>` : ''}` }));
    if (P.practice) (s.practice || []).forEach((p, i) => cards.push({ id: id('pq', i), label: plain(p.q), where,
      front: `<p class="rv-kicker">Completa</p><p class="rv-main rv-sent">${md(p.q).replace(/_{3,}/g, '<span class="gap">______</span>')}</p>`,
      back: `<p class="rv-ans">${md(p.a)}</p>${p.why ? `<p class="rv-ex">${md(p.why)}</p>` : ''}` }));
    if (P.mistakes) (s.mistakes || []).forEach((m, i) => cards.push({ id: id('mi', i), label: `✗ ${m.wrong}`, where,
      front: `<p class="rv-kicker">¿Qué está mal?</p><p class="rv-main rv-sent rv-wrong">${esc(m.wrong)}</p>`,
      back: `<p class="rv-ans">${esc(m.right)}</p>${m.why ? `<p class="rv-ex">${md(m.why)}</p>` : ''}`, say: m.right, sayOnBack: true }));
    if (P.verbs) alpha(s.verbs || []).forEach((v) => {
      const forms = `<p class="rv-ans">${esc(v.en)} – ${esc(v.past)} – ${esc(v.pp)}</p><p class="rv-ex"><span class="sp">${pron(v.pron)}</span> · <span class="sp">${pron(v.past_pron)}</span> · <span class="sp">${pron(v.pp_pron)}</span></p>`;
      cards.push(en2es
        ? { id: id('vb', v.en), label: `${v.en} – ${v.past} – ${v.pp}`, where, say: v.en, front: `<p class="rv-main">${esc(v.en)}</p><p class="rv-kicker">pasado y participio</p>`, back: `${forms}<p class="rv-ex">${md(v.es)}</p>`, sayBack: `${v.en}, ${v.past}, ${v.pp}` }
        : { id: id('vb', v.en), label: `${v.en} – ${v.past} – ${v.pp}`, where, front: `<p class="rv-main">${md(v.es)}</p>`, back: forms, say: `${v.en}, ${v.past}, ${v.pp}`, sayOnBack: true });
    });
    return cards;
  }
  function vocabCard(leaf, it) {
    const where = [leaf.u.title_es || leaf.u.title, leaf.s.title_es || leaf.s.title, leaf.g && (leaf.g.title_es || leaf.g.title)].filter(Boolean).join(' › ');
    const pic = REV.icons && it.icon ? `<div class="rv-pic">${iconImg(it.icon, 96)}</div>` : '';
    const prn = `<p class="rv-pron"><span class="ipa">/${esc(it.ipa)}/</span> <span class="sp">${pron(it.pron)}</span></p>`;
    const extra = `${it.note ? `<p class="rv-ex">${md(it.note)}</p>` : ''}${it.example ? `<p class="rv-ex"><i>${md(it.example)}</i>${it.example_es ? `<br>${md(it.example_es)}` : ''}</p>` : ''}`;
    const idl = { id: `${leaf.u.id}|${it.en}`, label: `${it.en} – ${plain(it.es)}` };
    return REV.dir === 'en-es'
      ? { ...idl, where, say: it.say || it.en, front: `${pic}<p class="rv-main">${esc(it.en)}</p>${prn}`, back: `<p class="rv-ans">${md(it.es)}</p>${extra}` }
      : { ...idl, where, say: it.say || it.en, sayOnBack: true, front: `${pic}<p class="rv-main">${md(it.es)}</p>`, back: `<p class="rv-ans">${esc(it.en)}</p>${prn}${extra}` };
  }
  // fromList: solo las de «No me la sé» · keepOrder: sin barajar · everything: todas las tarjetas posibles (para regenerarlas)
  function buildDeck(fromList, keepOrder, everything) {
    const sel = new Set(REV.sel[REV.kind] || []), hard = hardSet();
    const wide = fromList || everything;
    let cards = [];
    UNITS.filter((u) => u.type === REV.kind).forEach((u) => leavesOf(u).forEach((leaf) => {
      if (!wide && !sel.has(leaf.key)) return;
      if (REV.kind === 'vocabulary') alpha(leaf.items).forEach((it) => cards.push(vocabCard(leaf, it)));
      else cards = cards.concat(grammarCards(leaf.u, leaf.s, wide));
    }));
    if (fromList && !everything) {
      const seen = new Set();
      cards = cards.filter((c) => hard.has(c.id) && !seen.has(c.id) && seen.add(c.id));
    }
    cards.forEach((c, i) => { c.n = i; });
    if (REV.order === 'random' && !keepOrder) for (let i = cards.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [cards[i], cards[j]] = [cards[j], cards[i]]; }
    return cards;
  }

  function renderReview() {
    markNav('repaso');
    document.title = 'Repaso · ' + (INDEX.title || 'Cuaderno de inglés B1');
    const isV = REV.kind === 'vocabulary';
    const sel = new Set(REV.sel[REV.kind] || []);
    const units = UNITS.filter((u) => u.type === REV.kind);
    const cb = (keys, label, count, extraCls) => `<label class="rv-cb${extraCls ? ' ' + extraCls : ''}"><input type="checkbox" data-keys="${esc(keys.join(' '))}"> <span>${esc(label)}</span>${count != null ? ` <small>${count}</small>` : ''}</label>`;
    const tree = units.map((u) => {
      const leaves = leavesOf(u);
      const secs = (u.sections || []).map((s) => {
        const ls = leaves.filter((l) => l.s === s);
        if (!ls.length) return '';
        const n = isV ? ls.reduce((a, l) => a + l.items.length, 0) : null;
        const kids = isV && (s.groups || []).length ? `<ul>${ls.filter((l) => l.g).map((l) => `<li>${cb([l.key], l.g.title_es || l.g.title, l.items.length)}</li>`).join('')}</ul>` : '';
        return `<li>${cb(ls.map((l) => l.key), s.title_es || s.title, n)}${kids}</li>`;
      }).join('');
      const n = isV ? leaves.reduce((a, l) => a + l.items.length, 0) : null;
      return `<li class="rv-unit"><details${leaves.some((l) => sel.has(l.key)) ? ' open' : ''}><summary><span class="tw" aria-hidden="true"></span>${cb(leaves.map((l) => l.key), u.title_es || u.title, n, 'rv-cb-unit')}</summary><ul>${secs}</ul></details></li>`;
    }).join('');
    const radio = (name, val, label) => `<label class="rv-opt"><input type="radio" name="${name}" value="${val}"${REV[name] === val ? ' checked' : ''}> ${label}</label>`;
    view.innerHTML = `
      <div class="band"><div class="wrap band-in"><div>
        <p class="crumbs"><a href="#inicio">Inicio</a> › Repaso</p>
        <h1>Modo repaso</h1>
        <p class="en">Elige temas del árbol, ajusta las opciones y repasa tarjeta a tarjeta. Pulsa <kbd>Espacio</kbd> o <kbd>Enter</kbd> (o toca la tarjeta) para ver la respuesta y pasar a la siguiente.</p>
      </div></div></div>
      <div class="wrap rv-setup" id="rv-setup">
        <div class="rv-tabs" role="tablist">
          <button type="button" role="tab" class="rv-tab" data-kind="vocabulary" aria-selected="${isV}">Vocabulario</button>
          <button type="button" role="tab" class="rv-tab" data-kind="grammar" aria-selected="${!isV}">Gramática</button>
        </div>
        <div class="rv-grid">
          <section class="rv-panel">
            <div class="rv-panel-h"><h2>1. Elige qué repasar</h2>
              <span><button type="button" class="tt-btn" data-rv="all">Todo</button> <button type="button" class="tt-btn" data-rv="none">Nada</button></span></div>
            <ul class="rv-tree" id="rv-tree">${tree}</ul>
          </section>
          <section class="rv-panel">
            <h2>2. Opciones</h2>
            <fieldset><legend>Dirección</legend>${radio('dir', 'en-es', 'Inglés → Español')}${radio('dir', 'es-en', 'Español → Inglés')}</fieldset>
            <fieldset><legend>Orden</legend>${radio('order', 'list', 'En orden de lista')}${radio('order', 'random', 'Aleatorio')}</fieldset>
            ${isV ? `<fieldset><legend>Imagen</legend><label class="rv-opt"><input type="radio" name="icons" value="1"${REV.icons ? ' checked' : ''}> Con icono</label><label class="rv-opt"><input type="radio" name="icons" value="0"${REV.icons ? '' : ' checked'}> Sin icono</label></fieldset>`
                  : `<fieldset><legend>Qué tarjetas</legend>${PARTS.map(([k, l]) => `<label class="rv-opt"><input type="checkbox" data-part="${k}"${REV.parts[k] ? ' checked' : ''}> ${l}</label>`).join('')}</fieldset>`}
            <fieldset><legend>Audio</legend><label class="rv-opt"><input type="checkbox" id="rv-audio"${REV.audio ? ' checked' : ''}> Leer el inglés en voz alta automáticamente</label></fieldset>
            <button type="button" class="btn primary rv-start" id="rv-start">Empezar</button>
          </section>
          <section class="rv-panel rv-hard" id="rv-hard"></section>
        </div>
      </div>
      <div class="wrap rv-play" id="rv-play" hidden></div>`;
    syncChecks();
    window.scrollTo(0, 0);
  }
  function drawHardPanel() {
    const box = $('rv-hard');
    if (!box) return;
    const cards = buildDeck(true, true);
    box.innerHTML = `<div class="rv-panel-h"><h2>3. Mi lista «No me la sé»</h2><span class="rv-hard-n">${cards.length}</span></div>
      ${cards.length ? `<p class="rv-help">Las tarjetas que marques durante el repaso se guardan aquí. Repásalas solas hasta que te las sepas.</p>
        <ul class="rv-hard-list">${cards.map((c) => `<li><span>${esc(c.label)}</span><button type="button" class="rv-x" data-hard-del="${esc(c.id)}" aria-label="Quitar ${esc(c.label)} de mi lista">×</button></li>`).join('')}</ul>
        <div class="rv-ctrl rv-ctrl-left"><button type="button" class="btn primary" data-rv="hard">Repasar mi lista · ${cards.length}</button><button type="button" class="btn" data-rv="clear">Vaciar la lista</button></div>`
      : `<p class="rv-help">Todavía está vacía. Durante el repaso, pulsa <b>«No me la sé»</b> (o la tecla <kbd>N</kbd>) en las tarjetas que te cuesten y aparecerán aquí para repasarlas aparte.</p>`}`;
  }
  function syncChecks() {
    const sel = new Set(REV.sel[REV.kind] || []);
    view.querySelectorAll('#rv-tree input[data-keys]').forEach((c) => {
      const keys = c.dataset.keys.split(' ');
      const n = keys.filter((k) => sel.has(k)).length;
      c.checked = n === keys.length; c.indeterminate = n > 0 && n < keys.length;
    });
    const total = buildDeck().length;
    const btn = $('rv-start');
    if (btn) { btn.disabled = !total; btn.textContent = total ? `Empezar · ${total} tarjeta${total === 1 ? '' : 's'}` : 'Elige al menos un tema'; }
    drawHardPanel();
  }
  function drawCard() {
    const play = $('rv-play');
    if (!deck.length) return;
    if (pos >= deck.length) {
      optsOpen = false;
      const nHard = buildDeck(true, true).length;
      play.innerHTML = `<div class="rv-card rv-end"><p class="rv-main">¡Repaso terminado!</p><p class="rv-ans">Has repasado ${deck.length} tarjeta${deck.length === 1 ? '' : 's'}.</p>
        <p class="rv-ex">${nHard ? `Tienes ${nHard} en tu lista «No me la sé».` : 'Tu lista «No me la sé» está vacía.'}</p>
        <div class="rv-ctrl">${nHard ? `<button type="button" class="btn primary" data-rv="hard">Repasar mi lista · ${nHard}</button>` : ''}<button type="button" class="btn${nHard ? '' : ' primary'}" data-rv="again">Repetir</button><button type="button" class="btn" data-rv="shuffle">Repetir en otro orden</button><button type="button" class="btn" data-rv="exit">Cambiar selección</button>${nHard ? clearBtn() : ''}</div></div>`;
      return;
    }
    const c = deck[pos];
    const inList = hardSet().has(c.id);
    play.innerHTML = `
      ${hardMode ? `<p class="rv-mode">Repasando tu lista «No me la sé» · ahora tiene ${hardSet().size}</p>` : ''}
      ${optsBar()}
      <div class="rv-top"><span class="rv-where">${esc(c.where)}</span><span class="rv-count">${pos + 1} / ${deck.length}</span></div>
      <div class="rv-bar"><span style="width:${Math.round((pos / deck.length) * 100)}%"></span></div>
      <div class="rv-card${shown ? ' open' : ''}" id="rv-card" tabindex="0" role="button" aria-label="${shown ? 'Siguiente tarjeta' : 'Mostrar la respuesta'}">
        <div class="rv-front">${c.front}${c.say && !c.sayOnBack ? `<div class="rv-say">${sayBtn(c.say, c.say)}</div>` : ''}</div>
        <div class="rv-back"${shown ? '' : ' hidden'}>${c.back}${c.say && c.sayOnBack ? `<div class="rv-say">${sayBtn(c.say, c.say)}</div>` : ''}</div>
        <p class="rv-hint">${shown ? 'Espacio / Enter: siguiente · ←: anterior' : 'Espacio / Enter o toca la tarjeta: ver respuesta'}</p>
      </div>
      <div class="rv-ctrl">
        <button type="button" class="btn" data-rv="prev"${pos ? '' : ' disabled'}>← Anterior</button>
        <button type="button" class="btn primary" data-rv="next">${shown ? 'Siguiente →' : 'Mostrar respuesta'}</button>
        <button type="button" class="btn" data-rv="exit">Terminar</button>
      </div>
      <div class="rv-ctrl"><button type="button" class="btn rv-mark${inList ? ' on' : ''}" data-rv="mark" aria-pressed="${inList}">${inList
        ? (hardMode ? '✓ Ya me la sé: quitar de mi lista' : '✓ En mi lista · quitar')
        : '✗ No me la sé · añadir a mi lista'} <kbd>N</kbd></button></div>`;
    if (REV.audio) {
      const txt = shown ? (c.sayOnBack ? c.say : c.sayBack) : (!c.sayOnBack ? c.say : null);
      if (txt) speak(txt, null);
    }
  }
  // Barra de opciones durante el repaso: cambia la configuración sin salir.
  function optsBar() {
    const seg = (opt, val, label, on) => `<button type="button" class="rv-seg" data-opt="${opt}" data-val="${val}" aria-pressed="${on}">${label}</button>`;
    return `<div class="rv-optwrap"><button type="button" class="btn rv-gear" data-rv="opts" aria-expanded="${optsOpen}" aria-controls="rv-opts">⚙ Opciones <kbd>O</kbd></button>
    <div class="rv-opts" id="rv-opts" role="dialog" aria-label="Opciones del repaso"${optsOpen ? '' : ' hidden'}>
      <div class="rv-opts-h"><b>Opciones del repaso</b><button type="button" class="rv-x" data-rv="opts" aria-label="Cerrar opciones">×</button></div>
      <div class="rv-optg"><span class="rv-optl">Dirección <kbd>D</kbd></span>${seg('dir', 'en-es', 'Inglés → Español', REV.dir === 'en-es')}${seg('dir', 'es-en', 'Español → Inglés', REV.dir === 'es-en')}</div>
      <div class="rv-optg"><span class="rv-optl">Orden</span>${seg('order', 'list', 'Lista', REV.order === 'list')}${seg('order', 'random', 'Aleatorio', REV.order === 'random')}</div>
      ${REV.kind === 'vocabulary' ? `<div class="rv-optg"><span class="rv-optl">Icono <kbd>I</kbd></span>${seg('icons', '1', 'Con', REV.icons)}${seg('icons', '0', 'Sin', !REV.icons)}</div>` : ''}
      <div class="rv-optg"><span class="rv-optl">Voz automática</span>${seg('audio', '1', 'Sí', REV.audio)}${seg('audio', '0', 'No', !REV.audio)}</div>
      <div class="rv-optg"><span class="rv-optl">Mi lista «No me la sé» · ${hardSet().size}</span>${clearBtn()}</div>
      <p class="rv-help">Los cambios se aplican al momento, sin perder por dónde vas.</p>
    </div></div>`;
  }
  function clearBtn() {
    const n = hardSet().size;
    return `<button type="button" class="btn rv-clear" data-rv="clear"${n ? '' : ' disabled'}>${n ? 'Vaciar la lista' : 'La lista está vacía'}</button>`;
  }
  // Vaciar pide confirmación: el primer clic arma el botón y el segundo vacía.
  let clearTimer = null;
  function clearList(btn) {
    if (btn.dataset.armed !== '1') {
      btn.dataset.armed = '1'; btn.classList.add('armed');
      btn.textContent = `¿Seguro? Pulsa otra vez para borrar ${hardSet().size}`;
      clearTimeout(clearTimer);
      clearTimer = setTimeout(() => { if (btn.isConnected) { btn.dataset.armed = ''; btn.classList.remove('armed'); btn.textContent = 'Vaciar la lista'; } }, 4000);
      return;
    }
    clearTimeout(clearTimer);
    REV.hard[REV.kind] = []; saveRev();
    toast('Lista «No me la sé» vaciada');
    drawHardPanel();
    if ($('rv-play') && !$('rv-play').hidden) drawCard();
  }
  function setOpt(opt, val) {
    if (opt === 'dir' || opt === 'icons') {
      if (opt === 'dir') REV.dir = val; else REV.icons = val === '1';
      // Regenera las tarjetas con la nueva configuración, en el mismo orden y en la misma posición.
      const fresh = new Map(buildDeck(false, true, hardMode).map((c) => [c.id, c]));
      deck = deck.map((c) => { const f = fresh.get(c.id); return f ? { ...f, n: c.n } : c; });
      if (opt === 'dir') shown = false;
    } else if (opt === 'order') {
      REV.order = val;
      // Las ya vistas se quedan; las que faltan se reordenan.
      const start = shown ? pos + 1 : pos;
      const rest = deck.slice(start);
      if (val === 'random') for (let i = rest.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [rest[i], rest[j]] = [rest[j], rest[i]]; }
      else rest.sort((a, b) => a.n - b.n);
      deck = deck.slice(0, start).concat(rest);
    } else if (opt === 'audio') {
      REV.audio = val === '1';
      if (!REV.audio && window.speechSynthesis) speechSynthesis.cancel();
    }
    saveRev(); syncOpts(); drawCard();
    const b = view.querySelector(`#rv-opts [data-opt="${opt}"][data-val="${opt === 'icons' || opt === 'audio' ? (opt === 'icons' ? (REV.icons ? '1' : '0') : (REV.audio ? '1' : '0')) : REV[opt]}"]`);
    if (b && optsOpen) b.focus();
  }
  function syncOpts() {
    view.querySelectorAll('#rv-setup input[name="dir"], #rv-setup input[name="order"]').forEach((i) => { i.checked = REV[i.name] === i.value; });
    view.querySelectorAll('#rv-setup input[name="icons"]').forEach((i) => { i.checked = (i.value === '1') === REV.icons; });
    const au = $('rv-audio'); if (au) au.checked = REV.audio;
  }
  function startReview(fromList) {
    hardMode = !!fromList;
    deck = buildDeck(hardMode);
    if (!deck.length) return;
    pos = 0; shown = false; optsOpen = false;
    $('rv-setup').hidden = true; $('rv-play').hidden = false;
    drawCard();
    window.scrollTo(0, 0);
  }
  function step(dir) {
    if (!$('rv-play') || $('rv-play').hidden || pos >= deck.length && dir > 0) return;
    if (dir > 0) { if (!shown) shown = true; else { pos++; shown = false; } }
    else if (pos > 0) { pos = Math.min(pos, deck.length) - 1; shown = false; }
    drawCard();
  }
  view.addEventListener('change', (e) => {
    if (!$('rv-setup')) return;
    const t = e.target;
    if (t.dataset.keys) {
      const set = new Set(REV.sel[REV.kind] || []);
      t.dataset.keys.split(' ').forEach((k) => (t.checked ? set.add(k) : set.delete(k)));
      REV.sel[REV.kind] = [...set];
    } else if (t.name === 'dir' || t.name === 'order') REV[t.name] = t.value;
    else if (t.name === 'icons') REV.icons = t.value === '1';
    else if (t.dataset.part) REV.parts[t.dataset.part] = t.checked;
    else if (t.id === 'rv-audio') REV.audio = t.checked;
    saveRev(); syncChecks();
  });
  view.addEventListener('click', (e) => {
    if (!$('rv-setup')) return;
    const del = e.target.closest('[data-hard-del]');
    if (del) { toggleHard(del.dataset.hardDel, false); drawHardPanel(); return; }
    const tab = e.target.closest('.rv-tab');
    if (tab) { REV.kind = tab.dataset.kind; saveRev(); renderReview(); return; }
    if (e.target.closest('#rv-start')) { startReview(); return; }
    const o = e.target.closest('[data-opt]');
    if (o) { if (o.getAttribute('aria-pressed') !== 'true') setOpt(o.dataset.opt, o.dataset.val); return; }
    const a = e.target.closest('[data-rv]');
    if (a) {
      const act = a.dataset.rv;
      if (act === 'all' || act === 'none') {
        REV.sel[REV.kind] = act === 'all' ? UNITS.filter((u) => u.type === REV.kind).flatMap((u) => leavesOf(u).map((l) => l.key)) : [];
        saveRev(); syncChecks(); return;
      }
      if (act === 'opts') { optsOpen = !optsOpen; drawCard(); if (optsOpen) { const f = view.querySelector('#rv-opts .rv-seg'); if (f) f.focus(); } else { const g = view.querySelector('.rv-gear'); if (g) g.focus(); } return; }
      if (act === 'hard') { startReview(true); return; }
      if (act === 'clear') { clearList(a); return; }
      if (act === 'mark') { const c = deck[pos]; if (c) { toggleHard(c.id); drawCard(); } return; }
      if (act === 'next') step(1); else if (act === 'prev') step(-1);
      else if ((act === 'again' || act === 'shuffle') && hardMode) {
        deck = buildDeck(true, act === 'again');
        if (act === 'shuffle') for (let i = deck.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [deck[i], deck[j]] = [deck[j], deck[i]]; }
        pos = 0; shown = false;
        if (deck.length) drawCard(); else { $('rv-play').hidden = true; $('rv-setup').hidden = false; drawHardPanel(); toast('Tu lista está vacía: ¡ya te las sabes todas!'); }
      }
      else if (act === 'again') { pos = 0; shown = false; drawCard(); }
      else if (act === 'shuffle') { for (let i = deck.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [deck[i], deck[j]] = [deck[j], deck[i]]; } pos = 0; shown = false; drawCard(); }
      else if (act === 'exit') { $('rv-play').hidden = true; $('rv-setup').hidden = false; drawHardPanel(); if (window.speechSynthesis) speechSynthesis.cancel(); }
      return;
    }
    if (optsOpen && !e.target.closest('.rv-optwrap')) { optsOpen = false; drawCard(); return; }
    if (e.target.closest('#rv-card') && !e.target.closest('.say')) step(1);
  });
  document.addEventListener('keydown', (e) => {
    const play = $('rv-play');
    if (!play || play.hidden) return;
    if (e.target.closest && e.target.closest('input, textarea, select')) return;
    if ((e.key === 'o' || e.key === 'O') && pos < deck.length) { e.preventDefault(); optsOpen = !optsOpen; drawCard(); if (optsOpen) { const f = view.querySelector('#rv-opts .rv-seg'); if (f) f.focus(); } return; }
    if (optsOpen && e.key === 'Escape') { e.preventDefault(); optsOpen = false; drawCard(); const g = view.querySelector('.rv-gear'); if (g) g.focus(); return; }
    if (optsOpen && (e.key === ' ' || e.key === 'Enter') && e.target.closest && e.target.closest('#rv-opts button')) return;
    if (e.key === ' ' || e.key === 'Enter' || e.key === 'ArrowRight') { e.preventDefault(); step(1); }
    else if (e.key === 'ArrowLeft') { e.preventDefault(); step(-1); }
    else if ((e.key === 'd' || e.key === 'D') && pos < deck.length) { e.preventDefault(); setOpt('dir', REV.dir === 'en-es' ? 'es-en' : 'en-es'); }
    else if ((e.key === 'i' || e.key === 'I') && REV.kind === 'vocabulary' && pos < deck.length) { e.preventDefault(); setOpt('icons', REV.icons ? '0' : '1'); }
    else if ((e.key === 'n' || e.key === 'N') && deck[pos]) { e.preventDefault(); toggleHard(deck[pos].id); drawCard(); }
    else if (e.key === 'Escape') { play.hidden = true; $('rv-setup').hidden = false; drawHardPanel(); }
  });

  load();
})();
