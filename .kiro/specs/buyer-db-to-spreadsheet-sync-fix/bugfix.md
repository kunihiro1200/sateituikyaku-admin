# Bugfix Requirements Document

## Introduction

買主詳細画面（BuyerDetailPage.tsx）でフィールドを編集・保存すると、DBには正しく保存されるが、スプレッドシートに反映されないバグ。「配信メール」（distribution_type）「Pinrich」（pinrich）などのフィールドが対象として確認されているが、同様の問題が他のフィールドにも存在する可能性がある。

このバグにより、管理画面とスプレッドシートの間でデータの不整合が発生し、スプレッドシートを参照する業務フローに支障をきたす。

## Bug Analysis

### Current Behavior (Defect)

1.1 WHEN ユーザーがインライン編集フィールド（即時保存）を変更して保存する THEN the system はDBのみ更新し、スプレッドシートへの同期を行わない（`sync: false` で呼び出されるため）

1.2 WHEN ユーザーがセクション保存ボタンを押して `sync: true` で保存する THEN the system はスプレッドシートへの同期を試みるが、`findRowByBuyerNumber` が買主番号を文字列と数値の型不一致（`===` 比較）で見つけられず、同期が失敗する場合がある

1.3 WHEN スプレッドシートへの同期が失敗する THEN the system は `syncStatus: 'pending'` を返してDBへの保存は成功扱いにするため、フロントエンドにはエラーが表示されず、ユーザーは同期失敗に気づかない（サイレント失敗）

1.4 WHEN `BuyerWriteService.updateFields` が現在の行データを `readRange` で取得する THEN the system はデフォルトの `FORMATTED_VALUE` で読み取るため、日付等のセル値が表示形式の文字列として取得され、`RAW` で書き戻す際に値が変化する可能性がある

### Expected Behavior (Correct)

2.1 WHEN ユーザーがインライン編集フィールドを変更して保存する THEN the system SHALL DBへの保存と同時にスプレッドシートへの同期も実行する（または `sync: true` に変更する）

2.2 WHEN `findRowByBuyerNumber` が買主番号でスプレッドシートの行を検索する THEN the system SHALL 文字列・数値の型に関わらず値を一致比較し、正しく行番号を返す

2.3 WHEN スプレッドシートへの同期が失敗する THEN the system SHALL フロントエンドに同期失敗を明示的に通知し、ユーザーが失敗を認識できるようにする

2.4 WHEN `BuyerWriteService.updateFields` が現在の行データを取得する THEN the system SHALL `UNFORMATTED_VALUE` で読み取り、書き戻し時に値が変化しないようにする

### Unchanged Behavior (Regression Prevention)

3.1 WHEN ユーザーが買主詳細画面でフィールドを保存する THEN the system SHALL CONTINUE TO DBへの保存を正常に完了する

3.2 WHEN スプレッドシートへの同期が成功する THEN the system SHALL CONTINUE TO `last_synced_at` を更新する

3.3 WHEN `buyer-column-mapping.json` にマッピングが定義されているフィールドを保存する THEN the system SHALL CONTINUE TO 対応するスプレッドシートの列に値を書き込む

3.4 WHEN 買主番号が正しく存在する THEN the system SHALL CONTINUE TO スプレッドシートの該当行を特定して更新する

3.5 WHEN インライン編集以外のフィールド（セクション保存ボタン経由）を保存する THEN the system SHALL CONTINUE TO 変更されたフィールドのみをスプレッドシートに反映する
