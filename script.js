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
    
    // 현재 선택된 년월
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

          // 기존 데이터와 병합하여 누적값 계산
          const existingRecords = await DB.loadRecords();
          const mergedRecords = mergeAndCalculateCumulative(existingRecords, records);
          
          // DB에 저장
          for (const record of mergedRecords) {
            await DB.addRecord(record);
          }

          setUploadMessage(`${records.length}개의 레코드가 성공적으로 업로드되었습니다.`);
          uploadForm.reset();
          
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
      currentPage = 0; // 조회 시 첫 페이지로 이동
      
      // 현재 년월로 설정
      const now = new Date();
      selectedYear = now.getFullYear();
      selectedMonth = now.getMonth() + 1;
      updateMonthDisplay();
      
      await renderGrid();
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
        
        // 삭제 진행
        let deletedCount = 0;
        for (const record of allRecords) {
          if (record.id) {
            await DB.deleteRecord(record.id);
            deletedCount++;
          }
        }
        
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
      if (currentPage > 0) {
        currentPage--;
        await renderGrid();
      }
    });
    
    nextPageBtn.addEventListener("click", async () => {
      currentPage++;
      await renderGrid();
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
        currentPage = 0;
        renderGrid();
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
        currentPage = 0;
        renderGrid();
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
        // 기존 데이터 로드하여 누적값 계산
        const existingRecords = await DB.loadRecords();
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
        
        // 등록 완료 후 조회 화면으로 이동하고 조회 버튼 활성화
        await showGridAndRefresh();
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
        
        const input = window.prompt('새 계획시간,실적시간 (소수 1자리까지, 쉼표로 구분):', `${rec.plan},${rec.hours}`);
        if (input == null) return; // cancel
        
        const parts = input.split(',').map(s => s.trim());
        if (parts.length !== 2) {
          alert('계획시간과 실적시간을 쉼표로 구분하여 입력하세요.');
          return;
        }
        
        const [planInput, hoursInput] = parts;
        const validPattern = /^\d+(?:\.\d)?$/;
        if (!validPattern.test(planInput) || !validPattern.test(hoursInput)) {
          alert('숫자만 입력, 소숫점은 1자리까지 가능합니다.');
          return;
        }
        
        const plan = parseFloat(planInput);
        const hours = parseFloat(hoursInput);
        if (!Number.isFinite(plan) || plan < 0 || !Number.isFinite(hours) || hours < 0) {
          alert('0 이상의 숫자를 입력하세요.');
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
        await renderGrid();
      } else if (target.closest('.delete-btn')) {
        const id = target.getAttribute('data-id');
        if (!id) return;
        const ok = window.confirm('이 항목을 삭제하시겠습니까?');
        if (!ok) return;
        await DB.deleteRecord(id);
        selectedIds.delete(id);
        await renderGrid();
      }
    });

    // Now perform async init and first render safely
    try {
      if (typeof DB.init === "function") {
        console.log('Firebase DB 초기화 시작...');
        await DB.init();
        console.log('Firebase DB 초기화 완료');
        
        // DB 상태 표시
        if (DB.isRemote) {
          console.log('✅ Firebase 원격 DB 사용 중');
          showStatusMessage('Firebase 원격 DB에 연결되었습니다.', 'success');
        } else {
          console.log('⚠️ 로컬 스토리지 사용 중');
          showStatusMessage('Firebase 연결 실패로 로컬 스토리지를 사용합니다. 설정 가이드를 확인하세요.', 'warning');
          
          // 로컬 스토리지 사용 시 추가 안내
          setTimeout(() => {
            showStatusMessage('현재 로컬 스토리지 사용 중 - 데이터는 이 브라우저에만 저장됩니다.', 'info');
          }, 3000);
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
3. 브라우저 캐시 삭제 후 재시도

에러 상세: ${e.message}
      `;
      
      alert(errorMessage);
      
      // 에러가 발생해도 앱은 계속 실행되도록 함
      console.warn('Firebase 초기화 실패로 인해 앱이 제한된 기능으로 실행됩니다.');
      showStatusMessage('Firebase 연결 실패로 로컬 스토리지를 사용합니다.', 'warning');
    }

    // Init view: show grid by default
    showGrid();
    updateMonthDisplay();
    
    // 초기 로드 시 조회 버튼 활성화
    listBtn.classList.add('active');
    
    // 초기 로드 시 모든 버튼 활성화
    registerBtn.disabled = false;
    listBtn.disabled = false;
    uploadBtn.disabled = false;
    batchDeleteBtn.disabled = false;
    
    try {
      await renderGrid();
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
      
      // 조회 버튼 활성화
      clearActiveButtons();
      listBtn.classList.add('active');
      
      // 등록버튼과 일괄삭제 버튼 비활성화
      registerBtn.disabled = true;
      batchDeleteBtn.disabled = true;
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

    async function renderGrid() {
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

      // Sort by date desc for display
      const sorted = [...filteredRecords].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));

      // 7일 단위로 페이지 계산
      const totalPages = Math.ceil(sorted.length / pageSize);
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
        cb.checked = rec.id ? selectedIds.has(String(rec.id)) : false;
        
        // 체크박스 선택 상태에 따라 행에 data-selected 속성 설정
        if (cb.checked && rec.id) {
          tr.setAttribute('data-selected', 'true');
        }
        
        // 체크박스 변경 이벤트 리스너 추가
        cb.addEventListener('change', (e) => {
          const id = e.target.getAttribute('data-id');
          if (id) {
            if (e.target.checked) {
              selectedIds.add(id);
              tr.setAttribute('data-selected', 'true');
            } else {
              selectedIds.delete(id);
              tr.removeAttribute('data-selected');
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
        tdPlan.textContent = formatHours(rec.plan);

        // plan cumulative
        const tdPlanCum = document.createElement("td");
        tdPlanCum.textContent = formatHours(rec.planCumulative);

        // hours
        const tdHours = document.createElement("td");
        tdHours.textContent = formatHours(rec.hours);

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
      
      // 페이지 정보 표시
      const startRecord = currentPage * pageSize + 1;
      const endRecord = Math.min((currentPage + 1) * pageSize, totalRecords);
      pageInfo.textContent = `${startRecord}-${endRecord} / ${totalRecords}`;
      
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
      
      // 데이터 새로고침
      await renderGrid();
      
      // 조회 버튼 활성화 (showGrid에서 이미 처리되지만 확실히 하기 위해)
      clearActiveButtons();
      listBtn.classList.add('active');
      
      // 성공 메시지 표시 (잠시 후 사라짐)
      setTimeout(() => {
        clearUploadMessage();
      }, 3000);
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


