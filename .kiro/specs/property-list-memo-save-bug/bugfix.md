# Bugfix Requirements Document

## Introduction

物件リスト画面（`PropertyListingsPage`）から開く物件詳細モーダル（`PropertyListingDetailModal`）および物件詳細ページ（`PropertyListingDetailPage`）において、備忘録（memo）フィールドの保存機能に2つのバグが存在する。

**バグ1**: 物件詳細ページ（`PropertyListingDetailPage`）で備忘録を保存すると、`handleSaveNotes` が `fetchPropertyData()` を `silent=false`（デフォルト）で呼び出すため、`setLoading(true)` が実行されて画面全体がローディングスピナーに置き換わり、一瞬画面が白くなる。

**バグ2**: 物件詳細ページの `handleSaveNotes` には保存中フラグ（`saving` 状態）が存在しないため、保存ボタンが保存処理中も有効なままとなり、ユーザーが複数回クリックしても保存リクエストが重複して送信される。結果として、最初のクリックで保存が完了しているにもかかわらず、ユーザーには保存されていないように見える場合がある。

## Bug Analysis

### Current Behavior (Defect)

1.1 WHEN ユーザーが物件詳細ページ（`PropertyListingDetailPage`）の備忘録フィールドに入力して保存ボタンを押す THEN the system は `fetchPropertyData()` を `silent=false` で呼び出し、`setLoading(true)` が実行されて画面全体がローディングスピナーに切り替わり、一瞬画面が白くなる

1.2 WHEN ユーザーが物件詳細ページの備忘録保存ボタンを押す THEN the system は保存中も保存ボタンを有効なままにするため、ユーザーが複数回クリックすると保存APIリクエストが重複して送信される

1.3 WHEN 保存APIリクエストが重複して送信される THEN the system は最初のリクエストの完了前に2回目のリクエストを送信し、競合状態（race condition）が発生して保存結果が不安定になる

### Expected Behavior (Correct)

2.1 WHEN ユーザーが物件詳細ページの備忘録フィールドに入力して保存ボタンを押す THEN the system SHALL `fetchPropertyData()` を `silent=true` で呼び出し、画面全体のローディング状態を発生させずに保存後のデータ再取得を行う

2.2 WHEN ユーザーが物件詳細ページの備忘録保存ボタンを押す THEN the system SHALL 保存処理中は保存ボタンを無効化（disabled）し、保存中インジケーターを表示することで重複クリックを防止する

2.3 WHEN 備忘録の保存処理が完了する THEN the system SHALL 保存ボタンを再び有効化し、成功または失敗のスナックバーメッセージを表示する

### Unchanged Behavior (Regression Prevention)

3.1 WHEN ユーザーが物件詳細ページの備忘録以外のフィールド（価格、基本情報など）を保存する THEN the system SHALL CONTINUE TO 各セクションの保存ハンドラーが現在の動作を維持する

3.2 WHEN ユーザーが物件リスト画面のモーダル（`PropertyListingDetailModal`）から備忘録を保存する THEN the system SHALL CONTINUE TO モーダル内の保存処理（`handleSave`）が正常に動作する（モーダルは既に `saving` フラグと `fetchData()` を正しく実装済み）

3.3 WHEN ユーザーが物件詳細ページで備忘録フィールドを変更せずに保存ボタンを押す THEN the system SHALL CONTINUE TO 変更がない場合は保存処理を実行しない（早期リターン）

3.4 WHEN 備忘録の保存が成功する THEN the system SHALL CONTINUE TO `editedData` をクリアし、最新データを画面に反映する
