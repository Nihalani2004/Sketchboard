/**
 * toolbar.js — Floating top-center toolbar with Lucide icons and keyboard shortcuts.
 * Uses lucide's createIcons() pattern with data-lucide attributes.
 */

import {
  createIcons,
  MousePointer2,
  Square,
  Circle,
  Minus,
  MoveRight,
  Pen,
  Type,
  Zap,
  Hand,
  Sun,
  Moon,
  Trash2,
} from 'lucide';

const TOOLS = [
  { id: 'select',    label: 'Select',    icon: 'mouse-pointer-2', key: 'V' },
  { id: 'rectangle', label: 'Rectangle', icon: 'square',          key: 'R' },
  { id: 'ellipse',   label: 'Ellipse',   icon: 'circle',          key: 'E' },
  { id: 'arrow',     label: 'Arrow',     icon: 'move-right',      key: 'A' },
  { id: 'line',      label: 'Line',      icon: 'minus',           key: 'L' },
  { id: 'freehand',  label: 'Pen',       icon: 'pen',             key: 'P' },
  { id: 'text',      label: 'Text',      icon: 'type',            key: 'T' },
  { id: 'laser',     label: 'Laser',     icon: 'zap',             key: 'Z' },
  { id: 'pan',       label: 'Pan',       icon: 'hand',            key: 'H' },
];

let activeTool = 'select';
let onToolChangeCb = null;
let onClearCb = null;
let _isDark = false;

export function onToolChange(cb) { onToolChangeCb = cb; }
export function onClear(cb) { onClearCb = cb; }
export function getActiveTool() { return activeTool; }

export function setActiveTool(id) {
  activeTool = id;
  _updateActiveState();
}

export function initToolbar(isDark, onThemeToggle) {
  _isDark = isDark;
  const toolbar = document.getElementById('toolbar');
  toolbar.innerHTML = '';

  TOOLS.forEach((tool) => {
    const btn = document.createElement('button');
    btn.className = 'toolbar-btn';
    btn.id = `tool-${tool.id}`;
    btn.setAttribute('data-tool', tool.id);
    btn.setAttribute('data-tooltip', `${tool.label} [${tool.key}]`);
    btn.setAttribute('aria-label', tool.label);
    btn.innerHTML = `<i data-lucide="${tool.icon}" style="width:18px;height:18px;stroke-width:1.8"></i>`;
    btn.addEventListener('click', () => {
      activeTool = tool.id;
      _updateActiveState();
      if (onToolChangeCb) onToolChangeCb(tool.id);
    });
    toolbar.appendChild(btn);

    // Divider before pan
    if (tool.id === 'laser') {
      const div = document.createElement('div');
      div.className = 'toolbar-divider';
      toolbar.appendChild(div);
    }
  });

  // Divider before utilities
  const div2 = document.createElement('div');
  div2.className = 'toolbar-divider';
  toolbar.appendChild(div2);

  // Theme toggle
  const themeBtn = document.createElement('button');
  themeBtn.className = 'toolbar-btn';
  themeBtn.id = 'btn-theme';
  themeBtn.setAttribute('data-tooltip', 'Toggle Dark Mode [D]');
  themeBtn.setAttribute('aria-label', 'Toggle dark mode');
  themeBtn.innerHTML = `<i data-lucide="${isDark ? 'sun' : 'moon'}" style="width:18px;height:18px;stroke-width:1.8"></i>`;
  themeBtn.addEventListener('click', () => {
    const nowDark = document.documentElement.classList.toggle('dark');
    _isDark = nowDark;
    themeBtn.innerHTML = `<i data-lucide="${nowDark ? 'sun' : 'moon'}" style="width:18px;height:18px;stroke-width:1.8"></i>`;
    createIcons({ icons: { Sun, Moon }, nameAttr: 'data-lucide', attrs: { 'stroke-width': '1.8' } });
    if (onThemeToggle) onThemeToggle(nowDark);
  });
  toolbar.appendChild(themeBtn);

  // Clear canvas
  const clearBtn = document.createElement('button');
  clearBtn.className = 'toolbar-btn';
  clearBtn.id = 'btn-clear';
  clearBtn.setAttribute('data-tooltip', 'Clear Canvas');
  clearBtn.setAttribute('aria-label', 'Clear canvas');
  clearBtn.innerHTML = `<i data-lucide="trash-2" style="width:18px;height:18px;stroke-width:1.8"></i>`;
  clearBtn.addEventListener('click', () => {
    if (confirm('Clear all elements? This cannot be undone.')) {
      if (onClearCb) onClearCb();
    }
  });
  toolbar.appendChild(clearBtn);

  // Materialise all icons
  createIcons({
    icons: {
      MousePointer2, Square, Circle, Minus, MoveRight, Pen, Type, Zap, Hand, Sun, Moon, Trash2,
    },
    nameAttr: 'data-lucide',
    attrs: { 'stroke-width': '1.8' },
  });

  _updateActiveState();
  _setupKeyboardShortcuts();
}

function _updateActiveState() {
  document.querySelectorAll('.toolbar-btn[data-tool]').forEach((btn) => {
    btn.classList.toggle('active', btn.getAttribute('data-tool') === activeTool);
  });
}

function _setupKeyboardShortcuts() {
  window.addEventListener('keydown', (e) => {
    if (e.target.matches('textarea, input')) return;
    if (e.ctrlKey || e.metaKey || e.altKey) return;

    const key = e.key.toUpperCase();
    const tool = TOOLS.find((t) => t.key === key);
    if (tool) {
      activeTool = tool.id;
      _updateActiveState();
      if (onToolChangeCb) onToolChangeCb(tool.id);
    }

    // D = toggle dark mode
    if (key === 'D') {
      document.getElementById('btn-theme')?.click();
    }
  });
}
