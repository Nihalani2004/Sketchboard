/**
 * Canonical shape metadata shared by the toolbar-adjacent palette, drawing
 * tool, renderer, and document validator.
 */

export const CORE_SHAPE_TYPES = ['rectangle', 'ellipse', 'diamond', 'line', 'arrow'];

export const EXTRA_SHAPES = [
  { id: 'triangle', label: 'Triangle' },
  { id: 'rounded-rectangle', label: 'Rounded rectangle' },
  { id: 'cloud', label: 'Cloud' },
  { id: 'callout', label: 'Callout' },
  { id: 'sticky-note', label: 'Sticky note' },
];

export const FLOWCHART_SHAPES = [
  { id: 'flowchart-process', label: 'Process' },
  { id: 'flowchart-terminator', label: 'Terminator' },
  { id: 'flowchart-decision', label: 'Decision' },
  { id: 'flowchart-input-output', label: 'Input / output' },
  { id: 'flowchart-document', label: 'Document' },
  { id: 'flowchart-database', label: 'Database' },
];

export const DRAW_SHAPE_TYPES = new Set([
  ...CORE_SHAPE_TYPES,
  ...EXTRA_SHAPES.map((shape) => shape.id),
  ...FLOWCHART_SHAPES.map((shape) => shape.id),
]);

// Every closed shape can carry a centred label. Directional connectors remain
// intentionally label-free because their bounds are often only a few pixels high.
export const LABELLED_SHAPE_TYPES = new Set(
  [...DRAW_SHAPE_TYPES].filter((type) => type !== 'line' && type !== 'arrow'),
);

export const SUPPORTED_ELEMENT_TYPES = new Set([
  ...DRAW_SHAPE_TYPES,
  'freedraw',
  'text',
  'image',
]);

export function isDrawShape(type) { return DRAW_SHAPE_TYPES.has(type); }
export function supportsShapeLabel(type) { return LABELLED_SHAPE_TYPES.has(type); }

/** Element defaults that express the intended semantics of specific shapes. */
export function getShapeDefaults(type) {
  if (type === 'sticky-note') return { backgroundColor: '#fff3bf' };
  return {};
}
