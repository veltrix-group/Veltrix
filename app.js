
'use strict';

/* =========================================================
   VELTRIX – LOCAL WORKSPACE
   Free Vault + Multiple Vaults (Pro Development)
   ========================================================= */

/* NAVIGATION */

const nav = [...document.querySelectorAll('.nav-item')];
const views = [...document.querySelectorAll('.view')];
const title = document.getElementById('page-title');

const titles = {
  home: 'Übersicht',
  vault: 'Verschlüsseln',
  safe: 'Tresor',
  privacy: 'Sicherheit & Info',
  pro: 'VELTRIX Pro'
};

function showView(name) {
  if (!titles[name]) name = 'home';

  views.forEach(v =>
    v.classList.toggle('active', v.id === 'view-' + name)
  );

  nav.forEach(b =>
    b.classList.toggle('active', b.dataset.view === name)
  );

  title.textContent = titles[name] || 'VELTRIX';
  window.location.hash = name;
}

nav.forEach(b =>
  b.addEventListener('click', () => showView(b.dataset.view))
);

document.querySelectorAll('[data-go]').forEach(b =>
  b.addEventListener('click', () => showView(b.dataset.go))
);


/* =========================================================
   GENERAL HELPERS
   ========================================================= */

const te = new TextEncoder();
const td = new TextDecoder();

function msg(el, text, ok = false) {
  if (!el) return;
  el.textContent = text;
  el.style.color = ok ? '#90d9cf' : '#efad9f';
}

function b64(array) {
  let s = '';
  for (const n of array) s += String.fromCharCode(n);
  return btoa(s);
}

function unb64(value) {
  const r = atob(value);
  const a = new Uint8Array(r.length);

  for (let i = 0; i < r.length; i++) {
    a[i] = r.charCodeAt(i);
  }

  return a;
}

function createId() {
  if (crypto.randomUUID) return crypto.randomUUID();

  return (
    Date.now().toString(36) +
    '-' +
    Array.from(crypto.getRandomValues(new Uint8Array(16)))
      .map(n => n.toString(16).padStart(2, '0'))
      .join('')
  );
}

function save(blob, name) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');

  a.href = url;
  a.download = name;

  document.body.appendChild(a);
  a.click();
  a.remove();

  setTimeout(() => URL.revokeObjectURL(url), 3000);
}

function formatBytes(n) {
  if (n < 1024) return n + ' B';
  if (n < 1048576) return (n / 1024).toFixed(1) + ' KB';

  return (n / 1048576).toFixed(2) + ' MB';
}

function makeElement(tag, className, text) {
  const el = document.createElement(tag);

  if (className) el.className = className;
  if (text !== undefined) el.textContent = text;

  return el;
}


/* =========================================================
   ENCRYPTION
   ========================================================= */

async function keyFor(password, salt) {
  const material = await crypto.subtle.importKey(
    'raw',
    te.encode(password),
    'PBKDF2',
    false,
    ['deriveKey']
  );

  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt,
      iterations: 600000,
      hash: 'SHA-256'
    },
    material,
    {
      name: 'AES-GCM',
      length: 256
    },
    false,
    ['encrypt', 'decrypt']
  );
}

async function encryptFile(file, password) {
  if (!crypto.subtle) {
    throw Error('Kryptografie ist in diesem Browser nicht verfügbar.');
  }

  if (file.size > 100 * 1024 * 1024) {
    throw Error('Maximal 100 MB pro Datei.');
  }

  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));

  const key = await keyFor(password, salt);

  const cipher = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    await file.arrayBuffer()
  );

  const header = {
    format: 'VELTRIX1',
    name: file.name,
    type: file.type || 'application/octet-stream',
    salt: b64(salt),
    iv: b64(iv)
  };

  return {
    header,
    bytes: new Blob([
      te.encode(JSON.stringify(header) + '\n'),
      cipher
    ])
  };
}

async function decryptBytes(bytes, password) {
  const array = new Uint8Array(bytes);
  const separator = array.indexOf(10);

  if (separator < 0) {
    throw Error('Ungültiges VELTRIX-Format');
  }

  const header = JSON.parse(td.decode(array.slice(0, separator)));

  if (header.format !== 'VELTRIX1') {
    throw Error('Ungültiges VELTRIX-Format');
  }

  const key = await keyFor(password, unb64(header.salt));

  const plain = await crypto.subtle.decrypt(
    {
      name: 'AES-GCM',
      iv: unb64(header.iv)
    },
    key,
    array.slice(separator + 1)
  );

  return { header, plain };
}


/* =========================================================
   FILE ENCRYPTION PAGE
   ========================================================= */

const encFile = document.getElementById('encrypt-file');
const encPass = document.getElementById('encrypt-password');

const decFile = document.getElementById('decrypt-file');
const decPass = document.getElementById('decrypt-password');

const er = document.getElementById('encrypt-status');
const dr = document.getElementById('decrypt-status');

document.getElementById('encrypt-button').addEventListener(
  'click',
  async () => {
    const file = encFile.files[0];
    const password = encPass.value;

    if (!file || !password) {
      return msg(er, 'Bitte Datei und Passwort angeben.');
    }

    if (password.length < 12) {
      return msg(er, 'Bitte ein Passwort mit mindestens 12 Zeichen verwenden.');
    }

    try {
      msg(er, 'Verschlüsselung läuft …');

      const result = await encryptFile(file, password);

      save(result.bytes, file.name + '.vltx');

      msg(er, 'Fertig. Die verschlüsselte Kopie wurde heruntergeladen.', true);
    } catch (error) {
      msg(er, error.message || 'Fehler bei der Verschlüsselung.');
    }
  }
);

document.getElementById('decrypt-button').addEventListener(
  'click',
  async () => {
    const file = decFile.files[0];
    const password = decPass.value;

    if (!file || !password) {
      return msg(dr, 'Bitte .vltx-Datei und Passwort angeben.');
    }

    try {
      msg(dr, 'Entschlüsselung läuft …');

      const result = await decryptBytes(
        await file.arrayBuffer(),
        password
      );

      save(
        new Blob([result.plain], {
          type: result.header.type || 'application/octet-stream'
        }),
        result.header.name || 'datei'
      );

      msg(dr, 'Fertig. Die entschlüsselte Datei wurde heruntergeladen.', true);
    } catch (error) {
      msg(
        dr,
        'Entschlüsselung fehlgeschlagen: Passwort falsch oder Datei beschädigt.'
      );
    }
  }
);


/* =========================================================
   DATABASE
   Version 2:
   - Existing items are preserved
   - Existing items are assigned to VELTRIX Free
   - New vaults store is added
   ========================================================= */

const DB_NAME = 'veltrix-local-vault-v1';
const DB_VERSION = 2;

const STORE = 'items';
const VAULT_STORE = 'vaults';

const FREE_VAULT_ID = 'free-default';

function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = event => {
      const db = request.result;
      const transaction = request.transaction;

      let itemStore;

      if (!db.objectStoreNames.contains(STORE)) {
        itemStore = db.createObjectStore(STORE, {
          keyPath: 'id'
        });
      } else {
        itemStore = transaction.objectStore(STORE);
      }

      let vaultStore;

      if (!db.objectStoreNames.contains(VAULT_STORE)) {
        vaultStore = db.createObjectStore(VAULT_STORE, {
          keyPath: 'id'
        });

        vaultStore.add({
          id: FREE_VAULT_ID,
          name: 'VELTRIX Free',
          kind: 'free',
          created: Date.now()
        });
      } else {
        vaultStore = transaction.objectStore(VAULT_STORE);
      }

      // Assign existing files to the original Free vault.
      const cursorRequest = itemStore.openCursor();

      cursorRequest.onsuccess = () => {
        const cursor = cursorRequest.result;

        if (!cursor) return;

        const item = cursor.value;

        if (!item.vaultId) {
          item.vaultId = FREE_VAULT_ID;
          cursor.update(item);
        }

        cursor.continue();
      };
    };

    request.onsuccess = async () => {
      const db = request.result;

      db.onversionchange = () => db.close();

      try {
        await ensureDefaultVault(db);
        resolve(db);
      } catch (error) {
        db.close();
        reject(error);
      }
    };

    request.onerror = () => reject(request.error);
    request.onblocked = () => {
      reject(Error('Bitte schließe andere geöffnete VELTRIX-Tabs.'));
    };
  });
}

function requestResult(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function ensureDefaultVault(db) {
  const transaction = db.transaction(VAULT_STORE, 'readwrite');
  const store = transaction.objectStore(VAULT_STORE);

  const existing = await requestResult(
    store.get(FREE_VAULT_ID)
  );

  if (!existing) {
    store.add({
      id: FREE_VAULT_ID,
      name: 'VELTRIX Free',
      kind: 'free',
      created: Date.now()
    });
  }

  await new Promise((resolve, reject) => {
    transaction.oncomplete = resolve;
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error);
  });
}

async function dbAction(storeName, mode, callback) {
  const db = await openDB();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, mode);
    const store = transaction.objectStore(storeName);

    let result;

    try {
      result = callback(store);
    } catch (error) {
      db.close();
      reject(error);
      return;
    }

    transaction.oncomplete = () => {
      db.close();
      resolve(result);
    };

    transaction.onerror = () => {
      db.close();
      reject(transaction.error);
    };

    transaction.onabort = () => {
      db.close();
      reject(transaction.error);
    };
  });
}

async function getAll(storeName) {
  const db = await openDB();

  try {
    const transaction = db.transaction(storeName, 'readonly');

    return await requestResult(
      transaction.objectStore(storeName).getAll()
    );
  } finally {
    db.close();
  }
}


/* =========================================================
   FREE VAULT
   ========================================================= */

const safeFiles = document.getElementById('safe-files');
const safePass = document.getElementById('safe-password');

const safeStatus = document.getElementById('safe-status');
const safeList = document.getElementById('safe-list');

async function renderSafe() {
  try {
    const allItems = await getAll(STORE);

    const items = allItems
      .filter(item => (item.vaultId || FREE_VAULT_ID) === FREE_VAULT_ID)
      .sort((a, b) => b.created - a.created);

    safeList.replaceChildren();

    if (!items.length) {
      safeList.append(
        makeElement(
          'div',
          'empty-state',
          'Dein Tresor ist noch leer. Füge oben eine Datei hinzu.'
        )
      );

      return;
    }

    for (const item of items) {
      safeList.append(createFileRow(item, safePass, safeStatus));
    }
  } catch (error) {
    safeList.textContent =
      'Der lokale Tresor konnte nicht geöffnet werden. Bitte nutze einen aktuellen Browser mit IndexedDB.';
  }
}

function createFileRow(item, passwordInput, statusElement) {
  const row = makeElement('article', 'safe-item');

  const file = makeElement('div', 'safe-file');
  const icon = makeElement('div', 'safe-file-icon', '▤');

  const info = document.createElement('div');

  const name = makeElement('div', 'safe-file-name', item.name);

  const meta = makeElement(
    'div',
    'safe-file-meta',
    `${formatBytes(item.size)} · Verschlüsselt gespeichert · ${new Date(item.created).toLocaleDateString('de-DE')}`
  );

  info.append(name, meta);
  file.append(icon, info);

  const actions = makeElement('div', 'safe-actions');

  const get = makeElement('button', 'button button-secondary', 'Entschlüsseln ↓');

  get.addEventListener('click', async () => {
    const password = passwordInput.value;

    if (!password) {
      return msg(statusElement, 'Bitte zuerst das Tresor-Passwort eingeben.');
    }

    try {
      msg(statusElement, 'Datei wird entschlüsselt …');

      const result = await decryptBytes(item.bytes, password);

      save(
        new Blob([result.plain], {
          type: result.header.type || 'application/octet-stream'
        }),
        result.header.name || item.name
      );

      msg(statusElement, `„${item.name}“ wurde heruntergeladen.`, true);
    } catch (error) {
      msg(
        statusElement,
        'Entschlüsselung fehlgeschlagen. Passwort falsch oder Eintrag beschädigt.'
      );
    }
  });

  const del = makeElement('button', 'button danger', 'Löschen');

  del.addEventListener('click', async () => {
    if (!confirm(`„${item.name}“ aus diesem Browser-Tresor löschen?`)) {
      return;
    }

    try {
      await dbAction(STORE, 'readwrite', store =>
        store.delete(item.id)
      );

      msg(statusElement, 'Datei aus dem lokalen Tresor gelöscht.', true);

      if (item.vaultId === FREE_VAULT_ID || !item.vaultId) {
        renderSafe();
      } else {
        renderProVaults();
      }
    } catch (error) {
      msg(statusElement, 'Die Datei konnte nicht gelöscht werden.');
    }
  });

  actions.append(get, del);
  row.append(file, actions);

  return row;
}

document.getElementById('safe-add').addEventListener(
  'click',
  async () => {
    const files = [...safeFiles.files];
    const password = safePass.value;

    if (!files.length) {
      return msg(safeStatus, 'Bitte mindestens eine Datei auswählen.');
    }

    if (password.length < 12) {
      return msg(
        safeStatus,
        'Bitte ein Tresor-Passwort mit mindestens 12 Zeichen verwenden.'
      );
    }

    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];

        msg(
          safeStatus,
          `Verschlüssele Datei ${i + 1} von ${files.length} …`
        );

        const encrypted = await encryptFile(file, password);

        await dbAction(STORE, 'readwrite', store => {
          store.put({
            id: createId(),
            vaultId: FREE_VAULT_ID,
            name: file.name,
            size: file.size,
            created: Date.now(),
            bytes: encrypted.bytes
          });
        });
      }

      safeFiles.value = '';

      msg(
        safeStatus,
        `${files.length} Datei(en) verschlüsselt im lokalen Tresor gespeichert.`,
        true
      );

      await renderSafe();
    } catch (error) {
      msg(
        safeStatus,
        error.message || 'Dateien konnten nicht gespeichert werden.'
      );
    }
  }
);

document.getElementById('safe-refresh').addEventListener(
  'click',
  renderSafe
);


/* =========================================================
   PRO – MULTIPLE VAULTS
   ========================================================= */

let selectedProVaultId = null;

const proManager = document.getElementById('pro-vault-manager');

function buildProInterface() {
  if (!proManager) return null;

  const existing = proManager.querySelector('.pro-vault-controls');

  if (existing) return existing;

  const controls = makeElement('div', 'pro-vault-controls');

  const heading = makeElement(
    'div',
    'section-head',
    ''
  );

  const headingContent = document.createElement('div');

  headingContent.append(
    makeElement('div', 'eyebrow pro-eyebrow', 'YOUR VAULTS'),
    makeElement('h3', '', 'Deine Pro-Tresore')
  );

  heading.append(headingContent);

  const createArea = makeElement('div', 'panel vault-manager');

  const createTitle = makeElement('div', 'panel-title');
  const createNumber = makeElement('span', 'step-number', '✦');

  const createDescription = document.createElement('div');

  createDescription.append(
    makeElement('h3', '', 'Neuen Tresor erstellen'),
    makeElement('p', '', 'Erstelle einen eigenen Bereich für deine Dateien.')
  );

  createTitle.append(createNumber, createDescription);

  const nameLabel = makeElement('label', '', 'Name des Tresors');

  const nameInput = makeElement('input');
  nameInput.type = 'text';
  nameInput.maxLength = 40;
  nameInput.placeholder = 'z. B. Schule, Projekte oder Privat';

  const createButton = makeElement(
    'button',
    'button button-primary button-full',
    '＋ Neuen Tresor erstellen'
  );

  const createStatus = makeElement('div', 'status-message');

  createArea.append(
    createTitle,
    nameLabel,
    nameInput,
    createButton,
    createStatus
  );

  const vaultList = makeElement('div', 'safe-list');

  const selectedArea = makeElement('div', 'pro-selected-vault');

  controls.append(
    heading,
    createArea,
    vaultList,
    selectedArea
  );

  const note = proManager.querySelector('.processing-note');

  if (note) {
    proManager.insertBefore(controls, note);
  } else {
    proManager.append(controls);
  }

  createButton.addEventListener('click', async () => {
    const name = nameInput.value.trim();

    if (!name) {
      return msg(createStatus, 'Bitte gib einen Namen für deinen Tresor ein.');
    }

    try {
      const vault = {
        id: createId(),
        name,
        kind: 'pro',
        created: Date.now()
      };

      await dbAction(VAULT_STORE, 'readwrite', store =>
        store.add(vault)
      );

      nameInput.value = '';
      selectedProVaultId = vault.id;

      msg(createStatus, 'Neuer Tresor wurde erstellt.', true);

      await renderProVaults();
    } catch (error) {
      msg(createStatus, 'Der Tresor konnte nicht erstellt werden.');
    }
  });

  return controls;
}

async function deleteProVault(vault) {
  const confirmation = confirm(
    `Möchtest du den Tresor „${vault.name}“ und alle darin gespeicherten Dateien wirklich löschen? Diese Aktion kann nicht rückgängig gemacht werden.`
  );

  if (!confirmation) return;

  const db = await openDB();

  await new Promise((resolve, reject) => {
    const transaction = db.transaction(
      [STORE, VAULT_STORE],
      'readwrite'
    );

    const itemStore = transaction.objectStore(STORE);
    const vaultStore = transaction.objectStore(VAULT_STORE);

    const request = itemStore.getAll();

    request.onsuccess = () => {
      for (const item of request.result) {
        if (item.vaultId === vault.id) {
          itemStore.delete(item.id);
        }
      }

      vaultStore.delete(vault.id);
    };

    request.onerror = () => {
      transaction.abort();
    };

    transaction.oncomplete = resolve;
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error);
  });

  db.close();

  if (selectedProVaultId === vault.id) {
    selectedProVaultId = null;
  }

  await renderProVaults();
}

function renderProFileArea(vault, area) {
  const panel = makeElement('div', 'panel vault-manager');

  const titleArea = makeElement('div', 'panel-title');
  const number = makeElement('span', 'step-number', '✦');

  const description = document.createElement('div');

  description.append(
    makeElement('h3', '', vault.name),
    makeElement(
      'p',
      '',
      'Dateien in diesem Tresor verschlüsselt speichern.'
    )
  );

  titleArea.append(number, description);

  const fileLabel = makeElement('label', '', 'Dateien auswählen');

  const fileInput = makeElement('input');
  fileInput.type = 'file';
  fileInput.multiple = true;

  const passwordLabel = makeElement(
    'label',
    '',
    'Tresor-Passwort'
  );

  const passwordInput = makeElement('input');
  passwordInput.type = 'password';
  passwordInput.autocomplete = 'new-password';
  passwordInput.placeholder = 'Mindestens 12 Zeichen';
  passwordInput.minLength = 12;

  const hint = makeElement(
    'div',
    'password-hint',
    'Dein Passwort wird nicht gespeichert. Merke es dir gut.'
  );

  const addButton = makeElement(
    'button',
    'button button-primary button-full',
    'Verschlüsseln & im Pro-Tresor speichern ＋'
  );

  const status = makeElement('div', 'status-message');

  const listHeading = makeElement(
    'div',
    'section-head vault-list-head'
  );

  listHeading.append(
    makeElement('h3', '', 'Dateien in diesem Tresor')
  );

  const fileList = makeElement('div', 'safe-list');

  addButton.addEventListener('click', async () => {
    const files = [...fileInput.files];
    const password = passwordInput.value;

    if (!files.length) {
      return msg(status, 'Bitte mindestens eine Datei auswählen.');
    }

    if (password.length < 12) {
      return msg(
        status,
        'Bitte ein Passwort mit mindestens 12 Zeichen verwenden.'
      );
    }

    try {
      addButton.disabled = true;

      for (let i = 0; i < files.length; i++) {
        const file = files[i];

        msg(
          status,
          `Verschlüssele Datei ${i + 1} von ${files.length} …`
        );

        const encrypted = await encryptFile(file, password);

        await dbAction(STORE, 'readwrite', store => {
          store.put({
            id: createId(),
            vaultId: vault.id,
            name: file.name,
            size: file.size,
            created: Date.now(),
            bytes: encrypted.bytes
          });
        });
      }

      fileInput.value = '';

      msg(
        status,
        `${files.length} Datei(en) verschlüsselt gespeichert.`,
        true
      );

      await renderProVaults();
    } catch (error) {
      msg(
        status,
        error.message || 'Dateien konnten nicht gespeichert werden.'
      );
    } finally {
      addButton.disabled = false;
    }
  });

  panel.append(
    titleArea,
    fileLabel,
    fileInput,
    passwordLabel,
    passwordInput,
    hint,
    addButton,
    status
  );

  area.append(panel, listHeading, fileList);

  getAll(STORE)
    .then(items => {
      const vaultItems = items
        .filter(item => item.vaultId === vault.id)
        .sort((a, b) => b.created - a.created);

      fileList.replaceChildren();

      if (!vaultItems.length) {
        fileList.append(
          makeElement(
            'div',
            'empty-state',
            'Dieser Tresor ist noch leer. Füge deine erste Datei hinzu.'
          )
        );

        return;
      }

      for (const item of vaultItems) {
        fileList.append(
          createFileRow(item, passwordInput, status)
        );
      }
    })
    .catch(() => {
      fileList.textContent = 'Dateien konnten nicht geladen werden.';
    });
}

async function renderProVaults() {
  const controls = buildProInterface();

  if (!controls) return;

  const vaultList = controls.querySelector('.safe-list');
  const selectedArea = controls.querySelector('.pro-selected-vault');

  try {
    const vaults = await getAll(VAULT_STORE);

    const proVaults = vaults
      .filter(vault => vault.kind === 'pro')
      .sort((a, b) => a.created - b.created);

    vaultList.replaceChildren();
    selectedArea.replaceChildren();

    if (!proVaults.length) {
      selectedProVaultId = null;

      vaultList.append(
        makeElement(
          'div',
          'empty-state',
          'Du hast noch keine Pro-Tresore erstellt.'
        )
      );

      selectedArea.append(
        makeElement(
          'div',
          'processing-note',
          'Erstelle oben deinen ersten Tresor.'
        )
      );

      return;
    }

    if (!proVaults.some(v => v.id === selectedProVaultId)) {
      selectedProVaultId = proVaults[0].id;
    }

    for (const vault of proVaults) {
      const row = makeElement('article', 'safe-item');

      const file = makeElement('div', 'safe-file');

      const icon = makeElement('div', 'safe-file-icon', '▤');

      const info = document.createElement('div');

      info.append(
        makeElement('div', 'safe-file-name', vault.name),
        makeElement(
          'div',
          'safe-file-meta',
          `Pro-Tresor · Erstellt am ${new Date(vault.created).toLocaleDateString('de-DE')}`
        )
      );

      file.append(icon, info);

      const actions = makeElement('div', 'safe-actions');

      const openButton = makeElement(
        'button',
        'button button-secondary',
        vault.id === selectedProVaultId ? 'Ausgewählt ✓' : 'Öffnen'
      );

      openButton.addEventListener('click', async () => {
        selectedProVaultId = vault.id;
        await renderProVaults();
      });

      const deleteButton = makeElement(
        'button',
        'button danger',
        'Löschen'
      );

      deleteButton.addEventListener('click', async () => {
        try {
          await deleteProVault(vault);
        } catch (error) {
          alert('Der Tresor konnte nicht gelöscht werden.');
        }
      });

      actions.append(openButton, deleteButton);
      row.append(file, actions);

      vaultList.append(row);
    }

    const selectedVault = proVaults.find(
      vault => vault.id === selectedProVaultId
    );

    if (selectedVault) {
      renderProFileArea(selectedVault, selectedArea);
    }
  } catch (error) {
    vaultList.textContent = 'Pro-Tresore konnten nicht geladen werden.';
  }
}


/* =========================================================
   INITIALIZATION
   ========================================================= */

async function initializeVeltrix() {
  try {
    const db = await openDB();
    db.close();

    await renderSafe();
    await renderProVaults();

    if (location.hash && titles[location.hash.slice(1)]) {
      showView(location.hash.slice(1));
    }
  } catch (error) {
    console.error('VELTRIX initialization error:', error);

    msg(
      safeStatus,
      'Der lokale Tresor konnte nicht initialisiert werden.'
    );
  }
}

initializeVeltrix();

