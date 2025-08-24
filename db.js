// Database abstraction for GitHub Pages deployments
// Firebase Firestore with anonymous auth only

(() => {
  /** @typedef {{ id?: string; date: string; plan: number; planCumulative: number; hours: number; hoursCumulative: number; percentage: number }} StudyRecord */

  let remoteImpl = null;
  let remoteInitAttempted = false;

  function getFirebaseConfig() {
    if (typeof window === "undefined") return null;
    try {
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
        console.error('Firebase 익명 인증 실패:', e);
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
          return await impl.loadRecords();
        }
      } catch (e) {
        console.error('Firebase에서 데이터 로드 실패:', e);
        throw e;
      }
      throw new Error('Firebase DB가 초기화되지 않았습니다.');
    },
    /** @param {StudyRecord} record */
    async addRecord(record) {
      try {
        const impl = await getRemoteImpl();
        if (impl) {
          const newId = await impl.addRecord(record);
          record.id = newId;
          console.log('Firebase에 데이터 저장 성공');
          return newId;
        }
      } catch (e) {
        console.error('Firebase에 데이터 저장 실패:', e);
        throw e;
      }
      throw new Error('Firebase DB가 초기화되지 않았습니다.');
    },
    /** @param {string} id @param {{ hours?: number, date?: string, plan?: number, planCumulative?: number, hoursCumulative?: number, percentage?: number }} patch */
    async updateRecord(id, patch) {
      try {
        const impl = await getRemoteImpl();
        if (impl) {
          return await impl.updateRecord(id, patch);
        }
      } catch (e) {
        console.error('Firebase에서 레코드 업데이트 실패:', e);
        throw e;
      }
      throw new Error('Firebase DB가 초기화되지 않았습니다.');
    },
    /** @param {string} id */
    async deleteRecord(id) {
      try {
        const impl = await getRemoteImpl();
        if (impl) {
          return await impl.deleteRecord(id);
        }
      } catch (e) {
        console.error('Firebase에서 레코드 삭제 실패:', e);
        throw e;
      }
      throw new Error('Firebase DB가 초기화되지 않았습니다.');
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


