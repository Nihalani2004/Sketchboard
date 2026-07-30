/**
 * freehandTool.js — Captures pointer input, runs perfect-freehand, commits on pointerup.
 */

import { getStroke } from 'perfect-freehand';
import Konva from 'konva';
import { createElement, addElement, snapshot } from '../scene.js';
import { getStage, getSceneLayer, getTransformerLayer, screenToStage, getScale } from '../stage.js';
import { push as historyPush } from '../history.js';

let isDrawing = false;
let currentPoints = [];   // [{x, y, pressure}]
let previewShape = null;
let styleDefaults = {};

export function updateFreehandDefaults(patch) {
  Object.assign(styleDefaults, patch);
}

function getPolygonPathFromPoints(points) {
  if (!points || points.length < 3) return '';
  const d = points.reduce((acc, [x, y], i) => {
    if (i === 0) return `M ${x} ${y}`;
    return `${acc} L ${x} ${y}`;
  }, '');
  return d + ' Z';
}

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

/** Activate the freehand tool */
export function activateFreehandTool(onCommit) {
  const stage = getStage();
  const tLayer = getTransformerLayer();

  function onPointerDown(e) {
    if (e.evt.button !== 0) return;
    isDrawing = true;
    currentPoints = [];
    const pos = screenToStage(e.evt.clientX, e.evt.clientY);
    const pressure = e.evt.pressure !== undefined ? e.evt.pressure : 0.5;
    currentPoints.push([pos.x, pos.y, pressure]);

    // Create preview shape
    previewShape = new Konva.Shape({
      x: 0, y: 0,
      listening: false,
      sceneFunc(ctx, shape) {
        const pts = shape.attrs._pts || [];
        if (pts.length < 2) return;

        // Render live fill if set
        if (styleDefaults.backgroundColor && styleDefaults.backgroundColor !== 'transparent' && pts.length >= 3) {
          const fillPathStr = getPolygonPathFromPoints(pts);
          if (fillPathStr) {
            const fillPath2d = new Path2D(fillPathStr);
            ctx._context.fillStyle = styleDefaults.backgroundColor;
            ctx._context.globalAlpha = styleDefaults.opacity ?? 1;
            ctx._context.fill(fillPath2d);
          }
        }

        const stroke = getStroke(pts, {
          size: (styleDefaults.strokeWidth || 2) * 3,
          thinning: 0.5,
          smoothing: 0.5,
          streamline: 0.5,
          simulatePressure: true,
        });
        const pathStr = getSvgPathFromStroke(stroke);
        if (!pathStr) return;
        const path2d = new Path2D(pathStr);
        ctx._context.fillStyle = styleDefaults.strokeColor || '#1e1e1e';
        ctx._context.globalAlpha = styleDefaults.opacity ?? 1;
        ctx._context.fill(path2d);
        ctx._context.globalAlpha = 1;
      },
    });
    previewShape.attrs._pts = currentPoints;
    tLayer.add(previewShape);
  }

  function onPointerMove(e) {
    if (!isDrawing) return;
    const pos = screenToStage(e.evt.clientX, e.evt.clientY);
    const pressure = e.evt.pressure !== undefined ? e.evt.pressure : 0.5;
    currentPoints.push([pos.x, pos.y, pressure]);
    if (previewShape) {
      previewShape.attrs._pts = [...currentPoints];
      tLayer.batchDraw();
    }
  }

  function onPointerUp() {
    if (!isDrawing) return;
    isDrawing = false;

    if (previewShape) {
      previewShape.destroy();
      previewShape = null;
    }
    tLayer.batchDraw();

    if (currentPoints.length < 3) { currentPoints = []; return; }

    // Compute bounding box of raw points
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    currentPoints.forEach(([x, y]) => {
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
    });

    // Normalise points relative to bounding-box origin
    const normPoints = currentPoints.map(([x, y, p]) => [x - minX, y - minY, p]);

    historyPush(snapshot());

    const el = createElement('freedraw', {
      x: minX,
      y: minY,
      width: maxX - minX,
      height: maxY - minY,
      points: normPoints,
      ...styleDefaults,
    });
    addElement(el);
    currentPoints = [];
    if (onCommit) onCommit(el);
  }

  stage.on('pointerdown.freehand', onPointerDown);
  stage.on('pointermove.freehand', onPointerMove);
  stage.on('pointerup.freehand', onPointerUp);

  return () => {
    stage.off('pointerdown.freehand');
    stage.off('pointermove.freehand');
    stage.off('pointerup.freehand');
    if (previewShape) { previewShape.destroy(); previewShape = null; }
    isDrawing = false;
    tLayer.batchDraw();
  };
}
