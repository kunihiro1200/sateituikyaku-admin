# 要件定義書

## はじめに

本機能は、売主リストスプレッドシートのY列（カラム名「一番TEL」）に格納されたデータを、Supabase DBの`sellers`テーブルの`first_call_initials`カラムへ一括同期するGASスクリプトを新規作成するものです。

対象レコードは**反響日付が2026/1/1以降**のものに限定します。既存の`syncSellerList`関数（10分トリガー）とは独立した、手動実行または単独トリガーで動作するスクリプトとして実装します。

---

## 用語集

- **GAS（Google Apps Script）**: Googleスプレッドシートに組み込まれたスクリプト実行環境
- **売主リスト**: 対象のGoogleスプレッドシートのシート名（`売主リスト`）
- **一番TEL**: スプレッドシートY列のカラム名。最初に電話した担当者のイニシャルを格納する
- **first_call_initials**: Supabase `sellers` テーブルのカラム名。`一番TEL`に対応する（VARCHAR(10)）
- **反響日付**: スプレッドシートの「反響日付」カラム（DBでは`inquiry_date`）。問い合わせを受けた日付
- **売主番号**: スプレッドシートB列のカラム名（DBでは`seller_number`）。売主の一意識別子（例: AA13501）
- **SUPABASE_CONFIG**: GASスクリプト内で定義されたSupabase接続設定オブジェクト（URL・SERVICE_KEY）
- **patchSellerToSupabase_**: 既存GASの個別売主更新ユーティリティ関数
- **Sync_Script**: 本機能で新規作成するGASスクリプト（`syncFirstTelToDb`関数）

---

## 要件

### 要件1: 対象レコードのフィルタリング

**ユーザーストーリー:** 担当者として、反響日付が2026/1/1以降の売主のみを同期対象にしたい。それ以前のレコードは変更しないことで、過去データへの意図しない上書きを防ぎたい。

#### 受け入れ基準

1. WHEN スプレッドシートの「反響日付」列の値が `2026/1/1` 以降（2026-01-01以降）である THEN THE Sync_Script SHALL そのレコードを同期対象として処理する

2. WHEN スプレッドシートの「反響日付」列の値が `2026/1/1` より前である THEN THE Sync_Script SHALL そのレコードをスキップし、DBを更新しない

3. WHEN スプレッドシートの「反響日付」列が空欄または無効な値である THEN THE Sync_Script SHALL そのレコードをスキップし、DBを更新しない

4. THE Sync_Script SHALL 売主番号がB列に存在し、かつ `[A-Z]{2}\d+` の形式に一致するレコードのみを処理対象とする

---

### 要件2: Y列「一番TEL」データのDB同期

**ユーザーストーリー:** 担当者として、スプレッドシートY列の「一番TEL」データをDBの`first_call_initials`カラムへ正確に反映させたい。これにより、アプリ画面でも最新の担当者イニシャルを確認できるようにしたい。

#### 受け入れ基準

1. WHEN 対象レコードのY列「一番TEL」に値が存在する THEN THE Sync_Script SHALL その値を文字列として`sellers.first_call_initials`カラムへ書き込む

2. WHEN 対象レコードのY列「一番TEL」が空欄である THEN THE Sync_Script SHALL `sellers.first_call_initials`を`null`で更新する

3. THE Sync_Script SHALL スプレッドシートのY列を参照する際に、カラム名 `'一番TEL'` をキーとして使用する

4. THE Sync_Script SHALL Supabase REST APIの`PATCH`メソッドを使用して、`seller_number`を条件に`first_call_initials`のみを更新する

5. WHEN Supabase APIが200番台以外のHTTPステータスコードを返す THEN THE Sync_Script SHALL エラーをLogger.logに記録し、次のレコードの処理を継続する

---

### 要件3: 一括同期の実行制御

**ユーザーストーリー:** 担当者として、スクリプトを手動で実行して一括同期を完了させたい。また、処理の進捗と結果をログで確認したい。

#### 受け入れ基準

1. THE Sync_Script SHALL `syncFirstTelToDb` という名前の関数として実装し、GASエディタから手動実行できるようにする

2. WHEN `syncFirstTelToDb` が実行される THEN THE Sync_Script SHALL 処理開始時刻、対象レコード数、更新件数、スキップ件数、エラー件数をLogger.logに出力する

3. WHEN 全レコードの処理が完了する THEN THE Sync_Script SHALL 処理終了時刻と合計処理時間をLogger.logに出力する

4. THE Sync_Script SHALL 既存の`SUPABASE_CONFIG`オブジェクト（URL・SERVICE_KEY）を再利用し、接続情報を重複定義しない

5. THE Sync_Script SHALL 既存の`rowToObject`関数および`formatDateToISO_`関数を再利用してスプレッドシートデータを解析する

6. THE Sync_Script SHALL 既存の`patchSellerToSupabase_`関数を再利用してSupabaseへの更新リクエストを送信する

---

### 要件4: DBカラムの存在確認

**ユーザーストーリー:** 担当者として、同期先のDBカラム`first_call_initials`が確実に存在することを前提として処理を進めたい。カラムが存在しない場合は、マイグレーションを先に実行する必要があることを把握したい。

#### 受け入れ基準

1. THE Sync_Script SHALL `sellers`テーブルの`first_call_initials`カラム（VARCHAR(10)）が存在することを前提として動作する

2. WHERE `first_call_initials`カラムがDBに存在しない場合 THE Sync_Script SHALL マイグレーションSQL（`ALTER TABLE sellers ADD COLUMN IF NOT EXISTS first_call_initials VARCHAR(10)`）を先に実行するよう、ドキュメントに明記する

3. THE Sync_Script SHALL `first_call_person`カラム（1番電話担当者名）とは別のカラムである`first_call_initials`（一番TELイニシャル）を更新対象とする

---

### 要件5: 既存同期処理との独立性

**ユーザーストーリー:** 担当者として、本スクリプトが既存の10分トリガー同期（`syncSellerList`）の動作に影響を与えないことを保証したい。

#### 受け入れ基準

1. THE Sync_Script SHALL 既存の`syncSellerList`関数を呼び出さず、独立した処理フローで動作する

2. THE Sync_Script SHALL `first_call_initials`カラムのみを更新対象とし、他のカラム（`status`、`next_call_date`、`visit_assignee`等）を変更しない

3. WHEN `syncFirstTelToDb`が実行される THEN THE Sync_Script SHALL バックエンドAPIへのトリガーリクエスト（`/api/sync/trigger`）を送信しない

4. THE Sync_Script SHALL 既存の`gas_complete_code.js`に含まれる`syncUpdatesToSupabase_`関数の処理ロジックを変更しない
