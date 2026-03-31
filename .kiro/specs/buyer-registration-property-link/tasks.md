# 実装計画: 新規買主登録ページの物件詳細リンク追加

## 概要

新規買主登録ページ（`/buyers/new`）の物件情報エリアに物件詳細画面へのリンクボタンを追加します。ユーザーは買主登録中に物件の詳細情報を新しいタブで素早く確認できるようになります。

## タスク

- [x] 1. NewBuyerPageコンポーネントにリンクボタンを追加
  - `frontend/frontend/src/pages/NewBuyerPage.tsx`を編集
  - Material-UIの`OpenInNew`アイコンをインポート
  - 物件情報エリアのタイトル「物件情報」の直下にリンクボタンを追加
  - リンクボタンのプロパティを設定（`variant="outlined"`, `size="small"`, `fullWidth`, `startIcon`, `component="a"`, `target="_blank"`, `rel="noopener noreferrer"`, `aria-label`, `sx={{ mb: 2 }}`）
  - 表示条件ロジックを実装（`propertyInfo && !loadingProperty && propertyNumberField`）
  - リンクのhrefを`/property-listings/${propertyInfo.property_number}`に設定
  - _要件: 1.1, 1.2, 1.3, 1.4, 1.5, 2.1, 2.3, 3.4, 4.1, 4.2, 4.3, 4.4, 5.1, 5.4_

- [ ]* 1.1 リンクボタンの表示条件とレンダリングのユニットテストを作成
  - `frontend/frontend/src/__tests__/NewBuyerPage.test.tsx`を作成または更新
  - 物件情報が存在する場合、リンクボタンが表示されることをテスト
  - 物件番号が空の場合、リンクボタンが表示されないことをテスト
  - 読み込み中の場合、リンクボタンが表示されないことをテスト
  - 物件情報がnullの場合、リンクボタンが表示されないことをテスト
  - リンクボタンのラベルが「物件詳細を見る」であることをテスト
  - リンクボタンにOpenInNewアイコンが含まれることをテスト
  - リンクボタンに`target="_blank"`属性が設定されていることをテスト
  - リンクボタンに`rel="noopener noreferrer"`属性が設定されていることをテスト
  - リンクボタンに`aria-label`属性が設定されていることをテスト
  - _要件: 1.1, 1.2, 1.3, 2.1, 3.1, 3.2, 3.3, 5.1, 5.4_

- [ ]* 1.2 リンクURLの生成ロジックのプロパティベーステストを作成
  - `frontend/frontend/src/__tests__/NewBuyerPage.pbt.test.ts`を作成
  - **Property 1: 物件情報取得時のリンク表示**
  - **検証要件: 1.1, 3.4**
  - fast-checkを使用して、任意の有効な物件番号に対してリンクが表示されることをテスト
  - _要件: 1.1, 3.4_

- [ ]* 1.3 リンクURLの正確性のプロパティベーステストを作成
  - `frontend/frontend/src/__tests__/NewBuyerPage.pbt.test.ts`に追加
  - **Property 2: リンクURLの正確性**
  - **検証要件: 2.3**
  - fast-checkを使用して、任意の物件番号に対してhrefが`/property-listings/{物件番号}`のパターンに一致することをテスト
  - _要件: 2.3_

- [ ] 2. チェックポイント - 実装確認とテスト実行
  - 全てのテストが通ることを確認
  - ブラウザで動作確認（物件番号を入力してリンクが表示されることを確認）
  - リンクをクリックして新しいタブで物件詳細画面が開くことを確認
  - 質問があればユーザーに確認

## 注意事項

- タスク1.1, 1.2, 1.3は`*`マークが付いているため、オプショナルです（スキップ可能）
- 各タスクは要件定義書の受入基準に対応しています
- リンクボタンは既存の`propertyInfo` stateを使用するため、新しいAPIエンドポイントは不要です
