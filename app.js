// 전사 신기술 세미나 실행계획 웹앱 메인 JavaScript

class SeminarPlanningApp {
    constructor() {
        this.currentData = {
            session: '',
            objective: '',
            datetime: '',
            location: '',
            attendees: '',
            timeSchedule: [],
            attendeeList: []
        };
        
        this.currentDocumentId = null; // Firebase 문서 ID 저장
        this.originalSession = null; // 원본 회차 저장
        this.originalDatetime = null; // 원본 일시 저장
        
        // 라이브러리 로딩 상태 확인 및 초기화
        this.initializeApp().catch(error => {
            console.error('앱 초기화 오류:', error);
        });
    }
    
    async initializeApp() {
        await this.checkLibraries();
        await this.init();
    }

    

    // 라이브러리 상태 확인
    async checkLibraries() {
        let attempts = 0;
        const maxAttempts = 30;
        
        while (attempts < maxAttempts) {
            if (window.exportLibraries) {
                break;
            }
            await new Promise(resolve => setTimeout(resolve, 100));
            attempts++;
        }
    }
    
    // 라이브러리 존재 여부 확인
    getLibrary(name) {
        if (window.exportLibraries && window.exportLibraries[name]) {
            return true;
        }
        
        if (name === 'jsPDF' && (window.jsPDF || window.jspdf?.jsPDF)) {
            return true;
        }
        if (name === 'saveAs' && window.saveAs) {
            return true;
        }
        
        return false;
    }

    // 라이브러리 인스턴스 반환
    getLibraryInstance(name) {
        if (window.exportLibraries && !window.exportLibraries[name]) {
            return null;
        }
        
        if (name === 'jsPDF') {
            if (window.jsPDF) return window.jsPDF;
            if (window.jspdf?.jsPDF) return window.jspdf.jsPDF;
        }
        
        if (name === 'saveAs' && window.saveAs) {
            return window.saveAs;
        }
        
        return null;
    }

    async init() {
        this.bindEvents();
        await this.loadInitialData();
        this.addDefaultRows();
        
        // 초기화 시 스케치 버튼 상태 확인
        setTimeout(() => {
            this.toggleQuickSaveSketchButton();
        }, 100);
    }

    bindEvents() {
        // 초기화 버튼
        document.getElementById('resetBtn').addEventListener('click', () => this.resetForm());
        
        // 저장 버튼
        document.getElementById('saveBtn').addEventListener('click', () => this.saveData());
        
        // 삭제 버튼
        document.getElementById('deleteBtn').addEventListener('click', () => this.deleteData());
        
        // 조회 버튼
        document.getElementById('loadBtn').addEventListener('click', () => this.showSearchModal());
        
        
        // 시간 계획 행 추가
        document.getElementById('addTimeRow').addEventListener('click', () => this.addTimeRow());
        
        // 참석자 행 추가
        document.getElementById('addAttendeeRow').addEventListener('click', () => this.addAttendeeRow());
        
        // 참석자 전체 삭제
        const deleteAllBtn = document.getElementById('deleteAllAttendees');
        if (deleteAllBtn) {
            deleteAllBtn.addEventListener('click', () => this.deleteAllAttendees());
        }
        
        // 참석전체 Y 처리 버튼
        document.getElementById('selectAllAttendees').addEventListener('click', () => this.selectAllAttendees());
        
        
        // 내보내기 버튼들
        document.getElementById('exportPDF').addEventListener('click', () => this.exportToPDF());
        document.getElementById('exportResultPDF').addEventListener('click', () => this.exportResultToPDF());
        
        
        // 메인화면 실시결과 스케치 이벤트는 동적 이벤트 위임으로 처리
        
        // 스케치 업로드 추가 버튼
        document.getElementById('addSketchUpload').addEventListener('click', () => this.addSketchUpload());
        
        // 스케치 관련 이벤트 위임
        document.addEventListener('click', (e) => {
            // 스케치 삭제 버튼
            if (e.target.closest('.removeSketchBtn')) {
                const removeBtn = e.target.closest('.removeSketchBtn');
                const sketchIndex = removeBtn.getAttribute('data-sketch-index');
                this.removeSketchUpload(parseInt(sketchIndex));
            }
            // 파일 업로드 영역 클릭
            else if (e.target.closest('[id^="mainFileUploadArea"]')) {
                const uploadArea = e.target.closest('[id^="mainFileUploadArea"]');
                const sketchIndex = uploadArea.id.replace('mainFileUploadArea', '');
                const fileInput = document.getElementById(`mainSketchFile${sketchIndex}`);
                if (fileInput) fileInput.click();
            }
            // 파일 다운로드 버튼
            else if (e.target.closest('[id^="mainDownloadFile"]')) {
                const downloadBtn = e.target.closest('[id^="mainDownloadFile"]');
                const sketchIndex = downloadBtn.id.replace('mainDownloadFile', '');
                this.downloadMainFile(parseInt(sketchIndex));
            }
            // 파일 제거 버튼
            else if (e.target.closest('[id^="mainRemoveFile"]')) {
                const removeBtn = e.target.closest('[id^="mainRemoveFile"]');
                const sketchIndex = removeBtn.id.replace('mainRemoveFile', '');
                this.removeMainFile(parseInt(sketchIndex));
            }
        });
        
        // 파일 업로드 이벤트 위임
        document.addEventListener('change', (e) => {
            if (e.target.matches('[id^="mainSketchFile"]')) {
                const fileInput = e.target;
                const sketchIndex = fileInput.id.replace('mainSketchFile', '');
                this.handleMainFileUpload(e, parseInt(sketchIndex));
            }
        });
        
        // 메인화면 실시결과 저장 버튼
        //document.getElementById('saveMainResultBtn').addEventListener('click', () => this.saveMainResultData());
             
        // 입력 필드 변경 감지
        this.bindInputEvents();
        
        // 세미나 정보 변경 시 실시결과 데이터 자동 로드
        this.bindResultDataEvents();
    }

    bindResultDataEvents() {
        // 세미나 정보 변경 시 실시결과 데이터 자동 로드
        const sessionSelect = document.getElementById('sessionSelect');
        const sessionInput = document.getElementById('sessionInput');
        const datetime = document.getElementById('datetime');
        
        if (sessionSelect) {
            sessionSelect.addEventListener('change', () => {
                setTimeout(() => this.loadMainResultData(), 100);
            });
        }
        
        if (sessionInput) {
            sessionInput.addEventListener('change', () => {
                setTimeout(() => this.loadMainResultData(), 100);
            });
        }
        
        if (datetime) {
            datetime.addEventListener('change', () => {
                setTimeout(() => this.loadMainResultData(), 100);
            });
        }
    }

    bindInputEvents() {
        // 기본 정보 입력 필드들
        const basicFields = ['objective', 'location', 'attendees'];
        basicFields.forEach(field => {
            const element = document.getElementById(field);
            if (element) {
                element.addEventListener('input', (e) => {
                    this.currentData[field] = e.target.value;
                });
            }
        });
        
        // 일시 필드에 대한 처리
        const datetimeElement = document.getElementById('datetime');
        if (datetimeElement) {
            datetimeElement.addEventListener('input', (e) => {
                this.currentData.datetime = e.target.value;
            });
        }
        
        // 주요 내용 필드에 대한 특별한 처리 (PDF 실시결과 내보내기 버튼 제어)
        const mainContentElement = document.getElementById('mainResultContent');
        if (mainContentElement) {
            mainContentElement.addEventListener('input', (e) => {
                this.toggleExportResultPDFButton();
            });
            
            mainContentElement.addEventListener('blur', (e) => {
                this.toggleExportResultPDFButton();
            });
        }
    }
    
    // PDF 실시결과 내보내기 버튼 표시/숨김 제어
    toggleExportResultPDFButton() {
        const mainContentElement = document.getElementById('mainResultContent');
        const exportResultPDFButton = document.getElementById('exportResultPDF');
        
        if (mainContentElement && exportResultPDFButton) {
            const hasContent = mainContentElement.value.trim().length > 0;
            
            if (hasContent) {
                exportResultPDFButton.style.display = 'flex';
            } else {
                exportResultPDFButton.style.display = 'none';
            }
        }
    }
    
    // 빠른 저장 버튼 상태 관리
    toggleQuickSaveButtons() {
        const mainContentElement = document.getElementById('mainResultContent');
        const quickSaveResultBtn = document.getElementById('quickSaveResultBtn');
        
        if (mainContentElement && quickSaveResultBtn) {
            const hasContent = mainContentElement.value.trim().length > 0;
            
            if (hasContent) {
                quickSaveResultBtn.style.display = 'flex';
            } else {
                quickSaveResultBtn.style.display = 'none';
            }
        }
    }
    
    // 스케치 빠른 저장 버튼 상태 관리
    toggleQuickSaveSketchButton() {
        const quickSaveSketchBtn = document.getElementById('quickSaveSketchBtn');
        
        if (quickSaveSketchBtn) {
            // 스케치 정보가 변경되었는지 확인
            const hasSketchChanges = this.hasSketchChanges();
            
            if (hasSketchChanges) {
                quickSaveSketchBtn.style.display = 'flex';
            } else {
                quickSaveSketchBtn.style.display = 'none';
            }
        }
    }
    
    // 스케치 정보 변경 여부 확인
    hasSketchChanges() {
        const container = document.getElementById('sketchUploadContainer');
        const sketchElements = container.querySelectorAll('div[data-sketch-index]');
        
        let hasCurrentChanges = false;
        
        sketchElements.forEach((sketchElement) => {
            const sketchIndex = sketchElement.getAttribute('data-sketch-index');
            const title = document.getElementById(`mainSketchTitle${sketchIndex}`)?.value.trim() || '';
            const file = document.getElementById(`mainSketchFile${sketchIndex}`)?.files[0];
            
            if (title.length > 0 || file) {
                hasCurrentChanges = true;
            }
        });
        
        // currentData에 스케치 정보가 있는지 확인 (조회된 데이터가 있는 경우)
        const hasExistingSketchData = this.currentData && this.currentData.sketches && this.currentData.sketches.length > 0;
        
        // 현재 변경사항이 있거나 기존 스케치 데이터가 있으면 활성화
        return hasCurrentChanges || hasExistingSketchData;
    }
    

    async loadInitialData() {
        try {
            if (typeof window.loadData !== 'function') {
                return;
            }
            
            const result = await window.loadData();
            
            if (result.success) {
                const { id, ...dataWithoutId } = result.data;
                this.currentData = dataWithoutId;
                this.currentDocumentId = result.id;
                
                await this.populateForm();
            }
        } catch (error) {
            console.error('초기 데이터 로드 오류:', error);
        }
    }

    async populateForm() {
        if (!this.currentData) {
            return;
        }
        
        this.normalizeDataStructure();
        
        if (this.currentData.session) {
            this.populateSessionField();
        }
        
        const fieldMappings = [
            { key: 'objective', id: 'objective' },
            { key: 'datetime', id: 'datetime' },
            { key: 'location', id: 'location' },
            { key: 'attendees', id: 'attendees' }
        ];
        
        fieldMappings.forEach(mapping => {
            const value = this.currentData[mapping.key];
            const element = document.getElementById(mapping.id);
            
            if (element && value !== undefined && value !== null && value !== '') {
                element.value = value;
            }
        });

        this.populateTimeTable();
        this.populateAttendeeTable();
        
        await this.loadMainResultData();
        
        this.toggleExportResultPDFButton();
        this.toggleQuickSaveButtons();
    }

    addDefaultRows() {
        // 기본 시간 계획 행 추가 (직접 생성, addTimeRow() 호출하지 않음)
        if (this.currentData.timeSchedule.length === 0) {
            const tbody = document.getElementById('timeTableBody');
            const row = document.createElement('tr');
            row.className = 'table-row-hover';
            row.innerHTML = `
                <td class="px-4 py-3 border-b">
                    <select class="w-full px-2 py-1 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent" data-index="0" data-field="type">
                        <option value="">선택</option>
                        <option value="발표">발표</option>
                        <option value="토의">토의</option>
                        <option value="정리">정리</option>
                        <option value="석식">석식</option>
                        <option value="보고">보고</option>
                    </select>
                </td>
                <td class="px-4 py-3 border-b">
                    <textarea class="w-full px-2 py-1 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none" 
                              placeholder="주요 내용을 입력하세요 (엔터로 줄바꿈)" 
                              rows="2"
                              data-index="0" data-field="content"></textarea>
                </td>
                <td class="px-4 py-3 border-b">
                    <input type="text" class="w-full px-2 py-1 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent" 
                           placeholder="시간을 입력하세요 (예: 16:00)" 
                           data-index="0" data-field="time">
                </td>
                <td class="px-4 py-3 border-b">
                    <input type="text" class="w-full px-2 py-1 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent" 
                           placeholder="담당자를 입력하세요" 
                           data-index="0" data-field="responsible">
                </td>
                <td class="px-4 py-3 border-b">
                    <button onclick="app.removeTimeRow(0)" class="bg-red-500 hover:bg-red-600 text-white px-2 py-1 rounded text-sm transition-colors duration-200">
                        <i class="fas fa-trash"></i>
                    </button>
                </td>
            `;
            tbody.appendChild(row);
            
            // 이벤트 리스너 추가 (모바일 환경 고려)
            this.bindTimeRowEvents(row, 0);
            
            // 데이터 구조에 기본 행 추가
            this.currentData.timeSchedule[0] = {
                type: '',
                content: '',
                time: '',
                responsible: ''
            };
        }
        
        // 기본 참석자 행 추가 (직접 생성, addAttendeeRow() 호출하지 않음)
        if (this.currentData.attendeeList.length === 0) {
            const tbody = document.getElementById('attendeeTableBody');
            const row = document.createElement('tr');
            row.className = 'table-row-hover';
            row.innerHTML = `
                <td class="px-4 py-3 border-b text-center">1</td>
                <td class="px-4 py-3 border-b">
                    <input type="text" class="w-full px-2 py-1 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent" 
                           placeholder="성명을 입력하세요" 
                           data-index="0" data-field="name">
                </td>
                <td class="px-4 py-3 border-b">
                    <input type="text" class="w-full px-2 py-1 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent" 
                           placeholder="직급을 입력하세요" 
                           data-index="0" data-field="position">
                </td>
                <td class="px-4 py-3 border-b">
                    <input type="text" class="w-full px-2 py-1 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent" 
                           placeholder="소속을 입력하세요" 
                           data-index="0" data-field="department">
                </td>
                <td class="px-4 py-3 border-b">
                    <input type="text" class="w-full px-2 py-1 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent" 
                           placeholder="업무를 입력하세요" 
                           data-index="0" data-field="work">
                </td>
                <td class="px-4 py-3 border-b">
                    <select class="w-full px-2 py-1 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent" 
                            data-index="0" data-field="attendance">
                        <option value="Y">Y</option>
                        <option value="N" selected>N</option>
                    </select>
                </td>
                <td class="px-4 py-3 border-b">
                    <button onclick="app.removeAttendeeRow(0)" class="bg-red-500 hover:bg-red-600 text-white px-2 py-1 rounded text-sm transition-colors duration-200">
                        <i class="fas fa-trash"></i>
                    </button>
                </td>
            `;
            tbody.appendChild(row);
            
            // 이벤트 리스너 추가 (모바일 환경 고려)
            this.bindAttendeeRowEvents(row, 0);
            
            // 데이터 구조에 기본 행 추가
            this.currentData.attendeeList[0] = {
                name: '',
                position: '',
                department: '',
                work: '',
                attendance: 'N'  // 기본값 N으로 설정
            };
        }
    }

    addTimeRow() {
        const tbody = document.getElementById('timeTableBody');
        const rowCount = tbody.children.length;
        
        const row = document.createElement('tr');
        row.className = 'table-row-hover';
        row.innerHTML = `
            <td class="px-4 py-3 border-b">
                <select class="w-full px-2 py-1 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent" data-index="${rowCount}" data-field="type">
                    <option value="">선택</option>
                    <option value="발표">발표</option>
                    <option value="토의">토의</option>
                    <option value="정리">정리</option>
                    <option value="석식">석식</option>
                    <option value="보고">보고</option>
                </select>
            </td>
            <td class="px-4 py-3 border-b">
                <textarea class="w-full px-2 py-1 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none" 
                          placeholder="주요 내용을 입력하세요 (엔터로 줄바꿈)" 
                          rows="2"
                          data-index="${rowCount}" data-field="content"></textarea>
            </td>
            <td class="px-4 py-3 border-b">
                <input type="text" class="w-full px-2 py-1 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent" 
                       placeholder="시간을 입력하세요 (예: 16:00)" 
                       data-index="${rowCount}" data-field="time">
            </td>
            <td class="px-4 py-3 border-b">
                <input type="text" class="w-full px-2 py-1 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent" 
                       placeholder="담당자를 입력하세요" 
                       data-index="${rowCount}" data-field="responsible">
            </td>
            <td class="px-4 py-3 border-b">
                <button onclick="app.removeTimeRow(${rowCount})" class="bg-red-500 hover:bg-red-600 text-white px-2 py-1 rounded text-sm transition-colors duration-200">
                    <i class="fas fa-trash"></i>
                </button>
            </td>
        `;
        
        tbody.appendChild(row);
        
        // 이벤트 리스너 추가 (모바일 환경 고려)
        this.bindTimeRowEvents(row, rowCount);
        
        // 데이터 구조에 새 행 추가
        this.currentData.timeSchedule[rowCount] = {
            type: '',
            content: '',
            time: '',
            responsible: ''
        };
    }

    addAttendeeRow() {
        const tbody = document.getElementById('attendeeTableBody');
        const rowCount = tbody.children.length;
        
        const row = document.createElement('tr');
        row.className = 'table-row-hover';
        row.innerHTML = `
            <td class="px-4 py-3 border-b text-center">${rowCount + 1}</td>
            <td class="px-4 py-3 border-b">
                <input type="text" class="w-full px-2 py-1 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent" 
                       placeholder="성명을 입력하세요" 
                       data-field="name">
            </td>
            <td class="px-4 py-3 border-b">
                <input type="text" class="w-full px-2 py-1 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent" 
                       placeholder="직급을 입력하세요" 
                       data-field="position">
            </td>
            <td class="px-4 py-3 border-b">
                <input type="text" class="w-full px-2 py-1 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent" 
                       placeholder="소속을 입력하세요" 
                       data-field="department">
            </td>
            <td class="px-4 py-3 border-b">
                <input type="text" class="w-full px-2 py-1 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent" 
                       placeholder="업무를 입력하세요" 
                       data-field="work">
            </td>
            <td class="px-4 py-3 border-b">
                <select class="w-full px-2 py-1 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent" 
                        data-field="attendance">
                    <option value="Y">Y</option>
                    <option value="N" selected>N</option>
                </select>
            </td>
            <td class="px-4 py-3 border-b">
                <button onclick="app.removeAttendeeRow(${rowCount})" class="bg-red-500 hover:bg-red-600 text-white px-2 py-1 rounded text-sm transition-colors duration-200">
                    <i class="fas fa-trash"></i>
                </button>
            </td>
        `;
        
        tbody.appendChild(row);
        
        // 이벤트 리스너 추가 (모바일 환경 고려)
        this.bindAttendeeRowEvents(row, rowCount);
        
        // 직접입력 토글 이벤트는 bindAttendeeRowEvents에서 처리됨
        
        // 데이터 구조에 새 행 추가
        this.currentData.attendeeList[rowCount] = {
            name: '',
            position: '',
            department: '',
            work: '',
            attendance: 'N'  // 기본값 N으로 설정
        };
    }

    // 참석전체 Y 처리 함수
    selectAllAttendees() {
        
        const tbody = document.getElementById('attendeeTableBody');
        const rows = tbody.children;
        
        let updatedCount = 0;
        
        // 모든 참석자 행의 참석여부를 'Y'로 변경
        for (let i = 0; i < rows.length; i++) {
            const row = rows[i];
            const attendanceSelect = row.querySelector('select[data-field="attendance"]');
            
            if (attendanceSelect) {
                attendanceSelect.value = 'Y';
                updatedCount++;
                
                // 데이터 구조도 업데이트
                if (this.currentData.attendeeList[i]) {
                    this.currentData.attendeeList[i].attendance = 'Y';
                }
            }
        }
        
        // console.log(`참석전체 Y 처리 완료: ${updatedCount}명 업데이트`);
        
        // 성공 메시지 표시
        this.showSuccessToast(`${updatedCount}명의 참석여부가 'Y'로 변경되었습니다.`);
    }

    updateTimeSchedule(index, field, value) {
        if (this.currentData.timeSchedule[index]) {
            this.currentData.timeSchedule[index][field] = value;
        }
    }

    updateAttendeeList(index, field, value) {
        if (this.currentData.attendeeList[index]) {
            this.currentData.attendeeList[index][field] = value;
            // console.log(`참석자 데이터 업데이트: index=${index}, field=${field}, value=${value}`);
            // console.log(`업데이트 후 참석자 데이터:`, this.currentData.attendeeList[index]);
            
            // 참석여부 변경 시 즉시 저장 (백그라운드)
            if (field === 'attendance') {
                this.saveDataQuietly();
            }
        }
    }
    

    removeTimeRow(index) {
        const tbody = document.getElementById('timeTableBody');
        if (tbody.children.length > 1) {
            tbody.children[index].remove();
            this.currentData.timeSchedule.splice(index, 1);
            this.reorderTimeRows();
        }
    }

    removeAttendeeRow(index) {
        const tbody = document.getElementById('attendeeTableBody');
        if (tbody.children.length > 1) {
            tbody.children[index].remove();
            this.currentData.attendeeList.splice(index, 1);
            this.reorderAttendeeRows();
        }
    }

    // 참석자 전체 삭제 후 1행 초기화
    deleteAllAttendees() {
        const tbody = document.getElementById('attendeeTableBody');
        // 테이블 비우기
        while (tbody.firstChild) {
            tbody.removeChild(tbody.firstChild);
        }
        // 데이터도 초기화
        this.currentData.attendeeList = [];
        // 1행 추가 (초기값, 참석여부 기본 N)
        this.addAttendeeRow();
        this.showSuccessToast('참석자 명단을 초기화했습니다.');
    }

    reorderTimeRows() {
        const tbody = document.getElementById('timeTableBody');
        Array.from(tbody.children).forEach((row, index) => {
            const inputs = row.querySelectorAll('input, select');
            inputs.forEach(input => {
                input.onchange = (e) => {
                    this.updateTimeSchedule(index, this.getFieldName(input), e.target.value);
                };
            });
            
            const deleteBtn = row.querySelector('button');
            deleteBtn.onclick = () => this.removeTimeRow(index);
        });
    }

    reorderAttendeeRows() {
        const tbody = document.getElementById('attendeeTableBody');
        Array.from(tbody.children).forEach((row, index) => {
            // 번호 업데이트
            const numberCell = row.children[0];
            numberCell.textContent = index + 1;
            
            const inputs = row.querySelectorAll('input');
            inputs.forEach(input => {
                input.onchange = (e) => {
                    this.updateAttendeeList(index, this.getFieldName(input), e.target.value);
                };
            });
            
            const deleteBtn = row.querySelector('button');
            deleteBtn.onclick = () => this.removeAttendeeRow(index);
        });
    }

    getFieldName(input) {
        const placeholder = input.placeholder;
        if (placeholder.includes('성명')) return 'name';
        if (placeholder.includes('직급')) return 'position';
        if (placeholder.includes('소속')) return 'department';
        if (placeholder.includes('업무')) return 'work';
        if (placeholder.includes('주요 내용')) return 'content';
        if (placeholder.includes('시간')) return 'time';
        if (placeholder.includes('담당자')) return 'responsible';
        return '';
    }

    populateTimeTable() {
        const tbody = document.getElementById('timeTableBody');
        tbody.innerHTML = '';
        
        // console.log('시간 계획 데이터:', this.currentData.timeSchedule);
        // console.log('시간 계획 데이터 타입:', typeof this.currentData.timeSchedule);
        // console.log('시간 계획 데이터 길이:', this.currentData.timeSchedule ? this.currentData.timeSchedule.length : 'undefined');
        // console.log('시간 계획 데이터가 배열인가?', Array.isArray(this.currentData.timeSchedule));
        // console.log('시간 계획 데이터 키들:', this.currentData.timeSchedule ? Object.keys(this.currentData.timeSchedule) : 'undefined');
        
        if (!this.currentData.timeSchedule) {
            console.error('시간 계획 데이터가 undefined입니다.');
            return;
        }
        
        if (this.currentData.timeSchedule.length === 0) {
            // console.log('시간 계획 데이터가 비어있습니다.');
            return;
        }
        
        // console.log('시간 계획 테이블 렌더링 시작...');
        
        this.currentData.timeSchedule.forEach((item, index) => {
            // console.log(`시간 계획 아이템 처리 중: index=${index}, item=`, item);
            
            // 직접 행 생성 (addTimeRow() 호출하지 않음)
            const row = document.createElement('tr');
            row.className = 'table-row-hover';
            row.innerHTML = `
                <td class="px-4 py-3 border-b">
                    <select class="w-full px-2 py-1 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent" data-index="${index}" data-field="type">
                        <option value="">선택</option>
                        <option value="발표">발표</option>
                        <option value="토의">토의</option>
                        <option value="정리">정리</option>
                        <option value="석식">석식</option>
                        <option value="보고">보고</option>
                    </select>
                </td>
                <td class="px-4 py-3 border-b">
                    <textarea class="w-full px-2 py-1 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none" 
                              placeholder="주요 내용을 입력하세요 (엔터로 줄바꿈)" 
                              rows="2"
                              data-index="${index}" data-field="content"></textarea>
                </td>
                <td class="px-4 py-3 border-b">
                    <input type="text" class="w-full px-2 py-1 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent" 
                           placeholder="시간을 입력하세요 (예: 16:00)" 
                           data-index="${index}" data-field="time">
                </td>
                <td class="px-4 py-3 border-b">
                    <input type="text" class="w-full px-2 py-1 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent" 
                           placeholder="담당자를 입력하세요" 
                           data-index="${index}" data-field="responsible">
                </td>
                <td class="px-4 py-3 border-b">
                    <button onclick="app.removeTimeRow(${index})" class="bg-red-500 hover:bg-red-600 text-white px-2 py-1 rounded text-sm transition-colors duration-200">
                        <i class="fas fa-trash"></i>
                    </button>
                </td>
            `;
            
            tbody.appendChild(row);
            // console.log(`시간 계획 행 추가됨: index=${index}, type=${item.type}`);
            
            // 데이터 채우기 (모바일 환경 고려)
            const inputs = row.querySelectorAll('input, select, textarea');
            // console.log(`시간 계획 입력 요소들:`, inputs);
            
            // select 요소 (type)
            const typeSelect = row.querySelector('select[data-field="type"]');
            if (typeSelect && item.type !== undefined && item.type !== null) {
                typeSelect.value = item.type;
                // console.log(`시간 계획 select 값 설정: ${item.type}`);
                // 모바일에서 select 값이 제대로 설정되도록 강제 업데이트
                setTimeout(() => {
                    typeSelect.value = item.type;
                }, 10);
            }
            
            // textarea 요소 (content)
            const contentTextarea = row.querySelector('textarea[data-field="content"]');
            if (contentTextarea && item.content !== undefined && item.content !== null) {
                contentTextarea.value = item.content;
                contentTextarea.textContent = item.content;
                // console.log(`시간 계획 textarea 값 설정: ${item.content}`);
            }
            
            // input 요소 (time)
            const timeInput = row.querySelector('input[data-field="time"]');
            if (timeInput && item.time !== undefined && item.time !== null) {
                timeInput.value = item.time;
                timeInput.setAttribute('value', item.time);
                // console.log(`시간 계획 time 값 설정: ${item.time}`);
            }
            
            // input 요소 (responsible)
            const responsibleInput = row.querySelector('input[data-field="responsible"]');
            if (responsibleInput && item.responsible !== undefined && item.responsible !== null) {
                responsibleInput.value = item.responsible;
                responsibleInput.setAttribute('value', item.responsible);
                // console.log(`시간 계획 responsible 값 설정: ${item.responsible}`);
            }
            
            // 이벤트 리스너 추가 (모바일 환경 고려)
            this.bindTimeRowEvents(row, index);
            
            // console.log(`시간 계획 행 추가됨: index=${index}, type=${item.type}`);
            // console.log(`시간 계획 행 DOM 요소:`, row);
        });
        
        // console.log('시간 계획 테이블 렌더링 완료. 총 행 수:', tbody.children.length);
        // console.log('tbody 자식 요소들:', tbody.children);
    }
    
    // 시간 계획 행 이벤트 바인딩 (모바일 환경 고려)
    bindTimeRowEvents(row, index) {
        const inputs = row.querySelectorAll('input, select, textarea');
        inputs.forEach(input => {
            // 모바일에서 input 이벤트가 제대로 작동하도록 여러 이벤트 리스너 추가
            input.addEventListener('input', (e) => {
                this.updateTimeSchedule(index, input.dataset.field, e.target.value);
            });
            input.addEventListener('change', (e) => {
                this.updateTimeSchedule(index, input.dataset.field, e.target.value);
            });
            input.addEventListener('blur', (e) => {
                this.updateTimeSchedule(index, input.dataset.field, e.target.value);
            });
        });
    }
    
    // 참석자 행 이벤트 바인딩 (모바일 환경 고려)
    bindAttendeeRowEvents(row, index) {
        const inputs = row.querySelectorAll('input, select');
        inputs.forEach(input => {
            const fieldName = input.dataset.field;
            // 모바일에서 input 이벤트가 제대로 작동하도록 여러 이벤트 리스너 추가
            input.addEventListener('input', (e) => {
                this.updateAttendeeList(index, fieldName, e.target.value);
            });
            input.addEventListener('change', (e) => {
                this.updateAttendeeList(index, fieldName, e.target.value);
            });
            input.addEventListener('blur', (e) => {
                this.updateAttendeeList(index, fieldName, e.target.value);
            });
        });
    }

    // 데이터 구조 정규화 (Firebase 데이터 호환성)
    normalizeDataStructure() {
        // console.log('데이터 구조 정규화 시작');
        
        // timeSchedule 정규화
        if (this.currentData.timeSchedule) {
            if (typeof this.currentData.timeSchedule === 'object' && !Array.isArray(this.currentData.timeSchedule)) {
                // console.log('timeSchedule을 객체에서 배열로 변환');
                // Object.values() 대신 키 순서대로 배열 생성
                const keys = Object.keys(this.currentData.timeSchedule).sort((a, b) => parseInt(a) - parseInt(b));
                this.currentData.timeSchedule = keys.map(key => this.currentData.timeSchedule[key]);
                // console.log('변환된 timeSchedule:', this.currentData.timeSchedule);
            } else if (Array.isArray(this.currentData.timeSchedule)) {
                // console.log('timeSchedule은 이미 배열입니다:', this.currentData.timeSchedule.length, '개 항목');
            }
        } else {
            // console.log('timeSchedule이 없습니다. 빈 배열로 초기화');
            this.currentData.timeSchedule = [];
        }
        
        // attendeeList 정규화
        if (this.currentData.attendeeList) {
            if (typeof this.currentData.attendeeList === 'object' && !Array.isArray(this.currentData.attendeeList)) {
                // console.log('attendeeList를 객체에서 배열로 변환');
                // Object.values() 대신 키 순서대로 배열 생성
                const keys = Object.keys(this.currentData.attendeeList).sort((a, b) => parseInt(a) - parseInt(b));
                this.currentData.attendeeList = keys.map(key => this.currentData.attendeeList[key]);
                // console.log('변환된 attendeeList:', this.currentData.attendeeList);
            } else if (Array.isArray(this.currentData.attendeeList)) {
                // console.log('attendeeList는 이미 배열입니다:', this.currentData.attendeeList.length, '개 항목');
            }
        } else {
            // console.log('attendeeList가 없습니다. 빈 배열로 초기화');
            this.currentData.attendeeList = [];
        }
        
        // console.log('데이터 구조 정규화 완료');
        // console.log('정규화 후 timeSchedule:', this.currentData.timeSchedule);
        // console.log('정규화 후 attendeeList:', this.currentData.attendeeList);
        // console.log('정규화 후 attendeeList 상세:');
        this.currentData.attendeeList.forEach((item, index) => {
            // console.log(`  [${index}] name: ${item.name}, attendance: ${item.attendance}`);
        });
    }


    populateAttendeeTable() {
        const tbody = document.getElementById('attendeeTableBody');
        tbody.innerHTML = '';
        
        
        // console.log('참석자 데이터 전체:', this.currentData.attendeeList);
        // console.log('참석자 데이터 타입:', typeof this.currentData.attendeeList);
        // console.log('참석자 데이터 길이:', this.currentData.attendeeList ? this.currentData.attendeeList.length : 'undefined');
        // console.log('참석자 데이터가 배열인가?', Array.isArray(this.currentData.attendeeList));
        // console.log('참석자 데이터 키들:', this.currentData.attendeeList ? Object.keys(this.currentData.attendeeList) : 'undefined');
        
        if (!this.currentData.attendeeList) {
            console.error('참석자 데이터가 undefined입니다.');
            return;
        }
        
        if (this.currentData.attendeeList.length === 0) {
            // console.log('참석자 데이터가 비어있습니다.');
            return;
        }
        
        // console.log('참석자 테이블 렌더링 시작...');
        
        this.currentData.attendeeList.forEach((item, index) => {
            // console.log(`참석자 아이템 처리 중: index=${index}, item=`, item);
            // console.log(`참석여부 확인: index=${index}, name=${item.name}, attendance=${item.attendance}`);
            
            // 직접 행 생성 (addAttendeeRow() 호출하지 않음)
            const row = document.createElement('tr');
            row.className = 'table-row-hover';
            row.innerHTML = `
                <td class="px-4 py-3 border-b text-center">${index + 1}</td>
                <td class="px-4 py-3 border-b">
                    <input type="text" class="w-full px-2 py-1 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent" 
                           placeholder="성명을 입력하세요" 
                           data-field="name"
                           onchange="app.updateAttendeeList(${index}, 'name', this.value)">
                </td>
                <td class="px-4 py-3 border-b">
                    <input type="text" class="w-full px-2 py-1 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent" 
                           placeholder="직급을 입력하세요" 
                           data-field="position">
                </td>
                <td class="px-4 py-3 border-b">
                    <input type="text" class="w-full px-2 py-1 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent" 
                           placeholder="소속을 입력하세요" 
                           data-field="department"
                           onchange="app.updateAttendeeList(${index}, 'department', this.value)">
                </td>
                <td class="px-4 py-3 border-b">
                    <input type="text" class="w-full px-2 py-1 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent" 
                           placeholder="업무를 입력하세요" 
                           data-field="work">
                </td>
                <td class="px-4 py-3 border-b">
                    <select class="w-full px-2 py-1 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent" 
                            data-field="attendance"
                            onchange="app.updateAttendeeList(${index}, 'attendance', this.value)">
                        <option value="Y" ${item.attendance === 'Y' ? 'selected' : ''}>Y</option>
                        <option value="N" ${(item.attendance === 'N' || !item.attendance) ? 'selected' : ''}>N</option>
                    </select>
                </td>
                <td class="px-4 py-3 border-b">
                    <button onclick="app.removeAttendeeRow(${index})" class="bg-red-500 hover:bg-red-600 text-white px-2 py-1 rounded text-sm transition-colors duration-200">
                        <i class="fas fa-trash"></i>
                    </button>
                </td>
            `;
            
            tbody.appendChild(row);
            
            // 데이터 채우기 (모바일 환경 고려)
            const nameInput = row.querySelector('input[data-field="name"]');
            
            if (nameInput && item.name !== undefined && item.name !== null) {
                nameInput.value = item.name;
                nameInput.setAttribute('value', item.name);
                // console.log(`참석자 name 값 설정: ${item.name}`);
            }
            
            // 직급 필드 처리 (텍스트 입력)
            const positionInput = row.querySelector('[data-field="position"]');
            if (positionInput) {
                positionInput.value = item.position || '';
                positionInput.setAttribute('value', item.position || '');
            }
            
            // 소속 필드 처리 (텍스트 입력)
            const departmentInput = row.querySelector('[data-field="department"]');
            if (departmentInput) {
                departmentInput.value = item.department || '';
                departmentInput.setAttribute('value', item.department || '');
            }
            
            // 업무 필드 처리 (텍스트 입력)
            const workInput = row.querySelector('[data-field="work"]');
            if (workInput) {
                workInput.value = item.work || '';
                workInput.setAttribute('value', item.work || '');
            }
            
            // 참석여부 필드 처리
            const attendanceSelect = row.querySelector('select[data-field="attendance"]');
            if (attendanceSelect) {
                // 참석여부 값이 있으면 해당 값으로 설정, 없으면 기본값 'N'으로 설정
                const attendanceValue = (item.attendance !== undefined && item.attendance !== null && item.attendance !== '') ? item.attendance : 'N';
                // console.log(`참석여부 값 설정: index=${index}, attendanceValue=${attendanceValue}, item.attendance=${item.attendance}`);
                
                // 강제로 value 설정
                attendanceSelect.value = attendanceValue;
                
                // 모든 옵션의 selected 속성 제거
                const options = attendanceSelect.querySelectorAll('option');
                options.forEach(option => {
                    option.removeAttribute('selected');
                    option.selected = false;
                });
                
                // 해당 값의 옵션에 selected 속성 추가
                const targetOption = attendanceSelect.querySelector(`option[value="${attendanceValue}"]`);
                if (targetOption) {
                    targetOption.setAttribute('selected', 'selected');
                    targetOption.selected = true;
                }
                
                // 다시 한번 value 설정
                attendanceSelect.value = attendanceValue;
                
                // console.log(`참석여부 설정: index=${index}, value=${attendanceValue}, item.attendance=${item.attendance}`);
                
                // 참석여부 값이 제대로 설정되었는지 확인
                setTimeout(() => {
                    // console.log(`참석여부 확인: index=${index}, 실제값=${attendanceSelect.value}, 예상값=${attendanceValue}`);
                }, 100);
            }
            
            // 이벤트 리스너 추가 (모바일 환경 고려)
            this.bindAttendeeRowEvents(row, index);
            
            // 직접입력 토글 이벤트는 bindAttendeeRowEvents에서 처리됨
            
            // 행을 tbody에 추가
            tbody.appendChild(row);
            // console.log(`참석자 행 추가됨: index=${index}, name=${item.name}`);
            // console.log(`참석자 행 DOM 요소:`, row);
        });
        
        // console.log('참석자 테이블 렌더링 완료. 총 행 수:', tbody.children.length);
        // console.log('tbody 자식 요소들:', tbody.children);
    }

    async saveData() {
        try {
            // 필요한 함수들이 정의되어 있는지 확인
            if (typeof window.saveData !== 'function' || typeof window.updateData !== 'function') {
                this.showErrorToast('필요한 함수들이 정의되지 않았습니다. firebase-config.js가 로드되었는지 확인하세요.');
                return;
            }
            
            this.showLoading(true);
            
            // 현재 폼 데이터 수집
            this.collectFormData();
            
            // 회차와 일시가 모두 입력되었는지 확인
            if (!this.currentData.session || !this.currentData.datetime) {
                this.showErrorToast('회차와 일시를 모두 입력해주세요.');
                return;
            }
            
            // 회차나 일시가 변경되었는지 확인
            const sessionChanged = this.originalSession && this.originalSession !== this.currentData.session;
            const datetimeChanged = this.originalDatetime && this.originalDatetime !== this.currentData.datetime;
            const isKeyChanged = sessionChanged || datetimeChanged;
            
            // console.log('🔍 회차/일시 변경 확인:', {
            //     originalSession: this.originalSession,
            //     currentSession: this.currentData.session,
            //     originalDatetime: this.originalDatetime,
            //     currentDatetime: this.currentData.datetime,
            //     sessionChanged,
            //     datetimeChanged,
            //     isKeyChanged
            // });
            
            let result;
            
            if (isKeyChanged) {
                // 회차나 일시가 변경된 경우 신규 등록
                // console.log('🆕 회차/일시 변경 감지, 신규 등록 처리');
                
                if (useLocalStorage) {
                    result = this.saveToLocalStorage(this.currentData);
                } else {
                    result = await window.saveData(this.currentData);
                }
                
                if (result.success && result.id) {
                    this.currentDocumentId = result.id;
                    this.showSuccessToast(`${this.currentData.session} 세미나 데이터가 새로운 회차/일시로 등록되었습니다.`);
                    
                    // 원본 회차/일시 업데이트
                    this.originalSession = this.currentData.session;
                    this.originalDatetime = this.currentData.datetime;
                }
            } else {
                // 회차와 일시가 변경되지 않은 경우 기존 로직 사용
            const keyValue = `${this.currentData.session}_${this.currentData.datetime}`;
            
            // 기존 데이터에서 동일한 키값을 가진 데이터 찾기
            const existingData = await this.findExistingDataByKey(keyValue);
            
            if (existingData) {
                // 기존 데이터가 있으면 수정
                // console.log('기존 데이터 발견, 수정 처리:', existingData.id);
                
                if (useLocalStorage) {
                    result = this.saveToLocalStorage(this.currentData, existingData.id);
                } else {
                    result = await window.updateData(existingData.id, this.currentData);
                }
                
                if (result.success) {
                    this.currentDocumentId = existingData.id;
                    this.showSuccessToast(`${this.currentData.session} 세미나 데이터가 수정되었습니다.`);
                }
            } else {
                // 기존 데이터가 없으면 새로 등록
                // console.log('새 데이터 등록 처리');
                
                if (useLocalStorage) {
                    result = this.saveToLocalStorage(this.currentData);
                } else {
                    result = await window.saveData(this.currentData);
                }
                
                if (result.success && result.id) {
                    this.currentDocumentId = result.id;
                    this.showSuccessToast(`${this.currentData.session} 세미나 데이터가 새로 등록되었습니다.`);
                        
                        // 원본 회차/일시 업데이트
                        this.originalSession = this.currentData.session;
                        this.originalDatetime = this.currentData.datetime;
                    }
                }
            }
            
            if (!result.success) {
                this.showErrorToast(result.message);
            } else {
                // 기본 데이터 저장 성공 시 실시결과 데이터도 저장
                // console.log('📝 기본 데이터 저장 완료, 실시결과 데이터 저장 시작');
                await this.saveMainResultData(true); // skipLoading = true
                
                // 스케치 정보도 함께 저장
                // console.log('🖼️ 스케치 정보 저장 시작');
                await this.saveSketchData(true); // skipLoading = true
            }
            
        } catch (error) {
            console.error('저장 오류:', error);
            this.showErrorToast('저장 중 오류가 발생했습니다.');
        } finally {
            this.showLoading(false);
        }
    }

    // 조용한 저장 (로딩 표시 없음)
    async saveDataQuietly() {
        try {
            // 필요한 함수들이 정의되어 있는지 확인
            if (typeof window.saveData !== 'function' || typeof window.updateData !== 'function') {
                console.warn('필요한 함수들이 정의되지 않았습니다.');
                return;
            }
            
            // 현재 폼 데이터 수집
            this.collectFormData();
            
            // 회차와 일시가 모두 입력되었는지 확인
            if (!this.currentData.session || !this.currentData.datetime) {
                console.warn('회차와 일시를 모두 입력해주세요.');
                return;
            }
            
            // 회차 + 일시를 키값으로 사용
            const keyValue = `${this.currentData.session}_${this.currentData.datetime}`;
            
            // 기존 데이터에서 동일한 키값을 가진 데이터 찾기
            const existingData = await this.findExistingDataByKey(keyValue);
            
            let result;
            
            if (existingData) {
                // 기존 데이터가 있으면 수정
                // console.log('참석여부 변경 - 기존 데이터 수정:', existingData.id);
                
                if (useLocalStorage) {
                    result = this.saveToLocalStorage(this.currentData, existingData.id);
                } else {
                    result = await window.updateData(existingData.id, this.currentData);
                }
                
                if (result.success) {
                    this.currentDocumentId = existingData.id;
                    // console.log('참석여부 변경 저장 완료');
                }
            } else {
                // 기존 데이터가 없으면 새로 등록
                // console.log('참석여부 변경 - 새 데이터 등록');
                
                if (useLocalStorage) {
                    result = this.saveToLocalStorage(this.currentData);
                } else {
                    result = await window.saveData(this.currentData);
                }
                
                if (result.success && result.id) {
                    this.currentDocumentId = result.id;
                    // console.log('참석여부 변경 저장 완료');
                }
            }
            
            if (!result.success) {
                console.error('참석여부 변경 저장 실패:', result.message);
            }
            
        } catch (error) {
            console.error('참석여부 변경 저장 오류:', error);
        }
    }
    
    // 회차 + 일시 키값으로 기존 데이터 찾기
    async findExistingDataByKey(keyValue) {
        try {
            if (useLocalStorage) {
                // 로컬 스토리지에서 모든 세미나 데이터 찾기
                const allData = this.getAllLocalStorageData();
                
                for (const item of allData) {
                    if (item.data.session && item.data.datetime) {
                        const existingKey = `${item.data.session}_${item.data.datetime}`;
                        if (existingKey === keyValue) {
                            return { id: item.id, data: item.data };
                        }
                    }
                }
                return null;
            } else {
                // Firebase에서 데이터 찾기
                const snapshot = await db.collection('seminarPlans').get();
                
                for (const doc of snapshot.docs) {
                    const data = doc.data();
                    if (data.session && data.datetime) {
                        const existingKey = `${data.session}_${data.datetime}`;
                        if (existingKey === keyValue) {
                            return { id: doc.id, data: data };
                        }
                    }
                }
                return null;
            }
        } catch (error) {
            console.error('기존 데이터 찾기 오류:', error);
            return null;
        }
    }
    
    // 로컬 스토리지에서 모든 세미나 데이터 가져오기
    getAllLocalStorageData() {
        try {
            const data = localStorage.getItem('seminarPlans');
            if (data) {
                return JSON.parse(data);
            }
            return [];
        } catch (error) {
            console.error('로컬 스토리지 데이터 읽기 오류:', error);
            return [];
        }
    }
    
    // 로컬 스토리지에 세미나 데이터 저장/업데이트
    saveToLocalStorage(seminarData, id = null) {
        try {
            let allData = this.getAllLocalStorageData();
            
            if (id) {
                // 기존 데이터 업데이트
                const index = allData.findIndex(item => item.id === id);
                if (index !== -1) {
                    allData[index].data = seminarData;
                    allData[index].updatedAt = new Date().toISOString();
                } else {
                    // ID가 있지만 데이터를 찾을 수 없는 경우 새로 추가
                    allData.push({
                        id: id,
                        data: seminarData,
                        createdAt: new Date().toISOString(),
                        updatedAt: new Date().toISOString()
                    });
                }
            } else {
                // 새 데이터 추가
                const newId = 'local_' + Date.now();
                allData.push({
                    id: newId,
                    data: seminarData,
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString()
                });
            }
            
            localStorage.setItem('seminarPlans', JSON.stringify(allData));
            return { success: true, id: id || 'local_' + Date.now() };
        } catch (error) {
            console.error('로컬 스토리지 저장 오류:', error);
            return { success: false, message: error.message };
        }
    }



    async loadData() {
        try {
            this.showLoading(true);
            
            const result = await window.loadData();
            
            if (result.success) {
                // Firebase에서 가져온 데이터에서 id 필드 제거
                const { id, ...dataWithoutId } = result.data;
                this.currentData = dataWithoutId;
                this.currentDocumentId = result.id; // Firebase 문서 ID 저장
                
                // console.log('📋 loadData로 로드된 데이터:', this.currentData);
                // console.log('📋 스케치 정보:', this.currentData.sketches);
                
                await this.populateForm();
                
                this.showSuccessToast('Firebase에서 데이터를 성공적으로 불러왔습니다.');
            } else {
                this.showErrorToast(result.message);
            }
        } catch (error) {
            console.error('불러오기 오류:', error);
            this.showErrorToast('데이터 불러오기 중 오류가 발생했습니다.');
        } finally {
            this.showLoading(false);
        }
    }

    collectFormData() {
        // 기본 정보 수집
        this.currentData.session = this.currentData.session || '';
        this.currentData.objective = document.getElementById('objective').value;
        this.currentData.datetime = document.getElementById('datetime').value;
        this.currentData.location = document.getElementById('location').value;
        this.currentData.attendees = document.getElementById('attendees').value;
        
        // 시간 계획 데이터 수집
        const timeRows = document.getElementById('timeTableBody').children;
        this.currentData.timeSchedule = [];
        
        Array.from(timeRows).forEach(row => {
            const inputs = row.querySelectorAll('input, select, textarea');
            this.currentData.timeSchedule.push({
                type: inputs[0]?.value || '',
                content: inputs[1]?.value || '',
                time: inputs[2]?.value || '',
                responsible: inputs[3]?.value || ''
            });
        });
        
        // 참석자 데이터 수집
        const attendeeRows = document.getElementById('attendeeTableBody').children;
        this.currentData.attendeeList = [];
        
        Array.from(attendeeRows).forEach((row, index) => {
            // data-field 속성을 사용하여 정확한 요소 선택
            const nameInput = row.querySelector('input[data-field="name"]');
            const positionInput = row.querySelector('[data-field="position"]');
            const departmentInput = row.querySelector('[data-field="department"]');
            const workInput = row.querySelector('[data-field="work"]');
            const attendanceSelect = row.querySelector('select[data-field="attendance"]');
            
            const position = positionInput ? positionInput.value : '';
            const department = departmentInput ? departmentInput.value : '';
            const work = workInput ? workInput.value : '';
            const attendance = attendanceSelect?.value || 'N';
            
            // console.log(`참석자 데이터 수집: index=${index}, name=${nameInput?.value}, attendance=${attendance}`);
            
            this.currentData.attendeeList.push({
                name: nameInput?.value || '',
                position: position,
                department: department,
                work: work,
                attendance: attendance
            });
        });
        
        // 스케치 정보 수집
        this.currentData.sketches = this.getMainSketchData();
    }

    showLoading(show) {
        const spinner = document.getElementById('loadingSpinner');
        if (show) {
            spinner.classList.remove('hidden');
        } else {
            spinner.classList.add('hidden');
        }
    }

    showSuccessToast(message) {
        const toast = document.getElementById('successToast');
        const messageSpan = toast.querySelector('span');
        messageSpan.textContent = message;
        
        toast.classList.remove('translate-x-full');
        toast.classList.add('slide-in-right');
        
        setTimeout(() => {
            toast.classList.add('translate-x-full');
        }, 3000);
    }

    showErrorToast(message) {
        // 에러 토스트는 성공 토스트를 재사용하여 표시
        const toast = document.getElementById('successToast');
        const messageSpan = toast.querySelector('span');
        const icon = toast.querySelector('i');
        
        messageSpan.textContent = message;
        icon.className = 'fas fa-exclamation-circle mr-2';
        toast.classList.remove('bg-green-500');
        toast.classList.add('bg-red-500');
        
        toast.classList.remove('translate-x-full');
        toast.classList.add('slide-in-right');
        
        setTimeout(() => {
            toast.classList.add('translate-x-full');
            // 원래 스타일로 복원
            icon.className = 'fas fa-check-circle mr-2';
            toast.classList.remove('bg-red-500');
            toast.classList.add('bg-green-500');
        }, 3000);
    }

    // 조회 모달 표시
    showSearchModal() {
        const modal = document.getElementById('searchModal');
        modal.classList.remove('hidden');
        
        // 메인 화면 스크롤 방지
        document.body.style.overflow = 'hidden';
        
        // 모달 이벤트 바인딩
        this.bindSearchModalEvents();
        
        // 전체 데이터 조회
        this.searchSeminars();
    }
    
    // 조회 모달 닫기
    closeSearchModal() {
        const modal = document.getElementById('searchModal');
        modal.classList.add('hidden');
        
        // 메인 화면 스크롤 복원
        document.body.style.overflow = '';
    }

    // 조회 모달 이벤트 바인딩
    bindSearchModalEvents() {
        // 모달 닫기
        document.getElementById('closeSearchModal').addEventListener('click', () => {
            this.closeSearchModal();
        });

        // 등록 버튼
        document.getElementById('addNewBtn').addEventListener('click', () => {
            this.addNewSeminar();
        });
    }



    // 세미나 조회 (전체 데이터)
    async searchSeminars() {
        try {
            this.showLoading(true);
            
            const result = await loadAllPlans();
            
            if (result.success) {
                // 데이터 유효성 검사 및 정규화
                const normalizedData = result.data.map(item => ({
                    ...item,
                    session: this.ensureStringValue(item.session),
                    objective: this.ensureStringValue(item.objective),
                    datetime: this.ensureStringValue(item.datetime),
                    location: this.ensureStringValue(item.location),
                    attendees: this.ensureStringValue(item.attendees)
                }));
                
                // 일시를 키값으로 내림차순 정렬
                const sortedData = normalizedData.sort((a, b) => {
                    const dateA = new Date(a.datetime || '1970-01-01');
                    const dateB = new Date(b.datetime || '1970-01-01');
                    return dateB - dateA; // 내림차순 (최신 날짜가 먼저)
                });
                
                // console.log('📊 조회된 데이터:', sortedData);
                this.displaySearchResults(sortedData);
            } else {
                this.showErrorToast(result.message);
            }
        } catch (error) {
            console.error('조회 오류:', error);
            this.showErrorToast('조회 중 오류가 발생했습니다.');
        } finally {
            this.showLoading(false);
        }
    }


        // 검색 결과 표시
    displaySearchResults(data) {
        const tbody = document.getElementById('searchResultBody');
        tbody.innerHTML = '';
        
        if (data.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="5" class="px-8 py-16 text-center">
                        <div class="flex flex-col items-center space-y-4">
                            <div class="w-20 h-20 bg-gradient-to-br from-blue-100 to-indigo-100 rounded-full flex items-center justify-center">
                                <i class="fas fa-search text-3xl text-blue-400"></i>
                            </div>
                            <div class="text-center">
                                <h3 class="text-xl font-semibold text-gray-700 mb-2">조회된 결과가 없습니다</h3>
                                <p class="text-gray-500">새로운 세미나를 등록해보세요</p>
                            </div>
                        </div>
                    </td>
                </tr>
            `;
            return;
        }
        
        data.forEach((item, index) => {
            const row = document.createElement('tr');
            row.className = 'hover:bg-gradient-to-r hover:from-blue-50 hover:to-indigo-50 cursor-pointer transition-all duration-200 group';
            row.onclick = () => this.loadSeminarDetailByKey(item.session, item.datetime);
            
            // 모바일 호환성을 위한 데이터 처리
            const session = this.ensureStringValue(item.session) || '미입력';
            const datetime = this.ensureStringValue(item.datetime) || '미입력';
            const objective = this.ensureStringValue(item.objective) || '미입력';
            const location = this.ensureStringValue(item.location) || '미입력';
            const attendees = this.ensureStringValue(item.attendees) || '미입력';
            
            // 회차는 읽기 전용으로 표시
            const sessionBadge = session === '미입력' ? 
                '<span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">미입력</span>' :
                `<span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">${this.escapeHtml(session)}</span>`;
            
            row.innerHTML = `
                <td class="px-6 py-4 w-40">
                    ${sessionBadge}
                </td>
                <td class="px-4 py-4 w-48">
                    <div class="flex items-center space-x-2 group-hover:text-blue-600 transition-colors duration-200">
                        <i class="fas fa-calendar-alt text-blue-400 group-hover:text-blue-600"></i>
                        <span class="font-medium text-sm">${this.escapeHtml(datetime)}</span>
                    </div>
                </td>
                <td class="px-6 py-4">
                    <div class="max-w-xs">
                        <p class="text-gray-800 truncate group-hover:text-gray-900 transition-colors duration-200" title="${this.escapeHtml(objective)}">
                            ${this.escapeHtml(objective)}
                        </p>
                    </div>
                </td>
                <td class="px-6 py-4">
                    <div class="flex items-center space-x-2">
                        <i class="fas fa-map-marker-alt text-red-400"></i>
                        <span class="text-gray-700">${this.escapeHtml(location)}</span>
                    </div>
                </td>
                <td class="px-6 py-4">
                    <div class="flex items-center space-x-2">
                        <i class="fas fa-users text-green-400"></i>
                        <span class="text-gray-700">${this.escapeHtml(attendees)}</span>
                    </div>
                </td>
            `;
            
            tbody.appendChild(row);
        });
    }

    // 회차_일시 키값으로 세미나 상세 정보 로드
    async loadSeminarDetailByKey(session, datetime) {
        try {
            this.showLoading(true);
            // console.log('🔍 세미나 상세 정보 로드 시작, 회차:', session, '일시:', datetime);
            
            // 회차_일시 키값 생성
            const keyValue = `${session}_${datetime}`;
            
            // 키값으로 기존 데이터 찾기
            const existingData = await this.findExistingDataByKey(keyValue);
            // console.log('📊 조회 결과:', existingData);
            
            if (existingData) {
                // 모달 닫기
                this.closeSearchModal();
                
                // 데이터 유효성 검사 및 정규화
                const normalizedData = {
                    ...existingData.data,
                    session: this.ensureStringValue(existingData.data.session),
                    objective: this.ensureStringValue(existingData.data.objective),
                    datetime: this.ensureStringValue(existingData.data.datetime),
                    location: this.ensureStringValue(existingData.data.location),
                    attendees: this.ensureStringValue(existingData.data.attendees),
                    timeSchedule: Array.isArray(existingData.data.timeSchedule) ? existingData.data.timeSchedule.map(item => ({
                        type: this.ensureStringValue(item.type),
                        content: this.ensureStringValue(item.content),
                        time: this.ensureStringValue(item.time),
                        responsible: this.ensureStringValue(item.responsible)
                    })) : [],
                    attendeeList: Array.isArray(existingData.data.attendeeList) ? existingData.data.attendeeList.map(item => ({
                        name: this.ensureStringValue(item.name),
                        position: this.ensureStringValue(item.position),
                        department: this.ensureStringValue(item.department),
                        work: this.ensureStringValue(item.work),
                        attendance: item.attendance || 'N' // 참석여부 추가 (ensureStringValue 제거)
                    })) : [],
                    sketches: existingData.data.sketches || [] // 스케치 정보 추가
                };
                
                // console.log('📋 정규화된 세미나 데이터:', normalizedData);
                // console.log('📋 시간 계획 데이터:', normalizedData.timeSchedule);
                // console.log('📋 참석자 데이터:', normalizedData.attendeeList);
                // console.log('📋 스케치 데이터:', normalizedData.sketches);
                
                // 참석여부 상세 로그
                if (normalizedData.attendeeList && normalizedData.attendeeList.length > 0) {
                    // console.log('📋 참석여부 상세 확인:');
                    normalizedData.attendeeList.forEach((attendee, idx) => {
                        // console.log(`  [${idx}] ${attendee.name}: attendance=${attendee.attendance}`);
                    });
                }
                
                // 메인 화면에 데이터 로드
                this.currentData = normalizedData;
                this.currentDocumentId = existingData.id; // 찾은 데이터의 ID 사용
                
                // 원본 회차와 일시 저장 (변경 감지용)
                this.originalSession = normalizedData.session;
                this.originalDatetime = normalizedData.datetime;
                // console.log('📋 원본 회차/일시 저장:', this.originalSession, this.originalDatetime);
                
                // console.log('📋 currentData 설정 완료:', this.currentData);
                
                await this.populateForm();
                // console.log('📋 폼 채우기 완료');
                
                // 스케치 버튼 상태 확인
                setTimeout(() => {
                    this.toggleQuickSaveSketchButton();
                }, 100);
                
                this.showSuccessToast(`${session} 세미나 계획을 불러왔습니다.`);
            } else {
                console.error('❌ 세미나 조회 실패: 해당 회차와 일시의 데이터를 찾을 수 없습니다.');
                this.showErrorToast('해당 회차와 일시의 세미나 계획을 찾을 수 없습니다.');
            }
        } catch (error) {
            console.error('❌ 상세 정보 로드 오류:', error);
            this.showErrorToast('상세 정보 로드 중 오류가 발생했습니다.');
        } finally {
            this.showLoading(false);
        }
    }

    // 세미나 상세 정보 로드 (기존 ID 기반 - 호환성 유지)
    async loadSeminarDetail(id) {
        try {
            this.showLoading(true);
            // console.log('🔍 세미나 상세 정보 로드 시작, ID:', id);
            
            // Firebase에서 해당 문서 조회
            const result = await this.getSeminarById(id);
            // console.log('📊 조회 결과:', result);
            
            if (result.success) {
                // 모달 닫기
                this.closeSearchModal();
                
                // 데이터 유효성 검사 및 정규화
                const normalizedData = {
                    ...result.data,
                    session: this.ensureStringValue(result.data.session),
                    objective: this.ensureStringValue(result.data.objective),
                    datetime: this.ensureStringValue(result.data.datetime),
                    location: this.ensureStringValue(result.data.location),
                    attendees: this.ensureStringValue(result.data.attendees),
                    timeSchedule: Array.isArray(result.data.timeSchedule) ? result.data.timeSchedule.map(item => ({
                        type: this.ensureStringValue(item.type),
                        content: this.ensureStringValue(item.content),
                        time: this.ensureStringValue(item.time),
                        responsible: this.ensureStringValue(item.responsible)
                    })) : [],
                    attendeeList: Array.isArray(result.data.attendeeList) ? result.data.attendeeList.map(item => ({
                        name: this.ensureStringValue(item.name),
                        position: this.ensureStringValue(item.position),
                        department: this.ensureStringValue(item.department),
                        work: this.ensureStringValue(item.work),
                        attendance: item.attendance || 'N' // 참석여부 추가
                    })) : []
                };
                
                // console.log('📋 정규화된 세미나 데이터:', normalizedData);
                // console.log('📋 시간 계획 데이터:', normalizedData.timeSchedule);
                // console.log('📋 참석자 데이터:', normalizedData.attendeeList);
                
                // 메인 화면에 데이터 로드
                this.currentData = normalizedData;
                this.currentDocumentId = id; // 매개변수로 받은 id 사용
                // console.log('📋 currentData 설정 완료:', this.currentData);
                
                await this.populateForm();
                // console.log('📋 폼 채우기 완료');
                
                this.showSuccessToast('세미나 계획을 불러왔습니다.');
            } else {
                console.error('❌ 세미나 조회 실패:', result.message);
                this.showErrorToast(result.message);
            }
        } catch (error) {
            console.error('❌ 상세 정보 로드 오류:', error);
            this.showErrorToast('상세 정보 로드 중 오류가 발생했습니다.');
        } finally {
            this.showLoading(false);
        }
    }

    // ID로 세미나 조회
    async getSeminarById(id) {
        try {
            if (useLocalStorage) {
                const allData = this.getAllLocalStorageData();
                const seminar = allData.find(item => item.id === id);
                
                if (seminar) {
                    // console.log('📁 로컬 스토리지에서 로드된 데이터:', seminar.data);
                    return { success: true, data: seminar.data, id: seminar.id };
                } else {
                    return { success: false, message: '해당 세미나 계획을 찾을 수 없습니다.' };
                }
            } else {
                // Firebase에서 특정 문서 조회
                const doc = await db.collection('seminarPlans').doc(id).get();
                if (doc.exists) {
                    const docData = doc.data();
                    // console.log('🔥 Firebase에서 로드된 데이터:', docData);
                    return { success: true, data: docData, id: doc.id };
                } else {
                    return { success: false, message: '해당 세미나 계획을 찾을 수 없습니다.' };
                }
            }
        } catch (error) {
            console.error('세미나 조회 오류:', error);
            return { success: false, message: '세미나 조회 중 오류가 발생했습니다: ' + error.message };
        }
    }

    // 새 세미나 등록
    addNewSeminar() {
        try {
            // 모달 닫기
            this.closeSearchModal();
            
            // 메인 화면 초기화
            this.initializeMainForm();
            
            this.showSuccessToast('새 세미나 등록을 위한 화면이 준비되었습니다.');
        } catch (error) {
            console.error('새 세미나 등록 화면 전환 오류:', error);
            this.showErrorToast('화면 전환 중 오류가 발생했습니다.');
        }
    }

    // 메인 화면 초기화
    initializeMainForm() {
        // 현재 데이터 초기화
        this.currentData = {
            session: '',
            objective: '',
            datetime: '',
            location: '',
            attendees: '',
            timeSchedule: [],
            attendeeList: [],
            sketches: []
        };
        
        // Firebase 문서 ID 초기화
        this.currentDocumentId = null;
        
        // 원본 회차/일시 초기화
        this.originalSession = null;
        this.originalDatetime = null;
        
        // 폼 필드 초기화
        document.getElementById('sessionSelect').value = '';
        document.getElementById('sessionInput').value = '';
        document.getElementById('sessionSelect').style.display = 'block';
        document.getElementById('sessionInput').classList.add('hidden');
        document.getElementById('objective').value = '';
        document.getElementById('datetime').value = '';
        document.getElementById('location').value = '';
        document.getElementById('attendees').value = '';
        
        // 테이블 초기화
        document.getElementById('timeTableBody').innerHTML = '';
        document.getElementById('attendeeTableBody').innerHTML = '';
        
        // 기본 행 추가 (직접 생성)
        this.addDefaultRows();
        
        // 스케치 초기화 (스케치0, 스케치1만 남기고 나머지 제거)
        this.resetSketches();
        
        // 실시결과 필드 초기화
        const mainResultContent = document.getElementById('mainResultContent');
        const mainResultFuturePlan = document.getElementById('mainResultFuturePlan');
        if (mainResultContent) mainResultContent.value = '';
        if (mainResultFuturePlan) mainResultFuturePlan.value = '';
        
        // PDF 실시결과 내보내기 버튼 숨기기
        this.toggleExportResultPDFButton();
    }

    // 회차 필드 업데이트
    updateSessionField(value) {
        const selectElement = document.getElementById('sessionSelect');
        const inputElement = document.getElementById('sessionInput');
        
        if (value === '직접입력') {
            selectElement.style.display = 'none';
            inputElement.classList.remove('hidden');
            inputElement.focus();
            this.currentData.session = '';
        } else if (value) {
            selectElement.style.display = 'block';
            inputElement.classList.add('hidden');
            this.currentData.session = value;
        } else {
            selectElement.style.display = 'block';
            inputElement.classList.add('hidden');
            this.currentData.session = '';
        }
    }

    // 회차 직접 입력 값 업데이트
    updateSessionValue(value) {
        this.currentData.session = value;
    }

    // 회차 필드 데이터 채우기
    populateSessionField() {
        const selectElement = document.getElementById('sessionSelect');
        const inputElement = document.getElementById('sessionInput');
        
        if (this.currentData.session) {
            const sessionOptions = [
                '제 1회', '제 2회', '제 3회', '제 4회', '제 5회', '제 6회', '제 7회', '제 8회', '제 9회', '제10회',
                '제11회', '제12회', '제13회', '제14회', '제15회', '제16회', '제17회', '제18회', '제19회', '제20회'
            ];
            
            if (sessionOptions.includes(this.currentData.session)) {
                selectElement.value = this.currentData.session;
                selectElement.style.display = 'block';
                inputElement.classList.add('hidden');
            } else {
                selectElement.value = '직접입력';
                selectElement.style.display = 'none';
                inputElement.value = this.currentData.session;
                inputElement.classList.remove('hidden');
            }
        } else {
            selectElement.value = '';
            selectElement.style.display = 'block';
            inputElement.value = '';
            inputElement.classList.add('hidden');
        }
        
    }

    // 폼 초기화 (사용자 요청)
    resetForm() {
        try {
            // 입력 필드만 초기화 (기존 데이터는 유지)
            this.clearInputFields();
            
            // 시간 계획과 참석자 명단에 1행씩 자동 추가
            this.addTimeRow();
            this.addAttendeeRow();
            
            // 스케치 초기화 (스케치1, 스케치2만 남기고 나머지 제거)
            this.resetSketches();
            
            // 원본 회차/일시 초기화
            this.originalSession = null;
            this.originalDatetime = null;
            
            this.showSuccessToast('모든 입력 필드가 초기화되고 기본 행이 추가되었습니다.');
        } catch (error) {
            console.error('폼 초기화 오류:', error);
            this.showErrorToast('초기화 중 오류가 발생했습니다.');
        }
    }

    // 입력 필드만 초기화 (기존 데이터 유지)
    clearInputFields() {
        // 회차 필드 초기화
        document.getElementById('sessionSelect').value = '';
        document.getElementById('sessionInput').value = '';
        document.getElementById('sessionSelect').style.display = 'block';
        document.getElementById('sessionInput').classList.add('hidden');
        
        // 기본 정보 필드 초기화
        document.getElementById('objective').value = '';
        document.getElementById('datetime').value = '';
        document.getElementById('location').value = '';
        document.getElementById('attendees').value = '';
        
        // 테이블 입력 필드 초기화
        this.clearTableInputs();
        
        // 실시결과 입력 항목 초기화
        this.clearResultInputs();
        
        // 세미나 스케치 업로드 항목 초기화
        this.resetSketches();
        
        // 현재 데이터의 입력 필드 값만 초기화 (저장된 데이터는 유지)
        this.currentData.session = '';
        this.currentData.objective = '';
        this.currentData.datetime = '';
        this.currentData.location = '';
        this.currentData.attendees = '';
    }

    // 테이블 그리드 완전 삭제 (초기화)
    clearTableInputs() {
        // 시간 계획 테이블 그리드 완전 삭제
        const timeTableBody = document.getElementById('timeTableBody');
        timeTableBody.innerHTML = '';
        
        // 참석자 테이블 그리드 완전 삭제
        const attendeeTableBody = document.getElementById('attendeeTableBody');
        attendeeTableBody.innerHTML = '';
        
        // 현재 데이터의 테이블 데이터도 초기화
        this.currentData.timeSchedule = [];
        this.currentData.attendeeList = [];
    }
    
    // 실시결과 입력 항목 초기화
    clearResultInputs() {
        // 주요 내용 초기화
        const mainContentElement = document.getElementById('mainResultContent');
        if (mainContentElement) {
            mainContentElement.value = '';
        }
        
        // 향후 계획 초기화
        const futurePlanElement = document.getElementById('mainResultFuturePlan');
        if (futurePlanElement) {
            futurePlanElement.value = '';
        }
        
        // PDF 실시결과 내보내기 버튼 숨기기
        this.toggleExportResultPDFButton();
    }
    

    // 모바일 호환성을 위한 헬퍼 메서드들
    
    // 문자열 값 보장
    ensureStringValue(value) {
        if (value === null || value === undefined) return '';
        if (typeof value === 'string') return value.trim();
        if (typeof value === 'number') return value.toString();
        if (typeof value === 'boolean') return value.toString();
        if (Array.isArray(value)) return value.join(', ');
        if (typeof value === 'object') return JSON.stringify(value);
        return String(value);
    }
    
    
    // HTML 이스케이프 (XSS 방지 및 모바일 호환)
    escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    // 일시별 정렬
    sortByDatetime() {
        const tbody = document.getElementById('searchResultBody');
        const rows = Array.from(tbody.children);
        
        // 정렬 방향 토글
        if (!this.sortDirection) this.sortDirection = 'asc';
        else this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
        
        rows.sort((a, b) => {
            const aText = a.children[1].textContent;
            const bText = b.children[1].textContent;
            
            if (aText.includes('조회된 결과가 없습니다')) return 1;
            if (bText.includes('조회된 결과가 없습니다')) return -1;
            
            const aDate = new Date(aText);
            const bDate = new Date(bText);
            
            if (this.sortDirection === 'asc') {
                return aDate - bDate;
            } else {
                return bDate - aDate;
            }
        });
        
        // 정렬된 행들을 다시 추가
        rows.forEach(row => tbody.appendChild(row));
        
        // 정렬 방향 표시 업데이트
        const header = document.querySelector('th[onclick="app.sortByDatetime()"]');
        const icon = header.querySelector('.fas.fa-sort');
        if (icon) {
            icon.className = this.sortDirection === 'asc' ? 'fas fa-sort-up text-blue-600' : 'fas fa-sort-down text-blue-600';
        }
        
        // 정렬 완료 토스트 표시
        const direction = this.sortDirection === 'asc' ? '오름차순' : '내림차순';
        this.showSuccessToast(`일시 기준 ${direction}으로 정렬되었습니다.`);
    }



    exportToPDF() {
        try {
            this.showLoading(true);
            
            this.waitForPDFMake().then(() => {
                this.exportToPDFWithPDFMake();
            }).catch(() => {
                this.exportToPDFWithHTML();
            });
            
        } catch (error) {
            this.showErrorToast(`PDF 내보내기 실패: ${error.message}`);
            this.showLoading(false);
        }
    }

    // PDFMake 라이브러리 로딩 대기
    waitForPDFMake() {
        return new Promise((resolve, reject) => {
            let attempts = 0;
            const maxAttempts = 100;
            
            const checkPDFMake = () => {
                attempts++;
                
                if (window.pdfMake && window.pdfMake.fonts) {
                    resolve();
                } else if (attempts >= maxAttempts) {
                    reject(new Error('PDFMake 로딩 시간 초과'));
                } else {
                    setTimeout(checkPDFMake, 100);
                }
            };
            
            checkPDFMake();
        });
    }

    // PDFMake를 사용한 PDF 생성
    exportToPDFWithPDFMake() {
        try {
            if (!window.pdfMake) {
                this.exportToPDFWithHTML();
                return;
            }
            
            if (!window.pdfMake.fonts) {
                this.exportToPDFWithHTML();
                return;
            }
            
            // 안전한 텍스트 처리 함수
            const safeText = (text) => {
                if (!text) return '';
                return String(text).replace(/[\x00-\x1F\x7F-\x9F]/g, '').trim();
            };
            
            // 일시 텍스트 그대로 사용
            const formatDateTime = (dateTime) => {
                return dateTime || '';
            };
            
            // 주요 내용 형식 변환 함수 (PDFMake용)
            const formatContentForPDF = (content) => {
                if (!content) return '';
                const text = String(content);
                
                // '- ' 문자를 기준으로 분할
                const parts = text.split('- ');
                if (parts.length <= 1) return text;
                
                let result = parts[0]; // 첫 번째 부분
                
                // 나머지 부분들을 다음 라인에 추가
                for (let i = 1; i < parts.length; i++) {
                    if (parts[i].trim()) {
                        result += '\n- ' + parts[i];
                    }
                }
                
                return result;
            };
            
            // PDF 문서 정의
            const docDefinition = {
                pageSize: 'A4',
                pageMargins: [40, 60, 40, 60],
                defaultStyle: {
                    fontSize: 10
                },
                footer: function(currentPage, pageCount) {
                    return {
                        text: `- ${currentPage} -`,
                        alignment: 'center',
                        fontSize: 10,
                        margin: [0, 10, 0, 0]
                    };
                },
                content: [
                    // 제목
                    {
                        text: safeText(this.currentData.session) || '전사 신기술 세미나 실행계획',
                        style: 'header',
                        alignment: 'center',
                        margin: [0, 0, 0, 10]
                    },
                    // 현재 일자
                    {
                        text: this.getCurrentDateString(),
                        alignment: 'right',
                        fontSize: 10,
                        margin: [0, 0, 0, 20]
                    },
                    
                    // 기본 정보
                    { text: '1. 목표', style: 'sectionHeader', margin: [0, 0, 0, 5] },
                    { text: '　　□ ' + (safeText(this.currentData.objective) || '미입력'), style: 'tableCell', margin: [0, 0, 0, 10] },
                    
                    { text: '2. 일시/장소', style: 'sectionHeader', margin: [0, 0, 0, 5] },
                    { text: '　　□ ' + ((formatDateTime(safeText(this.currentData.datetime)) || '미입력') + ' / ' + (safeText(this.currentData.location) || '미입력')), style: 'tableCell', margin: [0, 0, 0, 10] },
                    
                    { text: '3. 참석 대상', style: 'sectionHeader', margin: [0, 0, 0, 5] },
                    { text: '　　□ ' + (safeText(this.currentData.attendees) || '미입력'), style: 'tableCell', margin: [0, 0, 0, 20] }
                ],
                styles: {
                    header: {
                        fontSize: 18,
                        bold: true
                    },
                    sectionHeader: {
                        fontSize: 14,
                        bold: true,
                        color: '#2c3e50'
                    },
                    tableHeader: {
                        fontSize: 10,
                        bold: true,
                        fillColor: '#ecf0f1'
                    },
                    tableCell: {
                        fontSize: 10
                    }
                }
            };

            // 시간 계획 테이블 추가
            if (this.currentData.timeSchedule && this.currentData.timeSchedule.length > 0) {
                const timeScheduleRows = [
                    [
                        { text: '구분', style: 'tableHeader' },
                        { text: '주요 내용', style: 'tableHeader' },
                        { text: '시간', style: 'tableHeader' },
                        { text: '담당', style: 'tableHeader' }
                    ]
                ];

                // 구분 값 병합 처리를 위한 데이터 준비
                const processedSchedule = this.processTimeScheduleForMerging(this.currentData.timeSchedule);

                processedSchedule.forEach((item, index) => {
                    const row = [
                        { text: safeText(item.type) || '', style: 'tableCell' },
                        { text: formatContentForPDF(safeText(item.content)) || '', style: 'tableCell' },
                        { text: safeText(item.time) || '', style: 'tableCell' },
                        { text: safeText(item.responsible) || '', style: 'tableCell' }
                    ];

                    // 병합이 필요한 경우 rowspan 설정
                    if (item.rowspan && item.rowspan > 1) {
                        row[0].rowSpan = item.rowspan;
                    }

                    timeScheduleRows.push(row);
                });

                docDefinition.content.push(
                    { text: '4. 시간 계획', style: 'sectionHeader', margin: [0, 20, 0, 10] },
                    {
                        table: {
                            widths: ['auto', '*', 'auto', 'auto'],
                            body: timeScheduleRows
                        },
                        margin: [0, 0, 0, 10]
                    },
                    { text: '- 이 상 –', alignment: 'right', fontSize: 10, margin: [0, 0, 0, 20] }
                );
            }

            // 참석자 명단 테이블 추가
            if (this.currentData.attendeeList && this.currentData.attendeeList.length > 0) {
                const attendeeRows = [
                    [
                        { text: 'No', style: 'tableHeader' },
                        { text: '성명', style: 'tableHeader' },
                        { text: '직급', style: 'tableHeader' },
                        { text: '소속', style: 'tableHeader' },
                        { text: '업무', style: 'tableHeader' }
                    ]
                ];

                this.currentData.attendeeList.forEach((item, index) => {
                    attendeeRows.push([
                        { text: (index + 1).toString(), style: 'tableCell' },
                        { text: safeText(item.name) || '', style: 'tableCell' },
                        { text: safeText(item.position) || '', style: 'tableCell' },
                        { text: safeText(item.department) || '', style: 'tableCell' },
                        { text: safeText(item.work) || '', style: 'tableCell' }
                    ]);
                });

                docDefinition.content.push(
                    { text: '', pageBreak: 'before' },
                    { text: '[별첨] 세미나 참석 명단', style: 'sectionHeader', margin: [0, 20, 0, 10] },
                    {
                        table: {
                            widths: ['auto', '*', '*', '*', '*'],
                            body: attendeeRows
                        }
                    }
                );
            }

            // 한국어 파일명 생성
            const today = new Date();
            const year = today.getFullYear();
            const month = String(today.getMonth() + 1).padStart(2, '0');
            const day = String(today.getDate()).padStart(2, '0');
            const fileName = `${year}${month}${day} 전사 신기술 세미나 실행계획.pdf`;

            // PDF 생성 및 다운로드
            try {
                const pdfDoc = pdfMake.createPdf(docDefinition);
                pdfDoc.download(fileName);
                this.showSuccessToast('PDF가 성공적으로 내보내졌습니다. (PDFMake 사용)');
                this.showLoading(false); // 성공 시 로딩 해제
            } catch (pdfError) {
                console.error('PDFMake PDF 생성 오류:', pdfError);
                this.showLoading(false); // 오류 시 로딩 해제
                throw new Error(`PDF 생성 실패: ${pdfError.message}`);
            }
            
        } catch (error) {
            console.error('PDFMake PDF 생성 오류:', error);
            // console.log('🔄 HTML to PDF 방식으로 대체');
            this.showLoading(false); // 오류 시 로딩 해제
            this.exportToPDFWithHTML();
        }
    }

    // HTML to PDF 방식
    exportToPDFWithHTML() {
        try {
            const htmlContent = this.generatePDFHTML();
            
            // 새 창에서 HTML 열기
            const newWindow = window.open('', '_blank');
            if (!newWindow) {
                this.showErrorToast('팝업이 차단되었습니다. 브라우저에서 팝업을 허용해주세요.');
                this.showLoading(false);
                return;
            }
            newWindow.document.write(htmlContent);
            newWindow.document.close();
            
            // 문서 제목 설정(저장 시 기본 파일명으로 사용)
            const today = new Date();
            const year = today.getFullYear();
            const month = String(today.getMonth() + 1).padStart(2, '0');
            const day = String(today.getDate()).padStart(2, '0');
            newWindow.document.title = `${year}${month}${day} 전사 신기술 세미나 실행계획.pdf`;
            
            // 인쇄 대화상자 호출
            setTimeout(() => {
                newWindow.print();
                this.showSuccessToast('인쇄 대화상자가 열렸습니다. "PDF로 저장"을 선택하세요.');
            }, 500);
        } catch (error) {
            console.error('HTML to PDF 오류:', error);
            this.showErrorToast(`PDF 내보내기 실패: ${error.message}`);
        } finally {
            this.showLoading(false);
        }
    }

    // 대체 PDF 내보내기 방법 (HTML to PDF)

    // PDF용 HTML 콘텐츠 생성 (한국어 완벽 지원)
    generatePDFHTML() {
        const today = new Date();
        const dateString = today.toLocaleDateString('ko-KR');
        const year = today.getFullYear();
        const month = String(today.getMonth() + 1).padStart(2, '0');
        const day = String(today.getDate()).padStart(2, '0');
        const fileName = `${year}${month}${day} 전사 신기술 세미나 실행계획`;
        
        // 안전한 텍스트 처리 함수
        const safeText = (text) => {
            if (!text || text.trim() === '') return '미입력';
            return String(text).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
        };
        
        // 일시 텍스트 그대로 사용
        const formatDateTime = (dateTime) => {
            return dateTime || '';
        };
        
        // 목표 필드에서 □ 문자를 만나면 다음 라인으로 처리하는 함수 (HTML용)
        const formatObjectiveHTML = (objective) => {
            if (!objective) return '';
            const text = String(objective);
            
            // □ 문자를 기준으로 분할
            const parts = text.split('□');
            if (parts.length <= 1) return text;
            
            let result = parts[0]; // 첫 번째 부분
            
            // 나머지 부분들을 4칸 들여쓰기와 함께 추가
            for (let i = 1; i < parts.length; i++) {
                if (i == 1 && parts[i].trim()) {
                    result += '　　□ ' + parts[i]; // 4칸 들여쓰기
                }
                if (i !=1 && parts[i].trim()) {
                    result += '<br>　　□ ' + parts[i]; // 4칸 들여쓰기
                }
            }
            
            return result;
        };
        
        // 주요 내용 형식 변환 함수 (HTML용)
        const formatContentHTML = (content) => {
            if (!content) return '';
            const text = String(content);
            
            // '- ' 문자를 기준으로 분할
            const parts = text.split('- ');
            if (parts.length <= 1) return text;
            
            let result = parts[0]; // 첫 번째 부분
            
            // 나머지 부분들을 다음 라인에 추가
            for (let i = 1; i < parts.length; i++) {
                if (parts[i].trim()) {
                    result += '<br>- ' + parts[i];
                }
            }
            
            return result;
        };
        
        let html = `
<!DOCTYPE html>
<html lang="ko">
<head>
    <meta charset="UTF-8">
    <meta http-equiv="Content-Type" content="text/html; charset=UTF-8">
    <title>전사 신기술 세미나 실행계획</title>
    <meta name="author" content="(주)경포씨엔씨">
    <meta name="description" content="전사 신기술 세미나 실행계획서">
    <meta name="keywords" content="세미나, 실행계획, KPCNC">
    <meta name="robots" content="noindex, nofollow">
    <meta name="generator" content="">
    <style>
        @page {
            size: A4;
            margin: 2cm;
            @top-center {
                content: " ";
            }
            @bottom-center {
                content: "- " counter(page) " -";
                font-size: 10px;
                margin-top: 10px;
            }
        }
        * {
            font-family: '맑은 고딕', 'Malgun Gothic', 'Apple SD Gothic Neo', 'Noto Sans CJK KR', sans-serif !important;
        }
        body {
            line-height: 1.6;
            color: #333;
            margin: 0;
            padding: 0;
            font-size: 12px;
        }
        .header {
            text-align: center;
            margin-bottom: 30px;
            border-bottom: 2px solid #333;
            padding-bottom: 20px;
        }
        .header h1 {
            font-size: 24px;
            font-weight: bold;
            margin: 0;
            color: #2c3e50;
        }
        .section {
            margin-bottom: 25px;
        }
        .section h2 {
            font-size: 16px;
            font-weight: bold;
            color: #34495e;
            padding-bottom: 5px;
            margin-bottom: 15px;
        }
        .info-item {
            margin: 8px 0;
            font-size: 12px;
            display: flex;
            align-items: flex-start;
        }
        .info-label {
            font-weight: bold;
            display: inline-block;
            width: 80px;
            flex-shrink: 0;
        }
        .info-content {
            margin: 5px 0 15px 0;
            word-wrap: break-word;
            overflow-wrap: break-word;
            font-size: 12px;
            white-space: pre-line;
        }
        table {
            width: 100%;
            border-collapse: collapse;
            margin: 15px 0;
            font-size: 11px;
        }
        th, td {
            border: 1px solid #bdc3c7;
            padding: 6px;
            text-align: left;
            vertical-align: top;
        }
        th {
            background-color: #ecf0f1;
            font-weight: bold;
        }
        .center-align {
            text-align: center;
        }
        .time-schedule-table {
            width: 100%;
        }
        .time-schedule-table th:nth-child(1),
        .time-schedule-table td:nth-child(1) {
            width: auto;
            min-width: 60px;
            max-width: 80px;
        }
        .time-schedule-table th:nth-child(2),
        .time-schedule-table td:nth-child(2) {
            width: 100%;
        }
        .time-schedule-table th:nth-child(3),
        .time-schedule-table td:nth-child(3) {
            width: auto;
            min-width: 60px;
            max-width: 80px;
        }
        .time-schedule-table th:nth-child(4),
        .time-schedule-table td:nth-child(4) {
            width: auto;
            min-width: 60px;
            max-width: 80px;
        }
        .attendee-table {
            width: 100%;
            border-collapse: collapse;
        }
        .attendee-table th,
        .attendee-table td {
            border: 1px solid #ddd;
            padding: 8px;
            text-align: center;
        }
        .attendee-table th:nth-child(1),
        .attendee-table td:nth-child(1) {
            width: 40px;
            min-width: 40px;
            max-width: 50px;
        }
        .attendee-table th:nth-child(2),
        .attendee-table td:nth-child(2) {
            width: 120px;
            min-width: 120px;
            max-width: 150px;
        }
        .attendee-table th:nth-child(3),
        .attendee-table td:nth-child(3) {
            width: 100px;
            min-width: 100px;
            max-width: 120px;
        }
        .attendee-table th:nth-child(4),
        .attendee-table td:nth-child(4) {
            width: 150px;
            min-width: 150px;
            max-width: 200px;
        }
        .attendee-table th:nth-child(5),
        .attendee-table td:nth-child(5) {
            width: auto;
            min-width: 200px;
            text-align: left;
        }
        .footer {
            text-align: center;
            margin-top: 40px;
            font-size: 10px;
            color: #7f8c8d;
            border-top: 1px solid #bdc3c7;
            padding-top: 10px;
        }
        @media print {
            body { 
                -webkit-print-color-adjust: exact;
                print-color-adjust: exact;
            }
        }
    </style>
</head>
<body>
    <div class="header">
        <h1>${safeText(this.currentData.session)} 전사 신기술 세미나 실행계획 </h1>
        <div style="text-align: right; margin-top: 10px; font-size: 12px;">${this.getCurrentDateString()}</div>
    </div>
    
    <div class="section">
        <h2>1. 목표</h2>
        <p class="info-content">${formatObjectiveHTML(safeText(this.currentData.objective))}</p>
        
        <h2>2. 일시/장소</h2>
        <p class="info-content">　　□ ${formatDateTime(safeText(this.currentData.datetime))} / ${safeText(this.currentData.location)}</p>
        
        <h2>3. 참석 대상</h2>
        <p class="info-content">　　□ ${safeText(this.currentData.attendees)}</p>
    </div>
`;

        // 시간 계획 테이블
        if (this.currentData.timeSchedule && this.currentData.timeSchedule.length > 0) {
            html += `
    <div class="section">
        <h2>4. 시간 계획</h2>
        <table class="time-schedule-table">
            <thead>
                <tr>
                    <th class="center-align">구분</th>
                    <th>주요 내용</th>
                    <th class="center-align">시간</th>
                    <th class="center-align">담당</th>
                </tr>
            </thead>
            <tbody>
`;
            // 구분 값 병합 처리를 위한 데이터 준비
            const processedSchedule = this.processTimeScheduleForMerging(this.currentData.timeSchedule);
            
            processedSchedule.forEach((item, index) => {
                // 병합된 행인지 확인
                if (item.isMergedRow) {
                    // 병합된 행은 구분 컬럼을 제외하고 나머지만 표시
                    html += `
                <tr>
                    <td>${formatContentHTML(safeText(item.content))}</td>
                    <td class="center-align">${safeText(item.time)}</td>
                    <td class="center-align">${safeText(item.responsible)}</td>
                </tr>
`;
                } else {
                    // 일반 행 또는 병합의 첫 번째 행
                    const typeCell = item.rowspan && item.rowspan > 1 ? 
                        `<td class="center-align" rowspan="${item.rowspan}">${safeText(item.type)}</td>` :
                        `<td class="center-align">${safeText(item.type)}</td>`;
                    
                    html += `
                <tr>
                    ${typeCell}
                    <td>${formatContentHTML(safeText(item.content))}</td>
                    <td class="center-align">${safeText(item.time)}</td>
                    <td class="center-align">${safeText(item.responsible)}</td>
                </tr>
`;
                }
            });
            html += `
            </tbody>
        </table>
        <div style="text-align: right; margin-top: 10px; font-size: 12px;">– 이 상 –</div>
    </div>
`;
            }
            
            // 참석자 명단 테이블
        if (this.currentData.attendeeList && this.currentData.attendeeList.length > 0) {
            html += `
    <div class="section" style="page-break-before: always;">
        <h2>[별첨] 세미나 참석 명단</h2>
        <table class="attendee-table">
            <thead>
                <tr>
                    <th class="center-align">No</th>
                    <th class="center-align">성명</th>
                    <th class="center-align">직급</th>
                    <th class="center-align">소속</th>
                    <th class="center-align">업무</th>
                </tr>
            </thead>
            <tbody>
`;
            this.currentData.attendeeList.forEach((item, index) => {
                html += `
                <tr>
                    <td class="center-align">${index + 1}</td>
                    <td class="center-align">${safeText(item.name)}</td>
                    <td class="center-align">${safeText(item.position)}</td>
                    <td class="center-align">${safeText(item.department)}</td>
                    <td class="center-align">${safeText(item.work)}</td>
                </tr>
`;
            });
            html += `
            </tbody>
        </table>
    </div>
`;
        }

        html += `
</body>
</html>
`;

        return html;
    }

    // 시간 계획 데이터를 병합 처리하는 함수
    processTimeScheduleForMerging(timeSchedule) {
        if (!timeSchedule || timeSchedule.length === 0) return [];
        
        const processed = [];
        let currentType = null;
        let currentGroup = [];
        
        timeSchedule.forEach((item, index) => {
            const itemType = item.type || '';
            
            if (itemType === currentType && currentType !== '') {
                // 같은 구분 값이면 그룹에 추가
                currentGroup.push(item);
            } else {
                // 다른 구분 값이면 이전 그룹 처리 후 새 그룹 시작
                if (currentGroup.length > 0) {
                    this.addMergedGroupToProcessed(processed, currentGroup);
                }
                currentGroup = [item];
                currentType = itemType;
            }
        });
        
        // 마지막 그룹 처리
        if (currentGroup.length > 0) {
            this.addMergedGroupToProcessed(processed, currentGroup);
        }
        
        return processed;
    }
    
    // 병합된 그룹을 처리된 배열에 추가하는 함수
    addMergedGroupToProcessed(processed, group) {
        if (group.length === 1) {
            // 그룹에 항목이 하나면 병합하지 않음
            processed.push({ ...group[0], rowspan: 1 });
        } else {
            // 그룹에 항목이 여러 개면 첫 번째 항목에 rowspan 설정
            processed.push({ ...group[0], rowspan: group.length });
            
            // 나머지 항목들은 구분 컬럼만 빈 값으로 설정하고 나머지는 그대로 유지
            for (let i = 1; i < group.length; i++) {
                processed.push({ 
                    ...group[i], 
                    type: '', 
                    rowspan: 1,
                    isMergedRow: true  // 병합된 행임을 표시
                });
            }
        }
    }

    // 현재 일자를 반환하는 함수 (예: 2025. 7. 15(화))
    getCurrentDateString() {
        const today = new Date();
        const year = today.getFullYear();
        const month = today.getMonth() + 1;
        const day = today.getDate();
        const weekdays = ['일', '월', '화', '수', '목', '금', '토'];
        const weekday = weekdays[today.getDay()];
        
        return `${year}. ${month}. ${day}(${weekday})`;
    }

    // UTF-8 텍스트를 안전하게 처리하는 함수 (한국어/영어 모두 지원)
    ensureUTF8Text(text) {
        if (!text) return '';
        
        // UTF-8 인코딩을 보장하고 안전한 문자만 허용
        return String(text)
            .replace(/[\u0000-\u001F\u007F-\u009F]/g, '') // 제어 문자 제거
            .replace(/[\uFEFF]/g, '') // BOM 제거
            .replace(/[\u200B-\u200D\uFEFF]/g, '') // Zero-width 문자 제거
            .trim();
    }

    // 기존 함수명 유지 (호환성)
    ensureKoreanText(text) {
        return this.ensureUTF8Text(text);
    }

    // UTF-8 텍스트를 PDF에 맞게 분할하는 헬퍼 함수 (한국어/영어 모두 지원)
    splitUTF8TextToFit(text, maxWidth) {
        if (!text) return [''];
        
        const safeText = this.ensureUTF8Text(text);
        if (!safeText) return [''];
        
        // UTF-8 텍스트를 문자 단위로 처리
        const lines = [];
        let currentLine = '';
        
        for (let i = 0; i < safeText.length; i++) {
            const char = safeText[i];
            const testLine = currentLine + char;
            
            // 대략적인 문자 폭 계산 (한글은 2배 폭으로 계산)
            const charWidth = this.getCharWidth(char);
            const lineWidth = this.getLineWidth(currentLine) + charWidth;
            
            if (lineWidth <= maxWidth) {
                currentLine = testLine;
            } else {
                if (currentLine) {
                    lines.push(currentLine);
                    currentLine = char;
                } else {
                    lines.push(char);
                }
            }
        }
        
        if (currentLine) {
            lines.push(currentLine);
        }
        
        return lines.length > 0 ? lines : [''];
    }

    // 기존 함수명 유지 (호환성)
    splitKoreanTextToFit(text, maxWidth) {
        return this.splitUTF8TextToFit(text, maxWidth);
    }

    // 문자 폭 계산 (한글은 2배 폭)
    getCharWidth(char) {
        const code = char.charCodeAt(0);
        // 한글 범위: 0xAC00-0xD7AF, 0x1100-0x11FF, 0x3130-0x318F
        if ((code >= 0xAC00 && code <= 0xD7AF) || 
            (code >= 0x1100 && code <= 0x11FF) || 
            (code >= 0x3130 && code <= 0x318F)) {
            return 2; // 한글은 2배 폭
        }
        return 1; // 영문, 숫자, 특수문자는 1배 폭
    }

    // 라인 폭 계산
    getLineWidth(line) {
        if (!line) return 0;
        return line.split('').reduce((width, char) => width + this.getCharWidth(char), 0);
    }

    // PDF용 텍스트 분할 함수 (한국어 지원)
    splitTextForPDF(text, maxWidth) {
        if (!text) return [''];
        
        const safeText = String(text);
        const lines = [];
        let currentLine = '';
        
        for (let i = 0; i < safeText.length; i++) {
            const char = safeText[i];
            const testLine = currentLine + char;
            
            // 대략적인 문자 폭 계산
            const charWidth = this.getCharWidth(char);
            const lineWidth = this.getLineWidth(currentLine) + charWidth;
            
            if (lineWidth <= maxWidth) {
                currentLine = testLine;
            } else {
                if (currentLine) {
                    lines.push(currentLine);
                    currentLine = char;
                } else {
                    lines.push(char);
                }
            }
        }
        
        if (currentLine) {
            lines.push(currentLine);
        }
        
        return lines.length > 0 ? lines : [''];
    }

    // 기존 텍스트 분할 함수 (호환성 유지)
    splitTextToFit(text, maxWidth) {
        if (!text) return [''];
        
        const words = text.split(' ');
        const lines = [];
        let currentLine = '';
        
        words.forEach(word => {
            const testLine = currentLine + (currentLine ? ' ' : '') + word;
            if (testLine.length * 2.5 <= maxWidth) { // 대략적인 폰트 크기 계산
                currentLine = testLine;
            } else {
                if (currentLine) {
                    lines.push(currentLine);
                    currentLine = word;
                } else {
                    lines.push(word);
                }
            }
        });
        
        if (currentLine) {
            lines.push(currentLine);
        }
        
        return lines.length > 0 ? lines : [''];
    }
 
    // 여러 세미나 데이터 일괄 저장 - 제거됨
    async saveMultipleSeminars(seminars) {
        return; // 엑셀 기능 제거됨
    }

    // 엑셀 데이터를 폼에 로드 - 제거됨
    async loadDataFromExcel(data) {
        return; // 엑셀 기능 제거됨
    }

    // 데이터 삭제 메서드
    async deleteData() {
        try {
            // 현재 데이터가 있는지 확인
            if (!this.currentData || !this.currentData.datetime) {
                this.showErrorToast('삭제할 데이터가 없습니다.');
                return;
            }

            // 사용자에게 삭제 확인
            if (!confirm(`정말로 "${this.currentData.datetime}" 세미나 계획을 삭제하시겠습니까?`)) {
                return;
            }

            this.showLoading(true);

            // Firebase에서 데이터 삭제
            if (this.currentDocumentId) {
                // 실행계획 데이터 삭제
                const result = await window.deleteData(this.currentDocumentId);
                
                // 실시결과 데이터도 삭제
                if (this.currentData.session && this.currentData.datetime) {
                    const keyValue = `${this.currentData.session}_${this.currentData.datetime}`;
                    // console.log('🗑️ 실시결과 데이터 삭제 시도:', keyValue);
                    
                    try {
                        if (useLocalStorage) {
                            // 로컬 스토리지에서 실시결과 데이터 삭제
                            const existingResults = JSON.parse(localStorage.getItem('seminarResults') || '{}');
                            delete existingResults[keyValue];
                            localStorage.setItem('seminarResults', JSON.stringify(existingResults));
                            // console.log('✅ 로컬 스토리지에서 실시결과 데이터 삭제 완료');
                        } else {
                            // Firebase에서 실시결과 데이터 삭제
                            await db.collection('seminarResults').doc(keyValue).delete();
                            // console.log('✅ Firebase에서 실시결과 데이터 삭제 완료');
                        }
                    } catch (error) {
                        console.error('실시결과 데이터 삭제 오류:', error);
                    }
                }
                
                if (result.success) {
                    this.showSuccessToast('데이터가 성공적으로 삭제되었습니다.');
                    
                    // 현재 데이터 초기화
                    this.currentData = {
                        session: '',
                        objective: '',
                        datetime: '',
                        location: '',
                        attendees: '',
                        timeSchedule: [],
                        attendeeList: [],
                        sketches: []
                    };
                    this.currentDocumentId = null;
                    
                    // 원본 회차/일시 초기화
                    this.originalSession = null;
                    this.originalDatetime = null;
                    
                    // 폼 초기화
                    this.initializeMainForm();
                    
                    // 실시결과 폼도 초기화
                    this.clearMainResultForm();
                } else {
                    this.showErrorToast(`데이터 삭제 실패: ${result.error}`);
                }
            } else {
                // 로컬 스토리지에서 데이터 삭제
                localStorage.removeItem('seminarData');
                
                // 실시결과 데이터도 삭제
                if (this.currentData.session && this.currentData.datetime) {
                    const keyValue = `${this.currentData.session}_${this.currentData.datetime}`;
                    // console.log('🗑️ 로컬 스토리지에서 실시결과 데이터 삭제 시도:', keyValue);
                    
                    try {
                        const existingResults = JSON.parse(localStorage.getItem('seminarResults') || '{}');
                        delete existingResults[keyValue];
                        localStorage.setItem('seminarResults', JSON.stringify(existingResults));
                        // console.log('✅ 로컬 스토리지에서 실시결과 데이터 삭제 완료');
                    } catch (error) {
                        console.error('실시결과 데이터 삭제 오류:', error);
                    }
                }
                
                this.showSuccessToast('데이터가 성공적으로 삭제되었습니다.');
                
                // 현재 데이터 초기화
                this.currentData = {
                    session: '',
                    objective: '',
                    datetime: '',
                    location: '',
                    attendees: '',
                    timeSchedule: [],
                    attendeeList: [],
                    sketches: []
                };
                this.currentDocumentId = null;
                
                // 원본 회차/일시 초기화
                this.originalSession = null;
                this.originalDatetime = null;
                
                // 폼 초기화
                this.initializeMainForm();
                
                // 실시결과 폼도 초기화
                this.clearMainResultForm();
            }
        } catch (error) {
            console.error('데이터 삭제 오류:', error);
            this.showErrorToast(`데이터 삭제 실패: ${error.message}`);
        } finally {
            this.showLoading(false);
        }
    }









    // PDF 실시결과 내보내기
    async exportResultToPDF() {
        try {
            this.showLoading(true);
            
            // 현재 세미나 정보 가져오기
            const sessionSelect = document.getElementById('sessionSelect').value;
            const sessionInput = document.getElementById('sessionInput').value;
            const session = sessionSelect || sessionInput;
            const datetime = document.getElementById('datetime').value;
            
            if (!session || !datetime) {
                this.showErrorToast('먼저 세미나 정보를 입력해주세요.');
                this.showLoading(false);
                return;
            }
            
            let resultData = await loadResultDataByKey(session, datetime);
            
            if (!resultData) {
                const mainResultData = this.getMainResultData();
                resultData = {
                    session: session,
                    datetime: datetime,
                    objective: mainResultData.objective || '목표가 등록되지 않았습니다.',
                    mainContent: mainResultData.mainContent || '실시결과가 등록되지 않았습니다.',
                    futurePlan: mainResultData.futurePlan || '향후 계획이 등록되지 않았습니다.',
                    sketches: mainResultData.sketches.map(sketch => ({
                        title: sketch.title,
                        imageData: null, // 파일은 나중에 처리
                        fileName: sketch.file.name
                    }))
                };
            }
            
            this.waitForPDFMake().then(() => {
                this.exportResultToPDFWithPDFMake(resultData);
            }).catch(() => {
                this.exportResultToPDFWithHTML(resultData);
            });
            
        } catch (error) {
            console.error('PDF 실시결과 내보내기 오류:', error);
            this.showErrorToast('PDF 실시결과 내보내기 중 오류가 발생했습니다.');
            this.showLoading(false);
        }
    }

    // PDFMake를 사용한 실시결과 PDF 생성
    exportResultToPDFWithPDFMake(resultData) {
        try {
            if (!window.pdfMake) {
                this.exportResultToPDFWithHTML(resultData);
                return;
            }
            
            // 현재 세미나 정보
            const session = resultData.session;
            const datetime = resultData.datetime;
            const location = document.getElementById('location').value || '미입력';
            const attendeeTarget = document.getElementById('attendees').value || '미입력';
            
            // PDF 문서 정의
            const docDefinition = {
                pageSize: 'A4',
                pageMargins: [40, 60, 40, 60],
                footer: function(currentPage, pageCount) {
                    return {
                        text: `- ${currentPage} -`,
                        alignment: 'center',
                        fontSize: 10,
                        margin: [0, 10, 0, 0]
                    };
                },
                content: [
                    // 제목
                    {
                        text: `${session} 전사 신기술 세미나 실시 결과`,
                        fontSize: 18,
                        bold: true,
                        alignment: 'center',
                        margin: [0, 0, 0, 30]
                    },
                    
                    // 1. 개요
                    {
                        text: '1. 개요',
                        fontSize: 14,
                        bold: true,
                        margin: [0, 0, 0, 10]
                    },
                    {
                        columns: [
                            {
                                text: '　　□ 일시/장소:',
                                width: 'auto'
                            },
                            {
                                text: `${datetime} / ${location}`,
                                width: '*'
                            }
                        ],
                        margin: [0, 0, 0, 5]
                    },
                    {
                        columns: [
                            {
                                text: '　　□ 참석 인력:',
                                width: 'auto'
                            },
                            {
                                text: attendeeTarget,
                                width: '*'
                            }
                        ],
                        margin: [0, 0, 0, 20]
                    },
                    
                    // 2. 주요 내용
                    {
                        text: '2. 주요 내용',
                        fontSize: 14,
                        bold: true,
                        margin: [0, 0, 0, 10]
                    },
                    {
                        text: this.parseMainContent(resultData.mainContent),
                        margin: [0, 0, 0, 20],
                        preserveLeadingSpaces: true
                    },
                    
                    // 3. 향후 계획
                    {
                        text: '3. 향후 계획',
                        fontSize: 14,
                        bold: true,
                        margin: [0, 0, 0, 10]
                    },
                    {
                        text: this.parseMainContent(resultData.futurePlan),
                        margin: [0, 0, 0, 20],
                        preserveLeadingSpaces: true
                    },
                    { text: '- 이 상 –', alignment: 'right', fontSize: 10, margin: [0, 0, 0, 20] }
                ],
                styles: {
                    header: {
                        fontSize: 16,
                        bold: true,
                        margin: [0, 0, 0, 10]
                    }
                }
            };
            
            // 참석자 명단 데이터 가져오기 (참석여부가 Y인 대상만)
            const attendeeList = this.getAttendeeData().filter(attendee => attendee.attendance === 'Y');
            
            // 참석자 명단 추가 (새 페이지)
            if (attendeeList && attendeeList.length > 0) {
                const attendeeTable = {
                    table: {
                        headerRows: 1,
                        widths: ['auto', '*', '*', '*', '*'],
                        body: [
                            [
                                { text: 'No', alignment: 'center' },
                                { text: '성명', alignment: 'center' },
                                { text: '직급', alignment: 'center' },
                                { text: '소속', alignment: 'center' },
                                { text: '업무', alignment: 'left' }
                            ],
                            ...attendeeList.map((attendee, index) => [
                                { text: (index + 1).toString(), alignment: 'center' },
                                { text: attendee.name || '미입력', alignment: 'center' },
                                { text: attendee.position || '미입력', alignment: 'center' },
                                { text: attendee.department || '미입력', alignment: 'center' },
                                { text: attendee.work || '미입력', alignment: 'left' }
                            ])
                        ]
                    },
                    layout: 'lightHorizontalLines',
                    margin: [0, 0, 0, 20]
                };
                
                docDefinition.content.push(
                    { text: '', pageBreak: 'before' },
                    { text: '[별첨 1] 세미나 참석명단', style: 'header' },
                    attendeeTable
                );
            }
            
            // 스케치 추가 (새 페이지, 첨부형식) - 세로로 1개씩, 한 페이지에 3개
            if (resultData.sketches && resultData.sketches.length > 0) {
                docDefinition.content.push(
                    { text: '', pageBreak: 'before' },
                    { text: '[별첨 2] 세미나 스케치', style: 'header' },
                );
                
                const validSketches = resultData.sketches.filter(sketch => sketch.title && sketch.imageData);
                
                // 3개씩 그룹으로 나누어 처리
                for (let i = 0; i < validSketches.length; i += 3) {
                    const sketchGroup = validSketches.slice(i, i + 3);
                    
                    // 첫 번째 그룹이 아니면 새 페이지
                    if (i > 0) {
                        docDefinition.content.push({ text: '', pageBreak: 'before' });
                    }
                    
                    // 각 그룹의 스케치들을 세로로 배치
                    sketchGroup.forEach((sketch, groupIndex) => {
                        const globalIndex = i + groupIndex + 1;
                        
                        docDefinition.content.push(
                            {
                                text: `${globalIndex}. ${sketch.title}`,
                                fontSize: 10,
                                bold: true,
                                margin: [0, 5, 0, 3],
                                alignment: 'center'
                            },
                            {
                                table: {
                                    widths: [360],
                                    body: [[{
                                        border: [true, true, true, true],
                                        borderColor: '#CCCCCC',
                                        borderWidth: 1,
                                        cellPadding: 1,
                                        stack: [{
                                            image: sketch.imageData,
                                            width: 350,
                                            height: 220,
                                            fit: [350, 220],
                                            alignment: 'center'
                                        }]
                                    }]]
                                },
                                layout: 'noBorders',
                                margin: [15, 15, 15, 15] // 상하좌우 균일한 15px 여백
                            }
                        );
                    });
                }
            }
            
            // PDF 생성 및 다운로드
            const currentDate = new Date();
            const dateString = currentDate.getFullYear().toString() + 
                              (currentDate.getMonth() + 1).toString().padStart(2, '0') + 
                              currentDate.getDate().toString().padStart(2, '0');
            pdfMake.createPdf(docDefinition).download(`${dateString} 전사 신기술 세미나 실시결과.pdf`);
            this.showSuccessToast('PDF 실시결과가 성공적으로 생성되었습니다.');
            this.showLoading(false);
            
        } catch (error) {
            console.error('PDFMake 실시결과 PDF 생성 오류:', error);
            this.showLoading(false);
            this.exportResultToPDFWithHTML(resultData);
        }
    }

    // HTML to PDF 방식으로 실시결과 내보내기
    exportResultToPDFWithHTML(resultData) {
        try {
            const htmlContent = this.generateResultPDFHTML(resultData);
            
            // 새 창에서 HTML 열기
            const newWindow = window.open('', '_blank');
            if (!newWindow) {
                this.showErrorToast('팝업이 차단되었습니다. 브라우저에서 팝업을 허용해주세요.');
                this.showLoading(false);
                return;
            }
            
            newWindow.document.write(htmlContent);
            newWindow.document.close();
            
            // 문서 제목 설정(저장 시 기본 파일명으로 사용)
            const currentDate = new Date();
            const dateString = currentDate.getFullYear().toString() + 
                              (currentDate.getMonth() + 1).toString().padStart(2, '0') + 
                              currentDate.getDate().toString().padStart(2, '0');
            newWindow.document.title = `${dateString} 전사 신기술 세미나 실시결과.pdf`;
            
            // 인쇄 대화상자 호출(사용자는 PDF로 저장 선택)
            setTimeout(() => {
                newWindow.print();
                this.showSuccessToast('인쇄 대화상자가 열렸습니다. "PDF로 저장"을 선택하세요.');
            }, 500);
        } catch (error) {
            console.error('HTML to PDF 실시결과 내보내기 오류:', error);
            this.showErrorToast('PDF 실시결과 내보내기 중 오류가 발생했습니다.');
        } finally {
            this.showLoading(false);
        }
    }

    // 주요 내용 텍스트 파싱 함수
    parseMainContent(text) {
        if (!text) return '미입력';
        
        // console.log('원본 텍스트:', text);
        
        // 텍스트를 줄바꿈으로 분리
        const lines = text.split('\n');
        const result = [];
        
        for (let line of lines) {
            const trimmedLine = line.trim();
            if (!trimmedLine) continue;
            
            // □ 로 시작하는 경우 (공백 포함)
            if (trimmedLine.startsWith('□ ')) {
                const content = trimmedLine.substring(2).trim();
                result.push(`　　□ ${content}`);
            }
            // - 로 시작하는 경우 (공백 포함)
            else if (trimmedLine.startsWith('- ')) {
                const content = trimmedLine.substring(2).trim();
                result.push(`　　　　- ${content}`);
            }
            // □ 로 시작하는 경우 (공백 없음)
            else if (trimmedLine.startsWith('□')) {
                const content = trimmedLine.substring(1).trim();
                result.push(`　　${content}`);
            }
            // - 로 시작하는 경우 (공백 없음)
            else if (trimmedLine.startsWith('-')) {
                const content = trimmedLine.substring(1).trim();
                result.push(`　　　　- ${content}`);
            }
            // 일반 텍스트인 경우
            else {
                result.push(`　　□ ${trimmedLine}`);
            }
        }
        
        // console.log('파싱 결과:', result);
        return result.join('\n');
    }

    // 참석자 데이터 가져오기
    getAttendeeData() {
        const attendeeRows = document.querySelectorAll('#attendeeTableBody tr');
        const attendees = [];
        
        attendeeRows.forEach(row => {
            const cells = row.querySelectorAll('td');
            if (cells.length >= 6) { // 참석여부 컬럼 추가로 6개 컬럼
                const name = cells[1].querySelector('input')?.value || '';
                
                // 직급 필드 처리 (select 또는 input)
                let position = '';
                const positionSelect = cells[2].querySelector('select');
                const positionInput = cells[2].querySelector('input');
                
                if (positionSelect) {
                    position = positionSelect.value || '';
                if (position === '직접입력') {
                    const customPosition = cells[2].querySelector('input[data-field="position-custom"]')?.value || '';
                    position = customPosition;
                    }
                } else if (positionInput) {
                    position = positionInput.value || '';
                }
                
                // 소속 필드 처리 (select 또는 input)
                let department = '';
                const departmentSelect = cells[3].querySelector('select');
                const departmentInput = cells[3].querySelector('input');
                
                if (departmentSelect) {
                    department = departmentSelect.value || '';
                if (department === '직접입력') {
                    const customDepartment = cells[3].querySelector('input[data-field="department-custom"]')?.value || '';
                    department = customDepartment;
                    }
                } else if (departmentInput) {
                    department = departmentInput.value || '';
                }
                
                // 업무 필드 처리 (select 또는 input)
                let work = '';
                const workSelect = cells[4].querySelector('select');
                const workInput = cells[4].querySelector('input');
                
                if (workSelect) {
                    work = workSelect.value || '';
                if (work === '직접입력') {
                    const customWork = cells[4].querySelector('input[data-field="work-custom"]')?.value || '';
                    work = customWork;
                    }
                } else if (workInput) {
                    work = workInput.value || '';
                }
                
                const attendance = cells[5].querySelector('select')?.value || 'N'; // 참석여부 값 가져오기
                
                if (name.trim()) {
                    attendees.push({
                        name: name.trim(),
                        position: position.trim(),
                        department: department.trim(),
                        work: work.trim(),
                        attendance: attendance // 참석여부 필드 추가
                    });
                }
            }
        });
        
        return attendees;
    }

    // 스케치 업로드 추가
    addSketchUpload() {
        const container = document.getElementById('sketchUploadContainer');
        
        // 현재 실제로 존재하는 스케치 개수 확인 (메인 컨테이너만)
        const existingSketches = container.querySelectorAll('div[data-sketch-index]');
        const currentCount = existingSketches.length;
        
        // console.log('addSketchUpload 호출됨, 현재 개수:', currentCount);
        
        // 기존 인덱스들을 확인하여 연속된 인덱스 찾기
        const existingIndices = Array.from(existingSketches).map(sketch => 
            parseInt(sketch.getAttribute('data-sketch-index'))
        ).sort((a, b) => a - b);
        
        // console.log('기존 인덱스들:', existingIndices);
        
        // 연속된 인덱스 중 가장 작은 빈 인덱스 찾기
        let nextIndex = 0;
        for (let i = 0; i < existingIndices.length; i++) {
            if (existingIndices[i] !== i) {
                nextIndex = i;
                break;
            }
            nextIndex = i + 1;
        }
        
        // console.log('다음 인덱스:', nextIndex);
        
        const sketchDiv = document.createElement('div');
        sketchDiv.className = 'border border-gray-200 rounded-lg p-4';
        sketchDiv.setAttribute('data-sketch-index', nextIndex);
        
        sketchDiv.innerHTML = `
            <div class="flex justify-between items-center mb-3">
                <h3 class="text-md font-medium text-gray-700 flex items-center">
                    <i class="fas fa-image text-orange-500 mr-2"></i>
                    스케치 업로드
                </h3>
                <button type="button" class="removeSketchBtn bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white px-3 py-1.5 rounded-lg shadow-md hover:shadow-lg transform hover:-translate-y-0.5 transition-all duration-200 flex items-center justify-center" data-sketch-index="${nextIndex}">
                    <i class="fas fa-trash mr-1"></i>삭제
                </button>
            </div>
            <div class="space-y-3">
                <div>
                    <label class="block mb-2">
                        <span class="inline-flex items-center px-3 py-1.5 rounded-full bg-gradient-to-r from-indigo-500 to-blue-500 text-white text-xs font-semibold shadow-sm">
                            <i class="fas fa-heading mr-2"></i>업로드 제목
                        </span>
                    </label>
                    <input type="text" id="mainSketchTitle${nextIndex}" class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent" placeholder="스케치 제목을 입력하세요">
                </div>
                <div>
                    <label class="block mb-2">
                        <span class="inline-flex items-center px-3 py-1.5 rounded-full bg-gradient-to-r from-purple-500 to-fuchsia-500 text-white text-xs font-semibold shadow-sm">
                            <i class="fas fa-file-image mr-2"></i>이미지 파일
                        </span>
                    </label>
                    <div class="border-2 border-dashed border-gray-300 rounded-lg p-4 text-center hover:border-orange-400 transition-colors duration-200">
                        <input type="file" id="mainSketchFile${nextIndex}" accept="image/*" class="hidden">
                        <div id="mainFileUploadArea${nextIndex}" class="cursor-pointer">
                            <i class="fas fa-cloud-upload-alt text-3xl text-gray-400 mb-2"></i>
                            <p class="text-gray-600 text-sm mb-1">클릭하여 이미지를 선택하세요</p>
                            <p class="text-xs text-gray-500">JPG, PNG, GIF 파일만 업로드 가능합니다</p>
                        </div>
                        <div id="mainFilePreview${nextIndex}" class="hidden mt-3">
                            <img id="mainPreviewImage${nextIndex}" class="max-w-full max-h-32 mx-auto rounded-lg shadow-md">
                            <p id="mainFileName${nextIndex}" class="text-xs text-gray-600 mt-2"></p>
                            <div class="mt-2 flex justify-center space-x-2">
                                <button type="button" id="mainDownloadFile${nextIndex}" class="bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white text-xs px-3 py-1.5 rounded-lg shadow-md hover:shadow-lg transform hover:-translate-y-0.5 transition-all duration-200 flex items-center justify-center">
                                    <i class="fas fa-download mr-1"></i>파일 다운로드
                                </button>
                                <button type="button" id="mainRemoveFile${nextIndex}" class="bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white text-xs px-3 py-1.5 rounded-lg shadow-md hover:shadow-lg transform hover:-translate-y-0.5 transition-all duration-200 flex items-center justify-center">
                                    <i class="fas fa-trash mr-1"></i>파일 제거
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        container.appendChild(sketchDiv);
        // console.log('스케치 DOM 추가 완료, 인덱스:', nextIndex);
        
        // 추가 후 스케치 개수 확인
        const afterSketches = container.querySelectorAll('[data-sketch-index]');
        // console.log('추가 후 스케치 개수:', afterSketches.length);
        
        // currentData.sketches는 데이터 로드 시에만 설정 (여기서는 설정하지 않음)
        
        this.showSuccessToast('스케치 업로드가 추가되었습니다.');
    }
    
    // 스케치 업로드 삭제 (제약사항 없이 모든 스케치 삭제 가능)
    removeSketchUpload(sketchIndex) {
        // console.log('🗑️ removeSketchUpload 호출됨, sketchIndex:', sketchIndex);
        
        const container = document.getElementById('sketchUploadContainer');
        const existingSketches = container.querySelectorAll('[data-sketch-index]');
        const currentCount = existingSketches.length;
        
        // console.log(`📊 삭제 전 스케치 개수: ${currentCount}`);
        
        // 삭제 확인 메시지
        if (!confirm('스케치 업로드를 삭제하시겠습니까?')) {
            return;
        }
        
        const sketchDiv = container.querySelector(`div[data-sketch-index="${sketchIndex}"]`);
            if (sketchDiv) {
                // console.log(`🗑️ 스케치 인덱스 ${sketchIndex} 삭제 시작`);
                
                // DOM에서 완전히 제거
                sketchDiv.remove();
                // console.log(`✅ 스케치 ${sketchIndex} DOM에서 제거됨`);
                
            // currentData.sketches는 데이터 로드 시에만 관리 (여기서는 제거하지 않음)
                
                // 간단한 인덱스 재정렬
                this.reindexSketchesSimple();
                
                // 삭제 후 현재 스케치 개수 확인
            const remainingSketches = container.querySelectorAll('div[data-sketch-index]');
                const remainingCount = remainingSketches.length;
                // console.log(`📊 삭제 후 남은 스케치 개수: ${remainingCount}`);
                // console.log(`📊 삭제 후 남은 스케치 인덱스:`, Array.from(remainingSketches).map(s => s.getAttribute('data-sketch-index')));
            
            // 스케치가 없으면 빈 상태 유지 (자동 추가하지 않음)
            if (remainingCount === 0) {
                // console.log('ℹ️ 모든 스케치가 삭제됨, 빈 상태 유지');
            }
                
                this.showSuccessToast('스케치 업로드가 삭제되었습니다.');
            } else {
                // console.log(`❌ 스케치 인덱스 ${sketchIndex}을 찾을 수 없음`);
        }
    }
    
    // 간단한 스케치 인덱스 재정렬
    reindexSketchesSimple() {
        const container = document.getElementById('sketchUploadContainer');
        const sketches = Array.from(container.querySelectorAll('div[data-sketch-index]'));
        
        // console.log(`🔄 간단한 스케치 재정렬 시작, 총 ${sketches.length}개 스케치`);
        
        if (sketches.length === 0) {
            // console.log('⚠️ 재정렬할 스케치가 없음');
            return;
        }
        
        // 각 스케치의 인덱스를 0부터 순차적으로 재설정
        sketches.forEach((sketch, newIndex) => {
            const oldIndex = parseInt(sketch.getAttribute('data-sketch-index'));
            
            // 인덱스가 이미 올바르면 건너뛰기
            if (oldIndex === newIndex) {
                return;
            }
            
            // console.log(`🔄 스케치 인덱스 ${oldIndex} -> ${newIndex}로 재정렬`);
            
            // data-sketch-index 속성 업데이트
            sketch.setAttribute('data-sketch-index', newIndex);
            
            // 모든 관련 ID들 업데이트
            const elementsToUpdate = [
                'mainSketchTitle', 'mainSketchFile', 'mainFileUploadArea', 
                'mainFilePreview', 'mainPreviewImage', 'mainFileName', 
                'mainRemoveFile', 'mainDownloadFile'
            ];
            
            elementsToUpdate.forEach(prefix => {
                const element = sketch.querySelector(`#${prefix}${oldIndex}`);
                if (element) {
                    element.id = `${prefix}${newIndex}`;
                }
            });
            
            // 삭제 버튼의 data-sketch-index 속성 업데이트
            const removeBtn = sketch.querySelector('.removeSketchBtn');
            if (removeBtn) {
                removeBtn.setAttribute('data-sketch-index', newIndex);
            }
        });
        
        // currentData.sketches는 데이터 로드 시에만 관리 (여기서는 재정렬하지 않음)
        
        // console.log(`✅ 간단한 스케치 재정렬 완료, 총 ${sketches.length}개 스케치`);
    }
    
    

    // 메인화면 파일 업로드 처리
    handleMainFileUpload(event, sketchIndex) {
        const file = event.target.files[0];
        if (file) {
            // 파일 타입 검증
            if (!file.type.startsWith('image/')) {
                this.showErrorToast('이미지 파일만 업로드 가능합니다.');
                return;
            }
            
            // 파일 크기 검증 (5MB 제한)
            if (file.size > 5 * 1024 * 1024) {
                this.showErrorToast('파일 크기는 5MB 이하여야 합니다.');
                return;
            }
            
            // 파일 미리보기
            const reader = new FileReader();
            reader.onload = (e) => {
                document.getElementById(`mainPreviewImage${sketchIndex}`).src = e.target.result;
                document.getElementById(`mainFileName${sketchIndex}`).textContent = file.name;
                document.getElementById(`mainFilePreview${sketchIndex}`).classList.remove('hidden');
                document.getElementById(`mainFileUploadArea${sketchIndex}`).classList.add('hidden');
                
                // 스케치 빠른 저장 버튼 상태 업데이트
                this.toggleQuickSaveSketchButton();
            };
            reader.readAsDataURL(file);
        }
    }

    // 메인화면 파일 제거
    removeMainFile(sketchIndex) {
        document.getElementById(`mainSketchFile${sketchIndex}`).value = '';
        document.getElementById(`mainFilePreview${sketchIndex}`).classList.add('hidden');
        document.getElementById(`mainFileUploadArea${sketchIndex}`).classList.remove('hidden');
        
        // 스케치 빠른 저장 버튼 상태 업데이트
        this.toggleQuickSaveSketchButton();
    }

    // 메인화면 스케치 파일 다운로드
    downloadMainFile(sketchIndex) {
        try {
            const previewImg = document.getElementById(`mainPreviewImage${sketchIndex}`);
            const fileName = document.getElementById(`mainFileName${sketchIndex}`);
            
            if (!previewImg || !previewImg.src) {
                this.showErrorToast('다운로드할 이미지가 없습니다.');
                return;
            }
            
            // Base64 이미지 데이터에서 파일명 추출
            const displayFileName = fileName ? fileName.textContent : `스케치${sketchNumber}.jpg`;
            
            // Base64 데이터를 Blob으로 변환
            const base64Data = previewImg.src;
            const byteCharacters = atob(base64Data.split(',')[1]);
            const byteNumbers = new Array(byteCharacters.length);
            
            for (let i = 0; i < byteCharacters.length; i++) {
                byteNumbers[i] = byteCharacters.charCodeAt(i);
            }
            
            const byteArray = new Uint8Array(byteNumbers);
            const blob = new Blob([byteArray], { type: 'image/jpeg' });
            
            // 다운로드 링크 생성
            const url = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = displayFileName;
            
            // 다운로드 실행
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            
            // URL 해제
            window.URL.revokeObjectURL(url);
            
            this.showSuccessToast(`${displayFileName} 파일이 다운로드되었습니다.`);
            
        } catch (error) {
            console.error('파일 다운로드 오류:', error);
            this.showErrorToast('파일 다운로드 중 오류가 발생했습니다.');
        }
    }

    // 메인화면 실시결과 데이터 가져오기
    getMainResultData() {
        return {
            mainContent: document.getElementById('mainResultContent').value.trim(),
            futurePlan: document.getElementById('mainResultFuturePlan').value.trim(),
            sketches: this.getMainSketchData()
        };
    }

    // 메인화면 스케치 데이터 가져오기 (제약사항 없이 모든 스케치 포함)
    getMainSketchData() {
        const sketches = [];
        const container = document.getElementById('sketchUploadContainer');
        
        // 실제로 DOM에 존재하는 스케치 요소만 찾기 (메인 컨테이너만)
        const sketchElements = container.querySelectorAll('div[data-sketch-index]');
        
        // console.log('🔍 DOM에서 찾은 스케치 요소 개수:', sketchElements.length);
        
        // DOM 순서대로 스케치 데이터 수집
        sketchElements.forEach((sketchElement, domIndex) => {
            const sketchIndex = sketchElement.getAttribute('data-sketch-index');
            const title = document.getElementById(`mainSketchTitle${sketchIndex}`)?.value?.trim() || '';
            const file = document.getElementById(`mainSketchFile${sketchIndex}`)?.files[0];
            const previewImg = document.getElementById(`mainPreviewImage${sketchIndex}`);
            
            // 모든 스케치를 포함 (제약사항 없음)
            const imageData = previewImg?.src || '';
            const fileName = file?.name || document.getElementById(`mainFileName${sketchIndex}`)?.textContent?.trim() || '';
            
            // DOM 순서대로 스케치 데이터 저장
            sketches[domIndex] = {
                    title: title,
                    imageData: imageData,
                fileName: fileName
            };
            
            // console.log(`✅ 스케치 DOM순서 ${domIndex} (인덱스 ${sketchIndex}) 추가:`, { title, hasImageData: !!imageData, fileName });
        });
        
        // console.log('📊 getMainSketchData 최종 결과 (모든 스케치 포함):', sketches);
        return sketches;
    }

    // 메인화면 실시결과 데이터 로드
    async loadMainResultData() {
        try {
            const session = document.getElementById('sessionSelect').value || document.getElementById('sessionInput').value;
            const datetime = document.getElementById('datetime').value;
            
            // console.log('🔍 메인화면 실시결과 데이터 로드 시도:', { session, datetime });
            
            // 세미나 정보가 없어도 currentData에서 스케치 정보를 확인
            if (!session || !datetime) {
                // console.log('⚠️ 세미나 정보가 없지만 currentData에서 스케치 정보 확인');
                
                // currentData에 스케치 정보가 있으면 표시
                if (this.currentData && this.currentData.sketches && this.currentData.sketches.length > 0) {
                    // console.log('✅ currentData에서 스케치 정보 발견:', this.currentData.sketches);
                    this.populateMainResultForm({ sketches: this.currentData.sketches });
                    return;
                }
                
                // console.log('ℹ️ currentData에도 스케치 정보가 없음, 기존 상태 유지');
                // this.clearMainResultForm(); // 주석 처리하여 기존 스케치 유지
                return;
            }
            
            // 특정 회차_일시의 실시결과 데이터 조회
            const resultData = await loadResultDataByKey(session, datetime);
            // console.log('📊 조회된 실시결과 데이터:', resultData);
            // console.log('📊 resultData.objective:', resultData ? resultData.objective : 'null');
            
            if (resultData) {
                // console.log('✅ 기존 실시결과 데이터 발견, 메인화면에 로드:', resultData);
                this.populateMainResultForm(resultData);
            } else {
                // console.log('ℹ️ 기존 실시결과 데이터가 없음, currentData에서 스케치 정보 확인');
                
                // currentData에 스케치 정보가 있으면 표시
                if (this.currentData && this.currentData.sketches && this.currentData.sketches.length > 0) {
                    // console.log('✅ currentData에서 스케치 정보 발견:', this.currentData.sketches);
                    this.populateMainResultForm({ sketches: this.currentData.sketches });
                } else {
                    // console.log('ℹ️ currentData에도 스케치 정보가 없음, 기존 상태 유지');
                }
            }
            
        } catch (error) {
            console.error('메인화면 실시결과 데이터 로드 오류:', error);
        }
    }

    // 메인화면 실시결과 폼에 데이터 채우기
    populateMainResultForm(resultData) {
        // console.log('📝 메인화면 폼에 데이터 채우기:', resultData);
        
        try {
            // 주요 내용, 향후 계획 채우기
            const mainContentEl = document.getElementById('mainResultContent');
            const futurePlanEl = document.getElementById('mainResultFuturePlan');
            
            if (mainContentEl) {
                if (Object.prototype.hasOwnProperty.call(resultData, 'mainContent')) {
                    // 값이 존재(빈 문자열 포함)하면 해당 값 반영
                    mainContentEl.value = resultData.mainContent || '';
                    if (resultData.mainContent) {
                        // console.log('✅ 주요 내용 설정 (실시결과 데이터):', resultData.mainContent);
                    } else {
                        // console.log('ℹ️ 실시결과 데이터에 주요 내용이 비어있음, 빈 값 반영');
                    }
                } else {
                    // partial 업데이트 시 기존 값 유지
                    // console.log('↩️ 주요 내용 키가 없어 기존 값 유지');
                }
                // PDF 실시결과 내보내기 버튼 상태 업데이트
                this.toggleExportResultPDFButton();
            }
            
            if (futurePlanEl) {
                if (Object.prototype.hasOwnProperty.call(resultData, 'futurePlan')) {
                    // 값이 존재(빈 문자열 포함)하면 해당 값 반영
                    futurePlanEl.value = resultData.futurePlan || '';
                    if (resultData.futurePlan) {
                        // console.log('✅ 향후 계획 설정 (실시결과 데이터):', resultData.futurePlan);
                    } else {
                        // console.log('ℹ️ 실시결과 데이터에 향후 계획이 비어있음, 빈 값 반영');
                    }
                } else {
                    // partial 업데이트 시 기존 값 유지
                    // console.log('↩️ 향후 계획 키가 없어 기존 값 유지');
                }
            }
            
            // 스케치 데이터 처리 (제약사항 없이 모든 스케치 처리)
            if (resultData.sketches && Array.isArray(resultData.sketches)) {
                // console.log('🖼️ 스케치 데이터 처리:', resultData.sketches);
                
                // 모든 스케치 데이터 처리 (제약사항 없음, 빈 스케치도 포함)
                const allSketches = resultData.sketches || [];
                // console.log('📊 처리할 스케치 데이터:', allSketches);
                
                // 스케치 초기화 먼저 실행 (기본 스케치 추가하지 않음)
                this.resetSketchesWithoutDefault();
                
                // 스케치 개수에 맞춰 스케치 생성
                for (let i = 0; i < allSketches.length; i++) {
                    this.addSketchUpload();
                }
                
                // 스케치 데이터 설정 - DOM 순서대로 설정
                const container = document.getElementById('sketchUploadContainer');
                const sketchElements = container.querySelectorAll('div[data-sketch-index]');
                
                // DOM 인덱스 순서대로 스케치 데이터 설정
                const sortedSketchElements = Array.from(sketchElements).sort((a, b) => {
                    return parseInt(a.getAttribute('data-sketch-index')) - parseInt(b.getAttribute('data-sketch-index'));
                });
                
                sortedSketchElements.forEach((sketchElement, domIndex) => {
                    const actualIndex = sketchElement.getAttribute('data-sketch-index');
                    const sketch = allSketches[domIndex];
                    
                    if (sketch) {
                        // console.log(`스케치 데이터 ${domIndex}를 DOM 인덱스 ${actualIndex}에 설정`);
                        
                        // 제목 설정
                        const titleEl = document.getElementById(`mainSketchTitle${actualIndex}`);
                        if (titleEl) {
                            titleEl.value = sketch.title || '';
                            // console.log(`✅ 스케치 ${actualIndex} 제목 설정:`, sketch.title);
                        }
                        
                        // 이미지 데이터 설정 (있으면 표시, 없으면 빈 상태 유지)
                            const previewImg = document.getElementById(`mainPreviewImage${actualIndex}`);
                            const fileName = document.getElementById(`mainFileName${actualIndex}`);
                            const preview = document.getElementById(`mainFilePreview${actualIndex}`);
                            const uploadArea = document.getElementById(`mainFileUploadArea${actualIndex}`);
                            
                        if (sketch.imageData && sketch.imageData.trim() !== '') {
                            // 이미지가 있으면 표시
                            if (previewImg) previewImg.src = sketch.imageData;
                            if (fileName) fileName.textContent = sketch.fileName || '업로드된 이미지';
                            if (preview) preview.classList.remove('hidden');
                            if (uploadArea) uploadArea.classList.add('hidden');
                            // console.log(`✅ 스케치 ${actualIndex} 이미지 표시`);
                        } else {
                            // 이미지가 없으면 업로드 영역 표시
                            if (preview) preview.classList.add('hidden');
                            if (uploadArea) uploadArea.classList.remove('hidden');
                            // console.log(`ℹ️ 스케치 ${actualIndex} 이미지 없음, 업로드 영역 표시`);
                        }
                    }
                });
                
                // currentData.sketches 설정 (데이터 로드 시에만)
                this.currentData.sketches = allSketches;
                // console.log('✅ currentData.sketches 설정 완료:', this.currentData.sketches);
            } else {
                // 스케치 데이터가 없으면 빈 상태 유지 (자동 추가하지 않음)
                // console.log('ℹ️ 스케치 데이터가 없음, 빈 상태 유지');
                this.resetSketchesWithoutDefault();
            }
            
            // console.log('✅ 메인화면 폼 데이터 채우기 완료');
            
            // 스케치 버튼 상태 확인
            setTimeout(() => {
                this.toggleQuickSaveSketchButton();
            }, 100);
            
        } catch (error) {
            console.error('메인화면 폼 데이터 채우기 오류:', error);
        }
    }

    // 메인화면 실시결과 폼 초기화
    clearMainResultForm() {
        // 실시결과 필드 초기화
        const mainResultContent = document.getElementById('mainResultContent');
        const mainResultFuturePlan = document.getElementById('mainResultFuturePlan');
        if (mainResultContent) mainResultContent.value = '';
        if (mainResultFuturePlan) mainResultFuturePlan.value = '';
        
        // 스케치도 초기화
        this.clearMainSketchFields();
    }

    // 메인화면 스케치 필드 초기화 (제약사항 없이 모든 스케치 초기화)
    clearMainSketchFields() {
        const container = document.getElementById('sketchUploadContainer');
        const sketchElements = container.querySelectorAll('div[data-sketch-index]');
        
        // 스케치가 없으면 빈 상태 유지 (자동 추가하지 않음)
        if (sketchElements.length === 0) {
            // console.log('ℹ️ 스케치가 없음, 빈 상태 유지');
            return;
        }
        
        // 모든 스케치 필드 초기화 (제약사항 없음)
        sketchElements.forEach((sketchElement) => {
            const sketchIndex = sketchElement.getAttribute('data-sketch-index');
            
            // 제목 초기화
            const titleInput = document.getElementById(`mainSketchTitle${sketchIndex}`);
            if (titleInput) titleInput.value = '';
            
            // 파일 초기화
            const fileInput = document.getElementById(`mainSketchFile${sketchIndex}`);
            if (fileInput) fileInput.value = '';
            
            // 이미지 미리보기 초기화
            const previewImg = document.getElementById(`mainPreviewImage${sketchIndex}`);
            if (previewImg) previewImg.src = '';
            
            // 파일명 초기화
            const fileName = document.getElementById(`mainFileName${sketchIndex}`);
            if (fileName) fileName.textContent = '';
            
            // 미리보기 숨기기
            const preview = document.getElementById(`mainFilePreview${sketchIndex}`);
            if (preview) preview.classList.add('hidden');
            
            // 업로드 영역 보이기
            const uploadArea = document.getElementById(`mainFileUploadArea${sketchIndex}`);
            if (uploadArea) uploadArea.classList.remove('hidden');
            
            // console.log(`✅ 스케치 ${sketchIndex} 필드 초기화 완료`);
        });
        
        // currentData의 스케치 데이터도 초기화
        if (this.currentData.sketches) {
            this.currentData.sketches = [];
            // console.log('✅ currentData 스케치 데이터 초기화 완료');
        }
    }

    // 스케치 초기화 (모든 스케치 제거)
    resetSketches() {
        const container = document.getElementById('sketchUploadContainer');
        const existingSketches = container.querySelectorAll('[data-sketch-index]');
        
        // console.log(`🔍 초기화 전 스케치 개수: ${existingSketches.length}`);
        
        // 모든 스케치를 먼저 제거
        existingSketches.forEach(sketch => {
            // console.log(`🗑️ 스케치 ${sketch.getAttribute('data-sketch-index')} 제거`);
            sketch.remove();
        });
        
        // currentData의 스케치 데이터는 초기화하지 않음 (실제 데이터 유지)
        
        // 초기화 후 스케치 개수 확인
        const remainingSketches = container.querySelectorAll('[data-sketch-index]');
        // console.log(`🔍 초기화 후 스케치 개수: ${remainingSketches.length}`);
        
        // console.log('✅ 스케치 초기화 완료: 모든 스케치 제거');
    }

    // 스케치 초기화 (모든 스케치 제거, 기본 스케치 추가하지 않음)
    resetSketchesWithoutDefault() {
        const container = document.getElementById('sketchUploadContainer');
        const existingSketches = container.querySelectorAll('[data-sketch-index]');
        
        // console.log(`🔍 초기화 전 스케치 개수: ${existingSketches.length}`);
        
        // 모든 스케치를 먼저 제거
        existingSketches.forEach(sketch => {
            // console.log(`🗑️ 스케치 ${sketch.getAttribute('data-sketch-index')} 제거`);
            sketch.remove();
        });
        
        // currentData의 스케치 데이터는 초기화하지 않음 (실제 데이터 유지)
        
        // 초기화 후 스케치 개수 확인
        const remainingSketches = container.querySelectorAll('[data-sketch-index]');
        // console.log(`🔍 초기화 후 스케치 개수: ${remainingSketches.length}`);
        
        // console.log('✅ 스케치 초기화 완료: 모든 스케치 제거 (기본 스케치 추가하지 않음)');
    }


    // 메인화면 실시결과 저장
    async saveMainResultData(skipLoading = false) {
        try {
            if (!skipLoading) {
                this.showLoading(true);
            }
            
            // 현재 세미나 정보 가져오기
            const session = document.getElementById('sessionSelect')?.value || document.getElementById('sessionInput')?.value || '';
            const datetime = document.getElementById('datetime')?.value || '';
            
            if (!session || !datetime) {
                this.showErrorToast('먼저 세미나 정보를 입력해주세요.');
                if (!skipLoading) {
                    this.showLoading(false);
                }
                return;
            }
            
            const mainContent = document.getElementById('mainResultContent')?.value?.trim() || '';
            const futurePlan = document.getElementById('mainResultFuturePlan')?.value?.trim() || '';
            
            // 현재 UI의 모든 스케치 데이터 가져오기 (제약사항 없음)
            const currentSketches = this.getMainSketchData();
            // console.log('💾 저장할 스케치 데이터:', currentSketches);
            
            // 기존 실시결과 데이터 조회
            const existingResult = await loadResultDataByKey(session, datetime);
            
            // 실시결과 데이터 구성 (현재 UI의 모든 스케치 데이터 사용)
            const resultData = {
                session: session,
                datetime: datetime,
                mainContent: mainContent || '', // 공백값도 저장 가능
                futurePlan: futurePlan || '', // 공백값도 저장 가능
                sketches: currentSketches // 모든 스케치 데이터 저장 (제약사항 없음)
            };
            
            // 데이터 저장
            const result = await saveResultData(resultData);
            
            if (result.success) {
                this.showSuccessToast('메인화면 실시결과가 성공적으로 저장되었습니다.');
            } else {
                this.showErrorToast(result.message);
            }
            
        } catch (error) {
            console.error('메인화면 실시결과 저장 오류:', error);
            this.showErrorToast('메인화면 실시결과 저장 중 오류가 발생했습니다.');
        } finally {
            if (!skipLoading) {
                this.showLoading(false);
            }
        }
    }
    
    // 스케치 정보만 저장하는 함수 (제약사항 없이 모든 스케치 저장)
    async saveSketchData() {
        try {
            this.showLoading(true);
            
            // 현재 세미나 정보 가져오기
            const session = document.getElementById('sessionSelect')?.value || document.getElementById('sessionInput')?.value || '';
            const datetime = document.getElementById('datetime')?.value || '';
            
            if (!session || !datetime) {
                this.showErrorToast('먼저 세미나 정보를 입력해주세요.');
                this.showLoading(false);
                return;
            }
            
            // 현재 UI의 모든 스케치 데이터 가져오기 (제약사항 없음)
            const currentSketches = this.getMainSketchData();
            // console.log('💾 저장할 스케치 데이터:', currentSketches);
            
            // 기존 실시결과 데이터 조회
            const existingResult = await loadResultDataByKey(session, datetime);
            
            // 스케치 데이터만 구성 (현재 UI의 모든 스케치 데이터 사용)
            const sketchData = {
                session: session,
                datetime: datetime,
                sketches: currentSketches // 모든 스케치 데이터 저장 (제약사항 없음)
            };
            
            // 스케치 데이터만 저장
            const result = await saveResultData(sketchData);
            
            if (result.success) {
                if (sketchData.sketches.length === 0) {
                    this.showSuccessToast('세미나 스케치 정보가 공백으로 저장되었습니다.');
                } else {
                    this.showSuccessToast(`세미나 스케치 ${sketchData.sketches.length}건이 성공적으로 저장되었습니다.`);
                }
                // 스케치 저장 후 버튼 상태 업데이트
                this.toggleQuickSaveSketchButton();
            } else {
                this.showErrorToast(result.message);
            }
            
        } catch (error) {
            console.error('스케치 저장 오류:', error);
            this.showErrorToast('스케치 저장 중 오류가 발생했습니다.');
        } finally {
            this.showLoading(false);
        }
    }

    // 실시결과 PDF용 HTML 콘텐츠 생성
    generateResultPDFHTML(resultData) {
        const session = resultData.session;
        const datetime = resultData.datetime;
        const location = document.getElementById('location').value || '미입력';
        const attendeeTarget = document.getElementById('attendees').value || '미입력';
        
        // 안전한 텍스트 처리 함수
        const safeText = (text) => {
            if (!text || text.trim() === '') return '미입력';
            return String(text).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
        };
        
        // 참석자 명단 데이터 가져오기 (참석여부가 Y인 대상만)
        const attendeeList = this.getAttendeeData().filter(attendee => attendee.attendance === 'Y');
        
        // 참석자 명단 HTML 생성
        let attendeeTableHTML = '';
        if (attendeeList && attendeeList.length > 0) {
            attendeeTableHTML = `
                <div style="page-break-before: always;">
                    <h2>[별첨 1] 세미나 참석명단</h2>
                    <table style="width: 100%; border-collapse: collapse; margin-top: 20px;">
                        <thead>
                            <tr style="background-color: #f5f5f5;">
                                <th style="border: 1px solid #ddd; padding: 8px; text-align: center;">No</th>
                                <th style="border: 1px solid #ddd; padding: 8px; text-align: center;">성명</th>
                                <th style="border: 1px solid #ddd; padding: 8px; text-align: center;">직급</th>
                                <th style="border: 1px solid #ddd; padding: 8px; text-align: center;">소속</th>
                                <th style="border: 1px solid #ddd; padding: 8px; text-align: left;">업무</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${attendeeList.map((attendee, index) => `
                                <tr>
                                    <td style="border: 1px solid #ddd; padding: 8px; text-align: center;">${index + 1}</td>
                                    <td style="border: 1px solid #ddd; padding: 8px; text-align: center;">${safeText(attendee.name)}</td>
                                    <td style="border: 1px solid #ddd; padding: 8px; text-align: center;">${safeText(attendee.position)}</td>
                                    <td style="border: 1px solid #ddd; padding: 8px; text-align: center;">${safeText(attendee.department)}</td>
                                    <td style="border: 1px solid #ddd; padding: 8px; text-align: left;">${safeText(attendee.work)}</td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            `;
        }
        
        // 스케치 HTML 생성 (첨부형식) - 세로로 1개씩, 한 페이지에 3개
        let sketchHTML = '';
        if (resultData.sketches && resultData.sketches.length > 0) {
            const validSketches = resultData.sketches.filter(sketch => sketch.title && sketch.imageData);
            
            let sketchPages = '';
            // 3개씩 그룹으로 나누어 처리
            for (let i = 0; i < validSketches.length; i += 3) {
                const sketchGroup = validSketches.slice(i, i + 3);
                
                // 모든 그룹에 새 페이지 적용 (첫 번째 그룹도 별첨 2이므로 새 페이지)
                const pageBreak = 'page-break-before: always;';
                
                let sketchItems = '';
                sketchGroup.forEach((sketch, groupIndex) => {
                    const globalIndex = i + groupIndex + 1;
                    sketchItems += `
                        <div style="margin: 15px 0; text-align: center;">
                            <p style="font-size: 10px; margin: 0 0 5px 0; font-weight: bold;">
                                ${globalIndex}. ${safeText(sketch.title)}
                            </p>
                            <div style="border: 1px solid #CCCCCC; padding: 1px; display: inline-block;">
                                <img src="${sketch.imageData}" style="width: 350px; height: 220px; object-fit: contain; display: block;" />
                            </div>
                        </div>
                    `;
                });
                
                sketchPages += `
                    <div style="${pageBreak}">
                        <h2>[별첨 2] 세미나 스케치</h2>
                        <div style="padding: 20px;">
                            ${sketchItems}
                        </div>
                    </div>
                `;
            }
            
            sketchHTML = sketchPages;
        }
        
        return `
            <!DOCTYPE html>
            <html lang="ko">
            <head>
                <meta charset="UTF-8">
                <meta http-equiv="Content-Type" content="text/html; charset=UTF-8">
                <title>전사 신기술 세미나 실시결과</title>
                <meta name="author" content="(주)경포씨엔씨">
                <meta name="description" content="전사 신기술 세미나 실시결과">
                <meta name="keywords" content="세미나, 실시결과, KPCNC">
                <meta name="robots" content="noindex, nofollow">
                <meta name="generator" content="">
                <style>
                    @page {
                        size: A4;
                        margin: 2cm;
                        @top-center {
                            content: " ";
                        }
                        @bottom-center {
                            content: "- " counter(page) " -";
                            font-size: 10px;
                            margin-top: 10px;
                        }
                    }
                    * {
                        font-family: '맑은 고딕', 'Malgun Gothic', 'Apple SD Gothic Neo', 'Noto Sans CJK KR', sans-serif !important;
                    }
                    body {
                        line-height: 1.6;
                        color: #333;
                        margin: 0;
                        padding: 0;
                        font-size: 12px;
                    }
                    .header {
                        text-align: center;
                        margin-bottom: 30px;
                        border-bottom: 2px solid #333;
                        padding-bottom: 20px;
                    }
                    .header h1 {
                        font-size: 24px;
                        font-weight: bold;
                        margin: 0;
                        color: #2c3e50;
                    }
                    .section {
                        margin-bottom: 25px;
                    }
                    .section h2 {
                        font-size: 16px;
                        font-weight: bold;
                        color: #34495e;
                        padding-bottom: 5px;
                        margin-bottom: 15px;
                    }
                    .info-item {
                        margin: 8px 0;
                        font-size: 12px;
                        display: flex;
                        align-items: flex-start;
                    }
                    .info-label {
                        font-weight: bold;
                        display: inline-block;
                        width: 80px;
                        flex-shrink: 0;
                    }
                    .info-content {
                        margin: 5px 0 15px 0;
                        word-wrap: break-word;
                        overflow-wrap: break-word;
                        font-size: 12px;
                        white-space: pre-line;
                    }
                    table {
                        width: 100%;
                        border-collapse: collapse;
                        margin: 15px 0;
                        font-size: 11px;
                    }
                    th, td {
                        border: 1px solid #bdc3c7;
                        padding: 6px;
                        text-align: left;
                        vertical-align: top;
                    }
                    th {
                        background-color: #ecf0f1;
                        font-weight: bold;
                    }
                    .center-align {
                        text-align: center;
                    }
                    .time-schedule-table {
                        width: 100%;
                    }
                    .time-schedule-table th:nth-child(1),
                    .time-schedule-table td:nth-child(1) {
                        width: auto;
                        min-width: 60px;
                        max-width: 80px;
                    }
                    .time-schedule-table th:nth-child(2),
                    .time-schedule-table td:nth-child(2) {
                        width: 100%;
                    }
                    .time-schedule-table th:nth-child(3),
                    .time-schedule-table td:nth-child(3) {
                        width: auto;
                        min-width: 60px;
                        max-width: 80px;
                    }
                    .time-schedule-table th:nth-child(4),
                    .time-schedule-table td:nth-child(4) {
                        width: auto;
                        min-width: 60px;
                        max-width: 80px;
                    }
                    .attendee-table {
                        width: 100%;
                        border-collapse: collapse;
                    }
                    .attendee-table th,
                    .attendee-table td {
                        border: 1px solid #ddd;
                        padding: 8px;
                        text-align: center;
                    }
                    .attendee-table th:nth-child(1),
                    .attendee-table td:nth-child(1) {
                        width: 40px;
                        min-width: 40px;
                        max-width: 50px;
                    }
                    .attendee-table th:nth-child(2),
                    .attendee-table td:nth-child(2) {
                        width: 120px;
                        min-width: 120px;
                        max-width: 150px;
                    }
                    .attendee-table th:nth-child(3),
                    .attendee-table td:nth-child(3) {
                        width: 100px;
                        min-width: 100px;
                        max-width: 120px;
                    }
                    .attendee-table th:nth-child(4),
                    .attendee-table td:nth-child(4) {
                        width: 150px;
                        min-width: 150px;
                        max-width: 200px;
                    }
                    .attendee-table th:nth-child(5),
                    .attendee-table td:nth-child(5) {
                        width: auto;
                        min-width: 200px;
                        text-align: left;
                    }
                    .footer {
                        text-align: center;
                        margin-top: 40px;
                        font-size: 10px;
                        color: #7f8c8d;
                        border-top: 1px solid #bdc3c7;
                        padding-top: 10px;
                    }
                    @media print {
                        body { 
                            -webkit-print-color-adjust: exact;
                            print-color-adjust: exact;
                        }
                    }
                </style>
            </head>
            <body>
                <div class="header">
                    <h1>${safeText(this.currentData.session)} 전사 신기술 세미나 실시 결과</h1>
                    <div style="text-align: right; margin-top: 10px; font-size: 12px;">${this.getCurrentDateString()}</div>
                </div>  
                <div class="section">
                    <h2>1. 개요</h2>
                    <p class="info-content">　　□ 일시/장소: ${safeText(datetime)} / ${safeText(location)}</p>
                    <p class="info-content">　　□ 참석 인력: ${safeText(attendeeTarget)}</p>
                    
                    <h2>2. 주요 내용</h2>
                    <p class="info-content" style="white-space: pre-line;">${safeText(this.parseMainContent(resultData.mainContent))}</p>
                    
                    <h2>3. 향후 계획</h2>
                    <p class="info-content" style="white-space: pre-line;">${safeText(this.parseMainContent(resultData.futurePlan))}</p>
                    <div style="text-align: right; margin-top: 10px; font-size: 12px;">– 이 상 –</div>
                </div> 
                
                ${attendeeTableHTML}
                ${sketchHTML}
            </body>
            </html>
        `;
    }
} 

// 앱 초기화
let app;
document.addEventListener('DOMContentLoaded', async function() {
    app = new SeminarPlanningApp();
    // app.initializeApp()은 constructor에서 자동으로 호출됩니다
    
    // 전역 함수로 노출 (HTML에서 호출하기 위해)
    window.app = app;
});