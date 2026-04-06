# -*- coding: utf-8 -*-
"""
gas_buyer_complete_code.jsにupdateBuyerSidebarCounts関数を追加するスクリプト
"""

# 追加する関数のコード
function_code = '''
// ============================================================
// 買主サイドバーカウント更新（10分ごとに実行）
// ============================================================

/**
 * 買主サイドバーカウントを更新（10分ごとに実行）
 * buyer_sidebar_countsテーブルに事前計算結果を保存
 */
function updateBuyerSidebarCounts() {
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
      
      // 本日架電
      if (nextCallDate === todayStr) {
        counts.todayCall++;
        if (assignee) {
          counts.todayCallAssigned[assignee] = (counts.todayCallAssigned[assignee] || 0) + 1;
        }
      }
      
      // 3回架電未確認
      if (buyer.three_calls_confirmed !== '確認済み' && buyer.three_calls_confirmed) {
        counts.threeCallsUnconfirmed++;
        if (assignee) {
          counts.threeCallsUnconfirmedAssigned[assignee] = (counts.threeCallsUnconfirmedAssigned[assignee] || 0) + 1;
        }
      }
      
      // 担当別
      if (assignee) {
        counts.assigned[assignee] = (counts.assigned[assignee] || 0) + 1;
      }
      
      // 一般媒介@BB
      if (status === '一般媒介@BB') {
        counts.generalMediationAtbb++;
        if (assignee) {
          counts.generalMediationAtbbAssigned[assignee] = (counts.generalMediationAtbbAssigned[assignee] || 0) + 1;
        }
      }
      
      // 一般内覧/専任
      if (status === '一般内覧' || status === '専任') {
        counts.generalVisitExclusive++;
        if (assignee) {
          counts.generalVisitExclusiveAssigned[assignee] = (counts.generalVisitExclusiveAssigned[assignee] || 0) + 1;
        }
      }
      
      // 問合メール未回答
      if (buyer.inquiry_email_phone_response === '未回答') {
        counts.inquiryEmailUnanswered++;
        if (assignee) {
          counts.inquiryEmailUnansweredAssigned[assignee] = (counts.inquiryEmailUnansweredAssigned[assignee] || 0) + 1;
        }
      }
      
      // その他カテゴリー
      if (status && status !== '一般媒介@BB' && status !== '一般内覧' && status !== '専任') {
        counts.otherCategories++;
        if (assignee) {
          counts.otherCategoriesAssigned[assignee] = (counts.otherCategoriesAssigned[assignee] || 0) + 1;
        }
      }
      
      // ピンリッチ未登録
      if (!buyer.pinrich_registered || buyer.pinrich_registered === '未登録') {
        counts.pinrichUnregistered++;
      }
    }
    
    Logger.log('📊 カウント計算完了');
    Logger.log('  内覧日前日: ' + counts.viewingDayBefore);
    Logger.log('  本日架電: ' + counts.todayCall);
    Logger.log('  3回架電未確認: ' + counts.threeCallsUnconfirmed);
    Logger.log('  一般媒介@BB: ' + counts.generalMediationAtbb);
    Logger.log('  一般内覧/専任: ' + counts.generalVisitExclusive);
    Logger.log('  問合メール未回答: ' + counts.inquiryEmailUnanswered);
    Logger.log('  その他カテゴリー: ' + counts.otherCategories);
    Logger.log('  ピンリッチ未登録: ' + counts.pinrichUnregistered);
    
    // buyer_sidebar_countsテーブルをクリア
    var deleteUrl = SUPABASE_CONFIG.URL + '/rest/v1/buyer_sidebar_counts?category=neq.dummy';
    var deleteOptions = {
      method: 'DELETE',
      headers: {
        'apikey': SUPABASE_CONFIG.SERVICE_KEY,
        'Authorization': 'Bearer ' + SUPABASE_CONFIG.SERVICE_KEY,
        'Prefer': 'return=minimal'
      },
      muteHttpExceptions: true
    };
    var deleteRes = UrlFetchApp.fetch(deleteUrl, deleteOptions);
    if (deleteRes.getResponseCode() >= 200 && deleteRes.getResponseCode() < 300) {
      Logger.log('✅ buyer_sidebar_countsテーブルをクリア');
    } else {
      Logger.log('❌ テーブルクリア失敗: HTTP ' + deleteRes.getResponseCode());
    }
    
    // 新しいカウントを挿入
    var insertData = [];
    
    // 内覧日前日
    insertData.push({
      category: 'viewingDayBefore',
      count: counts.viewingDayBefore,
      label: null,
      assignee: null,
      updated_at: new Date().toISOString()
    });
    
    // 本日架電
    insertData.push({
      category: 'todayCall',
      count: counts.todayCall,
      label: null,
      assignee: null,
      updated_at: new Date().toISOString()
    });
    
    // 本日架電（担当別）
    for (var assignee in counts.todayCallAssigned) {
      insertData.push({
        category: 'todayCallAssigned',
        count: counts.todayCallAssigned[assignee],
        label: null,
        assignee: assignee,
        updated_at: new Date().toISOString()
      });
    }
    
    // 3回架電未確認
    insertData.push({
      category: 'threeCallsUnconfirmed',
      count: counts.threeCallsUnconfirmed,
      label: null,
      assignee: null,
      updated_at: new Date().toISOString()
    });
    
    // 3回架電未確認（担当別）
    for (var assignee in counts.threeCallsUnconfirmedAssigned) {
      insertData.push({
        category: 'threeCallsUnconfirmedAssigned',
        count: counts.threeCallsUnconfirmedAssigned[assignee],
        label: null,
        assignee: assignee,
        updated_at: new Date().toISOString()
      });
    }
    
    // 担当別
    for (var assignee in counts.assigned) {
      insertData.push({
        category: 'assigned',
        count: counts.assigned[assignee],
        label: null,
        assignee: assignee,
        updated_at: new Date().toISOString()
      });
    }
    
    // 一般媒介@BB
    insertData.push({
      category: 'generalMediationAtbb',
      count: counts.generalMediationAtbb,
      label: null,
      assignee: null,
      updated_at: new Date().toISOString()
    });
    
    // 一般媒介@BB（担当別）
    for (var assignee in counts.generalMediationAtbbAssigned) {
      insertData.push({
        category: 'generalMediationAtbbAssigned',
        count: counts.generalMediationAtbbAssigned[assignee],
        label: null,
        assignee: assignee,
        updated_at: new Date().toISOString()
      });
    }
    
    // 一般内覧/専任
    insertData.push({
      category: 'generalVisitExclusive',
      count: counts.generalVisitExclusive,
      label: null,
      assignee: null,
      updated_at: new Date().toISOString()
    });
    
    // 一般内覧/専任（担当別）
    for (var assignee in counts.generalVisitExclusiveAssigned) {
      insertData.push({
        category: 'generalVisitExclusiveAssigned',
        count: counts.generalVisitExclusiveAssigned[assignee],
        label: null,
        assignee: assignee,
        updated_at: new Date().toISOString()
      });
    }
    
    // 問合メール未回答
    insertData.push({
      category: 'inquiryEmailUnanswered',
      count: counts.inquiryEmailUnanswered,
      label: null,
      assignee: null,
      updated_at: new Date().toISOString()
    });
    
    // 問合メール未回答（担当別）
    for (var assignee in counts.inquiryEmailUnansweredAssigned) {
      insertData.push({
        category: 'inquiryEmailUnansweredAssigned',
        count: counts.inquiryEmailUnansweredAssigned[assignee],
        label: null,
        assignee: assignee,
        updated_at: new Date().toISOString()
      });
    }
    
    // その他カテゴリー
    insertData.push({
      category: 'otherCategories',
      count: counts.otherCategories,
      label: null,
      assignee: null,
      updated_at: new Date().toISOString()
    });
    
    // その他カテゴリー（担当別）
    for (var assignee in counts.otherCategoriesAssigned) {
      insertData.push({
        category: 'otherCategoriesAssigned',
        count: counts.otherCategoriesAssigned[assignee],
        label: null,
        assignee: assignee,
        updated_at: new Date().toISOString()
      });
    }
    
    // ピンリッチ未登録
    insertData.push({
      category: 'pinrichUnregistered',
      count: counts.pinrichUnregistered,
      label: null,
      assignee: null,
      updated_at: new Date().toISOString()
    });
    
    // データを挿入
    var insertUrl = SUPABASE_CONFIG.URL + '/rest/v1/buyer_sidebar_counts';
    var insertOptions = {
      method: 'POST',
      headers: {
        'apikey': SUPABASE_CONFIG.SERVICE_KEY,
        'Authorization': 'Bearer ' + SUPABASE_CONFIG.SERVICE_KEY,
        'Content-Type': 'application/json',
        'Prefer': 'return=minimal'
      },
      payload: JSON.stringify(insertData),
      muteHttpExceptions: true
    };
    var insertRes = UrlFetchApp.fetch(insertUrl, insertOptions);
    if (insertRes.getResponseCode() >= 200 && insertRes.getResponseCode() < 300) {
      Logger.log('✅ buyer_sidebar_countsテーブルに' + insertData.length + '件挿入');
    } else {
      Logger.log('❌ データ挿入失敗: HTTP ' + insertRes.getResponseCode());
      Logger.log('  レスポンス: ' + insertRes.getContentText().substring(0, 500));
    }
    
    var duration = (new Date() - startTime) / 1000;
    Logger.log('✅ 買主サイドバーカウント更新完了: ' + duration + '秒');
  } catch (e) {
    Logger.log('❌ 買主サイドバーカウント更新エラー: ' + e.toString());
    Logger.log('  スタックトレース: ' + e.stack);
  }
}

/**
 * 日付をYYYY-MM-DD形式にフォーマット
 */
function formatDateToYYYYMMDD_(date) {
  var year = date.getFullYear();
  var month = String(date.getMonth() + 1).padStart(2, '0');
  var day = String(date.getDate()).padStart(2, '0');
  return year + '-' + month + '-' + day;
}

/**
 * 今日の日付を取得（JST）
 */
function getTodayJST_() {
  var now = new Date();
  var jstOffset = 9 * 60; // JST = UTC+9
  var utc = now.getTime() + (now.getTimezoneOffset() * 60000);
  var jst = new Date(utc + (jstOffset * 60000));
  jst.setHours(0, 0, 0, 0);
  return jst;
}
'''

# 既存のファイルを読み込む
with open('gas_buyer_complete_code.js', 'rb') as f:
    content = f.read()

# UTF-8でデコード（エラーを無視）
try:
    text = content.decode('utf-8')
except UnicodeDecodeError:
    # Shift-JISでデコードしてUTF-8に変換
    text = content.decode('shift-jis', errors='ignore')

# 関数を追加する位置を探す
# testBuyerSync関数の前に追加
insert_position = text.find('function testBuyerSync()')

if insert_position == -1:
    # testBuyerSync関数が見つからない場合は、ファイルの末尾に追加
    text = text + '\n' + function_code
    print('ファイルの末尾に関数を追加しました')
else:
    # testBuyerSync関数の前に追加
    text = text[:insert_position] + function_code + '\n' + text[insert_position:]
    print('testBuyerSync関数の前に関数を追加しました')

# UTF-8で書き込む（BOMなし）
with open('gas_buyer_complete_code.js', 'wb') as f:
    f.write(text.encode('utf-8'))

print('✅ updateBuyerSidebarCounts関数を追加しました')
print('📊 ファイルサイズ: ' + str(len(text)) + '文字')
