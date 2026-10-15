import { describe, expect, it } from 'vitest';
import { validateImportData } from '../src/export.js';
import { isDrawShape, supportsShapeLabel } from '../src/shapes/catalog.js';

describe('shape catalog', () => {
  it('recognises every extra and flowchart shape as drawable', () => {
    ['triangle', 'rounded-rectangle', 'cloud', 'callout', 'sticky-note', 'flowchart-process', 'flowchart-database']
      .forEach((type) => expect(isDrawShape(type)).toBe(true));
  });

  it('allows labels on every closed shape but not directional connectors', () => {
    expect(supportsShapeLabel('rectangle')).toBe(true);
    expect(supportsShapeLabel('ellipse')).toBe(true);
    expect(supportsShapeLabel('diamond')).toBe(true);
    expect(supportsShapeLabel('cloud')).toBe(true);
    expect(supportsShapeLabel('flowchart-database')).toBe(true);
    expect(supportsShapeLabel('arrow')).toBe(false);
  });

  it('accepts safe embedded images and rejects unsafe sources', () => {
    const image = {
      id: 'image_1', type: 'image', x: 10, y: 20, width: 40, height: 30,
      src: 'data:image/png;base64,iVBORw0KGgo=',
    };
    expect(() => validateImportData({ elements: [image] })).not.toThrow();
    expect(() => validateImportData({ elements: [{ ...image, src: 'https://example.com/image.png' }] })).toThrow('unsupported source');
  });
});
