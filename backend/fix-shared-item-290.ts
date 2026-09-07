/**
 * ID: 290の「共有できていない」フィールドから重複を削除するスクリプト
 * 
 * 修正前: "和田,樹奈,木村侑里音,林田,元汰,裏天真,麻生華蓮,林田,元汰,林田　元汰"
 * 修正後: "木村侑里音,裏天真,麻生華蓮,和田 樹奈,林田 元汰"
 * 
 * 実行方法:
 * npx ts-node backend/fix-shared-item-290.ts
 */

import axios from 'axios';

async function fixSharedItem290() {
  console.log('🔧 ID: 290の「共有できていない」フィールドを修正\n');

  const API_BASE_URL = 'https://sateituikyaku-admin-backend.vercel.app';

  try {
    // 1. 現在のデータを取得
    const getResponse = await axios.get(`${API_BASE_URL}/api/shared-items`);
    const items = getResponse.data.data;
    const item290 = items.find((item: any) => item.id === '290');

    if (!item290) {
      console.error('❌ ID: 290が見つかりません');
      return;
    }

    console.log('📋 修正前:');
    console.log(`  ID: ${item290.id}`);
    console.log(`  共有できていない: "${item290.staff_not_shared}"`);
    console.log('');

    // 2. 重複を削除して整理
    // "和田,樹奈" → "和田 樹奈"
    // "林田,元汰" → "林田 元汰"（重複削除）
    // "林田　元汰" → 削除（上記で統一）
    const fixedStaffNotShared = '木村侑里音,裏天真,麻生華蓮,和田 樹奈,林田 元汰';

    console.log('📋 修正後:');
    console.log(`  共有できていない: "${fixedStaffNotShared}"`);
    console.log('');

    // 3. 更新
    console.log('⏳ 更新中...');
    await axios.put(`${API_BASE_URL}/api/shared-items/290`, {
      staff_not_shared: fixedStaffNotShared
    });

    console.log('✅ 修正完了');
    console.log('');
    console.log('🔍 確認: https://sateituikyaku-admin-frontend.vercel.app/shared-items');

  } catch (error: any) {
    console.error('❌ エラー:', error.message);
    if (error.response) {
      console.error('  レスポンス:', error.response.data);
    }
  }
}

fixSharedItem290().catch(console.error);
