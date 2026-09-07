/**
 * 共有リストの「共有できていない」フィールドから重複を削除し、
 * 分割された名前を統合するスクリプト
 * 
 * 問題パターン:
 * - "和田,樹奈" → "和田 樹奈"に統合
 * - "林田,元汰" → "林田 元汰"に統合
 * - 重複削除: "林田,元汰,林田　元汰" → "林田 元汰"
 * 
 * 実行方法:
 * npx ts-node backend/clean-shared-staff-names.ts [--dry-run]
 */

import axios from 'axios';

const API_BASE_URL = 'https://sateituikyaku-admin-backend.vercel.app';
const DRY_RUN = process.argv.includes('--dry-run');

interface SharedItem {
  id: string;
  staff_not_shared: string | null;
  confirmation_date: string | null;
  [key: string]: any;
}

/**
 * 姓と名を統合する
 * 例: ["和田", "樹奈"] → "和田 樹奈"
 */
function consolidateNames(names: string[]): string[] {
  const consolidated: string[] = [];
  let i = 0;

  while (i < names.length) {
    const current = names[i];
    const next = i + 1 < names.length ? names[i + 1] : null;

    // 1文字または2文字の名前が連続している場合、統合する
    if (current.length <= 2 && next && next.length <= 2) {
      consolidated.push(`${current} ${next}`);
      i += 2;
    } else {
      consolidated.push(current);
      i += 1;
    }
  }

  return consolidated;
}

/**
 * スタッフ名を正規化する
 */
function normalizeStaffNames(staffNotShared: string | null): string | null {
  if (!staffNotShared) return null;

  // カンマで分割
  const names = staffNotShared
    .split(/[,、，]+/)
    .map(s => s.trim())
    .filter(Boolean);

  // 名前を統合
  const consolidated = consolidateNames(names);

  // 重複削除（全角スペースと半角スペースを同一視）
  const uniqueNames = Array.from(
    new Set(
      consolidated.map(name => name.replace(/\s+/g, ' ')) // 全角スペースを半角に統一
    )
  );

  return uniqueNames.join(',');
}

async function cleanSharedStaffNames() {
  console.log('🧹 共有リスト「共有できていない」フィールドのクレンジング\n');
  if (DRY_RUN) {
    console.log('⚠️  ドライランモード（実際には更新しません）\n');
  }

  try {
    // 全データ取得
    const response = await axios.get<{ data: SharedItem[] }>(`${API_BASE_URL}/api/shared-items`);
    const items = response.data.data;

    console.log(`📊 全${items.length}件をチェック\n`);

    let fixedCount = 0;
    const fixes: Array<{ id: string; before: string; after: string }> = [];

    for (const item of items) {
      if (!item.staff_not_shared) continue;

      const normalized = normalizeStaffNames(item.staff_not_shared);

      if (normalized !== item.staff_not_shared) {
        fixedCount++;
        fixes.push({
          id: item.id,
          before: item.staff_not_shared,
          after: normalized || ''
        });

        console.log(`🔧 ID: ${item.id}`);
        console.log(`  修正前: "${item.staff_not_shared}"`);
        console.log(`  修正後: "${normalized}"`);
        console.log('');

        if (!DRY_RUN) {
          await axios.put(`${API_BASE_URL}/api/shared-items/${item.id}`, {
            staff_not_shared: normalized
          });
        }
      }
    }

    console.log('');
    console.log('✅ クレンジング完了');
    console.log(`  修正件数: ${fixedCount}件 / ${items.length}件`);

    if (DRY_RUN && fixedCount > 0) {
      console.log('');
      console.log('💡 実際に修正するには --dry-run を外して実行してください:');
      console.log('   npx ts-node backend/clean-shared-staff-names.ts');
    }

  } catch (error: any) {
    console.error('❌ エラー:', error.message);
    if (error.response) {
      console.error('  レスポンス:', error.response.data);
    }
  }
}

cleanSharedStaffNames().catch(console.error);
