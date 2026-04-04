# 買主リストサイドバー表示速度改善 - 技術設計書

## Overview

買主リストページのサイドバーカテゴリー表示に時間がかかっている問題を解決します。売主リストで成功した「GAS事前計算 + 高速エンドポイント + 並列取得」のアーキテクチャをそのままコピーして適用します。

**目標**: サイドバーの初回表示を1秒以内に完了させる

**アプローチ**: 売主リストの成功パターンを100%踏襲（新しい実装は一切行わない）

---

## Architecture

### 現状の問題

```
フロントエンド起動
  ↓
/api/buyers/sidebar-counts を呼び出し（並列）
  ↓
buyer_sidebar_counts テーブルから取得（高速）
  ↓
/api/buyers/status-categories-with-buyers を呼び出し（並列）
  ↓
全買主データを取得（遅い：数千件）
  ↓
サイドバー表示完了（遅い）
```

**問題点**:
- 全買主データの取得を待ってからサイドバーを表示
- 初回ロードに時間がかかる

### 改善後のアーキテクチャ（売主リストと同じ）

```
フロントエンド起動
  ↓
/api/buyers/sidebar-counts を呼び出し（並列）
  ↓
buyer_sidebar_counts テーブルから取得（高速：1秒以内）
  ↓
サイドバー表示完了 ✅（プログレッシブローディング）
  ↓
バックグラウンドで全買主データを取得（非同期）
  ↓
カテゴリー展開時に詳細データを表示
```

**改善点**:
- サイドバーカウントを先に表示（プログレッシブローディング）
- 全買主データの取得を待たない
- 初回ロードが1秒以内に完了

---

## Components and Interfaces

### 1. GASコード（既存・変更なし）

**ファイル**: `gas_buyer_complete_code.js`

**関数**: `updateBuyerSidebarCounts_()`（既に実装済み）

**実行タイミング**: 10分ごと（GASトリガー）

**処理内容**:
1. 全買主データを読み取り
2. 各カテゴリーの件数を計算
3. `buyer_sidebar_counts`テーブルに保存

**🚨 重要**: このファイルは絶対に変更しない

---

### 2. バックエンドAPI（新規エンドポイント追加のみ）

#### 2.1 既存エンドポイント（変更なし）

**エンドポイント**: `/api/buyers/sidebar-counts`

**実装**: `backend/src/routes/buyers.ts`（既に実装済み）

**処理内容**:
```typescript
router.get('/sidebar-counts', async (_req: Request, res: Response) => {
  try {
    const result = await buyerService.getSidebarCounts();
    res.json(result);
  } catch (error: any) {
    console.error('Get sidebar counts error:', error);
    res.status(500).json({
      error: {
        code: 'SIDEBAR_COUNTS_ERROR',
        message: 'Failed to get sidebar counts',
        retryable: true,
      },
    });
  }
});
```

**レスポンス形式**:
```json
{
  "categoryCounts": {
    "viewingDayBefore": 2,
    "todayCall": 5,
    "todayCallAssigned": { "Y": 3, "I": 2 },
    "assigned": { "Y": 150, "I": 200 }
  },
  "normalStaffInitials": ["Y", "I", "外す"]
}
```

**🚨 重要**: このエンドポイントは既に実装済み・変更不要

#### 2.2 BuyerService.getSidebarCounts()（既存・変更なし）

**ファイル**: `backend/src/services/BuyerService.ts`

**メソッド**: `getSidebarCounts()`（既に実装済み）

**処理フロー**:
1. `buyer_sidebar_counts`テーブルから取得
2. テーブルが空の場合は`getSidebarCountsFallback()`にフォールバック
3. カテゴリーカウントと担当者イニシャルを返す

**🚨 重要**: このメソッドは既に実装済み・変更不要

---

### 3. フロントエンド（並列取得の最適化のみ）

#### 3.1 BuyersPage.tsx（最小限の変更）

**ファイル**: `frontend/src/pages/BuyersPage.tsx`

**変更内容**: 売主リストの並列取得ロジックをコピー

**売主リストの成功パターン**（`SellersPage.tsx`から）:
```typescript
useEffect(() => {
  let cancelled = false;

  const fetchSellers = async () => {
    try {
      // サイドバーデータ読み込み済みの場合はフロント側でフィルタリング（APIコール不要）
      if (sidebarLoadedRef.current && allSellersWithStatusRef.current.length > 0) {
        // フィルタリング処理
        // ...
        return;
      }

      // サイドバー未ロード時: まず最初の50件を即座に表示（プログレッシブローディング）
      setLoading(true);
      const quickParams: any = {
        page: 1,
        limit: 50,
        sortBy: 'inquiry_date',
        sortOrder: 'desc',
      };
      if (debouncedSearch) quickParams.search = normalizeSearch(debouncedSearch);

      // 最初の50件を即座に表示
      const quickRes = await api.get('/api/sellers', { params: quickParams });
      if (!cancelled) {
        setSellers(quickRes.data.data || []);
        setTotal(quickRes.data.total || 0);
        setLoading(false);
      }

      // バックグラウンドでサイドバーカウントと全件データを並列取得
      if (!sidebarLoadedRef.current) {
        Promise.all([
          api.get('/api/sellers/sidebar-counts'),
          api.get('/api/sellers/status-categories-with-sellers')
        ]).then(([sidebarRes, sellersRes]) => {
          if (cancelled) return;
          const sidebarResult = sidebarRes.data;
          const sellersResult = sellersRes.data;
          
          // キャッシュデータを構築
          const cacheData = {
            categoryCounts: sidebarResult.categoryCounts,
            sellers: sellersResult.sellers,
            normalStaffInitials: sidebarResult.normalStaffInitials || sellersResult.normalStaffInitials || []
          };
          
          // 10分間キャッシュ
          pageDataCache.set(CACHE_KEYS.SELLERS_WITH_STATUS, cacheData, 10 * 60 * 1000);
          
          // サイドバーのカウントを更新
          setSidebarCounts(sidebarResult.categoryCounts);
          setSidebarNormalStaffInitials(sidebarResult.normalStaffInitials || sellersResult.normalStaffInitials || []);
          setSidebarLoading(false);
          
          // テーブルも全件データで更新
          allSellersWithStatusRef.current = sellersResult.sellers;
          sidebarLoadedRef.current = true;
          setDataReady(prev => !prev);
        }).catch((err) => {
          console.error('Background fetch failed:', err);
          setSidebarLoading(false);
        });
      }
    } catch (error) {
      if (!cancelled) {
        console.error('Failed to fetch sellers:', error);
      }
    } finally {
      if (!cancelled) {
        setLoading(false);
      }
    }
  };

  fetchSellers();
  return () => { cancelled = true; };
}, [page, rowsPerPage, debouncedSearch, selectedCalculatedStatus, refetchTrigger, dataReady]);
```

**買主リストへの適用**:
1. 上記のコードを`BuyersPage.tsx`にコピー
2. `sellers` → `buyers`に置換
3. `CACHE_KEYS.SELLERS_WITH_STATUS` → `CACHE_KEYS.BUYERS_WITH_STATUS`に置換
4. エンドポイントを`/api/sellers/*` → `/api/buyers/*`に置換

**🚨 重要**: 売主リストのコードをそのままコピーして、変数名とエンドポイントだけ変更する

---

## Data Models

### buyer_sidebar_counts テーブル（既存・変更なし）

**テーブル名**: `buyer_sidebar_counts`

**カラム**:
- `category` (TEXT): カテゴリーキー（例: `viewingDayBefore`, `todayCall`）
- `count` (INTEGER): カウント数
- `label` (TEXT): ラベル（例: `Y`, `I`）
- `assignee` (TEXT): 担当者イニシャル（担当別カテゴリー用）
- `updated_at` (TIMESTAMP): 更新日時

**データ例**:
```sql
INSERT INTO buyer_sidebar_counts (category, count, label, assignee, updated_at) VALUES
('viewingDayBefore', 2, NULL, NULL, NOW()),
('todayCall', 5, NULL, NULL, NOW()),
('todayCallAssigned', 3, NULL, 'Y', NOW()),
('todayCallAssigned', 2, NULL, 'I', NOW()),
('assigned', 150, NULL, 'Y', NOW()),
('assigned', 200, NULL, 'I', NOW());
```

**🚨 重要**: このテーブルは既に存在・変更不要

---

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system-essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: サイドバーカウント取得速度

*For any* 買主リストページの初回ロード時、サイドバーカウントの取得は1秒以内に完了すること

**Validates: Requirements 1.1, 1.2, 1.3**

### Property 2: GAS事前計算の正確性

*For any* GASの10分トリガー実行時、`buyer_sidebar_counts`テーブルに保存されるカウントは、全買主データから計算した結果と一致すること

**Validates: Requirements 2.1, 2.2, 2.3**

### Property 3: フォールバック処理の正確性

*For any* `buyer_sidebar_counts`テーブルが空の場合、フォールバック処理として全買主データから計算したカウントを返すこと

**Validates: Requirements 4.4, 7.1**

### Property 4: 並列取得の独立性

*For any* サイドバーカウント取得と全買主データ取得は並列実行され、サイドバーカウントの取得完了を待たずに全買主データの取得が開始されること

**Validates: Requirements 4.1, 4.2**

### Property 5: キャッシュの有効期限

*For any* サイドバーカウントのキャッシュは10分間有効であり、10分経過後は再取得されること

**Validates: Requirements 5.1, 5.2, 5.3**

---

## Error Handling

### エラーケース1: buyer_sidebar_countsテーブルが空

**対応**: `getSidebarCountsFallback()`にフォールバック

**実装**（既存）:
```typescript
async getSidebarCounts(): Promise<{
  categoryCounts: any;
  normalStaffInitials: string[];
}> {
  try {
    const { data, error } = await this.supabase
      .from('buyer_sidebar_counts')
      .select('*');
    
    if (error || !data || data.length === 0) {
      console.log('⚠️ buyer_sidebar_counts empty or error, falling back to DB query');
      return this.getSidebarCountsFallback();
    }
    
    // カウントを集計
    // ...
  } catch (e) {
    console.error('❌ getSidebarCounts error, falling back:', e);
    return this.getSidebarCountsFallback();
  }
}
```

### エラーケース2: APIエラー

**対応**: カウントを0にリセット

**実装**（フロントエンド）:
```typescript
try {
  const response = await api.get('/api/buyers/sidebar-counts');
  setSidebarCounts(response.data.categoryCounts);
} catch (error) {
  console.error('Failed to fetch sidebar counts:', error);
  setSidebarCounts({
    viewingDayBefore: 0,
    todayCall: 0,
    todayCallAssigned: {},
    assigned: {},
  });
}
```

### エラーケース3: GAS実行エラー

**対応**: 次回の10分トリガーで再実行

**実装**: GASのトリガーが自動的に継続実行

---

## Testing Strategy

### Unit Tests

**テスト対象**:
- `BuyerService.getSidebarCounts()` - buyer_sidebar_countsテーブルからの取得
- `BuyerService.getSidebarCountsFallback()` - フォールバック処理

**テストケース**:
1. buyer_sidebar_countsテーブルが空の場合、フォールバックが呼ばれること
2. buyer_sidebar_countsテーブルにデータがある場合、正しくカウントが返されること
3. APIエラー時にフォールバックが呼ばれること

### Property Tests

**テスト対象**:
- サイドバーカウント取得速度（1秒以内）
- GAS事前計算の正確性（全買主データとの一致）

**テストケース**:
1. *For any* 買主リストページの初回ロード時、サイドバーカウントの取得は1秒以内に完了すること
2. *For any* GASの10分トリガー実行時、`buyer_sidebar_counts`テーブルに保存されるカウントは、全買主データから計算した結果と一致すること

**Property Test Configuration**:
- Minimum 100 iterations per property test
- Tag format: **Feature: buyer-sidebar-performance-improvement, Property {number}: {property_text}**

### Integration Tests

**テスト対象**:
- フロントエンドの並列取得ロジック
- サイドバーカウントとテーブルデータの整合性

**テストケース**:
1. サイドバーカウントが先に表示されること
2. 全買主データの取得完了後、カテゴリー展開時に詳細データが表示されること
3. キャッシュが有効な場合、2回目以降のアクセスが高速であること

---

## 実装手順

### ステップ1: GASコードの確認（変更なし）

**確認事項**:
- [ ] `gas_buyer_complete_code.js`に`updateBuyerSidebarCounts_()`関数が存在するか
- [ ] GASの10分トリガーが設定されているか
- [ ] `buyer_sidebar_counts`テーブルにデータが保存されているか

**🚨 重要**: GASコードは絶対に変更しない

### ステップ2: バックエンドAPIの確認（変更なし）

**確認事項**:
- [ ] `/api/buyers/sidebar-counts`エンドポイントが存在するか
- [ ] `BuyerService.getSidebarCounts()`メソッドが実装されているか
- [ ] `BuyerService.getSidebarCountsFallback()`メソッドが実装されているか

**🚨 重要**: バックエンドAPIは既に実装済み・変更不要

### ステップ3: フロントエンドの並列取得ロジックを実装

**ファイル**: `frontend/src/pages/BuyersPage.tsx`

**実装内容**:
1. `SellersPage.tsx`の並列取得ロジックをコピー
2. 変数名を`sellers` → `buyers`に置換
3. エンドポイントを`/api/sellers/*` → `/api/buyers/*`に置換
4. キャッシュキーを`CACHE_KEYS.SELLERS_WITH_STATUS` → `CACHE_KEYS.BUYERS_WITH_STATUS`に置換

**🚨 重要**: 売主リストのコードをそのままコピーして、変数名とエンドポイントだけ変更する

### ステップ4: テスト

**テスト手順**:
1. ローカル環境で買主リストページを開く
2. サイドバーカウントが1秒以内に表示されることを確認
3. バックグラウンドで全買主データが取得されることを確認（DevToolsのNetworkタブ）
4. カテゴリー展開時に詳細データが表示されることを確認

### ステップ5: デプロイ

**デプロイ手順**:
```bash
git add .
git commit -m "feat: 買主リストサイドバー表示速度改善（売主リストの成功パターンを適用）"
git push origin main
```

---

## パフォーマンス要件

### 目標

| 項目 | 目標値 | 現状 |
|------|--------|------|
| サイドバーカウント取得 | 1秒以内 | 数秒 |
| 初回ロード完了 | 1秒以内 | 数秒 |
| 2回目以降のアクセス | 即座（キャッシュ） | 数秒 |

### キャッシュ戦略

| キャッシュ | TTL | 無効化タイミング |
|-----------|-----|----------------|
| サイドバーカウント | 10分 | 買主データ更新時 |
| 全買主データ | 10分 | 買主データ更新時 |

---

## 制約条件

### 🚨 最重要：既存機能の完全保護

1. **GASコードは絶対に変更しない**
   - `gas_buyer_complete_code.js`は一切触らない
   - 既に動作している同期処理を壊さない
   - `updateBuyerSidebarCounts_()`関数は既に実装済み

2. **サイドバーロジックは絶対に変更しない**
   - `BuyerStatusSidebar.tsx`のフィルタリングロジックを変更しない
   - カテゴリー定義（`buyer-sidebar-status-definition.md`）を変更しない
   - 既存のカテゴリーキー（`viewingDayBefore`, `todayCall`等）を変更しない

3. **買主データ取得ロジックは変更しない**
   - `/api/buyers`エンドポイントは変更しない
   - `/api/buyers/status-categories-with-buyers`エンドポイントは変更しない
   - 既存のフィルタリング・ソート処理を変更しない

4. **最小限の変更のみ**
   - 表示速度の改善のみに集中
   - 新規エンドポイント追加なし（既に実装済み）
   - フロントエンドは並列取得の最適化のみ

5. **売主リストと同じアーキテクチャを踏襲**
   - 実績のある方式を採用
   - 売主リストの成功パターンをコピー
   - 新しい実装は避ける

---

## 期待される改善

- サイドバーの初回表示が即座に完了（1秒以内）
- GASが10分ごとにサイドバーカウントを更新
- フロントエンドはテーブルから高速取得
- 2回目以降のアクセスはキャッシュから即座に表示

---

**最終更新日**: 2026年4月5日  
**作成理由**: 買主リストサイドバーの表示速度を改善し、売主リストと同じ高速表示を実現するため
