/**
 * AA13729のAPIレスポンスを確認するスクリプト
 * 本番環境のAPIから取得したデータを確認
 */

const fetch = require('node-fetch');

async function checkAA13729ApiResponse() {
  try {
    console.log('🔍 AA13729のAPIレスポンスを確認中...\n');
    
    // 本番環境のAPIエンドポイント
    const apiUrl = 'https://sateituikyaku-admin-backend.vercel.app/api/sellers/by-number/AA13729';
    
    console.log(`📡 APIリクエスト: ${apiUrl}\n`);
    
    const response = await fetch(apiUrl);
    
    if (!response.ok) {
      console.error(`❌ APIエラー: ${response.status} ${response.statusText}`);
      return;
    }
    
    const seller = await response.json();
    
    console.log('✅ APIレスポンス取得成功\n');
    console.log('📊 売主データ:');
    console.log('  - seller_number:', seller.sellerNumber || seller.seller_number);
    console.log('  - name:', seller.name);
    console.log('  - visit_assignee:', seller.visitAssignee || seller.visit_assignee);
    console.log('  - visit_date:', seller.visitDate || seller.visit_date);
    console.log('  - visit_reminder_assignee:', seller.visitReminderAssignee || seller.visit_reminder_assignee);
    console.log('  - status:', seller.status);
    console.log('\n');
    
    // 訪問日前日の条件をチェック
    console.log('🔍 訪問日前日の条件チェック:');
    
    const visitAssignee = seller.visitAssignee || seller.visit_assignee;
    console.log(`  1. 営担に入力がある: ${visitAssignee ? '✅ YES (' + visitAssignee + ')' : '❌ NO'}`);
    
    const visitDate = seller.visitDate || seller.visit_date;
    console.log(`  2. 訪問日がある: ${visitDate ? '✅ YES (' + visitDate + ')' : '❌ NO'}`);
    
    const visitReminderAssignee = seller.visitReminderAssignee || seller.visit_reminder_assignee;
    console.log(`  3. 訪問通知担当が空: ${!visitReminderAssignee || visitReminderAssignee.trim() === '' ? '✅ YES' : '❌ NO (' + visitReminderAssignee + ')'}`);
    
    // 訪問日の曜日を確認
    if (visitDate) {
      let dateStr = visitDate;
      if (dateStr.includes(' ')) {
        dateStr = dateStr.split(' ')[0];
      } else if (dateStr.includes('T')) {
        dateStr = dateStr.split('T')[0];
      }
      
      const date = new Date(dateStr);
      const dayOfWeek = date.getDay();
      const dayNames = ['日', '月', '火', '水', '木', '金', '土'];
      console.log(`  4. 訪問日の曜日: ${dayNames[dayOfWeek]}曜日 (${dateStr})`);
      
      // 今日の日付
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const todayStr = today.toISOString().split('T')[0];
      console.log(`  5. 今日の日付: ${todayStr}`);
      
      // 前営業日を計算
      const daysBeforeVisit = dayOfWeek === 4 ? 2 : 1; // 木曜訪問のみ2日前
      const notifyDate = new Date(date);
      notifyDate.setDate(notifyDate.getDate() - daysBeforeVisit);
      const notifyDateStr = notifyDate.toISOString().split('T')[0];
      console.log(`  6. 通知日（前営業日）: ${notifyDateStr} (${daysBeforeVisit}日前)`);
      
      const isMatch = todayStr === notifyDateStr;
      console.log(`  7. 今日が通知日と一致: ${isMatch ? '✅ YES' : '❌ NO'}`);
    }
    
    console.log('\n');
    console.log('📋 完全なAPIレスポンス:');
    console.log(JSON.stringify(seller, null, 2));
    
  } catch (error) {
    console.error('❌ エラー:', error.message);
  }
}

checkAA13729ApiResponse();
