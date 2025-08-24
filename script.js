(() => {

  /** @typedef {{ date: string; plan: number; planCumulative: number; hours: number; hoursCumulative: number; percentage: number }} StudyRecord */

  document.addEventListener("DOMContentLoaded", async () => {
    const registerBtn = document.getElementById("registerBtn");
    const listBtn = document.getElementById("listBtn");
    const uploadBtn = document.getElementById("uploadBtn");
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

    // Firebase 원격 DB를 우선적으로 사용하고, 실패 시 로컬 저장소로 fallback
    const DB = window.DB || {
      async init() { 
        console.log('DB 모듈이 로드되지 않았습니다. 로컬 저장소를 사용합니다.');
        return false; 
      },
      async loadRecords() {
        try {
          const raw = localStorage.getItem("studyRecords");
          if (!raw) return [];
          const parsed = JSON.parse(raw);
          if (!Array.isArray(parsed)) return [];
          return parsed
            .filter(Boolean)
            .map((r) => ({ 
              date: String(r.date), 
              plan: Number(r.plan || 0),
              planCumulative: Number(r.planCumulative || 0),
              hours: Number(r.hours || 0), 
              hoursCumulative: Number(r.hoursCumulative || 0),
              percentage: Number(r.percentage || 0)
            }))
            .filter((r) => r.date && Number.isFinite(r.plan) && Number.isFinite(r.planCumulative) && Number.isFinite(r.hours) && Number.isFinite(r.hoursCumulative) && Number.isFinite(r.percentage));
        } catch (e) {
          console.warn('로컬 저장소에서 데이터 로드 실패:', e);
          return [];
        }
      },
      async addRecord(record) {
        try {
          const rows = await this.loadRecords();
          rows.push(record);
          localStorage.setItem("studyRecords", JSON.stringify(rows));
          console.log('데이터가 로컬 저장소에 저장되었습니다:', record);
          return true;
        } catch (e) {
          console.error('데이터 저장 실패:', e);
          throw e;
        }
      }
    };

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

    registerBtn.addEventListener("click", async () => {
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
      showGrid();
      currentPage = 0; // 조회 시 첫 페이지로 이동
      
      // 현재 년월로 설정
      const now = new Date();
      selectedYear = now.getFullYear();
      selectedMonth = now.getMonth() + 1;
      updateMonthDisplay();
      
      await renderGrid();
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
      clearUploadMessage();
      
      const file = csvFileInput.files[0];
      if (!file) {
        setUploadMessage("CSV 파일을 선택해주세요.", true);
        return;
      }

      try {
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
        
        // 조회 화면으로 이동
        showGrid();
        await renderGrid();
      } catch (error) {
        console.error('CSV 업로드 실패:', error);
        setUploadMessage(`업로드 실패: ${error.message}`, true);
      }
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
      // Show list after save
      showGrid();
      await renderGrid();
    });

    // Row interactions: checkbox toggle, edit, delete
    tbody.addEventListener("change", async (e) => {
      const target = e.target;
      if (target && target.matches('input.row-check')) {
        const id = target.getAttribute('data-id');
        if (id) {
          if (target.checked) selectedIds.add(id); else selectedIds.delete(id);
          // Toggle actions inline for faster UX without full re-render
          const tr = target.closest('tr');
          if (tr) {
            const actionsTd = tr.querySelector('td.actions-cell');
            if (actionsTd) {
              actionsTd.innerHTML = '';
              if (target.checked) {
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
        }
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
        await DB.init();
      }
    } catch (e) {
      console.warn("DB init failed, continuing with local fallback if available", e);
    }

    // Init view: show grid by default
    showGrid();
    updateMonthDisplay();
    try {
      await renderGrid();
    } catch (e) {
      console.warn("Initial render failed", e);
    }

    function showForm() {
      formSection.classList.remove("hidden");
      gridSection.classList.add("hidden");
    }

    function showGrid() {
      gridSection.classList.remove("hidden");
      formSection.classList.add("hidden");
    }

    function showUpload() {
      uploadSection.classList.remove("hidden");
      formSection.classList.add("hidden");
      gridSection.classList.add("hidden");
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
          const editBtn = document.createElement('button');
          editBtn.type = 'button';
          editBtn.className = 'btn edit-btn';
          editBtn.textContent = '수정';
          editBtn.setAttribute('data-id', String(rec.id));
          const delBtn = document.createElement('button');
          delBtn.type = 'button';
          delBtn.className = 'btn delete-btn';
          delBtn.textContent = '삭제';
          delBtn.style.marginLeft = '6px';
          delBtn.setAttribute('data-id', String(rec.id));
          tdActions.append(editBtn, delBtn);
        }

        tr.append(tdCheck, tdDate, tdPlan, tdPlanCum, tdHours, tdHoursCum, tdPercentage, tdActions);
        tbody.appendChild(tr);
      }

      // 페이지네이션 업데이트
      updatePagination(totalPages);
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

    /** @param {number} totalPages */
    function updatePagination(totalPages) {
      if (totalPages <= 1) {
        paginationNav.classList.add("hidden");
        return;
      }

      paginationNav.classList.remove("hidden");
      
      // 페이지 정보 표시
      const startRecord = currentPage * pageSize + 1;
      const endRecord = Math.min((currentPage + 1) * pageSize, filteredRecords.length);
      pageInfo.textContent = `${startRecord}-${endRecord} / ${filteredRecords.length}`;
      
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
  });
})();


