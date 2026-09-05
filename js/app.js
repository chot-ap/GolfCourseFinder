/**
 * GolfCourseFinder - Main Application Controller
 */

function startApp() {
  // DOM Elements - Calendar
  const searchForm = document.getElementById('searchForm');
  const inputPlayDate = document.getElementById('inputPlayDate');
  const selectedDateDisplay = document.getElementById('selectedDateDisplay');
  const selectedDateText = document.getElementById('selectedDateText');
  const calendarWidget = document.getElementById('calendarWidget');
  const calYearSelect = document.getElementById('calYearSelect');
  const calMonthSelect = document.getElementById('calMonthSelect');
  const calendarDaysGrid = document.getElementById('calendarDaysGrid');
  const btnPrevMonth = document.getElementById('btnPrevMonth');
  const btnNextMonth = document.getElementById('btnNextMonth');
  const btnCalToday = document.getElementById('btnCalToday');
  const btnCalNextSat = document.getElementById('btnCalNextSat');
  const btnCalClose = document.getElementById('btnCalClose');

  // DOM Elements - Area & Prefectures (Picklist)
  const selectArea = document.getElementById('selectArea');
  const prefPicklistWrapper = document.getElementById('prefPicklistWrapper');
  const prefPicklistTrigger = document.getElementById('prefPicklistTrigger');
  const prefPicklistPlaceholder = document.getElementById('prefPicklistPlaceholder');
  const prefPicklistDropdown = document.getElementById('prefPicklistDropdown');
  const prefPicklistOptions = document.getElementById('prefPicklistOptions');
  const selectedPrefTags = document.getElementById('selectedPrefTags');
  const btnSelectAllPrefs = document.getElementById('btnSelectAllPrefs');
  const btnClearAllPrefs = document.getElementById('btnClearAllPrefs');

  // DOM Elements - Time Picklist
  const timePicklistWrapper = document.getElementById('timePicklistWrapper');
  const timePicklistTrigger = document.getElementById('timePicklistTrigger');
  const timePicklistPlaceholder = document.getElementById('timePicklistPlaceholder');
  const timePicklistDropdown = document.getElementById('timePicklistDropdown');
  const timePicklistOptions = document.getElementById('timePicklistOptions');
  const selectedTimeTags = document.getElementById('selectedTimeTags');
  const btnSelectAllTimes = document.getElementById('btnSelectAllTimes');
  const btnClearAllTimes = document.getElementById('btnClearAllTimes');
  const selectedTimesSummary = document.getElementById('selectedTimesSummary');
  const selectMinRating = document.getElementById('selectMinRating');
  const inputExclude = document.getElementById('inputExclude');

  // DOM Elements - Advanced Search Accordion & Filters
  const advancedSearchContainer = document.getElementById('advancedSearchContainer');
  const advancedSearchToggle = document.getElementById('advancedSearchToggle');
  const advToggleIcon = document.getElementById('advToggleIcon');
  const advActiveBadge = document.getElementById('advActiveBadge');
  const advToggleHint = document.getElementById('advToggleHint');
  const advancedSearchBody = document.getElementById('advancedSearchBody');

  const inputKeyword = document.getElementById('inputKeyword');
  const selectSort = document.getElementById('selectSort');
  const selectPlayStyle = document.getElementById('selectPlayStyle');
  const selectHighway = document.getElementById('selectHighway');
  const selectMaxCarTime = document.getElementById('selectMaxCarTime');
  const selectMaxTrainTime = document.getElementById('selectMaxTrainTime');
  const check2Sum = document.getElementById('check2Sum');
  const checkClubBusOnly = document.getElementById('checkClubBusOnly');
  const checkIncludeStay = document.getElementById('checkIncludeStay');
  const btnResetAdvanced = document.getElementById('btnResetAdvanced');

  // DOM Elements - Results & Modals
  const resultsSection = document.getElementById('resultsSection');
  const resultsTableBody = document.getElementById('resultsTableBody');
  const resultsCount = document.getElementById('resultsCount');
  const loadingState = document.getElementById('loadingState');
  const emptyState = document.getElementById('emptyState');
  const resultsTable = document.getElementById('resultsTable');

  // DOM Elements - Request Parameters Card
  const requestParamsCard = document.getElementById('requestParamsCard');
  const requestParamsToggle = document.getElementById('requestParamsToggle');
  const requestParamsToggleIcon = document.getElementById('requestParamsToggleIcon');
  const requestParamsModeBadge = document.getElementById('requestParamsModeBadge');
  const btnCopyRequestUrl = document.getElementById('btnCopyRequestUrl');
  const btnCopyRequestParamsJson = document.getElementById('btnCopyRequestParamsJson');
  const requestUrlCode = document.getElementById('requestUrlCode');
  const requestParamsGrid = document.getElementById('requestParamsGrid');
  const requestParamsCount = document.getElementById('requestParamsCount');
  const requestTimeBadge = document.getElementById('requestTimeBadge');

  const btnExportFormat = document.getElementById('btnExportFormat');
  const btnExportCsv = document.getElementById('btnExportCsv');
  const btnSettings = document.getElementById('btnSettings');

  const exportModal = document.getElementById('exportModal');
  const settingsModal = document.getElementById('settingsModal');
  const detailModal = document.getElementById('detailModal');
  const exportTextarea = document.getElementById('exportTextarea');
  const btnCopyExport = document.getElementById('btnCopyExport');
  const inputAppId = document.getElementById('inputAppId');
  const inputAccessKey = document.getElementById('inputAccessKey');
  const inputAppUrl = document.getElementById('inputAppUrl');
  const btnSaveApiKey = document.getElementById('btnSaveApiKey');
  const btnClearApiKey = document.getElementById('btnClearApiKey');
  const apiStatusText = document.getElementById('apiStatusText');

  // State
  let currentResults = [];
  let currentSort = { column: 'rating', order: 'desc' };
  let selectedDate = new Date();
  let calCurrentYear = selectedDate.getFullYear();
  let calCurrentMonth = selectedDate.getMonth(); // 0-indexed
  let selectedPrefCodes = ['12']; // 初期値: 千葉県 (必ず1つ以上選択)
  let selectedStartTimes = ['8', '9']; // デフォルト選択時間帯 (8時台, 9時台)
  let lastSearchParams = null;
  let lastSearchTime = null;
  let lastSearchMode = '';

  // 時間帯マスターデータ (新仕様: startTimeZone)
  const TIME_SLOTS = [
    { code: '0', name: '指定しない' },
    { code: '4', name: '4時台' },
    { code: '5', name: '5時台' },
    { code: '6', name: '6時台' },
    { code: '7', name: '7時台' },
    { code: '8', name: '8時台' },
    { code: '9', name: '9時台' },
    { code: '10', name: '10時台' },
    { code: '11', name: '11時台' },
    { code: '12', name: '12時台' },
    { code: '13', name: '13時台' },
    { code: '14', name: '14時台' },
    { code: '15', name: '15時台以降' }
  ];

  // 都道府県マスターデータ（楽天GORA公式大エリアコード別）
  const PREFECTURES_BY_AREA = {
    '102': [ // 関東のすべて
      { code: '12', name: '千葉県' },
      { code: '11', name: '埼玉県' },
      { code: '14', name: '神奈川県' },
      { code: '8', name: '茨城県' },
      { code: '9', name: '栃木県' },
      { code: '10', name: '群馬県' },
      { code: '13', name: '東京都' }
    ],
    '104': [ // 中部のすべて
      { code: '22', name: '静岡県' },
      { code: '23', name: '愛知県' },
      { code: '21', name: '岐阜県' },
      { code: '24', name: '三重県' }
    ],
    '103': [ // 甲信越・北陸
      { code: '19', name: '山梨県' },
      { code: '20', name: '長野県' },
      { code: '15', name: '新潟県' },
      { code: '16', name: '富山県' },
      { code: '17', name: '石川県' },
      { code: '18', name: '福井県' }
    ],
    '105': [ // 近畿のすべて
      { code: '25', name: '滋賀県' },
      { code: '26', name: '京都府' },
      { code: '27', name: '大阪府' },
      { code: '28', name: '兵庫県' },
      { code: '29', name: '奈良県' },
      { code: '30', name: '和歌山県' }
    ],
    '101': [ // 北海道・東北
      { code: '1', name: '北海道' },
      { code: '2', name: '青森県' },
      { code: '3', name: '岩手県' },
      { code: '4', name: '宮城県' },
      { code: '5', name: '秋田県' },
      { code: '6', name: '山形県' },
      { code: '7', name: '福島県' }
    ],
    '106': [ // 中国のすべて
      { code: '31', name: '鳥取県' },
      { code: '32', name: '島根県' },
      { code: '33', name: '岡山県' },
      { code: '34', name: '広島県' },
      { code: '35', name: '山口県' }
    ],
    '107': [ // 四国のすべて
      { code: '36', name: '徳島県' },
      { code: '37', name: '香川県' },
      { code: '38', name: '愛媛県' },
      { code: '39', name: '高知県' }
    ],
    '108': [ // 九州・沖縄のすべて
      { code: '40', name: '福岡県' },
      { code: '41', name: '佐賀県' },
      { code: '42', name: '長崎県' },
      { code: '43', name: '熊本県' },
      { code: '44', name: '大分県' },
      { code: '45', name: '宮崎県' },
      { code: '46', name: '鹿児島県' },
      { code: '47', name: '沖縄県' }
    ]
  };

  const WEEKDAYS_JA = ['日', '月', '火', '水', '木', '金', '土'];

  /**
   * 初期化処理
   */
  async function init() {
    initDatePicker();
    initCalendarWidget();
    initPrefecturePicklist();
    initTimePicklist();
    initAdvancedSearch();
    initEventListeners();
    updateApiStatusDisplay();

    // クラブバスマスタデータを事前ロード
    await TransitCalculator.loadMasterData();

    // 初回検索実行
    performSearch();
  }

  /**
   * 現在の入力条件オブジェクトを取得
   */
  function getSearchParams() {
    return {
      playDate: inputPlayDate.value || formatDate(selectedDate),
      areaCode: selectArea ? (selectArea.value || '102') : '102',
      prefCodes: selectedPrefCodes,
      startTimes: selectedStartTimes,
      minRating: selectMinRating ? parseFloat(selectMinRating.value || 3.5) : 3.5,
      excludeKeyword: inputExclude ? (inputExclude.value.trim() || 'アコーディア') : 'アコーディア',
      keyword: inputKeyword ? inputKeyword.value.trim() : '',
      sort: selectSort ? selectSort.value : 'evaluation',
      playStyle: selectPlayStyle ? selectPlayStyle.value : 'all',
      highway: selectHighway ? selectHighway.value : 'all',
      maxCarTime: selectMaxCarTime ? parseInt(selectMaxCarTime.value || '0', 10) : 0,
      maxTrainTime: selectMaxTrainTime ? parseInt(selectMaxTrainTime.value || '0', 10) : 0,
      plan2Sum: check2Sum ? check2Sum.checked : false,
      clubBusOnly: checkClubBusOnly ? checkClubBusOnly.checked : false,
      includeStay: checkIncludeStay ? checkIncludeStay.checked : false
    };
  }

  /**
   * 詳細検索アコーディオンの初期化
   */
  function initAdvancedSearch() {
    if (!advancedSearchToggle || !advancedSearchBody) return;

    advancedSearchToggle.addEventListener('click', () => {
      const isClosed = advancedSearchBody.style.display === 'none';
      if (isClosed) {
        advancedSearchBody.style.display = 'block';
        advToggleIcon.classList.add('open');
        advToggleHint.textContent = '閉じる ▲';
      } else {
        advancedSearchBody.style.display = 'none';
        advToggleIcon.classList.remove('open');
        advToggleHint.textContent = '開く ▼';
      }
    });

    // キーボード操作対応
    advancedSearchToggle.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        advancedSearchToggle.click();
      }
    });

    // 詳細条件リセット
    if (btnResetAdvanced) {
      btnResetAdvanced.addEventListener('click', () => {
        if (inputKeyword) inputKeyword.value = '';
        if (selectSort) selectSort.value = 'evaluation';
        if (selectPlayStyle) selectPlayStyle.value = 'all';
        if (selectHighway) selectHighway.value = 'all';
        if (selectMaxCarTime) selectMaxCarTime.value = '0';
        if (selectMaxTrainTime) selectMaxTrainTime.value = '0';
        if (check2Sum) check2Sum.checked = false;
        if (checkClubBusOnly) checkClubBusOnly.checked = false;
        if (checkIncludeStay) checkIncludeStay.checked = false;

        updateAdvancedBadgeSummary();
        performSearch();
        showToast('詳細検索条件をリセットしました');
      });
    }
  }

  /**
   * 詳細設定のアクティブ条件バッジの更新
   */
  function updateAdvancedBadgeSummary() {
    if (!advActiveBadge) return;

    let activeCount = 0;
    if (inputKeyword && inputKeyword.value.trim()) activeCount++;
    if (selectSort && selectSort.value !== 'evaluation') activeCount++;
    if (selectPlayStyle && selectPlayStyle.value !== 'all') activeCount++;
    if (selectHighway && selectHighway.value !== 'all') activeCount++;
    if (selectMaxCarTime && selectMaxCarTime.value !== '0') activeCount++;
    if (selectMaxTrainTime && selectMaxTrainTime.value !== '0') activeCount++;
    if (check2Sum && check2Sum.checked) activeCount++;
    if (checkClubBusOnly && checkClubBusOnly.checked) activeCount++;
    if (checkIncludeStay && checkIncludeStay.checked) activeCount++;

    if (activeCount > 0) {
      advActiveBadge.textContent = `${activeCount}件設定中`;
      advActiveBadge.style.display = 'inline-flex';
    } else {
      advActiveBadge.style.display = 'none';
    }
  }

  /**
   * プレー日ピッカーの初期化（次の土曜日をデフォルト設定）
   */
  function initDatePicker() {
    const today = new Date();
    const nextSaturday = new Date(today);
    const dayOfWeek = today.getDay();
    const daysUntilSaturday = (6 - dayOfWeek + 7) % 7 || 7;
    nextSaturday.setDate(today.getDate() + daysUntilSaturday);

    setSelectedDate(nextSaturday);
  }

  /**
   * 日付の設定と表示更新
   */
  function setSelectedDate(date) {
    selectedDate = new Date(date);
    const dateStr = formatDate(selectedDate);
    inputPlayDate.value = dateStr;
    const formattedJa = `${selectedDate.getFullYear()}年${selectedDate.getMonth() + 1}月${selectedDate.getDate()}日 (${WEEKDAYS_JA[selectedDate.getDay()]})`;
    selectedDateText.textContent = formattedJa;

    calCurrentYear = selectedDate.getFullYear();
    calCurrentMonth = selectedDate.getMonth();
  }

  function formatDate(d) {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  /**
   * カレンダーウィジェットの初期化
   */
  function initCalendarWidget() {
    // 年・月セレクトボックスの初期化（今年から2年先まで）
    const currentYear = new Date().getFullYear();
    calYearSelect.innerHTML = '';
    for (let y = currentYear; y <= currentYear + 2; y++) {
      const opt = document.createElement('option');
      opt.value = y;
      opt.textContent = `${y}年`;
      calYearSelect.appendChild(opt);
    }

    calMonthSelect.innerHTML = '';
    for (let m = 0; m < 12; m++) {
      const opt = document.createElement('option');
      opt.value = m;
      opt.textContent = `${m + 1}月`;
      calMonthSelect.appendChild(opt);
    }

    updateCalendarSelects();
    renderCalendarDays();

    // 年月変更イベント
    calYearSelect.addEventListener('change', () => {
      calCurrentYear = parseInt(calYearSelect.value, 10);
      renderCalendarDays();
    });

    calMonthSelect.addEventListener('change', () => {
      calCurrentMonth = parseInt(calMonthSelect.value, 10);
      renderCalendarDays();
    });

    // カレンダー開閉
    selectedDateDisplay.addEventListener('click', (e) => {
      e.stopPropagation();
      const isOpen = calendarWidget.classList.contains('open');
      if (isOpen) {
        closeCalendar();
      } else {
        openCalendar();
      }
    });

    // 前月・次月
    btnPrevMonth.addEventListener('click', (e) => {
      e.stopPropagation();
      calCurrentMonth--;
      if (calCurrentMonth < 0) {
        calCurrentMonth = 11;
        calCurrentYear--;
      }
      updateCalendarSelects();
      renderCalendarDays();
    });

    btnNextMonth.addEventListener('click', (e) => {
      e.stopPropagation();
      calCurrentMonth++;
      if (calCurrentMonth > 11) {
        calCurrentMonth = 0;
        calCurrentYear++;
      }
      updateCalendarSelects();
      renderCalendarDays();
    });

    // カレンダーフッターアクション
    btnCalToday.addEventListener('click', (e) => {
      e.stopPropagation();
      setSelectedDate(new Date());
      closeCalendar();
      performSearch();
    });

    btnCalNextSat.addEventListener('click', (e) => {
      e.stopPropagation();
      const today = new Date();
      const nextSaturday = new Date(today);
      const dayOfWeek = today.getDay();
      const daysUntilSaturday = (6 - dayOfWeek + 7) % 7 || 7;
      nextSaturday.setDate(today.getDate() + daysUntilSaturday);
      setSelectedDate(nextSaturday);
      closeCalendar();
      performSearch();
    });

    btnCalClose.addEventListener('click', (e) => {
      e.stopPropagation();
      closeCalendar();
    });

    // 外部クリックでカレンダー閉じる
    document.addEventListener('click', (e) => {
      if (!calendarWidget.contains(e.target) && !selectedDateDisplay.contains(e.target)) {
        closeCalendar();
      }
    });
  }

  function openCalendar() {
    closePrefPicklist();
    closeTimePicklist();
    calendarWidget.classList.add('open');
    selectedDateDisplay.classList.add('active');
    updateCalendarSelects();
    renderCalendarDays();
  }

  function closeCalendar() {
    calendarWidget.classList.remove('open');
    selectedDateDisplay.classList.remove('active');
  }

  function updateCalendarSelects() {
    calYearSelect.value = calCurrentYear;
    calMonthSelect.value = calCurrentMonth;
  }

  /**
   * カレンダーの日付グリッドを描画
   */
  function renderCalendarDays() {
    calendarDaysGrid.innerHTML = '';

    const firstDay = new Date(calCurrentYear, calCurrentMonth, 1).getDay();
    const daysInMonth = new Date(calCurrentYear, calCurrentMonth + 1, 0).getDate();
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    for (let i = 0; i < firstDay; i++) {
      const emptyCell = document.createElement('div');
      emptyCell.className = 'cal-day-cell empty';
      calendarDaysGrid.appendChild(emptyCell);
    }

    for (let d = 1; d <= daysInMonth; d++) {
      const dayDate = new Date(calCurrentYear, calCurrentMonth, d);
      dayDate.setHours(0, 0, 0, 0);

      const cell = document.createElement('div');
      cell.className = 'cal-day-cell';
      cell.textContent = d;

      const dayOfWeek = dayDate.getDay();
      if (dayOfWeek === 6) cell.classList.add('sat');
      if (dayOfWeek === 0) cell.classList.add('sun');

      if (dayDate.getTime() === today.getTime()) {
        cell.classList.add('today');
      }

      const isSelected = selectedDate &&
        selectedDate.getFullYear() === calCurrentYear &&
        selectedDate.getMonth() === calCurrentMonth &&
        selectedDate.getDate() === d;

      if (isSelected) {
        cell.classList.add('selected');
      }

      cell.addEventListener('click', (e) => {
        e.stopPropagation();
        setSelectedDate(dayDate);
        closeCalendar();
        performSearch();
      });

      calendarDaysGrid.appendChild(cell);
    }
  }

  /**
   * 都道府県ピックリスト（複数選択）の初期化
   */
  function initPrefecturePicklist() {
    renderPrefPicklistOptions();

    prefPicklistTrigger.addEventListener('click', (e) => {
      e.stopPropagation();
      const isOpen = prefPicklistDropdown.classList.contains('open');
      if (isOpen) {
        closePrefPicklist();
      } else {
        openPrefPicklist();
      }
    });

    selectArea.addEventListener('change', () => {
      selectedPrefCodes = [];
      renderPrefPicklistOptions();
      updatePrefPicklistUI();
      performSearch();
    });

    btnSelectAllPrefs.addEventListener('click', () => {
      const area = selectArea.value || '102';
      const prefs = PREFECTURES_BY_AREA[area] || [];
      selectedPrefCodes = prefs.map(p => p.code);
      renderPrefPicklistOptions();
      updatePrefPicklistUI();
      performSearch();
    });

    btnClearAllPrefs.addEventListener('click', () => {
      selectedPrefCodes = [];
      renderPrefPicklistOptions();
      updatePrefPicklistUI();
      performSearch();
    });

    document.addEventListener('click', (e) => {
      if (!prefPicklistWrapper.contains(e.target)) {
        closePrefPicklist();
      }
    });
  }

  function openPrefPicklist() {
    closeCalendar();
    closeTimePicklist();
    prefPicklistDropdown.classList.add('open');
    prefPicklistTrigger.classList.add('active');
  }

  function closePrefPicklist() {
    prefPicklistDropdown.classList.remove('open');
    prefPicklistTrigger.classList.remove('active');
  }

  function renderPrefPicklistOptions() {
    const area = selectArea.value || '102';
    const prefs = PREFECTURES_BY_AREA[area] || [];

    prefPicklistOptions.innerHTML = '';

    prefs.forEach(p => {
      const isChecked = selectedPrefCodes.includes(p.code);
      const label = document.createElement('label');
      label.className = `picklist-item ${isChecked ? 'checked' : ''}`;

      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.value = p.code;
      checkbox.checked = isChecked;

      checkbox.addEventListener('change', () => {
        if (checkbox.checked) {
          if (!selectedPrefCodes.includes(p.code)) selectedPrefCodes.push(p.code);
        } else {
          selectedPrefCodes = selectedPrefCodes.filter(c => c !== p.code);
        }
        renderPrefPicklistOptions();
        updatePrefPicklistUI();
        performSearch();
      });

      label.appendChild(checkbox);
      label.appendChild(document.createTextNode(p.name));
      prefPicklistOptions.appendChild(label);
    });

    updatePrefPicklistUI();
  }

  function updatePrefPicklistUI() {
    const area = selectArea.value || '102';
    const allPrefs = PREFECTURES_BY_AREA[area] || [];
    const areaName = selectArea.options[selectArea.selectedIndex]?.text || '';

    selectedPrefTags.innerHTML = '';

    if (selectedPrefCodes.length === 0) {
      prefPicklistPlaceholder.textContent = `すべての県（${areaName}全域）`;
    } else if (selectedPrefCodes.length === allPrefs.length) {
      prefPicklistPlaceholder.textContent = `すべての県（${allPrefs.length}県選択中）`;
    } else {
      const selectedNames = allPrefs
        .filter(p => selectedPrefCodes.includes(p.code))
        .map(p => p.name);

      prefPicklistPlaceholder.textContent = `${selectedNames.join(', ')} (${selectedNames.length}県)`;

      allPrefs.filter(p => selectedPrefCodes.includes(p.code)).forEach(p => {
        const tag = document.createElement('span');
        tag.className = 'pref-tag';
        tag.innerHTML = `${p.name} <span class="tag-remove" title="削除">✕</span>`;
        tag.querySelector('.tag-remove').addEventListener('click', (e) => {
          e.stopPropagation();
          selectedPrefCodes = selectedPrefCodes.filter(c => c !== p.code);
          renderPrefPicklistOptions();
          updatePrefPicklistUI();
          performSearch();
        });
        selectedPrefTags.appendChild(tag);
      });
    }
  }

  /**
   * スタート時間帯ピックリスト（プルダウン複数選択）の初期化
   */
  function initTimePicklist() {
    renderTimePicklistOptions();

    if (timePicklistTrigger) {
      timePicklistTrigger.addEventListener('click', (e) => {
        e.stopPropagation();
        const isOpen = timePicklistDropdown.classList.contains('open');
        if (isOpen) {
          closeTimePicklist();
        } else {
          openTimePicklist();
        }
      });
    }

    if (btnSelectAllTimes) {
      btnSelectAllTimes.addEventListener('click', () => {
        // 4〜15時台を全選択
        selectedStartTimes = TIME_SLOTS.filter(t => t.code !== '0').map(t => t.code);
        renderTimePicklistOptions();
        updateTimePicklistUI();
        performSearch();
      });
    }

    if (btnClearAllTimes) {
      btnClearAllTimes.addEventListener('click', () => {
        selectedStartTimes = ['0'];
        renderTimePicklistOptions();
        updateTimePicklistUI();
        performSearch();
      });
    }

    document.addEventListener('click', (e) => {
      if (timePicklistWrapper && !timePicklistWrapper.contains(e.target)) {
        closeTimePicklist();
      }
    });
  }

  function openTimePicklist() {
    closeCalendar();
    closePrefPicklist();
    if (timePicklistDropdown) timePicklistDropdown.classList.add('open');
    if (timePicklistTrigger) timePicklistTrigger.classList.add('active');
  }

  function closeTimePicklist() {
    if (timePicklistDropdown) timePicklistDropdown.classList.remove('open');
    if (timePicklistTrigger) timePicklistTrigger.classList.remove('active');
  }

  function renderTimePicklistOptions() {
    if (!timePicklistOptions) return;
    timePicklistOptions.innerHTML = '';

    TIME_SLOTS.forEach(t => {
      const isChecked = selectedStartTimes.includes(t.code);
      const label = document.createElement('label');
      label.className = `picklist-item ${isChecked ? 'checked' : ''}`;

      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.value = t.code;
      checkbox.checked = isChecked;

      checkbox.addEventListener('change', () => {
        if (checkbox.checked) {
          if (t.code === '0') {
            // 「指定しない」が選ばれたら他を解除
            selectedStartTimes = ['0'];
          } else {
            // 他の時間帯が選ばれたら「0」を解除
            selectedStartTimes = selectedStartTimes.filter(c => c !== '0');
            if (!selectedStartTimes.includes(t.code)) {
              selectedStartTimes.push(t.code);
              selectedStartTimes.sort((a, b) => parseInt(a, 10) - parseInt(b, 10));
            }
          }
        } else {
          selectedStartTimes = selectedStartTimes.filter(c => c !== t.code);
          if (selectedStartTimes.length === 0) {
            selectedStartTimes = ['0'];
          }
        }
        renderTimePicklistOptions();
        updateTimePicklistUI();
        performSearch();
      });

      label.appendChild(checkbox);
      label.appendChild(document.createTextNode(t.name));
      timePicklistOptions.appendChild(label);
    });

    updateTimePicklistUI();
  }

  function updateTimePicklistUI() {
    if (!timePicklistPlaceholder) return;
    if (selectedTimeTags) selectedTimeTags.innerHTML = '';

    const isNoSpecificTime = selectedStartTimes.length === 0 || 
                             selectedStartTimes.includes('0') || 
                             selectedStartTimes.length === (TIME_SLOTS.length - 1);

    if (isNoSpecificTime) {
      timePicklistPlaceholder.textContent = 'すべての時間帯（指定なし）';
      if (selectedTimesSummary) selectedTimesSummary.textContent = '時間帯: 全時間帯（指定なし）';
    } else {
      const selectedSlots = TIME_SLOTS.filter(t => t.code !== '0' && selectedStartTimes.includes(t.code));
      const selectedNames = selectedSlots.map(t => t.name.split(' ')[0]);

      timePicklistPlaceholder.textContent = `${selectedNames.join(', ')}`;
      if (selectedTimesSummary) selectedTimesSummary.textContent = `時間帯: ${selectedNames.join(', ')}`;

      // タグ表示
      selectedSlots.forEach(t => {
        const tag = document.createElement('span');
        tag.className = 'selected-time-tag';
        tag.innerHTML = `${t.name} <span class="btn-remove-tag" title="削除">✕</span>`;
        tag.querySelector('.btn-remove-tag').addEventListener('click', (e) => {
          e.stopPropagation();
          selectedStartTimes = selectedStartTimes.filter(c => c !== t.code);
          if (selectedStartTimes.length === 0) {
            selectedStartTimes = ['0'];
          }
          renderTimePicklistOptions();
          updateTimePicklistUI();
          performSearch();
        });
        selectedTimeTags.appendChild(tag);
      });
    }
  }

  /**
   * イベントリスナーの登録
   */
  function initEventListeners() {
    // 検索フォーム送信
    searchForm.addEventListener('submit', (e) => {
      e.preventDefault();
      closeCalendar();
      closePrefPicklist();
      closeTimePicklist();
      performSearch();
    });

    // 詳細条件の変更監視
    const debouncedSearch = debounce(() => {
      performSearch();
    }, 350);

    if (inputKeyword) {
      inputKeyword.addEventListener('input', () => {
        debouncedSearch();
      });
    }

    [selectSort, selectPlayStyle, selectHighway, selectMaxCarTime, selectMaxTrainTime].forEach(select => {
      if (select) {
        select.addEventListener('change', () => {
          performSearch();
        });
      }
    });

    [check2Sum, checkClubBusOnly, checkIncludeStay].forEach(chk => {
      if (chk) {
        chk.addEventListener('change', () => {
          performSearch();
        });
      }
    });

    // 日付プリセットボタン
    document.querySelectorAll('.btn-preset').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const type = e.target.dataset.type;
        const targetDate = new Date();

        if (type === 'this-sat') {
          const d = (6 - targetDate.getDay() + 7) % 7 || 7;
          targetDate.setDate(targetDate.getDate() + d);
        } else if (type === 'this-sun') {
          const d = (7 - targetDate.getDay() + 7) % 7 || 7;
          targetDate.setDate(targetDate.getDate() + d);
        } else if (type === 'next-sat') {
          const d = ((6 - targetDate.getDay() + 7) % 7 || 7) + 7;
          targetDate.setDate(targetDate.getDate() + d);
        } else if (type === 'next-sun') {
          const d = ((7 - targetDate.getDay() + 7) % 7 || 7) + 7;
          targetDate.setDate(targetDate.getDate() + d);
        }

        setSelectedDate(targetDate);
        performSearch();
      });
    });

    // テーブルソートヘッダークリック
    document.querySelectorAll('.results-table th[data-sort]').forEach(th => {
      th.addEventListener('click', () => {
        const column = th.dataset.sort;
        if (currentSort.column === column) {
          currentSort.order = currentSort.order === 'asc' ? 'desc' : 'asc';
        } else {
          currentSort.column = column;
          currentSort.order = column === 'name' ? 'asc' : 'asc';
        }
        sortAndRenderTable();
      });
    });

    // 出力形式コピー / モーダル表示
    if (btnExportFormat) {
      btnExportFormat.addEventListener('click', () => {
        openExportModal();
      });
    }

    // CSVダウンロード
    if (btnExportCsv) {
      btnExportCsv.addEventListener('click', () => {
        downloadCsv();
      });
    }

    // リクエストパラメータカードの開閉トグル
    if (requestParamsToggle) {
      requestParamsToggle.addEventListener('click', (e) => {
        if (e.target.closest('.btn-copy-url')) return;
        requestParamsCard.classList.toggle('collapsed');
      });
    }

    // リクエストURLコピー
    if (btnCopyRequestUrl) {
      btnCopyRequestUrl.addEventListener('click', async (e) => {
        e.stopPropagation();
        if (!currentRequestInfo || !currentRequestInfo.fullUrl) return;
        try {
          await navigator.clipboard.writeText(currentRequestInfo.fullUrl);
          showToast('📋 APIリクエストURLをコピーしました！');
        } catch (err) {
          const textarea = document.createElement('textarea');
          textarea.value = currentRequestInfo.fullUrl;
          document.body.appendChild(textarea);
          textarea.select();
          document.execCommand('copy');
          document.body.removeChild(textarea);
          showToast('📋 APIリクエストURLをコピーしました！');
        }
      });
    }

    // パラメータJSONコピー
    if (btnCopyRequestParamsJson) {
      btnCopyRequestParamsJson.addEventListener('click', async (e) => {
        e.stopPropagation();
        if (!currentRequestInfo || !currentRequestInfo.params) return;
        const jsonStr = JSON.stringify(currentRequestInfo.params, null, 2);
        try {
          await navigator.clipboard.writeText(jsonStr);
          showToast('📄 パラメータJSONをコピーしました！');
        } catch (err) {
          const textarea = document.createElement('textarea');
          textarea.value = jsonStr;
          document.body.appendChild(textarea);
          textarea.select();
          document.execCommand('copy');
          document.body.removeChild(textarea);
          showToast('📄 パラメータJSONをコピーしました！');
        }
      });
    }

    // 設定モーダル
    if (btnSettings) {
      btnSettings.addEventListener('click', (e) => {
        e.stopPropagation();
        openSettingsModal();
      });
    }

    // APIキー保存
    if (btnSaveApiKey) {
      btnSaveApiKey.addEventListener('click', (e) => {
        e.stopPropagation();
        const appId = inputAppId ? inputAppId.value.trim() : '';
        const accessKey = inputAccessKey ? inputAccessKey.value.trim() : '';
        const appUrl = inputAppUrl ? inputAppUrl.value.trim() : '';
        RakutenGoraAPI.setStoredApiKeys(appId, accessKey, appUrl);
        updateApiStatusDisplay();
        closeSettingsModal();
        showToast('楽天OpenAPI設定を保存しました');
        performSearch();
      });
    }

    // APIキークリア
    if (btnClearApiKey) {
      btnClearApiKey.addEventListener('click', (e) => {
        e.stopPropagation();
        if (inputAppId) inputAppId.value = '';
        if (inputAccessKey) inputAccessKey.value = '';
        if (inputAppUrl) inputAppUrl.value = '';
        RakutenGoraAPI.setStoredApiKeys('', '', '');
        updateApiStatusDisplay();
        showToast('API設定をクリアしデモモードに戻しました');
      });
    }

    // エクスポートテキストコピー
    if (btnCopyExport) {
      btnCopyExport.addEventListener('click', (e) => {
        e.stopPropagation();
        if (exportTextarea) {
          exportTextarea.select();
          navigator.clipboard.writeText(exportTextarea.value).then(() => {
            showToast('指定形式テキストをクリップボードにコピーしました！');
          });
        }
      });
    }

    // モーダルカード内のクリックはオーバーレイにバブリングさせない
    document.querySelectorAll('.modal-card').forEach(card => {
      card.addEventListener('click', (e) => {
        e.stopPropagation();
      });
    });

    // モーダルクローズ（閉じるボタン or オーバーレイ背景クリック）
    document.querySelectorAll('.modal-overlay .btn-close').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        closeAllModals();
      });
    });

    document.querySelectorAll('.modal-overlay').forEach(overlay => {
      overlay.addEventListener('click', (e) => {
        if (e.target === overlay) {
          closeAllModals();
        }
      });
    });
  }

  function openSettingsModal() {
    closeCalendar();
    closePrefPicklist();
    closeTimePicklist();
    if (inputAppId) inputAppId.value = RakutenGoraAPI.getStoredAppId();
    if (inputAccessKey) inputAccessKey.value = RakutenGoraAPI.getStoredAccessKey();
    if (inputAppUrl) inputAppUrl.value = RakutenGoraAPI.getStoredAppUrl();
    if (settingsModal) settingsModal.classList.add('active');
  }

  function closeSettingsModal() {
    if (settingsModal) settingsModal.classList.remove('active');
  }

  function closeAllModals() {
    document.querySelectorAll('.modal-overlay').forEach(m => m.classList.remove('active'));
  }

  // グローバル公開（クリックイベントの確実な実行のため）
  window.openSettingsModal = openSettingsModal;
  window.closeSettingsModal = closeSettingsModal;
  window.openExportModal = openExportModal;
  window.closeAllModals = closeAllModals;

  /**
   * 簡易debounce関数
   */
  function debounce(fn, delay) {
    let timer = null;
    return function(...args) {
      clearTimeout(timer);
      timer = setTimeout(() => fn.apply(this, args), delay);
    };
  }

  /**
   * ヘッダーのAPIステータスバッジの更新
   */
  function updateApiStatusDisplay() {
    if (!apiStatusText) return;
    const appId = RakutenGoraAPI.getStoredAppId();
    const accessKey = RakutenGoraAPI.getStoredAccessKey();
    if (appId && accessKey) {
      apiStatusText.textContent = '🟢 楽天OpenAPI連携中';
      apiStatusText.style.color = 'var(--primary)';
    } else if (appId) {
      apiStatusText.textContent = '🟡 AppID設定済 (AccessKey未設定)';
      apiStatusText.style.color = 'var(--accent-gold)';
    } else {
      apiStatusText.textContent = '🟡 デモ・サンプルモード';
      apiStatusText.style.color = 'var(--text-secondary)';
    }
  }

  let currentRequestInfo = null;

  /**
   * APIリクエストURLパラメータ情報の描画・更新 (Client ID / Access Key 除外)
   */
  function renderRequestParamsDisplay(params) {
    if (!requestParamsCard) return;

    const info = RakutenGoraAPI.getCleanRequestInfo(params);
    currentRequestInfo = info;

    const hasAppId = !!RakutenGoraAPI.getStoredAppId();
    const hasAccessKey = !!RakutenGoraAPI.getStoredAccessKey();
    const isOpenApi = hasAppId && hasAccessKey;

    if (requestParamsModeBadge) {
      if (isOpenApi) {
        requestParamsModeBadge.textContent = '🟢 OpenAPI送信';
        requestParamsModeBadge.style.color = 'var(--primary-light)';
        requestParamsModeBadge.style.borderColor = 'rgba(16, 185, 129, 0.4)';
        requestParamsModeBadge.style.background = 'rgba(16, 185, 129, 0.15)';
      } else {
        requestParamsModeBadge.textContent = '🟡 デモ・サンプル';
        requestParamsModeBadge.style.color = 'var(--accent-gold)';
        requestParamsModeBadge.style.borderColor = 'rgba(245, 158, 11, 0.4)';
        requestParamsModeBadge.style.background = 'rgba(245, 158, 11, 0.15)';
      }
    }

    if (requestTimeBadge) {
      requestTimeBadge.textContent = `リクエスト時刻: ${info.timestamp}`;
    }

    if (requestUrlCode) {
      requestUrlCode.textContent = info.fullUrl;
    }

    if (requestParamsCount) {
      requestParamsCount.textContent = info.paramList.length;
    }

    if (requestParamsGrid) {
      requestParamsGrid.innerHTML = info.paramList.map(item => {
        return `
          <div class="param-item-card" title="${item.key}: ${item.description}">
            <div class="param-item-header">
              <span class="param-item-key">${item.key}</span>
              <span class="param-item-desc">${item.description.split('(')[0].trim()}</span>
            </div>
            <div class="param-item-val">${item.value}</div>
          </div>
        `;
      }).join('');
    }

    requestParamsCard.style.display = 'block';
  }

  let currentSearchAbortController = null;

  /**
   * 検索の実行
   */
  async function performSearch() {
    // 進行中の古い検索リクエストがあれば即座にキャンセル（通信詰まり解消）
    if (currentSearchAbortController) {
      currentSearchAbortController.abort();
    }
    currentSearchAbortController = new AbortController();
    const currentSignal = currentSearchAbortController.signal;

    loadingState.style.display = 'flex';
    emptyState.style.display = 'none';
    resultsTable.style.display = 'none';

    const params = getSearchParams();
    params.signal = currentSignal;

    // リクエストパラメータ情報を画面上に即座に更新・表示
    renderRequestParamsDisplay(params);

    lastSearchParams = { ...params };
    lastSearchTime = new Date().toLocaleString('ja-JP');
    const hasAppId = !!RakutenGoraAPI.getStoredAppId();
    const hasAccessKey = !!RakutenGoraAPI.getStoredAccessKey();
    lastSearchMode = (hasAppId && hasAccessKey) ? '🟢 楽天GORA OpenAPI連携モード' : '🟡 デモ・モックデータモード';

    try {
      const results = await RakutenGoraAPI.searchPlans(params);

      // 他の新しい検索リクエストが開始されていた場合は結果描画をスキップ
      if (currentSignal.aborted) {
        return;
      }

      currentResults = results;

      loadingState.style.display = 'none';
      if (results._apiError) {
        showToast(`⚠️ 楽天APIエラー: ${results._apiError}`, 6000);
      }

      if (results.length === 0) {
        emptyState.style.display = 'flex';
        resultsTable.style.display = 'none';
        resultsCount.textContent = '0';

        const emptyTitle = emptyState.querySelector('h3');
        const emptyDesc = emptyState.querySelector('p');
        if (results._noPrefError) {
          if (emptyTitle) emptyTitle.textContent = '📍 都道府県を1つ以上選択してください';
          if (emptyDesc) emptyDesc.textContent = '検索を実行するには、上の「都道府県」ピックリストから1つ以上の県を選択してください。';
        } else {
          if (emptyTitle) emptyTitle.textContent = '該当するプランが見つかりませんでした';
          if (emptyDesc) emptyDesc.textContent = '条件を緩和するか、別の日程・時間帯・エリアでお試しください。';
        }
      } else {
        emptyState.style.display = 'none';
        resultsTable.style.display = 'table';
        resultsCount.textContent = results.length;
        sortAndRenderTable();
      }
    } catch (err) {
      if (err.name === 'AbortError' || currentSignal.aborted) {
        // キャンセルされた場合は何もしない
        return;
      }
      console.error(err);
      loadingState.style.display = 'none';
      emptyState.style.display = 'flex';
      showToast(`検索エラー: ${err.message}`, 6000);
    }
  }

  /**
   * ソートとテーブル描画
   */
  function sortAndRenderTable() {
    if (!currentResults || currentResults.length === 0) return;

    currentResults.sort((a, b) => {
      let valA, valB;
      switch (currentSort.column) {
        case 'train':
          valA = a.trainTransit.minutes;
          valB = b.trainTransit.minutes;
          break;
        case 'car':
          valA = a.carTransit.minutes;
          valB = b.carTransit.minutes;
          break;
        case 'rating':
          valA = a.rating;
          valB = b.rating;
          break;
        case 'price':
          valA = a.minPrice || 999999;
          valB = b.minPrice || 999999;
          break;
        case 'name':
          return currentSort.order === 'asc' 
            ? a.name.localeCompare(b.name, 'ja') 
            : b.name.localeCompare(a.name, 'ja');
        default:
          valA = a.rating;
          valB = b.rating;
      }
      return currentSort.order === 'asc' ? valA - valB : valB - valA;
    });

    renderTable();
  }

  /**
   * テーブル描画
   */
  function renderTable() {
    resultsTableBody.innerHTML = '';

    currentResults.forEach(course => {
      const tr = document.createElement('tr');

      // 指定された出力形式カラム:
      // 日付 | ゴルフ場名 | 笹塚からの電車の所要時間 | クラブバス送迎有無 | 神田からの車での所要時間 |
      tr.innerHTML = `
        <td class="cell-date">
          <a href="${course.planReserveUrl}" target="_blank" rel="noopener noreferrer" class="date-link" title="${course.name} の ${course.date} プラン予約ページを開く">
            <span class="date-text">📅 ${course.date}</span>
            <span class="date-reserve-tag">予約 ↗</span>
          </a>
        </td>
        <td class="cell-course">
          <a href="${course.coursePageUrl}" target="_blank" rel="noopener noreferrer" class="course-title-link" title="${course.name} のゴルフ場公式詳細ページを開く">
            <span>${course.name}</span>
            <span class="link-arrow">↗</span>
          </a>
          <div class="course-meta">
            <span class="rating-badge">★ ${course.ratingDisplay}</span>
            <span>${course.address.split(' ')[0] || ''}</span>
          </div>
        </td>
        <td class="cell-transit">
          <div class="transit-time train">
            🚆 ${course.trainTransit.text}
          </div>
          <div class="transit-detail">${course.trainTransit.detail}</div>
        </td>
        <td>
          <span class="badge-bus ${course.clubBus.badgeClass}">
            ${course.clubBus.text}
          </span>
        </td>
        <td class="cell-transit">
          <div class="transit-time car">
            🚗 ${course.carTransit.text}
          </div>
          <div class="transit-detail">${course.carTransit.detail}</div>
        </td>
        <td class="cell-action">
          <div class="plan-price">
            ${course.minPrice ? '¥' + course.minPrice.toLocaleString() + '<span>〜</span>' : 'プラン参照'}
          </div>
          <button class="btn btn-secondary btn-sm btn-detail" style="margin-top: 0.35rem;" data-id="${course.id}">
            詳細 / プラン
          </button>
        </td>
      `;

      // 詳細ボタンイベント
      tr.querySelector('.btn-detail').addEventListener('click', () => {
        openCourseDetail(course);
      });

      resultsTableBody.appendChild(tr);
    });
  }

  /**
   * 指定出力形式（日付|ゴルフ場名|笹塚からの電車の所要時間|クラブバス送迎有無|神田からの車での所要時間|）のテキスト生成
   */
  function generateFormattedOutput() {
    let output = '日付|ゴルフ場名|笹塚からの電車の所要時間|クラブバス送迎有無|神田からの車での所要時間|\n';
    currentResults.forEach(c => {
      output += `${c.date}|${c.name}|${c.trainTransit.text}|${c.clubBus.text}|${c.carTransit.text}|\n`;
    });
    return output;
  }

  /**
   * エクスポートモーダルの表示
   */
  function openExportModal() {
    const formattedText = generateFormattedOutput();
    exportTextarea.value = formattedText;
    exportModal.classList.add('active');
  }

  /**
   * CSVダウンロード
   */
  function downloadCsv() {
    const formattedText = generateFormattedOutput();
    const bom = new Uint8Array([0xEF, 0xBB, 0xBF]);
    const blob = new Blob([bom, formattedText], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `golf_courses_${inputPlayDate.value || 'search'}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('CSVファイルをダウンロードしました');
  }

  /**
   * コース詳細モーダルの表示
   */
  function openCourseDetail(course) {
    const modalTitle = document.getElementById('detailModalTitle');
    const modalContent = document.getElementById('detailModalContent');

    modalTitle.textContent = course.name;

    let plansHtml = '';
    if (course.plans && course.plans.length > 0) {
      plansHtml = course.plans.map(p => `
        <div style="background: rgba(255,255,255,0.03); border: 1px solid var(--border-glass); border-radius: 8px; padding: 0.85rem; margin-bottom: 0.5rem; display: flex; justify-content: space-between; align-items: center;">
          <div>
            <div style="font-weight: 700; color: #fff; font-size: 0.9rem;">${p.planName}</div>
            <div style="font-size: 0.75rem; color: var(--text-secondary); margin-top: 0.2rem;">スタート: ${p.callTime} ${p.lunch ? '・昼食付' : ''}</div>
          </div>
          <div style="font-size: 1.1rem; font-weight: 800; color: var(--accent-gold);">
            ¥${p.price ? p.price.toLocaleString() : '---'}
          </div>
        </div>
      `).join('');
    } else {
      plansHtml = '<div style="color: var(--text-muted); font-size: 0.85rem;">楽天GORAで最新の空き枠プランをご確認ください。</div>';
    }

    const master = course.clubBus.masterData;
    let busSectionHtml = '';

    if (master && master.hasClubBus) {
      const morningTimes = master.morningTimetable && master.morningTimetable.length > 0
        ? master.morningTimetable.map(t => `<span style="display: inline-block; background: rgba(16, 185, 129, 0.2); color: #34d399; padding: 2px 8px; border-radius: 4px; font-size: 0.8rem; margin: 2px;">${t}</span>`).join(' ')
        : '要問合せ';

      busSectionHtml = `
        <div style="background: rgba(16, 185, 129, 0.08); border: 1px solid rgba(16, 185, 129, 0.25); border-radius: 8px; padding: 0.85rem; margin-top: 0.75rem;">
          <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 0.4rem;">
            <div style="font-weight: 700; font-size: 0.85rem; color: #34d399;">🚌 クラブバス運行ダイヤ・アクセス情報</div>
            <span class="badge-bus ${course.clubBus.badgeClass}">${master.reservationType || '定期運行'}</span>
          </div>
          <div style="font-size: 0.8rem; color: var(--text-secondary); display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 0.4rem; margin-bottom: 0.5rem;">
            <div><strong>発着駅:</strong> ${master.railwayLine ? master.railwayLine + ' ' : ''}${master.departureStation || '---'}${master.departureExit ? ' (' + master.departureExit + ')' : ''}</div>
            <div><strong>バス所要時間:</strong> 約${master.busTransitMinutes || '--'}分</div>
            <div><strong>運行区分:</strong> ${master.operationType || '---'}</div>
            <div><strong>予約締切:</strong> ${master.reservationDeadline || '予約不要'}</div>
          </div>
          <div style="font-size: 0.8rem; color: var(--text-secondary); margin-bottom: 0.4rem;">
            <strong>朝の運行便:</strong> ${morningTimes}
          </div>
          ${master.returnBusInfo ? `<div style="font-size: 0.8rem; color: var(--text-secondary); margin-bottom: 0.4rem;"><strong>復路（帰り便）:</strong> ${master.returnBusInfo}</div>` : ''}
          ${master.notes ? `<div style="font-size: 0.75rem; color: var(--text-muted); margin-top: 0.3rem;">※ ${master.notes}</div>` : ''}
        </div>
      `;
    } else if (master && !master.hasClubBus) {
      busSectionHtml = `
        <div style="background: rgba(255, 255, 255, 0.03); border: 1px solid var(--border-glass); border-radius: 8px; padding: 0.75rem; margin-top: 0.75rem;">
          <div style="font-weight: 700; font-size: 0.85rem; color: var(--text-muted); margin-bottom: 0.3rem;">🚕 クラブバスなし（タクシー・車アクセス）</div>
          <div style="font-size: 0.8rem; color: var(--text-secondary);">
            最寄駅: ${master.railwayLine ? master.railwayLine + ' ' : ''}${master.departureStation || '最寄駅'}よりタクシー約${master.taxiTransitMinutes || 15}分（目安: ${master.taxiApproxFare || '---'}）
          </div>
          ${master.notes ? `<div style="font-size: 0.75rem; color: var(--text-muted); margin-top: 0.2rem;">※ ${master.notes}</div>` : ''}
        </div>
      `;
    } else {
      busSectionHtml = `
        <div style="background: rgba(255, 255, 255, 0.03); border: 1px solid var(--border-glass); border-radius: 8px; padding: 0.75rem; margin-top: 0.75rem;">
          <div style="font-size: 0.85rem; color: var(--text-secondary);"><strong>クラブバス:</strong> ${course.clubBus.detail}</div>
        </div>
      `;
    }

    modalContent.innerHTML = `
      <div style="display: flex; gap: 1rem; flex-wrap: wrap;">
        <div style="flex: 1; min-width: 240px;">
          <div style="margin-bottom: 0.75rem;">
            <span class="rating-badge" style="font-size: 0.85rem;">★ GORA評価: ${course.ratingDisplay}</span>
          </div>
          <p style="font-size: 0.85rem; color: var(--text-secondary); margin-bottom: 0.5rem;"><strong>住所:</strong> ${course.address}</p>
          <p style="font-size: 0.85rem; color: var(--text-secondary); margin-bottom: 0.5rem;"><strong>高速道路:</strong> ${course.highway || '最寄IC情報あり'}</p>
        </div>
        <div style="flex: 1; min-width: 240px; background: rgba(16, 185, 129, 0.05); padding: 1rem; border-radius: 8px; border: 1px solid var(--border-glass-bright);">
          <div style="font-size: 0.8rem; font-weight: 700; color: var(--primary-light); margin-bottom: 0.5rem;">📍 交通アクセス所要時間</div>
          <div style="font-size: 0.85rem; margin-bottom: 0.4rem;">🚆 <strong>笹塚から（電車）:</strong> ${course.trainTransit.text} (${course.trainTransit.detail})</div>
          <div style="font-size: 0.85rem;">🚗 <strong>神田から（車）:</strong> ${course.carTransit.text} (${course.carTransit.detail})</div>
        </div>
      </div>

      ${busSectionHtml}

      <div style="margin-top: 1rem;">
        <h4 style="font-size: 0.95rem; font-weight: 700; color: #fff; margin-bottom: 0.75rem;">空きプラン・料金</h4>
        ${plansHtml}
      </div>

      <div style="margin-top: 1.5rem; display: flex; justify-content: flex-end; gap: 0.75rem; flex-wrap: wrap;">
        <a href="${course.coursePageUrl}" target="_blank" rel="noopener noreferrer" class="btn btn-secondary">
          🏛️ ゴルフ場公式案内ページ ↗
        </a>
        <a href="${course.planReserveUrl}" target="_blank" rel="noopener noreferrer" class="btn btn-primary">
          ⛳ ${course.date} のプラン予約へ進む ↗
        </a>
      </div>
    `;

    detailModal.classList.add('active');
  }

  /**
   * APIステータスバッジの更新
   */
  function updateApiStatusDisplay() {
    const key = RakutenGoraAPI.getStoredAppId();
    if (key) {
      apiStatusText.textContent = '楽天GORA API 接続中';
      apiStatusText.style.color = '#34d399';
    } else {
      apiStatusText.textContent = 'デモ/サンプルモード動作中';
      apiStatusText.style.color = '#94a3b8';
    }
  }

  /**
   * トースト通知の表示
   */
  function showToast(message) {
    let container = document.querySelector('.toast-container');
    if (!container) {
      container = document.createElement('div');
      container.className = 'toast-container';
      document.body.appendChild(container);
    }

    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.innerHTML = `<span>✓</span> <span>${message}</span>`;
    container.appendChild(toast);

    setTimeout(() => toast.classList.add('show'), 10);
    setTimeout(() => {
      toast.classList.remove('show');
      setTimeout(() => toast.remove(), 300);
    }, 2800);
  }

  // 初期実行
  init();
}

// DOMのロード状態に応じた確実な起動処理
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', startApp);
} else {
  startApp();
}
