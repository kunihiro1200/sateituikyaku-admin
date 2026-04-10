# 設計書：買主詳細画面の月ごとの買付率統計機能

## 概要

買主詳細画面に、2026年1月以降の月ごとの買付率統計を表示する機能を追加します。後続担当ごとに買付数、内覧数、買付率を集計し、営業活動の効果測定を可能にします。

## アーキテクチャ

### システム構成図

```mermaid
graph TB
    subgraph Frontend
        A[BuyerDetailPage] --> B[買付率ボタン]
        B --> C[BuyerPurchaseRateStatisticsPage]
        C --> D[StatisticsTable Component]
    end
    
    subgraph Backend
        E[/api/buyers/purchase-rate-statistics]
        F[BuyerService.getPurchaseRateStatistics]
        G[Supabase buyers table]
    end
    
    C --> E
    E --> F
    F --> G
    
    style C fill:#e1f5ff
    style E fill:#fff4e1
    style F fill:#f0f0f0
```

### データフロー

1. ユーザーが買主詳細画面の「買付率」ボタンをクリック
2. `/buyers/purchase-rate-statistics` ページに遷移
3. フロントエンドがバックエンドAPI `/api/buyers/purchase-rate-statistics` を呼び出し
4. バックエンドが `buyers` テーブルから2026年1月以降のデータを集計
5. 集計結果をフロントエンドに返却
6. フロントエンドが統計表を表示

## コンポーネントとインターフェース

### 1. フロントエンド

#### 1.1 BuyerDetailPage.tsx（既存ファイルの修正）

**場所**: `frontend/frontend/src/pages/BuyerDetailPage.tsx`

**変更内容**: 基本情報セクションの下に「買付率」ボタンを追加

```typescript
// 基本情報セクションの下に追加
<Box sx={{ mt: 2 }}>
  <Button
    variant="outlined"
    startIcon={<BarChartIcon />}
    onClick={() => navigate('/buyers/purchase-rate-statistics')}
  >
    買付率
  </Button>
</Box>
```

#### 1.2 BuyerPurchaseRateStatisticsPage.tsx（新規作成）

**場所**: `frontend/frontend/src/pages/BuyerPurchaseRateStatisticsPage.tsx`

**責務**:
- 買付率統計データの取得
- 統計表の表示
- エラーハンドリング

**主要な状態管理**:
```typescript
interface MonthlyStatistics {
  month: string;              // 例: "2026年1月"
  total: {
    viewingCount: number;     // 月の合計内覧数
    purchaseCount: number;    // 月の合計買付数
    purchaseRate: number | null; // 月の合計買付率
  };
  assignees: Array<{
    followUpAssignee: string;   // 後続担当
    viewingCount: number;       // 内覧数
    purchaseCount: number;      // 買付数
    purchaseRate: number | null; // 買付率（%）
  }>;
}

const [statistics, setStatistics] = useState<MonthlyStatistics[]>([]);
const [loading, setLoading] = useState(true);
const [error, setError] = useState<string | null>(null);
```

#### 1.3 StatisticsTable Component（新規作成）

**場所**: `frontend/frontend/src/components/StatisticsTable.tsx`

**責務**:
- 統計データをテーブル形式で表示
- 各月の「計」行を最初に表示
- 担当名ごとの行をインデントして表示
- ソート機能（月の降順、後続担当のアルファベット順）

**Props**:
```typescript
interface StatisticsTableProps {
  data: MonthlyStatistics[];
}
```

**表示形式**:
```
年月        内覧件数  買付件数  買付率（%）
2026年1月   計  50      10       20.0
            A   20       5       25.0
            B   30       5       16.7
2025年12月  計  40       8       20.0
            A   25       5       20.0
            B   15       3       20.0
```

### 2. バックエンド

#### 2.1 buyers.ts（既存ファイルの修正）

**場所**: `backend/src/routes/buyers.ts`

**追加エンドポイント**:
```typescript
// 買付率統計取得
router.get('/purchase-rate-statistics', authenticate, async (req: Request, res: Response) => {
  try {
    const statistics = await buyerService.getPurchaseRateStatistics();
    res.json(statistics);
  } catch (error: any) {
    console.error('Error fetching purchase rate statistics:', error);
    res.status(500).json({ error: error.message });
  }
});
```

#### 2.2 BuyerService.ts（既存ファイルの修正）

**場所**: `backend/src/services/BuyerService.ts`

**追加メソッド**: `getPurchaseRateStatistics()`

**シグネチャ**:
```typescript
async getPurchaseRateStatistics(): Promise<Array<{
  month: string;
  total: {
    viewingCount: number;
    purchaseCount: number;
    purchaseRate: number | null;
  };
  assignees: Array<{
    followUpAssignee: string;
    viewingCount: number;
    purchaseCount: number;
    purchaseRate: number | null;
  }>;
}>>
```

**実装ロジック**:
1. 2026年1月1日以降のデータを取得
2. 買付数を集計（`latest_status` に「買（」を含む）
3. 内覧数を集計（`viewing_date` が入力されている、同じ `email` または `phone_number` は1件としてカウント）
4. 買付率を計算（買付数 ÷ 内覧数）
5. 月別・後続担当別にグループ化
6. 各月の合計を計算
7. 月の降順、後続担当のアルファベット順でソート
8. 各月の最初に「計」行、その下に担当名ごとの行を配置

### 3. ルーティング

**追加ルート**: `/buyers/purchase-rate-statistics`

**App.tsx への追加**:
```typescript
<Route
  path="/buyers/purchase-rate-statistics"
  element={
    <ProtectedRoute>
      <BuyerPurchaseRateStatisticsPage />
    </ProtectedRoute>
  }
/>
```

## データモデル

### 集計対象フィールド

| フィールド名 | 型 | 説明 | 集計での使用 |
|------------|---|------|------------|
| `viewing_date` | TIMESTAMP | 内覧日 | 内覧数のカウント条件 |
| `latest_status` | TEXT | 最新状況 | 買付数のカウント条件（「買（」を含む） |
| `follow_up_assignee` | TEXT | 後続担当 | グループ化キー |
| `email` | TEXT | メールアドレス | 内覧数の重複排除 |
| `phone_number` | TEXT | 電話番号 | 内覧数の重複排除 |
| `reception_date` | TIMESTAMP | 受付日 | 集計対象期間のフィルタ（2026年1月以降） |

### 集計ロジック

#### 買付数の集計

```sql
SELECT 
  DATE_TRUNC('month', viewing_date) AS month,
  follow_up_assignee,
  COUNT(*) AS purchase_count
FROM buyers
WHERE 
  viewing_date >= '2026-01-01'
  AND latest_status LIKE '%買（%'
GROUP BY month, follow_up_assignee
```

#### 内覧数の集計（重複排除）

```sql
WITH unique_viewings AS (
  SELECT DISTINCT ON (
    COALESCE(email, ''), 
    COALESCE(phone_number, ''),
    DATE_TRUNC('month', viewing_date),
    follow_up_assignee
  )
    DATE_TRUNC('month', viewing_date) AS month,
    follow_up_assignee,
    email,
    phone_number
  FROM buyers
  WHERE 
    viewing_date >= '2026-01-01'
    AND viewing_date IS NOT NULL
)
SELECT 
  month,
  follow_up_assignee,
  COUNT(*) AS viewing_count
FROM unique_viewings
GROUP BY month, follow_up_assignee
```

#### 買付率の計算

```typescript
const purchaseRate = viewingCount > 0 
  ? Math.round((purchaseCount / viewingCount) * 1000) / 10  // 小数点第1位まで
  : null;
```

### レスポンス形式

```typescript
interface MonthlyStatistics {
  month: string;              // "2026年1月"
  total: {
    viewingCount: number;     // 月の合計内覧数
    purchaseCount: number;    // 月の合計買付数
    purchaseRate: number | null; // 月の合計買付率
  };
  assignees: Array<{
    followUpAssignee: string;   // "A"
    viewingCount: number;       // 20
    purchaseCount: number;      // 5
    purchaseRate: number | null; // 25.0 または null
  }>;
}

interface PurchaseRateStatisticsResponse {
  statistics: MonthlyStatistics[];
}
```

## エラーハンドリング

### 1. データ取得エラー

**発生条件**: Supabaseへの接続エラー、クエリエラー

**処理**:
```typescript
try {
  const statistics = await buyerService.getPurchaseRateStatistics();
  res.json(statistics);
} catch (error: any) {
  console.error('Error fetching purchase rate statistics:', error);
  res.status(500).json({ 
    error: 'データの取得に失敗しました。しばらくしてから再度お試しください。' 
  });
}
```

**フロントエンド表示**:
```typescript
{error && (
  <Alert severity="error" sx={{ mb: 2 }}>
    {error}
  </Alert>
)}
```

### 2. データが0件の場合

**発生条件**: 2026年1月以降のデータが存在しない

**処理**:
```typescript
if (statistics.length === 0) {
  return (
    <Alert severity="info">
      データがありません（集計対象期間: 2026年1月以降）
    </Alert>
  );
}
```

### 3. 内覧数が0の場合

**発生条件**: 特定の月・後続担当で内覧数が0

**処理**:
```typescript
const purchaseRate = viewingCount > 0 
  ? Math.round((purchaseCount / viewingCount) * 1000) / 10
  : null;

// 表示時
{purchaseRate !== null ? `${purchaseRate}%` : '-'}
```

## テスト戦略

### 1. ユニットテスト

#### 1.1 BuyerService.getPurchaseRateStatistics()

**テストケース**:
- 2026年1月以降のデータのみが集計されること
- 「買（」を含む `latest_status` のみが買付としてカウントされること
- 同じ `email` または `phone_number` の内覧が1件としてカウントされること
- 内覧数が0の場合、買付率が `null` になること
- 月の降順、後続担当のアルファベット順でソートされること

**テストデータ例**:
```typescript
const testBuyers = [
  {
    viewing_date: '2026-01-15',
    latest_status: '買（AA1234）',
    follow_up_assignee: 'A',
    email: 'test1@example.com',
    phone_number: '090-1234-5678'
  },
  {
    viewing_date: '2026-01-20',
    latest_status: 'B',
    follow_up_assignee: 'A',
    email: 'test1@example.com',  // 重複
    phone_number: '090-1234-5678'
  },
  {
    viewing_date: '2025-12-31',  // 集計対象外
    latest_status: '買（AA5678）',
    follow_up_assignee: 'B',
    email: 'test2@example.com',
    phone_number: '090-9876-5432'
  }
];
```

**期待される結果**:
```typescript
[
  {
    month: '2026年1月',
    followUpAssignee: 'A',
    purchaseCount: 1,
    viewingCount: 1,  // 重複排除により1件
    purchaseRate: 100.0
  }
]
```

#### 1.2 StatisticsTable Component

**テストケース**:
- 統計データが正しく表示されること
- 合計行が正しく計算されること
- 買付率が小数点第1位まで表示されること
- 内覧数が0の場合、買付率が「-」と表示されること

### 2. 統合テスト

#### 2.1 API エンドポイント

**テストケース**:
- `/api/buyers/purchase-rate-statistics` が正しいデータを返すこと
- 認証が必要であること（`authenticate` ミドルウェア）
- エラー時に500ステータスコードを返すこと

#### 2.2 フロントエンド

**テストケース**:
- 「買付率」ボタンをクリックすると統計ページに遷移すること
- 統計データが正しく表示されること
- ローディング中にスピナーが表示されること
- エラー時にエラーメッセージが表示されること

### 3. パフォーマンステスト

**目標**: 統計ページを5秒以内に表示

**テスト方法**:
1. 10,000件の買主データを用意
2. `/api/buyers/purchase-rate-statistics` のレスポンスタイムを計測
3. フロントエンドのレンダリング時間を計測

**最適化戦略**:
- データベースインデックスの活用（`viewing_date`, `follow_up_assignee`）
- キャッシュの実装（30分TTL）
- ページネーションの検討（データ量が多い場合）

## 実装計画

### Phase 1: バックエンド実装

1. `BuyerService.getPurchaseRateStatistics()` メソッドの実装
2. `/api/buyers/purchase-rate-statistics` エンドポイントの追加
3. ユニットテストの作成

### Phase 2: フロントエンド実装

1. `BuyerPurchaseRateStatisticsPage.tsx` の作成
2. `StatisticsTable.tsx` コンポーネントの作成
3. `BuyerDetailPage.tsx` に「買付率」ボタンを追加
4. ルーティングの追加

### Phase 3: テストと最適化

1. 統合テストの実行
2. パフォーマンステストの実行
3. キャッシュの実装（必要に応じて）
4. UIの調整

## セキュリティ考慮事項

### 1. 認証

- 全てのエンドポイントに `authenticate` ミドルウェアを適用
- ログインしていないユーザーはアクセス不可

### 2. データアクセス制御

- 買主データは社内管理システム専用
- 公開物件サイトからはアクセス不可

### 3. SQLインジェクション対策

- Supabaseのパラメータ化クエリを使用
- ユーザー入力を直接SQLに埋め込まない

## パフォーマンス最適化

### 1. データベースインデックス

既存のインデックスを活用:
```sql
CREATE INDEX IF NOT EXISTS idx_buyers_latest_viewing_date ON buyers(latest_viewing_date DESC);
CREATE INDEX IF NOT EXISTS idx_buyers_follow_up_assignee ON buyers(follow_up_assignee);
```

### 2. キャッシュ戦略

**実装**: NodeCache（TTL: 30分）

```typescript
import NodeCache from 'node-cache';

const statisticsCache = new NodeCache({ stdTTL: 1800 }); // 30分

async getPurchaseRateStatistics(): Promise<any> {
  const cacheKey = 'purchase-rate-statistics';
  const cached = statisticsCache.get(cacheKey);
  
  if (cached) {
    return cached;
  }
  
  const statistics = await this.calculateStatistics();
  statisticsCache.set(cacheKey, statistics);
  
  return statistics;
}
```

**キャッシュ無効化**:
- 買主データが更新された場合（`BuyerService.update()` 内で `statisticsCache.del('purchase-rate-statistics')`）

### 3. クエリ最適化

- `DISTINCT ON` を使用して重複排除を効率化
- `DATE_TRUNC` を使用して月単位の集計を効率化
- 必要なカラムのみを SELECT

## 今後の拡張性

### 1. フィルタ機能

- 期間指定（開始月〜終了月）
- 後続担当の絞り込み
- 物件種別の絞り込み

### 2. グラフ表示

- 月ごとの買付率の推移をグラフで表示
- 後続担当別の比較グラフ

### 3. エクスポート機能

- CSV形式でのダウンロード
- Excel形式でのダウンロード

### 4. リアルタイム更新

- WebSocketを使用したリアルタイム更新
- 買主データが更新されたら自動的に統計を再計算

## まとめ

この設計書に基づいて実装することで、以下の要件を満たす買付率統計機能を実現できます:

- 2026年1月以降の月ごとの買付率を表示
- 後続担当ごとに集計
- 各月の最初に「計」行を表示
- 担当名の行をインデント表示
- 列の順序：年月 → 内覧件数 → 買付件数 → 買付率
- 内覧数の重複排除（同じメールアドレスまたは電話番号）
- 5秒以内の表示（パフォーマンス要件）
- エラーハンドリング
- 認証とセキュリティ

実装は3つのフェーズに分けて進め、各フェーズでテストを実施することで、品質を担保します。


## 低レベル設計

### 1. バックエンド実装詳細

#### 1.1 BuyerService.getPurchaseRateStatistics() の実装

**ファイル**: `backend/src/services/BuyerService.ts`

```typescript
/**
 * 買付率統計を取得
 * 2026年1月以降の月ごと・後続担当ごとの買付数、内覧数、買付率を集計
 */
async getPurchaseRateStatistics(): Promise<Array<{
  month: string;
  total: {
    viewingCount: number;
    purchaseCount: number;
    purchaseRate: number | null;
  };
  assignees: Array<{
    followUpAssignee: string;
    viewingCount: number;
    purchaseCount: number;
    purchaseRate: number | null;
  }>;
}>> {
  try {
    // 1. 2026年1月1日以降のデータを取得
    const { data: buyers, error } = await this.supabase
      .from('buyers')
      .select('viewing_date, latest_status, follow_up_assignee, email, phone_number')
      .gte('viewing_date', '2026-01-01')
      .not('viewing_date', 'is', null);

    if (error) {
      throw new Error(`Failed to fetch buyers: ${error.message}`);
    }

    if (!buyers || buyers.length === 0) {
      return [];
    }

    // 2. 月ごと・後続担当ごとにグループ化
    const groupedData = this.groupByMonthAndAssignee(buyers);

    // 3. 買付数と内覧数を集計
    const statistics = this.calculateMonthlyStatistics(groupedData);

    // 4. ソート（月の降順）
    statistics.sort((a, b) => b.month.localeCompare(a.month));

    return statistics;
  } catch (error: any) {
    console.error('[BuyerService.getPurchaseRateStatistics] Error:', error);
    throw error;
  }
}

/**
 * 買主データを月ごと・後続担当ごとにグループ化
 */
private groupByMonthAndAssignee(buyers: any[]): Map<string, Map<string, any[]>> {
  const grouped = new Map<string, Map<string, any[]>>();

  for (const buyer of buyers) {
    const viewingDate = new Date(buyer.viewing_date);
    const month = `${viewingDate.getFullYear()}年${viewingDate.getMonth() + 1}月`;
    const assignee = buyer.follow_up_assignee || '未設定';

    if (!grouped.has(month)) {
      grouped.set(month, new Map());
    }
    
    const monthData = grouped.get(month)!;
    if (!monthData.has(assignee)) {
      monthData.set(assignee, []);
    }
    
    monthData.get(assignee)!.push(buyer);
  }

  return grouped;
}

/**
 * 月ごとの統計を計算
 */
private calculateMonthlyStatistics(groupedData: Map<string, Map<string, any[]>>): Array<{
  month: string;
  total: {
    viewingCount: number;
    purchaseCount: number;
    purchaseRate: number | null;
  };
  assignees: Array<{
    followUpAssignee: string;
    viewingCount: number;
    purchaseCount: number;
    purchaseRate: number | null;
  }>;
}> {
  const statistics: Array<{
    month: string;
    total: {
      viewingCount: number;
      purchaseCount: number;
      purchaseRate: number | null;
    };
    assignees: Array<{
      followUpAssignee: string;
      viewingCount: number;
      purchaseCount: number;
      purchaseRate: number | null;
    }>;
  }> = [];

  for (const [month, assigneeData] of groupedData.entries()) {
    const assignees: Array<{
      followUpAssignee: string;
      viewingCount: number;
      purchaseCount: number;
      purchaseRate: number | null;
    }> = [];
    
    let totalViewingCount = 0;
    let totalPurchaseCount = 0;

    // 担当者ごとの統計を計算
    for (const [assignee, buyers] of assigneeData.entries()) {
      // 買付数を集計（latest_status に「買（」を含む）
      const purchaseCount = buyers.filter(b => 
        b.latest_status && b.latest_status.includes('買（')
      ).length;

      // 内覧数を集計（重複排除）
      const uniqueViewings = this.getUniqueViewings(buyers);
      const viewingCount = uniqueViewings.size;

      // 買付率を計算
      const purchaseRate = viewingCount > 0
        ? Math.round((purchaseCount / viewingCount) * 1000) / 10
        : null;

      assignees.push({
        followUpAssignee: assignee,
        viewingCount,
        purchaseCount,
        purchaseRate
      });

      totalViewingCount += viewingCount;
      totalPurchaseCount += purchaseCount;
    }

    // 担当者をアルファベット順にソート
    assignees.sort((a, b) => a.followUpAssignee.localeCompare(b.followUpAssignee));

    // 月の合計買付率を計算
    const totalPurchaseRate = totalViewingCount > 0
      ? Math.round((totalPurchaseCount / totalViewingCount) * 1000) / 10
      : null;

    statistics.push({
      month,
      total: {
        viewingCount: totalViewingCount,
        purchaseCount: totalPurchaseCount,
        purchaseRate: totalPurchaseRate
      },
      assignees
    });
  }

  return statistics;
}

/**
 * 内覧数の重複排除（同じメールアドレスまたは電話番号は1件としてカウント）
 */
private getUniqueViewings(buyers: any[]): Set<string> {
  const uniqueViewings = new Set<string>();

  for (const buyer of buyers) {
    const email = buyer.email?.trim() || '';
    const phoneNumber = buyer.phone_number?.trim() || '';

    // メールアドレスまたは電話番号のいずれかが存在する場合のみカウント
    if (email || phoneNumber) {
      const key = `${email}|${phoneNumber}`;
      uniqueViewings.add(key);
    }
  }

  return uniqueViewings;
}
```

#### 1.2 APIエンドポイントの実装

**ファイル**: `backend/src/routes/buyers.ts`

```typescript
// 買付率統計取得（/:id よりも前に定義）
router.get('/purchase-rate-statistics', authenticate, async (req: Request, res: Response) => {
  try {
    console.log('[GET /buyers/purchase-rate-statistics] Request received');
    
    const statistics = await buyerService.getPurchaseRateStatistics();

    console.log(`[GET /buyers/purchase-rate-statistics] Success: ${statistics.length} months`);
    
    res.json({
      statistics
    });
  } catch (error: any) {
    console.error('[GET /buyers/purchase-rate-statistics] Error:', error);
    res.status(500).json({ 
      error: 'データの取得に失敗しました。しばらくしてから再度お試しください。' 
    });
  }
});
```

### 2. フロントエンド実装詳細

#### 2.1 BuyerPurchaseRateStatisticsPage.tsx の実装

**ファイル**: `frontend/frontend/src/pages/BuyerPurchaseRateStatisticsPage.tsx`

```typescript
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Container,
  Box,
  Typography,
  Paper,
  CircularProgress,
  Alert,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
} from '@mui/material';
import { ArrowBack as ArrowBackIcon } from '@mui/icons-material';
import api from '../services/api';

interface MonthlyStatistics {
  month: string;
  total: {
    viewingCount: number;
    purchaseCount: number;
    purchaseRate: number | null;
  };
  assignees: Array<{
    followUpAssignee: string;
    viewingCount: number;
    purchaseCount: number;
    purchaseRate: number | null;
  }>;
}

interface StatisticsResponse {
  statistics: MonthlyStatistics[];
}

export default function BuyerPurchaseRateStatisticsPage() {
  const navigate = useNavigate();
  const [data, setData] = useState<StatisticsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchStatistics();
  }, []);

  const fetchStatistics = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await api.get('/api/buyers/purchase-rate-statistics');
      setData(response.data);
    } catch (err: any) {
      console.error('Failed to fetch statistics:', err);
      setError(err.response?.data?.error || 'データの取得に失敗しました');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Container maxWidth="lg" sx={{ mt: 4, display: 'flex', justifyContent: 'center' }}>
        <CircularProgress />
      </Container>
    );
  }

  if (error) {
    return (
      <Container maxWidth="lg" sx={{ mt: 4 }}>
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
        <Button
          variant="outlined"
          startIcon={<ArrowBackIcon />}
          onClick={() => navigate(-1)}
        >
          戻る
        </Button>
      </Container>
    );
  }

  if (!data || data.statistics.length === 0) {
    return (
      <Container maxWidth="lg" sx={{ mt: 4 }}>
        <Alert severity="info" sx={{ mb: 2 }}>
          データがありません（集計対象期間: 2026年1月以降）
        </Alert>
        <Button
          variant="outlined"
          startIcon={<ArrowBackIcon />}
          onClick={() => navigate(-1)}
        >
          戻る
        </Button>
      </Container>
    );
  }

  return (
    <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
      <Box sx={{ mb: 3, display: 'flex', alignItems: 'center', gap: 2 }}>
        <Button
          variant="outlined"
          startIcon={<ArrowBackIcon />}
          onClick={() => navigate(-1)}
        >
          戻る
        </Button>
        <Typography variant="h4">
          買付率統計
        </Typography>
      </Box>

      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        集計対象期間: 2026年1月以降
      </Typography>

      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>年月</TableCell>
              <TableCell align="right">内覧件数</TableCell>
              <TableCell align="right">買付件数</TableCell>
              <TableCell align="right">買付率（%）</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {data.statistics.map((monthData, monthIndex) => (
              <React.Fragment key={monthIndex}>
                {/* 月の合計行 */}
                <TableRow sx={{ bgcolor: 'grey.100', fontWeight: 'bold' }}>
                  <TableCell>{monthData.month} 計</TableCell>
                  <TableCell align="right">{monthData.total.viewingCount}</TableCell>
                  <TableCell align="right">{monthData.total.purchaseCount}</TableCell>
                  <TableCell align="right">
                    {monthData.total.purchaseRate !== null ? `${monthData.total.purchaseRate}%` : '-'}
                  </TableCell>
                </TableRow>
                {/* 担当者ごとの行（インデント） */}
                {monthData.assignees.map((assignee, assigneeIndex) => (
                  <TableRow key={`${monthIndex}-${assigneeIndex}`}>
                    <TableCell sx={{ pl: 4 }}>{assignee.followUpAssignee}</TableCell>
                    <TableCell align="right">{assignee.viewingCount}</TableCell>
                    <TableCell align="right">{assignee.purchaseCount}</TableCell>
                    <TableCell align="right">
                      {assignee.purchaseRate !== null ? `${assignee.purchaseRate}%` : '-'}
                    </TableCell>
                  </TableRow>
                ))}
              </React.Fragment>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </Container>
  );
}
```

#### 2.2 BuyerDetailPage.tsx への「買付率」ボタン追加

**ファイル**: `frontend/frontend/src/pages/BuyerDetailPage.tsx`

**追加場所**: 基本情報セクションの下（約210行目付近）

```typescript
// 基本情報セクションの後に追加
{/* 買付率統計ボタン */}
<Box sx={{ mt: 2 }}>
  <Button
    variant="outlined"
    startIcon={<BarChartIcon />}
    onClick={() => handleNavigate('/buyers/purchase-rate-statistics')}
  >
    買付率
  </Button>
</Box>
```

**必要なインポート**:
```typescript
import { BarChart as BarChartIcon } from '@mui/icons-material';
```

#### 2.3 ルーティングの追加

**ファイル**: `frontend/frontend/src/App.tsx`

```typescript
import BuyerPurchaseRateStatisticsPage from './pages/BuyerPurchaseRateStatisticsPage';

// ルート定義に追加
<Route
  path="/buyers/purchase-rate-statistics"
  element={
    <ProtectedRoute>
      <BuyerPurchaseRateStatisticsPage />
    </ProtectedRoute>
  }
/>
```

### 3. キャッシュ実装

**ファイル**: `backend/src/services/BuyerService.ts`

```typescript
import NodeCache from 'node-cache';

// クラスの外で定義（モジュールレベル）
const statisticsCache = new NodeCache({ stdTTL: 1800 }); // 30分

// BuyerServiceクラス内
async getPurchaseRateStatistics(): Promise<Array<{
  month: string;
  total: {
    viewingCount: number;
    purchaseCount: number;
    purchaseRate: number | null;
  };
  assignees: Array<{
    followUpAssignee: string;
    viewingCount: number;
    purchaseCount: number;
    purchaseRate: number | null;
  }>;
}>> {
  const cacheKey = 'purchase-rate-statistics';
  
  // キャッシュから取得
  const cached = statisticsCache.get(cacheKey);
  if (cached) {
    console.log('[BuyerService.getPurchaseRateStatistics] Cache hit');
    return cached as any;
  }

  console.log('[BuyerService.getPurchaseRateStatistics] Cache miss, calculating...');
  
  // 統計を計算
  const statistics = await this.calculatePurchaseRateStatistics();
  
  // キャッシュに保存
  statisticsCache.set(cacheKey, statistics);
  
  return statistics;
}

// 買主データ更新時にキャッシュを無効化
async update(id: string, updateData: Partial<any>, userId?: string, userEmail?: string): Promise<any> {
  // ... 既存の更新処理 ...
  
  // キャッシュを無効化
  statisticsCache.del('purchase-rate-statistics');
  console.log('[BuyerService.update] Statistics cache invalidated');
  
  return data;
}
```

### 4. アルゴリズム詳細

#### 4.1 内覧数の重複排除アルゴリズム

**目的**: 同じメールアドレスまたは電話番号を持つ買主を1件としてカウント

**アルゴリズム**:
```
1. 空のSet（uniqueViewings）を作成
2. 各買主について:
   a. メールアドレスと電話番号を取得
   b. 両方が空の場合はスキップ
   c. "メールアドレス|電話番号" の形式でキーを作成
   d. キーをSetに追加（重複は自動的に排除される）
3. Setのサイズを返す（= ユニークな内覧数）
```

**時間計算量**: O(n)（nは買主の数）

**空間計算量**: O(n)（最悪の場合、全ての買主がユニーク）

#### 4.2 買付率の計算アルゴリズム

**目的**: 買付率を小数点第1位まで計算

**アルゴリズム**:
```
1. 内覧数が0の場合:
   - nullを返す
2. 内覧数が0より大きい場合:
   a. 買付数 ÷ 内覧数 を計算
   b. 100を掛けてパーセンテージに変換
   c. 1000を掛けて小数点第1位まで保持
   d. 四捨五入
   e. 10で割って小数点第1位まで表示
```

**例**:
```
買付数 = 5
内覧数 = 20

計算:
(5 / 20) * 100 = 25.0
25.0 * 1000 = 25000
Math.round(25000) = 25000
25000 / 10 = 2500.0
→ 25.0%
```

### 5. データベースクエリ最適化

#### 5.1 インデックスの活用

既存のインデックスを活用:
```sql
-- viewing_date のインデックス（既存）
CREATE INDEX IF NOT EXISTS idx_buyers_latest_viewing_date ON buyers(latest_viewing_date DESC);

-- follow_up_assignee のインデックス（既存）
CREATE INDEX IF NOT EXISTS idx_buyers_follow_up_assignee ON buyers(follow_up_assignee);
```

#### 5.2 クエリの最適化

**最適化前**:
```typescript
// 全てのカラムを取得（不要なデータも含む）
const { data: buyers } = await this.supabase
  .from('buyers')
  .select('*')
  .gte('viewing_date', '2026-01-01');
```

**最適化後**:
```typescript
// 必要なカラムのみを取得
const { data: buyers } = await this.supabase
  .from('buyers')
  .select('viewing_date, latest_status, follow_up_assignee, email, phone_number')
  .gte('viewing_date', '2026-01-01')
  .not('viewing_date', 'is', null);
```

**効果**:
- データ転送量の削減（約80%削減）
- メモリ使用量の削減
- レスポンスタイムの短縮

### 6. エラーハンドリング詳細

#### 6.1 バックエンドのエラーハンドリング

```typescript
async getPurchaseRateStatistics(): Promise<any> {
  try {
    // データ取得
    const { data: buyers, error } = await this.supabase
      .from('buyers')
      .select('viewing_date, latest_status, follow_up_assignee, email, phone_number')
      .gte('viewing_date', '2026-01-01')
      .not('viewing_date', 'is', null);

    if (error) {
      console.error('[BuyerService.getPurchaseRateStatistics] Supabase error:', error);
      throw new Error(`Failed to fetch buyers: ${error.message}`);
    }

    if (!buyers || buyers.length === 0) {
      console.log('[BuyerService.getPurchaseRateStatistics] No data found');
      return [];
    }

    // 統計計算
    const statistics = this.calculateStatistics(buyers);
    
    return statistics;
  } catch (error: any) {
    console.error('[BuyerService.getPurchaseRateStatistics] Error:', error);
    throw error;
  }
}
```

#### 6.2 フロントエンドのエラーハンドリング

```typescript
const fetchStatistics = async () => {
  try {
    setLoading(true);
    setError(null);
    
    const response = await api.get('/api/buyers/purchase-rate-statistics');
    setData(response.data);
  } catch (err: any) {
    console.error('Failed to fetch statistics:', err);
    
    // エラーメッセージの優先順位
    let errorMessage = 'データの取得に失敗しました';
    
    if (err.response?.data?.error) {
      // バックエンドからのエラーメッセージ
      errorMessage = err.response.data.error;
    } else if (err.message) {
      // ネットワークエラーなど
      errorMessage = `エラー: ${err.message}`;
    }
    
    setError(errorMessage);
  } finally {
    setLoading(false);
  }
};
```

### 7. テストコード例

#### 7.1 バックエンドユニットテスト

**ファイル**: `backend/src/__tests__/BuyerService.getPurchaseRateStatistics.test.ts`

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { BuyerService } from '../services/BuyerService';

describe('BuyerService.getPurchaseRateStatistics', () => {
  let buyerService: BuyerService;

  beforeEach(() => {
    buyerService = new BuyerService();
  });

  it('should return statistics for 2026 data only', async () => {
    // テストデータを準備
    const testBuyers = [
      {
        viewing_date: '2026-01-15',
        latest_status: '買（AA1234）',
        follow_up_assignee: 'A',
        email: 'test1@example.com',
        phone_number: '090-1234-5678'
      },
      {
        viewing_date: '2025-12-31', // 集計対象外
        latest_status: '買（AA5678）',
        follow_up_assignee: 'B',
        email: 'test2@example.com',
        phone_number: '090-9876-5432'
      }
    ];

    // モックを設定
    // ... (Supabaseのモック設定)

    const statistics = await buyerService.getPurchaseRateStatistics();

    // 2026年のデータのみが集計されていることを確認
    expect(statistics.length).toBe(1);
    expect(statistics[0].month).toBe('2026年1月');
    expect(statistics[0].total.purchaseCount).toBe(1);
    expect(statistics[0].assignees.length).toBe(1);
    expect(statistics[0].assignees[0].followUpAssignee).toBe('A');
  });

  it('should deduplicate viewings by email and phone', async () => {
    const testBuyers = [
      {
        viewing_date: '2026-01-15',
        latest_status: 'B',
        follow_up_assignee: 'A',
        email: 'test@example.com',
        phone_number: '090-1234-5678'
      },
      {
        viewing_date: '2026-01-20',
        latest_status: 'B',
        follow_up_assignee: 'A',
        email: 'test@example.com', // 重複
        phone_number: '090-1234-5678'
      }
    ];

    // ... (モック設定)

    const statistics = await buyerService.getPurchaseRateStatistics();

    // 重複が排除されて1件としてカウントされることを確認
    expect(statistics[0].assignees[0].viewingCount).toBe(1);
  });

  it('should return null for purchase rate when viewing count is 0', async () => {
    const testBuyers = [
      {
        viewing_date: '2026-01-15',
        latest_status: '買（AA1234）',
        follow_up_assignee: 'A',
        email: null,
        phone_number: null
      }
    ];

    // ... (モック設定)

    const statistics = await buyerService.getPurchaseRateStatistics();

    // 内覧数が0の場合、買付率がnullになることを確認
    expect(statistics[0].assignees[0].purchaseRate).toBeNull();
  });
});
```

#### 7.2 フロントエンド統合テスト

**ファイル**: `frontend/frontend/src/__tests__/BuyerPurchaseRateStatisticsPage.test.tsx`

```typescript
import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import BuyerPurchaseRateStatisticsPage from '../pages/BuyerPurchaseRateStatisticsPage';
import api from '../services/api';

vi.mock('../services/api');

describe('BuyerPurchaseRateStatisticsPage', () => {
  it('should display statistics table', async () => {
    const mockData = {
      statistics: [
        {
          month: '2026年1月',
          total: {
            viewingCount: 50,
            purchaseCount: 10,
            purchaseRate: 20.0
          },
          assignees: [
            {
              followUpAssignee: 'A',
              viewingCount: 20,
              purchaseCount: 5,
              purchaseRate: 25.0
            },
            {
              followUpAssignee: 'B',
              viewingCount: 30,
              purchaseCount: 5,
              purchaseRate: 16.7
            }
          ]
        }
      ]
    };

    vi.mocked(api.get).mockResolvedValue({ data: mockData });

    render(
      <BrowserRouter>
        <BuyerPurchaseRateStatisticsPage />
      </BrowserRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('2026年1月 計')).toBeInTheDocument();
      expect(screen.getByText('A')).toBeInTheDocument();
      expect(screen.getByText('B')).toBeInTheDocument();
      expect(screen.getByText('50')).toBeInTheDocument();
      expect(screen.getByText('10')).toBeInTheDocument();
      expect(screen.getByText('20.0%')).toBeInTheDocument();
    });
  });

  it('should display error message on API failure', async () => {
    vi.mocked(api.get).mockRejectedValue({
      response: { data: { error: 'データの取得に失敗しました' } }
    });

    render(
      <BrowserRouter>
        <BuyerPurchaseRateStatisticsPage />
      </BrowserRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('データの取得に失敗しました')).toBeInTheDocument();
    });
  });

  it('should display "no data" message when statistics are empty', async () => {
    vi.mocked(api.get).mockResolvedValue({
      data: {
        statistics: []
      }
    });

    render(
      <BrowserRouter>
        <BuyerPurchaseRateStatisticsPage />
      </BrowserRouter>
    );

    await waitFor(() => {
      expect(screen.getByText(/データがありません/)).toBeInTheDocument();
    });
  });
});
```

## 実装チェックリスト

### バックエンド
- [ ] `BuyerService.getPurchaseRateStatistics()` メソッドの実装
- [ ] `BuyerService.groupByMonthAndAssignee()` メソッドの実装（月ごと・担当者ごとの2段階グループ化）
- [ ] `BuyerService.calculateMonthlyStatistics()` メソッドの実装（月の合計と担当者ごとの統計を計算）
- [ ] `BuyerService.getUniqueViewings()` メソッドの実装
- [ ] `/api/buyers/purchase-rate-statistics` エンドポイントの追加
- [ ] キャッシュ機能の実装
- [ ] キャッシュ無効化の実装（`update()` メソッド内）
- [ ] エラーハンドリングの実装
- [ ] ユニットテストの作成

### フロントエンド
- [ ] `BuyerPurchaseRateStatisticsPage.tsx` の作成（月ごとの「計」行と担当者行の表示）
- [ ] `BuyerDetailPage.tsx` に「買付率」ボタンを追加
- [ ] `App.tsx` にルーティングを追加
- [ ] ローディング表示の実装
- [ ] エラー表示の実装
- [ ] 「データがありません」表示の実装
- [ ] 統合テストの作成（月ごとのグループ化表示を確認）

### テスト
- [ ] バックエンドユニットテストの実行
- [ ] フロントエンド統合テストの実行
- [ ] パフォーマンステストの実行（5秒以内の表示）
- [ ] エラーケースのテスト

### デプロイ
- [ ] バックエンドのデプロイ（Vercel）
- [ ] フロントエンドのデプロイ（Vercel）
- [ ] 本番環境での動作確認
