/**
 * On-screen debug overlay for diagnosing rendering crashes.
 * Renders to a fixed-position DOM element so it survives canvas/SVG crashes.
 * Enable by adding ?debug to the URL.
 */

const MAX_LINES = 80;
let overlay: HTMLDivElement | null = null;
let lines: string[] = [];
let enabled = false;

export function initDebugOverlay(): void {
  enabled = location.search.includes('debug');
  if (!enabled) return;

  overlay = document.createElement('div');
  overlay.id = 'debug-overlay';
  Object.assign(overlay.style, {
    position: 'fixed',
    bottom: '0',
    left: '0',
    width: '50vw',
    maxHeight: '40vh',
    overflow: 'auto',
    background: 'rgba(0,0,0,0.85)',
    color: '#0f0',
    fontFamily: 'monospace',
    fontSize: '10px',
    lineHeight: '1.3',
    padding: '6px',
    zIndex: '999999',
    pointerEvents: 'auto',
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-all',
    borderTop: '2px solid #0f0',
  });
  document.body.appendChild(overlay);
  dbg('=== SVGMaker debug overlay started ===');
  dbg(`userAgent: ${navigator.userAgent}`);
  dbg(`platform: ${navigator.platform}`);
  dbg(`devicePixelRatio: ${window.devicePixelRatio}`);
  dbg(`screen: ${screen.width}x${screen.height}`);
  dbg(`window inner: ${window.innerWidth}x${window.innerHeight}`);
  snapshotCanvasHealth();
  snapshotGridLayout();
  monitorCanvasElements();
  monitorGPU();
}

export function dbg(msg: string): void {
  const ts = performance.now().toFixed(1);
  const line = `[${ts}ms] ${msg}`;
  console.log(`[SVGMaker-dbg] ${line}`);
  if (!enabled || !overlay) return;
  lines.push(line);
  if (lines.length > MAX_LINES) lines.shift();
  overlay.textContent = lines.join('\n');
  overlay.scrollTop = overlay.scrollHeight;
}

export function dbgWarn(msg: string): void {
  const ts = performance.now().toFixed(1);
  const line = `[${ts}ms] ⚠ ${msg}`;
  console.warn(`[SVGMaker-dbg] ${line}`);
  if (!enabled || !overlay) return;
  lines.push(line);
  if (lines.length > MAX_LINES) lines.shift();
  overlay.textContent = lines.join('\n');
  overlay.scrollTop = overlay.scrollHeight;
}

function snapshotCanvasHealth(): void {
  for (const id of ['ruler-h', 'ruler-v']) {
    const el = document.getElementById(id) as HTMLCanvasElement | null;
    if (!el) {
      dbgWarn(`${id}: element NOT FOUND in DOM`);
      continue;
    }
    const rect = el.getBoundingClientRect();
    dbg(`${id}: DOM rect=${rect.width.toFixed(0)}x${rect.height.toFixed(0)} canvas.width=${el.width} canvas.height=${el.height}`);
    const ctx = el.getContext('2d');
    dbg(`${id}: getContext('2d') => ${ctx ? 'OK' : 'NULL (context lost!)'}`);
    if (ctx) {
      // Test drawing works
      try {
        ctx.fillStyle = '#ff00ff';
        ctx.fillRect(0, 0, 1, 1);
        dbg(`${id}: test draw OK`);
      } catch (e) {
        dbgWarn(`${id}: test draw THREW: ${e}`);
      }
    }
  }
}

function snapshotGridLayout(): void {
  const main = document.getElementById('app');
  if (!main) {
    dbg('grid: #app not found, trying body first child');
    return;
  }
  const style = getComputedStyle(main);
  dbg(`grid: columns=${style.gridTemplateColumns}`);
  dbg(`grid: rows=${style.gridTemplateRows}`);

  for (const id of ['ruler-corner', 'ruler-h', 'ruler-v', 'canvas-area', 'panels']) {
    const el = document.getElementById(id);
    if (!el) {
      dbgWarn(`grid: ${id} NOT FOUND`);
      continue;
    }
    const r = el.getBoundingClientRect();
    dbg(`grid: ${id} rect=${r.x.toFixed(0)},${r.y.toFixed(0)} ${r.width.toFixed(0)}x${r.height.toFixed(0)}`);
  }
}

function monitorCanvasElements(): void {
  for (const id of ['ruler-h', 'ruler-v']) {
    const el = document.getElementById(id) as HTMLCanvasElement | null;
    if (!el) continue;

    el.addEventListener('contextlost', (e) => {
      dbgWarn(`${id}: CONTEXT LOST event fired!`);
      e.preventDefault();
    });
    el.addEventListener('contextrestored', () => {
      dbg(`${id}: context restored event fired`);
    });
  }

  // Watch for the SVG canvas being resized to weird values
  const svgCanvas = document.getElementById('svg-canvas');
  if (svgCanvas) {
    const observer = new MutationObserver((mutations) => {
      for (const m of mutations) {
        if (m.type === 'attributes') {
          const name = m.attributeName;
          if (name === 'viewBox' || name === 'width' || name === 'height') {
            const val = svgCanvas.getAttribute(name);
            dbg(`svg-canvas attr ${name}=${val}`);
          }
        }
      }
    });
    observer.observe(svgCanvas, { attributes: true, attributeFilter: ['viewBox', 'width', 'height'] });
  }
}

async function monitorGPU(): Promise<void> {
  // Try WebGL to check GPU status
  const testCanvas = document.createElement('canvas');
  testCanvas.width = 1;
  testCanvas.height = 1;
  const gl = testCanvas.getContext('webgl2') || testCanvas.getContext('webgl');
  if (gl) {
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    if (ext) {
      dbg(`GPU vendor: ${gl.getParameter(ext.UNMASKED_VENDOR_WEBGL)}`);
      dbg(`GPU renderer: ${gl.getParameter(ext.UNMASKED_RENDERER_WEBGL)}`);
    }
    dbg(`WebGL max texture: ${gl.getParameter(gl.MAX_TEXTURE_SIZE)}`);
    dbg(`WebGL max viewport: ${gl.getParameter(gl.MAX_VIEWPORT_DIMS)}`);
  } else {
    dbgWarn('WebGL not available - GPU may be in trouble');
  }
  testCanvas.remove();
}

/** Call periodically to check if canvases are still alive */
export function checkCanvasHealth(): void {
  if (!enabled) return;
  for (const id of ['ruler-h', 'ruler-v']) {
    const el = document.getElementById(id) as HTMLCanvasElement | null;
    if (!el) continue;
    const ctx = el.getContext('2d');
    if (!ctx) {
      dbgWarn(`HEALTH CHECK: ${id} context is NULL`);
    }
  }
}

/** Snapshot current state for debugging - call from console: window.__svgmakerDebug() */
export function manualDebugDump(): void {
  const oldEnabled = enabled;
  enabled = true;
  if (!overlay) {
    // Create overlay on-demand for console-triggered dumps
    overlay = document.createElement('div');
    overlay.id = 'debug-overlay';
    Object.assign(overlay.style, {
      position: 'fixed',
      bottom: '0',
      left: '0',
      width: '50vw',
      maxHeight: '40vh',
      overflow: 'auto',
      background: 'rgba(0,0,0,0.85)',
      color: '#0f0',
      fontFamily: 'monospace',
      fontSize: '10px',
      lineHeight: '1.3',
      padding: '6px',
      zIndex: '999999',
      pointerEvents: 'auto',
      whiteSpace: 'pre-wrap',
      wordBreak: 'break-all',
      borderTop: '2px solid #0f0',
    });
    document.body.appendChild(overlay);
  }
  dbg('=== Manual debug dump ===');
  snapshotCanvasHealth();
  snapshotGridLayout();
  enabled = oldEnabled;
}
