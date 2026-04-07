# 設計ドキュメント：追客電話ランキング機能

## 概要

売主管理システムの通話モードページに「追客電話ランキング」機能を追加します。この機能は、Google Spreadsheetの「売主追客ログ」シートから当月のデータを集計し、スタッフ別の追客電話件数をランキング形式で表示します。

既存の「1番電話月間ランキング」機能と同じアーキテクチャパターンを使用し、以下の構成で実装します：

- **バックエンド**: `/api/sellers/call-tracking-ranking` エンドポイント
- **フロントエンド**: 既存の`CallRankingDisplay`コンポーネントを再利用
- **データソース**: Google Spreadsheet「売主追客ログ」（ID: `1wKBRLWbT6pSKa9IlTDabjhjTnfs_GxX6Rn6M6kbio1I`）

## アーキテクチャ

### システム構成図

```
┌─────────────────────────────────────────────────────────────┐
│                     通話モードページ                          │
│                   (/sellers/:id/call)                        │
│                                                              │
│  ┌────────────────────────────────────────────────────┐    │
│  │  左列：追客ログセクション                            │    │
│  │                                                     │    │
│  │  ┌──────────────────────────────────────┐         │    │
│  │  │  CallRankingDisplay                  │         │    │
│  │  │  (title="追客電話月間ランキング")     │         │    │
│  │  │  (endpoint="/call-tracking-ranking") │         │    │
│  │  └──────────────────────────────────────┘         │    │
│  │                                                     │    │
│  │  ┌──────────────────────────────────────┐         │    │
│  │  │  追客ログ一覧                         │         │    │
│  │  └──────────────────────────────────────┘         │    │
│  └────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────┘
                            │
                            │ HTTP GET
                            ▼
┌─────────────────────────────────────────────────────────────┐
│              バックエンドAPI (backend/src/)                   │
│                                                              │
│  GET /api/sellers/call-tracking-ranking                     │
│  ┌────────────────────────────────────────────────────┐    │
│  │  1. Google Sheets APIでデータ取得                   │    │
│  │  2. 当月データをフィルタリング（東京時間）           │    │
│  │  3. E列・F列のイニシャルを集計                      │    │
│  │  4. 降順ソート（件数→イニシャル）                   │    │
│  │  5. JSONレスポンスを返す                            │    │
│  └────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────┘
                            │
                            │ Google Sheets API v4
                            ▼
┌─────────────────────────────────────────────────────────────┐
│          Google Spreadsheet「売主追客ログ」                   │
│          (ID: 1wKBRLWbT6pSKa9IlTDabjhjTnfs_GxX6Rn6M6kbio1I) │
│                                                              │
│  A列: 日付 | E列: 1回目イニシャル | F列: 2回目イニシャル     │
└─────────────────────────────────────────────────────────────┘
```

### データフロー

1. **ページロード時**
   - 通話モードページが`CallRankingDisplay`コンポーネントをマウント
   - コンポーネントが`/api/sellers/call-tracking-ranking`にGETリクエスト

2. **バックエンド処理**
   - `GoogleSheetsClient`を使用してスプレッドシートからデータ取得
   - A列の日付を東京時間で解析し、当月のデータのみをフィルタリング
   - E列・F列のイニシャルを集計（両方にイニシャルがある場合は両方カウント）
   - 件数降順、同数の場合はイニシャル昇順でソート

3. **フロントエンド表示**
   - ランキングデータを受信
   - 上位5名をデフォルト表示
   - 6名以上の場合は「残りN名を表示」ボタンを表示

## コンポーネントとインターフェース

### バックエンドAPI

#### エンドポイント

```typescript
GET /api/sellers/call-tracking-ranking
```

#### レスポンス形式

```typescript
interface CallTrackingRankingResponse {
  period: {
    from: string;  // "2026-04-01"
    to: string;    // "2026-04-30"
  };
  rankings: Array<{
    initial: string;  // スタッフのイニシャル
    count: number;    // 追客電話件数
  }>;
  updatedAt: string;  // ISO 8601形式のタイムスタンプ
}
```

#### エラーレスポンス

```typescript
interface ErrorResponse {
  error: {
    code: string;
    message: string;
    retryable: boolean;
  };
}
```

### フロントエンドコンポーネント

#### CallRankingDisplay（既存コンポーネントを再利用）

```typescript
interface CallRankingDisplayProps {
  title?: string;           // ランキングのタイトル（デフォルト: "1番電話月間ランキング"）
  endpoint?: string;        // APIエンドポイント（デフォルト: "/api/sellers/call-ranking"）
  allowedInitials?: string[]; // 表示対象のイニシャル一覧（未指定時は全件表示）
}
```

**使用例**:

```tsx
<CallRankingDisplay
  title="追客電話月間ランキング"
  endpoint="/api/sellers/call-tracking-ranking"
/>
```

### Google Sheets連携

#### GoogleSheetsClient（既存サービスを使用）

```typescript
class GoogleSheetsClient {
  constructor(config: GoogleSheetsConfig);
  async authenticate(): Promise<void>;
  async readRawRange(range: string): Promise<string[][]>;
}

interface GoogleSheetsConfig {
  spreadsheetId: string;
  sheetName: string;
  serviceAccountKeyPath: string;
}
```

## データモデル

### スプレッドシート構造

**シート名**: 「売主追客ログ」

| 列 | カラム名 | データ型 | 説明 |
|----|---------|---------|------|
| A | 日付 | Date | 追客電話の日付（例: 2026/4/15） |
| E | 1回目イニシャル | String | 1回目の電話担当者のイニシャル |
| F | 2回目イニシャル | String | 2回目の電話担当者のイニシャル |

### 集計ロジック

1. **日付フィルタリング**
   - A列の日付を東京時間（Asia/Tokyo）で解析
   - 当月（1日～月末）のデータのみを対象

2. **イニシャルカウント**
   - E列にイニシャルがある場合: そのイニシャルの件数+1
   - F列にイニシャルがある場合: そのイニシャルの件数+1
   - E列とF列の両方にイニシャルがある場合: 両方カウント
   - E列とF列が両方とも空欄の場合: 除外

3. **ソート**
   - 第1キー: 件数（降順）
   - 第2キー: イニシャル（昇順）

### データ例

**スプレッドシートデータ**:

| A列（日付） | E列（1回目） | F列（2回目） |
|-----------|------------|------------|
| 2026/4/1  | Y          |            |
| 2026/4/2  | I          | Y          |
| 2026/4/3  | Y          |            |
| 2026/4/4  |            |            |
| 2026/4/5  | I          |            |

**集計結果**:

```json
{
  "period": { "from": "2026-04-01", "to": "2026-04-30" },
  "rankings": [
    { "initial": "Y", "count": 3 },
    { "initial": "I", "count": 2 }
  ],
  "updatedAt": "2026-04-15T10:30:00.000Z"
}
```

## エラーハンドリング

### エラーケース

1. **Google Spreadsheetへのアクセス失敗**
   - ステータスコード: 500
   - エラーコード: `SPREADSHEET_ACCESS_ERROR`
   - メッセージ: 「スプレッドシートへのアクセスに失敗しました」
   - 再試行可能: true

2. **データ取得タイムアウト**
   - タイムアウト時間: 5秒
   - ステータスコード: 500
   - エラーコード: `TIMEOUT_ERROR`
   - メッセージ: 「データの取得がタイムアウトしました」
   - 再試行可能: true

3. **データが空**
   - ステータスコード: 200
   - レスポンス: `{ rankings: [] }`
   - フロントエンド表示: 「今月はまだ記録がありません」

4. **日付解析エラー**
   - 無効な日付形式のレコードは除外
   - ログに警告を出力
   - 処理は継続

### エラーハンドリング実装

```typescript
try {
  // データ取得処理
} catch (error) {
  console.error('Call tracking ranking error:', error);
  res.status(500).json({
    error: {
      code: 'CALL_TRACKING_RANKING_ERROR',
      message: error instanceof Error ? error.message : 'Failed to get call tracking ranking',
      retryable: true,
    },
  });
}
```

## テスト戦略

### ユニットテスト

1. **日付フィルタリングロジック**
   - 当月のデータのみが抽出されることを確認
   - 東京時間で正しく判定されることを確認
   - 無効な日付が除外されることを確認

2. **イニシャル集計ロジック**
   - E列のみにイニシャルがある場合
   - F列のみにイニシャルがある場合
   - E列とF列の両方にイニシャルがある場合
   - E列とF列が両方とも空欄の場合

3. **ソートロジック**
   - 件数降順でソートされることを確認
   - 同数の場合はイニシャル昇順でソートされることを確認

### 統合テスト

1. **APIエンドポイント**
   - 正常系: 200レスポンスとランキングデータが返されることを確認
   - 異常系: エラーレスポンスが正しく返されることを確認

2. **Google Sheets連携**
   - スプレッドシートからデータが正しく取得できることを確認
   - サービスアカウント認証が正しく動作することを確認

### E2Eテスト

1. **通話モードページ**
   - ページロード時にランキングが表示されることを確認
   - 「更新」ボタンでランキングが再取得されることを確認
   - 「残りN名を表示」ボタンで全スタッフが表示されることを確認

2. **エラーハンドリング**
   - データ取得失敗時にエラーメッセージが表示されることを確認
   - 「再試行」ボタンでデータ取得が再実行されることを確認

## 実装計画

### Phase 1: バックエンドAPI実装

1. **エンドポイント作成**
   - `backend/src/routes/sellers.ts`に`/call-tracking-ranking`エンドポイントを追加
   - 既存の`/call-ranking`エンドポイントを参考に実装

2. **Google Sheets連携**
   - `GoogleSheetsClient`を使用してデータ取得
   - スプレッドシートID: `1wKBRLWbT6pSKa9IlTDabjhjTnfs_GxX6Rn6M6kbio1I`
   - シート名: 「売主追客ログ」
   - 取得範囲: A列、E列、F列

3. **データ処理**
   - 日付フィルタリング（東京時間）
   - イニシャル集計
   - ソート

### Phase 2: フロントエンド実装

1. **CallRankingDisplayコンポーネント拡張**
   - `title`プロパティを追加（デフォルト: "1番電話月間ランキング"）
   - `endpoint`プロパティを追加（デフォルト: "/api/sellers/call-ranking"）

2. **通話モードページ統合**
   - `CallModePage.tsx`に追客電話ランキングを追加
   - 左列「追客ログ」セクションの一番上に配置

### Phase 3: テストとデプロイ

1. **ユニットテスト作成**
2. **統合テスト実行**
3. **E2Eテスト実行**
4. **デプロイ**

## パフォーマンス考慮事項

### データ取得の最適化

1. **タイムアウト設定**
   - Google Sheets API呼び出しのタイムアウト: 5秒
   - フロントエンドのHTTPリクエストタイムアウト: 5秒

2. **データ量の制限**
   - スプレッドシートから取得するデータは当月のみ
   - 最大でも31日分のデータ

3. **キャッシング**
   - 現時点ではキャッシングは実装しない
   - 将来的に必要に応じて検討

### レスポンスタイム目標

- **目標**: 2秒以内
- **許容**: 5秒以内（タイムアウト）

## セキュリティ考慮事項

### 認証・認可

1. **APIエンドポイント**
   - 既存の認証ミドルウェア（`authenticate`）を使用
   - ログイン済みユーザーのみアクセス可能

2. **Google Sheets API**
   - サービスアカウント認証を使用
   - 環境変数`GOOGLE_SERVICE_ACCOUNT_KEY_PATH`からキーを読み込み

### データ保護

1. **個人情報**
   - イニシャルのみを扱うため、個人情報は含まれない

2. **スプレッドシートID**
   - ハードコードせず、環境変数または設定ファイルで管理
   - 本設計では要件に従いハードコード（`1wKBRLWbT6pSKa9IlTDabjhjTnfs_GxX6Rn6M6kbio1I`）

## デプロイ手順

### 環境変数

既存の環境変数を使用：

```bash
GOOGLE_SERVICE_ACCOUNT_KEY_PATH=./google-service-account.json
```

### デプロイコマンド

```bash
# バックエンド
cd backend
npm run build
vercel --prod

# フロントエンド
cd frontend/frontend
npm run build
vercel --prod
```

## 監視とロギング

### ログ出力

1. **成功時**
   ```
   [CallTrackingRanking] Successfully fetched ranking data (X entries)
   ```

2. **エラー時**
   ```
   [CallTrackingRanking] Error: <error message>
   ```

### メトリクス

- APIレスポンスタイム
- エラー率
- データ取得成功率

## 今後の拡張性

### 将来的な機能追加

1. **期間指定**
   - クエリパラメータで期間を指定可能にする
   - 例: `/call-tracking-ranking?month=2026-03`

2. **キャッシング**
   - Redis等を使用してランキングデータをキャッシュ
   - TTL: 1時間

3. **リアルタイム更新**
   - WebSocketを使用してリアルタイムでランキングを更新

4. **詳細統計**
   - 日別の推移グラフ
   - スタッフ別の詳細統計

## 参考資料

- 既存の1番電話月間ランキング実装: `backend/src/routes/sellers.ts` (line 359)
- CallRankingDisplayコンポーネント: `frontend/frontend/src/components/CallRankingDisplay.tsx`
- GoogleSheetsClient: `backend/src/services/GoogleSheetsClient.ts`
- Google Sheets API v4ドキュメント: https://developers.google.com/sheets/api/reference/rest

---

**作成日**: 2026年4月15日  
**作成者**: Kiro AI  
**レビュー状態**: 未レビュー
