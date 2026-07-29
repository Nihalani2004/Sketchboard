/**
 * selectionTool.js — Konva.Transformer for move/resize/rotate + multi-select.
 *
 * Features:
 *   - Click a shape to select it, click again to deselect (toggle)
 *   - Shift+click for multi-select
 *   - Rubber-band (marquee) selection
 *   - Drag selected shapes to move them
 *   - Arrow keys to nudge selected shapes (Shift+arrow = 10px)
 *   - Transform handles for resize/rotate
 *   - Double-click text to edit
 */

import Konva from 'konva';
import { getStage, getSceneLayer, getTransformerLayer, screenToStage } from '../stage.js';
import { updateElement, getElements, snapshot, removeElement } from '../scene.js';
import { push as historyPush } from '../history.js';
import { computeSnap, clearGuides } from '../snapping.js';
import { openTextEditForElement } from './textTool.js';

let transformer = null;
let selectedIds = [];
let onSelectionChangeCb = null;
let onElementUpdateCb = null;
let isSelecting = false;
let selStart = null;
let _onRenderNeeded = null;
let _arrowKeyHandler = null;

export function getSelectedIds() { return [...selectedIds]; }

export function onSelectionChange(cb) { onSelectionChangeCb = cb; }
export function onElementUpdate(cb) { onElementUpdateCb = cb; }

function notifySelectionChange() {
  if (onSelectionChangeCb) {
    const elements = getElements().filter((e) => selectedIds.includes(e.id));
    onSelectionChangeCb(elements);
  }
}

/** Activate selection tool */
export function activateSelectionTool(onRenderNeeded) {
  _onRenderNeeded = onRenderNeeded;
  const stage = getStage();
  const sceneLayer = getSceneLayer();
  const tLayer = getTransformerLayer();

  // Create transformer
  transformer = new Konva.Transformer({
    rotateEnabled: true,
    borderStroke: '#6366f1',
    borderStrokeWidth: 1.5,
    anchorFill: '#fff',
    anchorStroke: '#6366f1',
    anchorStrokeWidth: 1.5,
    anchorSize: 9,
    anchorCornerRadius: 3,
    padding: 4,
    keepRatio: false,
    enabledAnchors: ['top-left', 'top-center', 'top-right', 'middle-left', 'middle-right', 'bottom-left', 'bottom-center', 'bottom-right'],
  });
  tLayer.add(transformer);
  tLayer.batchDraw();

  // ── Click to select / toggle ────────────────────────────────────────────
  // Delay click registration by one frame to avoid capturing the trailing click event
  // from the pointerup/mouseup that committed a drawing.
  let clickTimeout = setTimeout(() => {
    if (!stage) return;
    stage.on('click.selTool tap.selTool', (e) => {
      // Click on empty canvas → deselect all
      if (e.target === stage || e.target.name() === 'guide') {
        clearSelection();
        return;
      }

      const node = e.target;
      if (!node.hasName('element')) return;

      const id = node.id();

      if (e.evt.shiftKey) {
        // Multi-select: toggle this element in/out of selection
        if (selectedIds.includes(id)) {
          selectedIds = selectedIds.filter((i) => i !== id);
        } else {
          selectedIds.push(id);
        }
      } else {
        // Single click: toggle — if already the sole selection, deselect
        if (selectedIds.length === 1 && selectedIds[0] === id) {
          clearSelection();
          return;
        }
        selectedIds = [id];
      }

      _applyTransformer();
      notifySelectionChange();
    });
  }, 0);

  // ── Double-click to edit text ──────────────────────────────────────────
  stage.on('dblclick.selTool dbltap.selTool', (e) => {
    const node = e.target;
    if (!node.hasName('element')) return;
    if (node.attrs.elementType !== 'text') return;

    const elements = getElements();
    const el = elements.find((e) => e.id === node.id());
    if (!el) return;

    clearSelection();
    openTextEditForElement(el, (result) => {
      if (onRenderNeeded) onRenderNeeded();
    });
  });

  // ── Drag-select (rubber band) ──────────────────────────────────────────
  let selRectNode = null;

  stage.on('mousedown.selTool', (e) => {
    // Only start rubber-band if clicking on empty canvas
    if (e.target !== stage && e.target.name() !== 'guide') return;
    if (e.evt.button !== 0) return;

    isSelecting = true;
    selStart = screenToStage(e.evt.clientX, e.evt.clientY);

    selRectNode = new Konva.Rect({
      x: selStart.x, y: selStart.y,
      width: 0, height: 0,
      fill: 'rgba(99,102,241,0.06)',
      stroke: '#6366f1',
      strokeWidth: 1.5 / stage.scaleX(),
      dash: [4 / stage.scaleX(), 4 / stage.scaleX()],
      listening: false,
    });
    tLayer.add(selRectNode);
  });

  stage.on('mousemove.selTool', (e) => {
    if (!isSelecting || !selRectNode) return;
    const pos = screenToStage(e.evt.clientX, e.evt.clientY);
    const w = pos.x - selStart.x;
    const h = pos.y - selStart.y;
    selRectNode.x(w < 0 ? pos.x : selStart.x);
    selRectNode.y(h < 0 ? pos.y : selStart.y);
    selRectNode.width(Math.abs(w));
    selRectNode.height(Math.abs(h));
    tLayer.batchDraw();
  });

  stage.on('mouseup.selTool', (e) => {
    if (!isSelecting || !selRectNode) { isSelecting = false; return; }
    isSelecting = false;

    const selBox = selRectNode.getClientRect({ relativeTo: sceneLayer });
    selRectNode.destroy();
    selRectNode = null;

    if (selBox.width < 5 && selBox.height < 5) {
      tLayer.batchDraw();
      return;
    }

    // Find nodes inside the selection rect
    const nodes = sceneLayer.getChildren((node) => {
      if (!node.hasName('element')) return false;
      const box = node.getClientRect({ relativeTo: sceneLayer });
      return (
        box.x >= selBox.x &&
        box.y >= selBox.y &&
        box.x + box.width <= selBox.x + selBox.width &&
        box.y + box.height <= selBox.y + selBox.height
      );
    });

    selectedIds = nodes.map((n) => n.id());
    _applyTransformer();
    notifySelectionChange();
    tLayer.batchDraw();
  });

  // ── Transform end: sync back to scene ─────────────────────────────────
  transformer.on('transformend', () => {
    historyPush(snapshot());
    transformer.nodes().forEach((node) => {
      const id = node.id();
      const scaleX = node.scaleX();
      const scaleY = node.scaleY();

      const patch = {
        x: node.x(),
        y: node.y(),
        width: Math.abs(node.width() * scaleX),
        height: Math.abs(node.height() * scaleY),
        angle: node.rotation(),
      };

      // For text: scale maps to fontSize
      if (node.className === 'Text') {
        const el = getElements().find((e) => e.id === id);
        if (el) patch.fontSize = Math.max(8, Math.round((el.fontSize || 20) * scaleY));
        patch.width = Math.abs(node.width() * scaleX);
      }

      node.scaleX(1);
      node.scaleY(1);
      if (node.className === 'Text') node.fontSize(patch.fontSize);

      updateElement(id, patch);
      if (onElementUpdateCb) onElementUpdateCb(id, patch);
    });
    clearGuides();
    if (onRenderNeeded) onRenderNeeded();
    // Re-apply transformer after render
    _reapplyAfterRender();
  });

  // ── Drag end: sync position to scene ──────────────────────────────────
  sceneLayer.on('dragend.selTool', (e) => {
    const node = e.target;
    if (!node.hasName('element')) return;
    historyPush(snapshot());
    clearGuides();
    const patch = { x: node.x(), y: node.y() };
    updateElement(node.id(), patch);
    if (onElementUpdateCb) onElementUpdateCb(node.id(), patch);
    // Re-render and re-apply transformer
    if (onRenderNeeded) onRenderNeeded();
    _reapplyAfterRender();
  });

  // ── Drag move: snapping ───────────────────────────────────────────────
  sceneLayer.on('dragmove.selTool', (e) => {
    const node = e.target;
    if (!node.hasName('element')) return;
    const { x, y } = computeSnap(node, node.id());
    node.x(x);
    node.y(y);
  });

  // ── Arrow key nudge ───────────────────────────────────────────────────
  _arrowKeyHandler = (e) => {
    if (e.target.matches('textarea, input')) return;
    if (selectedIds.length === 0) return;

    const ARROWS = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'];
    if (!ARROWS.includes(e.key)) return;

    e.preventDefault();
    const step = e.shiftKey ? 10 : 1;
    let dx = 0, dy = 0;

    if (e.key === 'ArrowUp')    dy = -step;
    if (e.key === 'ArrowDown')  dy = step;
    if (e.key === 'ArrowLeft')  dx = -step;
    if (e.key === 'ArrowRight') dx = step;

    historyPush(snapshot());
    selectedIds.forEach((id) => {
      const el = getElements().find((e) => e.id === id);
      if (el) {
        updateElement(id, { x: el.x + dx, y: el.y + dy });
      }
    });
    if (onRenderNeeded) onRenderNeeded();
    _reapplyAfterRender();
  };
  sceneLayer.on('mouseenter.selTool', (e) => {
    const node = e.target;
    if (node.hasName('element')) {
      stage.container().style.cursor = 'pointer';
    }
  });
  sceneLayer.on('mouseleave.selTool', (e) => {
    stage.container().style.cursor = 'default';
  });

  window.addEventListener('keydown', _arrowKeyHandler);

  return () => {
    clearTimeout(clickTimeout);
    stage.off('click.selTool tap.selTool');
    stage.off('dblclick.selTool dbltap.selTool');
    stage.off('mousedown.selTool mousemove.selTool mouseup.selTool');
    sceneLayer.off('dragend.selTool dragmove.selTool mouseenter.selTool mouseleave.selTool');
    if (_arrowKeyHandler) {
      window.removeEventListener('keydown', _arrowKeyHandler);
      _arrowKeyHandler = null;
    }
    if (transformer) { transformer.destroy(); transformer = null; }
    clearSelection();
    clearGuides();
    tLayer.batchDraw();
  };
}

/** Re-apply the transformer to current selected IDs after a render */
function _reapplyAfterRender() {
  if (!transformer || selectedIds.length === 0) return;
  const sceneLayer = getSceneLayer();
  const tLayer = getTransformerLayer();

  const nodes = selectedIds
    .map((id) => sceneLayer.findOne(`#${id}`))
    .filter(Boolean);

  nodes.forEach((n) => n.draggable(true));
  transformer.nodes(nodes);
  tLayer.batchDraw();
}

function _applyTransformer() {
  if (!transformer) return;
  const sceneLayer = getSceneLayer();

  // Enable dragging on selected nodes, disable on others
  sceneLayer.getChildren((n) => n.hasName('element')).forEach((n) => {
    n.draggable(selectedIds.includes(n.id()));
  });

  const nodes = selectedIds.map((id) => sceneLayer.findOne(`#${id}`)).filter(Boolean);
  transformer.nodes(nodes);
  getTransformerLayer().batchDraw();
}

export function clearSelection() {
  selectedIds = [];
  if (transformer) transformer.nodes([]);

  // Disable all dragging
  const sceneLayer = getSceneLayer();
  if (sceneLayer) {
    sceneLayer.getChildren((n) => n.hasName('element')).forEach((n) => n.draggable(false));
  }
  getTransformerLayer().batchDraw();
  notifySelectionChange();
}

/** Delete all currently selected elements */
export function deleteSelected(onRenderNeeded) {
  if (selectedIds.length === 0) return;
  historyPush(snapshot());
  const ids = [...selectedIds];
  clearSelection();
  ids.forEach((id) => removeElement(id));
  if (onRenderNeeded) onRenderNeeded();
}

/** Programmatically select an element by its ID */
export function selectElement(id) {
  selectedIds = [id];
  _applyTransformer();
  notifySelectionChange();
}

