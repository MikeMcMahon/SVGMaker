import type { CanvasController } from '../core/canvas';

// Cached canvas state to avoid destroying/recreating backing stores every frame
let hCtx: CanvasRenderingContext2D | null = null;
let vCtx: CanvasRenderingContext2D | null = null;
let hCachedW = 0, hCachedH = 0;
let vCachedW = 0, vCachedH = 0;

export function drawRulers(canvas: CanvasController): void {
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
    rulerEl.width = w;
    rulerEl.height = h;
    hCachedW = w;
    hCachedH = h;
    hCtx = null; // force new context after resize
  }

  if (!hCtx) {
    hCtx = rulerEl.getContext('2d');
    if (!hCtx) return; // context lost / crashed
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
    rulerEl.width = w;
    rulerEl.height = h;
    vCachedW = w;
    vCachedH = h;
    vCtx = null; // force new context after resize
  }

  if (!vCtx) {
    vCtx = rulerEl.getContext('2d');
    if (!vCtx) return; // context lost / crashed
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
