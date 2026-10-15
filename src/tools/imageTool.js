/** Safe drag/drop and clipboard image insertion for the canvas. */

import { addElement, createElement, snapshot } from '../scene.js';
import { getStage, screenToStage } from '../stage.js';
import { push as historyPush } from '../history.js';

const ALLOWED_IMAGE_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/gif']);
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const MAX_BATCH_BYTES = 10 * 1024 * 1024;
const MAX_IMAGE_DIMENSION = 4096;
const MAX_INSERTED_IMAGES = 5;
const MAX_DISPLAY_DIMENSION = 900;

export function isSupportedImageFile(file) {
  return Boolean(file && ALLOWED_IMAGE_TYPES.has(file.type) && file.size > 0 && file.size <= MAX_IMAGE_BYTES);
}

function readAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('could not read the image file'));
    reader.onload = () => resolve(reader.result);
    reader.readAsDataURL(file);
  });
}

function readDimensions(src) {
  return new Promise((resolve, reject) => {
    const image = new window.Image();
    image.onload = () => resolve({ width: image.naturalWidth, height: image.naturalHeight });
    image.onerror = () => reject(new Error('could not decode the image'));
    image.src = src;
  });
}

export function getDisplaySize(width, height) {
  if (!Number.isFinite(width) || !Number.isFinite(height) || width < 1 || height < 1 || width > MAX_IMAGE_DIMENSION || height > MAX_IMAGE_DIMENSION) return null;
  const scale = Math.min(1, MAX_DISPLAY_DIMENSION / Math.max(width, height));
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) };
}

async function prepareImage(file) {
  if (!isSupportedImageFile(file)) throw new Error('use a PNG, JPEG, WebP, or GIF image no larger than 5 MB');
  const src = await readAsDataUrl(file);
  const dimensions = await readDimensions(src);
  const displaySize = getDisplaySize(dimensions.width, dimensions.height);
  if (!displaySize) throw new Error('image dimensions must be between 1 and 4096 pixels');
  return { src, ...displaySize };
}

function getClipboardImages(event) {
  return Array.from(event.clipboardData?.items || [])
    .filter((item) => item.kind === 'file' && ALLOWED_IMAGE_TYPES.has(item.type))
    .map((item) => item.getAsFile())
    .filter(Boolean);
}

export function hasSupportedImageTransfer(dataTransfer) {
  if (!dataTransfer) return false;
  const files = Array.from(dataTransfer.files || []);
  if (files.some((file) => ALLOWED_IMAGE_TYPES.has(file.type))) return true;
  return Array.from(dataTransfer.items || []).some((item) => item.kind === 'file' && ALLOWED_IMAGE_TYPES.has(item.type));
}

export function initImageSupport({ onInserted = () => {}, onError = () => {} } = {}) {
  const stage = getStage();
  const container = stage.container();

  async function insertFiles(files, position) {
    let totalBytes = 0;
    let skippedCount = 0;
    const candidates = [];

    Array.from(files).forEach((file) => {
      if (!isSupportedImageFile(file) || candidates.length >= MAX_INSERTED_IMAGES || totalBytes + file.size > MAX_BATCH_BYTES) {
        skippedCount += 1;
        return;
      }
      totalBytes += file.size;
      candidates.push(file);
    });

    if (candidates.length === 0) {
      onError('Use PNG, JPEG, WebP, or GIF images under 5 MB.');
      return;
    }

    const results = await Promise.allSettled(candidates.map(prepareImage));
    const images = results.filter((result) => result.status === 'fulfilled').map((result) => result.value);
    const errors = results.filter((result) => result.status === 'rejected');
    if (images.length === 0) {
      onError(errors[0]?.reason?.message || 'No supported images were found.');
      return;
    }

    historyPush(snapshot());
    images.forEach((image, index) => {
      const offset = index * 24;
      addElement(createElement('image', {
        x: position.x - image.width / 2 + offset,
        y: position.y - image.height / 2 + offset,
        width: image.width,
        height: image.height,
        src: image.src,
      }));
    });
    onInserted();
    const failedCount = skippedCount + errors.length;
    if (failedCount > 0) onError(`${failedCount} image${failedCount === 1 ? '' : 's'} could not be added.`);
  }

  function onDragOver(event) {
    if (!hasSupportedImageTransfer(event.dataTransfer)) return;
    event.preventDefault();
    if (event.dataTransfer) event.dataTransfer.dropEffect = 'copy';
    container.classList.add('image-drop-active');
  }

  function onDrop(event) {
    if (!hasSupportedImageTransfer(event.dataTransfer)) return;
    event.preventDefault();
    container.classList.remove('image-drop-active');
    insertFiles(event.dataTransfer.files, screenToStage(event.clientX, event.clientY));
  }

  function onDragLeave(event) {
    if (!container.contains(event.relatedTarget)) container.classList.remove('image-drop-active');
  }

  function onPaste(event) {
    if (typeof event.target?.matches === 'function' && event.target.matches('textarea, input')) return;
    const files = getClipboardImages(event);
    if (files.length === 0) return;
    event.preventDefault();
    insertFiles(files, screenToStage(stage.width() / 2, stage.height() / 2));
  }

  container.addEventListener('dragover', onDragOver);
  container.addEventListener('drop', onDrop);
  container.addEventListener('dragleave', onDragLeave);
  window.addEventListener('paste', onPaste);
  return () => {
    container.removeEventListener('dragover', onDragOver);
    container.removeEventListener('drop', onDrop);
    container.removeEventListener('dragleave', onDragLeave);
    window.removeEventListener('paste', onPaste);
  };
}
