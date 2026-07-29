/**
 * selectionTool.js — Konva.Transformer for move/resize/rotate + multi-select.
 */

import Konva from 'konva';
import { getStage, getSceneLayer, getTransformerLayer, screenToStage } from '../stage.js';
import { updateElement, getElements, snapshot, removeElement } from '../scene.js';
import { push as historyPush } from '../history.js';
import { computeSnap, clearGuides } from '../snapping.js';
import { openTextEditForElement } from './textTool.js';

let transformer = null;
let selectionRect = null;
let selectedIds = [];
let onSelectionChangeCb = null;
let onElementUpdateCb = null;
let isSelecting = false;
let selStart = null;

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
    enabledAnchors: ['top-left','top-center','top-right','middle-left','middle-right','bottom-left','bottom-center','bottom-right'],
  });
  tLayer.add(transformer);
  tLayer.batchDraw();

  // ── Click to select ──────────────────────────────────────────────────────
  stage.on('click.selTool',  (e) => {
    if (e.target === stage || e.target.name() === 'guide') {
      clearSelection();
      return;
    }
    const node = e.target;
    if (!node.hasName('element')) return;
    const id = node.id();
    if (e.evt.shiftKey) {
      if (selectedIds.includes(id)) {
        selectedIds = selectedIds.filter((i) => i !== id);
      } else {
        selectedIds.push(id);
      }
    } else {
      selectedIds = [id];
    }
    _applyTransformer();
    notifySelectionChange();
  });
  stage.on('tap.selTool', (e) => {
    if (e.target === stage || e.target.name() === 'guide') {
      clearSelection();
      return;
    }

    const node = e.target;
    if (!node.hasName('element')) return;

    const id = node.id();

    if (e.evt.shiftKey) {
      // Multi-select toggle
      if (selectedIds.includes(id)) {
        selectedIds = selectedIds.filter((i) => i !== id);
      } else {
        selectedIds.push(id);
      }
    } else {
      selectedIds = [id];
    }

    _applyTransformer();
    notifySelectionChange();
  });

  stage.on('dblclick.selTool', (e) => {
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
  stage.on('dbltap.selTool', (e) => {
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

  // ── Drag-select (rubber band) ────────────────────────────────────────────
  let selRectNode = null;

  stage.on('mousedown.selTool', (e) => {
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

  // ── Transform end: sync back to scene ───────────────────────────────────
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
  });

  sceneLayer.on('dragend.selTool', (e) => {
    const node = e.target;
    if (!node.hasName('element')) return;
    historyPush(snapshot());
    clearGuides();
    const patch = { x: node.x(), y: node.y() };
    updateElement(node.id(), patch);
    if (onElementUpdateCb) onElementUpdateCb(node.id(), patch);
  });

  sceneLayer.on('dragmove.selTool', (e) => {
    const node = e.target;
    if (!node.hasName('element')) return;
    const { x, y } = computeSnap(node, node.id());
    node.x(x);
    node.y(y);
  });

  return () => {
    stage.off('click.selTool');
    stage.off('tap.selTool');
    stage.off('dblclick.selTool');
    stage.off('dbltap.selTool');
    stage.off('mousedown.selTool');
    stage.off('mousemove.selTool');
    stage.off('mouseup.selTool');
    sceneLayer.off('dragend.selTool');
    sceneLayer.off('dragmove.selTool');
    if (transformer) { transformer.destroy(); transformer = null; }
    if (selRectNode) { selRectNode.destroy(); selRectNode = null; }
    clearSelection();
    clearGuides();
    tLayer.batchDraw();
  };
}

function _applyTransformer() {
  if (!transformer) return;
  const sceneLayer = getSceneLayer();

  // Enable dragging on selected nodes
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
  sceneLayer.getChildren((n) => n.hasName('element')).forEach((n) => n.draggable(false));
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
