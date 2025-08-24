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

// Firebase 초기화 함수
window.initializeFirebase = async function() {
  try {
    // Firebase가 이미 로드되었는지 확인
    if (typeof firebase === 'undefined') {
      console.error('Firebase SDK가 로드되지 않았습니다.');
      return false;
    }

    // Firebase 앱 초기화
    if (!firebase.apps.length) {
      firebase.initializeApp(window.FIREBASE_CONFIG);
      console.log('Firebase 앱 초기화 완료');
    }

    // Firestore 초기화
    const db = firebase.firestore();
    
    // 설정 확인
    console.log('Firestore 데이터베이스:', db);
    console.log('프로젝트 ID:', db.app.options.projectId);
    
    window.FIREBASE_INITIALIZED = true;
    return true;
  } catch (error) {
    console.error('Firebase 초기화 실패:', error);
    window.FIREBASE_INITIALIZED = false;
    return false;
  }
};



