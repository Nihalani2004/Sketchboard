/** Compact shape library that leaves the existing toolbar untouched. */

import { EXTRA_SHAPES, FLOWCHART_SHAPES } from '../shapes/catalog.js';

export function initShapePalette(onSelect) {
  const library = document.createElement('div');
  library.id = 'shape-library';
  library.innerHTML = `
    <button id="shape-library-trigger" type="button" aria-expanded="false" aria-controls="shape-library-menu">
      More shapes
    </button>
    <div id="shape-library-menu" class="hidden" role="menu" aria-label="More shapes"></div>
  `;
  document.getElementById('app').appendChild(library);

  const trigger = library.querySelector('#shape-library-trigger');
  const menu = library.querySelector('#shape-library-menu');
  const renderSection = (title, shapes) => {
    const heading = document.createElement('div');
    heading.className = 'shape-library-heading';
    heading.textContent = title;
    menu.appendChild(heading);
    shapes.forEach((shape) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'shape-library-item';
      button.setAttribute('role', 'menuitem');
      button.textContent = shape.label;
      button.addEventListener('click', () => {
        close();
        onSelect(shape.id);
      });
      menu.appendChild(button);
    });
  };
  renderSection('Shapes', EXTRA_SHAPES);
  renderSection('Flowchart', FLOWCHART_SHAPES);

  function close() {
    menu.classList.add('hidden');
    trigger.setAttribute('aria-expanded', 'false');
  }

  trigger.addEventListener('click', () => {
    const opening = menu.classList.contains('hidden');
    menu.classList.toggle('hidden', !opening);
    trigger.setAttribute('aria-expanded', String(opening));
  });
  document.addEventListener('pointerdown', (event) => {
    if (!library.contains(event.target)) close();
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') close();
  });
}
