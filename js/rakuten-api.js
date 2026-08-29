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
      // 複数県が選択されている場合、各県ごとに並行リクエストを実行して統合
      const prefCodes = params.prefCodes && params.prefCodes.length > 0 
        ? params.prefCodes 
        : (params.prefCode ? [params.prefCode] : ['']);

      const fetchPromises = prefCodes.map(pref => fetchSingleQuery(appId, accessKey, { ...params, prefCode: pref }));
      const resultsArray = await Promise.all(fetchPromises);

      // 全結果のフラット化と重複排除（courseIdベース）
      const courseMap = new Map();
      resultsArray.flat().forEach(item => {
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

    const prefCodes = params.prefCodes && params.prefCodes.length > 0 
      ? params.prefCodes 
      : (params.prefCode ? [params.prefCode] : ['']);

    return prefCodes.map(pref => {
      const queryParams = new URLSearchParams({
        applicationId: appId,
        accessKey: accessKey,
        format: 'json',
        playDate: params.playDate || '',
        hits: '30',
        page: params.page || '1',
        sort: 'evaluation'
      });

      if (pref) {
        queryParams.append('prefCode', pref);
      } else if (params.areaCode) {
        queryParams.append('areaCode', params.areaCode);
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

      return {
        prefCode: pref,
        directUrl,
        proxyUrl,
        queryString,
        hasAppId: !!rawAppId,
        hasAccessKey: !!rawAccessKey,
        paramsObject: Object.fromEntries(queryParams.entries())
      };
    });
  }

  /**
   * 単一クエリのAPIリクエスト実行
   */
  async function fetchSingleQuery(appId, accessKey, params) {
    const queryParams = new URLSearchParams({
      applicationId: appId,
      accessKey: accessKey,
      format: 'json',
      playDate: params.playDate, // YYYY-MM-DD
      hits: '30',
      page: params.page || '1',
      sort: 'evaluation'
    });

    if (params.prefCode) {
      queryParams.append('prefCode', params.prefCode);
    } else if (params.areaCode) {
      queryParams.append('areaCode', params.areaCode);
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

    const appUrl = params.appUrl || getStoredAppUrl() || '';
    if (appUrl) {
      queryParams.append('customReferer', appUrl);
    }

    console.log(`🌐 [楽天OpenAPIリクエスト] パラメータ: ${queryParams.toString()}`);

    let data;
    try {
      const proxyUrl = `/api/plan-search?${queryParams.toString()}`;
      const proxyResp = await fetch(proxyUrl);
      if (proxyResp.ok) {
        data = await proxyResp.json();
      } else {
        throw new Error('Proxy failed');
      }
    } catch (proxyErr) {
      const directUrl = `${PLAN_SEARCH_ENDPOINT}?${queryParams.toString()}`;
      const resp = await fetch(directUrl);
      if (!resp.ok) {
        const errData = await resp.json().catch(() => ({}));
        throw new Error(errData.error_description || `APIエラー: ステータス ${resp.status}`);
      }
      data = await resp.json();
    }

    if (!data || !data.Items || !Array.isArray(data.Items)) {
      return [];
    }

    return data.Items.map(item => item.Item);
  }

  /**
   * ゴルフ場データのフィルタリングおよび交通時間の付与
   * 条件:
   * 1. Goraレート >= 3.5
   * 2. ゴルフ場名に「アコーディア」が含まれていないこと
   * 3. 選択された時間帯プランの優先・抽出
   */
  function processAndFilterCourses(items, params) {
    const minRating = params.minRating !== undefined ? parseFloat(params.minRating) : 3.5;
    const excludeKeyword = (params.excludeKeyword || 'アコーディア').trim();
    const selectedTimes = params.startTimes || [];

    const filtered = [];

    items.forEach(item => {
      const golfCourse = item.golfCourse || item;
      const planInfoList = item.planInfo || [];

      const courseName = golfCourse.golfCourseName || '';
      const courseAbbr = golfCourse.golfCourseAbbr || '';
      const rating = parseFloat(golfCourse.evaluation || 0);

      // 【出力条件1】レート 3.5 以上
      if (rating < minRating) {
        return;
      }

      // 【出力条件2】名称に「アコーディア」が含まれている場合は除外
      if (excludeKeyword && (courseName.includes(excludeKeyword) || courseAbbr.includes(excludeKeyword))) {
        return;
      }

      // 【出力条件3】選択された都道府県コードの一致（APIやデータの都道府県コード安全検証）
      const activePrefCodes = params.prefCodes && params.prefCodes.length > 0
        ? params.prefCodes
        : (params.prefCode ? [params.prefCode] : []);
      if (activePrefCodes.length > 0 && golfCourse.prefCode) {
        if (!activePrefCodes.includes(String(golfCourse.prefCode))) {
          return;
        }
      }

      // 時間帯フィルター（選択された時間帯がある場合）
      let matchedPlans = planInfoList;
      if (selectedTimes.length > 0 && planInfoList.length > 0) {
        const timeFiltered = planInfoList.filter(p => {
          if (!p.callTime) return true;
          const hour = p.callTime.split(':')[0];
          return selectedTimes.includes(hour);
        });
        if (timeFiltered.length > 0) {
          matchedPlans = timeFiltered;
        }
      }

      // 笹塚からの電車所要時間の計算
      const trainTransit = TransitCalculator.calculateTrainTransitTime(golfCourse);

      // 神田からの車所要時間の計算
      const carTransit = TransitCalculator.calculateCarTransitTime(golfCourse);

      // クラブバス送迎ステータス判定
      const clubBusStatus = TransitCalculator.parseClubBusStatus(golfCourse.clubBus);

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
      const playDateCompact = playDateStr.replace(/-/g, '');
      const courseId = golfCourse.golfCourseId;

      // ゴルフ場詳細公式ページURL（正規URLの生成）
      let coursePageUrl = '';
      if (golfCourse.golfCourseDetailUrl && !golfCourse.golfCourseDetailUrl.endsWith('.jp/') && !golfCourse.golfCourseDetailUrl.endsWith('.jp')) {
        coursePageUrl = golfCourse.golfCourseDetailUrl.replace(/^http:\/\//i, 'https://');
      } else {
        coursePageUrl = `https://gora.golf.rakuten.co.jp/domestic/course/${courseId}/`;
      }

      // プラン予約ページURL（指定日予約・空き枠カレンダーURLの生成）
      let planReserveUrl = '';
      const firstPlanUrl = planInfoList.length > 0 && (planInfoList[0].planDetailUrl || planInfoList[0].reserveUrl)
        ? (planInfoList[0].planDetailUrl || planInfoList[0].reserveUrl)
        : null;

      if (firstPlanUrl) {
        planReserveUrl = firstPlanUrl.replace(/^http:\/\//i, 'https://');
      } else {
        // 楽天GORA公式の空き枠カレンダー・プラン選択ページ（404にならない正規URL）
        planReserveUrl = `https://booking.gora.golf.rakuten.co.jp/calendar/disp/c_id/${courseId}/`;
      }

      filtered.push({
        id: courseId,
        date: playDateStr,
        name: courseName,
        abbr: courseAbbr,
        rating: rating,
        ratingDisplay: rating > 0 ? rating.toFixed(1) : '評価なし',
        address: golfCourse.address || '',
        imageUrl: golfCourse.golfCourseImageUrl || '',
        // リンクURL
        coursePageUrl: coursePageUrl,      // ゴルフ場詳細ページ
        planReserveUrl: planReserveUrl,    // プラン予約ページ
        detailUrl: coursePageUrl,
        highway: golfCourse.highway || '',
        // 指定フォーマット必須項目
        trainTransit: trainTransit, // 笹塚からの電車の所要時間
        clubBus: clubBusStatus,     // クラブバス送迎有無
        carTransit: carTransit,     // 神田からの車での所要時間
        // 補足情報
        minPrice: minPrice,
        plans: representativePlans
      });
    });

    return filtered;
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
          { planId: 101, planName: '【キャディ付・昼食付】快適乗用カートプラン', price: 14800, callTime: '08:00', lunch: true, planDetailUrl: 'https://booking.gora.golf.rakuten.co.jp/calendar/disp/c_id/120150/' },
          { planId: 102, planName: '【セルフ・昼食付】GPSナビ付カート', price: 9800, callTime: '08:35', lunch: true, planDetailUrl: 'https://booking.gora.golf.rakuten.co.jp/calendar/disp/c_id/120150/' }
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
          { planId: 103, planName: '【日本プロ開催コース】東コース セルフ昼食付', price: 16500, callTime: '07:45', lunch: true, planDetailUrl: 'https://booking.gora.golf.rakuten.co.jp/calendar/disp/c_id/120121/' },
          { planId: 104, planName: '西コースGPSナビ付乗用カートセルフ', price: 11000, callTime: '08:20', lunch: false, planDetailUrl: 'https://booking.gora.golf.rakuten.co.jp/calendar/disp/c_id/120121/' }
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
          { planId: 105, planName: '【平日限定】シェフ特製ランチバイキング付', price: 8900, callTime: '08:15', lunch: true, planDetailUrl: 'https://booking.gora.golf.rakuten.co.jp/calendar/disp/c_id/120133/' }
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
        planInfo: [{ planId: 106, planName: 'トーナメントコースプラン', price: 25000, callTime: '08:00', lunch: true, planDetailUrl: 'https://booking.gora.golf.rakuten.co.jp/calendar/disp/c_id/120037/' }]
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
          { planId: 107, planName: '【アースモンダミンカップ開催】名門キャディ付プラン', price: 28500, callTime: '08:30', lunch: true, planDetailUrl: 'https://booking.gora.golf.rakuten.co.jp/calendar/disp/c_id/120029/' }
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
          { planId: 108, planName: '【乗用カートセルフ】昼食＆ドリンクバー付', price: 11500, callTime: '08:05', lunch: true, planDetailUrl: 'https://booking.gora.golf.rakuten.co.jp/calendar/disp/c_id/110059/' }
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
          { planId: 109, planName: '【トーナメント開催】樋口久子三菱電機レディスコース', price: 17800, callTime: '08:15', lunch: true, planDetailUrl: 'https://booking.gora.golf.rakuten.co.jp/calendar/disp/c_id/110072/' }
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
          { planId: 111, planName: '【桜・楓コース】GPSナビ付カート・昼食付', price: 13500, callTime: '07:50', lunch: true, planDetailUrl: 'https://booking.gora.golf.rakuten.co.jp/calendar/disp/c_id/140023/' }
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
          { planId: 112, planName: '箱根温泉リゾート・絶景富士山ビュープラン', price: 15900, callTime: '08:25', lunch: true, planDetailUrl: 'https://booking.gora.golf.rakuten.co.jp/calendar/disp/c_id/140008/' }
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
        highway: '圏央道/阿見東ICより3km',
        clubBus: 'あり（JR常磐線・荒川沖駅東口よりクラブバス運行 ※約15分）',
        golfCourseImageUrl: 'https://images.unsplash.com/photo-1593111774240-d529f12cf4bb?w=600&auto=format&fit=crop&q=80',
        golfCourseDetailUrl: 'https://gora.golf.rakuten.co.jp/domestic/course/80006/',
        planInfo: [
          { planId: 113, planName: '【インターから3分】フラット＆ワイドコース 昼食付', price: 12800, callTime: '08:10', lunch: true, planDetailUrl: 'https://booking.gora.golf.rakuten.co.jp/calendar/disp/c_id/80006/' }
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
          { planId: 114, planName: '【雄大な自然】美しくレイアウトされた18ホール 昼食付', price: 7900, callTime: '08:40', lunch: true, planDetailUrl: 'https://booking.gora.golf.rakuten.co.jp/calendar/disp/c_id/90035/' }
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
          { planId: 115, planName: '【標高1200m富士の裾野】リンクススタイルの爽快ゴルフ 昼食付', price: 14000, callTime: '08:20', lunch: true, planDetailUrl: 'https://booking.gora.golf.rakuten.co.jp/calendar/disp/c_id/190031/' }
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
