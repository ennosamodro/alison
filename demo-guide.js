/* demo-guide.js — kursor penunjuk + auto-isi password untuk MODE DEMO presentasi.
 *
 * Dipakai oleh kedua dashboard lewat window.DEMO_GUIDE = { fields, steps, resetWhen }.
 * Hanya untuk prototype. Saat disambung ke Apps Script / produksi: HAPUS tag <script> demo-guide.js
 * (dan blok window.DEMO_GUIDE) dari HTML, karena auto-isi membuka password ke siapa pun.
 * Matikan sementara: tombol "Mode demo" di pojok kiri bawah, atau tambah ?demo=0 di URL.
 */
(function () {
  var CFG = window.DEMO_GUIDE;
  if (!CFG) return;

  function lsGet(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function lsSet(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }

  var qp = new URLSearchParams(location.search);
  var forcedOff = qp.get('demo') === '0';
  var on = !forcedOff && lsGet('demoGuide:on') !== '0';
  var done = {};
  var curId = null, curStep = null, curEl = null;
  var typing = false;
  var lastReset = false;

  /* ---------- styling ---------- */
  var css = [
    '.dg-cursor{position:fixed;left:0;top:0;z-index:99998;pointer-events:none;opacity:0;',
    ' transition:transform .85s cubic-bezier(.22,.8,.2,1),opacity .25s ease;will-change:transform}',
    '.dg-cursor.show{opacity:1}',
    '.dg-cursor svg{display:block;filter:drop-shadow(0 2px 3px rgba(0,0,0,.35))}',
    '.dg-ring{position:absolute;left:-14px;top:-14px;width:28px;height:28px;border-radius:50%;',
    ' border:2px solid #B23A2E;animation:dgPulse 1.4s ease-out infinite}',
    '@keyframes dgPulse{0%{transform:scale(.4);opacity:.9}100%{transform:scale(1.7);opacity:0}}',
    '.dg-bubble{position:fixed;z-index:99999;max-width:270px;background:#2A2420;color:#fff;',
    ' font:13px/1.45 system-ui,-apple-system,"Segoe UI",sans-serif;padding:11px 13px;border-radius:10px;',
    ' box-shadow:0 6px 22px rgba(0,0,0,.28);opacity:0;pointer-events:none;',
    ' transition:left .85s cubic-bezier(.22,.8,.2,1),top .85s cubic-bezier(.22,.8,.2,1),opacity .25s ease}',
    '.dg-bubble.show{opacity:1;pointer-events:auto}',
    '.dg-bubble .dg-n{font-size:10px;letter-spacing:.06em;text-transform:uppercase;color:#f0a79f;margin-bottom:3px}',
    '.dg-bubble .dg-a{display:flex;gap:10px;align-items:center;margin-top:8px}',
    '.dg-bubble button{background:#B23A2E;color:#fff;border:0;border-radius:6px;padding:5px 11px;font:600 12px system-ui;cursor:pointer}',
    '.dg-bubble button:hover{background:#c8473a}',
    '.dg-bubble a{color:#bbb;font-size:11px;cursor:pointer;text-decoration:underline}',
    '.dg-hint{color:#f0a79f;font-size:12px;margin-top:6px}',
    '.dg-bar{position:fixed;left:12px;bottom:12px;z-index:99999;display:flex;gap:6px;',
    ' font:12px system-ui,-apple-system,"Segoe UI",sans-serif}',
    '.dg-bar button{background:#fff;color:#2A2420;border:1px solid #cfc8bd;border-radius:999px;padding:6px 12px;',
    ' cursor:pointer;box-shadow:0 2px 8px rgba(0,0,0,.12);font:inherit}',
    '.dg-bar button.on{background:#B23A2E;color:#fff;border-color:#B23A2E}',
    '.dg-chip{display:none;margin:8px 0 0;font:12px system-ui,sans-serif;color:#7A231C;background:#f6e4e1;',
    ' border:1px dashed #B23A2E;border-radius:7px;padding:6px 9px;cursor:pointer;text-align:left}',
    'body.dg-on .dg-chip{display:block}',
    '@media print{.dg-cursor,.dg-bubble,.dg-bar,.dg-chip{display:none!important}}'
  ].join('');
  var st = document.createElement('style');
  st.textContent = css;
  document.head.appendChild(st);

  /* ---------- elemen ---------- */
  var cursor = document.createElement('div');
  cursor.className = 'dg-cursor';
  cursor.innerHTML = '<div class="dg-ring"></div>' +
    '<svg width="24" height="28" viewBox="0 0 24 28"><path d="M2 2l0 20 5.5-5 3.6 8.2 3.4-1.5-3.6-8H20z" ' +
    'fill="#111" stroke="#fff" stroke-width="2" stroke-linejoin="round"/></svg>';
  var bubble = document.createElement('div');
  bubble.className = 'dg-bubble';
  var bar = document.createElement('div');
  bar.className = 'dg-bar';
  bar.innerHTML = '<button id="dgToggle"></button><button id="dgReset" title="Ulangi panduan dari awal">&#8634; Ulang</button>';
  document.body.appendChild(cursor);
  document.body.appendChild(bubble);
  document.body.appendChild(bar);

  function syncBar() {
    var b = document.getElementById('dgToggle');
    b.textContent = (on ? '● Mode demo: ON' : '○ Mode demo: OFF');
    b.className = on ? 'on' : '';
    document.body.classList.toggle('dg-on', on);
  }
  document.getElementById('dgToggle').onclick = function () {
    on = !on;
    if (!forcedOff) lsSet('demoGuide:on', on ? '1' : '0');
    syncBar(); tick();
  };
  document.getElementById('dgReset').onclick = function () { done = {}; curId = null; on = true; syncBar(); tick(); };

  /* ---------- helpers ---------- */
  function resolve(t) {
    if (!t) return null;
    if (typeof t === 'function') return t();
    return document.querySelector(t);
  }
  function vis(el) {
    if (!el) return false;
    var r = el.getBoundingClientRect();
    if (r.width <= 0 || r.height <= 0) return false;
    return getComputedStyle(el).visibility !== 'hidden';
  }

  /* ---------- auto-isi password / PIN / kode ---------- */
  function fieldFor(el) {
    var fs = CFG.fields || [];
    for (var i = 0; i < fs.length; i++) if (el && el.matches && el.matches(fs[i].selector)) return fs[i];
    return null;
  }
  function typeOut(el, text) {
    typing = true;
    el.value = '';
    var i = 0;
    (function step() {
      if (i < text.length) {
        el.value = text.slice(0, ++i);
        el.dispatchEvent(new Event('input', { bubbles: true }));
        setTimeout(step, 70);
      } else {
        typing = false;
        tick();
      }
    })();
  }
  document.addEventListener('input', function (e) {
    if (!on || typing) return;
    var f = fieldFor(e.target);
    if (!f || e.target.value === f.value) return;
    typeOut(e.target, f.value);       // ketik apa saja -> terganti jadi nilai yang benar
  }, true);
  document.addEventListener('keydown', function (e) {
    if (!on || e.key !== 'Enter') return;
    var f = fieldFor(e.target);
    if (f && e.target.value !== f.value && !typing) e.target.value = f.value; // Enter di kolom kosong: isi dulu, lalu lanjut
  }, true);

  (CFG.fields || []).forEach(function (f) {
    var el = document.querySelector(f.selector);
    if (!el || !el.parentNode) return;
    var chip = document.createElement('div');
    chip.className = 'dg-chip';
    chip.innerHTML = '🔑 ' + f.label + ' &mdash; ketik apa saja, otomatis terisi. <u>Atau klik ini.</u>';
    chip.onclick = function () { if (!typing) { el.focus(); typeOut(el, f.value); } };
    el.parentNode.insertBefore(chip, el.nextSibling);
  });

  /* ---------- mesin panduan ---------- */
  document.addEventListener('click', function (e) {
    if (!on || !curStep || curStep.kind !== 'click' || !curEl) return;
    if (curEl.contains(e.target)) { done[curStep.id] = 1; setTimeout(tick, 150); }
  }, true);

  bubble.addEventListener('click', function (e) {
    var act = e.target && e.target.getAttribute && e.target.getAttribute('data-act');
    if (act && curStep) { done[curStep.id] = 1; curId = null; tick(); }
  });

  function place(step, el) {
    var changed = curId !== step.id;
    curId = step.id; curStep = step; curEl = el;
    var r = el.getBoundingClientRect();

    if (changed) {
      var out = r.top < 70 || r.bottom > window.innerHeight - 70;
      if (out) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      var hint = step.kind === 'click' ? '<div class="dg-hint">👆 Klik di sini</div>'
        : step.kind === 'type' ? '<div class="dg-hint">⌨️ Ketik apa saja</div>' : '';
      var btns = step.kind === 'info'
        ? '<div class="dg-a"><button data-act="next">Lanjut ›</button></div>'
        : '<div class="dg-a"><a data-act="skip">Lewati</a></div>';
      bubble.innerHTML = '<div class="dg-n">Panduan demo</div><div>' + step.text + '</div>' + hint + btns;
      var ring = cursor.querySelector('.dg-ring');
      ring.style.display = step.kind === 'info' ? 'none' : 'block';
    }

    var x = r.left + Math.min(r.width / 2, 70);
    var y = r.top + Math.min(r.height / 2, 30);
    cursor.style.transform = 'translate(' + Math.round(x) + 'px,' + Math.round(y) + 'px)';
    cursor.classList.add('show');

    var bw = bubble.offsetWidth || 270, bh = bubble.offsetHeight || 90;
    var W = window.innerWidth, H = window.innerHeight, bx, by;
    if (r.right + 18 + bw <= W - 10) {            // muat di kanan elemen: paling aman, tidak menutupi apa pun
      bx = r.right + 18; by = Math.max(8, Math.min(r.top, H - bh - 56));
    } else if (r.left - 18 - bw >= 10) {          // muat di kiri
      bx = r.left - 18 - bw; by = Math.max(8, Math.min(r.top, H - bh - 56));
    } else if (r.top - bh - 14 >= 8) {            // layar sempit: di atas elemen (tombol/isian di bawahnya tetap kelihatan)
      bx = Math.min(Math.max(8, r.left), W - bw - 10); by = r.top - bh - 14;
    } else {                                      // terakhir: di bawah elemen
      bx = Math.min(Math.max(8, r.left), W - bw - 10); by = Math.min(r.bottom + 14, H - bh - 56);
    }
    bubble.style.left = Math.round(bx) + 'px';
    bubble.style.top = Math.round(by) + 'px';
    bubble.classList.add('show');
  }

  function hide() {
    cursor.classList.remove('show');
    bubble.classList.remove('show');
    curId = null; curStep = null; curEl = null;
  }

  function tick() {
    if (!on) { hide(); return; }
    var rs = CFG.resetWhen ? !!CFG.resetWhen() : false;
    if (rs && !lastReset) { done = {}; curId = null; }
    lastReset = rs;

    var steps = CFG.steps || [];
    for (var i = 0; i < steps.length; i++) {
      var s = steps[i];
      if (done[s.id]) continue;
      if (s.doneWhen && s.doneWhen()) { done[s.id] = 1; continue; }
      if (s.show && !s.show()) continue;
      var el = resolve(s.target);
      if (!vis(el)) continue;
      place(s, el);
      return;
    }
    hide();
  }

  window.addEventListener('scroll', tick, { passive: true });
  window.addEventListener('resize', tick);
  setInterval(tick, 300);
  syncBar();
  setTimeout(tick, 400);
})();
