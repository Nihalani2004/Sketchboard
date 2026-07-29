/**
 * textTool.js — Click to place text; HTML overlay for editing; commits to scene on blur/Escape.
 *
 * The overlay element is lazily resolved (not at import-time) because ES modules
 * execute before the DOM is ready.
 */

import { createElement, addElement, updateElement, removeElement, snapshot, getElements } from '../scene.js';
import { getStage, screenToStage } from '../stage.js';
import { push as historyPush } from '../history.js';

/** Lazily get the overlay element */
function getOverlay() {
  return document.getElementById('text-editor-overlay');
}

let styleDefaults = {};
let editingId = null;
let onCommitCb = null;

export function updateTextDefaults(patch) {
  Object.assign(styleDefaults, patch);
}

/** Open the text overlay at a given stage position */
function openOverlay(stageX, stageY, initialText = '', existingId = null) {
  const overlay = getOverlay();
  if (!overlay) return;

  const stage = getStage();
  const scale = stage.scaleX();
  const stagePos = stage.position();

  // Convert stage coords to screen coords
  const screenX = stageX * scale + stagePos.x;
  const screenY = stageY * scale + stagePos.y;

  const fontSize = styleDefaults.fontSize || 20;
  const scaledFontSize = fontSize * scale;

  overlay.style.left = `${screenX}px`;
  overlay.style.top = `${screenY}px`;
  overlay.style.fontSize = `${scaledFontSize}px`;
  overlay.style.fontFamily = styleDefaults.fontFamily || "'Caveat', cursive";
  overlay.style.color = styleDefaults.strokeColor || 'var(--sb-text-primary)';
  overlay.style.minWidth = '100px';
  overlay.style.width = 'auto';
  overlay.style.height = 'auto';
  overlay.value = initialText;
  overlay.classList.add('visible');

  // Use requestAnimationFrame to ensure the element is displayed before focusing
  requestAnimationFrame(() => {
    overlay.focus();
    // Auto-resize to fit initial content
    if (initialText) {
      overlay.style.height = `${overlay.scrollHeight}px`;
      overlay.style.width = `${Math.max(100, overlay.scrollWidth)}px`;
    }
  });

  // Auto-resize textarea as user types
  overlay.oninput = () => {
    overlay.style.height = 'auto';
    overlay.style.height = `${overlay.scrollHeight}px`;
    overlay.style.width = 'auto';
    overlay.style.width = `${Math.max(100, overlay.scrollWidth)}px`;
  };

  editingId = existingId;
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
    if (text === '') {
      historyPush(snapshot());
      removeElement(editingId);
      if (onCommitCb) onCommitCb(null, editingId);
    } else {
      historyPush(snapshot());
      updateElement(editingId, { text });
      if (onCommitCb) onCommitCb({ id: editingId, text });
    }
    editingId = null;
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

    const pos = screenToStage(e.evt.clientX, e.evt.clientY);
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
      }
    };
  }
}
