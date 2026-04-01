# 実装タスクリスト

## 1. バグ条件探索テスト（修正前に実行）

- [ ] 1. バグ条件探索テストを作成・実行
  - **Property 1: Bug Condition** - 買主データ同期未実装の確認
  - **重要**: このテストは修正前に実行し、失敗することを確認する
  - **失敗が期待される**: テストが失敗することで、バグが存在することを証明する
  - **修正後に再実行**: 修正後にこのテストが成功することで、バグが修正されたことを確認する
  - **目標**: 反例を表面化させてバグの存在を確認する
  - **スコープ付きPBTアプローチ**: 決定論的バグのため、具体的な失敗ケース（買主番号7272）にスコープを絞る
  - GASの `syncBuyerList()` 関数を手動実行
  - 買主番号7272がスプレッドシートに存在するが、DBには存在しないことを確認
  - 未修正コードで実行し、同期が失敗することを確認（期待される結果）
  - 反例を記録: 「買主番号7272がスプレッドシートに存在するが、DBに同期されない」
  - タスク完了条件: テストが作成され、実行され、失敗が記録されたこと
  - _Requirements: 1.1, 1.2, 1.3_

## 2. 保存プロパティテスト（修正前に実行）

- [ ] 2. 保存プロパティテストを作成・実行（修正前）
  - **Property 2: Preservation** - サイドバーカウント更新の継続
  - **重要**: 観察優先の方法論に従う
  - 未修正コードで `updateBuyerSidebarCounts_()` 関数を実行
  - 観察: buyer_sidebar_counts テーブルが正しく更新されることを確認
  - 観察: トリガー設定関数が正しく動作することを確認
  - 観察した動作をキャプチャするプロパティベーステストを作成
  - プロパティベーステストは多くのテストケースを自動生成し、強力な保証を提供する
  - 未修正コードでテストを実行
  - **期待される結果**: テストが成功する（ベースライン動作を確認）
  - タスク完了条件: テストが作成され、実行され、未修正コードで成功したこと
  - _Requirements: 3.1, 3.2, 3.3_

## 3. 買主リスト同期処理の実装

- [ ] 3. 買主リスト同期処理の実装

  - [ ] 3.1 GAS: Phase 1（追加同期）の実装
    - `gas_buyer_complete_code.js` の `syncBuyerList()` 関数にPhase 1を追加
    - バックエンドAPI `/api/sync/trigger?additionOnly=true&buyerAddition=true` を呼び出す
    - スプレッドシートにあってDBにない買主を検出して追加
    - 売主リストの `postToBackend('/api/sync/trigger?additionOnly=true', {})` と同じパターンを適用
    - エラーハンドリング（try-catch）を追加
    - _Bug_Condition: isBugCondition(input) where input.triggerType == '10分トリガー' AND syncBuyerList関数内にTODOコメントのみ存在_
    - _Expected_Behavior: スプレッドシートにあってDBにない買主が追加される_
    - _Preservation: updateBuyerSidebarCounts_() は変更せず、そのまま動作し続ける_
    - _Requirements: 2.1, 2.2, 2.3_

  - [ ] 3.2 GAS: Phase 2（更新同期）の実装
    - `syncUpdatesToSupabase_()` 関数を実装（売主リストと同じパターン）
    - `fetchAllBuyersFromSupabase_()` 関数を実装（DB買主データ取得）
    - `patchBuyerToSupabase_(buyerNumber, updateData)` 関数を実装（Supabase直接更新）
    - スプレッドシートの買主データを読み取る
    - DBの買主データと比較
    - 変更があった買主をSupabaseに直接PATCH
    - 反響日付の降順にソート
    - エラーハンドリング（try-catch）を追加
    - _Bug_Condition: isBugCondition(input) where 既存買主のデータが更新されない_
    - _Expected_Behavior: 既存買主のデータが更新される_
    - _Preservation: updateBuyerSidebarCounts_() は変更せず、そのまま動作し続ける_
    - _Requirements: 2.1, 2.2, 2.3_

  - [ ] 3.3 GAS: Phase 3（削除同期）の実装
    - バックエンドAPI `/api/sync/trigger?deletionOnly=true&buyerDeletion=true` を呼び出す
    - DBにあってスプレッドシートにない買主を検出して削除
    - 売主リストの `postToBackend('/api/sync/trigger?deletionOnly=true', {})` と同じパターンを適用
    - エラーハンドリング（try-catch）を追加
    - _Bug_Condition: isBugCondition(input) where DBにあってスプレッドシートにない買主が削除されない_
    - _Expected_Behavior: DBにあってスプレッドシートにない買主が削除される_
    - _Preservation: updateBuyerSidebarCounts_() は変更せず、そのまま動作し続ける_
    - _Requirements: 2.1, 2.2, 2.3_

  - [ ] 3.4 バックエンド: 買主追加同期パラメータの追加
    - `backend/src/routes/sync.ts` に `buyerAddition=true` パラメータを追加
    - `additionOnly=true&buyerAddition=true` の組み合わせで買主追加同期を実行
    - 条件分岐を追加: `if (buyerAddition && additionOnly) { ... }`
    - `EnhancedAutoSyncService.detectMissingBuyers()` を呼び出す（既に実装済み）
    - _Bug_Condition: isBugCondition(input) where バックエンドAPIエンドポイントが不足_
    - _Expected_Behavior: バックエンドAPIが買主追加同期を実行する_
    - _Preservation: 売主追加同期は変更せず、そのまま動作し続ける_
    - _Requirements: 2.1, 2.2, 2.3_

  - [ ] 3.5 バックエンド: 買主削除同期パラメータの追加
    - `backend/src/routes/sync.ts` に `buyerDeletion=true` パラメータを追加
    - `deletionOnly=true&buyerDeletion=true` の組み合わせで買主削除同期を実行
    - 条件分岐を追加: `if (buyerDeletion && deletionOnly) { ... }`
    - `EnhancedAutoSyncService.detectDeletedBuyers()` を呼び出す（既に実装済み）
    - _Bug_Condition: isBugCondition(input) where バックエンドAPIエンドポイントが不足_
    - _Expected_Behavior: バックエンドAPIが買主削除同期を実行する_
    - _Preservation: 売主削除同期は変更せず、そのまま動作し続ける_
    - _Requirements: 2.1, 2.2, 2.3_

  - [ ] 3.6 バグ条件探索テストの再実行（修正後）
    - **Property 1: Expected Behavior** - 買主データの自動同期
    - **重要**: タスク1で作成したテストを再実行する（新しいテストは作成しない）
    - タスク1のテストは期待される動作をエンコードしている
    - このテストが成功することで、期待される動作が満たされたことを確認する
    - GASの `syncBuyerList()` 関数を手動実行
    - 買主番号7272がスプレッドシートからDBに同期されることを確認
    - **期待される結果**: テストが成功する（バグが修正されたことを確認）
    - _Requirements: Expected Behavior Properties from design (2.1, 2.2, 2.3)_

  - [ ] 3.7 保存プロパティテストの再実行（修正後）
    - **Property 2: Preservation** - サイドバーカウント更新の継続
    - **重要**: タスク2で作成したテストを再実行する（新しいテストは作成しない）
    - タスク2の保存プロパティテストを実行
    - **期待される結果**: テストが成功する（リグレッションがないことを確認）
    - 全てのテストが修正後も成功することを確認（リグレッションなし）
    - _Requirements: Preservation Requirements from design (3.1, 3.2, 3.3)_

## 4. チェックポイント - 全テストの成功確認

- [ ] 4. チェックポイント - 全テストの成功確認
  - 全てのテストが成功することを確認
  - 質問があればユーザーに確認する
