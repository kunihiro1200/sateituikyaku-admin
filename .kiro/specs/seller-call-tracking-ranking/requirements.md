# 要件ドキュメント：追客電話ランキング機能

## はじめに

売主管理システムの通話モードページに「追客電話ランキング」機能を追加します。この機能は、Google Spreadsheetの「売主追客ログ」シートから当月のデータを集計し、スタッフ別の追客電話件数をランキング形式で表示します。既存の「1番電話月間ランキング」と同じUIパターンを使用します。

## 用語集

- **System**: 売主管理システム（売主詳細・通話モードページを含む社内管理システム）
- **CallModePage**: 通話モードページ（`/sellers/:id/call`）
- **Ranking_Display**: ランキング表示コンポーネント（既存の`CallRankingDisplay`と同じパターン）
- **Spreadsheet_Service**: Google Spreadsheetからデータを取得するサービス
- **Backend_API**: バックエンドAPIエンドポイント（`backend/src/routes/sellers.ts`）
- **追客ログシート**: Google Spreadsheet「売主追客ログ」シート（ID: `1wKBRLWbT6pSKa9IlTDabjhjTnfs_GxX6Rn6M6kbio1I`）
- **当月**: 東京時間（Asia/Tokyo）の現在の月
- **イニシャル**: スタッフのイニシャル（E列またはF列に記録）

## 要件

### 要件1: 追客電話ランキングの表示

**ユーザーストーリー**: スタッフとして、当月の追客電話件数をランキング形式で確認したい。これにより、チーム内での活動状況を把握できる。

#### 受入基準

1. WHEN 通話モードページを開く、THE System SHALL 追客ログシートから当月のデータを取得する
2. THE System SHALL A列の日付が当月（東京時間）のデータのみを対象とする
3. THE System SHALL E列またはF列にイニシャルが入っているデータをカウントする
4. THE System SHALL イニシャル別に件数を集計し、降順でランキングを表示する
5. THE Ranking_Display SHALL 既存の「1番電話月間ランキング」と同じUIスタイルを使用する
6. THE Ranking_Display SHALL 通話モードページの左列「追客ログ」セクションの一番上に配置される

### 要件2: データソースの定義

**ユーザーストーリー**: システム管理者として、追客電話ランキングのデータソースを明確に定義したい。これにより、正しいデータが集計されることを保証できる。

#### 受入基準

1. THE System SHALL Google Spreadsheet ID `1wKBRLWbT6pSKa9IlTDabjhjTnfs_GxX6Rn6M6kbio1I` を使用する
2. THE System SHALL シート名「売主追客ログ」からデータを取得する
3. THE System SHALL A列を日付列として扱う
4. THE System SHALL E列を「1回目イニシャル」列として扱う
5. THE System SHALL F列を「2回目イニシャル」列として扱う
6. WHEN E列またはF列にイニシャルが入っている、THE System SHALL そのレコードを集計対象とする

### 要件3: 日付フィルタリング

**ユーザーストーリー**: スタッフとして、当月のデータのみが集計されることを確認したい。これにより、最新の活動状況を正確に把握できる。

#### 受入基準

1. THE System SHALL 東京時間（Asia/Tokyo）を使用して当月を判定する
2. THE System SHALL 当月の開始日（1日）から終了日（月末）までのデータを対象とする
3. WHEN A列の日付が当月の範囲外、THE System SHALL そのレコードを除外する
4. WHEN A列の日付が空欄、THE System SHALL そのレコードを除外する
5. WHEN A列の日付が無効な形式、THE System SHALL そのレコードを除外する

### 要件4: イニシャルのカウントロジック

**ユーザーストーリー**: スタッフとして、E列とF列のイニシャルが正しくカウントされることを確認したい。これにより、追客電話の実績が正確に反映される。

#### 受入基準

1. WHEN E列にイニシャルが入っている、THE System SHALL そのイニシャルの件数を1増やす
2. WHEN F列にイニシャルが入っている、THE System SHALL そのイニシャルの件数を1増やす
3. WHEN E列とF列の両方にイニシャルが入っている、THE System SHALL 両方のイニシャルをカウントする
4. WHEN E列とF列が両方とも空欄、THE System SHALL そのレコードを除外する
5. THE System SHALL イニシャルの大文字・小文字を区別してカウントする

### 要件5: ランキング表示のUI

**ユーザーストーリー**: スタッフとして、ランキングを見やすい形式で確認したい。これにより、チーム内での順位を一目で把握できる。

#### 受入基準

1. THE Ranking_Display SHALL 既存の`CallRankingDisplay`コンポーネントと同じUIパターンを使用する
2. THE Ranking_Display SHALL 1位に金色のトロフィーアイコン（🏆）を表示する
3. THE Ranking_Display SHALL 2位に銀色の背景を表示する
4. THE Ranking_Display SHALL 3位に銅色の背景を表示する
5. THE Ranking_Display SHALL 各順位にイニシャルと件数を表示する
6. THE Ranking_Display SHALL 件数の多い順にソートする
7. WHEN 件数が同じ、THE System SHALL イニシャルのアルファベット順にソートする
8. THE Ranking_Display SHALL デフォルトで上位5名を表示する
9. WHEN 6名以上のスタッフがいる、THE Ranking_Display SHALL 「残りN名を表示」ボタンを表示する
10. WHEN 「残りN名を表示」ボタンをクリック、THE Ranking_Display SHALL 全スタッフを表示する

### 要件6: 配置場所

**ユーザーストーリー**: スタッフとして、追客電話ランキングを通話モードページの左列で確認したい。これにより、追客ログと一緒に確認できる。

#### 受入基準

1. THE System SHALL 追客電話ランキングを通話モードページの左列に配置する
2. THE System SHALL 追客電話ランキングを「追客ログ」セクションの一番上に配置する
3. THE System SHALL 既存の「1番電話月間ランキング」と同じスタイルで表示する
4. THE System SHALL 追客電話ランキングと追客ログの間に適切な余白を設ける

### 要件7: エラーハンドリング

**ユーザーストーリー**: スタッフとして、データ取得に失敗した場合でもシステムが正常に動作することを確認したい。これにより、安定したユーザー体験を得られる。

#### 受入基準

1. WHEN Google Spreadsheetへのアクセスに失敗、THE System SHALL エラーメッセージを表示する
2. WHEN データ取得がタイムアウト、THE System SHALL 「データの取得がタイムアウトしました」と表示する
3. WHEN データが空、THE System SHALL 「今月はまだ記録がありません」と表示する
4. WHEN エラーが発生、THE System SHALL 「再試行」ボタンを表示する
5. WHEN 「再試行」ボタンをクリック、THE System SHALL データ取得を再実行する

### 要件8: パフォーマンス

**ユーザーストーリー**: スタッフとして、ランキングが素早く表示されることを確認したい。これにより、ストレスなく通話モードページを使用できる。

#### 受入基準

1. THE System SHALL データ取得のタイムアウトを5秒に設定する
2. THE System SHALL データ取得中にローディングインジケーターを表示する
3. THE System SHALL データ取得完了後、即座にランキングを表示する
4. THE System SHALL 既存の「1番電話月間ランキング」と同じパフォーマンスを維持する

### 要件9: バックエンドAPIエンドポイント

**ユーザーストーリー**: 開発者として、追客電話ランキングのデータを取得するAPIエンドポイントを実装したい。これにより、フロントエンドがデータを取得できる。

#### 受入基準

1. THE Backend_API SHALL `/api/sellers/call-tracking-ranking` エンドポイントを提供する
2. THE Backend_API SHALL GETメソッドでアクセス可能にする
3. THE Backend_API SHALL Google Spreadsheet APIを使用してデータを取得する
4. THE Backend_API SHALL 当月のデータのみをフィルタリングする
5. THE Backend_API SHALL イニシャル別に件数を集計する
6. THE Backend_API SHALL 以下の形式でJSONレスポンスを返す:
   ```json
   {
     "period": { "from": "2026-04-01", "to": "2026-04-30" },
     "rankings": [
       { "initial": "Y", "count": 15 },
       { "initial": "I", "count": 12 }
     ],
     "updatedAt": "2026-04-15T10:30:00.000Z"
   }
   ```
7. WHEN エラーが発生、THE Backend_API SHALL 500ステータスコードとエラーメッセージを返す

### 要件10: Google Spreadsheet連携

**ユーザーストーリー**: 開発者として、Google Spreadsheet APIを使用してデータを取得したい。これにより、追客ログシートのデータを集計できる。

#### 受入基準

1. THE Spreadsheet_Service SHALL Google Sheets API v4を使用する
2. THE Spreadsheet_Service SHALL サービスアカウント認証を使用する
3. THE Spreadsheet_Service SHALL 環境変数`GOOGLE_SERVICE_ACCOUNT_KEY_PATH`からサービスアカウントキーを読み込む
4. THE Spreadsheet_Service SHALL シート名「売主追客ログ」からデータを取得する
5. THE Spreadsheet_Service SHALL A列、E列、F列のデータを取得する
6. THE Spreadsheet_Service SHALL データ取得時にエラーハンドリングを実装する
