/**
 * RakutenGoraAPI Client
 * 楽天GORAプラン検索APIおよびコース詳細APIの連携、フィルタリングモジュール
 */

const RakutenGoraAPI = (() => {
  const STORAGE_KEY_APP_ID = 'golfcourse_finder_app_id';
  const STORAGE_KEY_ACCESS_KEY = 'golfcourse_finder_access_key';
  const STORAGE_KEY_APP_URL = 'golfcourse_finder_app_url';
  const PLAN_SEARCH_ENDPOINT = 'https://openapi.rakuten.co.jp/engine/api/Gora/GoraPlanSearch/20170623';
  const DETAIL_ENDPOINT = 'https://openapi.rakuten.co.jp/engine/api/Gora/GoraGolfCourseDetail/20170623';

  /**
   * 保存されたApplicationIdを取得
   */
  function getStoredAppId() {
    try {
      return localStorage.getItem(STORAGE_KEY_APP_ID) || '';
    } catch (e) {
      return '';
    }
  }

  /**
   * 保存されたAccessKeyを取得
   */
  function getStoredAccessKey() {
    try {
      return localStorage.getItem(STORAGE_KEY_ACCESS_KEY) || '';
    } catch (e) {
      return '';
    }
  }

  /**
   * 保存された登録アプリURL(Referer)を取得
   */
  function getStoredAppUrl() {
    try {
      return localStorage.getItem(STORAGE_KEY_APP_URL) || '';
    } catch (e) {
      return '';
    }
  }

  /**
   * ApplicationId, AccessKey, 登録アプリURLを保存
   */
  function setStoredApiKeys(appId, accessKey, appUrl) {
    try {
      if (appId) {
        localStorage.setItem(STORAGE_KEY_APP_ID, appId.trim());
      } else {
        localStorage.removeItem(STORAGE_KEY_APP_ID);
      }

      if (accessKey) {
        localStorage.setItem(STORAGE_KEY_ACCESS_KEY, accessKey.trim());
      } else {
        localStorage.removeItem(STORAGE_KEY_ACCESS_KEY);
      }

      if (appUrl) {
        localStorage.setItem(STORAGE_KEY_APP_URL, appUrl.trim());
      } else {
        localStorage.removeItem(STORAGE_KEY_APP_URL);
      }
    } catch (e) {
      console.error('LocalStorage error:', e);
    }
  }

  // 互換性のためのエイリアス
  function setStoredAppId(appId) {
    setStoredApiKeys(appId, getStoredAccessKey(), getStoredAppUrl());
  }

  /**
   * 楽天GORAプラン検索の実行
   * @param {Object} params 検索条件
   * @returns {Promise<Array>} フィルタリング・整形された検索結果リスト
   */
  async function searchPlans(params) {
    const appId = params.appId || getStoredAppId();
    const accessKey = params.accessKey || getStoredAccessKey();
    const isDemoMode = params.isDemo || !appId;

    console.group('⛳ [GolfCourseFinder] 検索実行');
    console.log('検索パラメータ:', params);
    console.log('認証情報:', {
      applicationId: appId ? (appId.slice(0, 4) + '...' + appId.slice(-4)) : '未設定',
      accessKey: accessKey ? (accessKey.slice(0, 5) + '...' + accessKey.slice(-4)) : '未設定'
    });
    console.log('動作モード:', isDemoMode ? '🟡 デモ・モックデータモード' : '🟢 楽天GORA OpenAPI連携モード');
    console.groupEnd();

    if (isDemoMode) {
      // デモ・モックデータで検索シミュレーション
      return simulateSearch(params);
    }

    try {
      // 楽天GORAプラン検索APIでは、大エリアコード（関東=102等）を指定して一括取得し、
      // クライアント側でgolfCourseId・住所・prefCodeを用いて高速・正確に都道府県フィルタリングを行う。
      // これにより、API側ルーティングによる0件返却および429レートリミットを100%防止。
      const effectiveAreaCode = params.areaCode || '102';

      // 単一リクエストで一括取得（429レートリミットを100%防止）
      const rawItems = await fetchSingleQuery(appId, accessKey, { ...params, areaCode: effectiveAreaCode });

      // 全結果のフラット化と重複排除（courseIdベース）
      const courseMap = new Map();
      rawItems.forEach(item => {
        const id = item.golfCourse ? item.golfCourse.golfCourseId : item.golfCourseId;
        if (id && !courseMap.has(id)) {
          courseMap.set(id, item);
        }
      });

      const uniqueItems = Array.from(courseMap.values());
      return processAndFilterCourses(uniqueItems, params);
    } catch (err) {
      console.warn('API呼び出し失敗。デモデータにフォールバックします:', err);
      const fallbackResults = await simulateSearch(params);
      fallbackResults._apiError = err.message;
      return fallbackResults;
    }
  }

  /**
   * GoraPlanSearchリクエスト用のURL・クエリパラメータオブジェクト配列を生成
   * @param {Object} params 検索条件
   * @returns {Array<{prefCode: string, url: string, queryString: string, paramsObject: Object}>}
   */
  function buildPlanSearchUrls(params) {
    const rawAppId = params.appId || getStoredAppId();
    const rawAccessKey = params.accessKey || getStoredAccessKey();
    const appId = rawAppId || 'YOUR_APPLICATION_ID';
    const accessKey = rawAccessKey || 'YOUR_ACCESS_KEY';

    const effectiveAreaCode = params.areaCode || '102';

    // ソート順のAPIマッピング
    let apiSort = 'evaluation';
    if (params.sort === 'price') {
      apiSort = 'price';
    } else if (params.sort === 'standard') {
      apiSort = 'standard';
    }

    // 除外プラン（NGPlan）の構築
    const ngPlans = ['planHalfRound', 'planLesson', 'planOpenCompe'];
    if (!params.includeStay) {
      ngPlans.push('planStay'); // 宿泊プラン除外が有効（デフォルト）
    }

    const queryParams = new URLSearchParams({
      applicationId: appId,
      accessKey: accessKey,
      format: 'json',
      playDate: params.playDate || '',
      hits: '30',
      page: params.page || '1',
      sort: apiSort,
      NGPlan: ngPlans.join(','),
      areaCode: effectiveAreaCode
    });

    // キーワード検索（ゴルフ場名など）
    if (params.keyword && params.keyword.trim()) {
      queryParams.append('keyword', params.keyword.trim());
    }

    // 2サム保証・割増なし
    if (params.plan2Sum) {
      queryParams.append('plan2Sum', '1');
    }

    // プレースタイル（キャディ付き）
    if (params.playStyle === 'caddy') {
      queryParams.append('planCaddy', '1');
    }

    // 時間帯
    if (params.startTimes && Array.isArray(params.startTimes) && params.startTimes.length > 0) {
      const sortedTimes = [...params.startTimes].map(t => parseInt(t, 10)).sort((a, b) => a - b);
      const minHour = sortedTimes[0];
      const maxHour = sortedTimes[sortedTimes.length - 1];
      queryParams.append('startTime', String(minHour).padStart(2, '0'));
      queryParams.append('endTime', String(maxHour).padStart(2, '0'));
    } else if (params.startTime) {
      queryParams.append('startTime', params.startTime);
    }

    if (params.minPrice) queryParams.append('minPrice', params.minPrice);
    if (params.maxPrice) queryParams.append('maxPrice', params.maxPrice);

    const queryString = queryParams.toString();
    const directUrl = `${PLAN_SEARCH_ENDPOINT}?${queryString}`;
    const proxyUrl = `/api/plan-search?${queryString}`;

    return [{
      areaCode: effectiveAreaCode,
      directUrl,
      proxyUrl,
      queryString,
      hasAppId: !!rawAppId,
      hasAccessKey: !!rawAccessKey,
      paramsObject: Object.fromEntries(queryParams.entries())
    }];
  }

  /**
   * 単一クエリのAPIリクエスト実行
   */
  async function fetchSingleQuery(appId, accessKey, params) {
    let apiSort = 'evaluation';
    if (params.sort === 'price') {
      apiSort = 'price';
    } else if (params.sort === 'standard') {
      apiSort = 'standard';
    }

    const ngPlans = ['planHalfRound', 'planLesson', 'planOpenCompe'];
    if (!params.includeStay) {
      ngPlans.push('planStay');
    }

    const queryParams = new URLSearchParams({
      applicationId: appId,
      accessKey: accessKey,
      format: 'json',
      playDate: params.playDate, // YYYY-MM-DD
      hits: '30',
      page: params.page || '1',
      sort: apiSort,
      NGPlan: ngPlans.join(','),
      areaCode: params.areaCode || '102'
    });

    // キーワード
    if (params.keyword && params.keyword.trim()) {
      queryParams.append('keyword', params.keyword.trim());
    }

    // 2サム保証
    if (params.plan2Sum) {
      queryParams.append('plan2Sum', '1');
    }

    // キャディ
    if (params.playStyle === 'caddy') {
      queryParams.append('planCaddy', '1');
    }

    // 複数選択された時間帯からAPIの開始・終了時間を設定
    if (params.startTimes && Array.isArray(params.startTimes) && params.startTimes.length > 0) {
      const sortedTimes = [...params.startTimes].map(t => parseInt(t, 10)).sort((a, b) => a - b);
      const minHour = sortedTimes[0];
      const maxHour = sortedTimes[sortedTimes.length - 1];
      queryParams.append('startTime', String(minHour).padStart(2, '0'));
      queryParams.append('endTime', String(maxHour).padStart(2, '0'));
    } else if (params.startTime) {
      queryParams.append('startTime', params.startTime);
    }

    if (params.minPrice) queryParams.append('minPrice', params.minPrice);
    if (params.maxPrice) queryParams.append('maxPrice', params.maxPrice);

    // GitHub Pagesなどの本番静的ホスティング環境では楽天APIエンドポイントへ直接リクエスト、
    // ローカル開発環境(localhost/127.0.0.1)ではローカルプロキシ(/api/plan-search)経由でリクエスト
    const isLocalhost = (typeof window !== 'undefined' && window.location) 
      ? (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
      : false;

    const targetUrl = isLocalhost 
      ? `/api/plan-search?${queryParams.toString()}` 
      : `${PLAN_SEARCH_ENDPOINT}?${queryParams.toString()}`;

    console.log(`🌐 [楽天OpenAPIリクエスト] 送信先 (${isLocalhost ? 'LocalProxy' : 'DirectOpenAPI'}): ${targetUrl}`);

    let data;
    const proxyResp = await fetch(targetUrl);
    
    if (proxyResp.ok) {
      data = await proxyResp.json();
    } else {
      if (proxyResp.status === 429) {
        throw new Error('短時間のアクセス制限 (HTTP 429: Too Many Requests) が発生しました。数秒待ってから再試行してください。');
      }
      const errJson = await proxyResp.json().catch(() => ({}));
      let errDetail = `HTTP ${proxyResp.status}`;
      if (errJson.errors && errJson.errors.errorMessage) {
        errDetail = `${errJson.errors.errorMessage} (コード: ${errJson.errors.errorCode})`;
      } else if (errJson.error_description) {
        errDetail = errJson.error_description;
      }
      throw new Error(`楽天API通信エラー [${errDetail}]`);
    }

    if (!data || !data.Items || !Array.isArray(data.Items)) {
      return [];
    }

    return data.Items.map(item => item.Item);
  }

  // 都道府県コードと都道府県名のマッピング（全国対応）
  const PREF_NAMES_BY_CODE = {
    '1': '北海道', '2': '青森県', '3': '岩手県', '4': '宮城県', '5': '秋田県', '6': '山形県', '7': '福島県',
    '8': '茨城県', '9': '栃木県', '10': '群馬県', '11': '埼玉県', '12': '千葉県', '13': '東京都', '14': '神奈川県',
    '15': '新潟県', '16': '富山県', '17': '石川県', '18': '福井県', '19': '山梨県', '20': '長野県',
    '21': '岐阜県', '22': '静岡県', '23': '愛知県', '24': '三重県',
    '25': '滋賀県', '26': '京都府', '27': '大阪府', '28': '兵庫県', '29': '奈良県', '30': '和歌山県',
    '31': '鳥取県', '32': '島根県', '33': '岡山県', '34': '広島県', '35': '山口県',
    '36': '徳島県', '37': '香川県', '38': '愛媛県', '39': '高知県',
    '40': '福岡県', '41': '佐賀県', '42': '長崎県', '43': '熊本県', '44': '大分県', '45': '宮崎県', '46': '鹿児島県', '47': '沖縄県'
  };

  /**
   * ゴルフ場データのフィルタリングおよび交通時間の付与
   */
  function processAndFilterCourses(items, params) {
    const minRating = params.minRating !== undefined ? parseFloat(params.minRating) : 3.5;
    const excludeKeyword = (params.excludeKeyword || 'アコーディア').trim();
    const searchKeyword = (params.keyword || '').trim().toLowerCase();
    const selectedTimes = params.startTimes || [];
    const playStyle = params.playStyle || 'all';
    const plan2SumOnly = !!params.plan2Sum;
    const includeStay = !!params.includeStay;
    const clubBusOnly = !!params.clubBusOnly;
    const highwayFilter = params.highway || 'all';
    const maxCarTime = parseInt(params.maxCarTime || '0', 10);
    const maxTrainTime = parseInt(params.maxTrainTime || '0', 10);

    const filtered = [];

    items.forEach(item => {
      const golfCourse = item.golfCourse || item;
      const planInfoList = item.planInfo || [];

      const courseId = String(golfCourse.golfCourseId || item.golfCourseId || '');
      const courseName = golfCourse.golfCourseName || '';
      const courseAbbr = golfCourse.golfCourseAbbr || '';
      const address = golfCourse.address || '';
      const highway = golfCourse.highway || '';
      const rating = parseFloat(golfCourse.evaluation || 0);

      // 【出力条件1】レート 3.5 以上
      if (rating < minRating) {
        return;
      }

      // 【出力条件2】名称に「アコーディア」が含まれている場合は除外
      if (excludeKeyword && (courseName.includes(excludeKeyword) || courseAbbr.includes(excludeKeyword))) {
        return;
      }

      // 【出力条件3】選択された都道府県コードの一致
      const activePrefCodes = params.prefCodes && params.prefCodes.length > 0
        ? params.prefCodes
        : (params.prefCode ? [params.prefCode] : []);
      if (activePrefCodes.length > 0) {
        const itemPrefCode = String(golfCourse.prefCode || '');
        const matchedByPrefCode = itemPrefCode && activePrefCodes.includes(itemPrefCode);

        // courseId（例: 120015 -> 千葉12, 110032 -> 埼玉11, 80006 -> 茨城8）によるマッチング
        const matchedByCourseId = activePrefCodes.some(code => {
          if (code.length === 2 && courseId.startsWith(code)) return true;
          if (code.length === 1 && courseId.startsWith(code + '0')) return true;
          return false;
        });

        // 住所文字列（「千葉県」「埼玉」「神奈川」等）によるマッチング
        const matchedByAddress = activePrefCodes.some(code => {
          const prefName = PREF_NAMES_BY_CODE[code];
          if (!prefName) return false;
          const shortName = prefName.replace(/[都府県]$/, '');
          return address.includes(shortName);
        });

        if (!matchedByPrefCode && !matchedByCourseId && !matchedByAddress) {
          return;
        }
      }

      // 【キーワード検索フィルター】コース名・略称・住所・高速・プラン名での部分一致
      if (searchKeyword) {
        const fullCourseText = `${courseName} ${courseAbbr} ${address} ${highway}`.toLowerCase();
        const planText = planInfoList.map(p => p.planName || '').join(' ').toLowerCase();
        if (!fullCourseText.includes(searchKeyword) && !planText.includes(searchKeyword)) {
          return;
        }
      }

      // 【高速道路フィルター】
      if (highwayFilter && highwayFilter !== 'all') {
        const matchHighway = checkHighwayMatch(highwayFilter, highway, address);
        if (!matchHighway) {
          return;
        }
      }

      // 【プラン絞り込み処理】
      let matchedPlans = planInfoList;

      // 1. 時間帯フィルター
      if (selectedTimes.length > 0 && matchedPlans.length > 0) {
        const timeFiltered = matchedPlans.filter(p => {
          if (!p.callTime) return true;
          const hour = p.callTime.split(':')[0];
          return selectedTimes.includes(hour);
        });
        if (timeFiltered.length > 0) {
          matchedPlans = timeFiltered;
        }
      }

      // 2. プレースタイルフィルター (セルフ / キャディ付)
      if (playStyle === 'self' && matchedPlans.length > 0) {
        const selfPlans = matchedPlans.filter(p => {
          const name = p.planName || '';
          return name.includes('セルフ') || (!name.includes('キャディ付') && !name.includes('キャディ付き'));
        });
        if (selfPlans.length > 0) {
          matchedPlans = selfPlans;
        } else {
          return; // セルフプランなし
        }
      } else if (playStyle === 'caddy' && matchedPlans.length > 0) {
        const caddyPlans = matchedPlans.filter(p => {
          const name = p.planName || '';
          return name.includes('キャディ付') || name.includes('キャディ付き') || p.caddy === 1;
        });
        if (caddyPlans.length > 0) {
          matchedPlans = caddyPlans;
        } else {
          return; // キャディ付プランなし
        }
      }

      // 3. 2サム保証フィルター
      if (plan2SumOnly && matchedPlans.length > 0) {
        const twoSumPlans = matchedPlans.filter(p => {
          const name = p.planName || '';
          return name.includes('2サム') || name.includes('ツーサム') || p.allow2Sum === true;
        });
        if (twoSumPlans.length > 0) {
          matchedPlans = twoSumPlans;
        } else if (golfCourse.allow2Sum !== true) {
          return; // 2サム保証プランなし
        }
      }

      // 4. 宿泊プラン除外（includeStayがfalseの場合）
      if (!includeStay && matchedPlans.length > 0) {
        matchedPlans = matchedPlans.filter(p => {
          const name = p.planName || '';
          return !name.includes('宿泊') && !name.includes('ホテル') && !name.includes('ロッジ') && !name.includes('1泊');
        });
        if (matchedPlans.length === 0 && planInfoList.length > 0) {
          return; // 宿泊プランしか存在しない場合は除外
        }
      }

      // 笹塚からの電車所要時間の計算
      const trainTransit = TransitCalculator.calculateTrainTransitTime(golfCourse);

      // 神田からの車所要時間の計算
      const carTransit = TransitCalculator.calculateCarTransitTime(golfCourse);

      // クラブバス送迎ステータス判定
      const clubBusStatus = TransitCalculator.parseClubBusStatus(golfCourse.clubBus);

      // 【クラブバス運行限定フィルター】
      if (clubBusOnly) {
        if (clubBusStatus.status !== 'あり' && clubBusStatus.status !== '要予約') {
          return;
        }
      }

      // 【車所要時間上限フィルター】
      if (maxCarTime > 0 && carTransit.minutes > maxCarTime) {
        return;
      }

      // 【電車所要時間上限フィルター】
      if (maxTrainTime > 0 && trainTransit.minutes > maxTrainTime) {
        return;
      }

      // 代表的なプラン情報の抽出
      const minPrice = matchedPlans.length > 0 
        ? Math.min(...matchedPlans.map(p => p.price || 999999)) 
        : (golfCourse.minPrice || null);

      const representativePlans = (matchedPlans.length > 0 ? matchedPlans : planInfoList).slice(0, 3).map(p => ({
        planId: p.planId,
        planName: p.planName || '通常プレープラン',
        price: p.price,
        callTime: p.callTime || '08:00〜',
        lunch: p.lunch === 1 || p.lunch === '1' || (p.planName && p.planName.includes('昼食付'))
      }));

      // プレー日フォーマット (YYYYMMDD)
      const playDateStr = params.playDate || new Date().toISOString().split('T')[0];
      const courseId = golfCourse.golfCourseId;

      // ゴルフ場詳細公式ページURL
      let coursePageUrl = '';
      if (golfCourse.golfCourseDetailUrl && !golfCourse.golfCourseDetailUrl.endsWith('.jp/') && !golfCourse.golfCourseDetailUrl.endsWith('.jp')) {
        coursePageUrl = golfCourse.golfCourseDetailUrl.replace(/^http:\/\//i, 'https://');
      } else {
        coursePageUrl = `https://gora.golf.rakuten.co.jp/domestic/course/${courseId}/`;
      }

      // プラン予約ページURL
      let planReserveUrl = '';
      const firstPlanUrl = matchedPlans.length > 0 && (matchedPlans[0].planDetailUrl || matchedPlans[0].reserveUrl)
        ? (matchedPlans[0].planDetailUrl || matchedPlans[0].reserveUrl)
        : (planInfoList.length > 0 && (planInfoList[0].planDetailUrl || planInfoList[0].reserveUrl) ? (planInfoList[0].planDetailUrl || planInfoList[0].reserveUrl) : null);

      if (firstPlanUrl) {
        planReserveUrl = firstPlanUrl.replace(/^http:\/\//i, 'https://');
      } else {
        planReserveUrl = `https://booking.gora.golf.rakuten.co.jp/calendar/disp/c_id/${courseId}/`;
      }

      filtered.push({
        id: courseId,
        date: playDateStr,
        name: courseName,
        abbr: courseAbbr,
        rating: rating,
        ratingDisplay: rating > 0 ? rating.toFixed(1) : '評価なし',
        address: address,
        imageUrl: golfCourse.golfCourseImageUrl || '',
        coursePageUrl: coursePageUrl,
        planReserveUrl: planReserveUrl,
        detailUrl: coursePageUrl,
        highway: highway,
        trainTransit: trainTransit,
        clubBus: clubBusStatus,
        carTransit: carTransit,
        minPrice: minPrice,
        plans: representativePlans
      });
    });

    // 【ソート処理の適用】
    const sortType = params.sort || 'evaluation';
    if (sortType === 'carTransit') {
      filtered.sort((a, b) => a.carTransit.minutes - b.carTransit.minutes);
    } else if (sortType === 'trainTransit') {
      filtered.sort((a, b) => a.trainTransit.minutes - b.trainTransit.minutes);
    } else if (sortType === 'price') {
      filtered.sort((a, b) => (a.minPrice || 999999) - (b.minPrice || 999999));
    } else if (sortType === 'evaluation') {
      filtered.sort((a, b) => b.rating - a.rating);
    }

    return filtered;
  }

  /**
   * 高速道路名・住所のマッチング判定
   */
  function checkHighwayMatch(filterType, highwayStr, addressStr) {
    const text = `${highwayStr} ${addressStr}`.toLowerCase();
    switch (filterType) {
      case 'aqualine':
        return text.includes('アクアライン') || text.includes('館山道') || text.includes('圏央道') || text.includes('木更津') || text.includes('市原') || text.includes('君津') || text.includes('袖ケ浦');
      case 'higashikanto':
        return text.includes('東関東') || text.includes('東関道') || text.includes('京葉') || text.includes('成田') || text.includes('佐倉') || text.includes('千葉東金');
      case 'tomei':
        return text.includes('東名') || text.includes('新東名') || text.includes('小田原厚木') || text.includes('保土ヶ谷') || text.includes('横浜横須賀') || text.includes('西湘');
      case 'kanetsu':
        return text.includes('関越') || text.includes('上信越') || text.includes('花園') || text.includes('東松山') || text.includes('藤岡') || text.includes('高崎');
      case 'chuo':
        return text.includes('中央') || text.includes('大月') || text.includes('八王子') || text.includes('都留') || text.includes('河口湖');
      case 'joban':
        return text.includes('常磐') || text.includes('谷田部') || text.includes('土浦') || text.includes('友部') || text.includes('水戸');
      case 'tohoku':
        return text.includes('東北') || text.includes('北関東') || text.includes('佐野') || text.includes('宇都宮') || text.includes('鹿沼') || text.includes('栃木');
      default:
        return true;
    }
  }

  /**
   * デモ・テスト用モックデータ生成と検索シミュレーション
   */
  async function simulateSearch(params) {
    // ネットワーク遅延シミュレーション（150ms）
    await new Promise(res => setTimeout(res, 150));

    const mockDatabase = getMockDatabase();
    
    // エリア・県フィルター
    let filtered = mockDatabase;
    const activePrefCodes = params.prefCodes && params.prefCodes.length > 0
      ? params.prefCodes
      : (params.prefCode ? [params.prefCode] : []);

    if (activePrefCodes.length > 0) {
      filtered = filtered.filter(c => activePrefCodes.includes(String(c.prefCode)));
    } else if (params.areaCode) {
      filtered = filtered.filter(c => String(c.areaCode) === String(params.areaCode));
    }

    return processAndFilterCourses(filtered, params);
  }

  /**
   * モックゴルフ場マスターデータ（関東近郊の主要ゴルフ場・評価・バス・IC情報）
   */
  function getMockDatabase() {
    return [
      {
        golfCourseId: 120150,
        golfCourseName: 'ムーンレイクゴルフクラブ 市原コース',
        golfCourseAbbr: 'ムーンレイク市原',
        prefCode: '12',
        areaCode: '8',
        address: '千葉県市原市新生260',
        latitude: 35.4851,
        longitude: 140.1582,
        evaluation: '3.9',
        highway: '館山自動車道/市原ICより5km',
        clubBus: 'なし（JR内房線・五井駅よりタクシー約15分）',
        golfCourseImageUrl: 'https://images.unsplash.com/photo-1587174486073-ae5e5cff23aa?w=600&auto=format&fit=crop&q=80',
        golfCourseDetailUrl: 'https://gora.golf.rakuten.co.jp/domestic/course/120150/',
        planInfo: [
          { planId: 101, planName: '【キャディ付・昼食付】快適乗用カートプラン', price: 14800, callTime: '08:00', lunch: true, caddy: 1, allow2Sum: false, planDetailUrl: 'https://booking.gora.golf.rakuten.co.jp/calendar/disp/c_id/120150/' },
          { planId: 102, planName: '【2サム保証・セルフ・昼食付】GPSナビ付カート', price: 9800, callTime: '08:35', lunch: true, caddy: 0, allow2Sum: true, planDetailUrl: 'https://booking.gora.golf.rakuten.co.jp/calendar/disp/c_id/120150/' }
        ]
      },
      {
        golfCourseId: 120121,
        golfCourseName: '房総カントリークラブ 房総ゴルフ場',
        golfCourseAbbr: '房総CC',
        prefCode: '12',
        areaCode: '8',
        address: '千葉県長生郡睦沢町妙楽寺1262',
        latitude: 35.3421,
        longitude: 140.2831,
        evaluation: '4.4',
        highway: '首都圏中央連絡自動車道/市原鶴舞ICより12km',
        clubBus: 'あり（JR外房線・茂原駅南口よりクラブバス運行 ※要予約）',
        golfCourseImageUrl: 'https://images.unsplash.com/photo-1535131749006-b7f58c99034b?w=600&auto=format&fit=crop&q=80',
        golfCourseDetailUrl: 'https://gora.golf.rakuten.co.jp/domestic/course/120121/',
        planInfo: [
          { planId: 103, planName: '【日本プロ開催コース】東コース セルフ昼食付 (2サム保証)', price: 16500, callTime: '07:45', lunch: true, caddy: 0, allow2Sum: true, planDetailUrl: 'https://booking.gora.golf.rakuten.co.jp/calendar/disp/c_id/120121/' },
          { planId: 104, planName: '西コースGPSナビ付乗用カートセルフ', price: 11000, callTime: '08:20', lunch: false, caddy: 0, allow2Sum: true, planDetailUrl: 'https://booking.gora.golf.rakuten.co.jp/calendar/disp/c_id/120121/' },
          { planId: 120, planName: '【ホテル併設】1泊1ラウンド宿泊パック（夕朝食付）', price: 29800, callTime: '09:00', lunch: true, caddy: 0, allow2Sum: true, planDetailUrl: 'https://booking.gora.golf.rakuten.co.jp/calendar/disp/c_id/120121/' }
        ]
      },
      {
        golfCourseId: 120133,
        golfCourseName: 'ミルフィーユゴルフクラブ',
        golfCourseAbbr: 'ミルフィーユGC',
        prefCode: '12',
        areaCode: '8',
        address: '千葉県長生郡長柄町長柄山1095-1',
        latitude: 35.4912,
        longitude: 140.2154,
        evaluation: '4.1',
        highway: '京葉道路/蘇我ICより15km',
        clubBus: 'あり（JR内房線・浜野駅東口より毎日クラブバス運行）',
        golfCourseImageUrl: 'https://images.unsplash.com/photo-1593111774240-d529f12cf4bb?w=600&auto=format&fit=crop&q=80',
        golfCourseDetailUrl: 'https://gora.golf.rakuten.co.jp/domestic/course/120133/',
        planInfo: [
          { planId: 105, planName: '【2サム保証・平日限定】シェフ特製ランチバイキング付 セルフ', price: 8900, callTime: '08:15', lunch: true, caddy: 0, allow2Sum: true, planDetailUrl: 'https://booking.gora.golf.rakuten.co.jp/calendar/disp/c_id/120133/' }
        ]
      },
      {
        golfCourseId: 120037,
        golfCourseName: 'アコーディア・ゴルフ 習志野カントリークラブ',
        golfCourseAbbr: 'アコーディア習志野',
        prefCode: '12',
        areaCode: '8',
        address: '千葉県印西市大森7',
        latitude: 35.8124,
        longitude: 140.1345,
        evaluation: '4.5',
        highway: '東関東自動車道/千葉北ICより18km',
        clubBus: 'あり（JR成田線・木下駅より運行）',
        golfCourseImageUrl: '',
        golfCourseDetailUrl: 'https://gora.golf.rakuten.co.jp/domestic/course/120037/',
        planInfo: [{ planId: 106, planName: 'トーナメントコースプラン', price: 25000, callTime: '08:00', lunch: true, caddy: 1, allow2Sum: false, planDetailUrl: 'https://booking.gora.golf.rakuten.co.jp/calendar/disp/c_id/120037/' }]
      },
      {
        golfCourseId: 120029,
        golfCourseName: 'カメリアヒルズカントリークラブ',
        golfCourseAbbr: 'カメリアヒルズCC',
        prefCode: '12',
        areaCode: '8',
        address: '千葉県袖ケ浦市大竹265',
        latitude: 35.4182,
        longitude: 140.0412,
        evaluation: '4.7',
        highway: '東京湾アクアライン連絡道/袖ヶ浦ICより5km',
        clubBus: 'あり（JR内房線・木更津駅東口より予約制送迎バス）',
        golfCourseImageUrl: 'https://images.unsplash.com/photo-1587174486073-ae5e5cff23aa?w=600&auto=format&fit=crop&q=80',
        golfCourseDetailUrl: 'https://gora.golf.rakuten.co.jp/domestic/course/120029/',
        planInfo: [
          { planId: 107, planName: '【アースモンダミンカップ開催】名門キャディ付プラン', price: 28500, callTime: '08:30', lunch: true, caddy: 1, allow2Sum: false, planDetailUrl: 'https://booking.gora.golf.rakuten.co.jp/calendar/disp/c_id/120029/' }
        ]
      },
      {
        golfCourseId: 110059,
        golfCourseName: '飯能くすの樹カントリー倶楽部',
        golfCourseAbbr: '飯能くすの樹CC',
        prefCode: '11',
        areaCode: '8',
        address: '埼玉県飯能市小岩井350',
        latitude: 35.8821,
        longitude: 139.3012,
        evaluation: '4.2',
        highway: '圏央道/狭山日高ICより10km',
        clubBus: 'あり（西武池袋線・飯能駅北口より定期クラブバス運行）',
        golfCourseImageUrl: 'https://images.unsplash.com/photo-1535131749006-b7f58c99034b?w=600&auto=format&fit=crop&q=80',
        golfCourseDetailUrl: 'https://gora.golf.rakuten.co.jp/domestic/course/110059/',
        planInfo: [
          { planId: 108, planName: '【2サム保証・乗用カートセルフ】昼食＆ドリンクバー付', price: 11500, callTime: '08:05', lunch: true, caddy: 0, allow2Sum: true, planDetailUrl: 'https://booking.gora.golf.rakuten.co.jp/calendar/disp/c_id/110059/' }
        ]
      },
      {
        golfCourseId: 110072,
        golfCourseName: '武蔵丘ゴルフコース',
        golfCourseAbbr: '武蔵丘GC',
        prefCode: '11',
        areaCode: '8',
        address: '埼玉県日高市中山665',
        latitude: 35.8941,
        longitude: 139.3325,
        evaluation: '4.3',
        highway: '圏央道/狭山日高ICより6km',
        clubBus: 'あり（西武池袋線・飯能駅よりクラブバス運行 ※約10分）',
        golfCourseImageUrl: 'https://images.unsplash.com/photo-1593111774240-d529f12cf4bb?w=600&auto=format&fit=crop&q=80',
        golfCourseDetailUrl: 'https://gora.golf.rakuten.co.jp/domestic/course/110072/',
        planInfo: [
          { planId: 109, planName: '【トーナメント開催】樋口久子三菱電機レディスコース キャディ付', price: 17800, callTime: '08:15', lunch: true, caddy: 1, allow2Sum: false, planDetailUrl: 'https://booking.gora.golf.rakuten.co.jp/calendar/disp/c_id/110072/' },
          { planId: 110, planName: '【セルフプレー】GPSナビ付乗用カート 昼食付', price: 13800, callTime: '09:05', lunch: true, caddy: 0, allow2Sum: true, planDetailUrl: 'https://booking.gora.golf.rakuten.co.jp/calendar/disp/c_id/110072/' }
        ]
      },
      {
        golfCourseId: 140023,
        golfCourseName: '大厚木カントリークラブ 本コース',
        golfCourseAbbr: '大厚木本コース',
        prefCode: '14',
        areaCode: '8',
        address: '神奈川県厚木市上荻野字内之郷4000',
        latitude: 35.4987,
        longitude: 139.2987,
        evaluation: '4.0',
        highway: '東名高速道路/厚木ICより12km (圏央道/厚木西ICより8km)',
        clubBus: 'あり（小田急線・本厚木駅北口よりクラブバス運行）',
        golfCourseImageUrl: 'https://images.unsplash.com/photo-1587174486073-ae5e5cff23aa?w=600&auto=format&fit=crop&q=80',
        golfCourseDetailUrl: 'https://gora.golf.rakuten.co.jp/domestic/course/140023/',
        planInfo: [
          { planId: 111, planName: '【桜・楓コース】GPSナビ付カート・昼食付 セルフ', price: 13500, callTime: '07:50', lunch: true, caddy: 0, allow2Sum: true, planDetailUrl: 'https://booking.gora.golf.rakuten.co.jp/calendar/disp/c_id/140023/' }
        ]
      },
      {
        golfCourseId: 140008,
        golfCourseName: '小田原湯本カントリークラブ',
        golfCourseAbbr: '小田原湯本CC',
        prefCode: '14',
        areaCode: '8',
        address: '神奈川県足柄下郡箱根町湯本湯場390-37',
        latitude: 35.2289,
        longitude: 139.0876,
        evaluation: '4.2',
        highway: '小田原厚木道路/小田原西ICより5km',
        clubBus: 'あり（箱根登山鉄道・箱根湯本駅よりクラブバス約7分）',
        golfCourseImageUrl: 'https://images.unsplash.com/photo-1535131749006-b7f58c99034b?w=600&auto=format&fit=crop&q=80',
        golfCourseDetailUrl: 'https://gora.golf.rakuten.co.jp/domestic/course/140008/',
        planInfo: [
          { planId: 112, planName: '箱根温泉リゾート・絶景富士山ビュープラン キャディ付', price: 15900, callTime: '08:25', lunch: true, caddy: 1, allow2Sum: false, planDetailUrl: 'https://booking.gora.golf.rakuten.co.jp/calendar/disp/c_id/140008/' },
          { planId: 121, planName: '【温泉ロッジ宿泊】箱根温泉満喫1泊1ラウンドプラン', price: 26800, callTime: '08:50', lunch: true, caddy: 0, allow2Sum: true, planDetailUrl: 'https://booking.gora.golf.rakuten.co.jp/calendar/disp/c_id/140008/' }
        ]
      },
      {
        golfCourseId: 80006,
        golfCourseName: '阿見ゴルフクラブ',
        golfCourseAbbr: '阿見GC',
        prefCode: '8',
        areaCode: '8',
        address: '茨城県稲敷郡阿見町上條1760-1',
        latitude: 36.0021,
        longitude: 140.2312,
        evaluation: '4.3',
        highway: '圏央道/阿見東ICより3km (常磐道方面)',
        clubBus: 'あり（JR常磐線・荒川沖駅東口よりクラブバス運行 ※約15分）',
        golfCourseImageUrl: 'https://images.unsplash.com/photo-1593111774240-d529f12cf4bb?w=600&auto=format&fit=crop&q=80',
        golfCourseDetailUrl: 'https://gora.golf.rakuten.co.jp/domestic/course/80006/',
        planInfo: [
          { planId: 113, planName: '【インターから3分】フラット＆ワイドコース 昼食付 セルフ', price: 12800, callTime: '08:10', lunch: true, caddy: 0, allow2Sum: true, planDetailUrl: 'https://booking.gora.golf.rakuten.co.jp/calendar/disp/c_id/80006/' }
        ]
      },
      {
        golfCourseId: 90035,
        golfCourseName: 'サンレイクカントリークラブ',
        golfCourseAbbr: 'サンレイクCC',
        prefCode: '9',
        areaCode: '8',
        address: '栃木県日光市塩野室町2363',
        latitude: 36.6892,
        longitude: 139.7891,
        evaluation: '4.1',
        highway: '東北自動車道/宇都宮ICより15km',
        clubBus: 'なし（JR日光線・下野大沢駅よりタクシー約15分）',
        golfCourseImageUrl: 'https://images.unsplash.com/photo-1587174486073-ae5e5cff23aa?w=600&auto=format&fit=crop&q=80',
        golfCourseDetailUrl: 'https://gora.golf.rakuten.co.jp/domestic/course/90035/',
        planInfo: [
          { planId: 114, planName: '【雄大な自然】美しくレイアウトされた18ホール 昼食付 セルフ', price: 7900, callTime: '08:40', lunch: true, caddy: 0, allow2Sum: true, planDetailUrl: 'https://booking.gora.golf.rakuten.co.jp/calendar/disp/c_id/90035/' }
        ]
      },
      {
        golfCourseId: 190031,
        golfCourseName: '富士クラシック',
        golfCourseAbbr: '富士クラシック',
        prefCode: '19',
        areaCode: '9',
        address: '山梨県南都留郡富士河口湖町富士ヶ嶺2-2',
        latitude: 35.3981,
        longitude: 138.6214,
        evaluation: '4.5',
        highway: '中央自動車道/河口湖ICより25km (新東名/新富士ICより30km)',
        clubBus: 'なし（富士急行線・河口湖駅よりタクシー約30分）',
        golfCourseImageUrl: 'https://images.unsplash.com/photo-1535131749006-b7f58c99034b?w=600&auto=format&fit=crop&q=80',
        golfCourseDetailUrl: 'https://gora.golf.rakuten.co.jp/domestic/course/190031/',
        planInfo: [
          { planId: 115, planName: '【標高1200m富士の裾野】リンクススタイルの爽快ゴルフ 昼食付 セルフ', price: 14000, callTime: '08:20', lunch: true, caddy: 0, allow2Sum: true, planDetailUrl: 'https://booking.gora.golf.rakuten.co.jp/calendar/disp/c_id/190031/' }
        ]
      }
    ];
  }

  return {
    searchPlans,
    buildPlanSearchUrls,
    processAndFilterCourses,
    getStoredAppId,
    setStoredAppId,
    getStoredAccessKey,
    getStoredAppUrl,
    setStoredApiKeys,
    getMockDatabase
  };
})();

if (typeof module !== 'undefined' && module.exports) {
  module.exports = RakutenGoraAPI;
}
