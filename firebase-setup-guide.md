# Firebase 설정 문제 해결 가이드

## 현재 문제
- `auth/configuration-not-found` 에러 발생
- Firebase Authentication 서비스 설정 문제
- 앱은 로컬 스토리지로 폴백하여 작동 중

## 해결 방법

### 1. Firebase Console에서 Authentication 활성화
1. [Firebase Console](https://console.firebase.google.com/) 접속
2. 프로젝트 `study-4cc66` 선택
3. 왼쪽 메뉴에서 "Authentication" 클릭
4. "시작하기" 버튼 클릭
5. "로그인 방법" 탭에서 "익명" 활성화
6. "저장" 클릭

### 2. Firebase 프로젝트 설정 확인
1. 프로젝트 설정 (⚙️ 아이콘) 클릭
2. "일반" 탭에서 앱 설정 확인
3. "Authentication" 섹션에서 "도메인" 추가
   - `localhost` 추가
   - `127.0.0.1` 추가
   - 배포 도메인 추가 (예: `yourdomain.com`)

### 3. Firebase 규칙 설정
Firestore Database > 규칙에서 다음 설정:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{userId}/records/{document=**} {
      allow read, write: if request.auth != null;
    }
  }
}
```

### 4. 현재 설정으로 테스트
현재 앱은 로컬 스토리지로 정상 작동 중입니다.
Firebase 설정이 완료되면 자동으로 원격 DB로 전환됩니다.

## 임시 해결책
Firebase 설정이 완료될 때까지 로컬 스토리지를 사용하여 앱을 계속 사용할 수 있습니다.
데이터는 브라우저에 저장되며, 다른 브라우저나 기기에서는 공유되지 않습니다.

## 완전한 해결 후
Firebase 설정이 완료되면:
1. 브라우저 새로고침
2. Firebase 원격 DB 연결 확인
3. 데이터 동기화 확인
