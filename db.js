// Firebase DB implementation with local storage fallback
// This module provides a unified interface for data persistence
// It will try Firebase first, then fall back to localStorage if needed

// Local storage implementation as fallback
const localImpl = {
  async loadRecords() {
    try {
      const stored = localStorage.getItem('studyRecords');
      return stored ? JSON.parse(stored) : [];
    } catch (e) {
      console.error('로컬 스토리지에서 데이터 로드 실패:', e);
      return [];
    }
  },
  
  async addRecord(record) {
    try {
      const records = await this.loadRecords();
      const newRecord = { ...record, id: Date.now().toString() };
      records.push(newRecord);
      localStorage.setItem('studyRecords', JSON.stringify(records));
      return newRecord.id;
    } catch (e) {
      console.error('로컬 스토리지에 레코드 추가 실패:', e);
      throw e;
    }
  },
  
  async updateRecord(id, patch) {
    try {
      const records = await this.loadRecords();
      const index = records.findIndex(r => r.id === id);
      if (index !== -1) {
        records[index] = { ...records[index], ...patch };
        localStorage.setItem('studyRecords', JSON.stringify(records));
        return true;
      }
      return false;
    } catch (e) {
      console.error('로컬 스토리지에서 레코드 업데이트 실패:', e);
      throw e;
    }
  },
  
  async deleteRecord(id) {
    try {
      const records = await this.loadRecords();
      const filtered = records.filter(r => r.id !== id);
      localStorage.setItem('studyRecords', JSON.stringify(filtered));
      return true;
    } catch (e) {
      console.error('로컬 스토리지에서 레코드 삭제 실패:', e);
      throw e;
    }
  },
  
  get isRemote() {
    return false;
  }
};

// Firebase configuration helper
function getFirebaseConfig() {
  return window.FIREBASE_CONFIG || null;
}

// Firebase implementation
let remoteImpl = null;
let remoteInitAttempted = false;

async function getRemoteImpl() {
  if (remoteImpl) return remoteImpl;
  if (remoteInitAttempted) return null;
  remoteInitAttempted = true;

  try {
    console.log('Firebase 모듈 로딩 시작...');
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

    console.log('Firebase 설정 확인됨:', config);
    console.log('Firebase 앱 초기화 시작...');
    
    const app = initializeApp(config);
    console.log('Firebase 앱 초기화 성공');
    
    const auth = getAuth(app);
    console.log('Firebase Auth 초기화 성공');
    
    let userCred;
    try {
      console.log('익명 인증 시도...');
      userCred = await signInAnonymously(auth);
      console.log('Firebase 익명 인증 성공:', userCred.user?.uid);
    } catch (e) {
      console.error('Firebase 익명 인증 실패:', e);
      console.error('에러 코드:', e.code);
      console.error('에러 메시지:', e.message);
      
      // 익명 인증 실패 시 로컬 스토리지로 폴백
      console.warn('Firebase 익명 인증 실패로 로컬 스토리지를 사용합니다.');
      return null;
    }
    
    const uid = userCred.user?.uid || 'anonymous';
    const db = getFirestore(app);
    console.log('Firestore 초기화 성공');

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
    console.error('에러 상세 정보:', {
      name: e.name,
      message: e.message,
      stack: e.stack
    });
    console.warn('Firebase 초기화 실패로 로컬 스토리지를 사용합니다.');
    return null;
  }
}

// Main DB interface
const DB = {
  impl: null,
  
  async init() {
    try {
      // Firebase 시도
      this.impl = await getRemoteImpl();
      if (this.impl) {
        console.log('Firebase DB 초기화 성공');
        return;
      }
      
      // Firebase 실패 시 로컬 스토리지 사용
      console.warn('Firebase 초기화 실패, 로컬 스토리지 사용');
      this.impl = localImpl;
      console.log('로컬 스토리지 DB 초기화 완료');
      
    } catch (e) {
      console.error('DB 초기화 실패:', e);
      // 최종 폴백으로 로컬 스토리지 사용
      this.impl = localImpl;
      console.log('로컬 스토리지로 폴백하여 DB 초기화 완료');
    }
  },
  
  async loadRecords() {
    if (!this.impl) {
      throw new Error('DB가 초기화되지 않았습니다.');
    }
    return this.impl.loadRecords();
  },
  
  async addRecord(record) {
    if (!this.impl) {
      throw new Error('DB가 초기화되지 않았습니다.');
    }
    return this.impl.addRecord(record);
  },
  
  async updateRecord(id, patch) {
    if (!this.impl) {
      throw new Error('DB가 초기화되지 않았습니다.');
    }
    return this.impl.updateRecord(id, patch);
  },
  
  async deleteRecord(id) {
    if (!this.impl) {
      throw new Error('DB가 초기화되지 않았습니다.');
    }
    return this.impl.deleteRecord(id);
  },
  
  get isRemote() {
    return this.impl ? this.impl.isRemote : false;
  }
};

// Export to window for script.js to consume
window.DB = DB;


