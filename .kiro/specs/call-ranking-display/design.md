# 設計書：1番電話ランキング表示（call-ranking-display）

## Overview

通話モードページ（`CallModePage.tsx`）に、当月の「1番電話」件数をスタッフごとに集計してランキング形式で表示する機能を追加する。

`sellers.first_call_person`（スタッフのイニシャル）と`sellers.inquiry_date`（反響日付）を使い、当月（JST）に絞ったレコードを集計する。バックエンドに新規エンドポイント`GET /api/sellers/call-ranking`を追加し、フロントエンドに`CallRankingDisplay.tsx`コンポーネントを新規作成して`CallModePage`に組み込む。

## Architecture

```
フロントエンド（CallModePage）
  └── CallRankingDisplay.tsx
        └── GET /api/sellers/call-ranking
              └── Supabase: sellers テーブル
                    - inquiry_date（当月JST範囲でフィルタ）
                    - first_call_person（NULLを除外）
```

### JST当月計算

バックエンドでUTC時刻にUTC+9を加算して当月1日〜末日を算出する。

```
JSTの現在時刻 = UTC + 9時間
当月1日 00:00:00 JST = YYYY-MM-01T00:00:00+09:00
当月末日 23:59:59 JST = YYYY-MM-{lastDay}T23:59:59+09:00
```

Supabaseクエリでは`inquiry_date`（DATE型）に対して`gte`/`lte`でフィルタする。

## Components and Interfaces

### バックエンド

#### `GET /api/sellers/call-ranking`

- 認証: `authenticate`ミドルウェア（既存）
- 登録先: `backend/src/routes/sellers.ts`（`router.use(authenticate)`の後）

**レスポンス形式:**

```typescript
{
  period: {
    from: string;  // "YYYY-MM-DD"
    to: string;    // "YYYY-MM-DD"
  };
  rankings: Array<{
    initial: string;  // スタッフのイニシャル
    count: number;    // 件数
  }>;
  updatedAt: string;  // ISO8601
}
```

**集計ロジック:**
1. JSTで当月1日〜末日を計算
2. `inquiry_date >= from AND inquiry_date <= to AND first_call_person IS NOT NULL AND first_call_person != ''`でフィルタ
3. `first_call_person`でグループ化してカウント
4. `count DESC, initial ASC`でソート

### フロントエンド

#### `CallRankingDisplay.tsx`

新規コンポーネント。`frontend/frontend/src/components/CallRankingDisplay.tsx`に作成。

**Props:**

```typescript
interface CallRankingDisplayProps {
  // なし（自己完結型コンポーネント）
}
```

**内部状態:**

```typescript
interface RankingEntry {
  initial: string;
  count: number;
}

interface RankingData {
  period: { from: string; to: string };
  rankings: RankingEntry[];
  updatedAt: string;
}
```

**機能:**
- マウント時に自動データ取得
- ローディング表示（`CircularProgress`）
- エラー表示 + 再試行ボタン
- 空データ時のメッセージ
- 手動更新ボタン
- 5秒タイムアウト
- 上位5件表示、残りは折りたたみ
- 1位: 🏆 + 金色強調、2位: 銀色、3位: 銅色

#### `CallModePage.tsx` への組み込み

`CallRankingDisplay`を`CallModePage`内の適切な位置（追客ログ表示の近く）に追加する。

## Data Models

### Supabaseクエリ（バックエンド）

```typescript
// JSTで当月範囲を計算
const now = new Date();
const jstOffset = 9 * 60 * 60 * 1000;
const jstNow = new Date(now.getTime() + jstOffset);
const year = jstNow.getUTCFullYear();
const month = jstNow.getUTCMonth(); // 0-indexed

const fromDate = `${year}-${String(month + 1).padStart(2, '0')}-01`;
const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
const toDate = `${year}-${String(month + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;

// Supabaseクエリ
const { data } = await supabase
  .from('sellers')
  .select('first_call_person')
  .gte('inquiry_date', fromDate)
  .lte('inquiry_date', toDate)
  .not('first_call_person', 'is', null)
  .neq('first_call_person', '')
  .is('deleted_at', null);

// アプリ側で集計
const counts = new Map<string, number>();
for (const row of data) {
  counts.set(row.first_call_person, (counts.get(row.first_call_person) || 0) + 1);
}

// ソート: count DESC, initial ASC
const rankings = Array.from(counts.entries())
  .map(([initial, count]) => ({ initial, count }))
  .sort((a, b) => b.count - a.count || a.initial.localeCompare(b.initial));
```

### APIレスポンス型（フロントエンド）

```typescript
interface CallRankingResponse {
  period: { from: string; to: string };
  rankings: Array<{ initial: string; count: number }>;
  updatedAt: string;
}
```

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system—essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: NULLおよび空文字の除外

*For any* `sellers`レコードの配列において、`first_call_person`がNULLまたは空文字のレコードを含む場合でも、集計結果の`rankings`配列にはそれらのイニシャルが含まれない。また、0件のスタッフも結果に含まれない。

**Validates: Requirements 1.2, 1.5**

### Property 2: ソート順の保証

*For any* ランキング結果配列において、隣接する要素`rankings[i]`と`rankings[i+1]`について、`rankings[i].count > rankings[i+1].count`、または`rankings[i].count === rankings[i+1].count`かつ`rankings[i].initial <= rankings[i+1].initial`が成立する。

**Validates: Requirements 1.3, 1.4**

### Property 3: 当月範囲フィルタの正確性

*For any* `inquiry_date`が当月範囲外（前月以前または翌月以降）のレコードは、ランキング集計結果に含まれない。月が変わった場合も同様に新しい月の範囲で集計される。

**Validates: Requirements 2.1, 2.2**

### Property 4: JST当月範囲の計算正確性

*For any* 任意の日時において、計算された`from`日付は当月1日（JST）、`to`日付は当月末日（JST）であり、`from <= to`が成立し、`from`は`-01`で終わり、`to`はその月の正しい末日である。

**Validates: Requirements 2.1, 2.3**

### Property 5: レスポンス形式の完全性

*For any* 有効なリクエストに対して、レスポンスには`period.from`、`period.to`、`rankings`配列、`updatedAt`が含まれ、`rankings`の各エントリには`initial`（文字列）と`count`（正の整数）が含まれる。

**Validates: Requirements 1.7, 2.3, 5.3**

### Property 6: レンダリング内容の完全性

*For any* ランキングデータを渡した場合、フロントエンドのレンダリング結果には各エントリの順位番号・イニシャル・件数が含まれ、期間文字列も表示される。

**Validates: Requirements 3.2, 3.5, 4.1**

### Property 7: 件数バーの相対的正確性

*For any* ランキング表示において、最大件数のエントリのバー幅は100%であり、他のエントリのバー幅は`(count / maxCount) * 100`%（0〜100の範囲）である。

**Validates: Requirements 4.3**

## Error Handling

| エラー状況 | バックエンド | フロントエンド |
|-----------|------------|--------------|
| 認証なし | 401を返す | ログイン画面へリダイレクト（既存インターセプター） |
| Supabaseエラー | 500 + `retryable: true` | エラーメッセージ + 再試行ボタン |
| 5秒タイムアウト | - | タイムアウトエラーメッセージ + 再試行ボタン |
| データなし | 空配列を返す | 「今月はまだ記録がありません」メッセージ |

フロントエンドのタイムアウトは`AbortController`またはaxiosの`timeout`オプション（5000ms）で実装する。

## Testing Strategy

### ユニットテスト

- JST当月範囲計算関数のテスト（月末日の計算、年をまたぐケース）
- ソートロジックのテスト（同件数時のアルファベット順）
- NULLフィルタリングのテスト

### プロパティベーステスト

プロパティベーステストには**fast-check**（TypeScript対応）を使用する。各テストは最低100回のランダム入力で検証する。

各プロパティテストには以下のタグコメントを付与する:
`// Feature: call-ranking-display, Property {N}: {property_text}`

**実装すべきプロパティテスト:**

```typescript
// Property 1: NULLおよび空文字の除外
// Feature: call-ranking-display, Property 1: NULL/空文字のfirst_call_personはランキングに含まれない
fc.assert(fc.property(
  fc.array(fc.record({
    first_call_person: fc.oneof(fc.constant(null), fc.constant(''), fc.string()),
    inquiry_date: fc.string(),
  })),
  (records) => {
    const result = aggregateRankings(records);
    return result.every(r => r.initial !== null && r.initial !== '');
  }
), { numRuns: 100 });

// Property 2 & 3: ソート順の保証
// Feature: call-ranking-display, Property 2&3: count降順・同件数時initial昇順
fc.assert(fc.property(
  fc.array(fc.record({ initial: fc.string({ minLength: 1 }), count: fc.nat() })),
  (rankings) => {
    const sorted = sortRankings(rankings);
    for (let i = 0; i < sorted.length - 1; i++) {
      if (sorted[i].count === sorted[i+1].count) {
        if (sorted[i].initial > sorted[i+1].initial) return false;
      } else {
        if (sorted[i].count < sorted[i+1].count) return false;
      }
    }
    return true;
  }
), { numRuns: 100 });

// Property 5: JST当月範囲の正確性
// Feature: call-ranking-display, Property 5: from <= to かつ from は1日、to は末日
fc.assert(fc.property(
  fc.date(),
  (date) => {
    const { from, to } = calculateMonthRange(date);
    return from <= to && from.endsWith('-01') && isLastDayOfMonth(to);
  }
), { numRuns: 100 });
```

### 統合テスト（例）

- `GET /api/sellers/call-ranking`が認証なしで401を返すこと
- `GET /api/sellers/call-ranking`が正しいレスポンス形式を返すこと
- データが空の場合に`rankings: []`を返すこと
