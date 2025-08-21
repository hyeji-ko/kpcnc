// Database abstraction for GitHub Pages deployments
// - If window.FIREBASE_CONFIG is defined, uses Firebase Firestore with anonymous auth
// - Otherwise falls back to localStorage

(() =>  {
  const LOCAL_KEY = "studyRecords";

  /** @typedef {{ id?: string; date: string; hours: number }} StudyRecord */

  const DISABLE_KEY = 'studyRemoteDisabled';
  let remoteImpl = null;
  let remoteDisabled = false;
  let remoteInitAttempted = false;
  try {
    if (sessionStorage.getItem(DISABLE_KEY) === '1') {
      remoteDisabled = true;
    }
  } catch {}

  function disableRemote() {
    remoteDisabled = true;
    try { sessionStorage.setItem(DISABLE_KEY, '1'); } catch {}
  }

  /** Local fallback implementation */
  function generateId() {
    return (
      Date.now().toString(36) + Math.random().toString(36).slice(2, 10)
    );
  }

  const localImpl = {
    /** @returns {Promise<StudyRecord[]>} */
    async loadRecords() {
      try {
        const raw = localStorage.getItem(LOCAL_KEY);
        if (!raw) return [];
        const parsed = JSON.parse(raw);
        if (!Array.isArray(parsed)) return [];
        let changed = false;
        const rows = parsed
          .filter(Boolean)
          .map((r) => {
            const obj = { id: r.id || generateId(), date: String(r.date), hours: Number(r.hours) };
            if (!r.id) changed = true;
            return obj;
          })
          .filter((r) => r.date && Number.isFinite(r.hours));
        if (changed) {
          await this.saveRecords(rows);
        }
        return rows;
      } catch {
        return [];
      }
    },
    /** @param {StudyRecord[]} records */
    async saveRecords(records) {
      localStorage.setItem(LOCAL_KEY, JSON.stringify(records));
    },
    /** @param {StudyRecord} record */
    async addRecord(record) {
      const records = await this.loadRecords();
      const withId = { id: record.id || generateId(), date: record.date, hours: Number(record.hours) };
      records.push(withId);
      await this.saveRecords(records);
      return withId.id;
    },
    /** @param {string} id @param {{ hours?: number, date?: string }} patch */
    async updateRecord(id, patch) {
      const records = await this.loadRecords();
      const idx = records.findIndex((r) => r.id === id);
      if (idx === -1) return false;
      records[idx] = { ...records[idx], ...patch };
      await this.saveRecords(records);
      return true;
    },
    /** @param {string} id */
    async deleteRecord(id) {
      const records = await this.loadRecords();
      const next = records.filter((r) => r.id !== id);
      await this.saveRecords(next);
      return true;
    },
    get isRemote() {
      return false;
    },
  };

  function isLocalLikeHost() {
    try {
      const h = location.hostname || '';
      const proto = location.protocol || '';
      if (proto === 'file:') return true;
      if (h === 'localhost' || h === '127.0.0.1' || h === '[::1]') return true;
      if (/\.local$/i.test(h)) return true;
      if (/^\d+\.\d+\.\d+\.\d+$/.test(h)) {
        if (h.startsWith('10.') || h.startsWith('192.168.')) return true;
        if (h.startsWith('172.')) { const o = Number(h.split('.')[1]); if (o>=16 && o<=31) return true; }
      }
    } catch {}
    return false;
  }

  function getFirebaseConfig() {
    if (typeof window === "undefined") return null;
    try {
      if (isLocalLikeHost() || window.FIREBASE_DISABLE_REMOTE) return null;
      if (sessionStorage.getItem(DISABLE_KEY) === '1') return null;
    } catch {}
    return window.FIREBASE_CONFIG || window.firebaseConfig || null;
  }

  /** @returns {boolean} */
  function hasFirebaseConfig() {
    return Boolean(getFirebaseConfig());
  }

  async function getRemoteImpl() {
    if (remoteImpl) return remoteImpl;
    if (remoteDisabled) return null;
    if (typeof window !== 'undefined' && window.FIREBASE_DISABLE_REMOTE) {
      disableRemote();
      return null;
    }
    const config = getFirebaseConfig();
    if (!config) {
      disableRemote();
      return null;
    }
    if (remoteInitAttempted) return null;
    remoteInitAttempted = true;

    const [{ initializeApp }, { getAuth, signInAnonymously }, { getFirestore, collection, addDoc, getDocs, query, orderBy, updateDoc, deleteDoc, doc }]
      = await Promise.all([
        import('https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js'),
        import('https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js'),
        import('https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js'),
      ]);

    const app = initializeApp(config);
    const auth = getAuth(app);
    let userCred;
    try {
      userCred = await signInAnonymously(auth);
    } catch (e) {
      console.warn('Anonymous auth failed, returning to local fallback.', e);
      disableRemote();
      return null; // Return null so callers fall back gracefully
    }
    const uid = userCred.user?.uid || 'anonymous';
    const db = getFirestore(app);

    const baseCol = collection(db, 'users', uid, 'records');

    remoteImpl = {
      async loadRecords() {
        const q = query(baseCol, orderBy('date', 'asc'));
        const snap = await getDocs(q);
        const rows = [];
        snap.forEach((docSnap) => {
          const d = docSnap.data();
          rows.push({ id: docSnap.id, date: String(d.date), hours: Number(d.hours) });
        });
        return rows;
      },
      async addRecord(record) {
        const ref = await addDoc(baseCol, {
          date: record.date,
          hours: Number(record.hours),
          createdAt: Date.now(),
        });
        return ref.id;
      },
      async updateRecord(id, patch) {
        const ref = doc(db, 'users', uid, 'records', id);
        await updateDoc(ref, { ...patch });
        return true;
      },
      async deleteRecord(id) {
        const ref = doc(db, 'users', uid, 'records', id);
        await deleteDoc(ref);
        return true;
      },
      get isRemote() {
        return true;
      },
    };
    return remoteImpl;
  }

  const DB = {
    /** Initialize DB. Returns true if remote is used. */
    async init() {
      if (!hasFirebaseConfig()) {
        disableRemote();
        return false;
      }
      try {
        const impl = await getRemoteImpl();
        return Boolean(impl);
      } catch (e) {
        console.warn('Remote DB init failed, falling back to localStorage.', e);
        disableRemote();
        return false;
      }
    },
    /** @returns {Promise<StudyRecord[]>} */
    async loadRecords() {
      if (!remoteDisabled) try {
        const impl = await getRemoteImpl();
        if (impl) {
          const remoteRows = await impl.loadRecords();
          if (Array.isArray(remoteRows) && remoteRows.length > 0) {
            return remoteRows;
          }
        }
      } catch (e) {
        console.warn('Remote load failed, using localStorage.', e);
        disableRemote();
      }
      // If remote empty or failed, use local cache
      return localImpl.loadRecords();
    },
    /** @param {StudyRecord} record */
    async addRecord(record) {
      let savedRemote = false;
      if (!remoteDisabled) try {
        const impl = await getRemoteImpl();
        if (impl) {
          const newId = await impl.addRecord(record);
          record.id = newId;
          savedRemote = true;
        }
      } catch (e) {
        console.warn('Remote save failed, saving to localStorage.', e);
        disableRemote();
      }
      // Always cache locally so UI can show data even if remote is empty or delayed
      const id = await localImpl.addRecord(record);
      return id || record.id || null;
    },
    /** @param {string} id @param {{ hours?: number, date?: string }} patch */
    async updateRecord(id, patch) {
      if (!remoteDisabled) try {
        const impl = await getRemoteImpl();
        if (impl) await impl.updateRecord(id, patch);
      } catch (e) {
        console.warn('Remote update failed, updating local only.', e);
        disableRemote();
      }
      return localImpl.updateRecord(id, patch);
    },
    /** @param {string} id */
    async deleteRecord(id) {
      if (!remoteDisabled) try {
        const impl = await getRemoteImpl();
        if (impl) await impl.deleteRecord(id);
      } catch (e) {
        console.warn('Remote delete failed, deleting local only.', e);
        disableRemote();
      }
      return localImpl.deleteRecord(id);
    },
    /** @returns {Promise<boolean>} */
    async isRemote() {
      const impl = (await getRemoteImpl());
      return Boolean(impl?.isRemote);
    }
  };

  // Expose globally for non-module consumer scripts
  window.DB = DB;
})();



