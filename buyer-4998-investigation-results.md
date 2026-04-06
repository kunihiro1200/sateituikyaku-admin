# 買主4998の次電日更新がサイドバーに反映されない問題の調査結果

## 📊 調査日時
2026年4月5日

## 🔍 問題の詳細

**症状**: 買主4998の次電日を4/6に更新したが、サイドバーの「当日TEL」に反映されない

## ✅ 調査結果

### 1. 買主4998のデータ確認

```
買主4998のデータ:
  buyer_number: 4998
  next_call_date: 2026-04-06T00:00:00+00:00  ← 明日の日付
  follow_up_assignee: null  ← 空（条件を満たす）
  initial_assignee: I
  latest_status: null
  今日: 2026-04-05  ← 今日の日付

条件チェック:
  follow_up_assigneeが空: true  ✅
  next_call_dateが空でない: true  ✅
  next_call_dateが今日以前: false  ❌ ← これが原因
  → 「当日TEL」に該当: false
```

### 2. 根本原因

**買主4998の次電日は「2026-04-06」（明日）であり、「今日以前」の条件を満たしていない**

「当日TEL」の条件（`.kiro/steering/buyer-sidebar-status-definition.md`より）:
- `follow_up_assignee`（後続担当）が**空** ✅
- `next_call_date`（★次電日）が**空でない** ✅
- `next_call_date`（★次電日）が**今日以前** ❌ ← 明日なので該当しない

**結論**: 買主4998は明日（2026年4月6日）になれば「当日TEL」に表示されます。

---

## 🚨 発見された別の重大な問題

### キャッシュ無効化が実装されていない

**問題**: `invalidateBuyerStatusCache()`関数は定義されているが、**どこからも呼び出されていない**

**影響**:
- サイドバーカウントは30分間キャッシュされる（`_moduleLevelStatusCache`のTTL）
- 買主データを更新しても、最大30分間は古いカウントが表示される可能性がある

**確認結果**:
```bash
# backend/src/services/BuyerService.ts
export function invalidateBuyerStatusCache(): void {
  _moduleLevelStatusCache = null;
  console.log('[BuyerService] Buyer status cache invalidated');
}
# ↑ 定義されているが、呼び出し箇所が存在しない

# backend/src/routes/buyers.ts
# ↑ PUT /buyers/:id エンドポイントでも呼び出されていない
```

---

## 📋 推奨される修正

### 修正1: キャッシュ無効化を追加（最優先）

**ファイル**: `backend/src/routes/buyers.ts`

**修正箇所**: PUT `/buyers/:id` エンドポイント（lines 238-270）

**修正内容**:
```typescript
import { invalidateBuyerStatusCache } from '../services/BuyerService';

// ... 既存のコード ...

// デフォルト：即時同期を使用（sync=true または sync未指定）
console.log('[PUT /buyers/:id] Using updateWithSync (default or sync=true)');
const result = await buyerService.updateWithSync(
  buyerNumber,
  sanitizedData,
  userId,
  userEmail,
  { force: force === 'true' }
);

// 🆕 キャッシュを無効化（サイドバーカウントを即座に更新）
invalidateBuyerStatusCache();
console.log('[PUT /buyers/:id] Buyer status cache invalidated');

// 競合がある場合は409を返す
if (result.syncResult.conflict && result.syncResult.conflict.length > 0) {
  return res.status(409).json({
    error: 'Conflict detected',
    buyer: result.buyer,
    syncStatus: result.syncResult.syncStatus,
    conflicts: result.syncResult.conflict
  });
}
```

**理由**: 
- 買主データ更新後、サイドバーカウントのキャッシュを即座に無効化する
- これにより、次回のサイドバーカウント取得時に最新のデータで再計算される
- 30分待たずに即座にサイドバーが更新される

---

### 修正2: `update()`メソッドでもキャッシュ無効化（推奨）

**ファイル**: `backend/src/services/BuyerService.ts`

**修正箇所**: `update()`メソッド（lines 700-850付近）

**修正内容**:
```typescript
async update(
  id: string,
  updateData: Partial<any>,
  userId?: string,
  userEmail?: string
): Promise<any> {
  // ... 既存の更新処理 ...
  
  // DB更新
  const { data, error } = await this.supabase
    .from('buyers')
    .update(allowedData)
    .eq('buyer_number', buyerNumber)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to update buyer: ${error.message}`);
  }

  // 🆕 キャッシュを無効化
  invalidateBuyerStatusCache();
  console.log('[BuyerService.update] Buyer status cache invalidated');

  // ... 監査ログ等の既存処理 ...
  
  return data;
}
```

---

## 🎯 まとめ

### 買主4998について
- ✅ **問題なし**: 次電日が明日（2026-04-06）のため、今日は「当日TEL」に該当しない
- ✅ **明日になれば自動的に表示される**

### キャッシュ無効化について
- ❌ **重大な問題**: キャッシュ無効化が実装されていない
- ⚠️ **影響**: 買主データ更新後、最大30分間は古いサイドバーカウントが表示される可能性
- ✅ **修正必要**: `invalidateBuyerStatusCache()`を`PUT /buyers/:id`エンドポイントと`update()`メソッドで呼び出す

---

## 📝 次のステップ

1. **キャッシュ無効化を実装**（最優先）
   - `backend/src/routes/buyers.ts`の`PUT /buyers/:id`エンドポイントに追加
   - `backend/src/services/BuyerService.ts`の`update()`メソッドに追加

2. **デプロイ**
   - 修正をコミット＆プッシュ
   - Vercelで自動デプロイ

3. **テスト**
   - 買主データを更新
   - サイドバーが即座に更新されることを確認（ページリロード不要）

4. **買主4998の確認**
   - 明日（2026年4月6日）になったら、「当日TEL」に表示されることを確認

---

**作成日**: 2026年4月5日  
**調査者**: Kiro AI  
**関連ファイル**: 
- `backend/src/services/BuyerService.ts` (invalidateBuyerStatusCache関数、update()メソッド)
- `backend/src/routes/buyers.ts` (PUT /buyers/:id エンドポイント)
- `.kiro/steering/buyer-sidebar-status-definition.md` (「当日TEL」の条件定義)
- `.kiro/steering/cache-invalidation-checklist.md` (キャッシュ無効化のチェックリスト)
