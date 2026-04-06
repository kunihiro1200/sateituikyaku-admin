# -*- coding: utf-8 -*-
"""
gas_buyer_complete_code.jsにupdateBuyerSidebarCounts_関数を追加するスクリプト
"""

# ファイルを読み込む（UTF-8）
with open('gas_buyer_complete_code.js', 'rb') as f:
    content = f.read()

text = content.decode('utf-8')

# 追加する関数
new_function = '''

/**
 * 買主サイドバーカウントを更新（10分ごとに実行）
 * buyer_sidebar_countsテーブルに事前計算結果を保存
 */
function updateBuyerSidebarCounts_() {
  try {
    var startTime = new Date();
    Logger.log('🔄 買主サイドバーカウント更新開始...');
    
    // 全買主データを取得
    var allBuyers = fetchAllBuyersFromSupabase_();
    if (!allBuyers) {
      Logger.log('❌ 買主データ取得失敗');
      return;
    }
    
    Logger.log('📊 買主数: ' + allBuyers.length);
    
    // カウントを計算
    var counts = {
      viewingDayBefore: 0,
      todayCall: 0,
      todayCallAssigned: {},
      threeCallsUnconfirmed: 0,
      threeCallsUnconfirmedAssigned: {},
      assigned: {},
      generalMediationAtbb: 0,
      generalMediationAtbbAssigned: {},
      generalVisitExclusive: 0,
      generalVisitExclusiveAssigned: {},
      inquiryEmailUnanswered: 0,
      inquiryEmailUnansweredAssigned: {},
      otherCategories: 0,
      otherCategoriesAssigned: {},
      pinrichUnregistered: 0
    };
    
    var today = getTodayJST_();
    var tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    var todayStr = formatDateToYYYYMMDD_(today);
    var tomorrowStr = formatDateToYYYYMMDD_(tomorrow);
    
    // 各買主をカテゴリーに分類
    for (var i = 0; i < allBuyers.length; i++) {
      var buyer = allBuyers[i];
      var status = buyer.latest_status || '';
      var nextCallDate = buyer.next_call_date ? buyer.next_call_date.split('T')[0] : '';
      var viewingDate = buyer.latest_viewing_date ? buyer.latest_viewing_date.split('T')[0] : '';
      var assignee = buyer.initial_assignee || buyer.follow_up_assignee || '';
      
      // 内覧日前日
      if (viewingDate === tomorrowStr) {
        counts.viewingDayBefore++;
      }
      
      // 当日TEL
      if (nextCallDate === todayStr) {
        counts.todayCall++;
        if (assignee) {
          counts.todayCallAssigned[assignee] = (counts.todayCallAssigned[assignee] || 0) + 1;
        }
      }
      
      // 3回架電未
      if (buyer.three_calls_confirmed === false || buyer.three_calls_confirmed === 'false') {
        counts.threeCallsUnconfirmed++;
        if (assignee) {
          counts.threeCallsUnconfirmedAssigned[assignee] = (counts.threeCallsUnconfirmedAssigned[assignee] || 0) + 1;
        }
      }
      
      // 担当別カウント
      if (assignee) {
        counts.assigned[assignee] = (counts.assigned[assignee] || 0) + 1;
      }
      
      // 一般仲介・ATBB
      if (status === '一般仲介・ATBB') {
        counts.generalMediationAtbb++;
        if (assignee) {
          counts.generalMediationAtbbAssigned[assignee] = (counts.generalMediationAtbbAssigned[assignee] || 0) + 1;
        }
      }
      
      // 一般訪問・専属
      if (status === '一般訪問・専属') {
        counts.generalVisitExclusive++;
        if (assignee) {
          counts.generalVisitExclusiveAssigned[assignee] = (counts.generalVisitExclusiveAssigned[assignee] || 0) + 1;
        }
      }
      
      // 問合メール未回答
      if (status === '問合メール未回答') {
        counts.inquiryEmailUnanswered++;
        if (assignee) {
          counts.inquiryEmailUnansweredAssigned[assignee] = (counts.inquiryEmailUnansweredAssigned[assignee] || 0) + 1;
        }
      }
      
      // その他カテゴリ
      if (status === 'その他') {
        counts.otherCategories++;
        if (assignee) {
          counts.otherCategoriesAssigned[assignee] = (counts.otherCategoriesAssigned[assignee] || 0) + 1;
        }
      }
      
      // ピンリッチ未登録
      if (!buyer.desired_area || buyer.desired_area === '') {
        counts.pinrichUnregistered++;
      }
    }
    
    // buyer_sidebar_countsテーブルに保存する行を作成
    var rows = [];
    var now = new Date().toISOString();
    
    // 内覧日前日
    if (counts.viewingDayBefore > 0) {
      rows.push({
        category: 'viewingDayBefore',
        count: counts.viewingDayBefore,
        label: '',
        assignee: '',
        updated_at: now
      });
    }
    
    // 当日TEL
    if (counts.todayCall > 0) {
      rows.push({
        category: 'todayCall',
        count: counts.todayCall,
        label: '',
        assignee: '',
        updated_at: now
      });
    }
    
    // 当日TEL（担当別）
    for (var assignee in counts.todayCallAssigned) {
      rows.push({
        category: 'todayCallAssigned',
        count: counts.todayCallAssigned[assignee],
        label: '',
        assignee: assignee,
        updated_at: now
      });
    }
    
    // 3回架電未
    if (counts.threeCallsUnconfirmed > 0) {
      rows.push({
        category: 'threeCallsUnconfirmed',
        count: counts.threeCallsUnconfirmed,
        label: '',
        assignee: '',
        updated_at: now
      });
    }
    
    // 3回架電未（担当別）
    for (var assignee in counts.threeCallsUnconfirmedAssigned) {
      rows.push({
        category: 'threeCallsUnconfirmedAssigned',
        count: counts.threeCallsUnconfirmedAssigned[assignee],
        label: '',
        assignee: assignee,
        updated_at: now
      });
    }
    
    // 担当別
    for (var assignee in counts.assigned) {
      rows.push({
        category: 'assigned',
        count: counts.assigned[assignee],
        label: '',
        assignee: assignee,
        updated_at: now
      });
    }
    
    // 一般仲介・ATBB
    if (counts.generalMediationAtbb > 0) {
      rows.push({
        category: 'generalMediationAtbb',
        count: counts.generalMediationAtbb,
        label: '',
        assignee: '',
        updated_at: now
      });
    }
    
    // 一般仲介・ATBB（担当別）
    for (var assignee in counts.generalMediationAtbbAssigned) {
      rows.push({
        category: 'generalMediationAtbbAssigned',
        count: counts.generalMediationAtbbAssigned[assignee],
        label: '',
        assignee: assignee,
        updated_at: now
      });
    }
    
    // 一般訪問・専属
    if (counts.generalVisitExclusive > 0) {
      rows.push({
        category: 'generalVisitExclusive',
        count: counts.generalVisitExclusive,
        label: '',
        assignee: '',
        updated_at: now
      });
    }
    
    // 一般訪問・専属（担当別）
    for (var assignee in counts.generalVisitExclusiveAssigned) {
      rows.push({
        category: 'generalVisitExclusiveAssigned',
        count: counts.generalVisitExclusiveAssigned[assignee],
        label: '',
        assignee: assignee,
        updated_at: now
      });
    }
    
    // 問合メール未回答
    if (counts.inquiryEmailUnanswered > 0) {
      rows.push({
        category: 'inquiryEmailUnanswered',
        count: counts.inquiryEmailUnanswered,
        label: '',
        assignee: '',
        updated_at: now
      });
    }
    
    // 問合メール未回答（担当別）
    for (var assignee in counts.inquiryEmailUnansweredAssigned) {
      rows.push({
        category: 'inquiryEmailUnansweredAssigned',
        count: counts.inquiryEmailUnansweredAssigned[assignee],
        label: '',
        assignee: assignee,
        updated_at: now
      });
    }
    
    // その他カテゴリ
    if (counts.otherCategories > 0) {
      rows.push({
        category: 'otherCategories',
        count: counts.otherCategories,
        label: '',
        assignee: '',
        updated_at: now
      });
    }
    
    // その他カテゴリ（担当別）
    for (var assignee in counts.otherCategoriesAssigned) {
      rows.push({
        category: 'otherCategoriesAssigned',
        count: counts.otherCategoriesAssigned[assignee],
        label: '',
        assignee: assignee,
        updated_at: now
      });
    }
    
    // ピンリッチ未登録
    if (counts.pinrichUnregistered > 0) {
      rows.push({
        category: 'pinrichUnregistered',
        count: counts.pinrichUnregistered,
        label: '',
        assignee: '',
        updated_at: now
      });
    }
    
    // Supabaseに保存（全削除→挿入）
    var deleteUrl = SUPABASE_CONFIG.URL + '/rest/v1/buyer_sidebar_counts?category=neq.___never___';
    var deleteOptions = {
      method: 'delete',
      headers: {
        'apikey': SUPABASE_CONFIG.SERVICE_KEY,
        'Authorization': 'Bearer ' + SUPABASE_CONFIG.SERVICE_KEY,
        'Content-Type': 'application/json'
      },
      muteHttpExceptions: true
    };
    
    var deleteResponse = UrlFetchApp.fetch(deleteUrl, deleteOptions);
    Logger.log('🗑️ 既存データ削除: ' + deleteResponse.getResponseCode());
    
    if (rows.length > 0) {
      var insertUrl = SUPABASE_CONFIG.URL + '/rest/v1/buyer_sidebar_counts';
      var insertOptions = {
        method: 'post',
        headers: {
          'apikey': SUPABASE_CONFIG.SERVICE_KEY,
          'Authorization': 'Bearer ' + SUPABASE_CONFIG.SERVICE_KEY,
          'Content-Type': 'application/json',
          'Prefer': 'return=minimal'
        },
        payload: JSON.stringify(rows),
        muteHttpExceptions: true
      };
      
      var insertResponse = UrlFetchApp.fetch(insertUrl, insertOptions);
      Logger.log('✅ 新データ挿入: ' + insertResponse.getResponseCode() + ' (' + rows.length + '件)');
    }
    
    var endTime = new Date();
    var duration = (endTime - startTime) / 1000;
    Logger.log('✅ サイドバーカウント更新完了: ' + duration + '秒');
    
  } catch (e) {
    Logger.log('❌ エラー: ' + e.toString());
    Logger.log('スタックトレース: ' + e.stack);
  }
}
'''

# ファイルの末尾に関数を追加
text += new_function

# UTF-8で書き込む（BOMなし）
with open('gas_buyer_complete_code.js', 'wb') as f:
    f.write(text.encode('utf-8'))

print('✅ updateBuyerSidebarCounts_関数を追加しました')
