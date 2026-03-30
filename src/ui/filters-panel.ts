import type { AppState } from '../core/state';
import type { FilterPrimitive, BlendMode } from '../core/types';

/**
 * Build the filter primitives array from the current "quick effects" control values.
 * Returns null if no effects are active.
 */
function buildManagedFilter(): FilterPrimitive[] | null {
  const blurEnabled = (document.getElementById('effect-blur-enabled') as HTMLInputElement).checked;
  const shadowEnabled = (document.getElementById('effect-shadow-enabled') as HTMLInputElement).checked;
  const saturate = parseFloat((document.getElementById('effect-saturate') as HTMLInputElement).value);
  const hueRotate = parseFloat((document.getElementById('effect-hue-rotate') as HTMLInputElement).value);
  const brightness = parseFloat((document.getElementById('effect-brightness') as HTMLInputElement).value);
  const contrast = parseFloat((document.getElementById('effect-contrast') as HTMLInputElement).value);

  const hasColorEffect = saturate !== 100 || hueRotate !== 0 || brightness !== 100 || contrast !== 100;
  if (!blurEnabled && !shadowEnabled && !hasColorEffect) return null;

  const primitives: FilterPrimitive[] = [];

  // 1. Blur
  if (blurEnabled) {
    const radius = parseFloat((document.getElementById('effect-blur-radius') as HTMLInputElement).value);
    if (radius > 0) {
      primitives.push({ type: 'feGaussianBlur', stdDeviation: radius, in: 'SourceGraphic', result: 'blur' });
    }
  }

  // 2. Color effects (saturate, hue-rotate)
  if (saturate !== 100) {
    primitives.push({ type: 'feColorMatrix', colorMatrixType: 'saturate', values: String(saturate / 100) });
  }
  if (hueRotate !== 0) {
    primitives.push({ type: 'feColorMatrix', colorMatrixType: 'hueRotate', values: String(hueRotate) });
  }

  // 3. Brightness & Contrast via feComponentTransfer
  if (brightness !== 100 || contrast !== 100) {
    const bSlope = brightness / 100;
    const cSlope = contrast / 100;
    const slope = bSlope * cSlope;
    const intercept = 0.5 * (1 - cSlope) * bSlope;
    const tf = { type: 'linear' as const, slope, intercept };
    primitives.push({
      type: 'feComponentTransfer',
      transferR: { ...tf },
      transferG: { ...tf },
      transferB: { ...tf },
    });
  }

  // 4. Drop shadow (last so it includes color-adjusted graphic)
  if (shadowEnabled) {
    const dx = parseFloat((document.getElementById('effect-shadow-dx') as HTMLInputElement).value);
    const dy = parseFloat((document.getElementById('effect-shadow-dy') as HTMLInputElement).value);
    const blur = parseFloat((document.getElementById('effect-shadow-blur') as HTMLInputElement).value);
    const color = (document.getElementById('effect-shadow-color') as HTMLInputElement).value;
    const opacity = parseFloat((document.getElementById('effect-shadow-opacity') as HTMLInputElement).value);
    primitives.push({
      type: 'feDropShadow', dx, dy, stdDeviation: blur,
      shadowColor: color, floodOpacity: opacity,
    });
  }

  return primitives;
}

/** Apply the current quick-effect controls to the selected shape(s) */
function applyEffects(state: AppState): void {
  const ids = state.selectedShapeIds;
  if (ids.length === 0) return;

  const primitives = buildManagedFilter();

  for (const id of ids) {
    const shape = state.findShapeById(id);
    if (!shape) continue;

    if (!primitives) {
      // Remove filter
      if (shape.style.filterId) {
        state.removeFilter(shape.style.filterId);
        shape.element.removeAttribute('filter');
        shape.style.filterId = undefined;
      }
    } else {
      // Create or update filter
      if (shape.style.filterId) {
        const existing = state.getFilterById(shape.style.filterId);
        if (existing) {
          existing.primitives = primitives;
          state.updateFilter(existing);
        } else {
          const filt = state.createFilter(primitives);
          shape.style.filterId = filt.id;
          shape.element.setAttribute('filter', `url(#${filt.id})`);
        }
      } else {
        const filt = state.createFilter(primitives);
        shape.style.filterId = filt.id;
        shape.element.setAttribute('filter', `url(#${filt.id})`);
      }
    }
  }

  state.saveHistory();
  state.onChange_public();
}

/** Apply blend mode to the selected shape(s) */
function applyBlendMode(state: AppState): void {
  const blendMode = (document.getElementById('effect-blend-mode') as HTMLSelectElement).value as BlendMode;
  const ids = state.selectedShapeIds;
  for (const id of ids) {
    const shape = state.findShapeById(id);
    if (!shape) continue;
    (shape.element as SVGElement & ElementCSSInlineStyle).style.mixBlendMode = blendMode === 'normal' ? '' : blendMode;
    shape.style.blendMode = blendMode === 'normal' ? undefined : blendMode;
  }
  state.saveHistory();
  state.onChange_public();
}

/** Apply isolation to the selected group */
function applyIsolation(state: AppState): void {
  const isolation = (document.getElementById('effect-isolation') as HTMLInputElement).checked;
  const ids = state.selectedShapeIds;
  for (const id of ids) {
    const shape = state.findShapeById(id);
    if (!shape || shape.type !== 'group') continue;
    (shape.element as SVGElement & ElementCSSInlineStyle).style.isolation = isolation ? 'isolate' : '';
    shape.style.isolation = isolation || undefined;
  }
  state.saveHistory();
  state.onChange_public();
}

export function setupFiltersPanel(state: AppState): void {
  // Blur controls
  const blurEnabled = document.getElementById('effect-blur-enabled') as HTMLInputElement;
  const blurRadius = document.getElementById('effect-blur-radius') as HTMLInputElement;
  const blurVal = document.getElementById('effect-blur-val')!;

  blurEnabled.addEventListener('change', () => applyEffects(state));
  blurRadius.addEventListener('input', () => {
    blurVal.textContent = blurRadius.value;
    if (blurEnabled.checked) applyEffects(state);
  });

  // Shadow controls
  const shadowEnabled = document.getElementById('effect-shadow-enabled') as HTMLInputElement;
  const shadowControls = document.getElementById('effect-shadow-controls')!;

  shadowEnabled.addEventListener('change', () => {
    shadowControls.style.display = shadowEnabled.checked ? '' : 'none';
    applyEffects(state);
  });

  for (const id of ['effect-shadow-dx', 'effect-shadow-dy', 'effect-shadow-blur', 'effect-shadow-color']) {
    document.getElementById(id)!.addEventListener('change', () => {
      if (shadowEnabled.checked) applyEffects(state);
    });
  }

  const shadowOpacity = document.getElementById('effect-shadow-opacity') as HTMLInputElement;
  const shadowOpacityVal = document.getElementById('effect-shadow-opacity-val')!;
  shadowOpacity.addEventListener('input', () => {
    shadowOpacityVal.textContent = Math.round(parseFloat(shadowOpacity.value) * 100) + '%';
    if (shadowEnabled.checked) applyEffects(state);
  });

  // Color effect sliders
  const saturate = document.getElementById('effect-saturate') as HTMLInputElement;
  const saturateVal = document.getElementById('effect-saturate-val')!;
  saturate.addEventListener('input', () => { saturateVal.textContent = saturate.value + '%'; applyEffects(state); });

  const hueRotate = document.getElementById('effect-hue-rotate') as HTMLInputElement;
  const hueVal = document.getElementById('effect-hue-val')!;
  hueRotate.addEventListener('input', () => { hueVal.innerHTML = hueRotate.value + '&deg;'; applyEffects(state); });

  const brightness = document.getElementById('effect-brightness') as HTMLInputElement;
  const brightnessVal = document.getElementById('effect-brightness-val')!;
  brightness.addEventListener('input', () => { brightnessVal.textContent = brightness.value + '%'; applyEffects(state); });

  const contrast = document.getElementById('effect-contrast') as HTMLInputElement;
  const contrastVal = document.getElementById('effect-contrast-val')!;
  contrast.addEventListener('input', () => { contrastVal.textContent = contrast.value + '%'; applyEffects(state); });

  // Blend mode
  document.getElementById('effect-blend-mode')!.addEventListener('change', () => applyBlendMode(state));

  // Isolation
  document.getElementById('effect-isolation')!.addEventListener('change', () => applyIsolation(state));
}

/**
 * Update the effects panel controls to reflect the currently selected shape's filter state.
 */
export function updateFiltersPanel(state: AppState): void {
  const shape = state.selectedShapeId ? state.findShapeById(state.selectedShapeId) : null;

  const blurEnabled = document.getElementById('effect-blur-enabled') as HTMLInputElement;
  const blurRadius = document.getElementById('effect-blur-radius') as HTMLInputElement;
  const blurVal = document.getElementById('effect-blur-val')!;
  const shadowEnabled = document.getElementById('effect-shadow-enabled') as HTMLInputElement;
  const shadowControls = document.getElementById('effect-shadow-controls')!;
  const blendSelect = document.getElementById('effect-blend-mode') as HTMLSelectElement;
  const isolationRow = document.getElementById('effect-isolation-row')!;
  const isolationCheck = document.getElementById('effect-isolation') as HTMLInputElement;

  // Reset to defaults
  blurEnabled.checked = false;
  blurRadius.value = '0';
  blurVal.textContent = '0';
  shadowEnabled.checked = false;
  shadowControls.style.display = 'none';
  (document.getElementById('effect-saturate') as HTMLInputElement).value = '100';
  document.getElementById('effect-saturate-val')!.textContent = '100%';
  (document.getElementById('effect-hue-rotate') as HTMLInputElement).value = '0';
  document.getElementById('effect-hue-val')!.innerHTML = '0&deg;';
  (document.getElementById('effect-brightness') as HTMLInputElement).value = '100';
  document.getElementById('effect-brightness-val')!.textContent = '100%';
  (document.getElementById('effect-contrast') as HTMLInputElement).value = '100';
  document.getElementById('effect-contrast-val')!.textContent = '100%';
  blendSelect.value = 'normal';
  isolationRow.style.display = 'none';
  isolationCheck.checked = false;

  if (!shape) return;

  // Show isolation option for groups
  if (shape.type === 'group') {
    isolationRow.style.display = '';
    isolationCheck.checked = shape.style.isolation === true;
  }

  // Blend mode
  blendSelect.value = shape.style.blendMode ?? 'normal';

  // Parse filter primitives
  if (shape.style.filterId) {
    const filt = state.getFilterById(shape.style.filterId);
    if (filt) {
      for (const prim of filt.primitives) {
        switch (prim.type) {
          case 'feGaussianBlur':
            blurEnabled.checked = true;
            blurRadius.value = String(prim.stdDeviation ?? 0);
            blurVal.textContent = String(prim.stdDeviation ?? 0);
            break;
          case 'feDropShadow':
            shadowEnabled.checked = true;
            shadowControls.style.display = '';
            (document.getElementById('effect-shadow-dx') as HTMLInputElement).value = String(prim.dx ?? 4);
            (document.getElementById('effect-shadow-dy') as HTMLInputElement).value = String(prim.dy ?? 4);
            (document.getElementById('effect-shadow-blur') as HTMLInputElement).value = String(prim.stdDeviation ?? 4);
            (document.getElementById('effect-shadow-color') as HTMLInputElement).value = prim.shadowColor ?? '#000000';
            (document.getElementById('effect-shadow-opacity') as HTMLInputElement).value = String(prim.floodOpacity ?? 0.5);
            document.getElementById('effect-shadow-opacity-val')!.textContent = Math.round((prim.floodOpacity ?? 0.5) * 100) + '%';
            break;
          case 'feColorMatrix':
            if (prim.colorMatrixType === 'saturate') {
              const v = Math.round(parseFloat(prim.values ?? '1') * 100);
              (document.getElementById('effect-saturate') as HTMLInputElement).value = String(v);
              document.getElementById('effect-saturate-val')!.textContent = v + '%';
            } else if (prim.colorMatrixType === 'hueRotate') {
              const v = Math.round(parseFloat(prim.values ?? '0'));
              (document.getElementById('effect-hue-rotate') as HTMLInputElement).value = String(v);
              document.getElementById('effect-hue-val')!.innerHTML = v + '&deg;';
            }
            break;
          case 'feComponentTransfer': {
            // Parse brightness & contrast from slope/intercept
            if (prim.transferR?.type === 'linear') {
              const slope = prim.transferR.slope ?? 1;
              const intercept = prim.transferR.intercept ?? 0;
              // slope = bSlope * cSlope; intercept = 0.5 * (1 - cSlope) * bSlope
              // Try to recover: if intercept == 0, contrast=100%, brightness = slope*100
              // Otherwise solve: cSlope = 1 - 2*intercept/slope (if slope != 0)
              let bright = 100, cont = 100;
              if (Math.abs(intercept) < 0.001) {
                bright = Math.round(slope * 100);
              } else if (Math.abs(slope) > 0.001) {
                const cSlope = 1 - 2 * intercept / slope;
                const bSlope = slope / cSlope;
                bright = Math.round(bSlope * 100);
                cont = Math.round(cSlope * 100);
              }
              (document.getElementById('effect-brightness') as HTMLInputElement).value = String(bright);
              document.getElementById('effect-brightness-val')!.textContent = bright + '%';
              (document.getElementById('effect-contrast') as HTMLInputElement).value = String(cont);
              document.getElementById('effect-contrast-val')!.textContent = cont + '%';
            }
            break;
          }
        }
      }
    }
  }
}
