import type { Point } from './types';
import { dbg, dbgWarn, checkCanvasHealth } from '../ui/debug-overlay';

export class CanvasController {
  private svgCanvas: SVGSVGElement;
  private container: HTMLElement;
  private pasteboard: SVGRectElement;
  private viewBox = { x: -80, y: -30, w: 1120, h: 600 };
  private zoom = 1;
  private isPanning = false;
  private panStart: Point = { x: 0, y: 0 };
  private panViewBoxStart = { x: 0, y: 0 };
  private cursorPosEl: HTMLElement;
  private zoomSelect: HTMLSelectElement;
  private onViewChange: (() => void) | null = null;
  private containerWidth = 0;
  private containerHeight = 0;
  private panFrameCount = 0;

  constructor(svgCanvas: SVGSVGElement) {
    this.svgCanvas = svgCanvas;
    this.container = svgCanvas.parentElement as HTMLElement;
    this.pasteboard = document.getElementById('pasteboard') as unknown as SVGRectElement;
    this.cursorPosEl = document.getElementById('cursor-pos')!;
    this.zoomSelect = document.getElementById('zoom-select') as HTMLSelectElement;
    this.setupEvents();
    this.setupResizeObserver();
  }

  setOnViewChange(fn: () => void): void {
    this.onViewChange = fn;
  }

  private setupResizeObserver(): void {
    new ResizeObserver(() => {
      const oldW = this.containerWidth;
      const oldH = this.containerHeight;
      this.measureContainer();
      if (this.containerWidth > 0 && this.containerHeight > 0
          && (oldW !== this.containerWidth || oldH !== this.containerHeight)) {
        const cx = this.viewBox.x + this.viewBox.w / 2;
        const cy = this.viewBox.y + this.viewBox.h / 2;
        this.viewBox.w = this.containerWidth / this.zoom;
        this.viewBox.h = this.containerHeight / this.zoom;
        this.viewBox.x = cx - this.viewBox.w / 2;
        this.viewBox.y = cy - this.viewBox.h / 2;
        this.updateViewBox();
        this.notifyViewChange();
      }
    }).observe(this.container);
  }

  private setupEvents(): void {
    this.svgCanvas.addEventListener('wheel', (e: WheelEvent) => {
      e.preventDefault();
      let zoomDelta: number;
      if (e.ctrlKey) {
        // Trackpad pinch-to-zoom: deltaY is small, use proportional scaling
        const scaled = Math.min(Math.abs(e.deltaY), 10) * 0.01;
        zoomDelta = e.deltaY > 0 ? 1 - scaled : 1 + scaled;
      } else {
        // Mouse wheel: normalize deltaMode, then scale
        let dy = e.deltaY;
        if (e.deltaMode === 1) dy *= 16;
        const scaled = Math.min(Math.abs(dy), 200) * 0.001;
        zoomDelta = dy > 0 ? 1 - scaled : 1 + scaled;
      }
      this.setZoom(this.zoom * zoomDelta, { x: e.clientX, y: e.clientY });
    }, { passive: false });

    this.zoomSelect.addEventListener('change', () => {
      this.setZoom(parseFloat(this.zoomSelect.value));
    });

    document.getElementById('btn-zoom-in')?.addEventListener('click', () => {
      this.setZoom(this.zoom * 1.25);
    });

    document.getElementById('btn-zoom-out')?.addEventListener('click', () => {
      this.setZoom(this.zoom / 1.25);
    });

    this.svgCanvas.addEventListener('mousemove', (e: MouseEvent) => {
      const pt = this.screenToSVG(e.clientX, e.clientY);
      this.cursorPosEl.textContent = `${Math.round(pt.x)}, ${Math.round(pt.y)}`;

      if (this.isPanning) {
        this.panFrameCount++;
        const dx = (e.clientX - this.panStart.x) / this.zoom;
        const dy = (e.clientY - this.panStart.y) / this.zoom;
        this.viewBox.x = this.panViewBoxStart.x - dx;
        this.viewBox.y = this.panViewBoxStart.y - dy;
        // Log every 10th frame during pan + health check every 30th
        if (this.panFrameCount % 10 === 0) {
          dbg(`PAN #${this.panFrameCount} vb=${this.viewBox.x.toFixed(0)},${this.viewBox.y.toFixed(0)},${this.viewBox.w.toFixed(0)},${this.viewBox.h.toFixed(0)} pb=${this.pasteboard.getAttribute('width')}`);
        }
        if (this.panFrameCount % 30 === 0) {
          checkCanvasHealth();
        }
        this.updateViewBox();
        this.notifyViewChange();
      }
    });
  }

  startPan(clientX: number, clientY: number): void {
    this.isPanning = true;
    this.panStart = { x: clientX, y: clientY };
    this.panViewBoxStart = { x: this.viewBox.x, y: this.viewBox.y };
    this.svgCanvas.style.cursor = 'grabbing';
    dbg(`PAN START client=${clientX},${clientY} vb=${this.viewBox.x.toFixed(1)},${this.viewBox.y.toFixed(1)} zoom=${this.zoom.toFixed(3)}`);
    dbg(`PAN START container=${this.containerWidth}x${this.containerHeight} dpr=${window.devicePixelRatio}`);
    checkCanvasHealth();
  }

  endPan(): void {
    this.isPanning = false;
    this.svgCanvas.style.cursor = '';
    dbg(`PAN END vb=${this.viewBox.x.toFixed(1)},${this.viewBox.y.toFixed(1)},${this.viewBox.w.toFixed(1)},${this.viewBox.h.toFixed(1)}`);
    checkCanvasHealth();
  }

  get panning(): boolean {
    return this.isPanning;
  }

  setZoom(newZoom: number, screenCenter?: Point): void {
    // Dynamic minimum zoom: prevent viewBox from exceeding ~10000 SVG units
    const maxViewBoxDim = 10000;
    const dynamicMin = Math.max(
      this.containerWidth / maxViewBoxDim,
      this.containerHeight / maxViewBoxDim,
      0.1
    );
    newZoom = Math.max(dynamicMin, Math.min(64, newZoom));

    if (screenCenter) {
      const svgPt = this.screenToSVG(screenCenter.x, screenCenter.y);
      this.zoom = newZoom;
      this.viewBox.w = this.containerWidth / this.zoom;
      this.viewBox.h = this.containerHeight / this.zoom;
      const newSvgPt = this.screenToSVG(screenCenter.x, screenCenter.y);
      this.viewBox.x += svgPt.x - newSvgPt.x;
      this.viewBox.y += svgPt.y - newSvgPt.y;
    } else {
      const cx = this.viewBox.x + this.viewBox.w / 2;
      const cy = this.viewBox.y + this.viewBox.h / 2;
      this.zoom = newZoom;
      this.viewBox.w = this.containerWidth / this.zoom;
      this.viewBox.h = this.containerHeight / this.zoom;
      this.viewBox.x = cx - this.viewBox.w / 2;
      this.viewBox.y = cy - this.viewBox.h / 2;
    }

    this.updateViewBox();
    this.updateZoomSelect();
    this.notifyViewChange();
  }

  fitToWindow(bounds?: { x: number; y: number; w: number; h: number }): void {
    const bx = bounds?.x ?? 0;
    const by = bounds?.y ?? 0;
    const bw = bounds?.w ?? 960;
    const bh = bounds?.h ?? 540;
    const pad = 60;
    const scaleX = this.containerWidth / (bw + pad * 2);
    const scaleY = this.containerHeight / (bh + pad * 2);
    const scale = Math.min(scaleX, scaleY);
    this.zoom = scale;
    this.viewBox.w = this.containerWidth / this.zoom;
    this.viewBox.h = this.containerHeight / this.zoom;
    this.viewBox.x = bx + (bw - this.viewBox.w) / 2;
    this.viewBox.y = by + (bh - this.viewBox.h) / 2;
    this.updateViewBox();
    this.updateZoomSelect();
    this.notifyViewChange();
  }

  private updateViewBox(): void {
    const { x, y, w, h } = this.viewBox;

    // Sanity check for bad values
    if (!isFinite(x) || !isFinite(y) || !isFinite(w) || !isFinite(h) || w <= 0 || h <= 0) {
      dbgWarn(`BAD VIEWBOX: x=${x} y=${y} w=${w} h=${h} zoom=${this.zoom} container=${this.containerWidth}x${this.containerHeight}`);
      return; // don't apply broken values
    }

    if (this.containerWidth > 0 && this.containerHeight > 0) {
      this.svgCanvas.setAttribute('width', String(this.containerWidth));
      this.svgCanvas.setAttribute('height', String(this.containerHeight));
    }
    this.svgCanvas.setAttribute('viewBox', `${x} ${y} ${w} ${h}`);

    // Keep pasteboard covering the entire visible area
    const margin = Math.max(w, h);
    this.pasteboard.setAttribute('x', String(x - margin));
    this.pasteboard.setAttribute('y', String(y - margin));
    this.pasteboard.setAttribute('width', String(w + margin * 2));
    this.pasteboard.setAttribute('height', String(h + margin * 2));
  }

  private updateZoomSelect(): void {
    const pct = Math.round(this.zoom * 100);
    const options = this.zoomSelect.options;
    let matched = false;
    for (let i = 0; i < options.length; i++) {
      const optPct = Math.round(parseFloat(options[i].value) * 100);
      if (Math.abs(optPct - pct) < 2) {
        this.zoomSelect.selectedIndex = i;
        matched = true;
        break;
      }
    }
    if (!matched) {
      const existing = this.zoomSelect.querySelector('option[data-custom]');
      if (existing) existing.remove();
      const opt = document.createElement('option');
      opt.value = String(this.zoom);
      opt.textContent = `${pct}%`;
      opt.setAttribute('data-custom', 'true');
      opt.selected = true;
      this.zoomSelect.appendChild(opt);
    }
  }

  private notifyViewChange(): void {
    if (this.onViewChange) this.onViewChange();
  }

  screenToSVG(clientX: number, clientY: number): Point {
    const rect = this.container.getBoundingClientRect();
    return {
      x: this.viewBox.x + (clientX - rect.left) / this.zoom,
      y: this.viewBox.y + (clientY - rect.top) / this.zoom,
    };
  }

  getZoom(): number {
    return this.zoom;
  }

  getViewBox(): { x: number; y: number; w: number; h: number } {
    return { ...this.viewBox };
  }

  /** Read the container's pixel size and update the SVG to match. Call on init and window resize. */
  measureContainer(): void {
    const rect = this.container.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;
    this.containerWidth = rect.width;
    this.containerHeight = rect.height;
  }

  initSize(centerOn?: { x: number; y: number; w: number; h: number }): void {
    this.measureContainer();
    dbg(`initSize container=${this.containerWidth}x${this.containerHeight} dpr=${window.devicePixelRatio} centerOn=${JSON.stringify(centerOn)}`);
    if (this.containerWidth === 0 || this.containerHeight === 0) {
      dbgWarn('initSize: container has zero dimension, aborting');
      return;
    }
    this.viewBox.w = this.containerWidth / this.zoom;
    this.viewBox.h = this.containerHeight / this.zoom;
    const cx = centerOn?.x ?? 0;
    const cy = centerOn?.y ?? 0;
    const cw = centerOn?.w ?? 960;
    const ch = centerOn?.h ?? 540;
    this.viewBox.x = cx + (cw - this.viewBox.w) / 2;
    this.viewBox.y = cy + (ch - this.viewBox.h) / 2;
    this.updateViewBox();
    this.notifyViewChange();
  }
}
