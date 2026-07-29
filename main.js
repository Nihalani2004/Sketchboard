/**
 * main.js — Bootstrap: wires stage, tools, UI, undo/redo, keyboard shortcuts.
 * This is the top-level orchestrator; all business logic lives in src/ modules.
 */

import './style.css';

import Konva from 'konva';
import {
  initStage, getStage, getSceneLayer, getTransformerLayer,
  onZoomChange, zoomTo, zoomToPercent, fitView, getScale,
} from './src/stage.js';
import {
  getElements, addElement, updateElement, setElements,
  snapshot, DEFAULT_STYLE,
} from './src/scene.js';
import {
  push as historyPush, undo as historyUndo, redo as historyRedo,
} from './src/history.js';
import { createSketchyRect, createSketchyEllipse, createSketchyLine, createSketchyArrow } from './src/shapes/sketchyShape.js';
import { createFreehandShape } from './src/shapes/freehand.js';
import { createTextShape } from './src/shapes/text.js';
import { activateDrawTool, setDrawType, updateDrawDefaults } from './src/tools/drawTool.js';
import { activateFreehandTool, updateFreehandDefaults } from './src/tools/freehandTool.js';
import { activateTextTool, updateTextDefaults } from './src/tools/textTool.js';
import {
  activateSelectionTool, clearSelection, deleteSelected,
  onSelectionChange, onElementUpdate, getSelectedIds, selectElement,
} from './src/tools/selectionTool.js';
import { activateLaserTool } from './src/tools/laserTool.js';
import { exportJSON, importJSON, exportPNG } from './src/export.js';
import {
  initToolbar, onToolChange, onClear, setActiveTool, getActiveTool,
} from './src/ui/toolbar.js';
import {
  initStylePanel, onStyleChange, getCurrentStyle,
  updatePanelStyle, showPanel, hidePanel,
} from './src/ui/stylePanel.js';

// ── Stage init ──────────────────────────────────────────────────────────────
const stage = initStage('canvas-container');
const sceneLayer = getSceneLayer();

// ── Active tool cleanup ─────────────────────────────────────────────────────
let deactivateCurrent = null;

// ── Render: rebuild Konva scene from scene.js array ─────────────────────────
function render() {
  sceneLayer.destroyChildren();
  const elements = getElements();

  elements.forEach((el) => {
    let node = null;

    if (el.type === 'rectangle')  node = createSketchyRect(el);
    else if (el.type === 'ellipse') node = createSketchyEllipse(el);
    else if (el.type === 'line')    node = createSketchyLine(el);
    else if (el.type === 'arrow')   node = createSketchyArrow(el);
    else if (el.type === 'freedraw') {
      node = createFreehandShape(el);
      if (node) node.attrs.elementPoints = el.points;
    }
    else if (el.type === 'text') node = createTextShape(el);

    if (node) sceneLayer.add(node);
  });

  sceneLayer.batchDraw();
}

// ── Tool switching ───────────────────────────────────────────────────────────
const DRAW_TOOLS = new Set(['rectangle', 'ellipse', 'line', 'arrow']);

function switchTool(toolId) {
  if (deactivateCurrent) {
    deactivateCurrent();
    deactivateCurrent = null;
  }
  clearSelection();

  // Cursor
  const container = stage.container();
  const cursors = { select: 'default', text: 'text', laser: 'none', pan: 'grab' };
  container.style.cursor = cursors[toolId] || 'crosshair';

  // Style panel visibility:
  // • Drawing tools → always show (style applies to next shape)
  // • Select tool → hide until something is selected
  // • Laser / pan → hide
  const alwaysShowPanel = new Set([...DRAW_TOOLS, 'freehand', 'text']);
  if (alwaysShowPanel.has(toolId)) {
    showPanel(toolId === 'text');
  } else {
    hidePanel();
  }

  // Pan
  if (toolId === 'pan') {
    stage.draggable(true);
    return;
  }
  stage.draggable(false);

  const style = getCurrentStyle();

  if (DRAW_TOOLS.has(toolId)) {
    setDrawType(toolId, style);
    deactivateCurrent = activateDrawTool((el) => {
      render();
      // Auto-switch to Select tool and select the new element
      _autoSelectAfterDraw(el.id);
    });
  } else if (toolId === 'freehand') {
    deactivateCurrent = activateFreehandTool((el) => {
      render();
      _autoSelectAfterDraw(el.id);
    });
  } else if (toolId === 'text') {
    deactivateCurrent = activateTextTool((result) => {
      render();
    });
  } else if (toolId === 'select') {
    deactivateCurrent = activateSelectionTool(() => {
      render();
    });
  } else if (toolId === 'laser') {
    deactivateCurrent = activateLaserTool();
  }
}

function _autoSelectAfterDraw(id) {
  setActiveTool('select');
  switchTool('select');
  selectElement(id);
}

// ── Dark mode (respect system preference) ───────────────────────────────────
const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
if (prefersDark) document.documentElement.classList.add('dark');

// ── Toolbar init ─────────────────────────────────────────────────────────────
initToolbar(prefersDark, () => {});
onToolChange((toolId) => switchTool(toolId));
onClear(() => {
  historyPush(snapshot());
  setElements([]);
  render();
  clearSelection();
  hidePanel();
});

// ── Style panel init ─────────────────────────────────────────────────────────
initStylePanel();

onStyleChange((patch) => {
  const tool = getActiveTool();

  // Update draw tool defaults
  if (DRAW_TOOLS.has(tool))    updateDrawDefaults(patch);
  else if (tool === 'freehand') updateFreehandDefaults(patch);
  else if (tool === 'text')     updateTextDefaults(patch);

  // Apply live to selected elements
  const selectedIds = getSelectedIds();
  if (selectedIds.length > 0) {
    historyPush(snapshot());
    selectedIds.forEach((id) => updateElement(id, patch));
    render();
    // Re-activate transformer on the same elements after render
    _reapplyTransformerAfterRender(selectedIds);
  }
});

/** Re-select nodes after a render so the transformer stays attached */
function _reapplyTransformerAfterRender(ids) {
  const tLayer = getTransformerLayer();
  const transformer = tLayer.findOne('Transformer');
  if (!transformer) return;

  const nodes = ids
    .map((id) => sceneLayer.findOne(`#${id}`))
    .filter(Boolean);
  nodes.forEach((n) => n.draggable(true));
  transformer.nodes(nodes);
  tLayer.batchDraw();
}

// ── Selection → style panel sync ────────────────────────────────────────────
onSelectionChange((selectedElements) => {
  if (selectedElements.length === 0) {
    // Only keep panel open if a drawing tool is active
    const tool = getActiveTool();
    const alwaysShowPanel = new Set([...DRAW_TOOLS, 'freehand', 'text']);
    if (alwaysShowPanel.has(tool)) {
      showPanel(tool === 'text');
    } else {
      hidePanel();
    }
    return;
  }
  const el = selectedElements[0];
  updatePanelStyle({
    strokeColor:     el.strokeColor,
    backgroundColor: el.backgroundColor,
    fillStyle:       el.fillStyle,
    strokeWidth:     el.strokeWidth,
    strokeStyle:     el.strokeStyle,
    roughness:       el.roughness,
    opacity:         el.opacity,
    fontSize:        el.fontSize || DEFAULT_STYLE.fontSize,
  });
  showPanel(el.type === 'text');
});

onElementUpdate((id, patch) => {
  updateElement(id, patch);
});

// ── Action bar ───────────────────────────────────────────────────────────────
function initActionBar() {
  const bar = document.getElementById('action-bar');

  const exportJsonBtn = _makeActionBtn('Export JSON', '💾');
  exportJsonBtn.id = 'btn-export-json';
  exportJsonBtn.addEventListener('click', () => exportJSON({ scale: getScale() }));

  const importBtn = _makeActionBtn('Import JSON', '📂');
  importBtn.id = 'btn-import-json';
  importBtn.addEventListener('click', () => {
    importJSON((data) => {
      render();
      fitView(getElements());
    });
  });

  const exportPngBtn = _makeActionBtn('Export PNG', '🖼️');
  exportPngBtn.id = 'btn-export-png';
  exportPngBtn.addEventListener('click', () => exportPNG());

  bar.appendChild(exportJsonBtn);
  bar.appendChild(importBtn);
  bar.appendChild(exportPngBtn);
}

function _makeActionBtn(label, emoji) {
  const btn = document.createElement('button');
  btn.className = 'action-btn';
  btn.innerHTML = `<span>${emoji}</span><span>${label}</span>`;
  return btn;
}
initActionBar();

// ── Zoom controls ────────────────────────────────────────────────────────────
function initZoomControls() {
  const zc = document.getElementById('zoom-controls');
  zc.innerHTML = `
    <button class="zoom-btn" id="btn-zoom-out" aria-label="Zoom out" title="Zoom out (-)">
      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/><line x1="8" y1="11" x2="14" y2="11"/>
      </svg>
    </button>
    <span id="zoom-level" title="Click to reset to 100%">100%</span>
    <button class="zoom-btn" id="btn-zoom-in" aria-label="Zoom in" title="Zoom in (+)">
      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
        <line x1="11" y1="8" x2="11" y2="14"/><line x1="8" y1="11" x2="14" y2="11"/>
      </svg>
    </button>
    <button class="zoom-btn" id="btn-fit-view" aria-label="Fit to content" title="Fit to content [F]">
      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"/>
      </svg>
    </button>
  `;

  document.getElementById('btn-zoom-in').addEventListener('click', () =>
    zoomTo(getScale() * 1.25, stage.width() / 2, stage.height() / 2));
  document.getElementById('btn-zoom-out').addEventListener('click', () =>
    zoomTo(getScale() / 1.25, stage.width() / 2, stage.height() / 2));
  document.getElementById('zoom-level').addEventListener('click', () => {
    zoomToPercent(1);
    stage.position({ x: 0, y: 0 });
    stage.batchDraw();
    document.getElementById('zoom-level').textContent = '100%';
  });
  document.getElementById('btn-fit-view').addEventListener('click', () =>
    fitView(getElements()));
}
initZoomControls();

onZoomChange((scale) => {
  const el = document.getElementById('zoom-level');
  if (el) el.textContent = `${Math.round(scale * 100)}%`;
});

// ── Keyboard shortcuts ───────────────────────────────────────────────────────
window.addEventListener('keydown', (e) => {
  if (e.target.matches('textarea, input')) return;
  const isMod = e.ctrlKey || e.metaKey;

  // Undo
  if (isMod && !e.shiftKey && e.key.toLowerCase() === 'z') {
    e.preventDefault();
    const prev = historyUndo(snapshot());
    if (prev) { setElements(prev); render(); clearSelection(); }
    return;
  }

  // Redo — Ctrl+Shift+Z or Ctrl+Y
  if (isMod && ((e.shiftKey && e.key.toLowerCase() === 'z') || e.key.toLowerCase() === 'y')) {
    e.preventDefault();
    const next = historyRedo(snapshot());
    if (next) { setElements(next); render(); clearSelection(); }
    return;
  }

  // Delete / Backspace — remove selected
  if ((e.key === 'Delete' || e.key === 'Backspace') && getActiveTool() === 'select') {
    e.preventDefault();
    deleteSelected(() => render());
    return;
  }

  // Fit view
  if (e.key.toLowerCase() === 'f' && !isMod) {
    fitView(getElements());
    return;
  }

  // Escape → back to select
  if (e.key === 'Escape') {
    setActiveTool('select');
    switchTool('select');
    return;
  }

  // +/= zoom in, - zoom out
  if (!isMod && (e.key === '+' || e.key === '=')) {
    zoomTo(getScale() * 1.25, stage.width() / 2, stage.height() / 2);
    return;
  }
  if (!isMod && e.key === '-') {
    zoomTo(getScale() / 1.25, stage.width() / 2, stage.height() / 2);
    return;
  }
});

// ── Block right-click context menu on canvas ─────────────────────────────────
stage.container().addEventListener('contextmenu', (e) => e.preventDefault());

// ── Initial state ─────────────────────────────────────────────────────────────
switchTool('select');   // starts with select, panel hidden
render();
