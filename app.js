
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
   'text-lock': 'TEXT LOCK',
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
   VELTRIX TEXT LOCK
   ========================================================= */

const textLockInput = document.getElementById('text-lock-input');
const textLockEncryptPassword = document.getElementById('text-lock-encrypt-password');
const textLockEncryptedOutput = document.getElementById('text-lock-encrypted-output');
const textLockEncryptButton = document.getElementById('text-lock-encrypt-button');
const textLockCopyButton = document.getElementById('text-lock-copy-button');
const textLockEncryptStatus = document.getElementById('text-lock-encrypt-status');

const textLockCipherInput = document.getElementById('text-lock-cipher-input');
const textLockDecryptPassword = document.getElementById('text-lock-decrypt-password');
const textLockDecryptedOutput = document.getElementById('text-lock-decrypted-output');
const textLockDecryptButton = document.getElementById('text-lock-decrypt-button');
const textLockDecryptStatus = document.getElementById('text-lock-decrypt-status');

const TEXT_LOCK_PREFIX = 'VELTRIX-TEXT-1:';


async function encryptTextLock(text, password) {
  if (!crypto.subtle) {
    throw Error('Kryptografie ist nicht verfügbar.');
  }

  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));

  const key = await keyFor(password, salt);

  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    te.encode(text)
  );

  const payload = {
    format: 'VELTRIX-TEXT-1',
    salt: b64(salt),
    iv: b64(iv),
    data: b64(new Uint8Array(encrypted))
  };

  return TEXT_LOCK_PREFIX + b64(
    te.encode(JSON.stringify(payload))
  );
}


async function decryptTextLock(cipherText, password) {
  if (!crypto.subtle) {
    throw Error('Kryptografie ist nicht verfügbar.');
  }

  if (!cipherText.startsWith(TEXT_LOCK_PREFIX)) {
    throw Error('Ungültiges VELTRIX TEXT LOCK-Format.');
  }

  let payload;

  try {
    payload = JSON.parse(
      td.decode(
        unb64(cipherText.slice(TEXT_LOCK_PREFIX.length).trim())
      )
    );
  } catch {
    throw Error('Der verschlüsselte Text ist beschädigt.');
  }

  if (
    payload.format !== 'VELTRIX-TEXT-1' ||
    typeof payload.salt !== 'string' ||
    typeof payload.iv !== 'string' ||
    typeof payload.data !== 'string'
  ) {
    throw Error('Ungültiges Textformat.');
  }

  const key = await keyFor(password, unb64(payload.salt));

  const decrypted = await crypto.subtle.decrypt(
    {
      name: 'AES-GCM',
      iv: unb64(payload.iv)
    },
    key,
    unb64(payload.data)
  );

  return td.decode(decrypted);
}


/* TEXT VERSCHLÜSSELN */

if (textLockEncryptButton) {
  textLockEncryptButton.addEventListener('click', async () => {
    const text = textLockInput.value;
    const password = textLockEncryptPassword.value;

    if (!text.trim()) {
      return msg(textLockEncryptStatus, 'Bitte einen Text eingeben.');
    }

    if (password.length < 12) {
      return msg(
        textLockEncryptStatus,
        'Das Passwort muss mindestens 12 Zeichen lang sein.'
      );
    }

    try {
      msg(textLockEncryptStatus, 'Verschlüsselung läuft …');

      const result = await encryptTextLock(text, password);

      textLockEncryptedOutput.value = result;

      msg(
        textLockEncryptStatus,
        'Text erfolgreich verschlüsselt.',
        true
      );

    } catch (error) {
      msg(
        textLockEncryptStatus,
        error.message || 'Verschlüsselung fehlgeschlagen.'
      );
    }
  });
}


/* TEXT ENTSCHLÜSSELN */

if (textLockDecryptButton) {
  textLockDecryptButton.addEventListener('click', async () => {
    const cipherText = textLockCipherInput.value.trim();
    const password = textLockDecryptPassword.value;

    if (!cipherText || !password) {
      return msg(
        textLockDecryptStatus,
        'Bitte Text und Passwort eingeben.'
      );
    }

    try {
      msg(textLockDecryptStatus, 'Entschlüsselung läuft …');

      const result = await decryptTextLock(cipherText, password);

      textLockDecryptedOutput.value = result;

      msg(
        textLockDecryptStatus,
        'Text erfolgreich entschlüsselt.',
        true
      );

    } catch {
      textLockDecryptedOutput.value = '';

      msg(
        textLockDecryptStatus,
        'Entschlüsselung fehlgeschlagen: Passwort falsch oder Text beschädigt.'
      );
    }
  });
}


/* VERSCHLÜSSELTEN TEXT KOPIEREN */

if (textLockCopyButton) {
  textLockCopyButton.addEventListener('click', async () => {
    const text = textLockEncryptedOutput.value;

    if (!text) {
      return msg(
        textLockEncryptStatus,
        'Kein verschlüsselter Text vorhanden.'
      );
    }

    try {
      await navigator.clipboard.writeText(text);

      msg(
        textLockEncryptStatus,
        'Text wurde kopiert.',
        true
      );

    } catch {
      msg(
        textLockEncryptStatus,
        'Kopieren nicht möglich. Bitte manuell kopieren.'
      );
    }
  });
}

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
   PRO – MULTIPLE VAULTS (VORERST DEAKTIVIERT)
   ========================================================= */

async function renderProVaults() {
  const proManager = document.getElementById('pro-vault-manager');

  if (!proManager) return;

  // Entfernt eventuell vorhandene interaktive Pro-Tresor-Steuerungen.
  const controls = proManager.querySelector('.pro-vault-controls');

  if (controls) {
    controls.remove();
  }

  // Die statische Pro-Vorschau in der HTML bleibt erhalten.
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

