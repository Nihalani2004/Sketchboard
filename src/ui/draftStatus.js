/** Non-blocking, accessible feedback for local draft recovery. */

const MESSAGES = {
  saved: 'Saved locally',
  restored: 'Restored your local draft',
  discarded: 'An invalid local draft was discarded',
  'too-large': 'Draft is too large to save locally. Export JSON to keep it safe.',
  unavailable: 'Local saving is unavailable in this browser session',
};

export function initDraftStatus() {
  const element = document.createElement('div');
  element.id = 'draft-status';
  element.setAttribute('role', 'status');
  element.setAttribute('aria-live', 'polite');
  document.getElementById('app').appendChild(element);
  let clearTimer = null;

  return {
    show(status) {
      const message = MESSAGES[status];
      if (!message) return;
      element.textContent = message;
      element.dataset.level = ['discarded', 'too-large', 'unavailable'].includes(status) ? 'warning' : 'info';
      element.classList.add('visible');
      if (clearTimer) clearTimeout(clearTimer);
      clearTimer = setTimeout(() => element.classList.remove('visible'), status === 'saved' ? 1600 : 5000);
    },
  };
}
