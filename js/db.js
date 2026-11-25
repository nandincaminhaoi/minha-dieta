// Um único objeto de estado no IndexedDB.
const NAME = "dieta";
const STORE = "estado";
const KEY = "atual";
let opening = null;

function open() {
  opening ??= new Promise((resolve, reject) => {
    const request = indexedDB.open(NAME, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE);
    request.onsuccess = () => {
      const db = request.result;
      // Se o navegador fechar a conexão, a próxima operação abre outra.
      db.onclose = () => { opening = null; };
      db.onversionchange = () => { db.close(); opening = null; };
      resolve(db);
    };
    request.onerror = () => reject(request.error);
  }).catch((error) => { opening = null; throw error; });
  return opening;
}

async function run(mode, action) {
  const db = await open();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, mode);
    const request = action(tx.objectStore(STORE));
    tx.oncomplete = () => resolve(request.result);
    tx.onerror = tx.onabort = () => reject(tx.error);
  });
}

// null só quando não há nada salvo; falha de leitura rejeita.
export const load = async () => (await run("readonly", (s) => s.get(KEY))) ?? null;
export const save = (state) => run("readwrite", (s) => s.put(state, KEY));
