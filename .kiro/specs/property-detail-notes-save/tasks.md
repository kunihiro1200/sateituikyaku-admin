# 特記・備忘録保存機能追加 タスクリスト

## Tasks

- [x] 1. handleSaveNotes ハンドラーを追加する
  - [x] 1.1 `PropertyListingDetailPage.tsx` の `handleSaveSellerBuyer` の後に `handleSaveNotes` 関数を追加する
  - [x] 1.2 `editedData` から `special_notes` と `memo` のみを抽出してペイロードを構築する
  - [x] 1.3 `api.put('/api/property-listings/:propertyNumber', notesData)` を呼び出す
  - [x] 1.4 成功時に「特記・備忘録を保存しました」スナックバーを表示し、`fetchPropertyData()` と `setEditedData({})` を呼ぶ
  - [x] 1.5 失敗時に「保存に失敗しました」エラースナックバーを表示する

- [x] 2. 特記・備忘録セクションに保存ボタンを追加する
  - [x] 2.1 `PropertyListingDetailPage.tsx` の特記・備忘録セクション（`<Paper>` 内）の末尾に保存ボタンを追加する
  - [x] 2.2 ボタンの `onClick` に `handleSaveNotes` を設定する
  - [x] 2.3 `editedData.special_notes === undefined && editedData.memo === undefined` の場合に `disabled` にする
  - [x] 2.4 ボタンのスタイルを他セクションの保存ボタンと統一する（`SECTION_COLORS.property.main`）

- [x] 3. 動作確認テストを実施する
  - [x] 3.1 特記テキストエリアに入力して保存ボタンをクリックし、DBに保存されることを確認する
  - [x] 3.2 備忘録テキストエリアに入力して保存ボタンをクリックし、DBに保存されることを確認する
  - [x] 3.3 保存成功後にスナックバー「特記・備忘録を保存しました」が表示されることを確認する
  - [x] 3.4 未編集時に保存ボタンが disabled になることを確認する
  - [x] 3.5 他セクション（価格情報、基本情報など）の保存処理が引き続き正常に動作することを確認する
