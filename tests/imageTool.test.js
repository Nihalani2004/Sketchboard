import { describe, expect, it } from 'vitest';
import { getDisplaySize, hasSupportedImageTransfer, isSupportedImageFile } from '../src/tools/imageTool.js';

describe('image insertion safeguards', () => {
  it('accepts supported image files within the byte limit', () => {
    expect(isSupportedImageFile({ type: 'image/png', size: 1024 })).toBe(true);
    expect(isSupportedImageFile({ type: 'image/svg+xml', size: 1024 })).toBe(false);
    expect(isSupportedImageFile({ type: 'image/jpeg', size: 6 * 1024 * 1024 })).toBe(false);
  });

  it('preserves image aspect ratio while capping display dimensions', () => {
    expect(getDisplaySize(1800, 900)).toEqual({ width: 900, height: 450 });
    expect(getDisplaySize(100, 50)).toEqual({ width: 100, height: 50 });
    expect(getDisplaySize(5000, 100)).toBeNull();
  });

  it('recognises supported image drops from files or drag items', () => {
    expect(hasSupportedImageTransfer({ files: [{ type: 'image/webp' }], items: [] })).toBe(true);
    expect(hasSupportedImageTransfer({ files: [], items: [{ kind: 'file', type: 'image/jpeg' }] })).toBe(true);
    expect(hasSupportedImageTransfer({ files: [{ type: 'text/plain' }], items: [] })).toBe(false);
  });
});
