# 実装計画: 業務リスト詳細画面ヘッダーナビゲーション

## 概要

`WorkTaskDetailModal.tsx` に `useNavigate` と `PageNavigation` を追加し、業務詳細画面から他の主要画面へワンクリックで遷移できるようにする。変更対象は1ファイルのみ。

## タスク

- [x] 1. WorkTaskDetailModal にヘッダーナビゲーションを追加する
  - [x] 1.1 インポート・フック・ハンドラーを追加する
    - `useNavigate` を `react-router-dom` からインポートする
    - `PageNavigation` を `./PageNavigation` からインポートする
    - コンポーネント内に `const navigate = useNavigate();` フックを追加する
    - `handleNavigate` ハンドラーを追加する（`onClose()` → `navigate(path)` の順）
    - Pythonスクリプトを使ってUTF-8で書き込むこと（file-encoding-protection.md のルールに従う）
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 4.1, 4.4_

  - [ ]* 1.2 handleNavigate のプロパティテストを書く
    - **Property 1: ナビゲーション時のモーダルクローズ**
    - **Validates: Requirements 2.1, 2.2, 2.3, 2.4, 2.5, 4.4**
    - `fast-check` を使用し、5つの内部パスに対して `onClose` が先に呼ばれ `navigate` が後に呼ばれることを検証する

  - [x] 1.3 DialogTitle 内に PageNavigation を配置する
    - 既存の `DialogTitle` 内 `Box` の先頭に `<PageNavigation onNavigate={handleNavigate} />` を追加する
    - 既存の「業務一覧」ボタン・物件番号・バッジのレイアウトを維持する
    - Pythonスクリプトを使ってUTF-8で書き込むこと（file-encoding-protection.md のルールに従う）
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 3.1, 3.2, 3.3, 4.2, 4.3_

  - [ ]* 1.4 ユニットテストを書く
    - `WorkTaskDetailModal` が開いた時に `PageNavigation` が存在することを確認
    - 既存の「業務一覧」ボタン・物件番号・バッジが引き続き表示されることを確認
    - _Requirements: 1.1, 1.2, 4.3_

- [x] 2. チェックポイント - 全テストがパスすることを確認
  - 全テストがパスすることを確認し、疑問点があればユーザーに確認する。

## Notes

- `*` が付いたタスクはオプションであり、MVP向けにスキップ可能
- 変更対象ファイルは `frontend/frontend/src/components/WorkTaskDetailModal.tsx` のみ
- 日本語を含むファイルのため、Pythonスクリプトを使ってUTF-8で書き込むこと
- バックエンド変更は不要
