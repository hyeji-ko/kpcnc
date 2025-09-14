// Firebase Configuration
// 실제 프로젝트에서는 Firebase 콘솔에서 가져온 설정을 사용해야 합니다.

// Firebase를 기본 저장소로 사용
const useLocalStorage = false; // 임시로 로컬 스토리지 사용 (Firebase 연결 문제 해결 전까지)

const firebaseConfig = {
    apiKey: "AIzaSyAAFgwDAIawPLZomL0et1mnFnxfczOFjXU",
    authDomain: "seminar-402ee.firebaseapp.com",
    projectId: "seminar-402ee",
    storageBucket: "seminar-402ee.firebasestorage.app",
    messagingSenderId: "474752615650",
    appId: "1:474752615650:web:ec08ed3c3593ed5d7d4abb"
};

// Firebase 초기화
firebase.initializeApp(firebaseConfig);

// Firestore 데이터베이스 참조
const db = firebase.firestore();

// Firebase 설정 상태 확인
// console.log('Firebase initialized successfully');

// 이미지 처리 함수들 (Base64 방식)
async function processImageToBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            resolve(e.target.result);
        };
        reader.onerror = (error) => {
            reject(error);
        };
        reader.readAsDataURL(file);
    });
}

async function uploadImage(file, path) {
    try {
        // Firebase Storage 대신 Base64로 변환하여 반환
        const base64Data = await processImageToBase64(file);
        return { success: true, url: base64Data };
    } catch (error) {
        console.error('이미지 처리 오류:', error);
        return { success: false, message: '이미지 처리 중 오류가 발생했습니다: ' + error.message };
    }
}

async function deleteImage(path) {
    // Base64 방식에서는 삭제할 필요 없음 (Firestore에서 직접 삭제)
    return { success: true };
}

// 실시결과 저장 함수 (회차_일시를 키값으로 사용)
async function saveResultData(data) {
    try {
        if (!data.session || !data.datetime) {
            return { success: false, message: '회차와 일시 정보가 필요합니다.' };
        }

        // 회차_일시를 키값으로 사용
        const key = `${data.session}_${data.datetime}`;
        
        if (useLocalStorage) {
            // 로컬 스토리지 사용 - 회차_일시를 키로 사용
            const existingResults = JSON.parse(localStorage.getItem('seminarResults') || '{}');
            existingResults[key] = {
                ...data,
                key: key,
                updatedAt: new Date().toISOString()
            };
            localStorage.setItem('seminarResults', JSON.stringify(existingResults));
            return { success: true, message: '로컬 스토리지에 저장되었습니다.', key: key };
        } else {
            // Firebase 사용 - 회차_일시를 문서 ID로 사용
            const docRef = db.collection('seminarResults').doc(key);
            await docRef.set({
                ...data,
                key: key,
                createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            }, { merge: true });
            return { success: true, message: 'Firebase에 저장되었습니다.', key: key };
        }
    } catch (error) {
        console.error('실시결과 저장 오류:', error);
        return { success: false, message: '저장 중 오류가 발생했습니다: ' + error.message };
    }
}

// 실시결과 조회 함수 (모든 데이터 반환)
async function loadResultData() {
    try {
        if (useLocalStorage) {
            // 로컬 스토리지 사용 - 모든 실시결과 데이터 반환
            const data = localStorage.getItem('seminarResults');
            if (data) {
                const results = JSON.parse(data);
                return Object.values(results);
            }
            return [];
        } else {
            // Firebase 사용 - 모든 실시결과 데이터 반환
            const snapshot = await db.collection('seminarResults').orderBy('updatedAt', 'desc').get();
            const results = [];
            snapshot.forEach(doc => {
                results.push({ id: doc.id, ...doc.data() });
            });
            return results;
        }
    } catch (error) {
        console.error('실시결과 조회 오류:', error);
        return [];
    }
}

// 특정 회차_일시의 실시결과 조회 함수
async function loadResultDataByKey(session, datetime) {
    try {
        if (!session || !datetime) {
            return null;
        }

        const key = `${session}_${datetime}`;
        
        if (useLocalStorage) {
            // 로컬 스토리지 사용
            const data = localStorage.getItem('seminarResults');
            if (data) {
                const results = JSON.parse(data);
                return results[key] || null;
            }
            return null;
        } else {
            // Firebase 사용
            const docRef = db.collection('seminarResults').doc(key);
            const doc = await docRef.get();
            if (doc.exists) {
                return { id: doc.id, ...doc.data() };
            }
            return null;
        }
    } catch (error) {
        console.error('특정 실시결과 조회 오류:', error);
        return null;
    }
}

// 데이터 저장 함수 (로컬 스토리지 또는 Firebase)
async function saveData(data) {
    try {
        if (useLocalStorage) {
            // 로컬 스토리지 사용
            const dataWithSketches = {
                ...data,
                sketches: data.sketches || [] // sketches 필드 추가
            };
            localStorage.setItem('seminarPlan', JSON.stringify(dataWithSketches));
            return { success: true, message: '로컬 스토리지에 저장되었습니다.' };
        } else {
            // Firebase 사용
            const docRef = await db.collection('seminarPlans').add({
                ...data,
                sketches: data.sketches || [], // sketches 필드 추가
                createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            });
            return { success: true, message: 'Firebase에 저장되었습니다.', id: docRef.id };
        }
    } catch (error) {
        console.error('데이터 저장 오류:', error);
        return { success: false, message: '저장 중 오류가 발생했습니다: ' + error.message };
    }
}

// 데이터 불러오기 함수
async function loadData() {
    try {
        if (useLocalStorage) {
            // 로컬 스토리지에서 가장 최신 데이터 불러오기
            const data = localStorage.getItem('seminarPlans');
            if (data) {
                const allData = JSON.parse(data);
                if (allData.length > 0) {
                    // 일시 기준으로 내림차순 정렬하여 가장 최신 데이터 반환
                    allData.sort((a, b) => {
                        const dateA = new Date(a.data.datetime || '1900-01-01');
                        const dateB = new Date(b.data.datetime || '1900-01-01');
                        return dateB - dateA; // 내림차순
                    });
                    
                    const latestData = allData[0];
                    return { success: true, data: latestData.data, id: latestData.id };
                } else {
                    return { success: false, message: '저장된 데이터가 없습니다.' };
                }
            } else {
                return { success: false, message: '저장된 데이터가 없습니다.' };
            }
        } else {
            // Firebase에서 불러오기 (모든 데이터를 가져온 후 JavaScript에서 정렬)
            const snapshot = await db.collection('seminarPlans').get();
            
            if (!snapshot.empty) {
                const plans = [];
                snapshot.forEach(doc => {
                    const docData = doc.data();
                    // console.log(`🔥 Firebase 문서 ${doc.id} 데이터:`, docData);
                    // console.log(`🔥 참석자 데이터:`, docData.attendeeList);
                    plans.push({
                        id: doc.id,
                        ...docData
                    });
                });
                
                // JavaScript에서 정렬: 세미나 개최 회차 내림차순, 일시 내림차순
                // console.log('🔍 정렬 전 데이터:', plans.map(p => ({ session: p.session, datetime: p.datetime })));
                
                plans.sort((a, b) => {
                    // 세미나 개최 회차 비교 (숫자로 변환하여 비교)
                    const sessionA = extractSessionNumber(a.session);
                    const sessionB = extractSessionNumber(b.session);
                    
                    // console.log(`🔍 정렬 비교: "${a.session}"(${sessionA}) vs "${b.session}"(${sessionB})`);
                    
                    if (sessionA !== sessionB) {
                        return sessionB - sessionA; // 내림차순
                    }
                    
                    // 같은 회차인 경우 일시 비교
                    const dateA = new Date(a.datetime || '1900-01-01');
                    const dateB = new Date(b.datetime || '1900-01-01');
                    return dateB - dateA; // 내림차순
                });
                
                // console.log('🔍 정렬 후 데이터:', plans.map(p => ({ session: p.session, datetime: p.datetime })));
                
                // 가장 최신 데이터 반환
                const latestPlan = plans[0];
                // console.log('🔍 선택된 최신 데이터:', { session: latestPlan.session, datetime: latestPlan.datetime });
                return { success: true, data: latestPlan, id: latestPlan.id };
            } else {
                return { success: false, message: '저장된 데이터가 없습니다.' };
            }
        }
    } catch (error) {
        console.error('데이터 불러오기 오류:', error);
        return { success: false, message: '데이터 불러오기 중 오류가 발생했습니다: ' + error.message };
    }
}

// 데이터 업데이트 함수
async function updateData(id, data) {
    try {
        if (useLocalStorage) {
            // 로컬 스토리지에서 특정 ID의 데이터 업데이트
            const allData = JSON.parse(localStorage.getItem('seminarPlans') || '[]');
            const index = allData.findIndex(item => item.id === id);
            
            if (index !== -1) {
                allData[index].data = {
                    ...data,
                    sketches: data.sketches || [] // sketches 필드 추가
                };
                allData[index].updatedAt = new Date().toISOString();
                localStorage.setItem('seminarPlans', JSON.stringify(allData));
                return { success: true, message: '로컬 스토리지가 업데이트되었습니다.' };
            } else {
                return { success: false, message: '업데이트할 데이터를 찾을 수 없습니다.' };
            }
        } else {
            // Firebase 업데이트
            try {
                await db.collection('seminarPlans').doc(id).update({
                    ...data,
                    sketches: data.sketches || [], // sketches 필드 추가
                    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
                });
                return { success: true, message: 'Firebase가 업데이트되었습니다.' };
            } catch (firebaseError) {
                console.error('Firebase 업데이트 오류:', firebaseError);
                return { success: false, message: 'Firebase 업데이트 중 오류가 발생했습니다: ' + firebaseError.message };
            }
        }
    } catch (error) {
        console.error('데이터 업데이트 오류:', error);
        return { success: false, message: '업데이트 중 오류가 발생했습니다: ' + error.message };
    }
}

// 데이터 삭제 함수
async function deleteData(id) {
    try {
        if (useLocalStorage) {
            // 로컬 스토리지에서 특정 ID의 데이터 삭제
            const allData = JSON.parse(localStorage.getItem('seminarPlans') || '[]');
            const filteredData = allData.filter(item => item.id !== id);
            localStorage.setItem('seminarPlans', JSON.stringify(filteredData));
            return { success: true, message: '로컬 스토리지에서 삭제되었습니다.' };
        } else {
            // Firebase 삭제
            await db.collection('seminarPlans').doc(id).delete();
            return { success: true, message: 'Firebase에서 삭제되었습니다.' };
        }
    } catch (error) {
        console.error('데이터 삭제 오류:', error);
        return { success: false, message: '삭제 중 오류가 발생했습니다: ' + error.message };
    }
}

// 모든 세미나 계획 목록 불러오기
async function loadAllPlans() {
    try {
        if (useLocalStorage) {
            // 로컬 스토리지에서 모든 세미나 계획 불러오기
            const data = localStorage.getItem('seminarPlans');
            if (data) {
                const allData = JSON.parse(data);
                const plans = allData.map(item => ({
                    id: item.id,
                    ...item.data
                }));
                
                // 일시 기준으로 내림차순 정렬
                plans.sort((a, b) => {
                    const dateA = new Date(a.datetime || '1900-01-01');
                    const dateB = new Date(b.datetime || '1900-01-01');
                    return dateB - dateA; // 내림차순
                });
                
                // console.log(`📁 로컬 스토리지에서 ${plans.length}개의 계획을 로드했습니다.`);
                return { success: true, data: plans };
            } else {
                // console.log('📁 로컬 스토리지에 저장된 계획이 없습니다.');
                return { success: true, data: [] };
            }
        } else {
            // Firebase에서 모든 계획 불러오기 (모든 데이터를 가져온 후 JavaScript에서 정렬)
            const snapshot = await db.collection('seminarPlans').get();
            
            const plans = [];
            snapshot.forEach(doc => {
                const docData = doc.data();
                // console.log(`🔥 Firebase 문서 ${doc.id}:`, docData);
                // console.log(`🔥 참석자 데이터 (loadAllPlans):`, docData.attendeeList);
                plans.push({
                    id: doc.id,
                    ...docData
                });
            });
            
            // JavaScript에서 정렬: 세미나 개최 회차 내림차순, 일시 내림차순
            plans.sort((a, b) => {
                // 세미나 개최 회차 비교 (숫자로 변환하여 비교)
                const sessionA = extractSessionNumber(a.session);
                const sessionB = extractSessionNumber(b.session);
                
                if (sessionA !== sessionB) {
                    return sessionB - sessionA; // 내림차순
                }
                
                // 같은 회차인 경우 일시 비교
                const dateA = new Date(a.datetime || '1900-01-01');
                const dateB = new Date(b.datetime || '1900-01-01');
                return dateB - dateA; // 내림차순
            });
            
            // console.log(`🔥 Firebase에서 총 ${plans.length}개의 계획을 로드했습니다.`);
            return { success: true, data: plans };
        }
    } catch (error) {
        console.error('모든 계획 불러오기 오류:', error);
        return { success: false, message: '계획 목록 불러오기 중 오류가 발생했습니다: ' + error.message };
    }
}

// 회차 문자열에서 숫자 추출 함수
function extractSessionNumber(session) {
    if (!session) return 0;
    
    // "제 4회", "제 5회", "제10회" 등의 패턴에서 숫자 추출
    const match = session.match(/(\d+)/);
    return match ? parseInt(match[1]) : 0;
}

// Firebase 설정 확인
function checkFirebaseStatus() {
    if (useLocalStorage) {
        // console.log('로컬 스토리지 모드로 실행 중');
        return true;
    } else {
        try {
            const app = firebase.app();
            // console.log('Firebase 앱이 정상적으로 초기화되었습니다:', app.name);
            
            // Firestore 연결 상태 확인
            const db = firebase.firestore();
            // console.log('Firestore 데이터베이스 참조 생성됨');
            
            // 연결 테스트
            db.collection('test').limit(1).get()
                .then(() => {
                    // console.log('✅ Firestore 연결 테스트 성공');
                })
                .catch((error) => {
                    console.error('❌ Firestore 연결 테스트 실패:', error);
                });
            
            return true;
        } catch (error) {
            console.error('Firebase 초기화 오류:', error);
            return false;
        }
    }
}

// ==================== 직원 데이터 Firebase 함수들 ====================

// 직원 데이터 저장 함수
async function saveEmployeeData(employeeData) {
    try {
        if (useLocalStorage) {
            // 로컬 스토리지 사용
            const existingEmployees = JSON.parse(localStorage.getItem('employeeList') || '[]');
            existingEmployees.push(employeeData);
            localStorage.setItem('employeeList', JSON.stringify(existingEmployees));
            return { success: true, message: '로컬 스토리지에 직원이 저장되었습니다.' };
        } else {
            // Firebase 사용 - 이메일을 문서 ID로 사용
            const docRef = db.collection('employees').doc(employeeData.email);
            await docRef.set({
                ...employeeData,
                createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            }, { merge: true });
            return { success: true, message: 'Firebase에 직원이 저장되었습니다.' };
        }
    } catch (error) {
        console.error('직원 데이터 저장 오류:', error);
        return { success: false, message: '직원 저장 중 오류가 발생했습니다: ' + error.message };
    }
}

// 모든 직원 데이터 조회 함수
async function loadAllEmployees() {
    try {
        if (useLocalStorage) {
            // 로컬 스토리지 사용
            const data = localStorage.getItem('employeeList');
            if (data) {
                return { success: true, data: JSON.parse(data) };
            }
            return { success: true, data: [] };
        } else {
            // Firebase 사용
            const snapshot = await db.collection('employees').orderBy('createdAt', 'desc').get();
            const employees = [];
            snapshot.forEach(doc => {
                employees.push({ id: doc.id, ...doc.data() });
            });
            return { success: true, data: employees };
        }
    } catch (error) {
        console.error('직원 데이터 조회 오류:', error);
        return { success: false, message: '직원 조회 중 오류가 발생했습니다: ' + error.message };
    }
}

// 특정 직원 데이터 조회 함수 (이메일로)
async function loadEmployeeByEmail(email) {
    try {
        if (useLocalStorage) {
            // 로컬 스토리지 사용
            const data = localStorage.getItem('employeeList');
            if (data) {
                const employees = JSON.parse(data);
                const employee = employees.find(emp => emp.email === email);
                return employee || null;
            }
            return null;
        } else {
            // Firebase 사용
            const docRef = db.collection('employees').doc(email);
            const doc = await docRef.get();
            if (doc.exists) {
                return { id: doc.id, ...doc.data() };
            }
            return null;
        }
    } catch (error) {
        console.error('직원 데이터 조회 오류:', error);
        return null;
    }
}

// 직원 데이터 업데이트 함수
async function updateEmployeeData(email, employeeData) {
    try {
        if (useLocalStorage) {
            // 로컬 스토리지 사용
            const data = localStorage.getItem('employeeList');
            if (data) {
                const employees = JSON.parse(data);
                const index = employees.findIndex(emp => emp.email === email);
                if (index !== -1) {
                    employees[index] = { ...employeeData, email };
                    localStorage.setItem('employeeList', JSON.stringify(employees));
                    return { success: true, message: '로컬 스토리지에서 직원이 업데이트되었습니다.' };
                }
                return { success: false, message: '업데이트할 직원을 찾을 수 없습니다.' };
            }
            return { success: false, message: '저장된 직원 데이터가 없습니다.' };
        } else {
            // Firebase 사용
            const docRef = db.collection('employees').doc(email);
            await docRef.update({
                ...employeeData,
                email: email, // 이메일은 변경되지 않도록 보장
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            });
            return { success: true, message: 'Firebase에서 직원이 업데이트되었습니다.' };
        }
    } catch (error) {
        console.error('직원 데이터 업데이트 오류:', error);
        return { success: false, message: '직원 업데이트 중 오류가 발생했습니다: ' + error.message };
    }
}

// 직원 데이터 삭제 함수
async function deleteEmployeeData(email) {
    try {
        if (useLocalStorage) {
            // 로컬 스토리지 사용
            const data = localStorage.getItem('employeeList');
            if (data) {
                const employees = JSON.parse(data);
                const filteredEmployees = employees.filter(emp => emp.email !== email);
                localStorage.setItem('employeeList', JSON.stringify(filteredEmployees));
                return { success: true, message: '로컬 스토리지에서 직원이 삭제되었습니다.' };
            }
            return { success: false, message: '저장된 직원 데이터가 없습니다.' };
        } else {
            // Firebase 사용
            await db.collection('employees').doc(email).delete();
            return { success: true, message: 'Firebase에서 직원이 삭제되었습니다.' };
        }
    } catch (error) {
        console.error('직원 데이터 삭제 오류:', error);
        return { success: false, message: '직원 삭제 중 오류가 발생했습니다: ' + error.message };
    }
}

// 전역 함수로 노출 (HTML에서 호출하기 위해)
window.saveData = saveData;
window.loadData = loadData;
window.updateData = updateData;
window.deleteData = deleteData;
window.loadAllPlans = loadAllPlans;
window.saveResultData = saveResultData;
window.loadResultData = loadResultData;
window.loadResultDataByKey = loadResultDataByKey;
window.saveEmployeeData = saveEmployeeData;
window.loadAllEmployees = loadAllEmployees;
window.loadEmployeeByEmail = loadEmployeeByEmail;
window.updateEmployeeData = updateEmployeeData;
window.deleteEmployeeData = deleteEmployeeData;
window.db = db;
window.useLocalStorage = useLocalStorage;

// 페이지 로드 시 Firebase 상태 확인
document.addEventListener('DOMContentLoaded', function() {
    checkFirebaseStatus();
});
