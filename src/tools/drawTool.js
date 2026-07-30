/**
 * drawTool.js — Generic pointerdown/move/up flow for rectangle, ellipse, line, arrow.
 * Creates a live preview on the transformer layer; commits to scene on pointerup.
 */

import Konva from 'konva';
import { createElement, addElement, snapshot } from '../scene.js';
import { getStage, getSceneLayer, getTransformerLayer, screenToStage } from '../stage.js';
import { createSketchyRect, createSketchyEllipse, createSketchyLine, createSketchyArrow, createSketchyDiamond } from '../shapes/sketchyShape.js';
import { push as historyPush } from '../history.js';

let isDrawing = false;
let startPos = null;
let previewShape = null;
let activeType = null;
let styleDefaults = {};

/** Set the current draw type ('rectangle'|'ellipse'|'line'|'arrow') and defaults */
export function setDrawType(type, defaults) {
  activeType = type;
  styleDefaults = { ...defaults };
}

export function updateDrawDefaults(patch) {
  Object.assign(styleDefaults, patch);
}

/** Activate the draw tool — attaches event listeners to the stage */
export function activateDrawTool(onCommit) {
  const stage = getStage();

  function onPointerDown(e) {
    if (e.evt.button !== 0) return;
    if (e.target !== stage && e.target !== getSceneLayer()) return;

    isDrawing = true;
    startPos = screenToStage(e.evt.clientX, e.evt.clientY);

    // Create a tiny preview shape
    _createPreview(startPos.x, startPos.y, 1, 1);
  }

  function onPointerMove(e) {
    if (!isDrawing || !previewShape) return;

    const pos = screenToStage(e.evt.clientX, e.evt.clientY);
    let w = pos.x - startPos.x;
    let h = pos.y - startPos.y;

    // Shift constraint: square / circle / 15° for line/arrow
    if (e.evt.shiftKey) {
      if (activeType === 'line' || activeType === 'arrow') {
        // Snap to nearest 15° increment
        const angle = Math.atan2(h, w);
        const snapped = Math.round(angle / (Math.PI / 12)) * (Math.PI / 12);
        const len = Math.sqrt(w * w + h * h);
        w = Math.cos(snapped) * len;
        h = Math.sin(snapped) * len;
      } else {
        // Square / circle
        const side = Math.min(Math.abs(w), Math.abs(h));
        w = Math.sign(w) * side;
        h = Math.sign(h) * side;
      }
    }

    previewShape.width(w);
    previewShape.height(h);
    previewShape.x(w < 0 ? startPos.x + w : startPos.x);
    previewShape.y(h < 0 ? startPos.y + h : startPos.y);
    if (previewShape.attrs) {
      previewShape.attrs.width = Math.abs(w);
      previewShape.attrs.height = Math.abs(h);
    }
    getTransformerLayer().batchDraw();
  }

  function onPointerUp(e) {
    if (!isDrawing) return;
    isDrawing = false;

    const pos = screenToStage(e.evt.clientX, e.evt.clientY);
    let w = pos.x - startPos.x;
    let h = pos.y - startPos.y;

    if (e.evt.shiftKey) {
      if (activeType === 'line' || activeType === 'arrow') {
        const angle = Math.atan2(h, w);
        const snapped = Math.round(angle / (Math.PI / 12)) * (Math.PI / 12);
        const len = Math.sqrt(w * w + h * h);
        w = Math.cos(snapped) * len;
        h = Math.sin(snapped) * len;
      } else {
        const side = Math.min(Math.abs(w), Math.abs(h));
        w = Math.sign(w) * side;
        h = Math.sign(h) * side;
      }
    }

    // Remove preview
    if (previewShape) {
      previewShape.destroy();
      previewShape = null;
    }
    getTransformerLayer().batchDraw();

    // If too small (e.g. quick click), give default shape dimensions rather than discarding
    if (Math.abs(w) < 5 && Math.abs(h) < 5) {
      if (activeType === 'line' || activeType === 'arrow') {
        w = 100;
        h = 0;
      } else {
        w = 120;
        h = 80;
      }
    }

    // Normalize negative dimensions
    const x = w < 0 ? startPos.x + w : startPos.x;
    const y = h < 0 ? startPos.y + h : startPos.y;
    const absW = Math.abs(w);
    const absH = Math.abs(h);

    // Commit to scene
    historyPush(snapshot());
    const el = createElement(activeType, {
      x, y,
      width: absW,
      height: absH,
      ...styleDefaults,
    });
    addElement(el);
    if (onCommit) onCommit(el);
  }

  stage.on('pointerdown.drawTool', onPointerDown);
  stage.on('pointermove.drawTool', onPointerMove);
  stage.on('pointerup.drawTool', onPointerUp);

  return () => {
    stage.off('pointerdown.drawTool');
    stage.off('pointermove.drawTool');
    stage.off('pointerup.drawTool');
    if (previewShape) {
      previewShape.destroy();
      previewShape = null;
    }
    isDrawing = false;
    getTransformerLayer().batchDraw();
  };
}

function _createPreview(x, y, w, h) {
  const layer = getTransformerLayer();

  const mockEl = {
    id: '__preview__',
    x, y, width: w, height: h,
    strokeColor: styleDefaults.strokeColor || '#6366f1',
    backgroundColor: styleDefaults.backgroundColor || 'transparent',
    fillStyle: styleDefaults.fillStyle || 'solid',
    strokeWidth: styleDefaults.strokeWidth || 2,
    strokeStyle: styleDefaults.strokeStyle || 'solid',
    roughness: styleDefaults.roughness ?? 0,
    seed: styleDefaults.seed || Math.floor(Math.random() * 100000),
    opacity: 0.7,
  };

  if (activeType === 'rectangle') previewShape = createSketchyRect(mockEl);
  else if (activeType === 'ellipse') previewShape = createSketchyEllipse(mockEl);
  else if (activeType === 'line') previewShape = createSketchyLine(mockEl);
  else if (activeType === 'arrow') previewShape = createSketchyArrow(mockEl);
  else if (activeType === 'diamond') previewShape = createSketchyDiamond(mockEl);

  if (previewShape) {
    layer.add(previewShape);
    layer.batchDraw();
  }
}
