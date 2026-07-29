/**
 * freehand.js — Renders a freedraw element using perfect-freehand.
 * Converts the output outline into a filled Konva.Shape.
 */

import Konva from 'konva';
import { getStroke } from 'perfect-freehand';

/**
 * Convert perfect-freehand's output (array of [x,y] pairs) into an SVG path string.
 */
function outlineToPath(points) {
  if (!points || points.length < 2) return '';
  const d = points.reduce((acc, [x, y], i) => {
    if (i === 0) return `M ${x} ${y}`;
    return `${acc} L ${x} ${y}`;
  }, '');
  return d + ' Z';
}

/**
 * Build a Path2D from the stroke output for efficient canvas rendering.
 */
function getSvgPathFromStroke(stroke) {
  if (!stroke || stroke.length < 4) return '';
  const d = [];
  const [first, ...rest] = stroke;
  d.push(`M ${first[0]},${first[1]}`);

  for (let i = 0; i < rest.length; i++) {
    const [x0, y0] = rest[i];
    const [x1, y1] = rest[(i + 1) % rest.length];
    const mx = (x0 + x1) / 2;
    const my = (y0 + y1) / 2;
    d.push(`Q ${x0},${y0} ${mx},${my}`);
  }
  d.push('Z');
  return d.join(' ');
}

/**
 * Create a Konva.Shape from a freedraw element.
 * @param {object} el - scene element with type === 'freedraw'
 */
export function createFreehandShape(el) {
  const shape = new Konva.Shape({
    x: el.x,
    y: el.y,
    rotation: el.angle || 0,
    opacity: el.opacity ?? 1,
    id: el.id,
    draggable: false,
    name: 'element',
    sceneFunc(ctx, shape) {
      const attrs = shape.attrs;
      const rawPoints = attrs.elementPoints || [];

      if (rawPoints.length < 2) return;

      const stroke = getStroke(rawPoints, {
        size: (attrs.strokeWidth || 2) * 3,
        thinning: 0.5,
        smoothing: 0.5,
        streamline: 0.5,
        simulatePressure: true,
      });

      const pathStr = getSvgPathFromStroke(stroke);
      if (!pathStr) return;

      const path2d = new Path2D(pathStr);
      ctx._context.fillStyle = attrs.strokeColor || '#1e1e1e';
      ctx._context.fill(path2d);
    },
    hitFunc(ctx, shape) {
      const attrs = shape.attrs;
      const rawPoints = attrs.elementPoints || [];
      if (rawPoints.length < 2) return;

      const stroke = getStroke(rawPoints, {
        size: (attrs.strokeWidth || 2) * 3 + 10,
        thinning: 0,
        smoothing: 0.5,
        streamline: 0.5,
        simulatePressure: true,
      });
      const pathStr = getSvgPathFromStroke(stroke);
      if (!pathStr) return;
      const path2d = new Path2D(pathStr);
      ctx._context.fill(path2d);
      ctx.fillStrokeShape(shape);
    },
  });

  Object.assign(shape.attrs, {
    elementPoints: el.points || [],
    strokeColor: el.strokeColor,
    strokeWidth: el.strokeWidth,
    elementId: el.id,
  });

  // Calculate bounding box for the shape
  if (el.width) shape.width(el.width);
  if (el.height) shape.height(el.height);

  return shape;
}
