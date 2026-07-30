/**
 * sketchyShape.js — Shared factory: builds a Konva.Shape whose sceneFunc
 * delegates to a rough.js renderer, giving all shapes a hand-drawn aesthetic.
 *
 * Hit detection: Each shape sets `fill: '#000'` in the Konva config. Since we
 * provide a custom sceneFunc, Konva NEVER draws this fill on screen — only our
 * rough.js code runs for visual rendering. But the fill attribute makes
 * fillStrokeShape() work in hitFunc, enabling click/drag/select.
 */

import Konva from 'konva';
import rough from 'roughjs';

/**
 * Build rough.js options from an element's style properties.
 */
function getRoughOptions(el) {
  const r = el.roughness ?? 0;
  const isDark = document.documentElement.classList.contains('dark');
  let stroke = el.strokeColor || '#1e1e1e';
  if (isDark && (stroke === '#1e1e1e' || stroke === '#000000' || stroke === '#000')) {
    stroke = '#e8e8e8';
  }

  return {
    stroke,
    strokeWidth: el.strokeWidth || 2,
    roughness: r,
    bowing: r === 0 ? 0 : r,
    seed: el.seed || 1,
    fill: el.backgroundColor !== 'transparent' && el.backgroundColor
      ? el.backgroundColor
      : undefined,
    fillStyle: el.fillStyle || 'solid',
    strokeLineDash: el.strokeStyle === 'dashed'
      ? [8, 6]
      : el.strokeStyle === 'dotted'
      ? [2, 6]
      : undefined,
  };
}

/* ─── helpers ──────────────────────────────────────────────────────────── */

/** Common Konva attrs for every shape */
function baseAttrs(el) {
  return {
    x: el.x,
    y: el.y,
    width: el.width,
    height: el.height,
    rotation: el.angle || 0,
    opacity: el.opacity ?? 1,
    id: el.id,
    draggable: false,
    name: 'element',
    // fill/stroke are for HIT DETECTION only. Custom sceneFunc fully
    // overrides visual rendering, so these are never painted on screen.
    fill: '#000',
    stroke: '#000',
    strokeWidth: 0,
  };
}

/** Copy element style props into shape.attrs for later use by sceneFunc */
function applyStyleAttrs(shape, el) {
  Object.assign(shape.attrs, {
    strokeColor: el.strokeColor,
    backgroundColor: el.backgroundColor,
    fillStyle: el.fillStyle,
    strokeWidth: el.strokeWidth,
    strokeStyle: el.strokeStyle,
    roughness: el.roughness,
    seed: el.seed,
    elementId: el.id,
    elementType: el.type,
  });
}

/* ─── Rectangle ────────────────────────────────────────────────────────── */

export function createSketchyRect(el) {
  const shape = new Konva.Shape({
    ...baseAttrs(el),
    sceneFunc(ctx, shape) {
      const rc = rough.canvas(ctx.canvas);
      rc.rectangle(0, 0, shape.width(), shape.height(), getRoughOptions(shape.attrs));
    },
    hitFunc(ctx, shape) {
      ctx.beginPath();
      ctx.rect(0, 0, shape.width(), shape.height());
      ctx.closePath();
      ctx.fillStrokeShape(shape);
    },
  });
  applyStyleAttrs(shape, el);
  return shape;
}

/* ─── Ellipse ──────────────────────────────────────────────────────────── */

export function createSketchyEllipse(el) {
  const shape = new Konva.Shape({
    ...baseAttrs(el),
    sceneFunc(ctx, shape) {
      const w = shape.width(), h = shape.height();
      const rc = rough.canvas(ctx.canvas);
      rc.ellipse(w / 2, h / 2, w, h, getRoughOptions(shape.attrs));
    },
    hitFunc(ctx, shape) {
      const w = shape.width(), h = shape.height();
      ctx.beginPath();
      ctx.ellipse(w / 2, h / 2, w / 2, h / 2, 0, 0, Math.PI * 2);
      ctx.closePath();
      ctx.fillStrokeShape(shape);
    },
  });
  applyStyleAttrs(shape, el);
  return shape;
}

/* ─── Diamond ──────────────────────────────────────────────────────────── */

export function createSketchyDiamond(el) {
  const shape = new Konva.Shape({
    ...baseAttrs(el),
    sceneFunc(ctx, shape) {
      const w = shape.width(), h = shape.height();
      const rc = rough.canvas(ctx.canvas);
      const points = [[w / 2, 0], [w, h / 2], [w / 2, h], [0, h / 2]];
      rc.polygon(points, getRoughOptions(shape.attrs));
    },
    hitFunc(ctx, shape) {
      const w = shape.width(), h = shape.height();
      ctx.beginPath();
      ctx.moveTo(w / 2, 0);
      ctx.lineTo(w, h / 2);
      ctx.lineTo(w / 2, h);
      ctx.lineTo(0, h / 2);
      ctx.closePath();
      ctx.fillStrokeShape(shape);
    },
  });
  applyStyleAttrs(shape, el);
  return shape;
}

/* ─── Line ─────────────────────────────────────────────────────────────── */

export function createSketchyLine(el) {
  const shape = new Konva.Shape({
    ...baseAttrs(el),
    sceneFunc(ctx, shape) {
      const rc = rough.canvas(ctx.canvas);
      const opts = getRoughOptions(shape.attrs);
      delete opts.fill;
      rc.line(0, 0, shape.width(), shape.height(), opts);
    },
    hitFunc(ctx, shape) {
      const w = shape.width(), h = shape.height();
      const t = Math.max(shape.attrs.strokeWidth || 2, 14);
      const a = Math.atan2(h, w);
      const nx = -Math.sin(a) * t / 2;
      const ny = Math.cos(a) * t / 2;
      ctx.beginPath();
      ctx.moveTo(nx, ny);
      ctx.lineTo(w + nx, h + ny);
      ctx.lineTo(w - nx, h - ny);
      ctx.lineTo(-nx, -ny);
      ctx.closePath();
      ctx.fillStrokeShape(shape);
    },
  });
  applyStyleAttrs(shape, el);
  return shape;
}

/* ─── Arrow ────────────────────────────────────────────────────────────── */

export function createSketchyArrow(el) {
  const shape = new Konva.Shape({
    ...baseAttrs(el),
    sceneFunc(ctx, shape) {
      const rc = rough.canvas(ctx.canvas);
      const w = shape.width(), h = shape.height();
      const opts = getRoughOptions(shape.attrs);
      delete opts.fill;

      rc.line(0, 0, w, h, opts);

      const angle = Math.atan2(h, w);
      const headLen = Math.max(12, (shape.attrs.strokeWidth || 2) * 5);
      const headAngle = Math.PI / 6;
      const ax1 = w - headLen * Math.cos(angle - headAngle);
      const ay1 = h - headLen * Math.sin(angle - headAngle);
      const ax2 = w - headLen * Math.cos(angle + headAngle);
      const ay2 = h - headLen * Math.sin(angle + headAngle);

      rc.linearPath([[ax1, ay1], [w, h], [ax2, ay2]], {
        ...opts,
        roughness: opts.roughness ?? 0,
      });
    },
    hitFunc(ctx, shape) {
      const w = shape.width(), h = shape.height();
      const t = Math.max(shape.attrs.strokeWidth || 2, 14);
      const a = Math.atan2(h, w);
      const nx = -Math.sin(a) * t / 2;
      const ny = Math.cos(a) * t / 2;
      ctx.beginPath();
      ctx.moveTo(nx, ny);
      ctx.lineTo(w + nx, h + ny);
      ctx.lineTo(w - nx, h - ny);
      ctx.lineTo(-nx, -ny);
      ctx.closePath();
      ctx.fillStrokeShape(shape);
    },
  });
  applyStyleAttrs(shape, el);
  return shape;
}

/* ─── Style updater ────────────────────────────────────────────────────── */

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
