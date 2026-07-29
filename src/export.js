/**
 * export.js — JSON export/import and PNG export.
 * Operates on scene.js arrays — does NOT use Konva's built-in toJSON().
 */

import { serialize, deserialize, getElements } from './scene.js';
import { getStage, getTransformerLayer, getLaserLayer } from './stage.js';

/**
 * Download a file in the browser.
 * The anchor must be appended to the DOM for Firefox compatibility.
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
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => {
    if (a.href.startsWith('blob:')) URL.revokeObjectURL(a.href);
  }, 1000);
}

/**
 * Export the current diagram as a JSON file.
 */
export function exportJSON(appState = {}) {
  const data = {
    ...serialize(),
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
 * Trigger a file picker, parse JSON, and call the provided callback.
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
        deserialize(data);
        if (onImport) onImport(data);
      } catch (err) {
        alert(`Failed to import: ${err.message}`);
      } finally {
        document.body.removeChild(input);
      }
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

  // Hide text editor overlay if open
  const textOverlay = document.getElementById('text-editor-overlay');
  const textWasVisible = textOverlay && textOverlay.classList.contains('visible');
  if (textWasVisible) textOverlay.classList.remove('visible');

  // Calculate bounding box of all elements in stage space
  const PADDING = 60;
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

  elements.forEach((el) => {
    if (el.type === 'freedraw' && el.points && el.points.length > 0) {
      el.points.forEach(([px, py]) => {
        minX = Math.min(minX, el.x + px);
        minY = Math.min(minY, el.y + py);
        maxX = Math.max(maxX, el.x + px);
        maxY = Math.max(maxY, el.y + py);
      });
    } else {
      minX = Math.min(minX, el.x);
      minY = Math.min(minY, el.y);
      maxX = Math.max(maxX, el.x + Math.abs(el.width || 0));
      maxY = Math.max(maxY, el.y + Math.abs(el.height || 0));
    }
  });

  const scale = stage.scaleX();
  const stagePos = stage.position();

  // Stage-space bounding box → screen-space crop rectangle
  const x = (minX - PADDING) * scale + stagePos.x;
  const y = (minY - PADDING) * scale + stagePos.y;
  const width  = (maxX - minX + PADDING * 2) * scale;
  const height = (maxY - minY + PADDING * 2) * scale;

  // Force synchronous draw before snapshot
  stage.draw();

  const dataUrl = stage.toDataURL({
    pixelRatio: 2,
    x,
    y,
    width,
    height,
    mimeType: 'image/png',
  });

  // Restore layers
  trLayer.visible(trWasVisible);
  laserLayer.visible(laserWasVisible);
  if (textWasVisible) textOverlay.classList.add('visible');
  stage.batchDraw();

  download(dataUrl, `sketchboard-${Date.now()}.png`, 'dataURL');
}
