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
      await renderGrid();
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
      if (records.length === 0) {
        const tr = document.createElement("tr");
        tr.className = "empty-row";
        const td = document.createElement("td");
        td.colSpan = 3;
        td.textContent = "등록된 데이터가 없습니다.";
        tr.appendChild(td);
        tbody.appendChild(tr);
        return;
      }

      // Sort by date desc for display
      const sorted = [...records].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));

      // Compute cumulative from oldest to newest, then map back to sorted order
      const ascending = [...sorted].reverse();
      let running = 0;
      /** @type {Record<string, number>} */
      const cumByIndex = {};
      for (let i = 0; i < ascending.length; i++) {
        running = Math.round((running + ascending[i].hours) * 10) / 10;
        cumByIndex[String(i)] = running;
      }
      // Now render in sorted (newest first) order, pulling cumulative from reversed index
      for (let i = 0; i < sorted.length; i++) {
        const rec = sorted[i];
        const tr = document.createElement("tr");
        const tdDate = document.createElement("td");
        tdDate.textContent = formatDate(rec.date);
        const tdHours = document.createElement("td");
        tdHours.textContent = formatHours(rec.hours);
        const tdCum = document.createElement("td");
        const idxInAsc = ascending.length - 1 - i; // map back to ascending index
        tdCum.textContent = formatHours(cumByIndex[String(idxInAsc)] || 0);
        tr.append(tdDate, tdHours, tdCum);
        tbody.appendChild(tr);
      }
    }

    /** @param {string} dateIso */
    function formatDate(dateIso) {
      // Input from <input type="date"> is YYYY-MM-DD already
      return dateIso;
    }

    /** @param {number} hours */
    function formatHours(hours) {
      return (Math.round(hours * 10) / 10).toFixed(1);
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
