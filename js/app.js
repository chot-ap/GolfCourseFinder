/**
 * GolfCourseFinder - Main Application Controller
 */

document.addEventListener('DOMContentLoaded', () => {
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

  // DOM Elements - Time Chips & Conditions
  const timeChipsContainer = document.getElementById('timeChipsContainer');
  const btnSelectAllTimes = document.getElementById('btnSelectAllTimes');
  const btnClearAllTimes = document.getElementById('btnClearAllTimes');
  const selectedTimesSummary = document.getElementById('selectedTimesSummary');
  const selectMinRating = document.getElementById('selectMinRating');
  const inputExclude = document.getElementById('inputExclude');

  // DOM Elements - Results & Modals
  const resultsSection = document.getElementById('resultsSection');
  const resultsTableBody = document.getElementById('resultsTableBody');
  const resultsCount = document.getElementById('resultsCount');
  const loadingState = document.getElementById('loadingState');
  const emptyState = document.getElementById('emptyState');
  const resultsTable = document.getElementById('resultsTable');

  const btnExportFormat = document.getElementById('btnExportFormat');
  const btnExportCsv = document.getElementById('btnExportCsv');
  const btnSettings = document.getElementById('btnSettings');

  const exportModal = document.getElementById('exportModal');
  const settingsModal = document.getElementById('settingsModal');
  const detailModal = document.getElementById('detailModal');
  const exportTextarea = document.getElementById('exportTextarea');
  const btnCopyExport = document.getElementById('btnCopyExport');
  const inputApiKey = document.getElementById('inputApiKey');
  const btnSaveApiKey = document.getElementById('btnSaveApiKey');
  const btnClearApiKey = document.getElementById('btnClearApiKey');
  const apiStatusText = document.getElementById('apiStatusText');

  // State
  let currentResults = [];
  let currentSort = { column: 'rating', order: 'desc' };
  let selectedDate = new Date();
  let calCurrentYear = selectedDate.getFullYear();
  let calCurrentMonth = selectedDate.getMonth(); // 0-indexed
  let selectedPrefCodes = []; // 選択された都道府県コード（空配列なら全県）
  let selectedStartTimes = ['08', '09']; // デフォルト選択時間帯

  // 都道府県マスターデータ（エリア別）
  const PREFECTURES_BY_AREA = {
    '8': [ // 関東
      { code: '12', name: '千葉県' },
      { code: '11', name: '埼玉県' },
      { code: '14', name: '神奈川県' },
      { code: '8', name: '茨城県' },
      { code: '9', name: '栃木県' },
      { code: '10', name: '群馬県' },
      { code: '13', name: '東京都' }
    ],
    '9': [ // 甲信越
      { code: '19', name: '山梨県' },
      { code: '20', name: '長野県' },
      { code: '15', name: '新潟県' }
    ],
    '10': [ // 東海・中部
      { code: '22', name: '静岡県' },
      { code: '23', name: '愛知県' },
      { code: '21', name: '岐阜県' },
      { code: '24', name: '三重県' }
    ]
  };

  const WEEKDAYS_JA = ['日', '月', '火', '水', '木', '金', '土'];

  /**
   * 初期化処理
   */
  function init() {
    initDatePicker();
    initCalendarWidget();
    initPrefecturePicklist();
    initTimeChips();
    initEventListeners();
    updateApiStatusDisplay();

    // 初回検索実行
    performSearch();
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

    // 表示テキスト
    const year = selectedDate.getFullYear();
    const month = selectedDate.getMonth() + 1;
    const day = selectedDate.getDate();
    const weekday = WEEKDAYS_JA[selectedDate.getDay()];
    selectedDateText.textContent = `${year}年${month}月${day}日 (${weekday})`;

    calCurrentYear = selectedDate.getFullYear();
    calCurrentMonth = selectedDate.getMonth();
    updateCalendarSelects();
    renderCalendarDays();
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
    // 年・月セレクトボックスの初期化
    const currentYear = new Date().getFullYear();
    calYearSelect.innerHTML = '';
    for (let y = currentYear - 1; y <= currentYear + 3; y++) {
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

    // 月初前の空白セル
    for (let i = 0; i < firstDay; i++) {
      const emptyCell = document.createElement('div');
      emptyCell.className = 'cal-day-cell empty';
      calendarDaysGrid.appendChild(emptyCell);
    }

    // 各日付セル
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

      // 日付クリックで選択
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

    // ピックリスト開閉
    prefPicklistTrigger.addEventListener('click', (e) => {
      e.stopPropagation();
      const isOpen = prefPicklistDropdown.classList.contains('open');
      if (isOpen) {
        closePrefPicklist();
      } else {
        openPrefPicklist();
      }
    });

    // エリア変更時
    selectArea.addEventListener('change', () => {
      selectedPrefCodes = [];
      renderPrefPicklistOptions();
      updatePrefPicklistUI();
      performSearch();
    });

    // 全選択ボタン
    btnSelectAllPrefs.addEventListener('click', () => {
      const area = selectArea.value || '8';
      const prefs = PREFECTURES_BY_AREA[area] || [];
      selectedPrefCodes = prefs.map(p => p.code);
      renderPrefPicklistOptions();
      updatePrefPicklistUI();
      performSearch();
    });

    // 全解除ボタン
    btnClearAllPrefs.addEventListener('click', () => {
      selectedPrefCodes = [];
      renderPrefPicklistOptions();
      updatePrefPicklistUI();
      performSearch();
    });

    // 外部クリックでピックリスト閉じる
    document.addEventListener('click', (e) => {
      if (!prefPicklistWrapper.contains(e.target)) {
        closePrefPicklist();
      }
    });
  }

  function openPrefPicklist() {
    closeCalendar();
    prefPicklistDropdown.classList.add('open');
    prefPicklistTrigger.classList.add('active');
  }

  function closePrefPicklist() {
    prefPicklistDropdown.classList.remove('open');
    prefPicklistTrigger.classList.remove('active');
  }

  /**
   * 都道府県チェックリストの描画
   */
  function renderPrefPicklistOptions() {
    const area = selectArea.value || '8';
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

  /**
   * ピックリストのプレースホルダーと選択タグ表示の更新
   */
  function updatePrefPicklistUI() {
    const area = selectArea.value || '8';
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

      // タグ表示
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
   * スタート時間帯複数選択チップの初期化
   */
  function initTimeChips() {
    updateTimeChipsUI();

    timeChipsContainer.querySelectorAll('.time-chip').forEach(chip => {
      chip.addEventListener('click', (e) => {
        const timeVal = chip.dataset.time;
        if (selectedStartTimes.includes(timeVal)) {
          selectedStartTimes = selectedStartTimes.filter(t => t !== timeVal);
        } else {
          selectedStartTimes.push(timeVal);
          selectedStartTimes.sort();
        }
        updateTimeChipsUI();
      });
    });

    btnSelectAllTimes.addEventListener('click', () => {
      selectedStartTimes = ['07', '08', '09', '10', '11'];
      updateTimeChipsUI();
    });

    btnClearAllTimes.addEventListener('click', () => {
      selectedStartTimes = [];
      updateTimeChipsUI();
    });
  }

  /**
   * 時間帯チップのUIおよびサマリーの更新
   */
  function updateTimeChipsUI() {
    timeChipsContainer.querySelectorAll('.time-chip').forEach(chip => {
      const timeVal = chip.dataset.time;
      if (selectedStartTimes.includes(timeVal)) {
        chip.classList.add('active');
      } else {
        chip.classList.remove('active');
      }
    });

    if (selectedStartTimes.length === 0) {
      selectedTimesSummary.textContent = '時間帯: 全時間帯（指定なし）';
    } else if (selectedStartTimes.length === 5) {
      selectedTimesSummary.textContent = '時間帯: すべての時間帯';
    } else {
      const names = selectedStartTimes.map(t => t === '07' ? '〜07時台' : t === '11' ? '11時台以降' : `${t}時台`);
      selectedTimesSummary.textContent = `時間帯: ${names.join(', ')}`;
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
      performSearch();
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
    btnExportFormat.addEventListener('click', () => {
      openExportModal();
    });

    // CSVダウンロード
    btnExportCsv.addEventListener('click', () => {
      downloadCsv();
    });

    // 設定モーダル
    btnSettings.addEventListener('click', () => {
      inputApiKey.value = RakutenGoraAPI.getStoredAppId();
      settingsModal.classList.add('active');
    });

    // APIキー保存
    btnSaveApiKey.addEventListener('click', () => {
      const key = inputApiKey.value.trim();
      RakutenGoraAPI.setStoredAppId(key);
      updateApiStatusDisplay();
      settingsModal.classList.remove('active');
      showToast('API設定を保存しました');
      performSearch();
    });

    // APIキークリア
    btnClearApiKey.addEventListener('click', () => {
      inputApiKey.value = '';
      RakutenGoraAPI.setStoredAppId('');
      updateApiStatusDisplay();
      showToast('APIキーをクリアしデモモードに戻しました');
    });

    // エクスポートテキストコピー
    btnCopyExport.addEventListener('click', () => {
      exportTextarea.select();
      navigator.clipboard.writeText(exportTextarea.value).then(() => {
        showToast('指定形式テキストをクリップボードにコピーしました！');
      });
    });

    // モーダルクローズ
    document.querySelectorAll('.modal-overlay .btn-close, .modal-overlay').forEach(el => {
      el.addEventListener('click', (e) => {
        if (e.target === el || e.target.classList.contains('btn-close')) {
          document.querySelectorAll('.modal-overlay').forEach(m => m.classList.remove('active'));
        }
      });
    });
  }

  /**
   * 検索の実行
   */
  async function performSearch() {
    loadingState.style.display = 'flex';
    emptyState.style.display = 'none';
    resultsTable.style.display = 'none';

    const params = {
      playDate: inputPlayDate.value || formatDate(selectedDate),
      areaCode: selectArea.value,
      prefCodes: selectedPrefCodes, // 複数選択された都道府県コード配列
      startTimes: selectedStartTimes, // 複数選択された時間帯配列
      minRating: parseFloat(selectMinRating.value || 3.5),
      excludeKeyword: inputExclude.value.trim() || 'アコーディア'
    };

    try {
      const results = await RakutenGoraAPI.searchPlans(params);
      currentResults = results;

      loadingState.style.display = 'none';
      if (results.length === 0) {
        emptyState.style.display = 'flex';
        resultsTable.style.display = 'none';
        resultsCount.textContent = '0';
      } else {
        emptyState.style.display = 'none';
        resultsTable.style.display = 'table';
        resultsCount.textContent = results.length;
        sortAndRenderTable();
      }
    } catch (err) {
      console.error(err);
      loadingState.style.display = 'none';
      emptyState.style.display = 'flex';
      showToast('検索中にエラーが発生しました');
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

    modalContent.innerHTML = `
      <div style="display: flex; gap: 1rem; flex-wrap: wrap;">
        <div style="flex: 1; min-width: 240px;">
          <div style="margin-bottom: 0.75rem;">
            <span class="rating-badge" style="font-size: 0.85rem;">★ GORA評価: ${course.ratingDisplay}</span>
          </div>
          <p style="font-size: 0.85rem; color: var(--text-secondary); margin-bottom: 0.5rem;"><strong>住所:</strong> ${course.address}</p>
          <p style="font-size: 0.85rem; color: var(--text-secondary); margin-bottom: 0.5rem;"><strong>高速道路:</strong> ${course.highway || '最寄IC情報あり'}</p>
          <p style="font-size: 0.85rem; color: var(--text-secondary); margin-bottom: 0.5rem;"><strong>クラブバス:</strong> ${course.clubBus.detail}</p>
        </div>
        <div style="flex: 1; min-width: 240px; background: rgba(16, 185, 129, 0.05); padding: 1rem; border-radius: 8px; border: 1px solid var(--border-glass-bright);">
          <div style="font-size: 0.8rem; font-weight: 700; color: var(--primary-light); margin-bottom: 0.5rem;">📍 交通アクセス所要時間</div>
          <div style="font-size: 0.85rem; margin-bottom: 0.4rem;">🚆 <strong>笹塚から（電車）:</strong> ${course.trainTransit.text} (${course.trainTransit.detail})</div>
          <div style="font-size: 0.85rem;">🚗 <strong>神田から（車）:</strong> ${course.carTransit.text} (${course.carTransit.detail})</div>
        </div>
      </div>

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
});
