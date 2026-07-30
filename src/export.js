/**
 * export.js — JSON export/import and PNG export.
 * Operates on scene.js arrays — does NOT use Konva's built-in toJSON().
 */

import { serialize, deserialize, getElements, snapshot } from './scene.js';
import { getStage, getTransformerLayer, getLaserLayer } from './stage.js';
import { push as historyPush } from './history.js';

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
    elements: serialized.elements,
    appState: {
      background: document.documentElement.classList.contains('dark') ? 'dark' : 'light',
      ...appState,
    },
    exportedAt: new Date().toISOString(),
    app: 'Sketchboard',
    version: 1,
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
  input.onchange = (e) => {
    const file = e.target.files[0];
    if (!file) { document.body.removeChild(input); return; }
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const data = JSON.parse(ev.target.result);

        // Validate the JSON structure
        if (!data || !Array.isArray(data.elements)) {
          alert('Invalid file: not a Sketchboard JSON export.');
          document.body.removeChild(input);
          return;
        }

        // Save current state so user can undo the import
        historyPush(snapshot());

        // Replace elements with imported data
        deserialize(data);

        if (onImport) onImport(data);
      } catch (err) {
        alert(`Failed to import: ${err.message}`);
      }
      document.body.removeChild(input);
    };
    reader.readAsText(file);
  };
  input.click();
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

  const stage = getStage();
  const trLayer = getTransformerLayer();
  const laserLayer = getLaserLayer();

  // Hide UI layers
  const trWasVisible = trLayer.visible();
  const laserWasVisible = laserLayer.visible();
  trLayer.visible(false);
  laserLayer.visible(false);

  // Also hide text editor overlay if open
  const textOverlay = document.getElementById('text-editor-overlay');
  const textWasVisible = textOverlay && textOverlay.classList.contains('visible');
  if (textWasVisible) textOverlay.classList.remove('visible');

  // Calculate bounding box of all elements
  const PADDING = 40;
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  elements.forEach((el) => {
    if (el.type === 'freedraw' && el.points && el.points.length > 0) {
      const pts = el.points;
      for (let i = 0; i < pts.length; i++) {
        const p = Array.isArray(pts[i]) ? pts[i] : null;
        if (!p) continue;
        const px = el.x + p[0];
        const py = el.y + p[1];
        minX = Math.min(minX, px);
        minY = Math.min(minY, py);
        maxX = Math.max(maxX, px);
        maxY = Math.max(maxY, py);
      }
    } else {
      minX = Math.min(minX, el.x);
      minY = Math.min(minY, el.y);
      maxX = Math.max(maxX, el.x + Math.abs(el.width || 100));
      maxY = Math.max(maxY, el.y + Math.abs(el.height || 30));
    }
  });

  const scale = stage.scaleX();
  const stagePos = stage.position();

  // Convert stage-space bounding box to screen-space crop
  const screenX = minX * scale + stagePos.x - PADDING * scale;
  const screenY = minY * scale + stagePos.y - PADDING * scale;
  const screenW = (maxX - minX) * scale + PADDING * 2 * scale;
  const screenH = (maxY - minY) * scale + PADDING * 2 * scale;

  stage.batchDraw();

  const dataUrl = stage.toDataURL({
    pixelRatio: 2,
    x: screenX,
    y: screenY,
    width: screenW,
    height: screenH,
    mimeType: 'image/png',
  });

  // Restore layers
  trLayer.visible(trWasVisible);
  laserLayer.visible(laserWasVisible);
  if (textWasVisible) textOverlay.classList.add('visible');

  download(dataUrl, `sketchboard-${Date.now()}.png`, 'dataURL');
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

  const stage = getStage();
  const trLayer = getTransformerLayer();
  const laserLayer = getLaserLayer();

  const trWasVisible = trLayer.visible();
  const laserWasVisible = laserLayer.visible();
  trLayer.visible(false);
  laserLayer.visible(false);

  const textOverlay = document.getElementById('text-editor-overlay');
  const textWasVisible = textOverlay && textOverlay.classList.contains('visible');
  if (textWasVisible) textOverlay.classList.remove('visible');

  const PADDING = 40;
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  elements.forEach((el) => {
    minX = Math.min(minX, el.x);
    minY = Math.min(minY, el.y);
    maxX = Math.max(maxX, el.x + Math.abs(el.width || 100));
    maxY = Math.max(maxY, el.y + Math.abs(el.height || 30));
  });

  const scale = stage.scaleX();
  const stagePos = stage.position();

  const screenX = minX * scale + stagePos.x - PADDING * scale;
  const screenY = minY * scale + stagePos.y - PADDING * scale;
  const screenW = (maxX - minX) * scale + PADDING * 2 * scale;
  const screenH = (maxY - minY) * scale + PADDING * 2 * scale;

  stage.batchDraw();

  const dataUrl = stage.toDataURL({
    pixelRatio: 2,
    x: screenX,
    y: screenY,
    width: screenW,
    height: screenH,
    mimeType: 'image/png',
  });

  trLayer.visible(trWasVisible);
  laserLayer.visible(laserWasVisible);
  if (textWasVisible) textOverlay.classList.add('visible');

  try {
    const res = await fetch(dataUrl);
    const blob = await res.blob();
    await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
    alert('Copied PNG image to clipboard!');
  } catch (err) {
    alert(`Clipboard copy not supported or permission denied: ${err.message}`);
  }
}
