// Database abstraction for GitHub Pages deployments
// - If window.FIREBASE_CONFIG is defined, uses Firebase Firestore with anonymous auth
// - Otherwise falls back to localStorage

(() => {
  const LOCAL_KEY = "studyRecords";

  /** @typedef {{ id?: string; date: string; plan: number; planCumulative: number; hours: number; hoursCumulative: number; percentage: number }} StudyRecord */

  let remoteImpl = null;
  let remoteInitAttempted = false;
  
  function disableRemote() {
    // This function is no longer needed as remote is always enabled
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

  function getFirebaseConfig() {
    if (typeof window === "undefined") return null;
    try {
      // Always use Firebase, no local fallback
      return window.FIREBASE_CONFIG || window.firebaseConfig || null;
    } catch {}
    return null;
  }

  /** @returns {boolean} */
  function hasFirebaseConfig() {
    return Boolean(getFirebaseConfig());
  }

  async function getRemoteImpl() {
    if (remoteImpl) return remoteImpl;
    if (remoteInitAttempted) return null;
    remoteInitAttempted = true;

    try {
      const [{ initializeApp }, { getAuth, signInAnonymously }, { getFirestore, collection, addDoc, getDocs, query, orderBy, updateDoc, deleteDoc, doc }]
        = await Promise.all([
          import('https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js'),
          import('https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js'),
          import('https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js'),
        ]);

      const config = getFirebaseConfig();
      if (!config) {
        console.error('Firebase 설정이 없습니다.');
        return null;
      }

      const app = initializeApp(config);
      const auth = getAuth(app);
      let userCred;
      try {
        userCred = await signInAnonymously(auth);
        console.log('Firebase 익명 인증 성공:', userCred.user?.uid);
      } catch (e) {
        console.warn('Firebase 익명 인증 실패, 로컬 저장소로 fallback:', e);
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
      return null;
    }
  }

  const DB = {
    /** Initialize DB. Returns true if remote is used. */
    async init() {
      try {
        if (!hasFirebaseConfig()) {
          console.error('Firebase 설정이 없습니다. config.js 파일을 확인해주세요.');
          throw new Error('Firebase 설정이 없습니다.');
        }
        
        const impl = await getRemoteImpl();
        if (impl) {
          console.log('Firebase DB 초기화 성공');
          return true;
        } else {
          console.error('Firebase DB 초기화 실패');
          throw new Error('Firebase DB 초기화 실패');
        }
      } catch (e) {
        console.error('Firebase DB 초기화 실패:', e);
        throw new Error(`Firebase 초기화 실패: ${e.message}`);
      }
    },
    /** @returns {Promise<StudyRecord[]>} */
    async loadRecords() {
      try {
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
      }
      // 원격이 비어있거나 실패한 경우 로컬 캐시 사용
      return localImpl.loadRecords();
    },
    /** @param {StudyRecord} record */
    async addRecord(record) {
      let savedRemote = false;
      try {
        const impl = await getRemoteImpl();
        if (impl) {
          const newId = await impl.addRecord(record);
          record.id = newId;
          savedRemote = true;
          console.log('Firebase에 데이터 저장 성공');
        }
      } catch (e) {
        console.warn('원격 저장 실패, 로컬 저장소에 저장:', e);
      }
      // 항상 로컬에 캐시하여 UI가 데이터를 즉시 표시할 수 있도록 함
      const id = await localImpl.addRecord(record);
      return id || record.id || null;
    },
    /** @param {string} id @param {{ hours?: number, date?: string }} patch */
    async updateRecord(id, patch) {
      try {
        const impl = await getRemoteImpl();
        if (impl) await impl.updateRecord(id, patch);
      } catch (e) {
        console.warn('원격 업데이트 실패, 로컬만 업데이트:', e);
      }
      return localImpl.updateRecord(id, patch);
    },
    /** @param {string} id */
    async deleteRecord(id) {
      try {
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


