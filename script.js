(() => {

  /** @typedef {{ date: string; plan: number; planCumulative: number; hours: number; hoursCumulative: number; percentage: number }} StudyRecord */

  document.addEventListener("DOMContentLoaded", async () => {
    const registerBtn = document.getElementById("registerBtn");
    const listBtn = document.getElementById("listBtn");
    const uploadBtn = document.getElementById("uploadBtn");
    const batchDeleteBtn = document.getElementById("batchDeleteBtn");
    const formSection = document.getElementById("formSection");
    const gridSection = document.getElementById("gridSection");
    const uploadSection = document.getElementById("uploadSection");
    const studyForm = document.getElementById("studyForm");
    const uploadForm = document.getElementById("uploadForm");
    const dateInput = document.getElementById("dateInput");
    const planInput = document.getElementById("planInput");
    const hoursInput = document.getElementById("hoursInput");
    const csvFileInput = document.getElementById("csvFileInput");
    const formMessage = document.getElementById("formMessage");
    const uploadMessage = document.getElementById("uploadMessage");
    const tbody = document.getElementById("recordsTbody");
    const paginationNav = document.getElementById("paginationNav");
    const prevPageBtn = document.getElementById("prevPageBtn");
    const nextPageBtn = document.getElementById("nextPageBtn");
    const pageInfo = document.getElementById("pageInfo");
    const monthDisplay = document.getElementById("monthDisplay");
    const monthCalendar = document.getElementById("monthCalendar");
    const currentMonthText = document.getElementById("currentMonthText");
    const yearDisplay = document.getElementById("yearDisplay");
    const monthItems = document.querySelectorAll('.month-item');
    const yearItems = document.querySelectorAll('.year-item');

    // Firebase 원격 DB만 사용
    const DB = window.DB;
    if (!DB) {
      console.error('DB 모듈이 로드되지 않았습니다. Firebase 설정을 확인해주세요.');
      throw new Error('DB 모듈이 로드되지 않았습니다.');
    }

    const selectedIds = new Set();
    
    // 페이지네이션 관련 변수
    let currentPage = 0;
    const pageSize = 7; // 7일 단위
    
    // 현재 선택된 년월 - 항상 현재일자로 설정
    let selectedYear = new Date().getFullYear();
    let selectedMonth = new Date().getMonth() + 1;

    // Attach listeners BEFORE any awaits so UI remains responsive
    uploadBtn.addEventListener("click", async () => {
      showUpload();
      // 파일 선택기가 자동으로 열리도록 CSV 파일 입력 필드 클릭
      requestAnimationFrame(() => {
        csvFileInput.click();
      });
    });

    // CSV 파일 선택 시 자동 업로드 처리
    csvFileInput.addEventListener("change", async (e) => {
      const file = e.target.files[0];
      if (file) {
        try {
          clearUploadMessage();
          setUploadMessage("파일을 처리 중입니다...");
          
          const text = await file.text();
          const records = parseCSV(text);
          
          if (records.length === 0) {
            setUploadMessage("유효한 데이터가 없습니다.", true);
            return;
          }

          // 진행상황 표시를 위한 모달 생성
          const progressModal = createProgressModal('CSV 업로드 진행 중...', '업로드 준비 중...');
          document.body.appendChild(progressModal);

          // 기존 데이터와 병합하여 누적값 계산
          const existingRecords = await DB.loadRecords();
          const mergedRecords = mergeAndCalculateCumulative(existingRecords, records);
          
          // DB에 저장 (진행상황 표시)
          let uploadedCount = 0;
          for (let i = 0; i < mergedRecords.length; i++) {
            const record = mergedRecords[i];
            try {
              await DB.addRecord(record);
              uploadedCount++;
              
              // 진행상황 업데이트
              updateProgress(progressModal, uploadedCount, mergedRecords.length, `업로드 중... ${uploadedCount}/${mergedRecords.length}`);
              
              // 잠시 대기 (너무 빠른 업로드 방지)
              await new Promise(resolve => setTimeout(resolve, 50));
            } catch (error) {
              console.error(`레코드 업로드 실패:`, error);
            }
          }

          // 모달 제거
          progressModal.remove();
          
          setUploadMessage(`${records.length}개의 레코드가 성공적으로 업로드되었습니다.`);
          uploadForm.reset();
          
          // 업로드된 데이터 중 가장 이른 날짜 이후의 모든 데이터에 대해 누적값 재계산
          if (mergedRecords.length > 0) {
            const earliestDate = mergedRecords.reduce((earliest, record) => 
              record.date < earliest ? record.date : earliest, mergedRecords[0].date);
            
            // 누적값 재계산 진행상태 표시
            const recalcModal = createProgressModal('누적값 재계산 중...', '계산 중...');
            document.body.appendChild(recalcModal);
            
            try {
              await recalculateCumulativeFromDate(earliestDate, recalcModal);
              recalcModal.remove();
            } catch (error) {
              recalcModal.remove();
              console.error('누적값 재계산 실패:', error);
              showStatusMessage('누적값 재계산 실패', 'error');
            }
          }
          
          // 업로드 완료 후 바로 조회 화면으로 이동하고 조회 버튼 활성화
          await showGridAndRefresh();
        } catch (error) {
          console.error('CSV 업로드 실패:', error);
          setUploadMessage(`업로드 실패: ${error.message}`, true);
        }
      }
    });

    registerBtn.addEventListener("click", async () => {
      // 모든 버튼에서 active 클래스 제거
      clearActiveButtons();
      // 등록 버튼 활성화
      registerBtn.classList.add('active');
      
      showForm();
      // Defer to ensure element is visible before invoking picker
      requestAnimationFrame(() => {
        dateInput.focus();
        if (typeof dateInput.showPicker === "function") {
          try {
            dateInput.showPicker();
          } catch {
            // Fallback for browsers without showPicker or if it throws
            dateInput.click();
          }
        } else {
          // Generic fallback
          dateInput.click();
        }
      });
    });

    listBtn.addEventListener("click", async () => {
      // 모든 버튼에서 active 클래스 제거
      clearActiveButtons();
      // 조회 버튼 활성화
      listBtn.classList.add('active');
      
      showGrid();
      
      // 항상 현재 년월로 설정
      const now = new Date();
      selectedYear = now.getFullYear();
      selectedMonth = now.getMonth() + 1;
      updateMonthDisplay();
      
      // 현재일자 페이지로 이동하기 위해 currentPage를 -1로 설정 (renderGrid에서 자동 계산)
      currentPage = -1;
      
      await renderGrid(false); // 현재일자 페이지로 이동
    });
    
    // 일괄삭제 버튼 이벤트 리스너
    batchDeleteBtn.addEventListener("click", async () => {
      const confirmDelete = window.confirm('Firebase에 저장된 모든 데이터를 삭제하시겠습니까?\n\n이 작업은 되돌릴 수 없습니다.');
      if (!confirmDelete) return;
      
      try {
        // 모든 레코드 로드
        const allRecords = await DB.loadRecords();
        if (allRecords.length === 0) {
          alert('삭제할 데이터가 없습니다.');
          return;
        }
        
        // 진행상황 표시를 위한 모달 생성
        const progressModal = createProgressModal('일괄삭제 진행 중...', '삭제 준비 중...');
        document.body.appendChild(progressModal);
        
        // 삭제 진행
        let deletedCount = 0;
        for (let i = 0; i < allRecords.length; i++) {
          const record = allRecords[i];
          if (record.id) {
            try {
              await DB.deleteRecord(record.id);
              deletedCount++;
              
              // 진행상황 업데이트
              updateProgress(progressModal, deletedCount, allRecords.length, `삭제 중... ${deletedCount}/${allRecords.length}`);
              
              // 잠시 대기 (너무 빠른 삭제 방지)
              await new Promise(resolve => setTimeout(resolve, 100));
            } catch (error) {
              console.error(`레코드 ${record.id} 삭제 실패:`, error);
            }
          }
        }
        
        // 모달 제거
        progressModal.remove();
        
        alert(`${deletedCount}개의 데이터가 성공적으로 삭제되었습니다.`);
        
        // 삭제 후 조회 화면으로 이동
        await showGridAndRefresh();
      } catch (error) {
        console.error('일괄삭제 실패:', error);
        alert(`삭제 실패: ${error.message}`);
      }
    });

    // 페이지네이션 버튼 이벤트 리스너
    prevPageBtn.addEventListener("click", async () => {
      console.log('이전 버튼 클릭, 현재 페이지:', currentPage);
      if (currentPage > 0) {
        currentPage--;
        console.log('이전 페이지로 이동:', currentPage);
        await renderGrid(true); // 페이지네이션 클릭 모드
      }
    });
    
    nextPageBtn.addEventListener("click", async () => {
      console.log('다음 버튼 클릭, 현재 페이지:', currentPage);
      const records = await DB.loadRecords();
      const filteredRecords = records.filter(record => {
        const recordDate = new Date(record.date);
        return recordDate.getFullYear() === selectedYear && 
               recordDate.getMonth() === selectedMonth - 1;
      });
      const sorted = [...filteredRecords].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
      const totalPages = Math.ceil(sorted.length / pageSize);
      
      console.log('총 페이지 수:', totalPages, '필터된 레코드 수:', filteredRecords.length);
      
      if (currentPage < totalPages - 1) {
        currentPage++;
        console.log('다음 페이지로 이동:', currentPage);
        await renderGrid(true); // 페이지네이션 클릭 모드
      }
    });
    
    // 커스텀 달력 이벤트 리스너
    monthDisplay.addEventListener("click", () => {
      monthCalendar.classList.toggle("hidden");
      updateCalendarDisplay();
    });
    
    // 월 선택 이벤트
    monthItems.forEach(item => {
      item.addEventListener("click", (e) => {
        e.stopPropagation();
        const month = parseInt(item.dataset.month);
        selectedMonth = month;
        updateMonthDisplay();
        monthCalendar.classList.add("hidden");
        currentPage = -1; // 선택 시 현재일자 페이지로 이동
        renderGrid(false); // 현재일자 페이지로 이동
      });
    });
    
    // 년도 선택 이벤트
    yearItems.forEach(item => {
      item.addEventListener("click", (e) => {
        e.stopPropagation();
        const year = parseInt(item.dataset.year);
        selectedYear = year;
        updateCalendarDisplay();
        updateMonthDisplay();
        monthCalendar.classList.add("hidden");
        currentPage = -1; // 선택 시 현재일자 페이지로 이동
        renderGrid(false); // 현재일자 페이지로 이동
      });
    });
    
    // 달력 외부 클릭 시 닫기
    document.addEventListener("click", (e) => {
      if (!monthDisplay.contains(e.target) && !monthCalendar.contains(e.target)) {
        monthCalendar.classList.add("hidden");
      }
    });

    // Input sanitization: allow digits and at most one decimal point with one digit
    planInput.addEventListener("input", () => {
      const sanitized = sanitizeHoursInput(planInput.value);
      if (planInput.value !== sanitized) {
        const pos = planInput.selectionStart || sanitized.length;
        planInput.value = sanitized;
        planInput.setSelectionRange(pos, pos);
      }
    });

    hoursInput.addEventListener("input", () => {
      const sanitized = sanitizeHoursInput(hoursInput.value);
      if (hoursInput.value !== sanitized) {
        const pos = hoursInput.selectionStart || sanitized.length;
        hoursInput.value = sanitized;
        hoursInput.setSelectionRange(pos, pos);
      }
    });

    uploadForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      // 파일 선택 시 자동으로 처리되므로 submit 이벤트는 무시
      return false;
    });

    studyForm.addEventListener("submit", async (e) => {
      e.preventDefault();

      clearMessage();
      const dateValue = dateInput.value;
      const planRaw = planInput.value.trim();
      const hoursRaw = hoursInput.value.trim();

      const validation = validateInputs(dateValue, planRaw, hoursRaw);
      if (!validation.ok) {
        setMessage(validation.message, true);
        return;
      }

      const planNumber = parseFloat(planRaw);
      const hoursNumber = parseFloat(hoursRaw);
      const normalizedPlan = Number.isNaN(planNumber) ? 0 : Math.round(planNumber * 10) / 10;
      const normalizedHours = Number.isNaN(hoursNumber) ? 0 : Math.round(hoursNumber * 10) / 10;

      try {
        // 기존 데이터 로드하여 중복일자 확인
        const existingRecords = await DB.loadRecords();
        const existingRecord = existingRecords.find(record => record.date === dateValue);
        
        if (existingRecord) {
          // 동일일자 데이터가 있으면 수정 처리
          const confirmUpdate = window.confirm(
            `${dateValue}에 이미 등록된 데이터가 있습니다.\n\n` +
            `기존: 계획 ${existingRecord.plan}시간, 실적 ${existingRecord.hours}시간\n` +
            `새로운: 계획 ${normalizedPlan}시간, 실적 ${normalizedHours}시간\n\n` +
            `수정하시겠습니까?`
          );
          
          if (confirmUpdate) {
            // 기존 데이터 삭제
            if (existingRecord.id) {
              await DB.deleteRecord(existingRecord.id);
            }
            
            // 새로운 데이터 추가
            const planCumulative = calculatePlanCumulative(existingRecords.filter(r => r.date !== dateValue), normalizedPlan);
            const hoursCumulative = calculateHoursCumulative(existingRecords.filter(r => r.date !== dateValue), normalizedHours);
            const percentage = planCumulative > 0 ? Math.round((hoursCumulative / planCumulative) * 1000) / 10 : 0;

            const record = {
              date: dateValue,
              plan: normalizedPlan,
              planCumulative: planCumulative,
              hours: normalizedHours,
              hoursCumulative: hoursCumulative,
              percentage: percentage
            };

            await DB.addRecord(record);
            studyForm.reset();
            setMessage("데이터가 수정되었습니다.");
            
            // 누적값 재계산 진행상태 표시
            const progressModal = createProgressModal('누적값 재계산 중...', '계산 중...');
            document.body.appendChild(progressModal);
            
            try {
              // 수정된 날짜 이후의 모든 데이터에 대해 누적값 재계산
              await recalculateCumulativeFromDate(dateValue, progressModal);
              progressModal.remove();
              
              // 수정 완료 후 자동으로 조회 화면으로 이동하고 조회 버튼 활성화
              await showGridAndRefresh();
            } catch (error) {
              progressModal.remove();
              console.error('누적값 재계산 실패:', error);
              showStatusMessage('누적값 재계산 실패', 'error');
            }
            return;
          } else {
            // 사용자가 취소한 경우
            return;
          }
        }

        // 새로운 데이터 추가 (기존 로직)
        const planCumulative = calculatePlanCumulative(existingRecords, normalizedPlan);
        const hoursCumulative = calculateHoursCumulative(existingRecords, normalizedHours);
        const percentage = planCumulative > 0 ? Math.round((hoursCumulative / planCumulative) * 1000) / 10 : 0;

        const record = {
          date: dateValue,
          plan: normalizedPlan,
          planCumulative: planCumulative,
          hours: normalizedHours,
          hoursCumulative: hoursCumulative,
          percentage: percentage
        };

        await DB.addRecord(record);
        studyForm.reset();
        setMessage("저장되었습니다.");
        
        // 누적값 재계산 진행상태 표시
        const progressModal = createProgressModal('누적값 재계산 중...', '계산 중...');
        document.body.appendChild(progressModal);
        
        try {
          // 등록된 날짜 이후의 모든 데이터에 대해 누적값 재계산
          await recalculateCumulativeFromDate(dateValue, progressModal);
          progressModal.remove();
          
          // 등록 완료 후 자동으로 조회 화면으로 이동하고 조회 버튼 활성화
          await showGridAndRefresh();
        } catch (error) {
          progressModal.remove();
          console.error('누적값 재계산 실패:', error);
          showStatusMessage('누적값 재계산 실패', 'error');
        }
      } catch (error) {
        console.error('데이터 저장 실패:', error);
        setMessage(`저장 실패: ${error.message}`, true);
      }
    });

    // Row interactions: checkbox toggle, edit, delete
    tbody.addEventListener("change", async (e) => {
      const target = e.target;
      if (target && target.matches('input.row-check')) {
        // 이벤트는 renderGrid에서 개별 체크박스에 추가되므로 여기서는 처리하지 않음
        return;
      }
    });

    tbody.addEventListener("click", async (e) => {
      const target = e.target;
      if (!(target instanceof HTMLElement)) return;
      if (target.closest('.edit-btn')) {
        const id = target.getAttribute('data-id');
        if (!id) return;
        // Load current values to prefill
        const records = await DB.loadRecords();
        const rec = records.find(r => String(r.id) === id);
        if (!rec) return;
        
        try {
          // 해당 행의 input 값 가져오기
          const tr = target.closest('tr');
          const planInput = tr.querySelector('.plan-input');
          const hoursInput = tr.querySelector('.hours-input');
          
          if (!planInput || !hoursInput) {
            showStatusMessage('입력 필드를 찾을 수 없습니다.', 'error');
            return;
          }
          
          // 입력값 검증
          const planRaw = planInput.value.trim();
          const hoursRaw = hoursInput.value.trim();
          
          if (!planRaw || !hoursRaw) {
            showStatusMessage('계획시간과 실적시간을 모두 입력해주세요.', 'error');
            return;
          }
          
          const validPattern = /^\d+(?:\.\d)?$/;
          if (!validPattern.test(planRaw) || !validPattern.test(hoursRaw)) {
            showStatusMessage('숫자만 입력, 소숫점은 1자리까지 가능합니다.', 'error');
            return;
          }
          
          const plan = parseFloat(planRaw);
          const hours = parseFloat(hoursRaw);
          if (!Number.isFinite(plan) || plan < 0 || !Number.isFinite(hours) || hours < 0) {
            showStatusMessage('0 이상의 숫자를 입력하세요.', 'error');
            return;
          }
          
          const normalizedPlan = Math.round(plan * 10) / 10;
          const normalizedHours = Math.round(hours * 10) / 10;
          
          // 누적값 재계산
          const allRecords = await DB.loadRecords();
          const otherRecords = allRecords.filter(r => String(r.id) !== id);
          const planCumulative = calculatePlanCumulative(otherRecords, normalizedPlan);
          const hoursCumulative = calculateHoursCumulative(otherRecords, normalizedHours);
          const percentage = planCumulative > 0 ? Math.round((hoursCumulative / planCumulative) * 1000) / 10 : 0;
          
          await DB.updateRecord(id, { 
            plan: normalizedPlan, 
            planCumulative: planCumulative,
            hours: normalizedHours, 
            hoursCumulative: hoursCumulative,
            percentage: percentage
          });
          
          // 누적값 재계산 진행상태 표시
          const progressModal = createProgressModal('누적값 재계산 중...', '계산 중...');
          document.body.appendChild(progressModal);
          
          try {
            // 수정된 날짜 이후의 모든 데이터에 대해 누적값 재계산
            await recalculateCumulativeFromDate(rec.date, progressModal);
            progressModal.remove();
            
            // 수정 완료 후 즉시 재조회 처리
            await showGridAndRefresh();
            
            // 수정 완료 메시지 표시
            showStatusMessage('데이터가 수정되었습니다.', 'success');
          } catch (error) {
            progressModal.remove();
            console.error('누적값 재계산 실패:', error);
            showStatusMessage('누적값 재계산 실패', 'error');
          }
        } catch (error) {
          console.error('데이터 수정 실패:', error);
          showStatusMessage(`수정 실패: ${error.message}`, 'error');
        }
      } else if (target.closest('.delete-btn')) {
        const id = target.getAttribute('data-id');
        if (!id) return;
        const ok = window.confirm('이 항목을 삭제하시겠습니까?');
        if (!ok) return;
        
        try {
          // 삭제 전에 레코드 정보 저장 (누적값 재계산용)
          const records = await DB.loadRecords();
          const rec = records.find(r => String(r.id) === id);
          if (!rec) return;
          
          await DB.deleteRecord(id);
          selectedIds.delete(id);
          
          // 누적값 재계산 진행상태 표시
          const progressModal = createProgressModal('누적값 재계산 중...', '계산 중...');
          document.body.appendChild(progressModal);
          
          try {
            // 삭제된 날짜 이후의 모든 데이터에 대해 누적값 재계산
            await recalculateCumulativeFromDate(rec.date, progressModal);
            progressModal.remove();
            
            // 삭제 완료 후 즉시 재조회 처리
            await showGridAndRefresh();
            
            // 삭제 완료 메시지 표시
            showStatusMessage('데이터가 삭제되었습니다.', 'success');
          } catch (error) {
            progressModal.remove();
            console.error('누적값 재계산 실패:', error);
            showStatusMessage('누적값 재계산 실패', 'error');
          }
        } catch (error) {
          console.error('데이터 삭제 실패:', error);
          showStatusMessage(`삭제 실패: ${error.message}`, 'error');
        }
      }
    });

    // Now perform async init and first render safely
    try {
      if (typeof DB.init === "function") {
        console.log('Firebase DB 초기화 시작...');
        
        // Firebase 상태 확인
        const firebaseStatus = window.checkFirebaseStatus();
        console.log('Firebase 상태:', firebaseStatus);
        
        if (!firebaseStatus.initialized) {
          console.log('Firebase가 초기화되지 않았습니다. 초기화를 시도합니다...');
          
          // Firebase 초기화 시도
          try {
            await window.initializeFirebase();
            console.log('Firebase 초기화 성공');
          } catch (initError) {
            console.warn('Firebase 초기화 실패:', initError);
            //showStatusMessage('Firebase 연결 실패로 로컬 스토리지를 사용합니다.', 'warning');
          }
        }
        
        await DB.init();
        console.log('Firebase DB 초기화 완료');
        
        // DB 상태 표시 - 실제 데이터 작업으로 확인
        if (DB.isRemote) {
          console.log('✅ Firebase 원격 DB 사용 중');
          //showStatusMessage('Firebase 원격 DB에 연결되었습니다.', 'success');
          
          // 실제 데이터 작업으로 연결 상태 재확인
          try {
            const testRecords = await DB.loadRecords();
            console.log('Firebase 데이터 로드 테스트 성공:', testRecords.length);
          } catch (testError) {
            console.warn('Firebase 데이터 로드 테스트 실패:', testError.message);
            
            // 권한 문제인 경우 사용자에게 안내
            if (testError.message.includes('permission') || testError.message.includes('권한')) {
              showStatusMessage('Firebase 연결됨, 권한 설정 필요 - firebase-setup-guide.md 확인', 'warning');
              setTimeout(() => {
                showStatusMessage('Firestore 규칙을 "allow read, write: if true;"로 설정하세요', 'info');
              }, 3000);
            } else {
              showStatusMessage('Firebase 연결됨, 일부 기능 제한될 수 있음', 'warning');
            }
          }
        } else {
          console.log('⚠️ 로컬 스토리지 사용 중');
          //showStatusMessage('Firebase 연결 실패로 로컬 스토리지를 사용합니다.', 'warning');
          
          // 로컬 스토리지 사용 시 추가 안내
          /*
          setTimeout(() => {
            //showStatusMessage('현재 로컬 스토리지 사용 중 - 데이터는 이 브라우저에만 저장됩니다.', 'info');
          }, 3000);
          */
          
          // Firebase 설정 안내
          /*
          setTimeout(() => {
            showStatusMessage('Firebase 설정: firebase-setup-guide.md 파일을 참조하세요', 'info');
          }, 6000);
          */
        }
      }
    } catch (e) {
      console.error("Firebase DB 초기화 실패:", e);
      
      // 사용자에게 친화적인 에러 메시지 표시
      const errorMessage = `
Firebase 초기화에 실패했습니다.

가능한 원인:
1. 인터넷 연결 확인
2. Firebase 프로젝트 설정 확인
3. Firestore 규칙 설정 확인 (firebase-setup-guide.md 참조)
4. 브라우저 캐시 삭제 후 재시도

에러 상세: ${e.message}
      `;
      
      alert(errorMessage);
      
      // 에러가 발생해도 앱은 계속 실행되도록 함
      console.warn('Firebase 초기화 실패로 인해 앱이 제한된 기능으로 실행됩니다.');
      //showStatusMessage('Firebase 연결 실패로 로컬 스토리지를 사용합니다.', 'warning');
    }

    // Init view: show grid by default
    showGrid();
    
    // 항상 현재일자 년월로 설정
    const now = new Date();
    selectedYear = now.getFullYear();
    selectedMonth = now.getMonth() + 1;
    updateMonthDisplay();
    
    // 초기 로드 시 조회 버튼 활성화
    listBtn.classList.add('active');
    
    // 초기 로드 시 모든 버튼 활성화
    registerBtn.disabled = false;
    listBtn.disabled = false;
    uploadBtn.disabled = false;
    batchDeleteBtn.disabled = false;
    
    // 초기 로드 시 현재일자 페이지로 이동하기 위해 currentPage를 -1로 설정
    currentPage = -1;
    
    try {
      await renderGrid(false); // 초기 로드 시 현재일자 페이지로 이동
    } catch (e) {
      console.error("초기 데이터 로드 실패:", e);
      alert(`데이터 로드 실패: ${e.message}\n\nFirebase 연결을 확인해주세요.`);
    }

    function showForm() {
      // 모든 섹션 숨기기
      formSection.classList.remove("hidden");
      gridSection.classList.add("hidden");
      uploadSection.classList.add("hidden");
      
      // 업로드 관련 상태 완전 클리어
      clearUploadMessage();
      uploadForm.reset();
      csvFileInput.value = '';
      
      // 선택된 행 초기화
      selectedIds.clear();
      
      // 등록 버튼 활성화
      clearActiveButtons();
      registerBtn.classList.add('active');
      
      // 모든 버튼 활성화
      registerBtn.disabled = false;
      listBtn.disabled = false;
      uploadBtn.disabled = false;
      batchDeleteBtn.disabled = false;
    }

    function showGrid() {
      // 모든 섹션 숨기기
      gridSection.classList.remove("hidden");
      formSection.classList.add("hidden");
      uploadSection.classList.add("hidden");
      
      // 업로드 관련 상태 완전 클리어
      clearUploadMessage();
      uploadForm.reset();
      csvFileInput.value = '';
      
      // 등록 폼 메시지 클리어
      clearMessage();
      
      // 체크박스 선택 상태 초기화
      selectedIds.clear();
      
      // 조회 버튼 활성화
      clearActiveButtons();
      listBtn.classList.add('active');
      
      // 모든 버튼 활성화 (일괄삭제 버튼도 포함)
      registerBtn.disabled = false;
      listBtn.disabled = false;
      uploadBtn.disabled = false;
      batchDeleteBtn.disabled = false;
    }

    function showUpload() {
      // 모든 섹션 숨기기
      uploadSection.classList.remove("hidden");
      formSection.classList.add("hidden");
      gridSection.classList.add("hidden");
      
      // 등록 폼 메시지 클리어
      clearMessage();
      
      // 업로드 버튼 활성화
      clearActiveButtons();
      uploadBtn.classList.add('active');
      
      // 모든 버튼 활성화
      registerBtn.disabled = false;
      listBtn.disabled = false;
      uploadBtn.disabled = false;
      batchDeleteBtn.disabled = false;
    }

    function clearActiveButtons() {
      registerBtn.classList.remove('active');
      listBtn.classList.remove('active');
      uploadBtn.classList.remove('active');
      batchDeleteBtn.classList.remove('active');
    }

    /** @param {string} value */
    function sanitizeHoursInput(value) {
      // Remove invalid chars
      let v = value.replace(/[^0-9.]/g, "");
      // Keep only first dot
      const firstDot = v.indexOf(".");
      if (firstDot !== -1) {
        v = v.slice(0, firstDot + 1) + v.slice(firstDot + 1).replace(/\./g, "");
      }
      // Allow at most one digit after decimal
      v = v.replace(/^(\d+)\.(\d)\d+$/, "$1.$2");
      // Remove leading zeros like 00 -> 0, but keep 0.x
      v = v.replace(/^0+(\d)/, "$1");
      return v;
    }

    /**
     * @param {string} dateValue
     * @param {string} planRaw
     * @param {string} hoursRaw
     * @returns {{ ok: true } | { ok: false; message: string }}
     */
    function validateInputs(dateValue, planRaw, hoursRaw) {
      if (!dateValue) return { ok: false, message: "학습날짜를 선택하세요." };
      if (!planRaw) return { ok: false, message: "계획시간을 입력하세요." };
      if (!hoursRaw) return { ok: false, message: "실적시간을 입력하세요." };
      
      // Strict pattern: integer or one decimal place
      const pattern = /^\d+(?:\.\d)?$/;
      if (!pattern.test(planRaw)) {
        return { ok: false, message: "계획시간은 숫자만 입력, 소숫점 1자리까지 가능합니다." };
      }
      if (!pattern.test(hoursRaw)) {
        return { ok: false, message: "실적시간은 숫자만 입력, 소숫점 1자리까지 가능합니다." };
      }
      
      const planNum = parseFloat(planRaw);
      const hoursNum = parseFloat(hoursRaw);
      if (Number.isNaN(planNum) || planNum < 0) {
        return { ok: false, message: "계획시간은 0 이상의 숫자를 입력하세요." };
      }
      if (Number.isNaN(hoursNum) || hoursNum < 0) {
        return { ok: false, message: "실적시간은 0 이상의 숫자를 입력하세요." };
      }
      return { ok: true };
    }

    /**
     * CSV 텍스트를 파싱하여 레코드 배열로 변환
     * @param {string} csvText 
     * @returns {StudyRecord[]}
     */
    function parseCSV(csvText) {
      const lines = csvText.trim().split('\n');
      const records = [];
      
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;
        
        // 헤더 행 건너뛰기
        if (i === 0 && (line.includes('학습일자') || line.includes('date'))) continue;
        
        const columns = line.split(',').map(col => col.trim());
        if (columns.length < 6) continue;
        
        try {
          const [date, plan, planCum, hours, hoursCum, percentage] = columns;
          
          // 날짜 형식 검증
          if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) continue;
          
          const record = {
            date: date,
            plan: Number(plan) || 0,
            planCumulative: Number(planCum) || 0,
            hours: Number(hours) || 0,
            hoursCumulative: Number(hoursCum) || 0,
            percentage: Number(percentage) || 0
          };
          
          records.push(record);
        } catch (e) {
          console.warn(`CSV 파싱 실패 (행 ${i + 1}):`, e);
        }
      }
      
      return records;
    }

    /**
     * 기존 데이터와 새 데이터를 병합하여 누적값 계산
     * @param {StudyRecord[]} existingRecords 
     * @param {StudyRecord[]} newRecords 
     * @returns {StudyRecord[]}
     */
    function mergeAndCalculateCumulative(existingRecords, newRecords) {
      // 날짜별로 기존 데이터 맵 생성
      const existingMap = new Map();
      existingRecords.forEach(record => {
        existingMap.set(record.date, record);
      });
      
      // 새 데이터와 병합
      const mergedRecords = [];
      let runningPlanCum = 0;
      let runningHoursCum = 0;
      
      // 기존 데이터의 누적값 계산
      const sortedExisting = [...existingRecords].sort((a, b) => a.date.localeCompare(b.date));
      for (const record of sortedExisting) {
        runningPlanCum += record.plan;
        runningHoursCum += record.hours;
        record.planCumulative = runningPlanCum;
        record.hoursCumulative = runningHoursCum;
        record.percentage = runningPlanCum > 0 ? Math.round((runningHoursCum / runningPlanCum) * 1000) / 10 : 0;
        mergedRecords.push(record);
      }
      
      // 새 데이터 추가 및 누적값 계산
      for (const record of newRecords) {
        if (!existingMap.has(record.date)) {
          runningPlanCum += record.plan;
          runningHoursCum += record.hours;
          record.planCumulative = runningPlanCum;
          record.hoursCumulative = runningHoursCum;
          record.percentage = runningPlanCum > 0 ? Math.round((runningHoursCum / runningPlanCum) * 1000) / 10 : 0;
          mergedRecords.push(record);
        }
      }
      
      return mergedRecords.sort((a, b) => a.date.localeCompare(b.date));
    }

    /**
     * 계획 누적값 계산
     * @param {StudyRecord[]} existingRecords 
     * @param {number} newPlan 
     * @returns {number}
     */
    function calculatePlanCumulative(existingRecords, newPlan) {
      const totalPlan = existingRecords.reduce((sum, record) => sum + record.plan, 0);
      return totalPlan + newPlan;
    }

    /**
     * 실적 누적값 계산
     * @param {StudyRecord[]} existingRecords 
     * @param {number} newHours 
     * @returns {number}
     */
    function calculateHoursCumulative(existingRecords, newHours) {
      const totalHours = existingRecords.reduce((sum, record) => sum + record.hours, 0);
      return totalHours + newHours;
    }

    /**
     * 특정 날짜 이후의 모든 데이터에 대해 누적값을 재계산하고 DB에 저장
     * @param {string} fromDate - 재계산 시작 날짜 (YYYY-MM-DD)
     * @param {HTMLDivElement} progressModal - 진행상태 모달 (선택사항)
     */
    async function recalculateCumulativeFromDate(fromDate, progressModal = null) {
      try {
        console.log(`${fromDate} 포함 이후 데이터 누적값 재계산 시작...`);
        
        // 모든 레코드를 날짜순으로 정렬
        const allRecords = await DB.loadRecords();
        const sortedRecords = [...allRecords].sort((a, b) => a.date.localeCompare(b.date));
        
        // 재계산 시작 인덱스 찾기 (해당 날짜 포함)
        const startIndex = sortedRecords.findIndex(record => record.date >= fromDate);
        if (startIndex === -1) {
          console.log('재계산할 데이터가 없습니다.');
          return;
        }
        
        // 재계산할 총 레코드 수
        const totalRecords = sortedRecords.length - startIndex;
        let processedCount = 0;
        
        // 재계산 시작 전까지의 누적값 계산
        let runningPlanCum = 0;
        let runningHoursCum = 0;
        
        for (let i = 0; i < startIndex; i++) {
          runningPlanCum += sortedRecords[i].plan;
          runningHoursCum += sortedRecords[i].hours;
        }
        
        // 재계산 시작 날짜부터 모든 데이터 업데이트 (해당 날짜 포함)
        for (let i = startIndex; i < sortedRecords.length; i++) {
          const record = sortedRecords[i];
          runningPlanCum += record.plan;
          runningHoursCum += record.hours;
          
          const newPlanCumulative = runningPlanCum;
          const newHoursCumulative = runningHoursCum;
          const newPercentage = runningPlanCum > 0 ? Math.round((runningHoursCum / runningPlanCum) * 1000) / 10 : 0;
          
          // 데이터가 변경된 경우에만 업데이트
          if (record.planCumulative !== newPlanCumulative || 
              record.hoursCumulative !== newHoursCumulative || 
              record.percentage !== newPercentage) {
            
            await DB.updateRecord(record.id, {
              planCumulative: newPlanCumulative,
              hoursCumulative: newHoursCumulative,
              percentage: newPercentage
            });
            
            console.log(`${record.date} 누적값 업데이트: 계획누적=${newPlanCumulative}, 실적누적=${newHoursCumulative}, 실적%=${newPercentage}%`);
          }
          
          // 진행상태 업데이트
          processedCount++;
          if (progressModal) {
            const percentage = Math.round((processedCount / totalRecords) * 100);
            updateProgress(progressModal, processedCount, totalRecords, 
              `누적값 재계산 중... ${processedCount}/${totalRecords} (${percentage}%)`);
            
            // 너무 빠른 진행 방지를 위한 짧은 대기
            await new Promise(resolve => setTimeout(resolve, 10));
          }
        }
        
        console.log('누적값 재계산 완료');
      } catch (error) {
        console.error('누적값 재계산 실패:', error);
        throw error;
      }
    }

    async function renderGrid(isPaginationClick = true) {
      const records = await DB.loadRecords();
      tbody.innerHTML = "";
      
      // 선택된 년월의 데이터만 필터링
      let filteredRecords = records;
      
      filteredRecords = records.filter(record => {
        const recordDate = new Date(record.date);
        return recordDate.getFullYear() === selectedYear && 
               recordDate.getMonth() === selectedMonth - 1;
      });
      
      if (filteredRecords.length === 0) {
        const tr = document.createElement("tr");
        tr.className = "empty-row";
        const td = document.createElement("td");
        td.colSpan = 7;
        td.textContent = "선택한 년월에 등록된 데이터가 없습니다.";
        tr.appendChild(td);
        tbody.appendChild(tr);
        paginationNav.classList.add("hidden");
        return;
      }

      // Sort by date desc for display (최신일자가 첫 번째로 표시)
      const sorted = [...filteredRecords].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));

      // 7일 단위로 페이지 계산
      const totalPages = Math.ceil(sorted.length / pageSize);
      
      console.log('renderGrid 호출:', { isPaginationClick, currentPage, totalPages, filteredRecordsLength: filteredRecords.length });
      
      // 페이지네이션 클릭이 아닌 경우에만 현재일자 페이지로 이동
      if (!isPaginationClick) {
        // 현재일자가 첫 번째 행에 표시되도록 페이지 계산
        const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD 형식
        const todayIndex = sorted.findIndex(record => record.date === today);
        
        if (todayIndex !== -1) {
          // 현재일자가 데이터에 있으면 해당 페이지로 설정
          currentPage = Math.floor(todayIndex / pageSize);
        } else {
          // 현재일자가 데이터에 없으면 첫 페이지로 설정
          currentPage = 0;
        }
        console.log('현재일자 페이지로 이동:', { today, todayIndex, calculatedPage: currentPage });
      }
      
      // 페이지 범위 검증
      if (currentPage < 0) currentPage = 0;
      if (currentPage >= totalPages) currentPage = totalPages - 1;
      
      console.log('최종 페이지 정보:', { currentPage, totalPages, startIndex: currentPage * pageSize });
      
      const startIndex = currentPage * pageSize;
      const endIndex = Math.min(startIndex + pageSize, sorted.length);
      const pageRecords = sorted.slice(startIndex, endIndex);

      // 현재 페이지의 레코드만 렌더링
      for (let i = 0; i < pageRecords.length; i++) {
        const rec = pageRecords[i];
        const tr = document.createElement("tr");
        tr.setAttribute('data-id', String(rec.id || ''));

        // checkbox
        const tdCheck = document.createElement('td');
        const cb = document.createElement('input');
        cb.type = 'checkbox';
        cb.className = 'row-check';
        cb.setAttribute('data-id', String(rec.id || ''));
        // 체크박스 선택 상태 초기화 (수정/삭제 후 재조회 시)
        cb.checked = false;
        
        // 체크박스 선택 상태에 따라 행에 data-selected 속성 설정
        if (cb.checked && rec.id) {
          tr.setAttribute('data-selected', 'true');
        }
        
        // 체크박스 변경 이벤트 리스너 추가
        cb.addEventListener("change", (e) => {
          const id = e.target.getAttribute('data-id');
          if (id) {
            if (e.target.checked) {
              selectedIds.add(id);
              tr.setAttribute('data-selected', 'true');
              // 체크박스 선택 시 해당 행의 계획, 실적을 편집 가능하게 만들기
              makeRowEditable(tr, rec);
            } else {
              selectedIds.delete(id);
              tr.removeAttribute('data-selected');
              // 체크박스 해제 시 편집 모드 해제
              makeRowNonEditable(tr, rec);
            }
            // 액션 버튼 토글
            toggleActionButtons(tr, e.target.checked, id);
          }
        });
        
        tdCheck.appendChild(cb);

        // date with weekday
        const tdDate = document.createElement("td");
        tdDate.textContent = formatDateWithWeekday(rec.date);

        // plan
        const tdPlan = document.createElement("td");
        const planInput = document.createElement("input");
        planInput.type = "text";
        planInput.value = formatHours(rec.plan);
        planInput.disabled = true; // 기본적으로 비활성화
        planInput.className = "plan-input";
        planInput.style.width = "60px";
        planInput.style.textAlign = "center";
        planInput.style.border = "1px solid #ccc";
        planInput.style.borderRadius = "4px";
        planInput.style.padding = "2px 4px";
        planInput.style.backgroundColor = "#f3f4f6";
        // input 이벤트 리스너 추가
        planInput.addEventListener("input", (e) => {
          const sanitized = sanitizeHoursInput(e.target.value);
          if (e.target.value !== sanitized) {
            const pos = e.target.selectionStart || sanitized.length;
            e.target.value = sanitized;
            e.target.setSelectionRange(pos, pos);
          }
        });
        tdPlan.appendChild(planInput);

        // plan cumulative
        const tdPlanCum = document.createElement("td");
        tdPlanCum.textContent = formatHours(rec.planCumulative);

        // hours
        const tdHours = document.createElement("td");
        const hoursInput = document.createElement("input");
        hoursInput.type = "text";
        hoursInput.value = formatHours(rec.hours);
        hoursInput.disabled = true; // 기본적으로 비활성화
        hoursInput.className = "hours-input";
        hoursInput.style.width = "60px";
        hoursInput.style.textAlign = "center";
        hoursInput.style.border = "1px solid #ccc";
        hoursInput.style.borderRadius = "4px";
        hoursInput.style.padding = "2px 4px";
        hoursInput.style.backgroundColor = "#f3f4f6";
        // input 이벤트 리스너 추가
        hoursInput.addEventListener("input", (e) => {
          const sanitized = sanitizeHoursInput(e.target.value);
          if (e.target.value !== sanitized) {
            const pos = e.target.selectionStart || sanitized.length;
            e.target.value = sanitized;
            e.target.setSelectionRange(pos, pos);
          }
        });
        tdHours.appendChild(hoursInput);

        // hours cumulative
        const tdHoursCum = document.createElement("td");
        tdHoursCum.textContent = formatHours(rec.hoursCumulative);

        // percentage
        const tdPercentage = document.createElement("td");
        tdPercentage.textContent = `${rec.percentage}%`;

        // actions
        const tdActions = document.createElement('td');
        tdActions.className = 'actions-cell';
        const isSelected = rec.id ? selectedIds.has(String(rec.id)) : false;
        if (isSelected) {
          toggleActionButtons(tr, true, String(rec.id));
        }
        
        // 호버 이벤트 직접 추가
        tr.addEventListener('mouseenter', () => {
          tr.style.backgroundColor = '#374151';
          tr.style.color = '#ffffff';
          Array.from(tr.children).forEach(td => {
            td.style.color = '#ffffff';
          });
        });
        
        tr.addEventListener('mouseleave', () => {
          if (!tr.hasAttribute('data-selected')) {
            tr.style.backgroundColor = '';
            tr.style.color = '';
            Array.from(tr.children).forEach(td => {
              td.style.color = '';
            });
          }
        });
        
        tr.append(tdCheck, tdDate, tdPlan, tdPlanCum, tdHours, tdHoursCum, tdPercentage, tdActions);
        tbody.appendChild(tr);
      }

      // 페이지네이션 업데이트 - filteredRecords를 매개변수로 전달
      updatePagination(totalPages, filteredRecords.length);
    }

    /** @param {string} dateIso */
    function formatDate(dateIso) {
      // Input from <input type="date"> is YYYY-MM-DD already
      return dateIso;
    }

    /** @param {string} dateIso */
    function formatDateWithWeekday(dateIso) {
      const date = new Date(dateIso);
      const weekdays = ['일', '월', '화', '수', '목', '금', '토'];
      const weekday = weekdays[date.getDay()];
      return `${dateIso} (${weekday})`;
    }

    /** @param {number} hours */
    function formatHours(hours) {
      return (Math.round(hours * 10) / 10).toFixed(1);
    }

    /** @param {number} totalPages @param {number} totalRecords */
    function updatePagination(totalPages, totalRecords) {
      if (totalPages <= 1) {
        paginationNav.classList.add("hidden");
        return;
      }

      paginationNav.classList.remove("hidden");
      
      // 페이지 정보 표시 (1부터 시작하는 페이지 번호)
      const currentPageDisplay = currentPage + 1;
      const startRecord = currentPage * pageSize + 1;
      const endRecord = Math.min((currentPage + 1) * pageSize, totalRecords);
      pageInfo.textContent = `${startRecord}-${endRecord} / ${totalRecords} (${currentPageDisplay}/${totalPages}페이지)`;
      
      // 버튼 활성화/비활성화
      prevPageBtn.disabled = currentPage === 0;
      nextPageBtn.disabled = currentPage >= totalPages - 1;
      
      // 버튼 스타일 조정
      prevPageBtn.classList.toggle("disabled", currentPage === 0);
      nextPageBtn.classList.toggle("disabled", currentPage >= totalPages - 1);
    }
    
    // 달력 표시 업데이트
    function updateCalendarDisplay() {
      yearDisplay.textContent = selectedYear;
      
      // 선택된 년도 하이라이트
      yearItems.forEach(item => {
        item.classList.toggle("selected", parseInt(item.dataset.year) === selectedYear);
      });
      
      // 선택된 월 하이라이트
      monthItems.forEach(item => {
        item.classList.toggle("selected", parseInt(item.dataset.month) === selectedMonth);
      });
    }
    
    // 월 표시 텍스트 업데이트
    function updateMonthDisplay() {
      currentMonthText.textContent = `${selectedYear}년 ${String(selectedMonth).padStart(2, '0')}월`;
    }

    function clearMessage() {
      formMessage.textContent = "";
      formMessage.classList.remove("error");
    }

    /** @param {string} msg @param {boolean} isError */
    function setMessage(msg, isError = false) {
      formMessage.textContent = msg;
      formMessage.classList.toggle("error", Boolean(isError));
    }

    function clearUploadMessage() {
      uploadMessage.textContent = "";
      uploadMessage.classList.remove("error");
    }

    /** @param {string} msg @param {boolean} isError */
    function setUploadMessage(msg, isError = false) {
      uploadMessage.textContent = msg;
      uploadMessage.classList.toggle("error", Boolean(isError));
    }

    async function showGridAndRefresh() {
      // 조회 화면으로 이동
      showGrid();
      
      // 체크박스 선택 상태 초기화
      selectedIds.clear();
      
      // 모든 행의 편집 모드 해제
      const allRows = tbody.querySelectorAll('tr');
      allRows.forEach(row => {
        if (row.hasAttribute('data-selected')) {
          row.removeAttribute('data-selected');
        }
        // 편집 모드 해제
        const planInput = row.querySelector('.plan-input');
        const hoursInput = row.querySelector('.hours-input');
        if (planInput) {
          planInput.disabled = true;
          planInput.classList.remove('editable-input');
          planInput.style.backgroundColor = '#f3f4f6';
          planInput.style.borderColor = '#ccc';
        }
        if (hoursInput) {
          hoursInput.disabled = true;
          hoursInput.classList.remove('editable-input');
          hoursInput.style.backgroundColor = '#f3f4f6';
          hoursInput.style.borderColor = '#ccc';
        }
      });
      
      // 데이터 새로고침 (현재일자 페이지로 이동)
      await renderGrid(false);
      
      // 조회 버튼 활성화
      clearActiveButtons();
      listBtn.classList.add('active');
      
      // 성공 메시지 표시 (잠시 후 사라짐)
      setTimeout(() => {
        clearUploadMessage();
      }, 3000);
      
      console.log('자동 조회 화면 이동 완료 - 갱신된 데이터 표시');
    }

    /**
     * 액션 버튼을 토글하는 함수
     * @param {HTMLElement} tr - 테이블 행 요소
     * @param {boolean} isChecked - 체크박스 선택 상태
     * @param {string} id - 레코드 ID
     */
    function toggleActionButtons(tr, isChecked, id) {
      const actionsTd = tr.querySelector('td.actions-cell');
      if (actionsTd) {
        actionsTd.innerHTML = '';
        if (isChecked) {
          const editBtn = document.createElement('button');
          editBtn.type = 'button';
          editBtn.className = 'btn edit-btn';
          editBtn.textContent = '수정';
          editBtn.setAttribute('data-id', String(id));
          
          const delBtn = document.createElement('button');
          delBtn.type = 'button';
          delBtn.className = 'btn delete-btn';
          delBtn.textContent = '삭제';
          delBtn.style.marginLeft = '6px';
          delBtn.setAttribute('data-id', String(id));
          
          actionsTd.append(editBtn, delBtn);
        }
      }
    }

    /**
     * 행을 편집 가능하게 만드는 함수
     * @param {HTMLElement} tr - 테이블 행 요소
     * @param {StudyRecord} rec - 레코드 객체
     */
    function makeRowEditable(tr, rec) {
      const planInput = tr.querySelector('.plan-input');
      const hoursInput = tr.querySelector('.hours-input');

      if (planInput) {
        planInput.disabled = false;
        planInput.classList.add('editable-input');
        planInput.style.backgroundColor = '#ffffff';
        planInput.style.borderColor = '#3b82f6';
      }
      if (hoursInput) {
        hoursInput.disabled = false;
        hoursInput.classList.add('editable-input');
        hoursInput.style.backgroundColor = '#ffffff';
        hoursInput.style.borderColor = '#3b82f6';
      }
    }

    /**
     * 행을 편집 불가능하게 만드는 함수
     * @param {HTMLElement} tr - 테이블 행 요소
     * @param {StudyRecord} rec - 레코드 객체
     */
    function makeRowNonEditable(tr, rec) {
      const planInput = tr.querySelector('.plan-input');
      const hoursInput = tr.querySelector('.hours-input');

      if (planInput) {
        planInput.disabled = true;
        planInput.classList.remove('editable-input');
        planInput.style.backgroundColor = '#f3f4f6';
        planInput.style.borderColor = '#ccc';
      }
      if (hoursInput) {
        hoursInput.disabled = true;
        hoursInput.classList.remove('editable-input');
        hoursInput.style.backgroundColor = '#f3f4f6';
        hoursInput.style.borderColor = '#ccc';
      }
    }
  });
})();

/** 상태 메시지 표시 함수 */
function showStatusMessage(message, type = 'info') {
  // 기존 상태 메시지 제거
  const existingStatus = document.querySelector('.status-message');
  if (existingStatus) {
    existingStatus.remove();
  }
  
  // 새 상태 메시지 생성
  const statusDiv = document.createElement('div');
  statusDiv.className = `status-message status-${type}`;
  statusDiv.textContent = message;
  
  // 스타일 적용
  statusDiv.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    padding: 12px 20px;
    border-radius: 8px;
    color: white;
    font-weight: bold;
    z-index: 1000;
    box-shadow: 0 4px 12px rgba(0,0,0,0.3);
    max-width: 300px;
    word-wrap: break-word;
    font-size: 16px;
  `;
  
  // 타입별 색상
  if (type === 'success') {
    statusDiv.style.backgroundColor = '#10b981';
  } else if (type === 'warning') {
    statusDiv.style.backgroundColor = '#f59e0b';
  } else if (type === 'error') {
    statusDiv.style.backgroundColor = '#ef4444';
  } else {
    statusDiv.style.backgroundColor = '#3b82f6';
  }
  
  // 페이지에 추가
  document.body.appendChild(statusDiv);
  
  // 5초 후 자동 제거
  setTimeout(() => {
    if (statusDiv.parentNode) {
      statusDiv.remove();
    }
  }, 5000);
}

/**
 * 진행상황을 표시하는 모달을 생성하는 함수
 * @param {string} title - 모달 제목
 * @param {string} initialStatus - 초기 상태 메시지
 * @returns {HTMLDivElement}
 */
function createProgressModal(title, initialStatus = '처리 중...') {
  const modal = document.createElement('div');
  modal.className = 'progress-modal';
  modal.innerHTML = `
    <div class="modal-content">
      <h2>${title}</h2>
      <div class="progress-bar">
        <div class="progress-bar-fill"></div>
      </div>
      <p class="progress-status">${initialStatus}</p>
      <div class="progress-details">
        <span class="progress-count">0</span> / <span class="progress-total">0</span>
        <span class="progress-percentage">(0%)</span>
      </div>
    </div>
  `;
  return modal;
}

/**
 * 진행상황을 업데이트하는 함수
 * @param {HTMLDivElement} modal - 모달 요소
 * @param {number} current - 현재 처리된 항목 수
 * @param {number} total - 총 항목 수
 * @param {string} statusText - 표시할 상태 텍스트
 */
function updateProgress(modal, current, total, statusText) {
  const progressBarFill = modal.querySelector('.progress-bar-fill');
  const progressStatus = modal.querySelector('.progress-status');
  const progressCount = modal.querySelector('.progress-count');
  const progressTotal = modal.querySelector('.progress-total');
  const progressPercentage = modal.querySelector('.progress-percentage');
  
  if (progressBarFill) {
    const percentage = (current / total) * 100;
    progressBarFill.style.width = `${percentage}%`;
  }
  
  if (progressStatus) {
    progressStatus.textContent = statusText;
  }
  if (progressCount) {
    progressCount.textContent = current;
  }
  if (progressTotal) {
    progressTotal.textContent = total;
  }
  if (progressPercentage) {
    const percentage = (current / total) * 100;
    progressPercentage.textContent = `(${percentage.toFixed(0)}%)`;
  }
}


