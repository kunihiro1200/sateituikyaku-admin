# 実装計画：通話モードページへのサイトURL表示・査定理由フィールド追加

## 概要

`CallModePage.tsx` のみを変更し、2つのUI要素を追加する。バックエンド・型定義・同期処理は変更不要。

## タスク

- [x] 1. サイトURLリンクの条件付き表示を実装する
  - `frontend/frontend/src/pages/CallModePage.tsx` のコメントフィールドのコンテナを横並びレイアウトに変更する
  - `seller.inquirySite === 'ウ' && seller.siteUrl && seller.siteUrl.trim() !== ''` の条件でリンクを表示する
  - MUI の `Link` コンポーネントまたは `<a>` タグで `target="_blank" rel="noopener noreferrer"` を設定する
  - _Requirements: 1.1, 1.2, 1.3, 1.4_

  - [ ]* 1.1 サイトURLリンクの条件付き表示のプロパティテストを書く
    - **Property 1: サイトURLリンクの条件付き表示**
    - **Validates: Requirements 1.1, 1.2, 1.4**

  - [ ]* 1.2 サイトURLリンクの新規タブ開放のプロパティテストを書く
    - **Property 2: サイトURLリンクの新規タブ開放**
    - **Validates: Requirements 1.3**

- [x] 2. 査定理由フィールドの常時表示を実装する
  - コメントフィールドの `</Box>` と保存ボタンの間に査定理由フィールドを挿入する
  - MUI の `TextField` に `InputProps={{ readOnly: true }}` を設定する
  - ラベルは「査定理由（査定サイトから転記）」とする
  - `seller.valuationReason || '未入力'` で値を表示する
  - _Requirements: 2.1, 2.2, 2.3, 2.4, 3.2, 3.3_

  - [ ]* 2.1 査定理由フィールドの常時表示のプロパティテストを書く
    - **Property 3: 査定理由フィールドの常時表示**
    - **Validates: Requirements 2.1, 2.4**

  - [ ]* 2.2 査定理由フィールドの読み取り専用のプロパティテストを書く
    - **Property 4: 査定理由フィールドの読み取り専用**
    - **Validates: Requirements 2.3, 3.2, 3.3**

- [x] 3. チェックポイント - 全テストが通ることを確認する
  - 全テストが通ることを確認し、疑問点があればユーザーに確認する。

## Notes

- `*` 付きのタスクはオプションであり、MVP向けにスキップ可能
- 変更対象ファイルは `frontend/frontend/src/pages/CallModePage.tsx` のみ
- プロパティテストには fast-check を使用する
