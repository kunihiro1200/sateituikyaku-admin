# Design Document: 買主リストサイドバー新カテゴリ追加

## Overview

買主リストのサイドバーに5つの新しいカテゴリを追加し、GASでカウント計算を行い、フロントエンドで赤字表示とフィルタリング機能を実装します。

### 目的

- 問合メール未対応、業者問合せあり、一般媒介内覧後売主連絡未、要内覧促進客、ピンリッチ未登録の買主を効率的に管理
- 対応漏れを防ぐための視覚的な通知（赤字表示）
- 既存のサイドバーカテゴリと同様のUX（クリックでフィルタリング）

### スコープ

**含まれるもの**:
- GASでの5つの新カテゴリのカウント計算ロジック
- `buyer_sidebar_counts`テーブルへのカウント保存
- フロントエンドでの赤字表示
- フィルタリング機能の実装

**含まれないもの**:
- 既存カテゴリの変更
- サイドバー以外のUI変更

---

## Architecture

### システム構成

```
[Google Spreadsheet]
  ↓ (10分ごと)
[GAS: syncBuyerList()]
  ↓
[GAS: updateBuyerSidebarCounts_()]
  ↓ (Supabase API)
[buyer_sidebar_counts テーブル]
  ↓ (HTTP GET)
[Backend API: /api/buyers/sidebar-counts]
  ↓
[Frontend: BuyerStatusSidebar.tsx]
  ↓
[User: カテゴリクリック]
  ↓
[Frontend: BuyersPage.tsx]
  ↓ (フィルタリング)
[Backend API: /api/buyers?category=xxx]
```

### データフロー

1. **GAS → Database**: 10分ごとにカウント計算して保存
2. **Database → Frontend**: APIでカウント取得
3. **Frontend**: サイドバー表示とフィルタリング

---

## Components and Interfaces

### 1. GAS: カウント計算関数

**ファイル**: `gas_buyer_complete_code.js`

**新規関数**: `updateBuyerSidebarCounts_()`

**責務**:
- スプレッドシートから全買主データを読み取る
- 5つの新カテゴリの条件式に基づいてカウント
- `buyer_sidebar_counts`テーブルに保存

**呼び出し元**: `syncBuyerList()`（既存の10分トリガー関数）

### 2. Database: buyer_sidebar_countsテーブル

**テーブル名**: `buyer_sidebar_counts`

**スキーマ**:
```sql
CREATE TABLE buyer_sidebar_counts (
  id SERIAL PRIMARY KEY,
  category TEXT NOT NULL,
  count INTEGER NOT NULL DEFAULT 0,
  label TEXT,
  assignee TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

**カテゴリ値**:
- `inquiryEmailUnanswered` - 問合メール未対応
- `brokerInquiry` - 業者問合せあり
- `generalViewingSellerContactPending` - 一般媒介_内覧後売主連絡未
- `viewingPromotionRequired` - 要内覧促進客
- `pinrichUnregistered` - ピンリッチ未登録

### 3. Backend API

**エンドポイント**: `/api/buyers/sidebar-counts`

**メソッド**: GET

**レスポンス**:
```typescript
{
  inquiryEmailUnanswered: number;
  brokerInquiry: number;
  generalViewingSellerContactPending: number;
  viewingPromotionRequired: number;
  pinrichUnregistered: number;
}
```

### 4. Frontend: BuyerStatusSidebar.tsx

**責務**:
- サイドバーに新カテゴリを赤字で表示
- カウント数をバッジで表示
- クリック時にフィルタリング

**新規Props**:
```typescript
interface CategoryCounts {
  // 既存
  all?: number;
  viewingDayBefore?: number;
  todayCall?: number;
  threeCallUnchecked?: number;
  assignedCounts?: Record<string, number>;
  todayCallAssignedCounts?: Record<string, number>;
  
  // 新規
  inquiryEmailUnanswered?: number;
  brokerInquiry?: number;
  generalViewingSellerContactPending?: number;
  viewingPromotionRequired?: number;
  pinrichUnregistered?: number;
}
```

### 5. Frontend: BuyersPage.tsx

**責務**:
- カテゴリ選択時にフィルタリング条件を構築
- APIに条件を渡して買主リストを取得

---

## Data Models

### 買主データ（Spreadsheet）

**必要なカラム**:
- `【問合メール】電話対応` (inquiry_email_phone)
- `【問合メール】メール返信` (inquiry_email_reply)
- `●内覧日(最新）` (viewing_date)
- `業者向けアンケート` (broker_survey)
- `内覧形態_一般媒介` (viewing_type_general)
- `内覧後売主連絡` (post_viewing_seller_contact)
- `受付日` (reception_date)
- `後続担当` (follow_up_assignee)
- `★最新状況` (latest_status)
- `内覧促進メール不要` (viewing_promotion_unnecessary)
- `内覧促進メール送信者` (viewing_promotion_sender)
- `業者問合せ` (broker_inquiry)
- `●問合せ元` (inquiry_source)
- `●問合時確度` (inquiry_confidence)
- `Pinrich` (pinrich_status)
- `●メアド` (email)

### カウントデータ（Database）

```typescript
interface SidebarCount {
  id: number;
  category: string;
  count: number;
  label: string | null;
  assignee: string | null;
  updated_at: string;
}
```

---

## Error Handling

### GAS側

**エラーケース**:
1. Supabase API接続失敗
2. スプレッドシート読み取り失敗
3. データ型変換エラー

**対応**:
- `try-catch`でエラーをキャッチ
- `Logger.log()`でエラー詳細を記録
- 次回の10分トリガーで再試行

**実装例**:
```javascript
function updateBuyerSidebarCounts_() {
  try {
    // カウント計算処理
  } catch (error) {
    Logger.log('❌ [ERROR] updateBuyerSidebarCounts_: ' + error.message);
    Logger.log(error.stack);
    // エラーを投げずに終了（次回の実行を継続）
  }
}
```

### Backend API側

**エラーケース**:
1. データベース接続失敗
2. データ取得失敗

**対応**:
- HTTPステータスコード500を返す
- エラーメッセージをログに記録

### Frontend側

**エラーケース**:
1. API呼び出し失敗
2. データ形式不正

**対応**:
- ローディング状態を表示
- エラーメッセージを表示（Snackbar）
- 再試行ボタンを提供

---

## Testing Strategy

### Unit Tests

**GAS側**:
- 各カテゴリの条件式ロジックをテスト
- モックデータで期待されるカウントを検証

**Backend側**:
- APIエンドポイントのレスポンス形式をテスト
- データベースクエリの正確性をテスト

**Frontend側**:
- サイドバーコンポーネントのレンダリングをテスト
- フィルタリング条件の構築をテスト

### Integration Tests

- GAS → Database → Backend → Frontendの全体フローをテスト
- 実際のスプレッドシートデータでカウントが正しいか検証

### Manual Tests

- 各カテゴリをクリックして正しくフィルタリングされるか確認
- カウント数が赤字で表示されるか確認
- カウントが0の場合に非表示になるか確認

---

## Implementation Plan

### Phase 1: GASカウント計算ロジック

1. `updateBuyerSidebarCounts_()`関数を実装
2. 5つのカテゴリの条件式を実装
3. Supabase APIでカウントを保存
4. `syncBuyerList()`から呼び出し

### Phase 2: Backend API

1. `/api/buyers/sidebar-counts`エンドポイントを実装
2. `buyer_sidebar_counts`テーブルからカウントを取得
3. レスポンス形式を整形

### Phase 3: Frontend表示

1. `BuyerStatusSidebar.tsx`に新カテゴリを追加
2. 赤字スタイルを適用
3. カウント数をバッジで表示

### Phase 4: Frontendフィルタリング

1. `BuyersPage.tsx`でカテゴリ選択時の処理を実装
2. フィルタリング条件を構築
3. APIに条件を渡して買主リストを取得

### Phase 5: テストとデプロイ

1. 各フェーズでテストを実行
2. 本番環境にデプロイ
3. 動作確認

---

## Deployment

### GAS

1. `gas_buyer_complete_code.js`を更新
2. Google Apps Scriptエディタにコピー＆ペースト
3. 保存して手動実行でテスト

### Backend

1. コードをコミット
2. `git push origin main`
3. Vercelで自動デプロイ

### Frontend

1. コードをコミット
2. `git push origin main`
3. Vercelで自動デプロイ

---

## Maintenance

### モニタリング

- GASの実行ログを定期的に確認
- `buyer_sidebar_counts`テーブルの更新日時を確認
- フロントエンドのエラーログを確認

### 更新手順

**新しいカテゴリを追加する場合**:
1. GASの`updateBuyerSidebarCounts_()`に条件式を追加
2. Backend APIのレスポンス型を更新
3. Frontendの`CategoryCounts`型を更新
4. Frontendのサイドバーに表示ロジックを追加

---

## Appendix

### カテゴリ条件式の詳細

#### 1. 問合メール未対応

```javascript
// 条件1: 【問合メール】電話対応 = "未"
row['【問合メール】電話対応'] === '未'

// 条件2: 【問合メール】メール返信 = "未"
row['【問合メール】メール返信'] === '未'

// 条件3: 複合条件
(
  !row['●内覧日(最新）'] &&
  (row['【問合メール】電話対応'] === '不要' || row['【問合メール】電話対応'] === '不要') &&
  (row['【問合メール】メール返信'] === '未' || !row['【問合メール】メール返信'])
)
```

#### 2. 業者問合せあり

```javascript
row['業者向けアンケート'] === '未'
```

#### 3. 一般媒介_内覧後売主連絡未

```javascript
// 条件1: 日付範囲条件
(
  row['●内覧日(最新）'] >= '2026-03-20' &&
  row['●内覧日(最新）'] < todayStr &&
  row['内覧形態_一般媒介'] &&
  (row['内覧後売主連絡'] === '未' || !row['内覧後売主連絡'])
)

// 条件2: 直接条件
row['内覧後売主連絡'] === '未'
```

#### 4. 要内覧促進客

```javascript
(
  row['受付日'] >= (today - 14日) &&
  row['受付日'] <= (today - 4日) &&
  !row['●内覧日(最新）'] &&
  !row['後続担当'] &&
  !row['★最新状況'] &&
  row['内覧促進メール不要'] !== '不要' &&
  !row['内覧促進メール送信者'] &&
  !row['業者問合せ'] &&
  row['●問合せ元'] !== '配信希望アンケート' &&
  !row['●問合せ元'].includes('ピンリッチ') &&
  row['●問合時確度'] !== 'e（買付物件の問合せ）' &&
  row['●問合時確度'] !== 'd（資料送付不要、条件不適合など）' &&
  row['●問合時確度'] !== 'b（内覧検討）'
)
```

#### 5. ピンリッチ未登録

```javascript
// 条件1: Pinrichが空
(
  !row['Pinrich'] &&
  row['●メアド'] &&
  !row['業者問合せ']
)

// 条件2: Pinrich = "登録無し"
(
  row['Pinrich'] === '登録無し' &&
  row['●メアド'] &&
  !row['業者問合せ']
)
```

---

**最終更新日**: 2026年4月6日  
**作成者**: Kiro AI  
**バージョン**: 1.0
