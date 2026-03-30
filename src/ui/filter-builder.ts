import type { AppState } from '../core/state';
import type { FilterPrimitive, FilterDef, FilterPrimitiveType } from '../core/types';

const PRIMITIVE_LABELS: Record<FilterPrimitiveType, string> = {
  feGaussianBlur: 'Gaussian Blur',
  feDropShadow: 'Drop Shadow',
  feColorMatrix: 'Color Matrix',
  feComponentTransfer: 'Component Transfer',
  feTurbulence: 'Turbulence',
  feDiffuseLighting: 'Diffuse Lighting',
  feSpecularLighting: 'Specular Lighting',
  feMorphology: 'Morphology',
  feDisplacementMap: 'Displacement Map',
  feConvolveMatrix: 'Convolve Matrix',
};

let overlay: HTMLDivElement | null = null;

function createDefaultPrimitive(type: FilterPrimitiveType): FilterPrimitive {
  const prim: FilterPrimitive = { type };
  switch (type) {
    case 'feGaussianBlur': prim.stdDeviation = 4; break;
    case 'feDropShadow': prim.dx = 4; prim.dy = 4; prim.stdDeviation = 4; prim.shadowColor = '#000000'; prim.floodOpacity = 0.5; break;
    case 'feColorMatrix': prim.colorMatrixType = 'saturate'; prim.values = '1'; break;
    case 'feComponentTransfer': prim.transferR = { type: 'linear', slope: 1, intercept: 0 }; prim.transferG = { type: 'linear', slope: 1, intercept: 0 }; prim.transferB = { type: 'linear', slope: 1, intercept: 0 }; break;
    case 'feTurbulence': prim.turbulenceType = 'turbulence'; prim.baseFrequency = 0.05; prim.numOctaves = 3; prim.seed = 0; break;
    case 'feDiffuseLighting': prim.surfaceScale = 1; prim.diffuseConstant = 1; prim.lightColor = '#FFFFFF'; prim.lightType = 'distant'; prim.azimuth = 225; prim.elevation = 45; prim.in = 'SourceGraphic'; break;
    case 'feSpecularLighting': prim.surfaceScale = 1; prim.specularConstant = 1; prim.specularExponent = 20; prim.lightColor = '#FFFFFF'; prim.lightType = 'distant'; prim.azimuth = 225; prim.elevation = 45; prim.in = 'SourceGraphic'; break;
    case 'feMorphology': prim.morphOperator = 'dilate'; prim.morphRadius = 1; break;
    case 'feDisplacementMap': prim.displacementScale = 10; prim.xChannelSelector = 'R'; prim.yChannelSelector = 'G'; break;
    case 'feConvolveMatrix': prim.order = 3; prim.kernelMatrix = '0 -1 0 -1 5 -1 0 -1 0'; prim.divisor = 1; prim.bias = 0; break;
  }
  return prim;
}

function buildParamEditor(prim: FilterPrimitive, onChange: () => void): HTMLElement {
  const div = document.createElement('div');
  div.className = 'fb-params';

  const addParam = (label: string, type: 'number' | 'text' | 'select' | 'color', value: string | number, opts?: { min?: number; max?: number; step?: number; options?: string[] }, onSet?: (v: string) => void) => {
    const row = document.createElement('div');
    row.className = 'effects-param';
    const lbl = document.createElement('label');
    lbl.textContent = label;
    lbl.style.minWidth = '80px';
    row.appendChild(lbl);

    if (type === 'select') {
      const sel = document.createElement('select');
      sel.className = 'effects-select';
      for (const opt of opts?.options ?? []) {
        const o = document.createElement('option');
        o.value = opt; o.textContent = opt;
        sel.appendChild(o);
      }
      sel.value = String(value);
      sel.addEventListener('change', () => { onSet?.(sel.value); onChange(); });
      row.appendChild(sel);
    } else if (type === 'color') {
      const inp = document.createElement('input');
      inp.type = 'color'; inp.value = String(value);
      inp.addEventListener('change', () => { onSet?.(inp.value); onChange(); });
      row.appendChild(inp);
    } else {
      const inp = document.createElement('input');
      inp.type = type; inp.value = String(value);
      if (opts?.min != null) inp.min = String(opts.min);
      if (opts?.max != null) inp.max = String(opts.max);
      if (opts?.step != null) inp.step = String(opts.step);
      inp.style.width = type === 'text' ? '160px' : '64px';
      inp.addEventListener('change', () => { onSet?.(inp.value); onChange(); });
      row.appendChild(inp);
    }
    div.appendChild(row);
  };

  switch (prim.type) {
    case 'feGaussianBlur':
      addParam('Std Deviation', 'number', prim.stdDeviation ?? 0, { min: 0, max: 100, step: 0.5 }, v => { prim.stdDeviation = parseFloat(v); });
      break;
    case 'feDropShadow':
      addParam('DX', 'number', prim.dx ?? 4, { step: 1 }, v => { prim.dx = parseFloat(v); });
      addParam('DY', 'number', prim.dy ?? 4, { step: 1 }, v => { prim.dy = parseFloat(v); });
      addParam('Blur', 'number', prim.stdDeviation ?? 4, { min: 0, step: 0.5 }, v => { prim.stdDeviation = parseFloat(v); });
      addParam('Color', 'color', prim.shadowColor ?? '#000000', {}, v => { prim.shadowColor = v; });
      addParam('Opacity', 'number', prim.floodOpacity ?? 0.5, { min: 0, max: 1, step: 0.01 }, v => { prim.floodOpacity = parseFloat(v); });
      break;
    case 'feColorMatrix':
      addParam('Type', 'select', prim.colorMatrixType ?? 'saturate', { options: ['saturate', 'hueRotate', 'matrix'] }, v => { prim.colorMatrixType = v as 'saturate'; });
      addParam('Values', 'text', prim.values ?? '1', {}, v => { prim.values = v; });
      break;
    case 'feComponentTransfer':
      addParam('R Slope', 'number', prim.transferR?.slope ?? 1, { step: 0.01 }, v => { if (!prim.transferR) prim.transferR = { type: 'linear' }; prim.transferR.slope = parseFloat(v); });
      addParam('R Intercept', 'number', prim.transferR?.intercept ?? 0, { step: 0.01 }, v => { if (!prim.transferR) prim.transferR = { type: 'linear' }; prim.transferR.intercept = parseFloat(v); });
      addParam('G Slope', 'number', prim.transferG?.slope ?? 1, { step: 0.01 }, v => { if (!prim.transferG) prim.transferG = { type: 'linear' }; prim.transferG.slope = parseFloat(v); });
      addParam('G Intercept', 'number', prim.transferG?.intercept ?? 0, { step: 0.01 }, v => { if (!prim.transferG) prim.transferG = { type: 'linear' }; prim.transferG.intercept = parseFloat(v); });
      addParam('B Slope', 'number', prim.transferB?.slope ?? 1, { step: 0.01 }, v => { if (!prim.transferB) prim.transferB = { type: 'linear' }; prim.transferB.slope = parseFloat(v); });
      addParam('B Intercept', 'number', prim.transferB?.intercept ?? 0, { step: 0.01 }, v => { if (!prim.transferB) prim.transferB = { type: 'linear' }; prim.transferB.intercept = parseFloat(v); });
      break;
    case 'feTurbulence':
      addParam('Type', 'select', prim.turbulenceType ?? 'turbulence', { options: ['turbulence', 'fractalNoise'] }, v => { prim.turbulenceType = v as 'turbulence'; });
      addParam('Base Frequency', 'number', prim.baseFrequency ?? 0.05, { min: 0.001, max: 1, step: 0.005 }, v => { prim.baseFrequency = parseFloat(v); });
      addParam('Octaves', 'number', prim.numOctaves ?? 3, { min: 1, max: 10, step: 1 }, v => { prim.numOctaves = parseInt(v); });
      addParam('Seed', 'number', prim.seed ?? 0, { min: 0, step: 1 }, v => { prim.seed = parseFloat(v); });
      break;
    case 'feDiffuseLighting':
      addParam('Surface Scale', 'number', prim.surfaceScale ?? 1, { step: 0.5 }, v => { prim.surfaceScale = parseFloat(v); });
      addParam('Diffuse Const', 'number', prim.diffuseConstant ?? 1, { min: 0, step: 0.1 }, v => { prim.diffuseConstant = parseFloat(v); });
      addParam('Light Color', 'color', prim.lightColor ?? '#FFFFFF', {}, v => { prim.lightColor = v; });
      addParam('Light Type', 'select', prim.lightType ?? 'distant', { options: ['distant', 'point', 'spot'] }, v => { prim.lightType = v as 'distant'; });
      addParam('Azimuth', 'number', prim.azimuth ?? 225, { min: 0, max: 360, step: 1 }, v => { prim.azimuth = parseFloat(v); });
      addParam('Elevation', 'number', prim.elevation ?? 45, { min: 0, max: 90, step: 1 }, v => { prim.elevation = parseFloat(v); });
      break;
    case 'feSpecularLighting':
      addParam('Surface Scale', 'number', prim.surfaceScale ?? 1, { step: 0.5 }, v => { prim.surfaceScale = parseFloat(v); });
      addParam('Specular Const', 'number', prim.specularConstant ?? 1, { min: 0, step: 0.1 }, v => { prim.specularConstant = parseFloat(v); });
      addParam('Specular Exp', 'number', prim.specularExponent ?? 20, { min: 1, max: 128, step: 1 }, v => { prim.specularExponent = parseFloat(v); });
      addParam('Light Color', 'color', prim.lightColor ?? '#FFFFFF', {}, v => { prim.lightColor = v; });
      addParam('Light Type', 'select', prim.lightType ?? 'distant', { options: ['distant', 'point', 'spot'] }, v => { prim.lightType = v as 'distant'; });
      addParam('Azimuth', 'number', prim.azimuth ?? 225, { min: 0, max: 360, step: 1 }, v => { prim.azimuth = parseFloat(v); });
      addParam('Elevation', 'number', prim.elevation ?? 45, { min: 0, max: 90, step: 1 }, v => { prim.elevation = parseFloat(v); });
      break;
    case 'feMorphology':
      addParam('Operator', 'select', prim.morphOperator ?? 'dilate', { options: ['erode', 'dilate'] }, v => { prim.morphOperator = v as 'erode'; });
      addParam('Radius', 'number', prim.morphRadius ?? 1, { min: 0, max: 50, step: 0.5 }, v => { prim.morphRadius = parseFloat(v); });
      break;
    case 'feDisplacementMap':
      addParam('Scale', 'number', prim.displacementScale ?? 10, { step: 1 }, v => { prim.displacementScale = parseFloat(v); });
      addParam('X Channel', 'select', prim.xChannelSelector ?? 'R', { options: ['R', 'G', 'B', 'A'] }, v => { prim.xChannelSelector = v as 'R'; });
      addParam('Y Channel', 'select', prim.yChannelSelector ?? 'G', { options: ['R', 'G', 'B', 'A'] }, v => { prim.yChannelSelector = v as 'G'; });
      break;
    case 'feConvolveMatrix':
      addParam('Order', 'number', prim.order ?? 3, { min: 1, max: 9, step: 1 }, v => { prim.order = parseInt(v); });
      addParam('Kernel Matrix', 'text', prim.kernelMatrix ?? '0 -1 0 -1 5 -1 0 -1 0', {}, v => { prim.kernelMatrix = v; });
      addParam('Divisor', 'number', prim.divisor ?? 1, { step: 0.1 }, v => { prim.divisor = parseFloat(v); });
      addParam('Bias', 'number', prim.bias ?? 0, { step: 0.01 }, v => { prim.bias = parseFloat(v); });
      break;
  }

  // Common: in / result
  addParam('Input (in)', 'text', prim.in ?? '', {}, v => { prim.in = v || undefined; });
  addParam('Output (result)', 'text', prim.result ?? '', {}, v => { prim.result = v || undefined; });

  return div;
}

export function openFilterBuilder(state: AppState): void {
  if (overlay) return;

  const shape = state.selectedShapeId ? state.findShapeById(state.selectedShapeId) : null;
  if (!shape) return;

  // Get or create a filter for this shape
  let filt: FilterDef;
  if (shape.style.filterId) {
    const existing = state.getFilterById(shape.style.filterId);
    if (existing) {
      filt = existing;
    } else {
      filt = state.createFilter([]);
      shape.style.filterId = filt.id;
      shape.element.setAttribute('filter', `url(#${filt.id})`);
    }
  } else {
    filt = state.createFilter([]);
    shape.style.filterId = filt.id;
    shape.element.setAttribute('filter', `url(#${filt.id})`);
  }

  let selectedPrimIdx = -1;

  overlay = document.createElement('div');
  overlay.className = 'filter-builder-overlay';

  const panel = document.createElement('div');
  panel.className = 'filter-builder-panel';
  overlay.appendChild(panel);

  // Header
  const header = document.createElement('div');
  header.className = 'fb-header';
  header.innerHTML = '<h3>Filter Builder</h3>';
  const closeBtn = document.createElement('button');
  closeBtn.className = 'fb-close';
  closeBtn.textContent = '\u00D7';
  closeBtn.addEventListener('click', close);
  header.appendChild(closeBtn);
  panel.appendChild(header);

  // Body
  const body = document.createElement('div');
  body.className = 'fb-body';
  panel.appendChild(body);

  const primListEl = document.createElement('ul');
  primListEl.className = 'fb-prim-list';
  body.appendChild(primListEl);

  const paramsContainer = document.createElement('div');
  body.appendChild(paramsContainer);

  // Add primitive row
  const addRow = document.createElement('div');
  addRow.className = 'fb-add-row';
  const addSelect = document.createElement('select');
  addSelect.className = 'effects-select';
  for (const [type, label] of Object.entries(PRIMITIVE_LABELS)) {
    const opt = document.createElement('option');
    opt.value = type; opt.textContent = label;
    addSelect.appendChild(opt);
  }
  addRow.appendChild(addSelect);

  const addBtn = document.createElement('button');
  addBtn.className = 'panel-action-btn';
  addBtn.textContent = '+ Add';
  addBtn.addEventListener('click', () => {
    const type = addSelect.value as FilterPrimitiveType;
    filt.primitives.push(createDefaultPrimitive(type));
    applyAndRender();
  });
  addRow.appendChild(addBtn);
  body.appendChild(addRow);

  function applyAndRender() {
    state.updateFilter(filt);
    state.saveHistory();
    renderList();
  }

  function renderList() {
    primListEl.innerHTML = '';
    paramsContainer.innerHTML = '';

    for (let i = 0; i < filt.primitives.length; i++) {
      const prim = filt.primitives[i];
      const li = document.createElement('li');
      li.className = 'fb-prim-item' + (i === selectedPrimIdx ? ' selected' : '');
      li.textContent = PRIMITIVE_LABELS[prim.type] || prim.type;
      li.addEventListener('click', () => {
        selectedPrimIdx = i;
        renderList();
      });

      const removeBtn = document.createElement('button');
      removeBtn.className = 'fb-remove-prim';
      removeBtn.textContent = '\u00D7';
      removeBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        filt.primitives.splice(i, 1);
        if (selectedPrimIdx >= filt.primitives.length) selectedPrimIdx = filt.primitives.length - 1;
        applyAndRender();
      });
      li.appendChild(removeBtn);
      primListEl.appendChild(li);
    }

    // Show params for selected primitive
    if (selectedPrimIdx >= 0 && selectedPrimIdx < filt.primitives.length) {
      const editor = buildParamEditor(filt.primitives[selectedPrimIdx], () => applyAndRender());
      paramsContainer.appendChild(editor);
    }
  }

  // Footer
  const footer = document.createElement('div');
  footer.className = 'fb-footer';
  const doneBtn = document.createElement('button');
  doneBtn.className = 'panel-action-btn';
  doneBtn.textContent = 'Done';
  doneBtn.addEventListener('click', close);
  footer.appendChild(doneBtn);
  panel.appendChild(footer);

  function close() {
    // If filter has no primitives, clean it up
    if (filt.primitives.length === 0 && shape) {
      state.removeFilter(filt.id);
      shape.element.removeAttribute('filter');
      shape.style.filterId = undefined;
      state.onChange_public();
    }
    overlay?.remove();
    overlay = null;
  }

  // Close on overlay background click
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) close();
  });

  document.body.appendChild(overlay);
  renderList();
}
