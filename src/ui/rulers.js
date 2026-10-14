/** Canvas rulers that stay aligned with the stage viewport. */

function niceStep(scale) {
  const target = 80 / scale;
  const power = 10 ** Math.floor(Math.log10(target));
  return [1, 2, 5, 10].find((factor) => factor * power >= target) * power;
}

export function initRulers({ getViewport, getStageSize }) {
  const app = document.getElementById('app');
  const horizontal = document.createElement('canvas');
  const vertical = document.createElement('canvas');
  horizontal.className = 'canvas-ruler canvas-ruler-horizontal';
  vertical.className = 'canvas-ruler canvas-ruler-vertical';
  app.append(horizontal, vertical);

  function update(visible) {
    horizontal.hidden = !visible; vertical.hidden = !visible;
    if (!visible) return;
    const viewport = getViewport(); const size = getStageSize();
    horizontal.width = size.width; horizontal.height = 22;
    vertical.width = 22; vertical.height = size.height;
    const foreground = getComputedStyle(document.documentElement).getPropertyValue('--sb-text-muted') || '#6b7280';
    [horizontal, vertical].forEach((canvas) => {
      const context = canvas.getContext('2d'); context.clearRect(0, 0, canvas.width, canvas.height); context.fillStyle = 'rgba(255,255,255,.72)'; context.fillRect(0, 0, canvas.width, canvas.height); context.strokeStyle = foreground; context.fillStyle = foreground; context.font = '10px Inter, sans-serif';
    });
    const step = niceStep(viewport.scale);
    const startX = Math.floor((-viewport.x / viewport.scale) / step) * step;
    const startY = Math.floor((-viewport.y / viewport.scale) / step) * step;
    const h = horizontal.getContext('2d');
    for (let value = startX; (value * viewport.scale + viewport.x) <= size.width; value += step) { const x = value * viewport.scale + viewport.x; h.beginPath(); h.moveTo(x, 22); h.lineTo(x, 12); h.stroke(); h.fillText(String(Math.round(value)), x + 3, 10); }
    const v = vertical.getContext('2d');
    for (let value = startY; (value * viewport.scale + viewport.y) <= size.height; value += step) { const y = value * viewport.scale + viewport.y; v.beginPath(); v.moveTo(22, y); v.lineTo(12, y); v.stroke(); v.save(); v.translate(10, y - 3); v.rotate(-Math.PI / 2); v.fillText(String(Math.round(value)), 0, 0); v.restore(); }
  }
  return { update, destroy: () => { horizontal.remove(); vertical.remove(); } };
}
