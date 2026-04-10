# 設計ドキュメント：買付率計算における業者問合せ買主の除外

## 概要

買付率統計ページ（BuyerPurchaseRateStatisticsPage）で使用される集計ロジックから、`broker_inquiry` カラムに値が入っている業者問合せ買主を除外する。

変更はバックエンドの `BuyerService.ts` のみに限定され、フロントエンドおよびAPIレスポンス形式への変更は不要。

### 対象ファイル

- **バックエンド（主要変更）**: `backend/src/services/BuyerService.ts`

---

## アーキテクチャ

```
フロントエンド (BuyerPurchaseRateStatisticsPage.tsx)
  │
  │  GET /api/buyers/purchase-rate-statistics
  │
  ▼
バックエンド (buyers.ts route)
  │
  ▼
BuyerService.getPurchaseRateStatistics()
  │  1. Supabaseクエリに broker_inquiry カラムを追加
  │
  ▼
BuyerService.groupByMonthAndAssignee()
  │  2. GYOSHA除外と同じ段階で broker_inquiry に値がある買主を除外
  │
  ▼
BuyerService.calculateMonthlyStatistics()
  │  3. 除外後の買主のみで内覧件数・買付件数を集計
  │
  ▼
purchaseRateStatisticsCache
  │  4. 除外後のデータをキャッシュに保存
  │
  ▼
フロントエンドへレスポンス（形式変更なし）
```

---

## コンポーネントとインターフェース

### 変更対象メソッド

#### 1. `getPurchaseRateStatistics()` — Supabaseクエリの変更

`broker_inquiry` カラムをSELECT句に追加する。

```typescript
// 変更前
.select('viewing_date, latest_status, follow_up_assignee, email, phone_number')

// 変更後
.select('viewing_date, latest_status, follow_up_assignee, email, phone_number, broker_inquiry')
```

#### 2. `groupByMonthAndAssignee()` — 業者問合せ除外ロジックの追加

既存の `GYOSHA` 除外処理と同じ段階で、`broker_inquiry` に値がある買主を除外する。

```typescript
private groupByMonthAndAssignee(buyers: any[]): Map<string, Map<string, any[]>> {
  const grouped = new Map<string, Map<string, any[]>>();

  for (const buyer of buyers) {
    const viewingDate = new Date(buyer.viewing_date);
    const month = `${viewingDate.getFullYear()}年${viewingDate.getMonth() + 1}月`;
    const assignee = buyer.follow_up_assignee || '未設定';

    // GYOSHAを除外（既存）
    if (assignee === 'GYOSHA') {
      continue;
    }

    // 業者問合せ買主を除外（新規追加）
    if (isVendorBuyer(buyer.broker_inquiry)) {
      continue;
    }

    // ... 以降は既存ロジック
  }
  return grouped;
}
```

### ヘルパー関数

業者問合せ判定ロジックをヘルパー関数として定義する。

```typescript
/**
 * 業者問合せ買主かどうかを判定する
 * broker_inquiry が null、空文字列、'0' の場合は通常買主（除外しない）
 * それ以外の値が入っている場合は業者問合せ買主（除外する）
 */
function isVendorBuyer(brokerInquiry: string | null | undefined): boolean {
  if (brokerInquiry === null || brokerInquiry === undefined) return false;
  if (brokerInquiry === '') return false;
  if (brokerInquiry === '0') return false;
  return true;
}
```

---

## データモデル

### buyersテーブル（既存）

| カラム名 | 型 | 説明 |
|---------|-----|------|
| `broker_inquiry` | `text \| null` | 業者問合せフラグ。null・空文字・'0' = 通常買主、それ以外 = 業者問合せ買主 |
| `viewing_date` | `date` | 内覧日 |
| `latest_status` | `text` | 最新ステータス（「買（」を含む場合は買付） |
| `follow_up_assignee` | `text` | 後続担当者 |
| `email` | `text` | メールアドレス（重複排除に使用） |
| `phone_number` | `text` | 電話番号（重複排除に使用） |

### 業者問合せ判定ルール

| `broker_inquiry` の値 | 判定 | 集計対象 |
|----------------------|------|---------|
| `null` | 通常買主 | ✅ 含める |
| `''`（空文字列） | 通常買主 | ✅ 含める |
| `'0'` | 通常買主 | ✅ 含める |
| `'1'`、`'業者'` 等 | 業者問合せ | ❌ 除外する |

---

## 正確性プロパティ

*プロパティとは、システムの全ての有効な実行において真であるべき特性または振る舞いのことです。プロパティは人間が読める仕様と機械で検証可能な正確性保証の橋渡しをします。*


### プロパティ 1: 業者問合せ買主は集計から除外される

*任意の* 買主リスト（業者問合せあり・なし混在）に対して、`groupByMonthAndAssignee` を実行した結果のグループには、`broker_inquiry` に null・空文字・'0' 以外の値を持つ買主のemail/phone_numberが含まれない。

**検証対象: 要件 1.1, 1.2, 2.1, 2.2, 3.2**

### プロパティ 2: 業者問合せ判定関数の正確性

*任意の* null・空文字・'0' 以外の文字列に対して、`isVendorBuyer` は `true` を返す。また、null・空文字・'0' に対しては `false` を返す。

**検証対象: 要件 1.3, 1.4**

### プロパティ 3: 内覧件数0の場合は買付率がnull

*任意の* 全員が業者問合せ買主であるリストに対して、集計後の `purchaseRate` は `null` になる。

**検証対象: 要件 2.4**

---

## エラーハンドリング

### Supabaseクエリエラー

`broker_inquiry` カラムの追加はSELECT句への追加のみであり、既存のエラーハンドリングで対応可能。クエリ失敗時は既存の `throw new Error(...)` が発火し、APIは500エラーを返す。

### `broker_inquiry` カラムが存在しない場合

Supabaseのクエリで存在しないカラムを指定した場合はエラーになる。ただし `broker_inquiry` は既存のDBカラムであるため、このケースは発生しない。

### `broker_inquiry` の型が予期しない場合

`isVendorBuyer` 関数は `string | null | undefined` を受け取る。DBから返る値が数値型の場合も `'0'` との比較は文字列比較になるため、`0`（数値）は除外されない可能性がある。ただし、DBカラムの型は `text` であるため、数値が返ることはない。

---

## テスト戦略

### ユニットテスト

以下の関数を対象にユニットテストを作成する。

**`isVendorBuyer` 関数**:
- `null` → `false`
- `''` → `false`
- `'0'` → `false`
- `'1'` → `true`
- `'業者'` → `true`
- 任意の非null・非空・非'0'文字列 → `true`

**`groupByMonthAndAssignee` メソッド**:
- 業者問合せ買主が含まれるリストを渡した場合、結果に業者問合せ買主が含まれないこと
- GYOSHA担当者と業者問合せ買主の両方が除外されること
- 通常買主のみのリストでは全員が集計対象になること

### プロパティベーステスト

プロパティベーステストには **fast-check**（TypeScript向けPBTライブラリ）を使用する。各テストは最低100回実行する。

**プロパティ 1: 業者問合せ買主は集計から除外される**

```typescript
// Feature: buyer-purchase-rate-vendor-exclusion, Property 1: 業者問合せ買主は集計から除外される
fc.assert(fc.property(
  fc.array(buyerArbitrary()),  // 業者問合せあり・なし混在の買主リスト
  (buyers) => {
    const grouped = service.groupByMonthAndAssignee(buyers);
    const vendorBuyers = buyers.filter(b => isVendorBuyer(b.broker_inquiry));
    const vendorKeys = new Set(vendorBuyers.map(b => `${b.email?.trim()||''}|${b.phone_number?.trim()||''}`));
    
    for (const [, assigneeMap] of grouped) {
      for (const [, buyerList] of assigneeMap) {
        for (const buyer of buyerList) {
          const key = `${buyer.email?.trim()||''}|${buyer.phone_number?.trim()||''}`;
          expect(vendorKeys.has(key)).toBe(false);
        }
      }
    }
  }
), { numRuns: 100 });
```

**プロパティ 2: 業者問合せ判定関数の正確性**

```typescript
// Feature: buyer-purchase-rate-vendor-exclusion, Property 2: 業者問合せ判定関数の正確性
fc.assert(fc.property(
  fc.string().filter(s => s !== '' && s !== '0'),  // null・空文字・'0'以外の文字列
  (brokerInquiry) => {
    expect(isVendorBuyer(brokerInquiry)).toBe(true);
  }
), { numRuns: 100 });
```

**プロパティ 3: 内覧件数0の場合は買付率がnull**

```typescript
// Feature: buyer-purchase-rate-vendor-exclusion, Property 3: 内覧件数0の場合は買付率がnull
fc.assert(fc.property(
  fc.array(vendorBuyerArbitrary()),  // 全員が業者問合せ買主
  (buyers) => {
    const grouped = service.groupByMonthAndAssignee(buyers);
    // 全員除外されるため、groupedは空になる
    expect(grouped.size).toBe(0);
  }
), { numRuns: 100 });
```

### インテグレーションテスト

- `getPurchaseRateStatistics` を実際のSupabaseに対して実行し、`broker_inquiry` カラムが取得されること
- キャッシュが正しく動作すること（2回目の呼び出しでキャッシュから返ること）

### スモークテスト

- `/api/buyers/purchase-rate-statistics` エンドポイントのレスポンス形式が変わらないこと（`month`, `total`, `assignees` フィールドを持つこと）
- 既存のテストスイートが引き続きパスすること
