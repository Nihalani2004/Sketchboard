/**
 * snapping.js — Compute snap targets and draw temporary alignment guides.
 */

import Konva from 'konva';
import { getElements } from './scene.js';
import { getTransformerLayer, getScale } from './stage.js';

const SNAP_THRESHOLD = 8; // px at scale=1; adjusted for current zoom

let guideLines = [];

/** Remove all active guide lines from the transformer layer */
export function clearGuides() {
  guideLines.forEach((l) => l.destroy());
  guideLines = [];
  getTransformerLayer().batchDraw();
}

/**
 * Compute snap candidates from all other elements + grid.
 * @param {string} draggedId - the element being dragged (exclude from candidates)
 * @returns {{ vertical: number[], horizontal: number[] }}
 */
function getSnapCandidates(draggedId) {
  const elements = getElements();
  const vertical = new Set();
  const horizontal = new Set();

  elements.forEach((el) => {
    if (el.id === draggedId) return;
    vertical.add(el.x);
    vertical.add(el.x + el.width / 2);
    vertical.add(el.x + el.width);
    horizontal.add(el.y);
    horizontal.add(el.y + el.height / 2);
    horizontal.add(el.y + el.height);
  });

  return { vertical: [...vertical], horizontal: [...horizontal] };
}

/**
 * Compute snap offsets and draw guides for a dragged node.
 * @param {Konva.Node} node
 * @param {string} elementId
 * @returns {{ x: number, y: number }} snapped position
 */
export function computeSnap(node, elementId) {
  const scale = getScale();
  const threshold = SNAP_THRESHOLD / scale;
  const { vertical, horizontal } = getSnapCandidates(elementId);

  const nodeX = node.x();
  const nodeY = node.y();
  const nodeW = node.width() * (node.scaleX ? node.scaleX() : 1);
  const nodeH = node.height() * (node.scaleY ? node.scaleY() : 1);

  const edges = {
    x: [nodeX, nodeX + nodeW / 2, nodeX + nodeW],
    y: [nodeY, nodeY + nodeH / 2, nodeY + nodeH],
  };

  clearGuides();

  let snapX = null, snapY = null;

  // Check vertical snap
  for (const edgeX of edges.x) {
    for (const candidate of vertical) {
      if (Math.abs(edgeX - candidate) < threshold) {
        const offset = candidate - edgeX;
        snapX = nodeX + offset;
        _drawGuide('vertical', candidate);
        break;
      }
    }
    if (snapX !== null) break;
  }

  // Check horizontal snap
  for (const edgeY of edges.y) {
    for (const candidate of horizontal) {
      if (Math.abs(edgeY - candidate) < threshold) {
        const offset = candidate - edgeY;
        snapY = nodeY + offset;
        _drawGuide('horizontal', candidate);
        break;
      }
    }
    if (snapY !== null) break;
  }

  return {
    x: snapX !== null ? snapX : nodeX,
    y: snapY !== null ? snapY : nodeY,
  };
}

/** Draw a temporary guide line on the transformer layer */
function _drawGuide(direction, position) {
  const layer = getTransformerLayer();
  const stage = layer.getStage();

  let line;
  if (direction === 'vertical') {
    line = new Konva.Line({
      points: [position, -stage.height() / getScale(), position, stage.height() * 2 / getScale()],
      stroke: '#6366f1',
      strokeWidth: 1 / getScale(),
      dash: [4 / getScale(), 4 / getScale()],
      listening: false,
      name: 'guide',
    });
  } else {
    line = new Konva.Line({
      points: [-stage.width() / getScale(), position, stage.width() * 2 / getScale(), position],
      stroke: '#6366f1',
      strokeWidth: 1 / getScale(),
      dash: [4 / getScale(), 4 / getScale()],
      listening: false,
      name: 'guide',
    });
  }

  layer.add(line);
  guideLines.push(line);
  layer.batchDraw();
}
