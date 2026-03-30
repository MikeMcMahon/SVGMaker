export interface Point {
  x: number;
  y: number;
}

export interface BBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export type ToolName =
  | 'select' | 'directSelect' | 'rect' | 'roundedRect' | 'ellipse'
  | 'line' | 'polyline' | 'path' | 'text' | 'hand' | 'zoom'
  | 'eyedropper' | 'star' | 'polygon' | 'artboard' | 'image';

export interface ShapeStyle {
  fill: string;
  stroke: string;
  strokeWidth: number;
  opacity: number;
  fontSize?: number;
  fontFamily?: string;
  fontWeight?: string;
  fontStyle?: string;
  strokeDasharray?: string;
  strokeLinecap?: string;
  strokeLinejoin?: string;
  rx?: number;
  filterId?: string;
  blendMode?: BlendMode;
  isolation?: boolean;
}

export interface ShapeData {
  id: string;
  type: 'rect' | 'ellipse' | 'line' | 'polyline' | 'path' | 'text' | 'polygon' | 'group' | 'image' | 'use';
  element: SVGElement;
  name: string;
  style: ShapeStyle;
  visible: boolean;
  locked: boolean;
  children?: ShapeData[];
  parentId?: string;
  rotation?: number;
  symbolId?: string; // for 'use' type, references a symbol in defs
}

export interface SymbolDef {
  id: string;
  name: string;
  element: SVGSymbolElement;
}

export interface HistoryEntry {
  svgContent: string;
  selectedId: string | null;
  artboardsJson: string;
}

export interface Artboard {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  name: string;
}

export type ExportFormat = 'svg' | 'png' | 'jpg';

// ---- Paint system (gradients & patterns) ----

export interface GradientStop {
  offset: number;  // 0–1
  color: string;   // hex
  opacity: number; // 0–1
}

export interface GradientDef {
  id: string;
  type: 'linear' | 'radial';
  stops: GradientStop[];
  // Linear-specific (objectBoundingBox coords, 0–1)
  x1?: number; y1?: number; x2?: number; y2?: number;
  // Radial-specific
  cx?: number; cy?: number; r?: number; fx?: number; fy?: number;
  spreadMethod?: 'pad' | 'reflect' | 'repeat';
}

// ---- Filter system ----

export type FilterPrimitiveType =
  | 'feGaussianBlur'
  | 'feDropShadow'
  | 'feColorMatrix'
  | 'feComponentTransfer'
  | 'feTurbulence'
  | 'feDiffuseLighting'
  | 'feSpecularLighting'
  | 'feMorphology'
  | 'feDisplacementMap'
  | 'feConvolveMatrix';

export interface FilterPrimitive {
  type: FilterPrimitiveType;
  in?: string;
  result?: string;
  // feGaussianBlur
  stdDeviation?: number;
  // feDropShadow
  dx?: number;
  dy?: number;
  shadowColor?: string;
  floodOpacity?: number;
  // feColorMatrix
  colorMatrixType?: 'saturate' | 'hueRotate' | 'matrix';
  values?: string;
  // feComponentTransfer channels
  transferR?: TransferFunction;
  transferG?: TransferFunction;
  transferB?: TransferFunction;
  transferA?: TransferFunction;
  // feTurbulence
  turbulenceType?: 'fractalNoise' | 'turbulence';
  baseFrequency?: number;
  numOctaves?: number;
  seed?: number;
  // feDiffuseLighting / feSpecularLighting
  surfaceScale?: number;
  diffuseConstant?: number;
  specularConstant?: number;
  specularExponent?: number;
  lightColor?: string;
  lightType?: 'point' | 'distant' | 'spot';
  lightX?: number; lightY?: number; lightZ?: number;
  azimuth?: number; elevation?: number;
  // feMorphology
  morphOperator?: 'erode' | 'dilate';
  morphRadius?: number;
  // feDisplacementMap
  in2?: string;
  displacementScale?: number;
  xChannelSelector?: 'R' | 'G' | 'B' | 'A';
  yChannelSelector?: 'R' | 'G' | 'B' | 'A';
  // feConvolveMatrix
  kernelMatrix?: string;
  order?: number;
  divisor?: number;
  bias?: number;
}

export interface TransferFunction {
  type: 'identity' | 'table' | 'discrete' | 'linear' | 'gamma';
  tableValues?: string;
  slope?: number;
  intercept?: number;
  amplitude?: number;
  exponent?: number;
  offset?: number;
}

export interface FilterDef {
  id: string;
  name: string;
  primitives: FilterPrimitive[];
}

export type BlendMode =
  | 'normal' | 'multiply' | 'screen' | 'overlay'
  | 'darken' | 'lighten' | 'color-dodge' | 'color-burn'
  | 'hard-light' | 'soft-light' | 'difference' | 'exclusion'
  | 'hue' | 'saturation' | 'color' | 'luminosity';

export interface PatternDef {
  id: string;
  type: 'preset' | 'image';
  // Preset params
  preset?: 'dots' | 'stripes' | 'crosshatch' | 'grid';
  presetColor?: string;
  // Image params
  imageDataUrl?: string;
  // Shared
  scale: number;      // multiplier, 1 = natural size
  rotation: number;   // degrees
  spacing: number;    // px gap around tile
  tileWidth: number;
  tileHeight: number;
}
