/**
 * sketchyShape.js — Shared factory: builds a Konva.Shape whose sceneFunc
 * delegates to a rough.js renderer, giving all shapes a hand-drawn aesthetic.
 */

import Konva from 'konva';
import rough from 'roughjs';

/**
 * Build rough.js options from an element's style properties.
 * @param {object} el - scene element
 * @returns {object} rough.js drawable options
 */
function getRoughOptions(el) {
  return {
    stroke: el.strokeColor || '#1e1e1e',
    strokeWidth: el.strokeWidth || 2,
    roughness: el.roughness ?? 1.2,
    seed: el.seed || 1,
    fill: el.backgroundColor !== 'transparent' && el.backgroundColor
      ? el.backgroundColor
      : undefined,
    fillStyle: el.fillStyle || 'hachure',
    strokeLineDash: el.strokeStyle === 'dashed'
      ? [8, 6]
      : el.strokeStyle === 'dotted'
      ? [2, 6]
      : undefined,
  };
}

/**
 * Creates a Konva.Shape with a sketchy sceneFunc for a RECTANGLE.
 */
export function createSketchyRect(el) {
  const shape = new Konva.Shape({
    x: el.x,
    y: el.y,
    width: el.width,
    height: el.height,
    rotation: el.angle || 0,
    opacity: el.opacity ?? 1,
    id: el.id,
    draggable: false,
    name: 'element',
    sceneFunc(ctx, shape) {
      const w = shape.width();
      const h = shape.height();
      const rc = rough.canvas(ctx.canvas);
      const opts = getRoughOptions(shape.attrs);
      rc.rectangle(0, 0, w, h, opts);
    },
    hitFunc(ctx, shape) {
      ctx.beginPath();
      ctx.rect(0, 0, shape.width(), shape.height());
      ctx.closePath();
      ctx.fillStrokeShape(shape);
    },
  });
  // Store element attrs for style updates
  Object.assign(shape.attrs, {
    strokeColor: el.strokeColor,
    backgroundColor: el.backgroundColor,
    fillStyle: el.fillStyle,
    strokeWidth: el.strokeWidth,
    strokeStyle: el.strokeStyle,
    roughness: el.roughness,
    seed: el.seed,
    elementId: el.id,
  });
  return shape;
}

/**
 * Creates a Konva.Shape with a sketchy sceneFunc for an ELLIPSE.
 */
export function createSketchyEllipse(el) {
  const shape = new Konva.Shape({
    x: el.x,
    y: el.y,
    width: el.width,
    height: el.height,
    rotation: el.angle || 0,
    opacity: el.opacity ?? 1,
    id: el.id,
    draggable: false,
    name: 'element',
    sceneFunc(ctx, shape) {
      const w = shape.width();
      const h = shape.height();
      const rc = rough.canvas(ctx.canvas);
      const opts = getRoughOptions(shape.attrs);
      rc.ellipse(w / 2, h / 2, w, h, opts);
    },
    hitFunc(ctx, shape) {
      ctx.beginPath();
      ctx.ellipse(shape.width() / 2, shape.height() / 2, shape.width() / 2, shape.height() / 2, 0, 0, Math.PI * 2);
      ctx.closePath();
      ctx.fillStrokeShape(shape);
    },
  });
  Object.assign(shape.attrs, {
    strokeColor: el.strokeColor,
    backgroundColor: el.backgroundColor,
    fillStyle: el.fillStyle,
    strokeWidth: el.strokeWidth,
    strokeStyle: el.strokeStyle,
    roughness: el.roughness,
    seed: el.seed,
    elementId: el.id,
  });
  return shape;
}

/**
 * Creates a Konva.Shape for a LINE.
 * The line goes from (0,0) to (el.width, el.height) in local coords.
 */
export function createSketchyLine(el) {
  const shape = new Konva.Shape({
    x: el.x,
    y: el.y,
    width: el.width,
    height: el.height,
    rotation: el.angle || 0,
    opacity: el.opacity ?? 1,
    id: el.id,
    draggable: false,
    name: 'element',
    sceneFunc(ctx, shape) {
      const rc = rough.canvas(ctx.canvas);
      const opts = getRoughOptions(shape.attrs);
      delete opts.fill;
      rc.line(0, 0, shape.width(), shape.height(), opts);
    },
    hitFunc(ctx, shape) {
      const w = shape.width(), h = shape.height();
      const thickness = Math.max(shape.attrs.strokeWidth || 2, 10);
      ctx.beginPath();
      // Hit area is a thickened rect around the line
      ctx.rect(-thickness / 2, -thickness / 2, w + thickness, h + thickness);
      ctx.closePath();
      ctx.fillStrokeShape(shape);
    },
  });
  Object.assign(shape.attrs, {
    strokeColor: el.strokeColor,
    backgroundColor: el.backgroundColor,
    fillStyle: el.fillStyle,
    strokeWidth: el.strokeWidth,
    strokeStyle: el.strokeStyle,
    roughness: el.roughness,
    seed: el.seed,
    elementId: el.id,
  });
  return shape;
}

/**
 * Creates a Konva.Shape for an ARROW (line + arrowhead).
 */
export function createSketchyArrow(el) {
  const shape = new Konva.Shape({
    x: el.x,
    y: el.y,
    width: el.width,
    height: el.height,
    rotation: el.angle || 0,
    opacity: el.opacity ?? 1,
    id: el.id,
    draggable: false,
    name: 'element',
    sceneFunc(ctx, shape) {
      const rc = rough.canvas(ctx.canvas);
      const w = shape.width(), h = shape.height();
      const opts = getRoughOptions(shape.attrs);
      delete opts.fill;

      // Draw line
      rc.line(0, 0, w, h, opts);

      // Draw arrowhead at (w, h) pointing in direction (w, h)
      const angle = Math.atan2(h, w);
      const headLen = Math.max(12, (shape.attrs.strokeWidth || 2) * 5);
      const headAngle = Math.PI / 6;

      const ax1 = w - headLen * Math.cos(angle - headAngle);
      const ay1 = h - headLen * Math.sin(angle - headAngle);
      const ax2 = w - headLen * Math.cos(angle + headAngle);
      const ay2 = h - headLen * Math.sin(angle + headAngle);

      rc.linearPath([[ax1, ay1], [w, h], [ax2, ay2]], {
        ...opts,
        roughness: Math.min(opts.roughness || 1.2, 1),
      });
    },
    hitFunc(ctx, shape) {
      const w = shape.width(), h = shape.height();
      const thickness = Math.max(shape.attrs.strokeWidth || 2, 10);
      ctx.beginPath();
      ctx.rect(-thickness / 2, -thickness / 2, w + thickness, h + thickness);
      ctx.closePath();
      ctx.fillStrokeShape(shape);
    },
  });
  Object.assign(shape.attrs, {
    strokeColor: el.strokeColor,
    backgroundColor: el.backgroundColor,
    fillStyle: el.fillStyle,
    strokeWidth: el.strokeWidth,
    strokeStyle: el.strokeStyle,
    roughness: el.roughness,
    seed: el.seed,
    elementId: el.id,
  });
  return shape;
}

/**
 * Apply a partial style update to an existing sketchy Konva.Shape.
 * Mutates the shape's attrs so the next redraw picks up the new values.
 */
export function updateSketchyAttrs(shape, patch) {
  const styleKeys = ['strokeColor', 'backgroundColor', 'fillStyle', 'strokeWidth', 'strokeStyle', 'roughness'];
  styleKeys.forEach((k) => {
    if (patch[k] !== undefined) shape.attrs[k] = patch[k];
  });
  if (patch.x !== undefined) shape.x(patch.x);
  if (patch.y !== undefined) shape.y(patch.y);
  if (patch.width !== undefined) shape.width(patch.width);
  if (patch.height !== undefined) shape.height(patch.height);
  if (patch.angle !== undefined) shape.rotation(patch.angle);
  if (patch.opacity !== undefined) shape.opacity(patch.opacity);
}
