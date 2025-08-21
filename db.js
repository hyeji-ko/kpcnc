// Database abstraction for GitHub Pages deployments
// - If window.FIREBASE_CONFIG is defined, uses Firebase Firestore with anonymous auth
// - Otherwise falls back to localStorage

(() => {
  const LOCAL_KEY = "studyRecords";

  /** @typedef {{ date: string; hours: number }} StudyRecord */

  /** Local fallback implementation */
  const localImpl = {
    /** @returns {Promise<StudyRecord[]>} */
    async loadRecords() {
      try {
        const raw = localStorage.getItem(LOCAL_KEY);
        if (!raw) return [];
        const parsed = JSON.parse(raw);
        if (!Array.isArray(parsed)) return [];
        return parsed
          .filter(Boolean)
          .map((r) => ({ date: String(r.date), hours: Number(r.hours) }))
          .filter((r) => r.date && Number.isFinite(r.hours));
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
      records.push(record);
      await this.saveRecords(records);
    },
    get isRemote() {
      return false;
    },
  };

  function getFirebaseConfig() {
    if (typeof window === "undefined") return null;
    return window.FIREBASE_CONFIG || window.firebaseConfig || null;
  }

  /** @returns {boolean} */
  function hasFirebaseConfig() {
    return Boolean(getFirebaseConfig());
  }

  /** Remote implementation (loaded lazily) */
  let remoteImpl = null;

  async function getRemoteImpl() {
    if (remoteImpl) return remoteImpl;
    const config = getFirebaseConfig();
    if (!config) return null;

    const [{ initializeApp }, { getAuth, signInAnonymously }, { getFirestore, collection, addDoc, getDocs, query, orderBy }]
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
        snap.forEach((doc) => {
          const d = doc.data();
          rows.push({ date: String(d.date), hours: Number(d.hours) });
        });
        return rows;
      },
      async addRecord(record) {
        await addDoc(baseCol, {
          date: record.date,
          hours: Number(record.hours),
          createdAt: Date.now(),
        });
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
      if (!hasFirebaseConfig()) return false;
      try {
        await getRemoteImpl();
        return true;
      } catch (e) {
        console.warn('Remote DB init failed, falling back to localStorage.', e);
        return false;
      }
    },
    /** @returns {Promise<StudyRecord[]>} */
    async loadRecords() {
      try {
        const impl = await getRemoteImpl();
        if (impl) {
          const remoteRows = await impl.loadRecords();
          if (Array.isArray(remoteRows) && remoteRows.length > 0) {
            return remoteRows;
          }
        }
      } catch (e) {
        console.warn('Remote load failed, using localStorage.', e);
      }
      // If remote empty or failed, use local cache
      return localImpl.loadRecords();
    },
    /** @param {StudyRecord} record */
    async addRecord(record) {
      let savedRemote = false;
      try {
        const impl = await getRemoteImpl();
        if (impl) {
          await impl.addRecord(record);
          savedRemote = true;
        }
      } catch (e) {
        console.warn('Remote save failed, saving to localStorage.', e);
      }
      // Always cache locally so UI can show data even if remote is empty or delayed
      await localImpl.addRecord(record);
      return savedRemote;
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


