# 実装計画：売主ステータスフィールド保存・同期機能

## 概要

売主リストの通話モードページのステータスセクションに存在する4つのフィールド（専任（他決）決定日、競合（複数選択可）、専任・他決要因（複数選択可）、競合名、理由（他決、専任））の保存機能とDB→スプレッドシート即時同期機能を実装します。

## タスク

- [x] 1. バックエンド：SellerServiceの更新
  - [x] 1.1 SellerService.supabase.tsのupdateSellerメソッドに4つのフィールドの保存処理を追加
    - `exclusiveDecisionDate`を`contract_year_month`カラムに保存
    - `competitors`（カンマ区切り文字列）を`competitor_name`カラムに保存
    - `exclusiveOtherDecisionFactors`（配列）をカンマ区切り文字列に変換して`exclusive_other_decision_factor`カラムに保存
    - `competitorNameAndReason`を`competitor_name_and_reason`カラムに保存
    - 空配列または空文字の場合は`null`を保存
    - _要件: 1.1, 2.1, 3.1, 4.1_

  - [x] 1.2 SellerService.supabase.tsのdecryptSellerメソッドに4つのフィールドの復号処理を追加
    - `contract_year_month`を`exclusiveDecisionDate`として返す
    - `competitor_name`を`competitors`として返す（カンマ区切り文字列）
    - `exclusive_other_decision_factor`を配列に変換して`exclusiveOtherDecisionFactors`として返す
    - `competitor_name_and_reason`を`competitorNameAndReason`として返す
    - _要件: 1.1, 2.1, 3.1, 4.1_

- [x] 2. バックエンド：SpreadsheetSyncServiceの更新
  - [x] 2.1 column-mapping.jsonに4つのフィールドのマッピングを追加
    - `contract_year_month` ↔ `契約年月 他決は分かった時点`（AM列）
    - `competitor_name` ↔ `競合名`（AN列）
    - `exclusive_other_decision_factor` ↔ `専任・他決要因`（AQ列）
    - `competitor_name_and_reason` ↔ `競合名、理由\n（他決、専任）`（AI列）
    - _要件: 8.1, 8.2, 8.3, 8.4_

  - [x] 2.2 SpreadsheetSyncService.tsのsyncToSpreadsheetメソッドで4つのフィールドが正しく同期されることを確認
    - カンマ区切り文字列がスプレッドシートに正しく保存されることを確認
    - 日付フィールドがYYYY-MM-DD形式で保存されることを確認
    - _要件: 1.2, 2.2, 3.2, 4.2, 5.1, 5.2_

- [x] 3. フロントエンド：CallModePageの状態管理追加
  - [ ] 3.1 CallModePage.tsxに4つのフィールドの状態管理を追加
    - `editedExclusiveDecisionDate`（編集中の専任（他決）決定日）
    - `editedCompetitors`（編集中の競合、配列）
    - `editedExclusiveOtherDecisionFactors`（編集中の専任・他決要因、配列）
    - `editedCompetitorNameAndReason`（編集中の競合名、理由）
    - `savedExclusiveDecisionDate`（保存済みの専任（他決）決定日）
    - `savedCompetitors`（保存済みの競合、配列）
    - `savedExclusiveOtherDecisionFactors`（保存済みの専任・他決要因、配列）
    - `savedCompetitorNameAndReason`（保存済みの競合名、理由）
    - _要件: 1.1, 2.1, 3.1, 4.1_

  - [ ] 3.2 CallModePage.tsxのuseEffectで売主データ取得時に4つのフィールドを初期化
    - `seller.contractYearMonth`を`editedExclusiveDecisionDate`と`savedExclusiveDecisionDate`に設定
    - `seller.competitorName`をカンマで分割して`editedCompetitors`と`savedCompetitors`に設定
    - `seller.exclusiveOtherDecisionFactors`を`editedExclusiveOtherDecisionFactors`と`savedExclusiveOtherDecisionFactors`に設定
    - `seller.competitorNameAndReason`を`editedCompetitorNameAndReason`と`savedCompetitorNameAndReason`に設定
    - _要件: 1.1, 2.1, 3.1, 4.1_

- [x] 4. フロントエンド：CallModePageのUI実装
  - [x] 4.1 CallModePage.tsxのステータスセクションに専任（他決）決定日の入力フィールドを追加
    - `TextField`コンポーネントで`type="date"`を使用
    - 空文字の場合は`null`を設定（date-field-handling-rules.mdに従う）
    - _要件: 1.1_

  - [x] 4.2 CallModePage.tsxのステータスセクションに競合（複数選択可）の選択フィールドを追加
    - ボタンまたはチェックボックスで複数選択可能にする
    - 選択された競合を配列で管理
    - 「クリア」ボタンを追加（visit-date-deletion-fix.mdに従う）
    - _要件: 2.1_

  - [x] 4.3 CallModePage.tsxのステータスセクションに専任・他決要因（複数選択可）の選択フィールドを追加
    - ボタンまたはチェックボックスで複数選択可能にする
    - 選択された要因を配列で管理
    - 「クリア」ボタンを追加（visit-date-deletion-fix.mdに従う）
    - _要件: 3.1_

  - [x] 4.4 CallModePage.tsxのステータスセクションに競合名、理由（他決、専任）のテキストエリアを追加
    - `TextField`コンポーネントで`multiline`を使用
    - _要件: 4.1_

- [x] 5. フロントエンド：バリデーション実装
  - [x] 5.1 CallModePage.tsxのhandleStatusSaveメソッドにバリデーションロジックを追加
    - `requiresDecisionDate`関数を実装（ステータスに「専任」または「他決」が含まれるか判定）
    - 専任または他決ステータスの場合、4つのフィールドが必須
    - 専任（他決）決定日が未入力の場合、エラーメッセージを表示
    - 競合が未選択の場合、エラーメッセージを表示
    - 専任・他決要因が未選択の場合、エラーメッセージを表示
    - _要件: 7.1, 7.2, 7.3, 7.4_

- [x] 6. フロントエンド：API呼び出し実装
  - [x] 6.1 CallModePage.tsxのhandleStatusSaveメソッドに4つのフィールドのAPI呼び出しを追加
    - `exclusiveDecisionDate`を送信（空文字の場合は`null`）
    - `competitors`をカンマ区切り文字列に変換して送信（空配列の場合は`null`）
    - `exclusiveOtherDecisionFactors`を配列として送信（空配列の場合は`null`）
    - `competitorNameAndReason`を送信（空文字の場合は`null`）
    - _要件: 1.1, 2.1, 3.1, 4.1_

  - [x] 6.2 CallModePage.tsxのhandleStatusSaveメソッドで保存成功時に保存済み値を更新
    - `setSavedExclusiveDecisionDate(editedExclusiveDecisionDate)`
    - `setSavedCompetitors(editedCompetitors)`
    - `setSavedExclusiveOtherDecisionFactors(editedExclusiveOtherDecisionFactors)`
    - `setSavedCompetitorNameAndReason(editedCompetitorNameAndReason)`
    - _要件: 1.1, 2.1, 3.1, 4.1_

- [x] 7. フロントエンド：エラーハンドリング実装
  - [x] 7.1 CallModePage.tsxのhandleStatusSaveメソッドにエラーハンドリングを追加
    - データベース保存エラーの場合、「データベースへの保存に失敗しました」を表示
    - ネットワークエラーの場合、「ネットワークエラーが発生しました。再試行してください」を表示
    - スプレッドシート同期エラーは非同期・ノンブロッキングのため、ユーザーには表示しない
    - _要件: 6.1, 6.2, 6.3_

- [x] 8. チェックポイント - 基本機能の動作確認
  - 通話モードページで4つのフィールドが表示されることを確認
  - 専任または他決ステータスの場合、4つのフィールドが必須になることを確認
  - 「専任媒介通知」ボタンをクリックして、4つのフィールドが自動保存されることを確認
  - チャット送信と同時にデータベースに保存され、スプレッドシートに即時同期されることを確認
  - ページをリロードして、保存した値が表示されることを確認
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 9. スプレッドシート同期の動作確認
  - [ ] 9.1 スプレッドシートのAM列「契約年月 他決は分かった時点」に専任（他決）決定日が同期されることを確認
    - 保存後、スプレッドシートを開いてAM列を確認
    - 日付がYYYY-MM-DD形式で保存されていることを確認
    - _要件: 1.2, 5.4_

  - [ ] 9.2 スプレッドシートのAN列「競合名」に競合が同期されることを確認
    - 保存後、スプレッドシートを開いてAN列を確認
    - カンマ区切り文字列で保存されていることを確認
    - _要件: 2.2, 5.4_

  - [ ] 9.3 スプレッドシートのAQ列「専任・他決要因」に専任・他決要因が同期されることを確認
    - 保存後、スプレッドシートを開いてAQ列を確認
    - カンマ区切り文字列で保存されていることを確認
    - _要件: 3.2, 5.4_

  - [ ] 9.4 スプレッドシートのAI列「競合名、理由（他決、専任）」に競合名、理由が同期されることを確認
    - 保存後、スプレッドシートを開いてAI列を確認
    - テキストが正しく保存されていることを確認
    - _要件: 4.2, 5.4_

- [ ] 10. エッジケースのテスト
  - [ ] 10.1 4つのフィールドを空欄にして保存し、データベースとスプレッドシートから削除されることを確認
    - 専任（他決）決定日を削除
    - 競合を全て解除
    - 専任・他決要因を全て解除
    - 競合名、理由を空欄にする
    - 保存後、データベースとスプレッドシートで`null`または空欄になることを確認
    - _要件: 1.3, 2.3, 3.3, 4.3_

  - [ ] 10.2 一般媒介ステータスの場合、4つのフィールドが任意項目として扱われることを確認
    - ステータスを「一般媒介」に変更
    - 4つのフィールドを空欄にして保存
    - バリデーションエラーが表示されないことを確認
    - _要件: 7.3_

- [ ] 11. 最終チェックポイント - 全機能の動作確認
  - 全てのタスクが完了していることを確認
  - 通話モードページで4つのフィールドが正しく動作することを確認
  - スプレッドシート同期が正しく動作することを確認
  - エラーハンドリングが正しく動作することを確認
  - Ensure all tests pass, ask the user if questions arise.

## 注意事項

- タスク1.1と1.2は`backend/src/services/SellerService.supabase.ts`を編集（売主管理システム用、ポート3000）
- タスク2.1と2.2は`backend/src/services/SpreadsheetSyncService.ts`と`backend/src/config/column-mapping.json`を編集
- タスク3.1以降は`frontend/frontend/src/pages/CallModePage.tsx`を編集
- 日付フィールドは空文字ではなく`null`を使用（date-field-handling-rules.mdに従う）
- 選択フィールドには必ず「クリア」ボタンを追加（visit-date-deletion-fix.mdに従う）
- スプレッドシート同期は非同期・ノンブロッキングで実行されるため、同期エラーはユーザーに表示しない
- 日本語を含むファイルを編集する場合は、Pythonスクリプトを使用してUTF-8で書き込む（file-encoding-protection.mdに従う）
- **重要**: 4つのフィールドの保存は「専任媒介通知」ボタンで実行される（チャット送信と同時に自動保存＆スプレッドシート同期）
