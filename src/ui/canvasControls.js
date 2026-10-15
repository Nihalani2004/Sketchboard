import { CANVAS_PRESETS } from '../canvasSettings.js';

function button(label, title, className = 'canvas-control-btn') {
  const element = document.createElement('button'); element.type = 'button'; element.className = className; element.textContent = label; element.title = title; return element;
}

export function initCanvasControls({ onSettingsChange, onPreset, onPageAction, onZoomSelection, onPresentation, onRecentDocuments = () => {}, onNewDocument = () => {} }) {
  const app = document.getElementById('app');
  const settings = document.createElement('aside'); settings.id = 'canvas-settings'; settings.setAttribute('aria-label', 'Canvas settings');
  settings.innerHTML = '<button id="canvas-settings-toggle" type="button" aria-expanded="false">Canvas</button><div id="canvas-settings-panel" hidden></div>';
  const panel = settings.querySelector('#canvas-settings-panel');
  panel.innerHTML = '<label>Preset <select id="canvas-preset"></select></label><label>Grid <select id="canvas-grid-size"><option value="16">16 px</option><option value="20">20 px</option><option value="24">24 px</option><option value="32">32 px</option><option value="40">40 px</option><option value="50">50 px</option></select></label><label><input id="canvas-show-grid" type="checkbox"> Show grid</label><label><input id="canvas-show-rulers" type="checkbox"> Show rulers</label><label><input id="canvas-snap-grid" type="checkbox"> Snap to grid</label><label><input id="canvas-snap-elements" type="checkbox"> Snap to elements</label><button id="canvas-new-document" type="button">New board</button><button id="canvas-recent-documents" type="button">Recent drafts</button>';
  const preset = panel.querySelector('#canvas-preset');
  Object.keys(CANVAS_PRESETS).forEach((name) => { const option = document.createElement('option'); option.value = name; option.textContent = name[0].toUpperCase() + name.slice(1); preset.appendChild(option); });
  const toggle = settings.querySelector('#canvas-settings-toggle');
  const closeSettings = () => { panel.hidden = true; toggle.setAttribute('aria-expanded', 'false'); };
  toggle.addEventListener('click', () => { const open = panel.hidden; panel.hidden = !open; toggle.setAttribute('aria-expanded', String(open)); });
  document.addEventListener('pointerdown', (event) => {
    if (!panel.hidden && !settings.contains(event.target)) closeSettings();
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && !panel.hidden) {
      closeSettings();
      toggle.focus();
    }
  });
  panel.querySelector('#canvas-new-document').addEventListener('click', onNewDocument);
  panel.querySelector('#canvas-recent-documents').addEventListener('click', onRecentDocuments);
  preset.addEventListener('change', () => onPreset(preset.value));
  panel.querySelectorAll('input, #canvas-grid-size').forEach((input) => input.addEventListener('change', () => onSettingsChange({ gridSize: Number(panel.querySelector('#canvas-grid-size').value), showGrid: panel.querySelector('#canvas-show-grid').checked, showRulers: panel.querySelector('#canvas-show-rulers').checked, snapToGrid: panel.querySelector('#canvas-snap-grid').checked, snapToElements: panel.querySelector('#canvas-snap-elements').checked })));

  const pages = document.createElement('nav'); pages.id = 'page-controls'; pages.setAttribute('aria-label', 'Document pages');
  const add = button('+', 'Add page'); const previous = button('‹', 'Previous page'); const next = button('›', 'Next page'); const duplicate = button('Duplicate', 'Duplicate current page'); const remove = button('Delete', 'Delete current page'); const present = button('Present', 'Presentation mode'); const zoomSelection = button('Selection', 'Zoom to selection (Shift+F)');
  const list = document.createElement('div'); list.id = 'page-list';
  pages.append(previous, next, list, add, duplicate, remove, zoomSelection, present);
  add.addEventListener('click', () => onPageAction('add')); previous.addEventListener('click', () => onPageAction('previous')); next.addEventListener('click', () => onPageAction('next')); duplicate.addEventListener('click', () => onPageAction('duplicate')); remove.addEventListener('click', () => onPageAction('delete')); present.addEventListener('click', onPresentation); zoomSelection.addEventListener('click', onZoomSelection);
  app.append(settings, pages);

  function updateSettings(value) {
    preset.value = value.preset; panel.querySelector('#canvas-grid-size').value = String(value.gridSize); panel.querySelector('#canvas-show-grid').checked = value.showGrid; panel.querySelector('#canvas-show-rulers').checked = value.showRulers; panel.querySelector('#canvas-snap-grid').checked = value.snapToGrid; panel.querySelector('#canvas-snap-elements').checked = value.snapToElements;
  }
  function updatePages(allPages, activeId) {
    list.replaceChildren();
    allPages.forEach((page) => { const item = button(page.title, `Open ${page.title}`, 'page-tab'); item.classList.toggle('active', page.id === activeId); item.addEventListener('click', () => onPageAction('switch', page.id)); item.addEventListener('dblclick', () => onPageAction('rename', page.id)); list.appendChild(item); });
    remove.disabled = allPages.length <= 1;
  }
  return { updateSettings, updatePages };
}
