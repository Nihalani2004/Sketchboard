import { beforeEach, describe, expect, it } from 'vitest';
import {
  DEFAULT_STYLE,
  addElement,
  bringToFront,
  addPage,
  createElement,
  deserialize,
  getActivePageId,
  getCanvasSettings,
  getElements,
  getPages,
  setActivePage,
  sendToBack,
  setElements,
  updateCanvasSettings,
  updateElement,
} from '../src/scene.js';

beforeEach(() => deserialize({ elements: [] }));

describe('scene data', () => {
  it('creates elements with documented defaults and overrides', () => {
    const element = createElement('rectangle', { x: 24, width: 80 });

    expect(element).toMatchObject({
      type: 'rectangle',
      x: 24,
      y: 0,
      width: 80,
      strokeColor: DEFAULT_STYLE.strokeColor,
      strokeWidth: DEFAULT_STYLE.strokeWidth,
    });
    expect(element.id).toMatch(/^el_/);
  });

  it('keeps the stored scene isolated from caller mutations', () => {
    const element = createElement('freedraw', { points: [[1, 2, 0.5]] });
    addElement(element);
    element.points[0][0] = 99;

    expect(getElements()[0].points).toEqual([[1, 2, 0.5]]);
  });

  it('deep-clones array patches when updating an element', () => {
    const element = createElement('freedraw');
    addElement(element);
    const points = [[8, 9, 0.4]];

    updateElement(element.id, { points });
    points[0][1] = 42;

    expect(getElements()[0].points).toEqual([[8, 9, 0.4]]);
  });

  it('maintains selected element order when moving layers', () => {
    const first = createElement('rectangle');
    const second = createElement('ellipse');
    const third = createElement('diamond');
    setElements([first, second, third]);

    bringToFront([first.id, second.id]);
    expect(getElements().map((element) => element.id)).toEqual([third.id, first.id, second.id]);

    sendToBack([second.id]);
    expect(getElements().map((element) => element.id)).toEqual([second.id, third.id, first.id]);
  });

  it('rejects imports without an element array', () => {
    expect(() => deserialize({ version: 1 })).toThrow('missing elements array');
  });

  it('isolates elements and canvas settings between pages', () => {
    const firstPageId = getActivePageId();
    addElement(createElement('rectangle'));
    const second = addPage({ title: 'Flow' });
    updateCanvasSettings({ gridSize: 40, snapToGrid: true });
    addElement(createElement('ellipse'));

    expect(getPages()).toHaveLength(2);
    expect(getElements()).toHaveLength(1);
    expect(getCanvasSettings()).toMatchObject({ gridSize: 40, snapToGrid: true });
    setActivePage(firstPageId);
    expect(getElements()[0].type).toBe('rectangle');
    expect(getPages().find((page) => page.id === second.id).title).toBe('Flow');
  });
});
