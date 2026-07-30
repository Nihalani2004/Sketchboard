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
import { createSketchyRect, createSketchyEllipse, createSketchyLine, createSketchyArrow, createSketchyDiamond } from './src/shapes/sketchyShape.js';
import { createFreehandShape } from './src/shapes/freehand.js';
import { createTextShape } from './src/shapes/text.js';
import { activateDrawTool, setDrawType, updateDrawDefaults } from './src/tools/drawTool.js';
import { activateFreehandTool, updateFreehandDefaults } from './src/tools/freehandTool.js';
import { activateTextTool, updateTextDefaults } from './src/tools/textTool.js';
import { activateEraserTool } from './src/tools/eraserTool.js';
import {
  activateSelectionTool, clearSelection, deleteSelected, duplicateSelected,
  groupSelected, ungroupSelected, moveSelectedFront, moveSelectedBack,
  onSelectionChange, onElementUpdate, getSelectedIds,
} from './src/tools/selectionTool.js';
import { activateLaserTool } from './src/tools/laserTool.js';
import { exportJSON, importJSON, exportPNG, copyPNGToClipboard } from './src/export.js';
import {
  initToolbar, onToolChange, onClear, setActiveTool, getActiveTool,
} from './src/ui/toolbar.js';
import {
  initStylePanel, onStyleChange, getCurrentStyle,
  updatePanelStyle, showPanel, hidePanel, onPanelAction,
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
    try {
      let node = null;

      if (el.type === 'rectangle')  node = createSketchyRect(el);
      else if (el.type === 'ellipse') node = createSketchyEllipse(el);
      else if (el.type === 'diamond') node = createSketchyDiamond(el);
      else if (el.type === 'line')    node = createSketchyLine(el);
      else if (el.type === 'arrow')   node = createSketchyArrow(el);
      else if (el.type === 'freedraw') {
        node = createFreehandShape(el);
        if (node) node.attrs.elementPoints = el.points;
      }
      else if (el.type === 'text') node = createTextShape(el);

      if (node) sceneLayer.add(node);
    } catch (err) {
      console.warn('Sketchboard: failed to render element', el.id, err);
    }
  });

  sceneLayer.batchDraw();
}

// ── Tool switching ───────────────────────────────────────────────────────────
const DRAW_TOOLS = new Set(['rectangle', 'ellipse', 'diamond', 'line', 'arrow']);

function switchTool(toolId) {
  if (deactivateCurrent) {
    deactivateCurrent();
    deactivateCurrent = null;
  }
  clearSelection();

  // Cursor
  const container = stage.container();
  const cursors = { select: 'default', text: 'text', laser: 'none', pan: 'grab', eraser: 'crosshair' };
  container.style.cursor = cursors[toolId] || 'crosshair';

  // Style panel visibility:
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
    });
  } else if (toolId === 'freehand') {
    deactivateCurrent = activateFreehandTool((el) => {
      render();
    });
  } else if (toolId === 'eraser') {
    deactivateCurrent = activateEraserTool(() => {
      render();
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


// ── Dark mode (default to light mode / white screen) ───────────────────────
const savedTheme = localStorage.getItem('sketchboard_theme');
const isDark = savedTheme === 'dark'; // Defaults to false (Light mode / white screen)

if (isDark) {
  document.documentElement.classList.add('dark');
} else {
  document.documentElement.classList.remove('dark');
}

// ── Toolbar init ─────────────────────────────────────────────────────────────
initToolbar(isDark, (nowDark) => {
  localStorage.setItem('sketchboard_theme', nowDark ? 'dark' : 'light');
  render();
});
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

onPanelAction((action) => {
  if (action === 'duplicate') duplicateSelected(() => render());
  else if (action === 'delete') deleteSelected(() => render());
  else if (action === 'front') moveSelectedFront(() => render());
  else if (action === 'back') moveSelectedBack(() => render());
});

// ── Action bar ───────────────────────────────────────────────────────────────
function initActionBar() {
  const bar = document.getElementById('action-bar');
  bar.innerHTML = '';

  const exportJsonBtn = _makeActionBtn('JSON', '💾', 'Export JSON file');
  exportJsonBtn.id = 'btn-export-json';
  exportJsonBtn.addEventListener('click', () => exportJSON({ scale: getScale() }));

  const importBtn = _makeActionBtn('Open', '📂', 'Import JSON file');
  importBtn.id = 'btn-import-json';
  importBtn.addEventListener('click', () => {
    importJSON((data) => {
      render();
      fitView(getElements());
    });
  });

  const exportPngBtn = _makeActionBtn('PNG', '🖼️', 'Export PNG image');
  exportPngBtn.id = 'btn-export-png';
  exportPngBtn.addEventListener('click', () => exportPNG());

  const copyPngBtn = _makeActionBtn('Copy', '📋', 'Copy PNG to clipboard');
  copyPngBtn.id = 'btn-copy-png';
  copyPngBtn.addEventListener('click', () => copyPNGToClipboard());

  bar.appendChild(exportJsonBtn);
  bar.appendChild(importBtn);
  bar.appendChild(exportPngBtn);
  bar.appendChild(copyPngBtn);
}

function _makeActionBtn(label, emoji, tooltip) {
  const btn = document.createElement('button');
  btn.className = 'action-btn';
  btn.setAttribute('data-tooltip', tooltip);
  btn.innerHTML = `<span>${emoji}</span><span>${label}</span>`;
  return btn;
}
initActionBar();

// ── Zoom controls & Grid Toggle ──────────────────────────────────────────────
function initZoomControls() {
  const zc = document.getElementById('zoom-controls');
  const container = document.getElementById('canvas-container');
  if (container) container.classList.add('grid-dots');

  zc.innerHTML = `
    <button class="zoom-btn" id="btn-grid-toggle" aria-label="Toggle background grid" title="Toggle background grid (Dots / Mesh / Clean)">
      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <rect width="18" height="18" x="3" y="3" rx="2"/><path d="M3 9h18"/><path d="M3 15h18"/><path d="M9 3v18"/><path d="M15 3v18"/>
      </svg>
    </button>
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

  let gridState = 0; // 0: dots, 1: mesh, 2: none
  document.getElementById('btn-grid-toggle').addEventListener('click', () => {
    gridState = (gridState + 1) % 3;
    container.classList.remove('grid-dots', 'grid-mesh');
    if (gridState === 0) container.classList.add('grid-dots');
    else if (gridState === 1) container.classList.add('grid-mesh');
  });

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

  // Duplicate — Ctrl+D
  if (isMod && e.key.toLowerCase() === 'd') {
    e.preventDefault();
    duplicateSelected(() => render());
    return;
  }

  // Group / Ungroup — Ctrl+G / Ctrl+Shift+G
  if (isMod && e.key.toLowerCase() === 'g') {
    e.preventDefault();
    if (e.shiftKey) ungroupSelected(() => render());
    else groupSelected(() => render());
    return;
  }

  // Layer order — Ctrl+] (Front), Ctrl+[ (Back)
  if (isMod && e.key === ']') {
    e.preventDefault();
    moveSelectedFront(() => render());
    return;
  }
  if (isMod && e.key === '[') {
    e.preventDefault();
    moveSelectedBack(() => render());
    return;
  }

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
