/** Canvas appearance defaults, presets, and input normalization. */

export const DEFAULT_CANVAS_SETTINGS = Object.freeze({
  preset: 'whiteboard',
  background: '#f8f7f2',
  gridType: 'dots',
  gridSize: 24,
  showGrid: true,
  showRulers: false,
  snapToGrid: false,
  snapToElements: true,
});

export const CANVAS_PRESETS = Object.freeze({
  whiteboard: { background: '#f8f7f2', gridType: 'dots', gridSize: 24, showGrid: true, showRulers: false, snapToGrid: false, snapToElements: true },
  graph: { background: '#ffffff', gridType: 'mesh', gridSize: 20, showGrid: true, showRulers: true, snapToGrid: true, snapToElements: true },
  flowchart: { background: '#f8fafc', gridType: 'mesh', gridSize: 40, showGrid: true, showRulers: true, snapToGrid: true, snapToElements: true },
  dark: { background: '#12121e', gridType: 'dots', gridSize: 24, showGrid: true, showRulers: false, snapToGrid: false, snapToElements: true },
});

const GRID_TYPES = new Set(['dots', 'mesh', 'none']);
const PRESET_NAMES = new Set(Object.keys(CANVAS_PRESETS));

export function normalizeCanvasSettings(input = {}) {
  const merged = { ...DEFAULT_CANVAS_SETTINGS, ...input };
  const preset = PRESET_NAMES.has(merged.preset) ? merged.preset : DEFAULT_CANVAS_SETTINGS.preset;
  const gridSize = Number.isFinite(merged.gridSize)
    ? Math.max(8, Math.min(200, Math.round(merged.gridSize)))
    : DEFAULT_CANVAS_SETTINGS.gridSize;

  return {
    preset,
    background: typeof merged.background === 'string' && /^#[0-9a-f]{6}$/i.test(merged.background)
      ? merged.background
      : DEFAULT_CANVAS_SETTINGS.background,
    gridType: GRID_TYPES.has(merged.gridType) ? merged.gridType : DEFAULT_CANVAS_SETTINGS.gridType,
    gridSize,
    showGrid: Boolean(merged.showGrid),
    showRulers: Boolean(merged.showRulers),
    snapToGrid: Boolean(merged.snapToGrid),
    snapToElements: Boolean(merged.snapToElements),
  };
}

export function settingsForPreset(name) {
  const preset = CANVAS_PRESETS[name] || CANVAS_PRESETS.whiteboard;
  return normalizeCanvasSettings({ preset: PRESET_NAMES.has(name) ? name : 'whiteboard', ...preset });
}
