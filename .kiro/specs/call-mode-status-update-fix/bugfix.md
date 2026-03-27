# Bugfix Requirements Document

## Introduction

通話モードページ（CallModePage）のステータスセクションで「ステータスを更新」ボタンを押すと、バックエンドで500エラーが発生し「Failed to update seller」エラーが表示されるバグを修正する。

根本原因は `SellerService.updateSeller()` 内で `updates.site = data.site` としているが、Supabaseのsellersテーブルのカラム名は `inquiry_site` であるため、存在しないカラムへの更新が試みられてエラーになっている。

また、ステータスセクションのフィールドはスプレッドシートとの相互同期対象であること、「ステータスを更新」ボタンのUIを他の保存ボタンと統一することも要件として含む。

## Bug Analysis

### Current Behavior (Defect)

1.1 WHEN ユーザーが状況（当社）を変更して「ステータスを更新」ボタンを押す THEN バックエンドで500エラーが発生し「Failed to update seller」エラーメッセージが表示される

1.2 WHEN `handleUpdateStatus` が `api.put('/api/sellers/:id', { status, confidence, nextCallDate, ... })` を呼び出す THEN `SellerService.updateSeller()` が `updates.site = data.site` を実行し、存在しないカラム `site` への更新でSupabaseがエラーを返す

1.3 WHEN ステータスセクションのフィールド（状況（当社）、確度、次電日など）を変更して保存する THEN 「ステータスを更新」ボタンは変更前後で見た目が変わらず、編集中かどうかが視覚的に分からない

1.4 WHEN 「ステータスを更新」ボタンを押す THEN `variant="outlined"` の見た目で表示され、他の保存ボタン（コメント保存など）と仕様が異なる

### Expected Behavior (Correct)

2.1 WHEN ユーザーが状況（当社）を変更して「ステータスを更新」ボタンを押す THEN バックエンドが正常に200レスポンスを返し、売主データが更新される

2.2 WHEN `SellerService.updateSeller()` が `data.site` を処理する THEN `updates.inquiry_site = data.site` として正しいカラム名でSupabaseを更新する

2.3 WHEN ステータスセクションのフィールド（状況（当社）、確度、次電日など）の値が初期値から変更された状態になる THEN 「ステータスを更新」ボタンがパルスアニメーション付きのオレンジ色で光り、編集中であることが視覚的に分かる

2.4 WHEN 「ステータスを更新」ボタンが表示される THEN コメント保存ボタンと同じ仕様（未変更時はグレーのoutlined、変更あり時はオレンジのcontainedでパルスアニメーション）で表示される

2.5 WHEN ステータスセクションのフィールド（状況（当社）、確度、次電日、除外日にすること）が更新される THEN スプレッドシートの対応するカラムにも即時同期される

### Unchanged Behavior (Regression Prevention)

3.1 WHEN サイト（site）フィールドを含まないフィールドのみを更新する THEN 既存の更新処理は正常に動作し続ける

3.2 WHEN 他のセクション（物件情報、売主情報、訪問予約など）の保存ボタンを使用する THEN それらの保存処理は影響を受けず正常に動作し続ける

3.3 WHEN コメント保存ボタンを使用する THEN 既存のパルスアニメーション動作は変わらず正常に動作し続ける

3.4 WHEN 専任・他決ステータスを選択して必須フィールドを入力し保存する THEN 競合名・専任他決要因・決定日の保存処理は正常に動作し続ける

3.5 WHEN スプレッドシートからDBへの定期同期（GAS 10分トリガー）が実行される THEN ステータスセクションのフィールドは正しく同期され続ける
