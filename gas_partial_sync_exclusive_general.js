/**
 * 部分同期スクリプト：専任・一般・他決カテゴリのみ
 * 
 * 対象：
 * - 状況（当社）に「一般媒介」「専任媒介」「他決」を含む
 * - 専任他決打合せが空欄
 * 
 * 目的：
 * - contract_year_monthの同期
 * - 時間制限を回避
 */

// === 設定 ===
const SUPABASE_URL = 'https://ynrqrxqfqhqxqxqxqxqx.supabase.co'; // 実際のURLに置き換え
const SUPABASE_SERVICE_KEY = 'your-service-key'; // 実際のキーに置き換え
const SPREADSHEET_ID = '1wKBRLWbT6pSKa9IlTDabjhjTnfs_GxX6Rn6M6kbio1I';
const SHEET_NAME = '売主リスト';

/**
 * 日付をISO形式（YYYY-MM-DD）に変換
 * Excel シリアル値と文字列日付の両方に対応
 */
function formatDateToISO_(value) {
  if (!value) return null;
  
  // 数値（Excelシリアル値）の場合
  if (typeof value === 'number') {
    // Excelシリアル値を日付に変換（1900年1月1日を基準、Excelのバグ補正込み）
    const excelEpoch = new Date(1899, 11, 30); // 1899年12月30日
    const date = new Date(excelEpoch.getTime() + value * 24 * 60 * 60 * 1000);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
  
  // 文字列の場合
  const str = String(value).trim();
  if (!str) return null;
  
  // YYYY/MM/DD 形式
  if (/^\d{4}\/\d{1,2}\/\d{1,2}$/.test(str)) {
    const parts = str.split('/');
    const year = parts[0];
    const month = parts[1].padStart(2, '0');
    const day = parts[2].padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
  
  // MM/DD 形式（年は現在年と仮定）
  if (/^\d{1,2}\/\d{1,2}$/.test(str)) {
    const parts = str.split('/');
    const year = new Date().getFullYear();
    const month = parts[0].padStart(2, '0');
    const day = parts[1].padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
  
  // YYYY-MM-DD 形式（そのまま）
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
    return str;
  }
  
  return null;
}

/**
 * 部分同期：専任・一般・他決カテゴリのみ
 */
function syncExclusiveGeneralOnly() {
  console.log('🔄 部分同期開始：専任・一般・他決カテゴリのみ');
  console.log('📅 実行日時:', new Date().toISOString());
  
  const startTime = Date.now();
  
  try {
    // スプレッドシートからデータを取得
    const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(SHEET_NAME);
    const data = sheet.getDataRange().getValues();
    const headers = data[0];
    
    // カラムインデックスを取得
    const sellerNumberIdx = headers.indexOf('売主番号');
    const statusIdx = headers.indexOf('状況（当社）');
    const contractYearMonthIdx = headers.indexOf('契約年月 他決は分かった時点');
    const exclusiveMeetingIdx = headers.indexOf('専任他決打合せ');
    
    if (sellerNumberIdx === -1 || statusIdx === -1 || contractYearMonthIdx === -1) {
      throw new Error('必要なカラムが見つかりません');
    }
    
    console.log(`📊 スプレッドシート行数: ${data.length - 1}件`);
    
    // 対象売主を抽出
    const targetSellers = [];
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      const sellerNumber = row[sellerNumberIdx];
      const status = row[statusIdx] ? String(row[statusIdx]) : '';
      const contractYearMonth = row[contractYearMonthIdx];
      const exclusiveMeeting = exclusiveMeetingIdx !== -1 ? row[exclusiveMeetingIdx] : '';
      
      // 条件チェック
      const hasTargetStatus = 
        status.includes('一般媒介') || 
        status.includes('専任媒介') || 
        status.includes('他決');
      
      const hasEmptyExclusiveMeeting = !exclusiveMeeting || exclusiveMeeting === '';
      
      if (hasTargetStatus && hasEmptyExclusiveMeeting && sellerNumber) {
        targetSellers.push({
          sellerNumber: sellerNumber,
          status: status,
          contractYearMonth: contractYearMonth,
          exclusiveMeeting: exclusiveMeeting
        });
      }
    }
    
    console.log(`🎯 対象売主: ${targetSellers.length}件`);
    
    if (targetSellers.length === 0) {
      console.log('✅ 対象売主なし。同期完了。');
      return;
    }
    
    // Supabaseに更新
    let updateCount = 0;
    let errorCount = 0;
    
    for (let i = 0; i < targetSellers.length; i++) {
      const seller = targetSellers[i];
      
      // 進捗表示（10件ごと）
      if ((i + 1) % 10 === 0) {
        console.log(`📊 進捗: ${i + 1}/${targetSellers.length}件処理済み`);
      }
      
      try {
        // contract_year_monthをISO形式に変換
        const contractYearMonthISO = formatDateToISO_(seller.contractYearMonth);
        
        // Supabaseに更新
        const updateData = {
          contract_year_month: contractYearMonthISO
        };
        
        const response = UrlFetchApp.fetch(
          `${SUPABASE_URL}/rest/v1/sellers?seller_number=eq.${seller.sellerNumber}`,
          {
            method: 'patch',
            headers: {
              'apikey': SUPABASE_SERVICE_KEY,
              'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
              'Content-Type': 'application/json',
              'Prefer': 'return=minimal'
            },
            payload: JSON.stringify(updateData),
            muteHttpExceptions: true
          }
        );
        
        if (response.getResponseCode() === 204) {
          updateCount++;
          console.log(`✅ ${seller.sellerNumber}: 更新 (contract_year_month: ${contractYearMonthISO})`);
        } else {
          errorCount++;
          console.error(`❌ ${seller.sellerNumber}: エラー (${response.getResponseCode()})`);
        }
      } catch (error) {
        errorCount++;
        console.error(`❌ ${seller.sellerNumber}: 例外 - ${error.message}`);
      }
    }
    
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    
    console.log('\n📊 部分同期完了:');
    console.log(`  - 対象売主: ${targetSellers.length}件`);
    console.log(`  - 更新成功: ${updateCount}件`);
    console.log(`  - エラー: ${errorCount}件`);
    console.log(`  - 所要時間: ${duration}秒`);
    console.log('=== 同期完了 ===');
    
  } catch (error) {
    console.error('❌ 部分同期エラー:', error.message);
    console.error(error.stack);
    throw error;
  }
}

/**
 * 対象売主数を確認（実行前の確認用）
 */
function checkTargetCount() {
  console.log('🔍 対象売主数を確認中...');
  
  const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(SHEET_NAME);
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  
  const sellerNumberIdx = headers.indexOf('売主番号');
  const statusIdx = headers.indexOf('状況（当社）');
  const exclusiveMeetingIdx = headers.indexOf('専任他決打合せ');
  
  let targetCount = 0;
  let generalCount = 0;
  let exclusiveCount = 0;
  let otherDecisionCount = 0;
  
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    const sellerNumber = row[sellerNumberIdx];
    const status = row[statusIdx] ? String(row[statusIdx]) : '';
    const exclusiveMeeting = exclusiveMeetingIdx !== -1 ? row[exclusiveMeetingIdx] : '';
    
    const hasTargetStatus = 
      status.includes('一般媒介') || 
      status.includes('専任媒介') || 
      status.includes('他決');
    
    const hasEmptyExclusiveMeeting = !exclusiveMeeting || exclusiveMeeting === '';
    
    if (hasTargetStatus && hasEmptyExclusiveMeeting && sellerNumber) {
      targetCount++;
      
      if (status.includes('一般媒介')) generalCount++;
      if (status.includes('専任媒介')) exclusiveCount++;
      if (status.includes('他決')) otherDecisionCount++;
    }
  }
  
  console.log(`📊 対象売主数: ${targetCount}件`);
  console.log(`  - 一般媒介: ${generalCount}件`);
  console.log(`  - 専任媒介: ${exclusiveCount}件`);
  console.log(`  - 他決: ${otherDecisionCount}件`);
  console.log('\n✅ 確認完了。syncExclusiveGeneralOnly() を実行してください。');
}
