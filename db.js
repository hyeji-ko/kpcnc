// Database abstraction for GitHub Pages deployments
// - If window.FIREBASE_CONFIG is defined, uses Firebase Firestore with anonymous auth
// - Otherwise falls back to localStorage

(() => {
  const LOCAL_KEY = "studyRecords";

  /** @typedef {{ id?: string; date: string; plan: number; planCumulative: number; hours: number; hoursCumulative: number; percentage: number }} StudyRecord */

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
            const obj = { 
              id: r.id || generateId(), 
              date: String(r.date), 
              plan: Number(r.plan || 0),
              planCumulative: Number(r.planCumulative || 0),
              hours: Number(r.hours || 0), 
              hoursCumulative: Number(r.hoursCumulative || 0),
              percentage: Number(r.percentage || 0)
            };
            if (!r.id || r.plan === undefined || r.planCumulative === undefined || r.hoursCumulative === undefined || r.percentage === undefined) changed = true;
            return obj;
          })
          .filter((r) => r.date && Number.isFinite(r.plan) && Number.isFinite(r.planCumulative) && Number.isFinite(r.hours) && Number.isFinite(r.hoursCumulative) && Number.isFinite(r.percentage));
        if (changed) {
          await this.saveRecords(rows);
        }
        return rows;
      } catch (e) {
        console.warn('로컬 저장소에서 데이터 로드 실패:', e);
        return [];
      }
    },
    /** @param {StudyRecord[]} records */
    async saveRecords(records) {
      try {
        localStorage.setItem(LOCAL_KEY, JSON.stringify(records));
        console.log('데이터가 로컬 저장소에 저장되었습니다:', records.length, '개 항목');
      } catch (e) {
        console.error('로컬 저장소에 데이터 저장 실패:', e);
        throw e;
      }
    },
    /** @param {StudyRecord} record */
    async addRecord(record) {
      try {
        const records = await this.loadRecords();
        const withId = { 
          id: record.id || generateId(), 
          date: record.date, 
          plan: Number(record.plan || 0),
          planCumulative: Number(record.planCumulative || 0),
          hours: Number(record.hours || 0), 
          hoursCumulative: Number(record.hoursCumulative || 0),
          percentage: Number(record.percentage || 0)
        };
        records.push(withId);
        await this.saveRecords(records);
        console.log('새 레코드가 로컬 저장소에 추가됨:', withId);
        return withId.id;
      } catch (e) {
        console.error('로컬 저장소에 레코드 추가 실패:', e);
        throw e;
      }
    },
    /** @param {string} id @param {{ hours?: number, date?: string }} patch */
    async updateRecord(id, patch) {
      try {
        const records = await this.loadRecords();
        const idx = records.findIndex((r) => r.id === id);
        if (idx === -1) return false;
        records[idx] = { ...records[idx], ...patch };
        await this.saveRecords(records);
        console.log('로컬 저장소에서 레코드 업데이트됨:', id, patch);
        return true;
      } catch (e) {
        console.error('로컬 저장소에서 레코드 업데이트 실패:', e);
        throw e;
      }
    },
    /** @param {string} id */
    async deleteRecord(id) {
      try {
        const records = await this.loadRecords();
        const next = records.filter((r) => r.id !== id);
        await this.saveRecords(next);
        console.log('로컬 저장소에서 레코드 삭제됨:', id);
        return true;
      } catch (e) {
        console.error('로컬 저장소에서 레코드 삭제 실패:', e);
        throw e;
      }
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

    try {
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
        console.log('Firebase 익명 인증 성공:', userCred.user?.uid);
      } catch (e) {
        console.warn('Firebase 익명 인증 실패, 로컬 저장소로 fallback:', e);
        disableRemote();
        return null;
      }
      const uid = userCred.user?.uid || 'anonymous';
      const db = getFirestore(app);

      const baseCol = collection(db, 'users', uid, 'records');

      remoteImpl = {
        async loadRecords() {
          try {
            const q = query(baseCol, orderBy('date', 'asc'));
            const snap = await getDocs(q);
            const rows = [];
            snap.forEach((docSnap) => {
              const d = docSnap.data();
              rows.push({ 
                id: docSnap.id, 
                date: String(d.date), 
                plan: Number(d.plan || 0),
                planCumulative: Number(d.planCumulative || 0),
                hours: Number(d.hours || 0), 
                hoursCumulative: Number(d.hoursCumulative || 0),
                percentage: Number(d.percentage || 0)
              });
            });
            console.log('Firebase에서 데이터 로드됨:', rows.length, '개 항목');
            return rows;
          } catch (e) {
            console.error('Firebase에서 데이터 로드 실패:', e);
            throw e;
          }
        },
        async addRecord(record) {
          try {
            const ref = await addDoc(baseCol, {
              date: record.date,
              plan: Number(record.plan || 0),
              planCumulative: Number(record.planCumulative || 0),
              hours: Number(record.hours || 0),
              hoursCumulative: Number(record.hoursCumulative || 0),
              percentage: Number(record.percentage || 0),
              createdAt: Date.now(),
            });
            console.log('Firebase에 새 레코드 추가됨:', ref.id, record);
            return ref.id;
          } catch (e) {
            console.error('Firebase에 레코드 추가 실패:', e);
            throw e;
          }
        },
        async updateRecord(id, patch) {
          try {
            const ref = doc(db, 'users', uid, 'records', id);
            await updateDoc(ref, { ...patch });
            console.log('Firebase에서 레코드 업데이트됨:', id, patch);
            return true;
          } catch (e) {
            console.error('Firebase에서 레코드 업데이트 실패:', e);
            throw e;
          }
        },
        async deleteRecord(id) {
          try {
            const ref = doc(db, 'users', uid, 'records', id);
            await deleteDoc(ref);
            console.log('Firebase에서 레코드 삭제됨:', id);
            return true;
          } catch (e) {
            console.error('Firebase에서 레코드 삭제 실패:', e);
            throw e;
          }
        },
        get isRemote() {
          return true;
        },
      };
      return remoteImpl;
    } catch (e) {
      console.error('Firebase 초기화 실패:', e);
      disableRemote();
      return null;
    }
  }

  const DB = {
    /** Initialize DB. Returns true if remote is used. */
    async init() {
      if (!hasFirebaseConfig()) {
        console.log('Firebase 설정이 없어 로컬 저장소를 사용합니다.');
        disableRemote();
        return false;
      }
      try {
        const impl = await getRemoteImpl();
        if (impl) {
          console.log('Firebase 원격 DB가 성공적으로 초기화되었습니다.');
          return true;
        } else {
          console.log('Firebase 초기화 실패, 로컬 저장소를 사용합니다.');
          return false;
        }
      } catch (e) {
        console.warn('Firebase DB 초기화 실패, 로컬 저장소로 fallback:', e);
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
            // 원격 데이터를 로컬에도 캐시
            await localImpl.saveRecords(remoteRows);
            return remoteRows;
          }
        }
      } catch (e) {
        console.warn('원격 DB 로드 실패, 로컬 저장소 사용:', e);
        disableRemote();
      }
      // 원격이 비어있거나 실패한 경우 로컬 캐시 사용
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
          console.log('Firebase에 데이터 저장 성공');
        }
      } catch (e) {
        console.warn('원격 저장 실패, 로컬 저장소에 저장:', e);
        disableRemote();
      }
      // 항상 로컬에 캐시하여 UI가 데이터를 즉시 표시할 수 있도록 함
      const id = await localImpl.addRecord(record);
      return id || record.id || null;
    },
    /** @param {string} id @param {{ hours?: number, date?: string }} patch */
    async updateRecord(id, patch) {
      if (!remoteDisabled) try {
        const impl = await getRemoteImpl();
        if (impl) await impl.updateRecord(id, patch);
      } catch (e) {
        console.warn('원격 업데이트 실패, 로컬만 업데이트:', e);
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
        console.warn('원격 삭제 실패, 로컬만 삭제:', e);
        throw e;
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


