// Checkerboard theme transition.
// The old frame is captured, laid over the window as a mosaic of small tiles, and the theme is
// switched underneath. Tiles then crack apart, flip on their vertical axis in a wave that starts
// at the toggle, show a back face in the four mode colors, and shrink into dots that reveal the
// new mode. Alternate tiles start late, which keeps the PowerPoint checkerboard rhythm.

const easeIn = (t) => t * t * t;
const easeOut = (t) => 1 - Math.pow(1 - t, 3);
const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const raf = () => new Promise((r) => requestAnimationFrame(r));

export function createCheckerboard(canvas) {
  const ctx = canvas.getContext('2d');
  let busy = false;

  async function capture() {
    try {
      const url = await window.shell?.capture();
      if (!url) return null;
      const img = new Image();
      img.src = url;
      await img.decode();
      return img;
    } catch {
      return null;
    }
  }

  async function run({ origin, from, to, apply, hole }) {
    if (busy) return false;
    busy = true;
    const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const CELL = 22;
    const SPREAD = reduced ? 160 : 720;
    const STAGGER = reduced ? 0 : 110;
    const JITTER = reduced ? 40 : 120;
    const LIFE = reduced ? 220 : 520;
    const PRE = 0.22;

    const img = await capture();
    const W = window.innerWidth;
    const H = window.innerHeight;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const kx = img ? img.width / W : 1;
    const ky = img ? img.height / H : 1;

    if (img) ctx.drawImage(img, 0, 0, W, H);
    else {
      ctx.fillStyle = from.bg;
      ctx.fillRect(0, 0, W, H);
    }
    clearHole();
    canvas.classList.add('on');
    await raf();
    await raf();
    apply();

    const cols = Math.ceil(W / CELL);
    const rows = Math.ceil(H / CELL);
    const count = cols * rows;
    const delay = new Float32Array(count);
    const kind = new Uint8Array(count);
    const done = new Uint8Array(count);
    const maxD = Math.max(
      Math.hypot(origin.x, origin.y),
      Math.hypot(W - origin.x, origin.y),
      Math.hypot(origin.x, H - origin.y),
      Math.hypot(W - origin.x, H - origin.y),
    );
    let total = 0;
    for (let j = 0; j < rows; j++) {
      for (let i = 0; i < cols; i++) {
        const k = j * cols + i;
        const cx = i * CELL + CELL / 2;
        const cy = j * CELL + CELL / 2;
        const d = Math.hypot(cx - origin.x, cy - origin.y) / maxD;
        // Slight angular warble so the wave front reads as organic, not a perfect circle.
        const ang = Math.atan2(cy - origin.y, cx - origin.x);
        const warble = Math.sin(ang * 5 + d * 9) * 0.035;
        delay[k] = Math.max(0, d + warble) * SPREAD + ((i + j) % 2) * STAGGER + Math.random() * JITTER;
        const r = Math.random();
        // 0: old-mode ground dot, 1: accent tile, 2: new-mode ground (instant reveal)
        kind[k] = r < 0.5 ? 0 : r < 0.78 ? 1 : 2;
        total = Math.max(total, delay[k] + LIFE);
      }
    }

    const start = performance.now();
    await new Promise((resolve) => {
      function frame(now) {
        const t = now - start;
        for (let j = 0; j < rows; j++) {
          for (let i = 0; i < cols; i++) {
            const k = j * cols + i;
            if (done[k]) continue;
            const local = (t - delay[k]) / LIFE;
            if (local < -PRE) continue;
            const x = i * CELL;
            const y = j * CELL;
            ctx.clearRect(x, y, CELL, CELL);
            if (local >= 1) {
              done[k] = 1;
              continue;
            }
            drawCell(x, y, local, kind[k]);
          }
        }
        clearHole();
        if (t < total + 16) requestAnimationFrame(frame);
        else resolve();
      }
      requestAnimationFrame(frame);
    });

    canvas.classList.remove('on');
    ctx.clearRect(0, 0, W, H);
    busy = false;
    return true;

    // The control that started the transition stays live above the mosaic, so its own motion is
    // never replaced by a frozen frame.
    function clearHole() {
      if (!hole) return;
      ctx.save();
      ctx.beginPath();
      ctx.roundRect(hole.x, hole.y, hole.w, hole.h, hole.r ?? 0);
      ctx.clip();
      ctx.clearRect(hole.x, hole.y, hole.w, hole.h);
      ctx.restore();
    }

    function drawOld(x, y, w, h, sx, sy, sw, sh) {
      if (img) ctx.drawImage(img, sx * kx, sy * ky, sw * kx, sh * ky, x, y, w, h);
      else {
        ctx.fillStyle = from.bg;
        ctx.fillRect(x, y, w, h);
      }
    }

    function drawCell(x, y, local, kindOf) {
      const cx = x + CELL / 2;
      const cy = y + CELL / 2;
      if (local < 0) {
        // Crack: a hairline gap opens ahead of the wave.
        const g = (1 + local / PRE) * 0.9;
        drawOld(x + g, y + g, CELL - 2 * g, CELL - 2 * g, x + g, y + g, CELL - 2 * g, CELL - 2 * g);
        return;
      }
      if (local < 0.5) {
        // Front face turns away; the edge heats up in the destination accent.
        const a = easeIn(local / 0.5) * (Math.PI / 2);
        const c = Math.cos(a);
        const s = Math.sin(a);
        const w = Math.max(0.5, (CELL - 1.8) * c);
        const h = (CELL - 1.8) * (1 - 0.14 * s);
        drawOld(cx - w / 2, cy - h / 2, w, h, x + 0.9, y + 0.9, CELL - 1.8, CELL - 1.8);
        ctx.globalAlpha = Math.min(1, s * 1.1);
        ctx.fillStyle = to.accent;
        ctx.fillRect(cx - w / 2, cy - h / 2, w, h);
        ctx.globalAlpha = 1;
        return;
      }
      if (kindOf === 2) return;
      // Back face turns in, then contracts into a rounded dot and fades.
      const q = (local - 0.5) / 0.5;
      const open = easeOut(Math.min(q / 0.3, 1));
      const shrink = q < 0.3 ? 1 : 1 - easeInOut((q - 0.3) / 0.7);
      const size = (CELL - 1.8) * (0.86 + 0.14 * open) * shrink;
      const w = Math.max(0.5, size * open);
      const h = size;
      const rad = Math.min(w, h) * 0.5 * (1 - shrink) + 1.5;
      ctx.beginPath();
      ctx.roundRect(cx - w / 2, cy - h / 2, w, h, rad);
      if (kindOf === 1) {
        if (to.wire) {
          ctx.fillStyle = to.accentSoft;
          ctx.fill();
          ctx.lineWidth = 1.2;
          ctx.strokeStyle = to.accent;
          ctx.stroke();
        } else {
          ctx.fillStyle = to.accent;
          ctx.fill();
        }
      } else {
        ctx.fillStyle = from.bg;
        ctx.fill();
        if (from.wire) {
          ctx.lineWidth = 1;
          ctx.strokeStyle = from.accentFaint;
          ctx.stroke();
        }
      }
    }
  }

  return {
    run,
    get busy() {
      return busy;
    },
  };
}
