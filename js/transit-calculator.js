/**
 * TransitCalculator
 * 笹塚駅（電車）および神田（車）からの所要時間算出、およびクラブバス情報の判定エンジン
 */

const TransitCalculator = (() => {
  // 基準地点の座標
  const ORIGIN_SASAZUKA = { lat: 35.6738, lng: 139.6672, name: '笹塚駅' };
  const ORIGIN_KANDA = { lat: 35.6917, lng: 139.7709, name: '神田' };

  /**
   * 2点間の直線距離（km）をハヴァサインの公式で計算
   */
  function calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371; // 地球の半径 (km)
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  /**
   * ゴルフ場の住所・高速道路情報・座標から、神田からの車での所要時間を推定
   * @param {Object} courseInfo ゴルフ場情報
   * @returns {Object} { minutes: number, text: string, detail: string }
   */
  function calculateCarTransitTime(courseInfo) {
    const lat = parseFloat(courseInfo.latitude);
    const lng = parseFloat(courseInfo.longitude);
    const address = courseInfo.address || '';
    const highway = courseInfo.highway || '';

    // 座標が存在する場合
    if (!isNaN(lat) && !isNaN(lng) && lat > 0 && lng > 0) {
      const dist = calculateDistance(ORIGIN_KANDA.lat, ORIGIN_KANDA.lng, lat, lng);

      // 高速道路利用を前提とした実走行距離係数（直線距離×1.25〜1.35）
      const drivingDist = dist * 1.3;

      // 首都高脱出時間（神田橋/宝町/呉服橋〜各高速入口）：約15〜20分
      // 高速道路走行速度：平均75km/h
      // 最寄ICからゴルフ場までの一般道：平均25km/h（約5〜15km）
      
      let estimatedMinutes = 0;

      // エリア別の高速道路補正
      if (address.includes('千葉県')) {
        if (address.includes('木更津') || address.includes('君津') || address.includes('市原') || address.includes('袖ケ浦') || address.includes('富津')) {
          // アクアライン・館山道経由
          estimatedMinutes = Math.round(18 + (drivingDist * 0.7) + 12);
        } else if (address.includes('成田') || address.includes('佐原') || address.includes('香取') || address.includes('八街') || address.includes('富里')) {
          // 東関道経由
          estimatedMinutes = Math.round(15 + (drivingDist * 0.65) + 10);
        } else {
          estimatedMinutes = Math.round(15 + (drivingDist * 0.7) + 12);
        }
      } else if (address.includes('神奈川県')) {
        // 首都高3号/東名・保土ヶ谷バイパス/横浜横須賀道路/小田厚
        estimatedMinutes = Math.round(20 + (drivingDist * 0.72) + 15);
      } else if (address.includes('埼玉県')) {
        // 関越道/東北道/常磐道
        estimatedMinutes = Math.round(18 + (drivingDist * 0.68) + 10);
      } else if (address.includes('茨城県')) {
        // 常磐道/東関道
        estimatedMinutes = Math.round(15 + (drivingDist * 0.65) + 12);
      } else if (address.includes('栃木県')) {
        // 東北道/北関東道
        estimatedMinutes = Math.round(18 + (drivingDist * 0.62) + 12);
      } else if (address.includes('群馬県')) {
        // 関越道/上信越道
        estimatedMinutes = Math.round(20 + (drivingDist * 0.62) + 15);
      } else if (address.includes('山梨県')) {
        // 中央道
        estimatedMinutes = Math.round(22 + (drivingDist * 0.68) + 15);
      } else if (address.includes('静岡県')) {
        // 東名/新東名
        estimatedMinutes = Math.round(20 + (drivingDist * 0.65) + 15);
      } else {
        estimatedMinutes = Math.round(20 + (drivingDist * 0.7) + 15);
      }

      // 最低所要時間の保証
      estimatedMinutes = Math.max(35, estimatedMinutes);

      const hours = Math.floor(estimatedMinutes / 60);
      const mins = estimatedMinutes % 60;
      const formattedText = hours > 0 ? `約${hours}時間${mins > 0 ? mins + '分' : ''}` : `約${mins}分`;

      return {
        minutes: estimatedMinutes,
        text: formattedText,
        detail: `神田〜${highway ? highway.split('/')[0] : '高速'}経由 (約${Math.round(drivingDist)}km)`
      };
    }

    // 座標がない場合のフォールバック（県別概算）
    return estimateByPrefecture(address, 'car');
  }

  // クラブバスマスタデータのキャッシュ
  let clubBusMasterData = {};
  let masterDataLoaded = false;

  /**
   * クラブバスマスタデータの非同期読み込み
   */
  async function loadMasterData() {
    if (masterDataLoaded && Object.keys(clubBusMasterData).length > 0) {
      return clubBusMasterData;
    }

    try {
      const response = await fetch('./data/club_bus_master.json');
      if (response.ok) {
        clubBusMasterData = await response.json();
        masterDataLoaded = true;
        console.log(`[TransitCalculator] クラブバスマスタデータを正常にロードしました (${Object.keys(clubBusMasterData).length}件)`);
      } else {
        console.warn(`[TransitCalculator] マスタデータのロードに失敗しました (HTTP ${response.status})。フォールバック処理を継続します。`);
      }
    } catch (e) {
      console.warn('[TransitCalculator] マスタデータ取得エラー (フォールバック処理を継続します):', e);
    }
    return clubBusMasterData;
  }

  /**
   * ゴルフ場情報からマスタデータを参照してクラブバス情報を取得
   * @param {Object|number|string} courseInfo ゴルフ場情報オブジェクトまたはゴルフ場ID
   * @returns {Object} クラブバス解析結果
   */
  function getClubBusInfo(courseInfo) {
    if (!courseInfo) {
      return parseClubBusStatus(null);
    }

    let targetCourseId = '';
    let courseName = '';

    if (typeof courseInfo === 'object') {
      targetCourseId = String(courseInfo.golfCourseId || courseInfo.id || '');
      courseName = courseInfo.golfCourseName || courseInfo.name || courseInfo.golfCourseAbbr || '';
    } else {
      targetCourseId = String(courseInfo);
    }

    // 1. golfCourseId による完全一致検索
    if (targetCourseId && clubBusMasterData[targetCourseId]) {
      const master = clubBusMasterData[targetCourseId];
      return formatMasterBusInfo(master);
    }

    // 2. コース名による名寄せ検索
    if (courseName && Object.keys(clubBusMasterData).length > 0) {
      const cleanName = courseName.replace(/[\s　・]/g, '');
      for (const id in clubBusMasterData) {
        const item = clubBusMasterData[id];
        const masterName = (item.golfCourseName || '').replace(/[\s　・]/g, '');
        if (masterName && (cleanName.includes(masterName) || masterName.includes(cleanName))) {
          return formatMasterBusInfo(item);
        }
      }
    }

    // 3. マスタ未登録の場合は既存テキスト/住所からのフォールバック判定
    const rawClubBus = typeof courseInfo === 'object' ? (courseInfo.clubBus || courseInfo.golfCourseCaption || '') : '';
    return parseClubBusStatus(rawClubBus);
  }

  /**
   * マスタデータオブジェクトを表示用フォーマットに変換
   */
  function formatMasterBusInfo(master) {
    if (!master.hasClubBus) {
      const taxiInfo = master.departureStation 
        ? `${master.departureStation}よりタクシー約${master.taxiTransitMinutes || 15}分`
        : 'タクシー等をご利用ください';
      return {
        hasClubBus: false,
        status: 'なし',
        text: 'なし',
        detail: master.notes || `クラブバス運行なし（${taxiInfo}）`,
        badgeClass: 'badge-none',
        masterData: master
      };
    }

    const isReserve = master.reservationType && master.reservationType.includes('予約');
    const status = isReserve ? '要予約' : 'あり';
    const badgeClass = isReserve ? 'badge-reserve' : 'badge-available';
    
    let text = 'あり';
    if (master.departureStation) {
      text = isReserve ? `あり（${master.departureStation}発・要予約）` : `あり（${master.departureStation}発）`;
    }

    let detail = `${master.operationType || '運行'} | ${master.reservationType || '定期運行'}`;
    if (master.departureStation) {
      detail += ` | ${master.departureStation}${master.departureExit ? '（' + master.departureExit + '）' : ''}発（所要約${master.busTransitMinutes || 15}分）`;
    }
    if (master.morningTimetable && master.morningTimetable.length > 0) {
      detail += ` | 朝便: ${master.morningTimetable.join(', ')}`;
    }
    if (master.notes) {
      detail += ` | ${master.notes}`;
    }

    return {
      hasClubBus: true,
      status: status,
      text: text,
      detail: detail,
      badgeClass: badgeClass,
      masterData: master
    };
  }

  /**
   * 笹塚駅からの電車の所要時間を推定
   * @param {Object} courseInfo ゴルフ場情報
   * @returns {Object} { minutes: number, text: string, detail: string }
   */
  function calculateTrainTransitTime(courseInfo) {
    const lat = parseFloat(courseInfo.latitude);
    const lng = parseFloat(courseInfo.longitude);
    const address = courseInfo.address || '';
    const busInfo = getClubBusInfo(courseInfo);
    const master = busInfo.masterData;

    if (!isNaN(lat) && !isNaN(lng) && lat > 0 && lng > 0) {
      const dist = calculateDistance(ORIGIN_SASAZUKA.lat, ORIGIN_SASAZUKA.lng, lat, lng);
      let estimatedMinutes = 0;
      let routeSummary = '';

      if (address.includes('千葉県')) {
        if (address.includes('市原') || address.includes('木更津') || address.includes('君津') || address.includes('袖ケ浦')) {
          estimatedMinutes = Math.round(30 + (dist * 0.8) + 15);
          routeSummary = '笹塚〜新宿/東京〜内房線・最寄駅';
        } else if (address.includes('成田') || address.includes('印西') || address.includes('佐倉') || address.includes('八街')) {
          estimatedMinutes = Math.round(28 + (dist * 0.75) + 15);
          routeSummary = '笹塚〜新宿/日暮里〜成田・総武線方面';
        } else {
          estimatedMinutes = Math.round(30 + (dist * 0.8) + 20);
          routeSummary = '笹塚〜東京〜総武線・外房線方面';
        }
      } else if (address.includes('埼玉県')) {
        if (address.includes('東松山') || address.includes('川越') || address.includes('坂戸') || address.includes('秩父')) {
          estimatedMinutes = Math.round(25 + (dist * 0.7) + 15);
          routeSummary = '笹塚〜新宿/池袋〜東武東上線・西武線';
        } else {
          estimatedMinutes = Math.round(25 + (dist * 0.75) + 15);
          routeSummary = '笹塚〜新宿〜湘南新宿・高崎線方面';
        }
      } else if (address.includes('神奈川県')) {
        estimatedMinutes = Math.round(20 + (dist * 0.75) + 15);
        routeSummary = '笹塚〜新宿〜小田急線・東海道線方面';
      } else if (address.includes('茨城県')) {
        estimatedMinutes = Math.round(30 + (dist * 0.72) + 15);
        routeSummary = '笹塚〜新宿/上野〜常磐線特急・TX方面';
      } else if (address.includes('栃木県')) {
        estimatedMinutes = Math.round(30 + (dist * 0.65) + 20);
        routeSummary = '笹塚〜新宿〜湘南新宿/東武特急/新幹線';
      } else if (address.includes('群馬県')) {
        estimatedMinutes = Math.round(30 + (dist * 0.65) + 20);
        routeSummary = '笹塚〜新宿〜高崎線・新幹線方面';
      } else if (address.includes('山梨県')) {
        estimatedMinutes = Math.round(20 + (dist * 0.68) + 15);
        routeSummary = '笹塚〜新宿〜中央線特急方面';
      } else if (address.includes('静岡県')) {
        estimatedMinutes = Math.round(30 + (dist * 0.65) + 20);
        routeSummary = '笹塚〜新宿/品川〜東海道新幹線方面';
      } else {
        estimatedMinutes = Math.round(30 + (dist * 0.8) + 20);
        routeSummary = '笹塚〜ターミナル駅経由';
      }

      // マスタデータの発着駅・路線情報による詳細化と補正
      if (master) {
        if (master.departureStation && master.railwayLine) {
          const transMins = master.hasClubBus ? (master.busTransitMinutes || 15) : (master.taxiTransitMinutes || 15);
          const transType = master.hasClubBus ? 'クラブバス' : 'タクシー';
          routeSummary = `笹塚〜${master.railwayLine}・${master.departureStation}（${transType}約${transMins}分）`;
        }
        if (master.hasClubBus) {
          estimatedMinutes = Math.max(40, estimatedMinutes - 5);
        }
      } else if (busInfo.hasClubBus) {
        estimatedMinutes = Math.max(45, estimatedMinutes - 5);
      }

      const hours = Math.floor(estimatedMinutes / 60);
      const mins = estimatedMinutes % 60;
      const formattedText = hours > 0 ? `約${hours}時間${mins > 0 ? mins + '分' : ''}` : `約${mins}分`;

      return {
        minutes: estimatedMinutes,
        text: formattedText,
        detail: routeSummary
      };
    }

    return estimateByPrefecture(address, 'train');
  }

  /**
   * クラブバスの有無・運行情報の解析（フォールバック用）
   * @param {string|Object} clubBusInfo クラブバス情報
   * @returns {Object} { hasClubBus: boolean, status: 'あり'|'なし'|'要予約'|'要問合せ', text: string, detail: string, badgeClass: string }
   */
  function parseClubBusStatus(clubBusInfo) {
    if (!clubBusInfo) {
      return {
        hasClubBus: false,
        status: 'なし',
        text: 'なし',
        detail: 'クラブバス運行なし（タクシー等をご利用ください）',
        badgeClass: 'badge-none'
      };
    }

    const infoStr = typeof clubBusInfo === 'string' ? clubBusInfo : JSON.stringify(clubBusInfo);

    if (infoStr.includes('運行なし') || infoStr.includes('なし') || infoStr.includes('ありません') || infoStr.trim() === '') {
      return {
        hasClubBus: false,
        status: 'なし',
        text: 'なし',
        detail: 'クラブバスの運行はありません',
        badgeClass: 'badge-none'
      };
    }

    if (infoStr.includes('要予約') || infoStr.includes('完全予約制') || infoStr.includes('事前予約')) {
      const stationMatch = infoStr.match(/([^\s,、。]+駅)/);
      const station = stationMatch ? `（${stationMatch[1]}発・要予約）` : '（要予約）';
      return {
        hasClubBus: true,
        status: '要予約',
        text: `あり ${station}`,
        detail: infoStr,
        badgeClass: 'badge-reserve'
      };
    }

    if (infoStr.includes('あり') || infoStr.includes('運行') || infoStr.includes('送迎') || infoStr.includes('発')) {
      const stationMatch = infoStr.match(/([^\s,、。]+駅)/);
      const station = stationMatch ? `（${stationMatch[1]}発）` : '';
      return {
        hasClubBus: true,
        status: 'あり',
        text: `あり ${station}`.trim(),
        detail: infoStr,
        badgeClass: 'badge-available'
      };
    }

    return {
      hasClubBus: false,
      status: '要問合せ',
      text: '要問合せ',
      detail: infoStr,
      badgeClass: 'badge-info'
    };
  }

  /**
   * クラブバスが存在するかどうかの簡易判定
   */
  function hasClubBus(clubBusInfo) {
    if (!clubBusInfo) return false;
    if (typeof clubBusInfo === 'object' && typeof clubBusInfo.hasClubBus === 'boolean') {
      return clubBusInfo.hasClubBus;
    }
    const info = getClubBusInfo(clubBusInfo);
    return info.hasClubBus;
  }

  /**
   * 住所から県ごとの標準フォールバック値を計算
   */
  function estimateByPrefecture(address, mode) {
    if (mode === 'car') {
      if (address.includes('千葉県')) return { minutes: 60, text: '約1時間00分', detail: '神田〜首都高・東関道/アクアライン' };
      if (address.includes('埼玉県')) return { minutes: 55, text: '約55分', detail: '神田〜首都高・関越道/東北道' };
      if (address.includes('神奈川県')) return { minutes: 65, text: '約1時間05分', detail: '神田〜首都高・東名高速' };
      if (address.includes('茨城県')) return { minutes: 65, text: '約1時間05分', detail: '神田〜首都高・常磐道' };
      if (address.includes('栃木県')) return { minutes: 80, text: '約1時間20分', detail: '神田〜首都高・東北道' };
      if (address.includes('群馬県')) return { minutes: 85, text: '約1時間25分', detail: '神田〜首都高・関越道' };
      if (address.includes('山梨県')) return { minutes: 75, text: '約1時間15分', detail: '神田〜首都高・中央道' };
      if (address.includes('静岡県')) return { minutes: 90, text: '約1時間30分', detail: '神田〜首都高・東名高速' };
      return { minutes: 70, text: '約1時間10分', detail: '神田〜高速道路経由' };
    } else {
      if (address.includes('千葉県')) return { minutes: 85, text: '約1時間25分', detail: '笹塚〜新宿/東京〜JR総武線/内房線' };
      if (address.includes('埼玉県')) return { minutes: 75, text: '約1時間15分', detail: '笹塚〜新宿/池袋〜東武東上線/西武線' };
      if (address.includes('神奈川県')) return { minutes: 75, text: '約1時間15分', detail: '笹塚〜新宿〜小田急線/JR東海道線' };
      if (address.includes('茨城県')) return { minutes: 90, text: '約1時間30分', detail: '笹塚〜新宿/上野〜JR常磐線/TX' };
      if (address.includes('栃木県')) return { minutes: 100, text: '約1時間40分', detail: '笹塚〜新宿〜JR宇都宮線/東武日光線' };
      if (address.includes('群馬県')) return { minutes: 105, text: '約1時間45分', detail: '笹塚〜新宿〜JR高崎線/新幹線' };
      if (address.includes('山梨県')) return { minutes: 85, text: '約1時間25分', detail: '笹塚〜新宿〜JR中央線特急' };
      if (address.includes('静岡県')) return { minutes: 110, text: '約1時間50分', detail: '笹塚〜新宿/品川〜東海道新幹線' };
      return { minutes: 90, text: '約1時間30分', detail: '笹塚〜ターミナル駅経由' };
    }
  }

  return {
    loadMasterData,
    getClubBusInfo,
    calculateCarTransitTime,
    calculateTrainTransitTime,
    parseClubBusStatus,
    hasClubBus,
    calculateDistance
  };
})();

// ブラウザおよびNode/テスト環境対応
if (typeof module !== 'undefined' && module.exports) {
  module.exports = TransitCalculator;
}
