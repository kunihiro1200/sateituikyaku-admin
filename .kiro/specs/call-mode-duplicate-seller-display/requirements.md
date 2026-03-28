# 要件定義書

## はじめに

通話モードページ（`CallModePage.tsx`）において、売主の電話番号またはメールアドレスが過去の反響と重複している場合に「重複」ボタンを表示し、押下すると反響ごとの詳細情報をモーダルで確認できる機能を追加する。

電話番号・メールアドレスはデータベース上で暗号化されているため、バックエンド側で復号後に比較を行う。既存の重複検出サービス（`DuplicateDetectionService`）を活用し、フロントエンドには重複先の売主情報を表示する。

---

## 用語集

- **System**: 本機能全体（フロントエンド＋バックエンドを含む社内管理システム）
- **DuplicateButton**: 通話モードページの物件情報エリアに表示される「重複」ボタン
- **DuplicateModal**: 重複売主の詳細情報を反響ごとに一覧表示するモーダルダイアログ
- **DuplicateDetectionService**: バックエンドの重複検出サービス（`backend/src/services/DuplicateDetectionService.ts`）
- **Seller**: 売主（`sellers`テーブルのレコード）
- **SellerNumber**: 売主番号（`seller_number`カラム、例: AA13501）
- **InquiryDate**: 反響日（`inquiry_date`カラム）
- **ConfidenceLevel**: 確度（`confidence_level`カラム）
- **Status**: 状況（当社）（`status`カラム）
- **NextCallDate**: 次電日（`next_call_date`カラム）
- **ValuationAmount**: 査定額（`valuation_amount_1/2/3`カラム）
- **Comments**: コメント（`comments`カラム）
- **PropertyAddress**: 物件所在地（`property_address`カラム）

---

## 要件

### 要件1：重複ボタンの表示

**ユーザーストーリー：** 担当者として、通話モードページで現在の売主が過去の反響と重複しているかどうかをひと目で確認したい。そうすることで、重複対応の漏れを防ぎ、適切な追客ができる。

#### 受け入れ基準

1. WHEN 通話モードページが読み込まれる, THE System SHALL 現在の売主の電話番号またはメールアドレスと一致する他の売主をバックエンドAPIで検索する
2. WHEN 重複する売主が1件以上存在する, THE System SHALL 物件情報エリアの反響日付の右側に「重複」ボタンを表示する
3. WHEN 重複する売主が存在しない, THE System SHALL 「重複」ボタンを表示しない
4. THE DuplicateButton SHALL 視覚的に目立つスタイル（警告色）で表示される
5. WHEN 重複チェックAPIの呼び出しが失敗する, THEN THE System SHALL エラーを静かに処理し、ボタンを非表示のままにする

---

### 要件2：重複詳細モーダルの表示

**ユーザーストーリー：** 担当者として、「重複」ボタンを押したときに重複している反響の詳細情報を一覧で確認したい。そうすることで、過去の対応履歴や査定額を参照しながら現在の売主に対応できる。

#### 受け入れ基準

1. WHEN 担当者が「重複」ボタンを押す, THE System SHALL DuplicateModal を開く
2. THE DuplicateModal SHALL 重複する各売主について以下の情報を表示する：
   - 売主番号（`seller_number`）
   - 反響日（`inquiry_date`）
   - 確度（`confidence_level`）
   - 状況（当社）（`status`）
   - 次電日（`next_call_date`）
   - 査定額（`valuation_amount_1`、`valuation_amount_2`、`valuation_amount_3` のうち存在するもの）
   - コメント（`comments`）
   - 物件所在地（`property_address`）
3. WHEN 重複売主が複数存在する, THE DuplicateModal SHALL 各売主を反響日の降順で一覧表示する
4. WHEN 担当者がモーダルを閉じる操作を行う, THE System SHALL DuplicateModal を閉じる
5. THE DuplicateModal SHALL 各売主番号をクリック可能なリンクとして表示し、クリックすると該当売主の通話モードページに遷移する

---

### 要件3：重複検出APIエンドポイント

**ユーザーストーリー：** システムとして、売主IDを指定して重複する売主の詳細情報を取得できるAPIが必要である。そうすることで、フロントエンドが重複情報を正確に表示できる。

#### 受け入れ基準

1. THE System SHALL `GET /api/sellers/:id/duplicates` エンドポイントで重複売主の一覧を返す
2. WHEN エンドポイントが呼び出される, THE System SHALL 対象売主の電話番号・メールアドレスを復号した上で他の売主と比較する
3. THE System SHALL 自分自身（`:id` と同一の売主）を重複結果から除外する
4. THE System SHALL 重複結果として以下のフィールドを含むオブジェクトの配列を返す：
   - `sellerId`（UUID）
   - `sellerNumber`（売主番号）
   - `inquiryDate`（反響日）
   - `confidenceLevel`（確度）
   - `status`（状況）
   - `nextCallDate`（次電日）
   - `valuationAmount1`、`valuationAmount2`、`valuationAmount3`（査定額）
   - `comments`（コメント）
   - `propertyAddress`（物件所在地）
   - `matchType`（`phone` または `email`）
5. IF 対象売主が存在しない, THEN THE System SHALL HTTP 404 を返す
6. IF サーバーエラーが発生する, THEN THE System SHALL HTTP 500 を返す

---

### 要件4：暗号化フィールドの安全な比較

**ユーザーストーリー：** システムとして、暗号化された電話番号・メールアドレスを安全に比較したい。そうすることで、個人情報を平文でログに出力することなく重複を検出できる。

#### 受け入れ基準

1. THE System SHALL 電話番号・メールアドレスの比較をバックエンドのみで実行する
2. THE System SHALL 暗号化された値を復号してから比較する（`decrypt()` 関数を使用）
3. THE System SHALL 復号した電話番号・メールアドレスをログに出力しない
4. WHEN 復号処理が失敗する, THEN THE System SHALL エラーをログに記録し、その売主をスキップして処理を継続する

---

### 要件5：パフォーマンス

**ユーザーストーリー：** 担当者として、通話モードページの読み込みが重複チェックによって遅くならないようにしたい。そうすることで、スムーズに通話対応ができる。

#### 受け入れ基準

1. THE System SHALL 重複チェックAPIの呼び出しを通話モードページの初期データ読み込みと並列で実行する
2. THE System SHALL 重複チェック結果をインメモリキャッシュに保存し、同一売主への再リクエスト時はキャッシュから返す（TTL: 60秒）
3. WHEN 重複チェックAPIのレスポンスが3秒を超える, THEN THE System SHALL タイムアウトとして処理し、ボタンを非表示のままにする
