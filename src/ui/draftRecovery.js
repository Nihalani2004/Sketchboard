/** Accessible local-draft picker shared by startup recovery and Canvas settings. */

function formatUpdatedAt(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Saved recently';
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(date);
}

function button(label, className = '') {
  const element = window.document.createElement('button');
  element.type = 'button';
  element.className = className;
  element.textContent = label;
  return element;
}

export function initDraftRecovery() {
  const overlay = window.document.createElement('div');
  overlay.id = 'draft-recovery';
  overlay.hidden = true;
  overlay.setAttribute('role', 'presentation');

  const dialog = window.document.createElement('section');
  dialog.className = 'draft-recovery-dialog';
  dialog.setAttribute('role', 'dialog');
  dialog.setAttribute('aria-modal', 'true');
  dialog.setAttribute('aria-labelledby', 'draft-recovery-title');
  overlay.appendChild(dialog);
  window.document.getElementById('app').appendChild(overlay);

  let documents = [];
  let selectedId = null;
  let handlers = {};
  let dismissible = false;
  let opener = null;

  function close() {
    overlay.hidden = true;
    dialog.replaceChildren();
    opener?.focus();
  }

  function render() {
    const selected = documents.find((document) => document.id === selectedId) || documents[0];
    selectedId = selected?.id || null;
    dialog.replaceChildren();

    const title = window.document.createElement('h2');
    title.id = 'draft-recovery-title';
    title.textContent = handlers.title || 'Restore local work?';
    const description = window.document.createElement('p');
    description.className = 'draft-recovery-description';
    description.textContent = handlers.description || 'Your work is stored only in this browser. Choose a draft to continue or discard it.';
    const list = window.document.createElement('div');
    list.className = 'recent-documents-list';
    list.setAttribute('aria-label', 'Recent local documents');

    const actions = window.document.createElement('div');
    actions.className = 'draft-recovery-actions';
    const discard = button('Discard', 'draft-recovery-secondary');
    discard.disabled = !selected;
    discard.addEventListener('click', () => {
      if (!selected) return;
      handlers.onDiscard?.(selected.id);
    });
    const restore = button('Restore draft', 'draft-recovery-primary');
    restore.disabled = !selected;
    restore.addEventListener('click', () => {
      if (!selected) return;
      handlers.onRestore?.(selected.id);
    });
    actions.append(discard, restore);

    if (dismissible) {
      const closeButton = button('Close', 'draft-recovery-close');
      closeButton.addEventListener('click', close);
      actions.prepend(closeButton);
    }
    dialog.append(title, description, list, actions);

    documents.forEach((record) => {
      const item = button('', 'recent-document-item');
      item.classList.toggle('active', record.id === selectedId);
      item.setAttribute('aria-pressed', String(record.id === selectedId));
      const name = window.document.createElement('strong'); name.textContent = record.title;
      const details = window.document.createElement('span'); details.textContent = `${record.pageCount} ${record.pageCount === 1 ? 'page' : 'pages'} · ${formatUpdatedAt(record.updatedAt)}`;
      item.append(name, details);
      item.addEventListener('click', () => { selectedId = record.id; render(); });
      list.appendChild(item);
    });
  }

  function open(options = {}) {
    documents = Array.isArray(options.documents) ? options.documents : [];
    selectedId = options.selectedId || documents[0]?.id || null;
    handlers = options;
    dismissible = Boolean(options.dismissible);
    opener = window.document.activeElement;
    overlay.hidden = false;
    render();
    requestAnimationFrame(() => dialog.querySelector('.recent-document-item, .draft-recovery-primary, .draft-recovery-close')?.focus());
  }

  overlay.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && dismissible) close();
  });

  return { close, open, refresh(documentsToShow) { documents = documentsToShow; render(); } };
}
