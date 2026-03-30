import type { CanvasController } from '../core/canvas';
import { dbg, dbgWarn } from './debug-overlay';

// Cached canvas state to avoid destroying/recreating backing stores every frame
let hCtx: CanvasRenderingContext2D | null = null;
let vCtx: CanvasRenderingContext2D | null = null;
let hCachedW = 0, hCachedH = 0;
let vCachedW = 0, vCachedH = 0;
let rulerRafId = 0;
let pendingCanvas: CanvasController | null = null;
let rulerDrawCount = 0;

// Context loss recovery
let contextLossHandlersInstalled = false;
function installContextLossHandlers(): void {
  if (contextLossHandlersInstalled) return;
  contextLossHandlersInstalled = true;

  for (const id of ['ruler-h', 'ruler-v']) {
    const el = document.getElementById(id) as HTMLCanvasElement | null;
    if (!el) continue;
    el.addEventListener('contextlost', (e) => {
      e.preventDefault(); // allow restoration
      console.warn(`[SVGMaker] Canvas context lost: ${id}`);
      if (id === 'ruler-h') hCtx = null;
      else vCtx = null;
    });
    el.addEventListener('contextrestored', () => {
      console.info(`[SVGMaker] Canvas context restored: ${id}`);
      if (id === 'ruler-h') { hCtx = null; hCachedW = 0; hCachedH = 0; }
      else { vCtx = null; vCachedW = 0; vCachedH = 0; }
      if (pendingCanvas) drawRulersImmediate(pendingCanvas);
    });
  }
}

export function drawRulers(canvas: CanvasController): void {
  installContextLossHandlers();
  pendingCanvas = canvas;
  if (rulerRafId) return; // already scheduled
  rulerRafId = requestAnimationFrame(() => {
    rulerRafId = 0;
    if (pendingCanvas) drawRulersImmediate(pendingCanvas);
  });
}

function drawRulersImmediate(canvas: CanvasController): void {
  rulerDrawCount++;
  if (rulerDrawCount % 30 === 0) {
    const vb = canvas.getViewBox();
    dbg(`rulers draw #${rulerDrawCount} vb=${vb.x.toFixed(0)},${vb.y.toFixed(0)},${vb.w.toFixed(0)},${vb.h.toFixed(0)} zoom=${canvas.getZoom().toFixed(3)}`);
  }
  drawHorizontalRuler(canvas);
  drawVerticalRuler(canvas);
}

function drawHorizontalRuler(canvas: CanvasController): void {
  const rulerEl = document.getElementById('ruler-h') as HTMLCanvasElement;
  if (!rulerEl || rulerEl.classList.contains('hidden')) return;

  const rect = rulerEl.getBoundingClientRect();
  const w = Math.round(rect.width * window.devicePixelRatio);
  const h = Math.round(rect.height * window.devicePixelRatio);
  if (w === 0 || h === 0) return;

  // Only resize the canvas when dimensions actually change
  if (w !== hCachedW || h !== hCachedH) {
    dbg(`ruler-h RESIZE: ${hCachedW}x${hCachedH} -> ${w}x${h} (css=${rect.width.toFixed(0)}x${rect.height.toFixed(0)} dpr=${window.devicePixelRatio})`);
    rulerEl.width = w;
    rulerEl.height = h;
    hCachedW = w;
    hCachedH = h;
    hCtx = null; // force new context after resize
  }

  if (!hCtx) {
    hCtx = rulerEl.getContext('2d');
    if (!hCtx) {
      dbgWarn('ruler-h: getContext returned NULL');
      return;
    }
    hCtx.scale(window.devicePixelRatio, window.devicePixelRatio);
  }

  const ctx = hCtx;
  ctx.clearRect(0, 0, rect.width, rect.height);

  const vb = canvas.getViewBox();
  const zoom = canvas.getZoom();

  ctx.fillStyle = '#3c3c3c';
  ctx.fillRect(0, 0, rect.width, rect.height);

  ctx.fillStyle = '#999';
  ctx.strokeStyle = '#666';
  ctx.font = '9px sans-serif';
  ctx.textAlign = 'center';

  const step = getStep(zoom);
  const startX = Math.floor(vb.x / step) * step;

  for (let x = startX; x < vb.x + vb.w; x += step) {
    const screenX = (x - vb.x) * zoom;
    ctx.beginPath();
    ctx.moveTo(screenX, rect.height);
    const isMajor = Math.abs(x % (step * 5)) < 0.5;
    const tickH = isMajor ? 10 : 5;
    ctx.lineTo(screenX, rect.height - tickH);
    ctx.stroke();

    if (isMajor) {
      ctx.fillText(String(Math.round(x)), screenX, 10);
    }
  }
}

function drawVerticalRuler(canvas: CanvasController): void {
  const rulerEl = document.getElementById('ruler-v') as HTMLCanvasElement;
  if (!rulerEl || rulerEl.classList.contains('hidden')) return;

  const rect = rulerEl.getBoundingClientRect();
  const w = Math.round(rect.width * window.devicePixelRatio);
  const h = Math.round(rect.height * window.devicePixelRatio);
  if (w === 0 || h === 0) return;

  // Only resize the canvas when dimensions actually change
  if (w !== vCachedW || h !== vCachedH) {
    dbg(`ruler-v RESIZE: ${vCachedW}x${vCachedH} -> ${w}x${h} (css=${rect.width.toFixed(0)}x${rect.height.toFixed(0)} dpr=${window.devicePixelRatio})`);
    rulerEl.width = w;
    rulerEl.height = h;
    vCachedW = w;
    vCachedH = h;
    vCtx = null; // force new context after resize
  }

  if (!vCtx) {
    vCtx = rulerEl.getContext('2d');
    if (!vCtx) {
      dbgWarn('ruler-v: getContext returned NULL');
      return;
    }
    vCtx.scale(window.devicePixelRatio, window.devicePixelRatio);
  }

  const ctx = vCtx;
  ctx.clearRect(0, 0, rect.width, rect.height);

  const vb = canvas.getViewBox();
  const zoom = canvas.getZoom();

  ctx.fillStyle = '#3c3c3c';
  ctx.fillRect(0, 0, rect.width, rect.height);

  ctx.fillStyle = '#999';
  ctx.strokeStyle = '#666';
  ctx.font = '9px sans-serif';
  ctx.textAlign = 'center';

  const step = getStep(zoom);
  const startY = Math.floor(vb.y / step) * step;

  for (let y = startY; y < vb.y + vb.h; y += step) {
    const screenY = (y - vb.y) * zoom;
    ctx.beginPath();
    ctx.moveTo(rect.width, screenY);
    const isMajor = Math.abs(y % (step * 5)) < 0.5;
    const tickW = isMajor ? 10 : 5;
    ctx.lineTo(rect.width - tickW, screenY);
    ctx.stroke();

    if (isMajor) {
      ctx.save();
      ctx.translate(8, screenY);
      ctx.rotate(-Math.PI / 2);
      ctx.fillText(String(Math.round(y)), 0, 0);
      ctx.restore();
    }
  }
}

function getStep(zoom: number): number {
  if (zoom >= 4) return 5;
  if (zoom >= 2) return 10;
  if (zoom >= 1) return 20;
  if (zoom >= 0.5) return 50;
  if (zoom >= 0.25) return 100;
  return 200;
}
