/** Accessible non-blocking notification surface for recoverable application errors. */

export function initUserNotifier() {
  const element = document.createElement('div');
  element.id = 'user-notification';
  element.setAttribute('role', 'alert');
  element.setAttribute('aria-live', 'assertive');
  document.getElementById('app').appendChild(element);
  let dismissTimer = null;

  return {
    show(message) {
      element.textContent = message;
      element.classList.add('visible');
      if (dismissTimer) clearTimeout(dismissTimer);
      dismissTimer = setTimeout(() => element.classList.remove('visible'), 7000);
    },
  };
}
