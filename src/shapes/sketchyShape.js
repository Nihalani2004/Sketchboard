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
import { supportsShapeLabel } from './catalog.js';

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
    flipX: el.flipX || false,
    flipY: el.flipY || false,
    label: el.label || '',
    fontSize: el.fontSize,
    fontFamily: el.fontFamily,
  });
}

function getLabelColor(attrs) {
  const isDark = document.documentElement.classList.contains('dark');
  const color = attrs.strokeColor || '#1e1e1e';
  return isDark && (color === '#1e1e1e' || color === '#000000' || color === '#000') ? '#e8e8e8' : color;
}

function wrapLabel(context, label, maxWidth) {
  const lines = [];
  label.split(/\r?\n/).forEach((paragraph) => {
    const words = paragraph.split(/\s+/).filter(Boolean);
    if (words.length === 0) { lines.push(''); return; }
    let line = words.shift();
    words.forEach((word) => {
      const candidate = `${line} ${word}`;
      if (context.measureText(candidate).width <= maxWidth) line = candidate;
      else { lines.push(line); line = word; }
    });
    lines.push(line);
  });
  return lines;
}

/** Draw a centred label without creating a second selectable Konva node. */
function drawShapeLabel(ctx, shape) {
  const attrs = shape.attrs;
  if (!supportsShapeLabel(attrs.elementType) || !attrs.label?.trim()) return;
  const context = ctx._context || ctx;
  const width = shape.width();
  const height = shape.height();
  const fontSize = Math.max(8, Math.min(96, attrs.fontSize || 20));
  const diamondInset = (attrs.elementType === 'diamond' || attrs.elementType === 'flowchart-decision')
    ? Math.min(width, height) * 0.22
    : 0;
  const maxWidth = Math.max(16, width - diamondInset * 2 - 16);
  const maxHeight = Math.max(fontSize, height - 16);

  context.save();
  context.beginPath();
  context.rect(0, 0, width, height);
  context.clip();
  context.fillStyle = getLabelColor(attrs);
  context.font = `${fontSize}px ${attrs.fontFamily || "'Caveat', cursive"}`;
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  const lineHeight = fontSize * 1.2;
  const lines = wrapLabel(context, attrs.label.trim(), maxWidth);
  const visibleLines = lines.slice(0, Math.max(1, Math.floor(maxHeight / lineHeight)));
  const firstY = height / 2 - ((visibleLines.length - 1) * lineHeight) / 2;
  visibleLines.forEach((line, index) => context.fillText(line, width / 2, firstY + index * lineHeight, maxWidth));
  context.restore();
}

/* ─── Rectangle ────────────────────────────────────────────────────────── */

export function createSketchyRect(el) {
  const shape = new Konva.Shape({
    ...baseAttrs(el),
    sceneFunc(ctx, shape) {
      const rc = rough.canvas(ctx.canvas);
      rc.rectangle(0, 0, shape.width(), shape.height(), getRoughOptions(shape.attrs));
      drawShapeLabel(ctx, shape);
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
      drawShapeLabel(ctx, shape);
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
      drawShapeLabel(ctx, shape);
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

function createCustomShape(el, draw) {
  const shape = new Konva.Shape({
    ...baseAttrs(el),
    sceneFunc(ctx, node) {
      draw(rough.canvas(ctx.canvas), node.width(), node.height(), getRoughOptions(node.attrs));
      drawShapeLabel(ctx, node);
    },
    hitFunc(ctx, node) {
      ctx.beginPath();
      ctx.rect(0, 0, node.width(), node.height());
      ctx.closePath();
      ctx.fillStrokeShape(node);
    },
  });
  applyStyleAttrs(shape, el);
  return shape;
}

export function createSketchyTriangle(el) {
  return createCustomShape(el, (rc, w, h, options) => rc.polygon([[w / 2, 0], [w, h], [0, h]], options));
}

export function createSketchyRoundedRect(el) {
  return createCustomShape(el, (rc, w, h, options) => {
    const radius = Math.min(w, h) * 0.18;
    rc.path(`M ${radius} 0 H ${w - radius} Q ${w} 0 ${w} ${radius} V ${h - radius} Q ${w} ${h} ${w - radius} ${h} H ${radius} Q 0 ${h} 0 ${h - radius} V ${radius} Q 0 0 ${radius} 0 Z`, options);
  });
}

export function createSketchyCloud(el) {
  return createCustomShape(el, (rc, w, h, options) => {
    rc.path(`M ${w * 0.18} ${h * 0.78} C ${w * 0.04} ${h * 0.78}, ${w * 0.02} ${h * 0.56}, ${w * 0.16} ${h * 0.49} C ${w * 0.12} ${h * 0.25}, ${w * 0.38} ${h * 0.1}, ${w * 0.52} ${h * 0.28} C ${w * 0.68} ${h * 0.06}, ${w * 0.96} ${h * 0.26}, ${w * 0.85} ${h * 0.5} C ${w * 1.03} ${h * 0.63}, ${w * 0.91} ${h * 0.84}, ${w * 0.74} ${h * 0.78} Z`, options);
  });
}

export function createSketchyCallout(el) {
  return createCustomShape(el, (rc, w, h, options) => {
    const tip = Math.min(w, h) * 0.22;
    rc.polygon([[0, 0], [w, 0], [w, h - tip], [w * 0.42, h - tip], [w * 0.25, h], [w * 0.3, h - tip], [0, h - tip]], options);
  });
}

export function createSketchyStickyNote(el) {
  return createCustomShape(el, (rc, w, h, options) => {
    const fold = Math.min(w, h) * 0.23;
    rc.polygon([[0, 0], [w - fold, 0], [w, fold], [w, h], [0, h]], options);
    const lineOptions = { ...options };
    delete lineOptions.fill;
    rc.linearPath([[w - fold, 0], [w - fold, fold], [w, fold]], lineOptions);
  });
}

export function createFlowchartProcess(el) {
  return createCustomShape(el, (rc, w, h, options) => rc.rectangle(0, 0, w, h, options));
}

export function createFlowchartTerminator(el) {
  return createSketchyRoundedRect(el);
}

export function createFlowchartDecision(el) {
  return createSketchyDiamond(el);
}

export function createFlowchartInputOutput(el) {
  return createCustomShape(el, (rc, w, h, options) => {
    const inset = Math.min(w * 0.2, h * 0.45);
    rc.polygon([[inset, 0], [w, 0], [w - inset, h], [0, h]], options);
  });
}

export function createFlowchartDocument(el) {
  return createCustomShape(el, (rc, w, h, options) => {
    rc.path(`M 0 0 H ${w} V ${h * 0.78} C ${w * 0.82} ${h * 0.62}, ${w * 0.68} ${h * 0.98}, ${w * 0.5} ${h * 0.8} C ${w * 0.32} ${h * 0.62}, ${w * 0.16} ${h * 0.98}, 0 ${h * 0.8} Z`, options);
  });
}

export function createFlowchartDatabase(el) {
  return createCustomShape(el, (rc, w, h, options) => {
    rc.path(`M 0 ${h * 0.18} C 0 ${h * 0.04}, ${w} ${h * 0.04}, ${w} ${h * 0.18} V ${h * 0.8} C ${w} ${h * 0.98}, 0 ${h * 0.98}, 0 ${h * 0.8} Z`, options);
    const lineOptions = { ...options };
    delete lineOptions.fill;
    rc.path(`M 0 ${h * 0.18} C 0 ${h * 0.36}, ${w} ${h * 0.36}, ${w} ${h * 0.18}`, lineOptions);
  });
}

/* ─── Line ─────────────────────────────────────────────────────────────── */

export function createSketchyLine(el) {
  const shape = new Konva.Shape({
    ...baseAttrs(el),
    sceneFunc(ctx, shape) {
      const rc = rough.canvas(ctx.canvas);
      const opts = getRoughOptions(shape.attrs);
      delete opts.fill;
      const w = shape.width(), h = shape.height();
      const startX = shape.attrs.flipX ? w : 0;
      const startY = shape.attrs.flipY ? h : 0;
      const endX = shape.attrs.flipX ? 0 : w;
      const endY = shape.attrs.flipY ? 0 : h;
      rc.line(startX, startY, endX, endY, opts);
    },
    hitFunc(ctx, shape) {
      const w = shape.width(), h = shape.height();
      const t = Math.max(shape.attrs.strokeWidth || 2, 14);
      const startX = shape.attrs.flipX ? w : 0;
      const startY = shape.attrs.flipY ? h : 0;
      const endX = shape.attrs.flipX ? 0 : w;
      const endY = shape.attrs.flipY ? 0 : h;
      const a = Math.atan2(endY - startY, endX - startX);
      const nx = -Math.sin(a) * t / 2;
      const ny = Math.cos(a) * t / 2;
      ctx.beginPath();
      ctx.moveTo(startX + nx, startY + ny);
      ctx.lineTo(endX + nx, endY + ny);
      ctx.lineTo(endX - nx, endY - ny);
      ctx.lineTo(startX - nx, startY - ny);
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

      // Elements use normalized (positive) bounds. Flip flags identify which
      // corner is the drag start so the arrowhead stays at the actual endpoint.
      const startX = shape.attrs.flipX ? w : 0;
      const startY = shape.attrs.flipY ? h : 0;
      const endX = shape.attrs.flipX ? 0 : w;
      const endY = shape.attrs.flipY ? 0 : h;

      rc.line(startX, startY, endX, endY, opts);

      const angle = Math.atan2(endY - startY, endX - startX);
      const headLen = Math.max(12, (shape.attrs.strokeWidth || 2) * 5);
      const headAngle = Math.PI / 6;
      const ax1 = endX - headLen * Math.cos(angle - headAngle);
      const ay1 = endY - headLen * Math.sin(angle - headAngle);
      const ax2 = endX - headLen * Math.cos(angle + headAngle);
      const ay2 = endY - headLen * Math.sin(angle + headAngle);

      rc.linearPath([[ax1, ay1], [endX, endY], [ax2, ay2]], {
        ...opts,
        roughness: opts.roughness ?? 0,
      });
    },
    hitFunc(ctx, shape) {
      const w = shape.width(), h = shape.height();
      const t = Math.max(shape.attrs.strokeWidth || 2, 14);
      const startX = shape.attrs.flipX ? w : 0;
      const startY = shape.attrs.flipY ? h : 0;
      const endX = shape.attrs.flipX ? 0 : w;
      const endY = shape.attrs.flipY ? 0 : h;
      const a = Math.atan2(endY - startY, endX - startX);
      const nx = -Math.sin(a) * t / 2;
      const ny = Math.cos(a) * t / 2;
      ctx.beginPath();
      ctx.moveTo(startX + nx, startY + ny);
      ctx.lineTo(endX + nx, endY + ny);
      ctx.lineTo(endX - nx, endY - ny);
      ctx.lineTo(startX - nx, startY - ny);
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
