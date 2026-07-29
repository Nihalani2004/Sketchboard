/**
 * laserTool.js — Transient laser pointer tool.
 * Points are captured ONLY while the left mouse button is held down.
 * A Konva.Animation fades out old points; never touches scene.js.
 *
 * The laser layer has hitGraphEnabled=false and listening=false so it never
 * interferes with other tools' event handling.
 */

import Konva from 'konva';
import { getStage, getLaserLayer, screenToStage } from '../stage.js';

const FADE_MS = 700;

let isActive = false;
let points = [];
let laserPath = null;
let laserDot = null;
let anim = null;

/** Activate the laser tool */
export function activateLaserTool() {
  const stage = getStage();
  const layer = getLaserLayer();

  // Ensure the laser layer doesn't interfere with hit detection
  layer.hitGraphEnabled(false);

  // Main laser trail — pure red line, NO fill, NO default black stroke
  laserPath = new Konva.Line({
    points: [],
    stroke: '#ef4444',
    strokeWidth: 3,
    fill: null,
    lineCap: 'round',
    lineJoin: 'round',
    listening: false,
    hitStrokeWidth: 0,
    perfectDrawEnabled: false,
    shadowColor: '#ef4444',
    shadowBlur: 10,
    shadowOpacity: 0.7,
    shadowEnabled: true,
  });

  // Glowing dot at cursor tip
  laserDot = new Konva.Circle({
    radius: 5,
    fill: '#ef4444',
    stroke: null,
    strokeWidth: 0,
    listening: false,
    hitStrokeWidth: 0,
    shadowColor: '#ef4444',
    shadowBlur: 14,
    shadowOpacity: 0.9,
    shadowEnabled: true,
    visible: false,
  });

  layer.add(laserPath);
  layer.add(laserDot);

  // ── Button-gated: only capture while left button held ──────────────────
  function onPointerDown(e) {
    if (e.evt.button !== 0) return;
    // Prevent the event from triggering any other tool logic
    e.cancelBubble = true;
    isActive = true;
    points = [];
    const pos = screenToStage(e.evt.clientX, e.evt.clientY);
    points.push({ x: pos.x, y: pos.y, t: Date.now() });
    laserDot.x(pos.x);
    laserDot.y(pos.y);
    laserDot.visible(true);
    layer.batchDraw();
  }

  function onPointerMove(e) {
    if (!isActive) return;
    const pos = screenToStage(e.evt.clientX, e.evt.clientY);
    points.push({ x: pos.x, y: pos.y, t: Date.now() });
    laserDot.x(pos.x);
    laserDot.y(pos.y);
  }

  function onPointerUp() {
    isActive = false;
    laserDot.visible(false);
    layer.batchDraw();
  }

  // Use the native DOM container instead of Konva stage events to avoid
  // bubbling into selection/draw tool handlers
  const container = stage.container();
  container.addEventListener('pointerdown', _nativePointerDown);
  container.addEventListener('pointermove', _nativePointerMove);
  container.addEventListener('pointerup', _nativePointerUp);
  container.addEventListener('pointerleave', _nativePointerUp);

  function _nativePointerDown(e) {
    if (e.button !== 0) return;
    isActive = true;
    points = [];
    const rect = container.getBoundingClientRect();
    const pos = screenToStage(e.clientX, e.clientY);
    points.push({ x: pos.x, y: pos.y, t: Date.now() });
    laserDot.x(pos.x);
    laserDot.y(pos.y);
    laserDot.visible(true);
    layer.batchDraw();
  }

  function _nativePointerMove(e) {
    if (!isActive) return;
    const pos = screenToStage(e.clientX, e.clientY);
    points.push({ x: pos.x, y: pos.y, t: Date.now() });
    laserDot.x(pos.x);
    laserDot.y(pos.y);
  }

  function _nativePointerUp() {
    isActive = false;
    laserDot.visible(false);
    layer.batchDraw();
  }

  // ── Animation: drop old points, draw fading trail ─────────────────────
  anim = new Konva.Animation(() => {
    const now = Date.now();

    // Drop expired points
    points = points.filter((p) => now - p.t < FADE_MS);

    if (points.length < 2) {
      laserPath.points([]);
      return;
    }

    // Build flat array for Konva.Line
    const flat = [];
    for (let i = 0; i < points.length; i++) {
      flat.push(points[i].x, points[i].y);
    }
    laserPath.points(flat);

    // Fade opacity based on the oldest remaining point's age
    const oldestAge = now - points[0].t;
    const alpha = Math.max(0, 1 - oldestAge / FADE_MS);
    laserPath.opacity(alpha);
  }, layer);

  anim.start();

  return () => {
    // Remove native DOM listeners
    container.removeEventListener('pointerdown', _nativePointerDown);
    container.removeEventListener('pointermove', _nativePointerMove);
    container.removeEventListener('pointerup', _nativePointerUp);
    container.removeEventListener('pointerleave', _nativePointerUp);

    if (anim) { anim.stop(); anim = null; }
    if (laserPath) { laserPath.destroy(); laserPath = null; }
    if (laserDot) { laserDot.destroy(); laserDot = null; }
    points = [];
    isActive = false;
    layer.batchDraw();
  };
}
