/* demo-guide.js — arahan saat mouse mendekati titik penting + auto-isi password untuk MODE DEMO presentasi.
 *
 * Tidak ada kursor palsu. Balon arahan baru muncul ketika mouse (atau jari) kamu mendekati/menunjuk
 * sebuah titik penting, dan hilang saat mouse menjauh.
 *
 * Dipakai oleh kedua dashboard lewat window.DEMO_GUIDE = { fields, steps }.
 *   steps[]  : { id, target (selector/fungsi), text, show (fungsi, opsional), kind ('click'|'type'|'info') }
 *   fields[] : { selector, value, label }  -> auto-isi saat mengetik apa saja di kolom itu
 *
 * Hanya untuk prototype. Saat disambung ke Apps Script / produksi: HAPUS tag <script> demo-guide.js
 * dan blok window.DEMO_GUIDE dari HTML, karena auto-isi membuka password ke siapa pun.
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
  var NEAR = 36;            // jarak (px) dari tepi elemen yang sudah dianggap "mengarah ke sana"
  var typing = false;
  var curId = null, curEl = null, hideTimer = null, showTimer = null;
  var px = -1, py = -1;

  /* ---------- styling ---------- */
  var css = [
    '.dg-bubble{position:fixed;z-index:99999;max-width:270px;background:#2A2420;color:#fff;',
    ' font:13px/1.45 system-ui,-apple-system,"Segoe UI",sans-serif;padding:10px 13px;border-radius:10px;',
    ' box-shadow:0 6px 22px rgba(0,0,0,.28);opacity:0;pointer-events:none;transition:opacity .18s ease}',
    '.dg-bubble.show{opacity:1}',
    '.dg-bubble .dg-hint{color:#f0a79f;font-size:12px;margin-top:5px}',
    '.dg-hl{outline:2px dashed #B23A2E !important;outline-offset:3px !important;}',
    '.dg-bar{position:fixed;left:12px;bottom:12px;z-index:99999;display:flex;gap:6px;',
    ' font:12px system-ui,-apple-system,"Segoe UI",sans-serif}',
    '.dg-bar button{background:#fff;color:#2A2420;border:1px solid #cfc8bd;border-radius:999px;padding:6px 12px;',
    ' cursor:pointer;box-shadow:0 2px 8px rgba(0,0,0,.12);font:inherit}',
    '.dg-bar button.on{background:#B23A2E;color:#fff;border-color:#B23A2E}',
    '.dg-chip{display:none;margin:8px 0 0;font:12px system-ui,sans-serif;color:#7A231C;background:#f6e4e1;',
    ' border:1px dashed #B23A2E;border-radius:7px;padding:6px 9px;cursor:pointer;text-align:left}',
    'body.dg-on .dg-chip{display:block}',
    '@media print{.dg-bubble,.dg-bar,.dg-chip{display:none!important}}'
  ].join('');
  var st = document.createElement('style');
  st.textContent = css;
  document.head.appendChild(st);

  /* ---------- elemen ---------- */
  var bubble = document.createElement('div');
  bubble.className = 'dg-bubble';
  var bar = document.createElement('div');
  bar.className = 'dg-bar';
  bar.innerHTML = '<button id="dgToggle"></button>';
  document.body.appendChild(bubble);
  document.body.appendChild(bar);

  function syncBar() {
    var b = document.getElementById('dgToggle');
    b.textContent = on ? '● Mode demo: ON' : '○ Mode demo: OFF';
    b.className = on ? 'on' : '';
    document.body.classList.toggle('dg-on', on);
  }
  document.getElementById('dgToggle').onclick = function () {
    on = !on;
    if (!forcedOff) lsSet('demoGuide:on', on ? '1' : '0');
    syncBar();
    if (!on) clearHint(true);
  };

  /* ---------- helpers ---------- */
  function resolve(t) {
    if (!t) return null;
    return typeof t === 'function' ? t() : document.querySelector(t);
  }
  function vis(el) {
    if (!el) return false;
    var r = el.getBoundingClientRect();
    if (r.width <= 0 || r.height <= 0) return false;
    return getComputedStyle(el).visibility !== 'hidden';
  }
  function distTo(r, x, y) {            // jarak titik ke persegi (0 kalau di dalam)
    var dx = Math.max(r.left - x, 0, x - r.right);
    var dy = Math.max(r.top - y, 0, y - r.bottom);
    return Math.sqrt(dx * dx + dy * dy);
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

  /* ---------- arahan berdasarkan posisi mouse ---------- */
  function findHotspot(x, y) {
    var steps = CFG.steps || [], best = null, bestD = 1e9, bestA = 1e12;
    for (var i = 0; i < steps.length; i++) {
      var s = steps[i];
      if (s.show && !s.show()) continue;
      var el = resolve(s.target);
      if (!vis(el)) continue;
      var r = el.getBoundingClientRect();
      var d = distTo(r, x, y);
      if (d > NEAR) continue;
      var a = r.width * r.height;
      if (d < bestD || (d === bestD && a < bestA)) { best = { s: s, el: el }; bestD = d; bestA = a; }
    }
    return best;
  }

  function placeBubble(el) {
    var r = el.getBoundingClientRect();
    var W = window.innerWidth, H = window.innerHeight;
    var bw = bubble.offsetWidth || 270, bh = bubble.offsetHeight || 80, bx, by;
    if (r.right + 16 + bw <= W - 10) { bx = r.right + 16; by = Math.max(8, Math.min(r.top, H - bh - 56)); }
    else if (r.left - 16 - bw >= 10) { bx = r.left - 16 - bw; by = Math.max(8, Math.min(r.top, H - bh - 56)); }
    else if (r.top - bh - 12 >= 8)   { bx = Math.min(Math.max(8, r.left), W - bw - 10); by = r.top - bh - 12; }
    else                             { bx = Math.min(Math.max(8, r.left), W - bw - 10); by = Math.min(r.bottom + 12, H - bh - 56); }
    bubble.style.left = Math.round(bx) + 'px';
    bubble.style.top = Math.round(by) + 'px';
  }

  function showHint(h) {
    if (curEl && curEl !== h.el) curEl.classList.remove('dg-hl');
    curId = h.s.id; curEl = h.el;
    var cue = h.s.kind === 'click' ? '<div class="dg-hint">👆 Klik</div>'
            : h.s.kind === 'type'  ? '<div class="dg-hint">⌨️ Ketik apa saja</div>' : '';
    bubble.innerHTML = '<div>' + h.s.text + '</div>' + cue;
    h.el.classList.add('dg-hl');
    placeBubble(h.el);
    bubble.classList.add('show');
  }

  function clearHint(now) {
    clearTimeout(showTimer); showTimer = null;
    var doIt = function () {
      bubble.classList.remove('show');
      if (curEl) curEl.classList.remove('dg-hl');
      curId = null; curEl = null;
    };
    if (now) { clearTimeout(hideTimer); hideTimer = null; doIt(); return; }
    if (!hideTimer) hideTimer = setTimeout(function () { hideTimer = null; doIt(); }, 140);
  }

  var lastEval = 0, evalTimer = null;
  function schedule() {                       // throttle ~40 ms; tidak pakai requestAnimationFrame (terhenti di tab background)
    var now = Date.now();
    if (now - lastEval >= 40) { evaluate(); return; }
    if (!evalTimer) evalTimer = setTimeout(function () { evalTimer = null; evaluate(); }, 40);
  }
  function evaluate() {
    lastEval = Date.now();
    if (!on || px < 0) { clearHint(true); return; }
    var h = findHotspot(px, py);
    if (!h) { clearHint(false); return; }
    clearTimeout(hideTimer); hideTimer = null;
    if (h.s.id === curId) { placeBubble(h.el); return; }       // masih titik yang sama
    clearTimeout(showTimer);                                     // jeda singkat supaya tidak berkedip saat mouse lewat
    showTimer = setTimeout(function () {
      var again = findHotspot(px, py);
      if (again) showHint(again);
    }, 160);
  }

  function onMove(e) {
    px = e.clientX; py = e.clientY;
    schedule();
  }
  document.addEventListener('pointermove', onMove, { passive: true });
  document.addEventListener('pointerdown', onMove, { passive: true });   // layar sentuh: sentuh titiknya, arahan muncul
  document.documentElement.addEventListener('mouseleave', function () { px = -1; clearHint(false); });
  window.addEventListener('scroll', schedule, { passive: true });
  window.addEventListener('resize', function () { if (curEl) placeBubble(curEl); });
  // Saat layar berganti (login -> daftar proyek -> workspace) hotspot lama harus hilang meski mouse diam.
  setInterval(function () { if (on && (curId || px >= 0)) schedule(); }, 400);

  syncBar();
})();
