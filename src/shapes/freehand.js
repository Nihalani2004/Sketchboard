/**
 * freehand.js — Renders a freedraw element using perfect-freehand.
 * Converts the output outline into a filled Konva.Shape. Supports background fill color & fill style.
 */

import Konva from 'konva';
import rough from 'roughjs';
import { getStroke } from 'perfect-freehand';

/**
 * Build an SVG polygon path string from raw points to fill the interior of a freehand figure.
 */
function getPolygonPathFromPoints(points) {
  if (!points || points.length < 3) return '';
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
  if (!stroke || stroke.length === 0) return '';
  if (stroke.length < 4) {
    const pts = stroke.map(([x, y]) => `${x},${y}`).join(' L ');
    return `M ${pts} Z`;
  }
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
    // fill/stroke for hit detection only (sceneFunc overrides rendering)
    fill: '#000',
    stroke: '#000',
    strokeWidth: 0,
    sceneFunc(ctx, shape) {
      const attrs = shape.attrs;
      const rawPoints = attrs.elementPoints || [];
      if (rawPoints.length < 1) return;

      // 1. Fill background if set and not transparent
      if (attrs.backgroundColor && attrs.backgroundColor !== 'transparent' && rawPoints.length >= 3) {
        const fillPathStr = getPolygonPathFromPoints(rawPoints);
        if (fillPathStr) {
          if (attrs.fillStyle === 'hachure' || attrs.fillStyle === 'cross-hatch') {
            const rc = rough.canvas(ctx.canvas);
            rc.path(fillPathStr, {
              stroke: 'none',
              fill: attrs.backgroundColor,
              fillStyle: attrs.fillStyle,
              roughness: attrs.roughness ?? 0,
              seed: attrs.seed || 1,
            });
          } else {
            const fillPath2d = new Path2D(fillPathStr);
            ctx._context.fillStyle = attrs.backgroundColor;
            ctx._context.fill(fillPath2d);
          }
        }
      }

      // 2. Draw stroke outline on top
      const stroke = getStroke(rawPoints, {
        size: (attrs.strokeWidth || 2) * 3,
        thinning: 0.5,
        smoothing: 0.5,
        streamline: 0.5,
        simulatePressure: true,
      });

      const pathStr = getSvgPathFromStroke(stroke);
      if (!pathStr) return;

      const isDark = document.documentElement.classList.contains('dark');
      let strokeColor = attrs.strokeColor || '#1e1e1e';
      if (isDark && (strokeColor === '#1e1e1e' || strokeColor === '#000000' || strokeColor === '#000')) {
        strokeColor = '#e8e8e8';
      }

      const path2d = new Path2D(pathStr);
      ctx._context.fillStyle = strokeColor;
      ctx._context.fill(path2d);
    },
    hitFunc(ctx, shape) {
      const w = shape.width() || 50;
      const h = shape.height() || 50;
      ctx.beginPath();
      ctx.rect(0, 0, w, h);
      ctx.closePath();
      ctx.fillStrokeShape(shape);
    },
  });

  Object.assign(shape.attrs, {
    elementPoints: el.points || [],
    strokeColor: el.strokeColor,
    backgroundColor: el.backgroundColor,
    fillStyle: el.fillStyle,
    strokeWidth: el.strokeWidth,
    roughness: el.roughness,
    seed: el.seed,
    elementId: el.id,
    elementType: 'freedraw',
  });

  if (el.width) shape.width(el.width);
  if (el.height) shape.height(el.height);

  return shape;
}
