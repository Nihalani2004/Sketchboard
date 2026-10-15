/**
 * textTool.js — Click to place text; HTML overlay for editing; commits to scene on blur/Escape.
 *
 * The overlay element is lazily resolved (not at import-time) because ES modules
 * execute before the DOM is ready.
 */

import { createElement, addElement, updateElement, removeElement, snapshot } from '../scene.js';
import { getStage, screenToStage } from '../stage.js';
import { snapPoint } from '../snapping.js';
import { push as historyPush } from '../history.js';

/** Lazily get the overlay element */
function getOverlay() {
  return document.getElementById('text-editor-overlay');
}

const styleDefaults = {};
let editingId = null;
let editingField = 'text';
let fixedOverlayWidth = false;
let onCommitCb = null;

export function updateTextDefaults(patch) {
  Object.assign(styleDefaults, patch);
}

/** Open the text overlay at a given stage position */
function openOverlay(stageX, stageY, initialText = '', existingId = null, options = {}) {
  const overlay = getOverlay();
  if (!overlay) return;

  const stage = getStage();
  const scale = stage.scaleX();
  const stagePos = stage.position();

  // Convert stage coords to screen coords
  const screenX = stageX * scale + stagePos.x;
  const screenY = stageY * scale + stagePos.y;

  const fontSize = options.fontSize || styleDefaults.fontSize || 20;
  const scaledFontSize = fontSize * scale;

  overlay.style.left = `${screenX}px`;
  overlay.style.top = `${screenY}px`;
  overlay.style.fontSize = `${scaledFontSize}px`;
  overlay.style.fontFamily = options.fontFamily || styleDefaults.fontFamily || "'Caveat', cursive";
  overlay.style.color = options.color || styleDefaults.strokeColor || 'var(--sb-text-primary)';
  fixedOverlayWidth = Number.isFinite(options.width);
  overlay.style.minWidth = fixedOverlayWidth ? `${Math.max(80, options.width * scale)}px` : '100px';
  overlay.style.width = fixedOverlayWidth ? `${Math.max(80, options.width * scale)}px` : 'auto';
  overlay.style.height = 'auto';
  overlay.style.textAlign = options.align || 'left';
  overlay.value = initialText;
  overlay.classList.add('visible');

  // Use requestAnimationFrame to ensure the element is displayed before focusing
  requestAnimationFrame(() => {
    overlay.focus();
    // Auto-resize to fit initial content
    if (initialText) {
      overlay.style.height = `${overlay.scrollHeight}px`;
      if (!fixedOverlayWidth) overlay.style.width = `${Math.max(100, overlay.scrollWidth)}px`;
    }
  });

  // Auto-resize textarea as user types
  overlay.oninput = () => {
    overlay.style.height = 'auto';
    overlay.style.height = `${overlay.scrollHeight}px`;
    if (!fixedOverlayWidth) {
      overlay.style.width = 'auto';
      overlay.style.width = `${Math.max(100, overlay.scrollWidth)}px`;
    }
  };

  editingId = existingId;
  editingField = options.field || 'text';
}

/** Commit the current overlay content to scene */
function commitOverlay() {
  const overlay = getOverlay();
  if (!overlay) return;

  const text = overlay.value.trim();
  overlay.classList.remove('visible');
  overlay.value = '';
  overlay.oninput = null;

  const stage = getStage();
  const scale = stage.scaleX();
  const stagePos = stage.position();
  const screenX = parseFloat(overlay.style.left);
  const screenY = parseFloat(overlay.style.top);
  const stageX = (screenX - stagePos.x) / scale;
  const stageY = (screenY - stagePos.y) / scale;

  if (editingId) {
    if (editingField === 'text' && text === '') {
      historyPush(snapshot());
      removeElement(editingId);
      if (onCommitCb) onCommitCb(null, editingId);
    } else {
      historyPush(snapshot());
      const patch = { [editingField]: text };
      updateElement(editingId, patch);
      if (onCommitCb) onCommitCb({ id: editingId, ...patch });
    }
    editingId = null;
    editingField = 'text';
    fixedOverlayWidth = false;
    return;
  }

  if (!text) return;

  historyPush(snapshot());
  const el = createElement('text', {
    x: stageX,
    y: stageY,
    text,
    width: 200,
    height: 30,
    ...styleDefaults,
  });
  addElement(el);
  if (onCommitCb) onCommitCb(el);
}

/** Activate the text tool */
export function activateTextTool(onCommit) {
  onCommitCb = onCommit;
  const stage = getStage();
  const overlay = getOverlay();

  function onPointerDown(e) {
    if (e.evt.button !== 0) return;

    // If clicking on an existing text node, let selectionTool's double-click handle it
    const target = e.target;
    if (target && target.attrs && target.attrs.elementType === 'text') return;

    // Close any open overlay first
    if (overlay && overlay.classList.contains('visible')) {
      commitOverlay();
      return;
    }

    // Prevent this click from immediately blurring the overlay we're about to open
    e.evt.preventDefault();

    const pos = snapPoint(screenToStage(e.evt.clientX, e.evt.clientY));
    openOverlay(pos.x, pos.y);
  }

  if (overlay) {
    overlay.onblur = () => {
      // Small delay to allow checking if the blur was caused by clicking the canvas
      setTimeout(() => {
        const o = getOverlay();
        if (o && o.classList.contains('visible')) {
          commitOverlay();
        }
      }, 100);
    };

    overlay.onkeydown = (e) => {
      // Stop propagation so the keyboard shortcuts in main.js don't fire
      e.stopPropagation();
      if (e.key === 'Escape') {
        const o = getOverlay();
        if (o) {
          o.value = '';
          o.classList.remove('visible');
        }
        editingId = null;
        editingField = 'text';
        fixedOverlayWidth = false;
      }
    };
  }

  stage.on('pointerdown.textTool', onPointerDown);

  return () => {
    stage.off('pointerdown.textTool');
    const o = getOverlay();
    if (o) {
      o.onblur = null;
      o.onkeydown = null;
      if (o.classList.contains('visible')) {
        commitOverlay();
      }
    }
  };
}

/**
 * Open the text overlay over an existing text element for re-editing.
 * Called by selectionTool on double-click.
 */
export function openTextEditForElement(el, onCommit) {
  onCommitCb = onCommit;
  const overlay = getOverlay();

  openOverlay(el.x, el.y, el.text || '', el.id);

  if (overlay) {
    overlay.onblur = () => {
      setTimeout(() => {
        const o = getOverlay();
        if (o && o.classList.contains('visible')) commitOverlay();
      }, 100);
    };
    overlay.onkeydown = (e) => {
      e.stopPropagation();
      if (e.key === 'Escape') {
        const o = getOverlay();
        if (o) {
          o.value = '';
          o.classList.remove('visible');
        }
        editingId = null;
        editingField = 'text';
        fixedOverlayWidth = false;
      }
    };
  }
}

/** Open the existing overlay to edit a label centred inside a supported shape. */
export function openShapeLabelEditForElement(el, onCommit) {
  onCommitCb = onCommit;
  const overlay = getOverlay();
  openOverlay(el.x, el.y, el.label || '', el.id, {
    field: 'label',
    width: el.width,
    fontSize: el.fontSize || 20,
    fontFamily: el.fontFamily,
    color: el.strokeColor,
    align: 'center',
  });

  if (overlay) {
    overlay.onblur = () => {
      setTimeout(() => {
        const current = getOverlay();
        if (current && current.classList.contains('visible')) commitOverlay();
      }, 100);
    };
    overlay.onkeydown = (event) => {
      event.stopPropagation();
      if (event.key === 'Escape') {
        overlay.value = '';
        overlay.classList.remove('visible');
        editingId = null;
        editingField = 'text';
        fixedOverlayWidth = false;
      }
    };
  }
}
