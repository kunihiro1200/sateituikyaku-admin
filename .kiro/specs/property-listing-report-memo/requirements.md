# 要件ドキュメント

## はじめに

物件リスト（`property_listings`テーブル）の報告ページに「報告_メモ」フィールドを追加する機能です。このフィールドは報告ページでのメモ機能として使用され、データベース専用フィールドとしてスプレッドシート同期の対象外とします。

## 用語集

- **Property_Listings**: 物件リストテーブル（`property_listings`）
- **Report_Page**: 物件リストの報告ページ（`PropertyReportPage.tsx`）
- **Report_Memo**: 報告メモフィールド（`report_memo`カラム）
- **SUUMO_URL_Field**: SUUMOURLフィールド（報告ページ内の既存フィールド）
- **Database**: Supabaseデータベース
- **Spreadsheet**: Google スプレッドシート（物件リストスプレッドシート）

## 要件

### 要件1: データベースへの「報告_メモ」フィールド追加

**ユーザーストーリー:** 開発者として、物件リストテーブルに報告メモを保存できるようにしたい。そうすることで、報告に関する情報をデータベースで管理できる。

#### 受け入れ基準

1. THE Property_Listings SHALL `report_memo`カラムを持つ
2. THE `report_memo` SHALL データ型がTEXT型である
3. THE `report_memo` SHALL NULL値を許可する
4. THE `report_memo` SHALL デフォルト値がNULLである
5. THE Database SHALL マイグレーションスクリプトで`report_memo`カラムを追加する

### 要件2: 報告ページへのUIフィールド追加

**ユーザーストーリー:** 担当者として、報告ページで報告メモを入力・編集したい。そうすることで、報告に関する補足情報を記録できる。

#### 受け入れ基準

1. THE Report_Page SHALL SUUMO_URL_Fieldの下に「報告_メモ」フィールドを表示する
2. THE Report_Memo SHALL 複数行テキスト入力フィールド（TextField multiline）として表示される
3. THE Report_Memo SHALL 最小3行、最大10行で表示される
4. THE Report_Memo SHALL プレースホルダーテキスト「報告に関するメモを入力...」を表示する
5. THE Report_Memo SHALL 全角・半角文字を入力できる
6. THE Report_Memo SHALL 改行を含むテキストを入力できる
7. WHEN Report_Pageが読み込まれる場合、THE Report_Memo SHALL データベースから取得した値を表示する
8. WHEN Report_Memoが空の場合、THE Report_Memo SHALL 空のテキストフィールドを表示する

### 要件3: 報告メモの保存機能

**ユーザーストーリー:** 担当者として、入力した報告メモを保存したい。そうすることで、後で報告メモを確認できる。

#### 受け入れ基準

1. WHEN ユーザーが「保存」ボタンをクリックした場合、THE Report_Page SHALL `report_memo`フィールドをデータベースに保存する
2. THE Report_Page SHALL 他の報告情報（報告日、報告完了、報告担当、SUUMO URL）と同時に`report_memo`を保存する
3. WHEN 保存が成功した場合、THE Report_Page SHALL 「報告情報を保存しました」メッセージを表示する
4. WHEN 保存が失敗した場合、THE Report_Page SHALL 「保存に失敗しました」エラーメッセージを表示する
5. THE Report_Page SHALL `report_memo`が変更された場合、保存ボタンをハイライト表示する

### 要件4: スプレッドシート同期の除外

**ユーザーストーリー:** 開発者として、報告メモをスプレッドシートに同期しないようにしたい。そうすることで、データベース専用フィールドとして管理できる。

#### 受け入れ基準

1. THE `report_memo` SHALL スプレッドシート同期の対象外である
2. THE `column-mapping.json` SHALL `report_memo`のマッピングを含まない
3. THE PropertyListingSyncService SHALL `report_memo`を同期しない
4. WHEN スプレッドシートからデータベースへの同期が実行される場合、THE System SHALL `report_memo`の値を変更しない
5. WHEN データベースからスプレッドシートへの同期が実行される場合、THE System SHALL `report_memo`をスプレッドシートに書き込まない

### 要件5: APIエンドポイントの対応

**ユーザーストーリー:** 開発者として、APIで報告メモを取得・更新できるようにしたい。そうすることで、フロントエンドから報告メモを操作できる。

#### 受け入れ基準

1. THE GET `/api/property-listings/:propertyNumber` SHALL レスポンスに`report_memo`フィールドを含める
2. THE PUT `/api/property-listings/:propertyNumber` SHALL リクエストボディの`report_memo`フィールドを受け取る
3. WHEN `report_memo`がリクエストに含まれる場合、THE API SHALL データベースの`report_memo`カラムを更新する
4. WHEN `report_memo`がNULLまたは空文字列の場合、THE API SHALL データベースにNULLを保存する
5. THE API SHALL `report_memo`の最大長を検証しない（TEXT型のため制限なし）

### 要件6: 既存データの互換性

**ユーザーストーリー:** 開発者として、既存の物件データに影響を与えずに新しいフィールドを追加したい。そうすることで、既存機能が正常に動作し続ける。

#### 受け入れ基準

1. WHEN マイグレーションが実行される場合、THE System SHALL 既存の物件データの`report_memo`をNULLに設定する
2. THE Report_Page SHALL `report_memo`がNULLの物件を正常に表示する
3. THE API SHALL `report_memo`がNULLの物件を正常に返す
4. THE System SHALL 既存の報告ページ機能（報告日、報告完了、報告担当、SUUMO URL、送信履歴、買主一覧）に影響を与えない

