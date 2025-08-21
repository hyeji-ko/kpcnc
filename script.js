(() => {

  /** @typedef {{ date: string; hours: number }} StudyRecord */

  document.addEventListener("DOMContentLoaded", async () => {
    const registerBtn = document.getElementById("registerBtn");
    const listBtn = document.getElementById("listBtn");
    const formSection = document.getElementById("formSection");
    const gridSection = document.getElementById("gridSection");
    const studyForm = document.getElementById("studyForm");
    const dateInput = document.getElementById("dateInput");
    const hoursInput = document.getElementById("hoursInput");
    const formMessage = document.getElementById("formMessage");
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

    // Provide robust DB fallback if db.js didn't load
    function getDB() {
      const LOCAL_KEY = "studyRecords";
      const localDB = {
        async init() { return false; },
        async loadRecords() {
          try {
            const raw = localStorage.getItem(LOCAL_KEY);
            if (!raw) return [];
            const parsed = JSON.parse(raw);
            if (!Array.isArray(parsed)) return [];
            return parsed
              .filter(Boolean)
              .map((r) => ({ date: String(r.date), hours: Number(r.hours) }))
              .filter((r) => r.date && Number.isFinite(r.hours));
          } catch { return []; }
        },
        async addRecord(record) {
          const rows = await this.loadRecords();
          rows.push(record);
          localStorage.setItem(LOCAL_KEY, JSON.stringify(rows));
        }
      };
      return (window.DB || localDB);
    }

    const DB = getDB();
    const selectedIds = new Set();
    
    // 페이지네이션 관련 변수
    let currentPage = 0;
    const pageSize = 7; // 7일 단위
    
    // 현재 선택된 년월
    let selectedYear = new Date().getFullYear();
    let selectedMonth = new Date().getMonth() + 1;

    // Attach listeners BEFORE any awaits so UI remains responsive
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
    hoursInput.addEventListener("input", () => {
      const sanitized = sanitizeHoursInput(hoursInput.value);
      if (hoursInput.value !== sanitized) {
        const pos = hoursInput.selectionStart || sanitized.length;
        hoursInput.value = sanitized;
        hoursInput.setSelectionRange(pos, pos);
      }
    });

    studyForm.addEventListener("submit", async (e) => {
      e.preventDefault();

      clearMessage();
      const dateValue = dateInput.value;
      const hoursRaw = hoursInput.value.trim();

      const validation = validateInputs(dateValue, hoursRaw);
      if (!validation.ok) {
        setMessage(validation.message, true);
        return;
      }

      const hoursNumber = parseFloat(hoursRaw);
      const normalizedHours = Number.isNaN(hoursNumber)
        ? null
        : Math.round(hoursNumber * 10) / 10; // keep one decimal

      if (normalizedHours === null) {
        setMessage("유효한 학습시간을 입력하세요.", true);
        return;
      }

      await DB.addRecord({ date: dateValue, hours: normalizedHours });
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
        // Load current hours to prefill
        const records = await DB.loadRecords();
        const rec = records.find(r => String(r.id) === id);
        const current = rec ? String(rec.hours) : '';
        const input = window.prompt('새 학습시간(소수 1자리까지):', current);
        if (input == null) return; // cancel
        const trimmed = input.trim();
        const validPattern = /^\d+(?:\.\d)?$/;
        if (!validPattern.test(trimmed)) {
          alert('숫자만 입력, 소숫점은 1자리까지 가능합니다.');
          return;
        }
        const num = parseFloat(trimmed);
        if (!Number.isFinite(num) || num < 0) {
          alert('0 이상의 숫자를 입력하세요.');
          return;
        }
        const normalized = Math.round(num * 10) / 10;
        await DB.updateRecord(id, { hours: normalized });
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
     * @param {string} hoursRaw
     * @returns {{ ok: true } | { ok: false; message: string }}
     */
    function validateInputs(dateValue, hoursRaw) {
      if (!dateValue) return { ok: false, message: "학습날짜를 선택하세요." };
      if (!hoursRaw) return { ok: false, message: "학습시간을 입력하세요." };
      // Strict pattern: integer or one decimal place
      const pattern = /^\d+(?:\.\d)?$/;
      if (!pattern.test(hoursRaw)) {
        return { ok: false, message: "숫자만 입력, 소숫점은 1자리까지 가능합니다." };
      }
      const num = parseFloat(hoursRaw);
      if (Number.isNaN(num) || num < 0) {
        return { ok: false, message: "0 이상의 숫자를 입력하세요." };
      }
      return { ok: true };
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
        td.colSpan = 5;
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

      // Compute cumulative from oldest to newest, then map back to sorted order
      const ascending = [...sorted].reverse();
      let running = 0;
      /** @type {Record<string, number>} */
      const cumByIndex = {};
      for (let i = 0; i < ascending.length; i++) {
        running = Math.round((running + ascending[i].hours) * 10) / 10;
        cumByIndex[String(i)] = running;
      }

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

        // hours
        const tdHours = document.createElement("td");
        tdHours.textContent = formatHours(rec.hours);

        // cumulative
        const tdCum = document.createElement("td");
        const globalIndex = startIndex + i;
        const idxInAsc = ascending.length - 1 - globalIndex; // map back to ascending index
        tdCum.textContent = formatHours(cumByIndex[String(idxInAsc)] || 0);

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

        tr.append(tdCheck, tdDate, tdHours, tdCum, tdActions);
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
      const endRecord = Math.min((currentPage + 1) * pageSize, sorted.length);
      pageInfo.textContent = `${startRecord}-${endRecord} / ${sorted.length}`;
      
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
  });
})();


