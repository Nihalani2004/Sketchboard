/**
 * laserTool.js — Transient laser pointer tool.
 * Points are captured ONLY while the left mouse button is held down.
 * A Konva.Animation fades out old points; never touches scene.js.
 */

import Konva from 'konva';
import { getStage, getLaserLayer, screenToStage } from '../stage.js';

const FADE_MS = 700;
const LASER_COLOR = '#ef4444';

let isActive = false;
let points   = [];   // [{ x, y, t }]
let laserPath = null;
let laserDot  = null;
let anim      = null;

export function activateLaserTool() {
  const stage = getLaserLayer().getStage() || getStage();
  const layer = getLaserLayer();

  // Trail line — explicitly set fill to '' so Konva never fills the path
  laserPath = new Konva.Line({
    points: [],
    stroke: LASER_COLOR,
    strokeWidth: 4,
    lineCap: 'round',
    lineJoin: 'round',
    fill: '',           // ← prevents the black "fill" artefact
    closed: false,      // ← never auto-close the path
    listening: false,
    opacity: 1,
  });

  // Glowing dot at cursor tip
  laserDot = new Konva.Circle({
    radius: 6,
    fill: LASER_COLOR,
    stroke: '',         // ← no outline on the dot
    listening: false,
    visible: false,
    shadowColor: LASER_COLOR,
    shadowBlur: 14,
    shadowOpacity: 0.9,
  });

  layer.add(laserPath);
  layer.add(laserDot);
  layer.batchDraw();

  // ── Button-gated capture ─────────────────────────────────────────────────
  stage.on('pointerdown.laser', (e) => {
    if (e.evt.button === 0) {
      isActive = true;
      points = [];
      const pos = screenToStage(e.evt.clientX, e.evt.clientY);
      points.push({ x: pos.x, y: pos.y, t: Date.now() });
      laserDot.x(pos.x);
      laserDot.y(pos.y);
      laserDot.visible(true);
    }
  });

  stage.on('pointermove.laser', (e) => {
    if (!isActive) return;
    const pos = screenToStage(e.evt.clientX, e.evt.clientY);
    points.push({ x: pos.x, y: pos.y, t: Date.now() });
    laserDot.x(pos.x);
    laserDot.y(pos.y);
  });

  // Separate off() calls — Konva may not parse space-separated names reliably
  const _stopCapture = () => {
    isActive = false;
    laserDot.visible(false);
  };
  stage.on('pointerup.laser',    _stopCapture);
  stage.on('pointerleave.laser', _stopCapture);

  // ── Animation: drop old points, fade trail ───────────────────────────────
  anim = new Konva.Animation(() => {
    const now = Date.now();
    points = points.filter((p) => now - p.t < FADE_MS);

    if (points.length < 2) {
      laserPath.points([]);
      laserPath.opacity(0);
    } else {
      const flat = points.flatMap((p) => [p.x, p.y]);
      laserPath.points(flat);
      // Fade from oldest point's age
      const oldestAge = now - points[0].t;
      laserPath.opacity(Math.max(0, 1 - oldestAge / FADE_MS));
    }
  }, layer);

  anim.start();

  return () => {
    stage.off('pointerdown.laser');
    stage.off('pointermove.laser');
    stage.off('pointerup.laser');
    stage.off('pointerleave.laser');
    if (anim)      { anim.stop(); anim = null; }
    if (laserPath) { laserPath.destroy(); laserPath = null; }
    if (laserDot)  { laserDot.destroy();  laserDot  = null; }
    points   = [];
    isActive = false;
    layer.batchDraw();
  };
}
