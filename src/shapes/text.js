/**
 * text.js — Renders a 'text' scene element as a Konva.Text node.
 */

import Konva from 'konva';

/**
 * Create a Konva.Text from a text element.
 * @param {object} el - scene element with type === 'text'
 */
export function createTextShape(el) {
  const isDark = document.documentElement.classList.contains('dark');
  let color = el.strokeColor || '#1e1e1e';
  if (isDark && (color === '#1e1e1e' || color === '#000000' || color === '#000')) {
    color = '#e8e8e8';
  }

  const node = new Konva.Text({
    x: el.x,
    y: el.y,
    text: el.text || '',
    fontSize: el.fontSize || 20,
    fontFamily: el.fontFamily || "'Caveat', cursive",
    fill: color,
    opacity: el.opacity ?? 1,
    rotation: el.angle || 0,
    id: el.id,
    draggable: false,
    name: 'element',
    align: 'left',
    wrap: 'word',
    width: el.width || undefined,
  });

  // Store extra attrs for later access
  node.attrs.elementId = el.id;
  node.attrs.elementType = 'text';

  return node;
}

/**
 * Update an existing Konva.Text node from a partial patch.
 */
export function updateTextShape(node, patch) {
  if (patch.text !== undefined) node.text(patch.text);
  if (patch.fontSize !== undefined) node.fontSize(patch.fontSize);
  if (patch.fontFamily !== undefined) node.fontFamily(patch.fontFamily);
  if (patch.strokeColor !== undefined) node.fill(patch.strokeColor);
  if (patch.opacity !== undefined) node.opacity(patch.opacity);
  if (patch.x !== undefined) node.x(patch.x);
  if (patch.y !== undefined) node.y(patch.y);
  if (patch.angle !== undefined) node.rotation(patch.angle);
  if (patch.width !== undefined) node.width(patch.width);
}
