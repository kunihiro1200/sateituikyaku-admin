# Tasks

## Task List

- [x] 1. `WorkTaskDetailModal` 内のインライン関数コンポーネントによる再マウント問題を修正する
  - [x] 1.1 `useCwCounts()` の呼び出しを `WorkTaskDetailModal` のトップレベルに移動し、`SiteRegistrationSection` に props として渡す
  - [x] 1.2 `SiteRegistrationSection` の `useCwCounts` 呼び出しを削除し、props から受け取るように変更する
  - [x] 1.3 `DialogContent` に `ref` を追加し、フィールド変更時にスクロール位置を保存・復元する `handleFieldChange` ラッパーを実装する（最小変更アプローチ）
  - [x] 1.4 修正後に `getDiagnostics` でコンパイルエラーがないことを確認する

- [ ] 2. 修正後の動作を手動で検証する
  - [ ] 2.1 サイト登録タブを開き、テキストフィールドに文字を入力してもスクロールが発生しないことを確認する（Fix Checking）
  - [ ] 2.2 Y/N ボタンおよびボタン選択フィールドをクリックしてもスクロールが発生しないことを確認する（Fix Checking）
  - [ ] 2.3 保存ボタンを押して正常に保存されることを確認する（Preservation Checking）
  - [ ] 2.4 他タブ（媒介契約・契約決済）でのフィールド操作が正常に動作することを確認する（Preservation Checking）
