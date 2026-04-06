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
Promise.all([
  /api/buyers/sidebar-counts,
  /api/buyers/status-categories-with-buyers
]) ← 並列実行
  ↓
buyer_sidebar_counts テーブルから取得（高速：1秒以内）
  ↓
サイドバー表示完了 ✅（プログレッシブローディング）
  ↓
全買主データ取得完了（並列実行中）
  ↓
カテゴリー展開時に詳細データを表示
```

**改善点**:
- サイドバーカウントと全買主データを並列取得（要件1.2）
- サイドバーカウントが先に完了するため、即座に表示（プログレッシブローディング）
- 全買主データの取得完了を待たずにサイドバー表示
- 初回ロードが5秒以内に完了（目標）

### キャッシュ戦略

**キャッシュ対象**:
- サイドバーカウント（`buyer_sidebar_counts`テーブル）
- 全買主データ（フロントエンドメモリキャッシュ）

**キャッシュTTL**: 10分間

**キャッシュ無効化**:
- 買主データ更新時（POST/PUT/DELETE）に自動無効化
- GASが10分ごとに`buyer_sidebar_counts`テーブルを更新

**バックグラウンド再計算**:
- キャッシュ期限切れ時、バックグラウンドでGASが再計算
- フロントエンドは古いキャッシュを表示しながら、新しいデータを取得

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

#### 3.1 BuyersPage.tsx（並列取得とプログレッシブローディング）

**ファイル**: `frontend/src/pages/BuyersPage.tsx`

**変更内容**: 売主リストの並列取得ロジックをコピー

**プログレッシブローディングの実装**:
1. 「読み込み中」インジケーターを表示（要件3.1）
2. サイドバーカウントが完了したカテゴリから順次表示（要件3.2）
3. 5秒超過時にタイムアウトエラーを表示（要件3.4）

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

## Database Query Optimization

### 最適化1: 必要最小限のカラムのみSELECT（要件4.1）

**現状**:
```typescript
// ❌ 全カラムを取得（遅い）
const { data } = await supabase.from('buyers').select('*');
```

**改善後**:
```typescript
// ✅ 必要なカラムのみ取得（高速）
const { data } = await supabase
  .from('buyers')
  .select('buyer_number, calculated_status, assignee, viewing_date, next_call_date, deleted_at');
```

### 最適化2: deleted_at IS NULL条件のインデックス化（要件4.2）

**インデックス作成**:
```sql
CREATE INDEX idx_buyers_deleted_at ON buyers(deleted_at) WHERE deleted_at IS NULL;
```

**クエリ**:
```typescript
const { data } = await supabase
  .from('buyers')
  .select('buyer_number, calculated_status, assignee')
  .is('deleted_at', null);  // インデックスを使用
```

### 最適化3: 1回のクエリで全カテゴリカウント取得（要件4.3）

**現状**:
```typescript
// ❌ カテゴリーごとに個別クエリ（遅い）
const viewingDayBefore = await supabase.from('buyers').select('*').eq('calculated_status', 'viewingDayBefore');
const todayCall = await supabase.from('buyers').select('*').eq('calculated_status', 'todayCall');
```

**改善後**:
```typescript
// ✅ 1回のクエリで全カテゴリカウント取得（高速）
const { data } = await supabase
  .from('buyer_sidebar_counts')
  .select('*');  // 全カテゴリのカウントを一度に取得
```

### 最適化4: 接続プールの使用（要件4.4）

**Supabaseクライアントの設定**:
```typescript
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    db: {
      schema: 'public',
    },
    auth: {
      persistSession: false,
    },
    global: {
      headers: {
        'x-connection-pool': 'true',  // 接続プールを有効化
      },
    },
  }
);
```

---

## Performance Monitoring and Logging

### ログ戦略

**ログレベル**:
- `INFO`: 正常な処理時間
- `WARN`: 5秒超過時の警告
- `ERROR`: エラー発生時

### ログ実装（要件5）

**バックエンド（BuyerService.ts）**:
```typescript
async getSidebarCounts(): Promise<{
  categoryCounts: any;
  normalStaffInitials: string[];
}> {
  const startTime = Date.now();  // 処理開始時刻
  
  try {
    const { data, error } = await this.supabase
      .from('buyer_sidebar_counts')
      .select('*');
    
    const duration = Date.now() - startTime;  // 処理時間
    
    // 要件5.1: 処理時間をログに記録
    console.log(`[INFO] getSidebarCounts completed in ${duration}ms`);
    
    // 要件5.2: 5秒超過時の警告ログ
    if (duration > 5000) {
      console.warn(`[WARN] getSidebarCounts took ${duration}ms (> 5000ms)`);
    }
    
    if (error || !data || data.length === 0) {
      console.log('⚠️ buyer_sidebar_counts empty or error, falling back to DB query');
      return this.getSidebarCountsFallback();
    }
    
    // カウントを集計
    // ...
  } catch (e) {
    // 要件5.3: エラー内容とスタックトレースをログに記録
    console.error('[ERROR] getSidebarCounts error:', e);
    console.error('[ERROR] Stack trace:', (e as Error).stack);
    return this.getSidebarCountsFallback();
  }
}
```

**フロントエンド（BuyersPage.tsx）**:
```typescript
useEffect(() => {
  const fetchData = async () => {
    const startTime = Date.now();
    
    try {
      // 要件5.4: 各処理ステップの所要時間を記録
      const sidebarStart = Date.now();
      const sidebarRes = await api.get('/api/buyers/sidebar-counts');
      const sidebarDuration = Date.now() - sidebarStart;
      console.log(`[INFO] Sidebar counts fetched in ${sidebarDuration}ms`);
      
      const buyersStart = Date.now();
      const buyersRes = await api.get('/api/buyers/status-categories-with-buyers');
      const buyersDuration = Date.now() - buyersStart;
      console.log(`[INFO] Buyers data fetched in ${buyersDuration}ms`);
      
      const totalDuration = Date.now() - startTime;
      console.log(`[INFO] Total fetch time: ${totalDuration}ms`);
      
      // 要件5.2: 5秒超過時の警告ログ
      if (totalDuration > 5000) {
        console.warn(`[WARN] Total fetch time ${totalDuration}ms (> 5000ms)`);
      }
    } catch (error) {
      // 要件5.3: エラー内容とスタックトレースをログに記録
      console.error('[ERROR] Failed to fetch data:', error);
      console.error('[ERROR] Stack trace:', (error as Error).stack);
    }
  };
  
  fetchData();
}, []);
```

---

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system-essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: サイドバーカウント取得速度

*For any* 買主リストページの初回ロード時、サイドバーカウントの取得は5秒以内に完了すること

**Validates: Requirements 1.1, 3.4**

### Property 2: 並列取得の独立性

*For any* サイドバーカウント取得と全買主データ取得は並列実行され、サイドバーカウントの取得完了を待たずに全買主データの取得が開始されること

**Validates: Requirements 1.2, 4.1**

### Property 3: GAS事前計算の正確性

*For any* GASの10分トリガー実行時、`buyer_sidebar_counts`テーブルに保存されるカウントは、全買主データから計算した結果と一致すること

**Validates: Requirements 2.1, 2.2**

### Property 4: キャッシュの有効期限と無効化

*For any* サイドバーカウントのキャッシュは10分間有効であり、買主データ更新時に自動的に無効化されること

**Validates: Requirements 2.1, 2.2, 2.3**

### Property 5: フォールバック処理の正確性

*For any* `buyer_sidebar_counts`テーブルが空の場合、フォールバック処理として全買主データから計算したカウントを返すこと

**Validates: Requirements 2.4, 4.4**

### Property 6: APIレスポンス形式の後方互換性

*For any* サイドバーカウントAPIのレスポンス形式は、既存のフロントエンドコードと互換性を保つこと（`categoryCounts`と`normalStaffInitials`フィールドを含む）

**Validates: Requirements 6.1**

### Property 7: ステータス計算ロジックの一貫性

*For any* 買主データに対して、GASで計算されたステータスとバックエンドで計算されたステータスは一致すること

**Validates: Requirements 6.3**

### Property 8: データベースクエリの最適化

*For any* 買主データ取得クエリは、ステータス計算に必要な最小限のカラムのみをSELECTし、`deleted_at IS NULL`条件をインデックスで高速化すること

**Validates: Requirements 4.1, 4.2**

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
- データベースクエリの最適化（必要最小限のカラムのみSELECT）

**テストケース**:
1. buyer_sidebar_countsテーブルが空の場合、フォールバックが呼ばれること
2. buyer_sidebar_countsテーブルにデータがある場合、正しくカウントが返されること
3. APIエラー時にフォールバックが呼ばれること
4. レスポンス形式が既存のフロントエンドと互換性があること（`categoryCounts`と`normalStaffInitials`フィールド）
5. 処理時間が5秒を超えた場合、警告ログが出力されること

### Property Tests

**テスト対象**:
- サイドバーカウント取得速度（5秒以内）
- GAS事前計算の正確性（全買主データとの一致）
- 並列取得の独立性
- キャッシュの有効期限と無効化
- ステータス計算ロジックの一貫性

**テストケース**:
1. *For any* 買主リストページの初回ロード時、サイドバーカウントの取得は5秒以内に完了すること（Property 1）
2. *For any* サイドバーカウント取得と全買主データ取得は並列実行されること（Property 2）
3. *For any* GASの10分トリガー実行時、`buyer_sidebar_counts`テーブルに保存されるカウントは、全買主データから計算した結果と一致すること（Property 3）
4. *For any* サイドバーカウントのキャッシュは10分間有効であり、買主データ更新時に自動的に無効化されること（Property 4）
5. *For any* `buyer_sidebar_counts`テーブルが空の場合、フォールバック処理として全買主データから計算したカウントを返すこと（Property 5）
6. *For any* サイドバーカウントAPIのレスポンス形式は、既存のフロントエンドコードと互換性を保つこと（Property 6）
7. *For any* 買主データに対して、GASで計算されたステータスとバックエンドで計算されたステータスは一致すること（Property 7）
8. *For any* 買主データ取得クエリは、ステータス計算に必要な最小限のカラムのみをSELECTすること（Property 8）

**Property Test Configuration**:
- Minimum 100 iterations per property test
- Tag format: **Feature: buyer-sidebar-performance-improvement, Property {number}: {property_text}**

### Integration Tests

**テスト対象**:
- フロントエンドの並列取得ロジック
- サイドバーカウントとテーブルデータの整合性
- プログレッシブローディングの動作
- タイムアウトエラーの表示

**テストケース**:
1. サイドバーカウントが先に表示されること（プログレッシブローディング）
2. 全買主データの取得完了後、カテゴリー展開時に詳細データが表示されること
3. キャッシュが有効な場合、2回目以降のアクセスが高速であること
4. 「読み込み中」インジケーターが表示されること
5. 5秒超過時にタイムアウトエラーが表示されること
6. 買主データ更新時にキャッシュが無効化されること

---

## 実装手順

### ステップ1: GASコードの確認（変更なし）

**確認事項**:
- [ ] `gas_buyer_complete_code.js`に`updateBuyerSidebarCounts_()`関数が存在するか
- [ ] GASの10分トリガーが設定されているか
- [ ] `buyer_sidebar_counts`テーブルにデータが保存されているか

**🚨 重要**: GASコードは絶対に変更しない

### ステップ2: データベースクエリの最適化

**実装内容**:
1. 必要最小限のカラムのみSELECTするようにクエリを修正（要件4.1）
2. `deleted_at IS NULL`条件のインデックスを作成（要件4.2）
3. 接続プールの設定を確認（要件4.4）

**ファイル**: `backend/src/services/BuyerService.ts`

**変更箇所**:
```typescript
// ❌ 変更前
const { data } = await supabase.from('buyers').select('*');

// ✅ 変更後
const { data } = await supabase
  .from('buyers')
  .select('buyer_number, calculated_status, assignee, viewing_date, next_call_date, deleted_at')
  .is('deleted_at', null);
```

### ステップ3: パフォーマンス監視とロギングの実装

**実装内容**:
1. 処理時間のログ記録（要件5.1）
2. 5秒超過時の警告ログ（要件5.2）
3. エラーログとスタックトレース（要件5.3）
4. 各処理ステップの所要時間記録（要件5.4）

**ファイル**: 
- `backend/src/services/BuyerService.ts`
- `frontend/src/pages/BuyersPage.tsx`

**変更箇所**: 「Performance Monitoring and Logging」セクションのコードを参照

### ステップ4: フロントエンドの並列取得ロジックを実装

**ファイル**: `frontend/src/pages/BuyersPage.tsx`

**実装内容**:
1. `SellersPage.tsx`の並列取得ロジックをコピー
2. 変数名を`sellers` → `buyers`に置換
3. エンドポイントを`/api/sellers/*` → `/api/buyers/*`に置換
4. キャッシュキーを`CACHE_KEYS.SELLERS_WITH_STATUS` → `CACHE_KEYS.BUYERS_WITH_STATUS`に置換
5. プログレッシブローディングの実装（要件3.1, 3.2）
6. タイムアウトエラーの実装（要件3.4）

**🚨 重要**: 売主リストのコードをそのままコピーして、変数名とエンドポイントだけ変更する

### ステップ5: 後方互換性の確認

**確認事項**:
- [ ] APIレスポンス形式が既存と一致するか（`categoryCounts`と`normalStaffInitials`フィールド）
- [ ] キャッシュキーが既存と互換性があるか
- [ ] ステータス計算ロジックが既存と一致するか
- [ ] 買主データ更新時にサイドバーカウントが即座に反映されるか

**ファイル**: 
- `backend/src/routes/buyers.ts`
- `backend/src/services/BuyerService.ts`

### ステップ6: テスト

**テスト手順**:
1. ローカル環境で買主リストページを開く
2. サイドバーカウントが5秒以内に表示されることを確認
3. バックグラウンドで全買主データが取得されることを確認（DevToolsのNetworkタブ）
4. カテゴリー展開時に詳細データが表示されることを確認
5. 「読み込み中」インジケーターが表示されることを確認
6. 5秒超過時にタイムアウトエラーが表示されることを確認（テスト用に遅延を追加）
7. 買主データ更新時にキャッシュが無効化されることを確認

### ステップ7: デプロイ

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
| サイドバーカウント取得 | 5秒以内 | 15秒 |
| 初回ロード完了 | 5秒以内 | 15秒 |
| 2回目以降のアクセス | 即座（キャッシュ） | 15秒 |
| 並列取得の開始 | 同時 | 順次 |

### キャッシュ戦略

| キャッシュ | TTL | 無効化タイミング |
|-----------|-----|----------------|
| サイドバーカウント（buyer_sidebar_counts） | 10分 | GASが10分ごとに更新 |
| 全買主データ（フロントエンド） | 10分 | 買主データ更新時 |

### ログ戦略

| ログレベル | 条件 | 内容 |
|-----------|------|------|
| INFO | 正常処理 | 処理時間、各ステップの所要時間 |
| WARN | 5秒超過 | 警告メッセージ、処理時間 |
| ERROR | エラー発生 | エラー内容、スタックトレース |

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

### パフォーマンス改善

- サイドバーの初回表示が5秒以内に完了（現状15秒 → 目標5秒）
- GASが10分ごとにサイドバーカウントを更新
- フロントエンドはテーブルから高速取得
- 2回目以降のアクセスはキャッシュから即座に表示

### ユーザー体験の改善

- プログレッシブローディングにより、待ち時間を感じにくくなる
- 「読み込み中」インジケーターで進捗状況が分かる
- 5秒超過時のタイムアウトエラーで問題を早期に検知

### 開発者体験の改善

- パフォーマンス監視により、問題を早期に検知
- ログにより、処理時間とエラー内容を把握
- 後方互換性により、既存機能を壊さない

---

**最終更新日**: 2026年4月5日  
**作成理由**: 買主リストサイドバーの表示速度を改善し、売主リストと同じ高速表示を実現するため
