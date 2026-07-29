/**
 * stylePanel.js — Floating style panel for stroke, fill, roughness, etc.
 */

import { DEFAULT_STYLE } from '../scene.js';

const STROKE_COLORS = [
  '#1e1e1e', '#e03131', '#2f9e44', '#1971c2', '#f08c00',
  '#7048e8', '#c2255c', '#ffffff',
];

const FILL_COLORS = [
  'transparent', '#ffd8d8', '#d3f9d8', '#d0ebff', '#fff3bf',
  '#e5dbff', '#fcc2d7', '#f1f3f5',
];

const STROKE_WIDTHS = [
  { label: 'S', value: 1 },
  { label: 'M', value: 2 },
  { label: 'L', value: 4 },
];

const STROKE_STYLES = [
  { label: '—', value: 'solid' },
  { label: '- -', value: 'dashed' },
  { label: '···', value: 'dotted' },
];

const FILL_STYLES = [
  { label: 'None', value: 'hachure' },
  { label: 'Hatch', value: 'cross-hatch' },
  { label: 'Solid', value: 'solid' },
];

let currentStyle = { ...DEFAULT_STYLE };
let onChangeCb = null;
let panelEl = null;

export function onStyleChange(cb) { onChangeCb = cb; }

export function getCurrentStyle() { return { ...currentStyle }; }

export function updatePanelStyle(patch) {
  Object.assign(currentStyle, patch);
  _refresh();
}

export function showPanel(isText = false) {
  if (panelEl) panelEl.classList.remove('hidden');
  // Show/hide font size section
  const fontSection = document.getElementById('panel-font-section');
  if (fontSection) fontSection.style.display = isText ? '' : 'none';
}

export function hidePanel() {
  if (panelEl) panelEl.classList.add('hidden');
}

export function initStylePanel() {
  panelEl = document.getElementById('style-panel');
  panelEl.innerHTML = _buildHTML();
  _attachListeners();
  _refresh();
}

function _buildHTML() {
  return `
    <!-- Panel header -->
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;">
      <span style="font-size:12px;font-weight:700;color:var(--sb-text-primary);letter-spacing:0.02em;">Style</span>
    </div>

    <!-- Stroke color -->
    <div class="panel-section">
      <div class="panel-label">Stroke Color</div>
      <div class="color-swatches" id="stroke-swatches"></div>
      <input type="color" class="custom-color-input" id="stroke-custom" title="Custom stroke color" />
    </div>

    <!-- Background color -->
    <div class="panel-section">
      <div class="panel-label">Fill Color</div>
      <div class="color-swatches" id="fill-swatches"></div>
      <input type="color" class="custom-color-input" id="fill-custom" title="Custom fill color" />
    </div>

    <!-- Fill style -->
    <div class="panel-section">
      <div class="panel-label">Fill Style</div>
      <div class="panel-row" id="fill-style-btns"></div>
    </div>

    <!-- Stroke width -->
    <div class="panel-section">
      <div class="panel-label">Stroke Width</div>
      <div class="panel-row" id="stroke-width-btns"></div>
    </div>

    <!-- Stroke style -->
    <div class="panel-section">
      <div class="panel-label">Stroke Style</div>
      <div class="panel-row" id="stroke-style-btns"></div>
    </div>

    <!-- Roughness -->
    <div class="panel-section">
      <div class="panel-label">Roughness <span id="roughness-val" style="float:right;color:var(--sb-accent);font-weight:700"></span></div>
      <input type="range" class="panel-slider" id="roughness-slider" min="0" max="4" step="0.1" />
    </div>

    <!-- Opacity -->
    <div class="panel-section">
      <div class="panel-label">Opacity <span id="opacity-val" style="float:right;color:var(--sb-accent);font-weight:700"></span></div>
      <input type="range" class="panel-slider" id="opacity-slider" min="0" max="1" step="0.05" />
    </div>

    <!-- Font size (text only) -->
    <div class="panel-section" id="panel-font-section" style="display:none">
      <div class="panel-label">Font Size <span id="fontsize-val" style="float:right;color:var(--sb-accent);font-weight:700"></span></div>
      <input type="range" class="panel-slider" id="fontsize-slider" min="8" max="128" step="1" />
    </div>
  `;
}

function _attachListeners() {
  // Stroke swatches
  const strokeSwatches = document.getElementById('stroke-swatches');
  STROKE_COLORS.forEach((color) => {
    const s = _makeSwatch(color, color === currentStyle.strokeColor);
    s.addEventListener('click', () => {
      currentStyle.strokeColor = color;
      _refresh();
      _emit({ strokeColor: color });
    });
    strokeSwatches.appendChild(s);
  });

  // Fill swatches
  const fillSwatches = document.getElementById('fill-swatches');
  FILL_COLORS.forEach((color) => {
    const s = color === 'transparent'
      ? _makeTransparentSwatch()
      : _makeSwatch(color, color === currentStyle.backgroundColor);
    s.addEventListener('click', () => {
      currentStyle.backgroundColor = color;
      _refresh();
      _emit({ backgroundColor: color });
    });
    fillSwatches.appendChild(s);
  });

  // Custom stroke color
  const strokeCustom = document.getElementById('stroke-custom');
  strokeCustom.value = currentStyle.strokeColor.startsWith('#') ? currentStyle.strokeColor : '#1e1e1e';
  strokeCustom.addEventListener('input', (e) => {
    currentStyle.strokeColor = e.target.value;
    _emit({ strokeColor: e.target.value });
  });

  // Custom fill color
  const fillCustom = document.getElementById('fill-custom');
  fillCustom.value = '#ffffff';
  fillCustom.addEventListener('input', (e) => {
    currentStyle.backgroundColor = e.target.value;
    _emit({ backgroundColor: e.target.value });
  });

  // Fill style buttons
  const fillStyleBtns = document.getElementById('fill-style-btns');
  FILL_STYLES.forEach(({ label, value }) => {
    const btn = document.createElement('button');
    btn.className = 'fill-style-btn';
    btn.setAttribute('data-value', value);
    btn.textContent = label;
    btn.addEventListener('click', () => {
      currentStyle.fillStyle = value;
      _refresh();
      _emit({ fillStyle: value });
    });
    fillStyleBtns.appendChild(btn);
  });

  // Stroke width buttons
  const strokeWidthBtns = document.getElementById('stroke-width-btns');
  STROKE_WIDTHS.forEach(({ label, value }) => {
    const btn = document.createElement('button');
    btn.className = 'stroke-btn';
    btn.setAttribute('data-value', value);
    btn.innerHTML = `<span style="font-weight:${value * 200 + 200}">${label}</span>`;
    btn.addEventListener('click', () => {
      currentStyle.strokeWidth = value;
      _refresh();
      _emit({ strokeWidth: value });
    });
    strokeWidthBtns.appendChild(btn);
  });

  // Stroke style buttons
  const strokeStyleBtns = document.getElementById('stroke-style-btns');
  STROKE_STYLES.forEach(({ label, value }) => {
    const btn = document.createElement('button');
    btn.className = 'stroke-btn';
    btn.setAttribute('data-value', value);
    btn.textContent = label;
    btn.addEventListener('click', () => {
      currentStyle.strokeStyle = value;
      _refresh();
      _emit({ strokeStyle: value });
    });
    strokeStyleBtns.appendChild(btn);
  });

  // Roughness slider
  const roughSlider = document.getElementById('roughness-slider');
  roughSlider.value = currentStyle.roughness;
  roughSlider.addEventListener('input', (e) => {
    currentStyle.roughness = parseFloat(e.target.value);
    document.getElementById('roughness-val').textContent = currentStyle.roughness.toFixed(1);
    _emit({ roughness: currentStyle.roughness });
  });

  // Opacity slider
  const opacitySlider = document.getElementById('opacity-slider');
  opacitySlider.value = currentStyle.opacity;
  opacitySlider.addEventListener('input', (e) => {
    currentStyle.opacity = parseFloat(e.target.value);
    document.getElementById('opacity-val').textContent = `${Math.round(currentStyle.opacity * 100)}%`;
    _emit({ opacity: currentStyle.opacity });
  });

  // Font size slider
  const fontsizeSlider = document.getElementById('fontsize-slider');
  fontsizeSlider.value = currentStyle.fontSize;
  fontsizeSlider.addEventListener('input', (e) => {
    currentStyle.fontSize = parseInt(e.target.value, 10);
    document.getElementById('fontsize-val').textContent = `${currentStyle.fontSize}px`;
    _emit({ fontSize: currentStyle.fontSize });
  });
}

function _refresh() {
  // Stroke swatches
  document.querySelectorAll('#stroke-swatches .color-swatch').forEach((s) => {
    s.classList.toggle('active', s.dataset.color === currentStyle.strokeColor);
  });

  // Fill swatches
  document.querySelectorAll('#fill-swatches .color-swatch').forEach((s) => {
    s.classList.toggle('active', s.dataset.color === currentStyle.backgroundColor);
  });

  // Fill style
  document.querySelectorAll('#fill-style-btns .fill-style-btn').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.value === currentStyle.fillStyle);
  });

  // Stroke width
  document.querySelectorAll('#stroke-width-btns .stroke-btn').forEach((btn) => {
    btn.classList.toggle('active', parseInt(btn.dataset.value) === currentStyle.strokeWidth);
  });

  // Stroke style
  document.querySelectorAll('#stroke-style-btns .stroke-btn').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.value === currentStyle.strokeStyle);
  });

  // Sliders
  const roughSlider = document.getElementById('roughness-slider');
  if (roughSlider) roughSlider.value = currentStyle.roughness;
  const roughVal = document.getElementById('roughness-val');
  if (roughVal) roughVal.textContent = Number(currentStyle.roughness).toFixed(1);

  const opSlider = document.getElementById('opacity-slider');
  if (opSlider) opSlider.value = currentStyle.opacity;
  const opVal = document.getElementById('opacity-val');
  if (opVal) opVal.textContent = `${Math.round(currentStyle.opacity * 100)}%`;

  const fsSlider = document.getElementById('fontsize-slider');
  if (fsSlider) fsSlider.value = currentStyle.fontSize;
  const fsVal = document.getElementById('fontsize-val');
  if (fsVal) fsVal.textContent = `${currentStyle.fontSize}px`;
}

function _emit(patch) {
  if (onChangeCb) onChangeCb(patch);
}

function _makeSwatch(color, active = false) {
  const s = document.createElement('div');
  s.className = 'color-swatch' + (active ? ' active' : '');
  s.style.background = color;
  s.dataset.color = color;
  s.title = color;
  // White swatch needs a visible border
  if (color === '#ffffff' || color === '#fff') {
    s.style.border = '2px solid #d1d5db';
  }
  return s;
}

function _makeTransparentSwatch() {
  const s = document.createElement('div');
  s.className = 'color-swatch transparent-swatch';
  s.dataset.color = 'transparent';
  s.title = 'Transparent';
  return s;
}
