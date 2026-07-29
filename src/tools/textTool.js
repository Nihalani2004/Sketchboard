/**
 * textTool.js — Click to place text; HTML overlay for editing; commits to scene on blur/Escape.
 *
 * Key fix: Konva sets tabIndex on its container div, so clicking the canvas steals focus from
 * the textarea triggering an immediate blur → commitOverlay race condition.
 * Solution: (1) strip the tabIndex after stage init, (2) use a delayed blur so a same-click
 * openOverlay call can cancel the pending commit.
 */

import { createElement, addElement, updateElement, removeElement, snapshot } from '../scene.js';
import { getStage, screenToStage } from '../stage.js';
import { push as historyPush } from '../history.js';

let overlay = null;           // resolved lazily so DOM is ready
let styleDefaults = {};
let editingId = null;
let onCommitCb = null;
let _blurTimer = null;        // pending blur commit timeout
let _justOpened = false;      // flag: overlay was opened by this very click

function getOverlay() {
  if (!overlay) overlay = document.getElementById('text-editor-overlay');
  return overlay;
}

export function updateTextDefaults(patch) {
  Object.assign(styleDefaults, patch);
}

/** Open the text overlay at a given stage position */
function openOverlay(stageX, stageY, initialText = '', existingId = null) {
  const stage = getStage();
  const scale = stage.scaleX();
  const stagePos = stage.position();
  const el = getOverlay();

  // Cancel any pending blur-triggered commit (same-click cancel)
  if (_blurTimer) { clearTimeout(_blurTimer); _blurTimer = null; }
  _justOpened = true;

  const screenX = stageX * scale + stagePos.x;
  const screenY = stageY * scale + stagePos.y;
  const fontSize = styleDefaults.fontSize || 20;

  el.style.left       = `${screenX}px`;
  el.style.top        = `${screenY}px`;
  el.style.fontSize   = `${fontSize * scale}px`;
  el.style.fontFamily = styleDefaults.fontFamily || "'Caveat', cursive";
  el.style.color      = styleDefaults.strokeColor || 'var(--sb-text-primary)';
  el.style.minWidth   = '120px';
  el.style.width      = 'auto';
  el.style.height     = 'auto';
  el.value            = initialText;
  el.classList.add('visible');

  // Auto-resize
  el.oninput = () => {
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
    el.style.width  = 'auto';
    el.style.width  = `${Math.max(120, el.scrollWidth)}px`;
  };

  editingId = existingId;

  // Focus after a tiny delay so mousedown on canvas doesn't steal it back
  requestAnimationFrame(() => {
    el.focus();
    _justOpened = false;
  });
}

/** Commit the current overlay content to scene */
function commitOverlay() {
  const el = getOverlay();
  if (!el.classList.contains('visible')) return; // already committed

  const text = el.value.trim();
  el.classList.remove('visible');
  el.value = '';

  const stage = getStage();
  const scale = stage.scaleX();
  const stagePos = stage.position();
  const stageX = (parseFloat(el.style.left) - stagePos.x) / scale;
  const stageY = (parseFloat(el.style.top)  - stagePos.y) / scale;

  if (editingId) {
    historyPush(snapshot());
    if (text === '') {
      removeElement(editingId);
      if (onCommitCb) onCommitCb(null, editingId);
    } else {
      updateElement(editingId, { text });
      if (onCommitCb) onCommitCb({ id: editingId, text });
    }
    editingId = null;
    return;
  }

  if (!text) return; // discard empty

  historyPush(snapshot());
  const newEl = createElement('text', {
    x: stageX,
    y: stageY,
    text,
    width: 200,
    height: 30,
    ...styleDefaults,
  });
  addElement(newEl);
  if (onCommitCb) onCommitCb(newEl);
}

/** Shared blur handler with delay to avoid same-click race condition */
function _setupBlurHandler() {
  const el = getOverlay();
  el.onblur = () => {
    if (_justOpened) return; // same-click that opened the overlay, ignore
    _blurTimer = setTimeout(() => {
      _blurTimer = null;
      commitOverlay();
    }, 180);
  };
}

/** Shared keydown handler */
function _setupKeyHandler() {
  const el = getOverlay();
  el.onkeydown = (e) => {
    if (e.key === 'Escape') {
      if (_blurTimer) { clearTimeout(_blurTimer); _blurTimer = null; }
      el.value = '';
      el.classList.remove('visible');
      editingId = null;
      el.blur();
    }
    // Enter without Shift commits
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (_blurTimer) { clearTimeout(_blurTimer); _blurTimer = null; }
      commitOverlay();
      if (onCommitCb) {} // already called inside commitOverlay
    }
  };
}

/** Activate the text tool */
export function activateTextTool(onCommit) {
  onCommitCb = onCommit;
  const stage = getStage();

  // Remove Konva's tabIndex so the canvas div won't steal focus from textarea on click
  stage.container().removeAttribute('tabindex');
  stage.container().removeAttribute('tabIndex');

  _setupBlurHandler();
  _setupKeyHandler();

  function onPointerDown(e) {
    if (e.evt.button !== 0) return;

    const target = e.target;
    // Clicking an existing text node → handled by double-click in selection tool
    if (target && target.attrs && target.attrs.elementType === 'text') return;

    const el = getOverlay();
    if (el.classList.contains('visible')) {
      // Second click → commit current text, then place new on this click
      if (_blurTimer) { clearTimeout(_blurTimer); _blurTimer = null; }
      commitOverlay();
      // Allow a frame before opening at new position
      const pos = screenToStage(e.evt.clientX, e.evt.clientY);
      requestAnimationFrame(() => openOverlay(pos.x, pos.y));
      return;
    }

    const pos = screenToStage(e.evt.clientX, e.evt.clientY);
    openOverlay(pos.x, pos.y);
  }

  stage.on('pointerdown.textTool', onPointerDown);

  return () => {
    stage.off('pointerdown.textTool');
    const el = getOverlay();
    el.onblur = null;
    el.onkeydown = null;
    if (_blurTimer) { clearTimeout(_blurTimer); _blurTimer = null; }
    if (el.classList.contains('visible')) commitOverlay();
    // Restore tabIndex so Konva's built-in keyboard handling still works
    stage.container().setAttribute('tabindex', '0');
  };
}

/**
 * Open the text overlay for re-editing an existing text element.
 * Called by selectionTool on double-click.
 */
export function openTextEditForElement(el, onCommit) {
  onCommitCb = onCommit;
  // Remove tabIndex while editing
  const stage = getStage();
  stage.container().removeAttribute('tabindex');
  stage.container().removeAttribute('tabIndex');

  _setupBlurHandler();
  _setupKeyHandler();

  openOverlay(el.x, el.y, el.text || '', el.id);
}
