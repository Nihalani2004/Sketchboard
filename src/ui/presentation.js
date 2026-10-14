export function initPresentation({ onPrevious, onNext, getTitle }) {
  const overlay = document.createElement('div'); overlay.id = 'presentation-controls'; overlay.hidden = true;
  const previous = document.createElement('button'); previous.textContent = '‹ Previous'; const title = document.createElement('span'); const next = document.createElement('button'); next.textContent = 'Next ›'; const fullscreen = document.createElement('button'); fullscreen.textContent = 'Fullscreen'; const exit = document.createElement('button'); exit.textContent = 'Exit';
  overlay.append(previous, title, next, fullscreen, exit); document.getElementById('app').appendChild(overlay);
  let active = false;
  const update = () => { title.textContent = getTitle(); };
  const keydown = (event) => { if (!active) return; if (['ArrowRight', 'PageDown'].includes(event.key)) { event.preventDefault(); event.stopPropagation(); onNext(); update(); } else if (['ArrowLeft', 'PageUp'].includes(event.key)) { event.preventDefault(); event.stopPropagation(); onPrevious(); update(); } else if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); exitMode(); } };
  function enter() { active = true; document.body.classList.add('presentation-mode'); overlay.hidden = false; update(); window.addEventListener('keydown', keydown, true); }
  function exitMode() { active = false; document.body.classList.remove('presentation-mode'); overlay.hidden = true; window.removeEventListener('keydown', keydown, true); if (document.fullscreenElement) document.exitFullscreen().catch(() => {}); }
  previous.addEventListener('click', () => { onPrevious(); update(); }); next.addEventListener('click', () => { onNext(); update(); }); exit.addEventListener('click', exitMode); fullscreen.addEventListener('click', () => document.documentElement.requestFullscreen?.().catch(() => {}));
  return { enter, exit: exitMode, isActive: () => active, update };
}
