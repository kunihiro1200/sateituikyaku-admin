# 実装計画：buyer-viewing-pre-day-header-button

## 概要

`BuyerViewingResultPage` のヘッダーに「内覧日前日一覧」ボタンを追加し、`BuyersPage` で URL クエリパラメータ `status` を読み取って `selectedCalculatedStatus` の初期値にセットする。変更対象は2ファイルのみ。

## タスク

- [x] 1. BuyerViewingResultPage に「内覧日前日一覧」ボタンを追加する
  - `frontend/frontend/src/pages/BuyerViewingResultPage.tsx` を編集する
  - `isViewingPreDay(buyer)` が true の場合のみ表示される `<Button>` を追加する
  - ボタンの `color="success"` / `variant="outlined"` を設定する
  - `onClick` で `navigate('/buyers?status=内覧日前日')` を呼び出す
  - 既存のヘッダー要素（戻るボタン・タイトル・買主名・メール/SMSボタン等）のレイアウトを崩さないよう、既存の `<Box sx={{ ml: 'auto', ... }}>` 内に追加する
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 2.1_

  - [ ]* 1.1 Property 1 のプロパティテストを書く
    - **Property 1: 条件付きボタン表示**
    - `isViewingPreDay` が true の buyer でボタンが DOM に存在し、false の buyer でボタンが DOM に存在しないことを fast-check で検証する
    - テストファイル: `frontend/frontend/src/__tests__/BuyerViewingPreDayHeaderButton.property.test.tsx`
    - **Validates: Requirements 1.1, 1.2**

  - [ ]* 1.2 Property 2 のプロパティテストを書く
    - **Property 2: ナビゲーション先の正確性**
    - `isViewingPreDay=true` の buyer を生成し、ボタンクリック後に `navigate` が `/buyers?status=内覧日前日` を引数として呼び出されることを fast-check で検証する
    - テストファイル: `frontend/frontend/src/__tests__/BuyerViewingPreDayHeaderButton.property.test.tsx`（同ファイルに追記）
    - **Validates: Requirements 2.1**

- [x] 2. BuyersPage で URL クエリパラメータ `status` を読み取り selectedCalculatedStatus の初期値にセットする
  - `frontend/frontend/src/pages/BuyersPage.tsx` を編集する
  - `useSearchParams` を `react-router-dom` からインポートする（既存の `useNavigate` と同じインポート文に追加）
  - `const [searchParams] = useSearchParams();` を追加する
  - `const initialStatus = searchParams.get('status');` を追加する
  - `selectedCalculatedStatus` の `useState` 初期値を `null` から `initialStatus` に変更する
  - _Requirements: 2.2, 2.3_

  - [ ]* 2.1 Property 3 のプロパティテストを書く
    - **Property 3: クエリパラメータによる初期ステータス設定**
    - 任意の `status` 文字列を fast-check で生成し、その URL で `BuyersPage` をレンダリングしたとき `selectedCalculatedStatus` の初期値がパラメータ値と等しいことを検証する
    - `status` パラメータなしの場合は `null` になることも検証する（エッジケース）
    - テストファイル: `frontend/frontend/src/__tests__/BuyersPageStatusParam.property.test.tsx`
    - **Validates: Requirements 2.2, 2.3**

- [x] 3. 最終チェックポイント
  - 全テストが通ることを確認する。疑問点があればユーザーに確認する。

## Notes

- `*` 付きのサブタスクはオプション（スキップ可能）
- プロパティテストには既存プロジェクトの **fast-check** を使用する
- 各プロパティテストは対応する設計ドキュメントのプロパティ番号をコメントで参照すること
- 変更対象ファイルは `BuyerViewingResultPage.tsx` と `BuyersPage.tsx` の2ファイルのみ
