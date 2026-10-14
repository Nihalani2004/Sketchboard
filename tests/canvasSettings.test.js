import { describe, expect, it } from 'vitest';
import { normalizeCanvasSettings, settingsForPreset } from '../src/canvasSettings.js';

describe('canvas settings', () => {
  it('bounds untrusted numeric input and falls back for invalid values', () => {
    expect(normalizeCanvasSettings({ gridSize: 9999, background: 'url(javascript:bad)', gridType: 'bad' }))
      .toMatchObject({ gridSize: 200, background: '#f8f7f2', gridType: 'dots' });
  });

  it('returns a safe preset configuration', () => {
    expect(settingsForPreset('flowchart')).toMatchObject({ preset: 'flowchart', gridType: 'mesh', gridSize: 40, snapToGrid: true });
  });
});
