/**
 * RakutenGoraAPI Client
 * 楽天GORAプラン検索APIおよびコース詳細APIの連携、フィルタリングモジュール
 */

const RakutenGoraAPI = (() => {
  const STORAGE_KEY_APP_ID = 'golfcourse_finder_app_id';
  const PLAN_SEARCH_ENDPOINT = 'https://app.rakuten.co.jp/services/api/Gora/GoraPlanSearch/20170623';
  const DETAIL_ENDPOINT = 'https://app.rakuten.co.jp/services/api/Gora/GoraGolfCourseDetail/20170623';

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
   * ApplicationIdを保存
   */
  function setStoredAppId(appId) {
    try {
      if (appId) {
        localStorage.setItem(STORAGE_KEY_APP_ID, appId.trim());
      } else {
        localStorage.removeItem(STORAGE_KEY_APP_ID);
      }
    } catch (e) {
      console.error('LocalStorage error:', e);
    }
  }

  /**
   * 楽天GORAプラン検索の実行
   * @param {Object} params 検索条件
   * @returns {Promise<Array>} フィルタリング・整形された検索結果リスト
   */
  async function searchPlans(params) {
    const appId = params.appId || getStoredAppId();
    const isDemoMode = params.isDemo || !appId;

    if (isDemoMode) {
      // デモ・モックデータで検索シミュレーション
      return simulateSearch(params);
    }

    try {
      // 1. ローカルプロキシまたは直接API呼び出し
      const queryParams = new URLSearchParams({
        applicationId: appId,
        format: 'json',
        playDate: params.playDate, // YYYY-MM-DD
        hits: '30',
        page: params.page || '1',
        sort: 'evaluation'
      });

      if (params.areaCode) queryParams.append('areaCode', params.areaCode);
      if (params.prefCode) queryParams.append('prefCode', params.prefCode);
      if (params.startTime) queryParams.append('startTime', params.startTime);
      if (params.endTime) queryParams.append('endTime', params.endTime);
      if (params.minPrice) queryParams.append('minPrice', params.minPrice);
      if (params.maxPrice) queryParams.append('maxPrice', params.maxPrice);

      let data;
      // プロキシエンドポイントの試行
      try {
        const proxyUrl = `/api/plan-search?${queryParams.toString()}`;
        const proxyResp = await fetch(proxyUrl);
        if (proxyResp.ok) {
          data = await proxyResp.json();
        } else {
          throw new Error('Proxy failed');
        }
      } catch (proxyErr) {
        // 直接楽天API（JSONPまたはFetch）
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

      // 2. データのマッピングとフィルタリング
      const rawCourses = data.Items.map(item => item.Item);
      return processAndFilterCourses(rawCourses, params);
    } catch (err) {
      console.warn('API呼び出し失敗。デモデータにフォールバックします:', err);
      // API呼び出しでエラーが起きた場合は通知とともにデモデータを返す
      const fallbackResults = await simulateSearch(params);
      fallbackResults._apiError = err.message;
      return fallbackResults;
    }
  }

  /**
   * ゴルフ場データのフィルタリングおよび交通時間の付与
   * 条件:
   * 1. Goraレート >= 3.5
   * 2. ゴルフ場名に「アコーディア」が含まれていないこと
   */
  function processAndFilterCourses(items, params) {
    const minRating = params.minRating !== undefined ? parseFloat(params.minRating) : 3.5;
    const excludeKeyword = (params.excludeKeyword || 'アコーディア').trim();

    const filtered = [];

    items.forEach(item => {
      // 楽天GORAプラン検索のデータ構造に対応
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

      // 笹塚からの電車所要時間の計算
      const trainTransit = TransitCalculator.calculateTrainTransitTime(golfCourse);

      // 神田からの車所要時間の計算
      const carTransit = TransitCalculator.calculateCarTransitTime(golfCourse);

      // クラブバス送迎ステータス判定
      const clubBusStatus = TransitCalculator.parseClubBusStatus(golfCourse.clubBus);

      // 代表的なプラン情報の抽出
      const minPrice = planInfoList.length > 0 
        ? Math.min(...planInfoList.map(p => p.price || 999999)) 
        : (golfCourse.minPrice || null);

      const representativePlans = planInfoList.slice(0, 3).map(p => ({
        planId: p.planId,
        planName: p.planName || '通常プレープラン',
        price: p.price,
        callTime: p.callTime || '08:00〜',
        lunch: p.lunch === 1 || p.lunch === '1' || (p.planName && p.planName.includes('昼食付'))
      }));

      filtered.push({
        id: golfCourse.golfCourseId,
        date: params.playDate || new Date().toISOString().split('T')[0],
        name: courseName,
        abbr: courseAbbr,
        rating: rating,
        ratingDisplay: rating > 0 ? rating.toFixed(1) : '評価なし',
        address: golfCourse.address || '',
        imageUrl: golfCourse.golfCourseImageUrl || '',
        detailUrl: golfCourse.golfCourseDetailUrl || `https://gora.golf.rakuten.co.jp/`,
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
    if (params.prefCode) {
      filtered = filtered.filter(c => c.prefCode === params.prefCode);
    } else if (params.areaCode) {
      filtered = filtered.filter(c => c.areaCode === params.areaCode);
    }

    return processAndFilterCourses(filtered, params);
  }

  /**
   * モックゴルフ場マスターデータ（関東近郊の主要ゴルフ場・評価・バス・IC情報）
   */
  function getMockDatabase() {
    return [
      {
        golfCourseId: 120001,
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
        golfCourseDetailUrl: 'https://gora.golf.rakuten.co.jp/',
        planInfo: [
          { planId: 101, planName: '【キャディ付・昼食付】快適乗用カートプラン', price: 14800, callTime: '08:00', lunch: true },
          { planId: 102, planName: '【セルフ・昼食付】GPSナビ付カート', price: 9800, callTime: '08:35', lunch: true }
        ]
      },
      {
        golfCourseId: 120002,
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
        golfCourseDetailUrl: 'https://gora.golf.rakuten.co.jp/',
        planInfo: [
          { planId: 103, planName: '【日本プロ開催コース】東コース セルフ昼食付', price: 16500, callTime: '07:45', lunch: true },
          { planId: 104, planName: '西コースGPSナビ付乗用カートセルフ', price: 11000, callTime: '08:20', lunch: false }
        ]
      },
      {
        golfCourseId: 120003,
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
        golfCourseDetailUrl: 'https://gora.golf.rakuten.co.jp/',
        planInfo: [
          { planId: 105, planName: '【平日限定】シェフ特製ランチバイキング付', price: 8900, callTime: '08:15', lunch: true }
        ]
      },
      {
        golfCourseId: 120004,
        golfCourseName: 'アコーディア・ゴルフ 習志野カントリークラブ', // 除外対象テスト用
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
        planInfo: [{ planId: 106, planName: 'トーナメントコースプラン', price: 25000, callTime: '08:00', lunch: true }]
      },
      {
        golfCourseId: 120005,
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
        golfCourseDetailUrl: 'https://gora.golf.rakuten.co.jp/',
        planInfo: [
          { planId: 107, planName: '【アースモンダミンカップ開催】名門キャディ付プラン', price: 28500, callTime: '08:30', lunch: true }
        ]
      },
      {
        golfCourseId: 110001,
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
        golfCourseDetailUrl: 'https://gora.golf.rakuten.co.jp/',
        planInfo: [
          { planId: 108, planName: '【乗用カートセルフ】昼食＆ドリンクバー付', price: 11500, callTime: '08:05', lunch: true }
        ]
      },
      {
        golfCourseId: 110002,
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
        golfCourseDetailUrl: 'https://gora.golf.rakuten.co.jp/',
        planInfo: [
          { planId: 109, planName: '【トーナメント開催】樋口久子三菱電機レディスコース', price: 17800, callTime: '08:15', lunch: true }
        ]
      },
      {
        golfCourseId: 110003,
        golfCourseName: '低レートサンプルゴルフクラブ', // レート3.5未満除外テスト用
        golfCourseAbbr: '低レートサンプル',
        prefCode: '11',
        areaCode: '8',
        address: '埼玉県秩父郡...',
        latitude: 36.0123,
        longitude: 139.1234,
        evaluation: '3.2',
        highway: '関越自動車道/花園ICより20km',
        clubBus: 'なし',
        golfCourseImageUrl: '',
        planInfo: [{ planId: 110, planName: '格安セルフプラン', price: 4500, callTime: '07:30', lunch: false }]
      },
      {
        golfCourseId: 140001,
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
        golfCourseDetailUrl: 'https://gora.golf.rakuten.co.jp/',
        planInfo: [
          { planId: 111, planName: '【桜・楓コース】GPSナビ付カート・昼食付', price: 13500, callTime: '07:50', lunch: true }
        ]
      },
      {
        golfCourseId: 140002,
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
        golfCourseDetailUrl: 'https://gora.golf.rakuten.co.jp/',
        planInfo: [
          { planId: 112, planName: '箱根温泉リゾート・絶景富士山ビュープラン', price: 15900, callTime: '08:25', lunch: true }
        ]
      },
      {
        golfCourseId: 80001,
        golfCourseName: '阿見カントリークラブ',
        golfCourseAbbr: '阿見CC',
        prefCode: '8',
        areaCode: '8',
        address: '茨城県稲敷郡阿見町上條1760-1',
        latitude: 36.0021,
        longitude: 140.2312,
        evaluation: '4.3',
        highway: '圏央道/阿見東ICより3km',
        clubBus: 'あり（JR常磐線・荒川沖駅東口よりクラブバス運行 ※約15分）',
        golfCourseImageUrl: 'https://images.unsplash.com/photo-1593111774240-d529f12cf4bb?w=600&auto=format&fit=crop&q=80',
        golfCourseDetailUrl: 'https://gora.golf.rakuten.co.jp/',
        planInfo: [
          { planId: 113, planName: '【インターから3分】フラット＆ワイドコース 昼食付', price: 12800, callTime: '08:10', lunch: true }
        ]
      },
      {
        golfCourseId: 90001,
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
        golfCourseDetailUrl: 'https://gora.golf.rakuten.co.jp/',
        planInfo: [
          { planId: 114, planName: '【雄大な自然】美しくレイアウトされた18ホール 昼食付', price: 7900, callTime: '08:40', lunch: true }
        ]
      },
      {
        golfCourseId: 190001,
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
        golfCourseDetailUrl: 'https://gora.golf.rakuten.co.jp/',
        planInfo: [
          { planId: 115, planName: '【標高1200m富士の裾野】リンクススタイルの爽快ゴルフ 昼食付', price: 14000, callTime: '08:20', lunch: true }
        ]
      }
    ];
  }

  return {
    searchPlans,
    processAndFilterCourses,
    getStoredAppId,
    setStoredAppId,
    getMockDatabase
  };
})();

if (typeof module !== 'undefined' && module.exports) {
  module.exports = RakutenGoraAPI;
}
