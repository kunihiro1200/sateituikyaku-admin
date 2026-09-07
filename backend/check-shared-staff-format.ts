/**
 * 共有リストのスプレッドシートから「共有できていない」カラムの実際の値を確認するスクリプト
 * 
 * 実行方法:
 * npx ts-node backend/check-shared-staff-format.ts
 */

import axios from 'axios';

interface SharedItem {
  id: string;
  staff_not_shared: string | null;
  confirmation_date: string | null;
  [key: string]: any;
}

async function checkSharedStaffFormat() {
  console.log('📊 共有リスト「共有できていない」カラムの形式確認\n');
  console.log('スプレッドシートURL: https://docs.google.com/spreadsheets/d/1BuvYd9cKOdgIAy0XhL-voVx1tiGA-cd6MCU_dYvbAQE/edit');
  console.log('');

  // バックエンドAPIから取得（認証が通っている本番環境から）
  const response = await axios.get('https://sateituikyaku-admin-backend.vercel.app/api/shared-items');

  const items = response.data.data as SharedItem[];
  console.log(`✅ 全${items.length}件取得\n`);

  // 「共有できていない」が「林田」「元汰」「林田 元汰」「林田　元汰」を含むレコードを抽出
  const hayashidaRelated = items.filter(item => {
    const staff = item.staff_not_shared;
    if (!staff) return false;
    return staff.includes('林田') || staff.includes('元汰');
  });

  console.log(`🔍 「林田」「元汰」を含むレコード: ${hayashidaRelated.length}件\n`);

  hayashidaRelated.forEach((item, index) => {
    const staff = item.staff_not_shared;
    const confirmed = item.confirmation_date;
    console.log(`--- レコード ${index + 1} ---`);
    console.log(`ID: ${item.id}`);
    console.log(`共有できていない: "${staff}"`);
    console.log(`  → 文字数: ${staff?.length}文字`);
    console.log(`  → 含まれる文字コード: ${Array.from(staff || '').map(c => `${c}(U+${c.charCodeAt(0).toString(16).toUpperCase()})`).join(', ')}`);
    console.log(`確認日: ${confirmed || '(未確認)'}`);
    console.log('');
  });

  // 「和田」「樹奈」を含むレコードも確認
  const wadaRelated = items.filter(item => {
    const staff = item.staff_not_shared;
    if (!staff) return false;
    return staff.includes('和田') || staff.includes('樹奈');
  });

  console.log(`🔍 「和田」「樹奈」を含むレコード: ${wadaRelated.length}件\n`);

  wadaRelated.forEach((item, index) => {
    const staff = item.staff_not_shared;
    const confirmed = item.confirmation_date;
    console.log(`--- レコード ${index + 1} ---`);
    console.log(`ID: ${item.id}`);
    console.log(`共有できていない: "${staff}"`);
    console.log(`  → 文字数: ${staff?.length}文字`);
    console.log(`  → 含まれる文字コード: ${Array.from(staff || '').map(c => `${c}(U+${c.charCodeAt(0).toString(16).toUpperCase()})`).join(', ')}`);
    console.log(`確認日: ${confirmed || '(未確認)'}`);
    console.log('');
  });

  console.log('✅ 確認完了');
}

checkSharedStaffFormat().catch(console.error);
