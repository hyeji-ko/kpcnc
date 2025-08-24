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
  try {
    // Firebase가 초기화되지 않았습니다. 초기화를 시도합니다...
    if (!window.FIREBASE_INITIALIZED) {
      console.log('Firebase가 초기화되지 않았습니다. 초기화를 시도합니다...');
      
      // 모바일 환경 감지
      const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
      console.log('모바일 환경 감지:', isMobile);
      
      try {
        await window.initializeFirebase();
        console.log('Firebase 초기화 성공');
      } catch (initError) {
        console.error('Firebase 초기화 실패:', initError);
        
        // 모바일에서는 더 자세한 오류 정보 제공
        if (isMobile) {
          console.error('모바일 Firebase 초기화 실패 상세:', {
            error: initError,
            userAgent: navigator.userAgent,
            platform: navigator.platform,
            cookieEnabled: navigator.cookieEnabled,
            onLine: navigator.onLine
          });
        }
        
        return null;
      }
    }
    
    if (!window.FIREBASE_INITIALIZED) {
      console.error('Firebase 초기화 실패');
      return null;
    }
    
    // Firestore 인스턴스 가져오기
    const db = firebase.firestore();
    
    // 모바일 환경에서 연결 테스트
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    if (isMobile) {
      try {
        // 모바일에서는 간단한 연결 테스트만 수행
        await db.collection('_test').limit(1).get();
        console.log('모바일 Firestore 연결 테스트 성공');
      } catch (testError) {
        console.warn('모바일 Firestore 연결 테스트 실패:', testError.message);
        // 모바일에서는 연결 테스트 실패해도 계속 진행
      }
    }
    
    return {
      async addRecord(record) {
        try {
          const docRef = await db.collection('users').doc('anonymous').collection('records').add(record);
          console.log('Firebase에 레코드 추가 성공:', docRef.id);
          return docRef.id;
        } catch (error) {
          console.error('Firebase 레코드 추가 실패:', error);
          throw error;
        }
      },
      
      async loadRecords() {
        try {
          const snapshot = await db.collection('users').doc('anonymous').collection('records').get();
          const records = [];
          snapshot.forEach(doc => {
            records.push({ id: doc.id, ...doc.data() });
          });
          console.log('Firebase에서 레코드 로드 성공:', records.length);
          return records;
        } catch (error) {
          console.error('Firebase 레코드 로드 실패:', error);
          throw error;
        }
      },
      
      async updateRecord(id, updates) {
        try {
          await db.collection('users').doc('anonymous').collection('records').doc(id).update(updates);
          console.log('Firebase 레코드 업데이트 성공:', id);
        } catch (error) {
          console.error('Firebase 레코드 업데이트 실패:', error);
          throw error;
        }
      },
      
      async deleteRecord(id) {
        try {
          await db.collection('users').doc('anonymous').collection('records').doc(id).delete();
          console.log('Firebase 레코드 삭제 성공:', id);
        } catch (error) {
          console.error('Firebase 레코드 삭제 실패:', error);
          throw error;
        }
      }
    };
  } catch (error) {
    console.error('Firebase 원격 DB 연결 실패:', error);
    
    // 모바일 환경 감지
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    const deviceType = isMobile ? '모바일' : 'PC';
    
    console.error('에러 코드:', error.code);
    console.error('에러 메시지:', error.message);
    
    if (isMobile) {
      console.error('모바일 Firebase 연결 실패 상세 정보:', {
        error: error,
        userAgent: navigator.userAgent,
        platform: navigator.platform,
        cookieEnabled: navigator.cookieEnabled,
        onLine: navigator.onLine,
        connection: navigator.connection ? {
          effectiveType: navigator.connection.effectiveType,
          downlink: navigator.connection.downlink,
          rtt: navigator.connection.rtt
        } : 'Not supported'
      });
    }
    
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
      
      // 사용자에게 Firebase 설정 안내
      this.showFirebaseSetupHelp();
      
    } catch (e) {
      console.error('DB 초기화 실패:', e);
      // 최종 폴백으로 로컬 스토리지 사용
      this.impl = localImpl;
      console.log('로컬 스토리지로 폴백하여 DB 초기화 완료');
      
      // 사용자에게 Firebase 설정 안내
      this.showFirebaseSetupHelp();
    }
  },
  
  // Firebase 설정 도움말 표시
  showFirebaseSetupHelp() {
    const helpDiv = document.createElement('div');
    helpDiv.id = 'firebase-help';
    helpDiv.innerHTML = `
      <div style="
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background: white;
        border: 2px solid #f59e0b;
        border-radius: 12px;
        padding: 24px;
        max-width: 500px;
        box-shadow: 0 10px 30px rgba(0,0,0,0.3);
        z-index: 10000;
        font-family: Arial, sans-serif;
      ">
        <h3 style="margin: 0 0 16px 0; color: #f59e0b;">⚠️ Firebase 연결 실패</h3>
        <p style="margin: 0 0 16px 0; line-height: 1.5;">
          현재 로컬 스토리지를 사용하고 있습니다. Firebase 원격 DB를 사용하려면 다음 설정이 필요합니다:
        </p>
        <ol style="margin: 0 0 16px 0; padding-left: 20px; line-height: 1.5;">
          <li>Firebase Console에서 Authentication 서비스 활성화</li>
          <li>익명 인증 방법 활성화</li>
          <li>도메인 설정 확인</li>
        </ol>
        <p style="margin: 0 0 16px 0; line-height: 1.5;">
          <strong>현재 앱은 정상 작동합니다.</strong> 데이터는 브라우저에 저장됩니다.
        </p>
        <div style="text-align: center;">
          <button onclick="document.getElementById('firebase-help').remove()" style="
            background: #3b82f6;
            color: white;
            border: none;
            padding: 8px 16px;
            border-radius: 6px;
            cursor: pointer;
          ">확인</button>
        </div>
      </div>
    `;
    
    // 기존 도움말 제거
    const existingHelp = document.getElementById('firebase-help');
    if (existingHelp) {
      existingHelp.remove();
    }
    
    document.body.appendChild(helpDiv);
    
    // 10초 후 자동 제거
    setTimeout(() => {
      if (helpDiv.parentNode) {
        helpDiv.remove();
      }
    }, 10000);
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


