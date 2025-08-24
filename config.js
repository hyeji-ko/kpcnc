// Firebase 설정
window.FIREBASE_CONFIG = {
  apiKey: "AIzaSyDQEmosR2YJHPQmBMgmFu5hXgQuoGr01Mw",
  authDomain: "study-4cc66.firebaseapp.com",
  projectId: "study-4cc66",
  storageBucket: "study-4cc66.appspot.com",
  messagingSenderId: "663288812068",
  appId: "1:663288812068:web:d8a34f4e20ecf654f2beb1"
};

// Firebase 설정 복사본
window.firebaseConfig = window.FIREBASE_CONFIG;

// Firebase 초기화 상태 확인
window.FIREBASE_INITIALIZED = false;
window.FIREBASE_ERROR = null;

// Firebase 초기화 함수
window.initializeFirebase = async function() {
  try {
    console.log('Firebase 초기화 시작...');
    
    // Firebase가 이미 로드되었는지 확인
    if (typeof firebase === 'undefined') {
      console.error('Firebase SDK가 로드되지 않았습니다.');
      window.FIREBASE_ERROR = 'Firebase SDK 로드 실패';
      return false;
    }

    // Firebase 앱 초기화
    if (!firebase.apps.length) {
      firebase.initializeApp(window.FIREBASE_CONFIG);
      console.log('Firebase 앱 초기화 완료');
    }

    // Firestore 초기화 및 설정
    const db = firebase.firestore();
    
    // Firestore 설정 - WebChannel 오류 방지
    const settings = {
      cacheSizeBytes: firebase.firestore.CACHE_SIZE_UNLIMITED,
      experimentalForceLongPolling: true,
      useFetchStreams: false,
      ignoreUndefinedProperties: true
    };
    
    db.settings(settings);
    console.log('Firestore 설정 적용됨:', settings);
    
    // 연결 테스트
    try {
      await db.collection('_test').limit(1).get();
      console.log('Firestore 연결 테스트 성공');
    } catch (testError) {
      console.warn('Firestore 연결 테스트 실패 (정상적일 수 있음):', testError.message);
    }
    
    window.FIREBASE_INITIALIZED = true;
    window.FIREBASE_ERROR = null;
    console.log('✅ Firebase 초기화 완료');
    return true;
    
  } catch (error) {
    console.error('Firebase 초기화 실패:', error);
    window.FIREBASE_INITIALIZED = false;
    window.FIREBASE_ERROR = error.message;
    return false;
  }
};

// Firebase 상태 확인 함수
window.checkFirebaseStatus = function() {
  return {
    initialized: window.FIREBASE_INITIALIZED,
    error: window.FIREBASE_ERROR,
    config: window.FIREBASE_CONFIG
  };
};


