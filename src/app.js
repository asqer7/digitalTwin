import { createScene } from './scene.js';
import { createCheckerboard } from './transition.js';
import { Spring } from './spring.js';

const $ = (s) => document.querySelector(s);
const app = $('#app');
const html = document.documentElement;
const shell = window.shell ?? {};

const THEMES = {
  solid: { bg: '#F0EEE6', accent: '#D97757', accentSoft: 'rgba(217,119,87,0.22)', accentFaint: 'rgba(217,119,87,0.4)', wire: false },
  wire: { bg: '#030606', accent: '#19F5DC', accentSoft: 'rgba(25,245,220,0.14)', accentFaint: 'rgba(25,245,220,0.35)', wire: true },
};

const scene = createScene($('#gl'));
const fx = createCheckerboard($('#fx'));
let mode = 'solid';
let screen = 'landing';
let selected = null;

/* Window controls */
$('#w-min').onclick = () => shell.minimize?.();
$('#w-max').onclick = () => shell.maximize?.();
$('#w-close').onclick = () => (shell.close ? shell.close() : window.close());
shell.onMaximize?.((max) => {
  $('#w-max use').setAttribute('href', max ? '#i-restore' : '#i-max');
  $('#w-max').setAttribute('aria-label', max ? 'Restore' : 'Maximize');
});

/* View mode */
function applyMode(next) {
  html.dataset.theme = next;
  scene.setTheme(next);
  shell.setBackground?.(THEMES[next].bg);
}

// The thumb's two edges are separate springs. The leading edge is stiffer than the trailing one,
// so the pill stretches toward its destination, then the tail catches up with a small overshoot.
const seg = $('#mode');
const thumb = seg.querySelector('.seg-thumb');
const segHi = seg.querySelector('.seg-hi');
segHi.innerHTML = [...seg.querySelectorAll('button')].map((b) => `<span>${b.innerHTML}</span>`).join('');
const edgeL = new Spring(0);
const edgeR = new Spring(0);
const squish = new Spring(1, { stiffness: 520, damping: 20 });
let segRaf = 0;
let segLast = 0;

function segTo(m, instant = false) {
  const b = seg.querySelector(`[data-mode="${m}"]`);
  const l = b.offsetLeft;
  const r = l + b.offsetWidth;
  const [lead, trail] = l > edgeL.t ? [edgeR, edgeL] : [edgeL, edgeR];
  Object.assign(lead, { k: 560, c: 32 });
  Object.assign(trail, { k: 200, c: 21 });
  edgeL.t = l;
  edgeR.t = r;
  if (instant) {
    edgeL.set(l);
    edgeR.set(r);
  }
  kickSeg();
}

function kickSeg() {
  if (segRaf) return;
  segLast = performance.now();
  segRaf = requestAnimationFrame(stepSeg);
}

function stepSeg(now) {
  const dt = Math.min((now - segLast) / 1000, 1 / 30);
  segLast = now;
  const l = edgeL.step(dt);
  const r = edgeR.step(dt);
  const q = squish.step(dt);
  thumb.style.width = `${(r - l).toFixed(2)}px`;
  thumb.style.transform = `translateX(${l.toFixed(2)}px) scaleY(${q.toFixed(4)})`;
  segHi.style.setProperty('--hl', `${(l - 3).toFixed(2)}px`);
  segHi.style.setProperty('--hr', `${(segHi.clientWidth - (r - 3)).toFixed(2)}px`);
  segRaf = edgeL.resting && edgeR.resting && squish.resting ? 0 : requestAnimationFrame(stepSeg);
}

async function setMode(next, originEl) {
  if (next === mode || fx.busy) return;
  const from = THEMES[mode];
  mode = next;
  app.dataset.mode = next;
  document.querySelectorAll('#mode button').forEach((b) => b.setAttribute('aria-checked', String(b.dataset.mode === next)));
  segTo(next);
  const r = (originEl ?? $(`#mode [data-mode="${next}"]`)).getBoundingClientRect();
  const h = seg.getBoundingClientRect();
  await fx.run({
    origin: { x: r.left + r.width / 2, y: r.top + r.height / 2 },
    from,
    to: THEMES[next],
    apply: () => applyMode(next),
    hole: { x: h.left, y: h.top, w: h.width, h: h.height, r: 11 },
  });
}

seg.querySelectorAll('button').forEach((b) => {
  b.addEventListener('click', () => setMode(b.dataset.mode, b));
  b.addEventListener('pointerdown', () => {
    squish.t = 0.86;
    kickSeg();
  });
});
window.addEventListener('pointerup', () => {
  if (squish.t !== 1) {
    squish.t = 1;
    kickSeg();
  }
});
document.fonts.ready.then(() => segTo(mode, true));
window.addEventListener('resize', () => segTo(mode, true));
segTo(mode, true);

/* Assembly tree and inspector */
const tree = $('#tree');
const groups = {};
scene.parts.forEach((p, i) => {
  if (!groups[p.group]) {
    const g = document.createElement('div');
    g.className = 'tree-group';
    g.innerHTML = `<div class="tree-gh">${p.group}</div>`;
    tree.append(g);
    groups[p.group] = g;
  }
  const row = document.createElement('button');
  row.className = 'tree-row';
  row.dataset.id = p.id;
  row.innerHTML = `<i class="sw"></i><span class="nm">${p.name}</span><span class="id">P-${String(i + 1).padStart(2, '0')}</span>`;
  row.addEventListener('click', () => choosePart(p.id));
  row.addEventListener('pointerenter', () => scene.highlight(p.id));
  row.addEventListener('pointerleave', () => scene.highlight(null));
  groups[p.group].append(row);
});
$('#part-count').textContent = String(scene.parts.length);

const MATERIAL = { shell: 'AlMg3', frame: 'S235JR', core: 'PA6 GF30', board: 'FR-4' };
const DENSITY = { shell: 2.66, frame: 7.85, core: 1.36, board: 1.85 };
const UNIT = 250; // mm per scene unit

function camel(s) {
  return s.replace(/\b\w/g, (c) => c.toUpperCase()).replace(/\s+/g, '');
}

function renderInspector() {
  const p = scene.parts.find((x) => x.id === selected);
  let rows;
  if (!p) {
    $('#ins-title').textContent = 'Assembly';
    $('#ins-id').textContent = 'AAS-0001';
    rows = [
      ['idShort', 'CubeAssembly'],
      ['Parts', String(scene.parts.length)],
      ['Envelope', '500 x 500 x 500 mm'],
      ['Mass', '41.80 kg'],
      ['Submodels', '4'],
      ['Revision', 'R 1.2'],
    ];
  } else {
    const i = scene.parts.indexOf(p);
    const [w, h, d] = p.size.map((v) => v * UNIT);
    const mass = (w * h * d * 1e-6 * DENSITY[p.kind]) * (p.kind === 'core' ? 0.35 : 1);
    $('#ins-title').textContent = p.name;
    $('#ins-id').textContent = `P-${String(i + 1).padStart(2, '0')}`;
    rows = [
      ['idShort', camel(p.name)],
      ['Group', p.group],
      ['Size', `${w.toFixed(0)} x ${h.toFixed(0)} x ${d.toFixed(0)} mm`],
      ['Mass', `${mass.toFixed(2)} kg`],
      ['Material', MATERIAL[p.kind]],
      ['Revision', 'R 1.2'],
    ];
  }
  $('#props').innerHTML = rows.map(([k, v]) => `<dt>${k}</dt><dd class="swap" title="${v}">${v}</dd>`).join('');
  measurePanels();
}

function selectPart(id) {
  selected = id;
  scene.select(id);
  document.querySelectorAll('.tree-row').forEach((r) => r.classList.toggle('active', r.dataset.id === id));
  for (const key in cards) cards[key].el.classList.toggle('active', cards[key].part === id);
  renderInspector();
}

// Selecting a part from the tree, a card or the model turns that part toward the viewer.
// Selecting the same part again, or empty space, returns the camera to where it was.
function choosePart(id) {
  if (screen !== 'model') return;
  if (!id || (id === selected && scene.focused)) {
    selectPart(null);
    setFocusState(false);
    return;
  }
  selectPart(id);
  setFocusState(true);
}

scene.hooks.onPick = choosePart;
scene.hooks.onHover = (id) => {
  document.querySelectorAll('.tree-row').forEach((r) => r.classList.toggle('hover', r.dataset.id === id));
};

/* Dock */
function setFocusState(on) {
  if (on) scene.focus(selected);
  else scene.unfocus();
  $('#focus').setAttribute('aria-pressed', String(on));
}
function toggleExplode() {
  const on = !scene.exploded;
  scene.setExploded(on);
  $('#explode').setAttribute('aria-pressed', String(on));
}
$('#explode').onclick = toggleExplode;
$('#focus').onclick = () => setFocusState(!scene.focused);
$('#reset').onclick = () => {
  scene.resetView();
  $('#focus').setAttribute('aria-pressed', 'false');
};

/* Cards and leader lines */
const leaders = $('#leaders');
const cardLayer = $('#cards');
const CARD_LAYOUT = {
  top: { dir: [0.5, -1], len: 104, run: 46, side: 1, title: 'Placeholder Title', sub: 'Placeholder value 00.0' },
  left: { dir: [-1, 0.58], len: 92, run: 46, side: -1, title: 'Placeholder Title', sub: 'Placeholder value 00.0' },
  front: { dir: [1, 0.66], len: 92, run: 46, side: 1, title: 'Placeholder Title', sub: 'Placeholder value 00.0' },
};
const SVGNS = 'http://www.w3.org/2000/svg';
const cards = {};
for (const key in CARD_LAYOUT) {
  const c = CARD_LAYOUT[key];
  const el = document.createElement('div');
  el.className = 'card';
  el.innerHTML = `<div class="glass" style="--ox:${c.side > 0 ? '0%' : '100%'}"><span class="bleed"></span><div class="card-t">${c.title}</div><div class="card-s">${c.sub}</div></div>`;
  cardLayer.append(el);
  const g = document.createElementNS(SVGNS, 'g');
  g.setAttribute('class', 'leader');
  g.innerHTML = '<path pathLength="1"/><circle class="halo" r="4"/><circle class="dot" r="3.4"/><circle class="end" r="2.6"/>';
  leaders.append(g);
  const anchorPart = { top: 'top', left: 'pz', front: 'px' }[key];
  const glass = el.querySelector('.glass');
  cards[key] = { el, glass, g, path: g.querySelector('path'), dots: g.querySelectorAll('circle'), part: anchorPart, w: 0, h: 0, ...c };
  glass.addEventListener('click', () => choosePart(anchorPart));
  glass.addEventListener('pointerenter', () => scene.highlight(anchorPart));
  glass.addEventListener('pointermove', (e) => {
    const r = glass.getBoundingClientRect();
    glass.style.setProperty('--mx', `${e.clientX - r.left}px`);
    glass.style.setProperty('--my', `${e.clientY - r.top}px`);
  });
  glass.addEventListener('pointerleave', () => {
    scene.highlight(null);
    glass.style.removeProperty('--mx');
    glass.style.removeProperty('--my');
  });
}

function measureCards() {
  for (const key in cards) {
    cards[key].w = cards[key].el.offsetWidth;
    cards[key].h = cards[key].el.offsetHeight;
  }
}

// Lens map for the glass: neutral grey inside, and toward the rim red and green encode an inward
// offset, so the backdrop near the edge is pulled in like light through a thick rounded pane.
function buildLens(w, h, radius = 16, bezel = 20) {
  const cv = document.createElement('canvas');
  cv.width = w;
  cv.height = h;
  const ctx = cv.getContext('2d');
  const img = ctx.createImageData(w, h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const px = x + 0.5;
      const py = y + 0.5;
      const qx = Math.min(Math.max(px, radius), w - radius);
      const qy = Math.min(Math.max(py, radius), h - radius);
      const dx = px - qx;
      const dy = py - qy;
      let d;
      let nx = 0;
      let ny = 0;
      if (dx !== 0 && dy !== 0) {
        const l = Math.hypot(dx, dy);
        d = radius - l;
        nx = dx / l;
        ny = dy / l;
      } else {
        d = Math.min(px, w - px, py, h - py);
        if (d === px) nx = -1;
        else if (d === w - px) nx = 1;
        else if (d === py) ny = -1;
        else ny = 1;
      }
      const t = Math.max(0, 1 - d / bezel);
      const m = t * t;
      const i = (y * w + x) * 4;
      img.data[i] = 128 - nx * m * 127;
      img.data[i + 1] = 128 - ny * m * 127;
      img.data[i + 2] = 128;
      img.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  const url = cv.toDataURL();
  const channel = (r, g, b) => `${r} 0 0 0 0  0 ${g} 0 0 0  0 0 ${b} 0 0  0 0 0 1 0`;
  const pass = (scale, mask, name) =>
    `<feDisplacementMap in="SourceGraphic" in2="map" scale="${scale}" xChannelSelector="R" yChannelSelector="G" result="d${name}"/>` +
    `<feColorMatrix in="d${name}" type="matrix" values="${channel(...mask)}" result="${name}"/>`;
  const old = document.getElementById('lens');
  if (old) old.remove();
  const defs = document.querySelector('svg[aria-hidden]');
  defs.insertAdjacentHTML(
    'beforeend',
    `<filter id="lens" x="0" y="0" width="${w}" height="${h}" filterUnits="userSpaceOnUse" primitiveUnits="userSpaceOnUse" color-interpolation-filters="sRGB">` +
      `<feImage href="${url}" x="0" y="0" width="${w}" height="${h}" preserveAspectRatio="none" result="map"/>` +
      pass(46, [1, 0, 0], 'r') +
      pass(39, [0, 1, 0], 'g') +
      pass(32, [0, 0, 1], 'b') +
      `<feBlend in="r" in2="g" mode="screen" result="rg"/><feBlend in="rg" in2="b" mode="screen"/></filter>`,
  );
  html.classList.add('lens');
}

document.fonts.ready.then(() => {
  measureCards();
  const c = Object.values(cards)[0];
  buildLens(c.glass.offsetWidth, c.glass.offsetHeight);
});
window.addEventListener('resize', measureCards);
measureCards();

function showCards(on) {
  Object.values(cards).forEach((c, i) => {
    setTimeout(() => {
      c.el.classList.toggle('in', on);
      c.g.classList.toggle('in', on);
    }, on ? i * 120 : 0);
  });
}

const smooth = (a, b, x) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

function layoutCards() {
  const anchors = scene.computeAnchors();
  const k = Math.min(1.5, Math.max(0.8, Math.sqrt(scene.stats().zoom)));
  for (const key in cards) {
    const c = cards[key];
    const a = anchors[key];
    const len = Math.hypot(...c.dir);
    const ex = a.x + (c.dir[0] / len) * c.len * k;
    const ey = a.y + (c.dir[1] / len) * c.len * k;
    const cx = ex + c.side * c.run;
    c.path.setAttribute('d', `M${a.x.toFixed(1)} ${a.y.toFixed(1)}L${ex.toFixed(1)} ${ey.toFixed(1)}L${cx.toFixed(1)} ${ey.toFixed(1)}`);
    c.dots[0].setAttribute('cx', a.x);
    c.dots[0].setAttribute('cy', a.y);
    c.dots[1].setAttribute('cx', a.x);
    c.dots[1].setAttribute('cy', a.y);
    c.dots[2].setAttribute('cx', cx);
    c.dots[2].setAttribute('cy', ey);
    const left = c.side > 0 ? cx + 6 : cx - 6 - c.w;
    c.el.style.transform = `translate3d(${left.toFixed(1)}px, ${(ey - c.h / 2).toFixed(1)}px, 0)`;
    const vis = a.visible ? smooth(-0.08, 0.3, a.facing) : 0;
    c.el.style.setProperty('--vis', vis.toFixed(3));
    c.glass.style.pointerEvents = vis > 0.5 ? '' : 'none';
    c.g.style.opacity = vis;
  }
}

/* Panels: collapse to their header so the toggle never moves */
const range = document.createRange();
function measurePanels() {
  for (const panel of document.querySelectorAll('.panel')) {
    const head = panel.querySelector('.panel-head');
    const cs = getComputedStyle(head);
    const kids = [...head.children];
    const widths = kids.map((k) => {
      if (k.tagName !== 'H2') return k.offsetWidth;
      range.selectNodeContents(k);
      return Math.min(220, range.getBoundingClientRect().width);
    });
    const w = widths.reduce((a, b) => a + b, 0) + parseFloat(cs.columnGap || 8) * (kids.length - 1) + parseFloat(cs.paddingLeft) + parseFloat(cs.paddingRight) + 2;
    panel.style.setProperty('--cw', `${Math.ceil(w)}px`);
  }
  const right = $('#panel-right');
  const openH = right.querySelector('.panel-head').offsetHeight + right.querySelector('.panel-body').scrollHeight + 2;
  right.style.setProperty('--open-h', `${openH}px`);
}

function togglePanel(side, force) {
  const panel = $(`#panel-${side}`);
  const collapse = force ?? !panel.classList.contains('collapsed');
  measurePanels();
  panel.classList.toggle('collapsed', collapse);
  const btn = panel.querySelector('.panel-tog');
  btn.setAttribute('aria-expanded', String(!collapse));
  const name = side === 'left' ? 'assembly' : 'inspector';
  btn.setAttribute('aria-label', `${collapse ? 'Expand' : 'Collapse'} ${name} panel`);
}

document.querySelectorAll('.panel-tog').forEach((b) => b.addEventListener('click', () => togglePanel(b.dataset.panel)));
document.querySelectorAll('.panel').forEach((panel) => {
  panel.querySelector('.panel-head').addEventListener('click', (e) => {
    if (panel.classList.contains('collapsed') && !e.target.closest('.panel-tog')) togglePanel(panel.id.replace('panel-', ''), false);
  });
});
document.fonts.ready.then(measurePanels);

/* Status bar */
let frames = 0;
let lastStat = performance.now();
let fps = 60;
scene.onFrame(() => {
  layoutCards();
  frames++;
  const now = performance.now();
  if (now - lastStat > 250) {
    fps = Math.round((frames * 1000) / (now - lastStat));
    frames = 0;
    lastStat = now;
    const s = scene.stats();
    $('#sb-az').textContent = `${s.az.toFixed(1)}°`;
    $('#sb-el').textContent = `${s.el.toFixed(1)}°`;
    $('#sb-zoom').textContent = `${s.zoom.toFixed(2)}x`;
    $('#sb-fps').textContent = String(fps);
  }
});

/* Live metric */
const series = Array.from({ length: 60 }, (_, i) => 41 + Math.sin(i / 6) * 0.9 + Math.random() * 0.4);
function drawSpark() {
  const min = Math.min(...series) - 0.4;
  const max = Math.max(...series) + 0.4;
  const pts = series.map((v, i) => [(i / (series.length - 1)) * 260, 60 - ((v - min) / (max - min)) * 54]);
  const line = pts.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join('');
  $('#spark-line').setAttribute('d', line);
  $('#spark-area').setAttribute('d', `${line}L260 64L0 64Z`);
  const end = pts[pts.length - 1];
  $('#spark-dot').setAttribute('cx', end[0]);
  $('#spark-dot').setAttribute('cy', end[1]);
  $('#metric-val').textContent = series[series.length - 1].toFixed(1);
}
setInterval(() => {
  const last = series[series.length - 1];
  series.push(Math.min(45, Math.max(37, last + (Math.random() - 0.48) * 0.6 + (41 - last) * 0.05)));
  series.shift();
  drawSpark();
}, 1000);
drawSpark();

/* Screens */
function setScreen(next) {
  screen = next;
  app.dataset.screen = next;
  $('#back').disabled = next === 'landing';
}

$('#back').onclick = () => {
  if (screen !== 'model') return;
  showCards(false);
  scene.outro();
  selectPart(null);
  setFocusState(false);
  setScreen('landing');
  $('#sb-model').textContent = 'No model';
  $('#sb-model-dot').className = 'dot';
  $('#sb-data').textContent = 'No data';
  $('#sb-data-dot').className = 'dot';
  setTimeout(() => $('#drop').classList.remove('loading', 'loaded'), 200);
};

/* Landing: drop, browse, mock loading */
const drop = $('#drop');
const edges = drop.querySelectorAll('.edges path');
const STEPS = ['Reading package', 'Parsing shells', 'Resolving submodels', 'Building geometry', 'Linking data points'];
let loading = false;

function startLoading(name) {
  if (loading || screen !== 'landing') return;
  loading = true;
  drop.classList.add('loading');
  $('#load-file').textContent = name;
  $('#sb-model').textContent = name;
  $('#sb-model-dot').className = 'dot busy';
  const DURATION = 2900;
  const t0 = performance.now();
  // Uneven progress so it reads like real parsing: quick start, a stall on submodels, a fast finish.
  const shape = (x) => (x < 0.35 ? x * 1.4 : x < 0.62 ? 0.49 + (x - 0.35) * 0.55 : 0.6385 + (x - 0.62) * 0.951);
  function tick(now) {
    const x = Math.min(1, (now - t0) / DURATION);
    const p = Math.min(1, shape(x));
    $('#load-bar').style.transform = `scaleX(${p})`;
    $('#load-pct').textContent = `${Math.round(p * 100)}%`;
    $('#load-step').textContent = STEPS[Math.min(STEPS.length - 1, Math.floor(p * STEPS.length))];
    edges.forEach((e, i) => e.style.setProperty('--e', Math.min(1, Math.max(0, p * edges.length * 1.15 - i)).toFixed(3)));
    if (x < 1) requestAnimationFrame(tick);
    else finishLoading(name);
  }
  requestAnimationFrame(tick);
}

function finishLoading(name) {
  drop.classList.add('loaded');
  $('#load-step').textContent = 'Ready';
  setTimeout(() => {
    $('#crumb-file').textContent = name;
    $('#sb-model-dot').className = 'dot on';
    setScreen('model');
    scene.intro();
    renderInspector();
    setTimeout(() => {
      measureCards();
      showCards(true);
    }, 950);
    loading = false;
  }, 420);
}

$('#browse').addEventListener('click', (e) => {
  e.stopPropagation();
  $('#file').click();
});
drop.addEventListener('click', () => !loading && $('#file').click());
drop.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' || e.key === ' ') {
    e.preventDefault();
    $('#file').click();
  }
});
$('#file').addEventListener('change', (e) => {
  const f = e.target.files[0];
  if (f) handleFile(f.name);
  e.target.value = '';
});

/* Model screen: mock data binding */
let binding = false;
function bindData(name) {
  if (binding) return;
  binding = true;
  const toast = $('#toast');
  toast.classList.remove('done');
  $('#toast-name').textContent = name;
  toast.classList.add('show');
  $('#sb-data').textContent = name;
  $('#sb-data-dot').className = 'dot busy';
  const t0 = performance.now();
  const D = 1700;
  function tick(now) {
    const x = Math.min(1, (now - t0) / D);
    const p = 1 - Math.pow(1 - x, 2.2);
    $('#toast-bar').style.transform = `scaleX(${p})`;
    $('#toast-pct').textContent = `${Math.round(p * 100)}%`;
    if (x < 1) return requestAnimationFrame(tick);
    toast.classList.add('done');
    $('#sb-data-dot').className = 'dot on';
    scene.ping();
    Object.values(cards).forEach((c, i) =>
      setTimeout(() => {
        c.el.classList.remove('refresh');
        void c.el.offsetWidth;
        c.el.classList.add('refresh');
      }, i * 90),
    );
    setTimeout(() => {
      toast.classList.remove('show');
      binding = false;
    }, 1500);
  }
  requestAnimationFrame(tick);
}

function handleFile(name) {
  if (screen === 'landing') startLoading(name || 'model.aasx');
  else bindData(name || 'data.json');
}

// Whole-window drag and drop. Contents are never read; only the name is shown.
let dragDepth = 0;
window.addEventListener('dragenter', (e) => {
  e.preventDefault();
  if (++dragDepth === 1) document.body.classList.add('dragging');
});
window.addEventListener('dragleave', (e) => {
  e.preventDefault();
  if (--dragDepth <= 0) {
    dragDepth = 0;
    document.body.classList.remove('dragging');
  }
});
window.addEventListener('dragover', (e) => {
  e.preventDefault();
  if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy';
});
window.addEventListener('drop', (e) => {
  e.preventDefault();
  dragDepth = 0;
  document.body.classList.remove('dragging');
  const f = e.dataTransfer?.files?.[0];
  handleFile(f?.name);
});

/* Keyboard */
window.addEventListener('keydown', (e) => {
  if (e.target.closest?.('input')) return;
  const k = e.key.toLowerCase();
  if (k === 'v') setMode(mode === 'solid' ? 'wire' : 'solid');
  if (screen !== 'model') return;
  if (k === '[') togglePanel('left');
  if (k === ']') togglePanel('right');
  if (k === 'e') toggleExplode();
  if (k === 'f') setFocusState(!scene.focused);
  if (k === 'r') $('#reset').click();
  if (k === 'escape') {
    selectPart(null);
    setFocusState(false);
  }
});

app.dataset.mode = mode;
applyMode(mode);
renderInspector();

// Handle for scripted screenshots during development.
window.__app = { setMode, startLoading, toggleExplode, choosePart, togglePanel, bindData, scene };
