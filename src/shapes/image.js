/** Konva image node backed by a validated in-document data URL. */

import Konva from 'konva';

const imageCache = new Map();

function loadImage(src) {
  let entry = imageCache.get(src);
  if (entry) return entry;

  const image = new window.Image();
  entry = { image, loaded: false, failed: false, nodes: new Set() };
  image.onload = () => {
    entry.loaded = true;
    entry.nodes.forEach((node) => node.getLayer()?.batchDraw());
    entry.nodes.clear();
  };
  image.onerror = () => {
    entry.failed = true;
    entry.nodes.clear();
  };
  image.src = src;
  imageCache.set(src, entry);
  return entry;
}

export function createImageShape(el) {
  const entry = loadImage(el.src);
  const node = new Konva.Image({
    x: el.x,
    y: el.y,
    width: el.width,
    height: el.height,
    rotation: el.angle || 0,
    opacity: el.opacity ?? 1,
    image: entry.image,
    id: el.id,
    draggable: false,
    name: 'element',
  });
  node.attrs.elementId = el.id;
  node.attrs.elementType = 'image';
  if (!entry.loaded && !entry.failed) entry.nodes.add(node);
  node.on('destroy', () => entry.nodes.delete(node));
  return node;
}
