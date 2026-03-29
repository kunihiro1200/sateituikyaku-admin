# 要件定義書

## はじめに

買主リストの内覧ページ（`BuyerViewingResultPage`）に「通知送信者」（`notification_sender`）フィールドを新規追加する。このフィールドはスプレッドシートとの双方向同期が必要であり、買主詳細画面（`BuyerDetailPage`）および新規登録画面（`NewBuyerPage`）との整合性も維持する。

### 背景

現状の問題：
- `buyer-column-mapping.json` の `spreadsheetToDatabaseExtended` には `"通知送信者": "notification_sender"` が既に定義されている
- `BuyerDetailPage.tsx` の `BUYER_FIELD_SECTIONS` には `notification_sender` フィールドが既に存在する
- しかし、内覧ページ（`BuyerViewingResultPage`）には「通知送信者」の**入力フィールドが存在しない**
- 内覧ページは内覧対応の主要な作業画面であり、通知送信者を内覧ページ上で直接入力・確認できないと業務効率が低下する
- `isViewingPreDay` ロジックは `notification_sender` が入力済みの場合に「内覧日前日」カテゴリーから除外する仕様だが、内覧ページから入力できないため運用上の不整合が生じている

---

## 用語集

- **BuyerViewingResultPage**: 内覧ページ。`/buyers/:buyer_number/viewing` に対応するフロントエンドページ
- **BuyerDetailPage**: 買主詳細ページ。`/buyers/:buyer_number` に対応するフロントエンドページ
- **NewBuyerPage**: 新規買主登録ページ。`/buyers/new` に対応するフロントエンドページ
- **notification_sender**: 通知送信者フィールド。スプレッドシートの「通知送信者」列に対応するデータベースカラム
- **BUYER_FIELD_SECTIONS**: `BuyerDetailPage.tsx` で定義されているフィールドセクション定義の配列
- **buyer-column-mapping.json**: `backend/src/config/buyer-column-mapping.json`。スプレッドシートとデータベースのカラムマッピング定義ファイル
- **GAS BUYER_COLUMN_MAPPING**: スプレッドシートに紐づいたGASプロジェクト内の買主カラムマッピング定義
- **双方向同期**: フロントエンドで入力した値がDBに保存され、GASの定期同期によりスプレッドシートにも反映される仕組み
- **内覧日前日カテゴリー**: `calculated_status` の値の一つ。`notification_sender` が空欄かつ内覧日の前日（木曜内覧の場合は2日前）に該当する買主に付与される
- **InlineEditableField**: インライン編集可能なフィールドコンポーネント

---

## 要件

### 要件1：内覧ページへの「通知送信者」フィールド追加

**ユーザーストーリー：** 担当者として、内覧ページ上で「通知送信者」を直接入力・確認したい。そうすることで、内覧対応中に別ページへ移動することなく通知送信者を記録でき、内覧日前日カテゴリーからの除外も即座に反映される。

#### 受け入れ基準

1. WHEN 内覧ページ（`BuyerViewingResultPage`）が表示される THEN THE System SHALL 内覧情報セクションに「通知送信者」フィールドを表示する
2. WHEN 「通知送信者」フィールドが表示される THEN THE System SHALL `InlineEditableField` コンポーネントを使用してインライン編集可能な形式で表示する
3. WHEN ユーザーが「通知送信者」フィールドに値を入力して保存する THEN THE System SHALL `PUT /api/buyers/:buyer_number` を呼び出して `notification_sender` フィールドをデータベースに保存する
4. WHEN 「通知送信者」フィールドの保存が成功する THEN THE System SHALL 画面上の表示値を保存後の値に更新する
5. WHEN 「通知送信者」フィールドに値が入力されている状態で内覧ページを表示する THEN THE System SHALL 保存済みの値を正しく表示する
6. WHEN 「通知送信者」フィールドが空欄の状態で内覧ページを表示する THEN THE System SHALL 空欄として表示する

---

### 要件2：スプレッドシートとの双方向同期

**ユーザーストーリー：** 担当者として、内覧ページで入力した「通知送信者」がスプレッドシートにも反映されることを期待する。そうすることで、スプレッドシートとシステムのデータが一致し、業務上の混乱を防げる。

#### 受け入れ基準

1. WHEN ユーザーが内覧ページで「通知送信者」を保存する THEN THE System SHALL `notification_sender` の値をデータベースの `buyers` テーブルに保存する
2. WHEN GASの定期同期（10分ごと）が実行される THEN THE System SHALL スプレッドシートの「通知送信者」列の値をデータベースの `notification_sender` カラムに反映する
3. WHEN データベースの `notification_sender` が更新される THEN THE System SHALL GASの `BUYER_COLUMN_MAPPING` に `'通知送信者': 'notification_sender'` が定義されていることにより、スプレッドシートへの同期対象として認識される
4. THE System SHALL `backend/src/config/buyer-column-mapping.json` の `spreadsheetToDatabaseExtended` セクションに `"通知送信者": "notification_sender"` が定義されていることを維持する

---

### 要件3：Supabaseマイグレーション

**ユーザーストーリー：** システム管理者として、`notification_sender` カラムがデータベースに存在することを確認したい。そうすることで、フィールドの保存・取得が正常に動作する。

#### 受け入れ基準

1. THE System SHALL `buyers` テーブルに `notification_sender` カラム（TEXT型）が存在する
2. IF `notification_sender` カラムが既に存在する THEN THE System SHALL マイグレーションを冪等に実行する（`ADD COLUMN IF NOT EXISTS` を使用する）
3. THE System SHALL マイグレーションファイルを `backend/supabase/migrations/` ディレクトリに配置する

---

### 要件4：買主詳細画面・新規登録画面との整合性維持

**ユーザーストーリー：** 担当者として、内覧ページ・買主詳細ページ・新規登録ページのどこからでも「通知送信者」を確認・編集できることを期待する。そうすることで、どの画面を使っていても一貫した操作が可能になる。

#### 受け入れ基準

1. THE System SHALL `BuyerDetailPage.tsx` の `BUYER_FIELD_SECTIONS` に `notification_sender` フィールドが定義されていることを維持する
2. WHEN 買主詳細ページで「通知送信者」を更新する THEN THE System SHALL 内覧ページでも同じ値が表示される（同一データソースを参照するため）
3. WHEN 内覧ページで「通知送信者」を更新する THEN THE System SHALL 買主詳細ページでも同じ値が表示される（同一データソースを参照するため）
4. THE System SHALL `frontend/frontend/src/types/index.ts` の `Buyer` 型に `notification_sender` フィールドが定義されていることを維持する

---

### 要件5：内覧日前日カテゴリーとの連携

**ユーザーストーリー：** 担当者として、内覧ページで「通知送信者」を入力した後、その買主が「内覧日前日」カテゴリーから除外されることを期待する。そうすることで、通知済みの案件が再度通知対象として表示されることを防げる。

#### 受け入れ基準

1. WHEN 内覧ページで「通知送信者」に値を入力して保存する THEN THE System SHALL `isViewingPreDay` 関数が `notification_sender` の値を参照して内覧日前日判定を行う
2. WHEN `notification_sender` に値が入力されている買主の内覧ページを表示する THEN THE System SHALL 内覧前日ボタン群（メールボタン・SMSボタン・内覧日前日一覧ボタン）を表示しない
3. WHEN `notification_sender` が空欄の買主の内覧ページを表示する WHEN 内覧日が翌日（木曜内覧の場合は2日前）である THEN THE System SHALL 内覧前日ボタン群を表示する
4. THE System SHALL `isViewingPreDay` 関数の既存ロジック（`notification_sender` が入力済みの場合は `false` を返す）を変更しない
