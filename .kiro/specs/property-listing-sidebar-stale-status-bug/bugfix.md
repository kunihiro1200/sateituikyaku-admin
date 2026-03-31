# バグ条件定義：物件リストサイドバーの古いステータス表示バグ

## バグの概要

物件リストのサイドバーで「レインズ登録＋SUUMO登録」カテゴリーに、条件に合致しない物件が表示されている。

## 影響を受けるユーザー

- 物件リスト管理者
- 物件担当者

## バグ条件 C(X)

**入力 X**:
- `property_number`: 物件番号（例: AA12497, AA12459）
- `atbb_status`: ATBB状況（例: 専任・公開中）
- `suumo_url`: SUUMO URL（例: https://suumo.jp/...）
- `suumo_registered`: SUUMO登録状況（例: 要）
- `sidebar_status`: サイドバーステータス（例: レインズ登録＋SUUMO登録）
- `publish_scheduled_date`: 公開予定日（work_tasksテーブル）

**バグ条件**:
```
C(X) = (sidebar_status === 'レインズ登録＋SUUMO登録') 
       AND (suumo_url !== null AND suumo_url !== '')
```

**説明**:
- `sidebar_status`が「レインズ登録＋SUUMO登録」に設定されている
- しかし、`suumo_url`が既に登録されている（空ではない）
- 本来、SUUMO URLが登録されたら、このカテゴリーから除外されるべき

## 正しい動作

**「レインズ登録＋SUUMO登録」カテゴリーの条件**:
1. `atbb_status` === '専任・公開中'
2. 公開予定日が昨日以前
3. **`suumo_url`が空**（最重要）
4. `suumo_registered` !== 'S不要'

**期待される動作**:
- SUUMO URLが登録されたら、自動的に`sidebar_status`が更新される
- 条件に合致しない物件は、このカテゴリーに表示されない

## 実際の動作（バグ）

**AA12497の例**:
- `atbb_status`: 専任・公開中 ✅
- `publish_scheduled_date`: 2026-03-30（昨日以前） ✅
- `suumo_url`: https://suumo.jp/chukoikkodate/oita/sc_oita/nc_20541403/ ❌（空ではない）
- `suumo_registered`: 要 ✅
- `sidebar_status`: レインズ登録＋SUUMO登録 ⚠️（古い値のまま）

**結果**: 条件3が不合格なのに、「レインズ登録＋SUUMO登録」カテゴリーに表示される

## 根本原因

**問題の流れ**:
1. 過去にSUUMO URLが空だった時点で、`sidebar_status`が「レインズ登録＋SUUMO登録」に設定された
2. その後、SUUMO URLが登録された（スプレッドシートまたはブラウザで）
3. しかし、`sidebar_status`が更新されず、古い値のまま残っている
4. フロントエンドは`sidebar_status`を信頼して表示している

**技術的な原因**:
- `PropertyListingSyncService.calculateSidebarStatus()`が、SUUMO URLの変更を検知していない
- または、同期処理が`sidebar_status`を再計算していない

## 再現手順

1. 物件リストページを開く
2. サイドバーの「レインズ登録＋SUUMO登録」カテゴリーをクリック
3. AA12497とAA12459が表示される
4. AA12497の詳細を確認すると、SUUMO URLが既に登録されている
5. しかし、「レインズ登録＋SUUMO登録」カテゴリーに表示されたまま

## 影響範囲

**影響を受けるテーブル**:
- `property_listings`テーブルの`sidebar_status`カラム

**影響を受けるページ**:
- 物件リストページ（`/property-listings`）
- 物件リストサイドバー（`PropertySidebarStatus`コンポーネント）

**影響を受けるユーザー**:
- 物件リスト管理者（誤った物件が表示される）
- 物件担当者（SUUMO URL登録済みの物件が未登録として表示される）

## 修正方針

**方針**: バックエンドの同期処理で`sidebar_status`を常に再計算する

**修正箇所**:
1. `PropertyListingSyncService.calculateSidebarStatus()`を修正
   - SUUMO URLが登録されたら、「レインズ登録＋SUUMO登録」から除外
   - 条件を厳密にチェックする

2. 同期処理を修正
   - スプレッドシート→データベース同期時に、`sidebar_status`を再計算
   - SUUMO URLの変更を検知して、`sidebar_status`を更新

3. 既存データの修正
   - AA12497とAA12459の`sidebar_status`を正しい値に更新
   - 他の物件も同様の問題がないか確認

## テストケース

### 探索テスト（Bug Exploration Test）

**目的**: バグ条件C(X)を満たす物件が存在することを確認

**テストケース**:
```typescript
test('AA12497とAA12459が「レインズ登録＋SUUMO登録」カテゴリーに誤って表示される', async () => {
  const propertyNumbers = ['AA12497', 'AA12459'];
  
  for (const propertyNumber of propertyNumbers) {
    const listing = await getPropertyListing(propertyNumber);
    
    // バグ条件C(X)を確認
    expect(listing.sidebar_status).toBe('レインズ登録＋SUUMO登録');
    expect(listing.suumo_url).not.toBeNull();
    expect(listing.suumo_url).not.toBe('');
    
    // 正しい条件をチェック
    const shouldBeInCategory = (
      listing.atbb_status === '専任・公開中' &&
      isPubDateBeforeYesterday(listing) &&
      !listing.suumo_url &&  // ← この条件が不合格
      listing.suumo_registered !== 'S不要'
    );
    
    expect(shouldBeInCategory).toBe(false);
  }
});
```

### 保存テスト（Preservation Test）

**目的**: 修正後も、正しく「レインズ登録＋SUUMO登録」カテゴリーに含まれるべき物件は含まれることを確認

**テストケース**:
```typescript
test('SUUMO URLが空の物件は「レインズ登録＋SUUMO登録」カテゴリーに含まれる', async () => {
  // SUUMO URLが空の物件を作成
  const listing = {
    property_number: 'TEST001',
    atbb_status: '専任・公開中',
    suumo_url: null,
    suumo_registered: '要',
    publish_scheduled_date: '2026-03-29', // 昨日
  };
  
  const status = calculateSidebarStatus(listing);
  expect(status).toBe('レインズ登録＋SUUMO登録');
});

test('SUUMO URLが登録された物件は「レインズ登録＋SUUMO登録」カテゴリーから除外される', async () => {
  // SUUMO URLが登録された物件
  const listing = {
    property_number: 'TEST002',
    atbb_status: '専任・公開中',
    suumo_url: 'https://suumo.jp/...',
    suumo_registered: '要',
    publish_scheduled_date: '2026-03-29', // 昨日
  };
  
  const status = calculateSidebarStatus(listing);
  expect(status).not.toBe('レインズ登録＋SUUMO登録');
});
```

## 成功基準

**修正が成功したと判断する基準**:

1. **探索テストが失敗する**（バグが修正された）
   - AA12497とAA12459が「レインズ登録＋SUUMO登録」カテゴリーに表示されない

2. **保存テストが成功する**（正しい動作が保たれている）
   - SUUMO URLが空の物件は、引き続き「レインズ登録＋SUUMO登録」カテゴリーに表示される
   - SUUMO URLが登録された物件は、カテゴリーから除外される

3. **サイドバーのカウントが正しい**
   - 「レインズ登録＋SUUMO登録」カテゴリーのカウントが0件になる（現在は2件）

## 関連ファイル

**バックエンド**:
- `backend/src/services/PropertyListingSyncService.ts` - 同期サービス（修正対象）
- `backend/src/services/PropertyListingSpreadsheetSync.ts` - スプレッドシート同期

**フロントエンド**:
- `frontend/frontend/src/components/PropertySidebarStatus.tsx` - サイドバーコンポーネント
- `frontend/frontend/src/utils/propertyListingStatusUtils.ts` - ステータス計算ユーティリティ

**データベース**:
- `property_listings`テーブル - `sidebar_status`カラム
- `work_tasks`テーブル - `publish_scheduled_date`カラム

## 参考情報

**調査スクリプト**:
- `backend/check-property-listing-sidebar-bug.ts` - バグ調査スクリプト

**実行結果**:
```
AA12497:
  atbb_status: 専任・公開中 ✅
  suumo_url: https://suumo.jp/... ❌（空ではない）
  sidebar_status: レインズ登録＋SUUMO登録 ⚠️
  → 条件に合致しないのに表示されている

AA12459:
  atbb_status: 専任・公開中 ✅
  suumo_url: https://suumo.jp/... ❌（空ではない）
  sidebar_status: レインズ登録＋SUUMO登録 ⚠️
  → 条件に合致しないのに表示されている
```
