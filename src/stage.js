/**
 * stage.js — Konva.Stage setup, layers, pan, and zoom.
 *
 * Pan methods:
 *   1. Middle-mouse drag
 *   2. Spacebar + left-click drag
 *   3. Two-finger trackpad scroll (wheel events without ctrlKey)
 * Zoom methods:
 *   1. Ctrl/Cmd + scroll wheel
 *   2. Pinch-to-zoom on trackpad (fires as ctrlKey + wheel)
 */

import Konva from 'konva';

let stage = null;
let sceneLayer = null;
let transformerLayer = null;
let laserLayer = null;

// Pan state
let isPanning = false;
let lastPointerPos = null;
let spaceDown = false;

const MIN_SCALE = 0.05;
const MAX_SCALE = 20;

/** Initialise the Konva stage in the given container element */
export function initStage(container) {
  stage = new Konva.Stage({
    container,
    width: window.innerWidth,
    height: window.innerHeight,
  });

  // Layer ordering: scene → transformer → laser (top)
  sceneLayer = new Konva.Layer({ listening: true });
  transformerLayer = new Konva.Layer({ listening: false });
  laserLayer = new Konva.Layer({ listening: false });

  stage.add(sceneLayer);
  stage.add(transformerLayer);
  stage.add(laserLayer);

  _setupPan();
  _setupZoom();
  _setupResize();

  return stage;
}

/** Expose layers */
export function getStage() { return stage; }
export function getSceneLayer() { return sceneLayer; }
export function getTransformerLayer() { return transformerLayer; }
export function getLaserLayer() { return laserLayer; }

/** Convert a screen-space point to stage (canvas) coordinates */
export function screenToStage(x, y) {
  const pos = stage.getAbsoluteTransform().copy().invert().point({ x, y });
  return pos;
}

/** Current scale factor */
export function getScale() {
  return stage.scaleX();
}

/** Zoom to a target scale, centred on a given screen-space point */
export function zoomTo(newScale, focalX, focalY) {
  newScale = Math.max(MIN_SCALE, Math.min(MAX_SCALE, newScale));
  const oldScale = stage.scaleX();

  const mousePointTo = {
    x: (focalX - stage.x()) / oldScale,
    y: (focalY - stage.y()) / oldScale,
  };

  stage.scale({ x: newScale, y: newScale });
  stage.position({
    x: focalX - mousePointTo.x * newScale,
    y: focalY - mousePointTo.y * newScale,
  });
  stage.batchDraw();

  _onZoomChange();
}

/** Zoom to a percentage (1 = 100%) centred on the stage centre */
export function zoomToPercent(pct) {
  const cx = stage.width() / 2;
  const cy = stage.height() / 2;
  zoomTo(pct, cx, cy);
}

/** Fit all content in view; falls back to 100% if no content */
export function fitView(elements) {
  if (!elements || elements.length === 0) {
    zoomToPercent(1);
    stage.position({ x: 0, y: 0 });
    stage.batchDraw();
    return;
  }

  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  elements.forEach((el) => {
    minX = Math.min(minX, el.x);
    minY = Math.min(minY, el.y);
    maxX = Math.max(maxX, el.x + (el.width || 0));
    maxY = Math.max(maxY, el.y + (el.height || 0));
  });

  const padding = 80;
  const contentW = maxX - minX + padding * 2;
  const contentH = maxY - minY + padding * 2;
  const scaleX = stage.width() / contentW;
  const scaleY = stage.height() / contentH;
  const scale = Math.min(scaleX, scaleY, 1);

  stage.scale({ x: scale, y: scale });
  stage.position({
    x: -minX * scale + padding * scale,
    y: -minY * scale + padding * scale,
  });
  stage.batchDraw();
  _onZoomChange();
}

// ── Zoom change callback ────────────────────────────────────────────────────
let _onZoomChangeCb = null;
export function onZoomChange(cb) { _onZoomChangeCb = cb; }
function _onZoomChange() { if (_onZoomChangeCb) _onZoomChangeCb(stage.scaleX()); }

// ── Pan ─────────────────────────────────────────────────────────────────────
function _setupPan() {
  // Middle-mouse drag or Space + left-click drag
  stage.on('mousedown touchstart', (e) => {
    if (e.evt.button === 1 || spaceDown) {
      isPanning = true;
      lastPointerPos = stage.getPointerPosition();
      stage.container().style.cursor = 'grabbing';
    }
  });

  stage.on('mousemove touchmove', () => {
    if (!isPanning) return;
    const pos = stage.getPointerPosition();
    if (!pos || !lastPointerPos) return;
    const dx = pos.x - lastPointerPos.x;
    const dy = pos.y - lastPointerPos.y;
    stage.position({
      x: stage.x() + dx,
      y: stage.y() + dy,
    });
    lastPointerPos = pos;
    stage.batchDraw();
  });

  stage.on('mouseup touchend mouseleave', () => {
    if (isPanning) {
      isPanning = false;
      stage.container().style.cursor = spaceDown ? 'grab' : '';
    }
  });

  // Spacebar toggles grab cursor & pan mode
  window.addEventListener('keydown', (e) => {
    if (e.code === 'Space' && !e.target.matches('textarea, input')) {
      e.preventDefault();
      spaceDown = true;
      stage.container().style.cursor = 'grab';
    }
  });

  window.addEventListener('keyup', (e) => {
    if (e.code === 'Space') {
      spaceDown = false;
      if (!isPanning) stage.container().style.cursor = '';
      isPanning = false;
    }
  });
}

export function isSpaceDown() { return spaceDown; }
export function isPanningActive() { return isPanning; }

// ── Zoom & Trackpad Pan (wheel) ──────────────────────────────────────────────
function _setupZoom() {
  stage.on('wheel', (e) => {
    e.evt.preventDefault();

    const pointer = stage.getPointerPosition();

    if (e.evt.ctrlKey || e.evt.metaKey) {
      // ── Pinch-to-zoom or Ctrl+scroll → ZOOM ──────────────────────────
      const oldScale = stage.scaleX();
      const delta = -e.evt.deltaY * 0.01;
      const newScale = oldScale * Math.exp(delta);
      zoomTo(newScale, pointer.x, pointer.y);
    } else {
      // ── Two-finger trackpad scroll → PAN ─────────────────────────────
      // On a trackpad, two-finger drag fires wheel events with deltaX/deltaY
      // but without ctrlKey. We use these to pan the canvas.
      const dx = -e.evt.deltaX;
      const dy = -e.evt.deltaY;
      stage.position({
        x: stage.x() + dx,
        y: stage.y() + dy,
      });
      stage.batchDraw();
    }
  });
}

// ── Resize ───────────────────────────────────────────────────────────────────
function _setupResize() {
  window.addEventListener('resize', () => {
    stage.width(window.innerWidth);
    stage.height(window.innerHeight);
    stage.batchDraw();
  });
}
