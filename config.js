// Firebase 설정
window.FIREBASE_CONFIG = {
  apiKey: "AIzaSyDQEmosR2YJHPQmBMgmFu5hXgQuoGr01Mw",
  authDomain: "study-4cc66.firebaseapp.com",
  projectId: "study-4cc66",
  storageBucket: "study-4cc66.firebasestorage.app",
  messagingSenderId: "663288812068",
  appId: "1:663288812068:web:d8a34f4e20ecf654f2beb1"
};

// Firebase 설정 복사본
window.firebaseConfig = window.FIREBASE_CONFIG;

// Firebase 초기화 상태 확인
window.FIREBASE_INITIALIZED = false;
window.FIREBASE_ERROR = null;
window.FIRESTORE_CONFIGURED = false;

// Firebase 초기화 함수
window.initializeFirebase = async function() {
  try {
    console.log('Firebase 초기화 시작...');
    
    // Firebase 앱 초기화
    if (!firebase.apps.length) {
      firebase.initializeApp(window.FIREBASE_CONFIG);
      console.log('Firebase 앱 초기화 완료');
    }
    
    // Firestore 초기화
    if (!window.FIRESTORE_CONFIGURED) {
      const db = firebase.firestore();
      
      // 안정적인 설정
      const settings = {
        cacheSizeBytes: firebase.firestore.CACHE_SIZE_UNLIMITED,
        experimentalForceLongPolling: true,
        useFetchStreams: false,
        ignoreUndefinedProperties: true
      };
      
      db.settings(settings);
      window.FIRESTORE_CONFIGURED = true;
      console.log('Firestore 설정 완료:', settings);
    }
    
    // 익명 인증
    try {
      await firebase.auth().signInAnonymously();
      console.log('Firebase 익명 인증 성공');
      window.FIREBASE_INITIALIZED = true;
      window.FIREBASE_ERROR = null;
    } catch (authError) {
      console.error('Firebase 익명 인증 실패:', authError);
      window.FIREBASE_ERROR = authError;
      throw authError;
    }
    
    console.log('Firebase 초기화 완료');
    return true;
  } catch (error) {
    console.error('Firebase 초기화 실패:', error);
    window.FIREBASE_ERROR = error;
    throw error;
  }
};

// Firebase 상태 확인 함수
window.checkFirebaseStatus = function() {
  return {
    initialized: window.FIREBASE_INITIALIZED,
    error: window.FIREBASE_ERROR,
    config: window.FIREBASE_CONFIG,
    firestoreConfigured: window.FIRESTORE_CONFIGURED
  };
};

// Firebase 연결 테스트 함수
window.testFirebaseConnection = async function() {
  try {
    if (!window.FIREBASE_INITIALIZED) {
      return { success: false, error: 'Firebase가 초기화되지 않았습니다.' };
    }
    
    const db = firebase.firestore();
    const testCollection = db.collection('_connection_test');
    
    // 간단한 읽기 테스트
    await testCollection.limit(1).get();
    
    return { success: true, message: 'Firebase 연결 성공' };
  } catch (error) {
    return { success: false, error: error.message };
  }
};


