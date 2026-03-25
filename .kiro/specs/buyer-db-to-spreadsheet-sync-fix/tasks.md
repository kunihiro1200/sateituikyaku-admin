# Implementation Plan

- [x] 1. バグ条件の探索テストを書く
  - **Property 1: Bug Condition** - インライン編集フィールドのスプシ同期スキップ
  - **重要**: このテストは修正前のコードで実行すること
  - **目的**: バグが存在することを確認するカウンターエグザンプルを記録する
  - **スコープ**: `handleInlineFieldSave` が `sync: false` で呼ばれる場合（例: `distribution_type` や `pinrich` フィールドの保存）
  - `handleInlineFieldSave` を呼び出し、スプシAPIが呼ばれないことを確認（`buyerApi.update` が `{ sync: false }` で呼ばれることを検証）
  - `findRowByColumn` に文字列 `"4370"` を渡し、スプシに数値 `4370` が格納されている場合に `null` が返ることを確認
  - 未修正コードでテストを実行する
  - **期待される結果**: テストが失敗する（バグが存在することを証明）
  - カウンターエグザンプルを記録する（例: `handleInlineFieldSave('distribution_type', '配信あり')` 呼び出し後、スプシAPIが呼ばれていない）
  - テストを書き、実行し、失敗を記録したらタスク完了とする
  - _Requirements: 1.1, 1.2_

- [x] 2. 保全プロパティテストを書く（修正前に実施）
  - **Property 2: Preservation** - 既存の保存フローの維持
  - **重要**: 観察優先メソドロジーに従うこと
  - 未修正コードで非バグ条件の入力（セクション保存ボタン経由の保存）を観察する
  - 観察: `sync: true` でのセクション保存が正常に動作することを確認
  - 観察: DBへの保存が常に成功することを確認
  - 観察: `last_synced_at` が同期成功時に更新されることを確認
  - 観察: `buyer-column-mapping.json` にマッピングされたフィールドが正しくスプシに書き込まれることを確認
  - プロパティベーステスト: セクション保存ボタン経由の保存が修正後も変わらず動作することを検証
  - プロパティベーステスト: ランダムな買主番号（文字列・数値）を生成し、`findRowByColumn` が型に関わらず正しく行を検索することを検証（修正前は失敗するケースを記録）
  - 未修正コードでテストを実行する
  - **期待される結果**: テストが通過する（保全すべき既存動作を確認）
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_

- [x] 3. buyer-db-to-spreadsheet-sync-fix の修正

  - [x] 3.1 `handleInlineFieldSave` の `sync: false` を `sync: true` に変更
    - `frontend/frontend/src/pages/BuyerDetailPage.tsx` の `handleInlineFieldSave` を修正
    - `buyerApi.update()` の第3引数を `{ sync: true }` に変更
    - APIレスポンスの `syncStatus` を確認し、`'pending'` または `'failed'` の場合に警告スナックバーを表示
    - _Bug_Condition: isBugCondition(input) where input.saveMethod === 'inline'（常に sync: false でスプシ同期がスキップされる）_
    - _Expected_Behavior: handleInlineFieldSave 呼び出し後、スプシAPIが呼ばれ、syncStatus が 'success' または 'pending' を返す_
    - _Preservation: セクション保存ボタン経由の保存フローは変更しない。DBへの保存は常に成功扱い_
    - _Requirements: 2.1, 2.3_

  - [x] 3.2 `findRowByColumn` の型不一致を修正
    - `backend/src/services/GoogleSheetsClient.ts` の `findRowByColumn` を修正
    - `values[i][0] === value` を `String(values[i][0]) === String(value)` に変更
    - 文字列・数値の型に関わらず買主番号を一致比較できるようにする
    - _Bug_Condition: isBugCondition(input) where typeof(spreadsheetBuyerNumber) !== typeof(searchValue)（=== 比較で一致しない）_
    - _Expected_Behavior: findRowByColumn("買主番号", "4370") がスプシに数値 4370 が格納されていても正しく行番号を返す_
    - _Preservation: 買主番号が正しく存在する場合、スプシの該当行を特定して更新する動作は変わらない_
    - _Requirements: 2.2_

  - [x] 3.3 `readRange` の `FORMATTED_VALUE` を `UNFORMATTED_VALUE` に変更
    - `backend/src/services/GoogleSheetsClient.ts` の `readRange` を修正
    - `spreadsheets.values.get` に `valueRenderOption: 'UNFORMATTED_VALUE'` を追加
    - 日付等のセル値を生の値（シリアル値）で取得し、書き戻し時に値が変化しないようにする
    - _Bug_Condition: isBugCondition(input) where fieldType === 'date' AND readRange uses FORMATTED_VALUE_
    - _Expected_Behavior: readRange が日付セルを UNFORMATTED_VALUE で取得し、RAW で書き戻しても値が変化しない_
    - _Preservation: マッピング済みフィールドの書き込みは変わらない_
    - _Requirements: 2.4_

  - [x] 3.4 バグ条件の探索テストが通過することを確認
    - **Property 1: Expected Behavior** - インライン編集フィールドのスプシ同期
    - **重要**: タスク1で書いた同じテストを再実行する。新しいテストを書かないこと
    - タスク1のバグ条件探索テストを再実行する
    - **期待される結果**: テストが通過する（バグが修正されたことを確認）
    - _Requirements: 2.1, 2.2, 2.3, 2.4_

  - [x] 3.5 保全テストが引き続き通過することを確認
    - **Property 2: Preservation** - 既存の保存フローの維持
    - **重要**: タスク2で書いた同じテストを再実行する。新しいテストを書かないこと
    - タスク2の保全プロパティテストを再実行する
    - **期待される結果**: テストが通過する（リグレッションがないことを確認）
    - 全ての保全テストが通過することを確認する

- [x] 4. チェックポイント - 全テストの通過確認
  - 全てのテストが通過することを確認する
  - 疑問点があればユーザーに確認する
