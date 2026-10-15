/**
 * export.js — JSON export/import and PNG export.
 * Operates on scene.js arrays — does NOT use Konva's built-in toJSON().
 */

import { serialize, deserialize, getElements, snapshot } from './scene.js';
import { getStage, getSceneLayer, getTransformerLayer, getLaserLayer } from './stage.js';
import { push as historyPush } from './history.js';
import { reportError } from './monitoring.js';
import { SUPPORTED_ELEMENT_TYPES } from './shapes/catalog.js';

const EXPORT_PADDING = 40;
const MAX_IMPORT_BYTES = 10 * 1024 * 1024;
const MAX_PAGES = 100;
const MAX_ELEMENTS_PER_PAGE = 10000;
const PNG_BACKGROUND = '#ffffff';

/**
 * Download a file in the browser.
 * @param {string} content - text or dataURL content
 * @param {string} filename
 * @param {string} type - MIME type or 'dataURL'
 */
function download(content, filename, type = 'text/plain') {
  const a = document.createElement('a');
  if (type === 'dataURL') {
    a.href = content;
  } else {
    const blob = new Blob([content], { type });
    a.href = URL.createObjectURL(blob);
  }
  a.download = filename;
  // Must append to DOM for download to work in all browsers
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  // Cleanup after a tick
  requestAnimationFrame(() => {
    document.body.removeChild(a);
    if (a.href.startsWith('blob:')) URL.revokeObjectURL(a.href);
  });
}

/**
 * Export the current diagram as a JSON file.
 * @param {object} appState - viewport info
 */
export function exportJSON(appState = {}) {
  const serialized = serialize();
  const data = {
    ...serialized,
    appState: {
      background: document.documentElement.classList.contains('dark') ? 'dark' : 'light',
      ...appState,
    },
    exportedAt: new Date().toISOString(),
    app: 'Sketchboard',
    version: 2,
  };
  const json = JSON.stringify(data, null, 2);
  download(json, `sketchboard-${Date.now()}.json`, 'application/json');
}

/**
 * Trigger a file picker, parse JSON, and call the provided callback
 * with the parsed data so the caller can re-render the scene.
 * @param {function} onImport - callback(data)
 */
export function importJSON(onImport) {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.json,application/json';
  input.style.display = 'none';
  document.body.appendChild(input);
  const cleanupInput = () => {
    if (input.isConnected) document.body.removeChild(input);
  };

  input.onchange = (e) => {
    const file = e.target.files[0];
    if (!file) { cleanupInput(); return; }
    if (file.size > MAX_IMPORT_BYTES) {
      alert('Failed to import: file is larger than the 10 MB limit.');
      cleanupInput();
      return;
    }
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const data = JSON.parse(ev.target.result);
        validateImportData(data);

        // Save current state so user can undo the import
        historyPush(snapshot());

        // Replace elements with imported data
        deserialize(data);

        if (onImport) onImport(data);
      } catch (err) {
        alert(`Failed to import: ${err.message}`);
      } finally {
        cleanupInput();
      }
    };
    reader.onerror = () => {
      alert('Failed to read the selected file.');
      cleanupInput();
    };
    reader.readAsText(file);
  };
  input.addEventListener('cancel', cleanupInput, { once: true });
  input.click();
}

/** Reject malformed scene data before it can replace the current drawing. */
function validateElements(elements, pageLabel) {
  if (!Array.isArray(elements) || elements.length > MAX_ELEMENTS_PER_PAGE) throw new Error(`${pageLabel} has too many or invalid elements`);
  const ids = new Set();
  elements.forEach((el, index) => {
    if (!el || typeof el !== 'object') {
      throw new Error(`${pageLabel}, element ${index + 1} is invalid`);
    }
    if (typeof el.id !== 'string' || !el.id || ids.has(el.id) || !SUPPORTED_ELEMENT_TYPES.has(el.type)) {
      throw new Error(`${pageLabel}, element ${index + 1} has an unsupported type or ID`);
    }
    ids.add(el.id);
    if (!Number.isFinite(el.x) || !Number.isFinite(el.y)) {
      throw new Error(`${pageLabel}, element ${index + 1} has invalid coordinates`);
    }
    if (el.type === 'freedraw') {
      if (!Array.isArray(el.points)) {
        throw new Error(`${pageLabel}, freehand element ${index + 1} is missing points`);
      }
    } else if (!Number.isFinite(el.width) || !Number.isFinite(el.height)) {
      throw new Error(`${pageLabel}, element ${index + 1} has invalid dimensions`);
    }
    if (el.type === 'image' && (
      el.width <= 0 || el.height <= 0
      || typeof el.src !== 'string'
      || !/^data:image\/(?:png|jpeg|webp|gif);base64,[a-zA-Z0-9+/=]+$/i.test(el.src)
    )) {
      throw new Error(`${pageLabel}, image element ${index + 1} has an unsupported source`);
    }
  });
}

export function validateImportData(data) {
  if (!data || typeof data !== 'object') throw new Error('not a Sketchboard JSON export');
  if (Array.isArray(data.elements)) {
    validateElements(data.elements, 'Page 1');
    return;
  }
  if (!Array.isArray(data.pages) || data.pages.length === 0 || data.pages.length > MAX_PAGES) throw new Error('document has an invalid number of pages');
  const pageIds = new Set();
  data.pages.forEach((page, index) => {
    if (!page || typeof page !== 'object' || typeof page.id !== 'string' || pageIds.has(page.id)) throw new Error(`page ${index + 1} is invalid`);
    pageIds.add(page.id);
    validateElements(page.elements, `Page ${index + 1}`);
  });
}

/** Calculate a consistent stage-space crop rectangle for PNG export and copy. */
function getContentBounds(elements) {
  // Prefer rendered bounds: they include rotation, stroke thickness and the
  // actual freehand outline rather than only the stored model dimensions.
  const stage = getStage();
  const renderedBounds = getSceneLayer()?.getClientRect({ relativeTo: stage });
  if (
    renderedBounds
    && Number.isFinite(renderedBounds.x)
    && Number.isFinite(renderedBounds.y)
    && Number.isFinite(renderedBounds.width)
    && Number.isFinite(renderedBounds.height)
  ) {
    return {
      minX: renderedBounds.x,
      minY: renderedBounds.y,
      maxX: renderedBounds.x + renderedBounds.width,
      maxY: renderedBounds.y + renderedBounds.height,
    };
  }

  // Fallback for a scene that has not yet rendered.
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

  elements.forEach((el) => {
    if (el.type === 'freedraw' && Array.isArray(el.points) && el.points.length > 0) {
      el.points.forEach((point) => {
        if (!Array.isArray(point) || !Number.isFinite(point[0]) || !Number.isFinite(point[1])) return;
        const px = el.x + point[0];
        const py = el.y + point[1];
        minX = Math.min(minX, px);
        minY = Math.min(minY, py);
        maxX = Math.max(maxX, px);
        maxY = Math.max(maxY, py);
      });
      return;
    }

    const width = Number.isFinite(el.width) ? el.width : 0;
    const height = Number.isFinite(el.height) ? el.height : 0;
    minX = Math.min(minX, el.x, el.x + width);
    minY = Math.min(minY, el.y, el.y + height);
    maxX = Math.max(maxX, el.x, el.x + width);
    maxY = Math.max(maxY, el.y, el.y + height);
  });

  return Number.isFinite(minX) ? { minX, minY, maxX, maxY } : null;
}

/** Render a cropped PNG without selection, laser, or text-editor UI. */
function createCroppedPNG(elements) {
  const bounds = getContentBounds(elements);
  if (!bounds) throw new Error('unable to determine diagram bounds');

  const stage = getStage();
  const trLayer = getTransformerLayer();
  const laserLayer = getLaserLayer();
  const textOverlay = document.getElementById('text-editor-overlay');
  const trWasVisible = trLayer.visible();
  const laserWasVisible = laserLayer.visible();
  const textWasVisible = textOverlay?.classList.contains('visible');
  const root = document.documentElement;
  const wasDark = root.classList.contains('dark');
  const textFills = [];

  try {
    // A PNG does not carry the CSS canvas background. Export against an opaque
    // light surface so it remains legible in viewers that render transparency
    // as black. The temporary light palette also keeps default strokes dark.
    if (wasDark) root.classList.remove('dark');
    if (wasDark) {
      getSceneLayer().find('Text').forEach((node) => {
        if (node.fill() === '#e8e8e8') {
          textFills.push([node, node.fill()]);
          node.fill('#1e1e1e');
        }
      });
    }
    trLayer.visible(false);
    laserLayer.visible(false);
    if (textWasVisible) textOverlay.classList.remove('visible');
    stage.batchDraw();

    const scale = stage.scaleX();
    const stagePos = stage.position();
    const croppedCanvas = stage.toCanvas({
      pixelRatio: 2,
      x: bounds.minX * scale + stagePos.x - EXPORT_PADDING * scale,
      y: bounds.minY * scale + stagePos.y - EXPORT_PADDING * scale,
      width: (bounds.maxX - bounds.minX + EXPORT_PADDING * 2) * scale,
      height: (bounds.maxY - bounds.minY + EXPORT_PADDING * 2) * scale,
    });
    const output = document.createElement('canvas');
    output.width = croppedCanvas.width;
    output.height = croppedCanvas.height;
    const context = output.getContext('2d');
    if (!context) throw new Error('unable to prepare PNG canvas');
    context.fillStyle = PNG_BACKGROUND;
    context.fillRect(0, 0, output.width, output.height);
    context.drawImage(croppedCanvas, 0, 0);
    return output.toDataURL('image/png');
  } finally {
    textFills.forEach(([node, fill]) => node.fill(fill));
    if (wasDark) root.classList.add('dark');
    trLayer.visible(trWasVisible);
    laserLayer.visible(laserWasVisible);
    if (textWasVisible) textOverlay.classList.add('visible');
    stage.batchDraw();
  }
}

/**
 * Export the current diagram as a PNG, cropped to content + padding.
 * Temporarily hides transformer handles and laser layer during export.
 */
export function exportPNG() {
  const elements = getElements();
  if (elements.length === 0) {
    alert('Nothing to export! Draw something first.');
    return;
  }

  try {
    const dataUrl = createCroppedPNG(elements);
    download(dataUrl, `sketchboard-${Date.now()}.png`, 'dataURL');
  } catch (err) {
    reportError(err, { area: 'png-export' });
    alert(`Failed to export PNG: ${err.message}`);
  }
}

/**
 * Copy PNG image directly to clipboard for fast pasting in Slack, Docs, etc.
 */
export async function copyPNGToClipboard() {
  const elements = getElements();
  if (elements.length === 0) {
    alert('Nothing to copy! Draw something first.');
    return;
  }

  try {
    if (!navigator.clipboard?.write || typeof ClipboardItem === 'undefined') {
      throw new Error('image clipboard access is not supported in this browser');
    }
    const dataUrl = createCroppedPNG(elements);
    const res = await fetch(dataUrl);
    const blob = await res.blob();
    await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
    alert('Copied PNG image to clipboard!');
  } catch (err) {
    alert(`Clipboard copy not supported or permission denied: ${err.message}`);
  }
}
