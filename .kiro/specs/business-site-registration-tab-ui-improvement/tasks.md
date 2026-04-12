# 実装計画: 業務詳細画面「サイト登録」タブUI改善

## 概要

`WorkTaskDetailModal.tsx` の `SiteRegistrationSection` コンポーネントに対して、以下の3つのUI改善を段階的に実装します。

1. 種別「土」以外の場合のRedNote・道路寸法フィールドの条件付き非表示
2. 「【登録関係】」「【確認関係】」のフォントサイズを `subtitle2` → `subtitle1` に変更
3. 5セクションへの異なる背景色の適用

## タスク

- [x] 1. 対象コンポーネントの現状確認と実装準備
  - `frontend/frontend/src/components/WorkTaskDetailModal.tsx` の `SiteRegistrationSection` 実装を確認する
  - RedNoteコンポーネントの配置箇所（`地積測量図や字図を格納...`）を特定する
  - `EditableField label="道路寸法"` の配置箇所を特定する
  - `Typography variant="subtitle2"` の「【登録関係】」「【確認関係】」の配置箇所を特定する
  - 各セクション（【サイト登録依頼】【図面作成依頼】【★サイト登録確認】【★図面確認】【確認後処理】）の範囲を特定する
  - _Requirements: 1.1, 1.2, 2.1, 2.2, 3.1〜3.5_

- [~] 2. 条件付き非表示の実装
  - [x] 2.1 RedNoteコンポーネントを `property_type === '土'` 条件でラップする
    - Pythonスクリプトを使用してUTF-8エンコーディングを保護しながら変更を適用する
    - `getValue('property_type') === '土'` の条件式を使用する（既存パターンと統一）
    - _Requirements: 1.1, 1.3, 1.4_
  - [x] 2.2 `EditableField label="道路寸法"` を `property_type === '土'` 条件でラップする
    - Pythonスクリプトを使用してUTF-8エンコーディングを保護しながら変更を適用する
    - `getValue('property_type') === '土'` の条件式を使用する
    - _Requirements: 1.2, 1.3, 1.4_
  - [ ]* 2.3 プロパティテスト: 種別「土」以外での条件付き非表示（Property 1）
    - **Property 1: 種別「土」以外での条件付き非表示**
    - **Validates: Requirements 1.1, 1.2**
    - `fast-check` を使用し、`fc.string().filter(s => s !== '土')` で任意の非「土」文字列を生成
    - RedNoteと道路寸法フィールドが非表示になることを確認（numRuns: 100）
  - [ ]* 2.4 プロパティテスト: 種別「土」での条件付き表示（Property 2）
    - **Property 2: 種別「土」での条件付き表示**
    - **Validates: Requirements 1.3**
    - `property_type === '土'` の場合にRedNoteと道路寸法フィールドが表示されることを確認
  - [ ]* 2.5 プロパティテスト: property_type変更時のリアルタイム切り替え（Property 3）
    - **Property 3: property_type変更時のリアルタイム切り替え**
    - **Validates: Requirements 1.4**
    - 「土」→他の値、他の値→「土」の変更で表示状態が即座に切り替わることを確認

- [x] 3. チェックポイント - 条件付き非表示の動作確認
  - すべてのテストが通ることを確認し、疑問点があればユーザーに確認する。

- [~] 4. フォントサイズ変更の実装
  - [x] 4.1 「【登録関係】」Typographyの `variant` を `subtitle2` → `subtitle1` に変更する
    - Pythonスクリプトを使用してUTF-8エンコーディングを保護しながら変更を適用する
    - 既存の `fontWeight: 700` と `color: '#1565c0'` を維持する
    - _Requirements: 2.1, 2.3_
  - [x] 4.2 「【確認関係】」Typographyの `variant` を `subtitle2` → `subtitle1` に変更する
    - Pythonスクリプトを使用してUTF-8エンコーディングを保護しながら変更を適用する
    - 既存の `fontWeight: 700` と `color: '#2e7d32'` を維持する
    - _Requirements: 2.2, 2.4_
  - [ ]* 4.3 ユニットテスト: フォントサイズ変更の確認
    - 「【登録関係】」「【確認関係】」のTypographyが `variant="subtitle1"` であることを確認
    - 既存の `color` と `fontWeight` が維持されていることを確認
    - _Requirements: 2.1, 2.2, 2.3, 2.4_

- [~] 5. セクション背景色の実装
  - [x] 5.1 【サイト登録依頼】セクションをBoxでラップし背景色 `#e3f2fd` を適用する
    - Pythonスクリプトを使用してUTF-8エンコーディングを保護しながら変更を適用する
    - `<Box sx={{ bgcolor: '#e3f2fd', borderRadius: 1, p: 1, mb: 1 }}>` でラップする
    - SectionHeaderを含む全フィールドが背景色の範囲内に収まるようにする
    - _Requirements: 3.1, 3.6, 3.7, 3.8_
  - [x] 5.2 【図面作成依頼】セクションをBoxでラップし背景色 `#e8f5e9` を適用する
    - Pythonスクリプトを使用してUTF-8エンコーディングを保護しながら変更を適用する
    - `<Box sx={{ bgcolor: '#e8f5e9', borderRadius: 1, p: 1, mb: 1 }}>` でラップする
    - _Requirements: 3.2, 3.6, 3.7, 3.8_
  - [x] 5.3 【★サイト登録確認】セクションをBoxでラップし背景色 `#f3e5f5` を適用する
    - Pythonスクリプトを使用してUTF-8エンコーディングを保護しながら変更を適用する
    - `<Box sx={{ bgcolor: '#f3e5f5', borderRadius: 1, p: 1, mb: 1 }}>` でラップする
    - _Requirements: 3.3, 3.6, 3.7, 3.8_
  - [x] 5.4 【★図面確認】セクションをBoxでラップし背景色 `#fff3e0` を適用する
    - Pythonスクリプトを使用してUTF-8エンコーディングを保護しながら変更を適用する
    - `<Box sx={{ bgcolor: '#fff3e0', borderRadius: 1, p: 1, mb: 1 }}>` でラップする
    - _Requirements: 3.4, 3.6, 3.7, 3.8_
  - [x] 5.5 【確認後処理】セクションをBoxでラップし背景色 `#fafafa` を適用する
    - Pythonスクリプトを使用してUTF-8エンコーディングを保護しながら変更を適用する
    - `<Box sx={{ bgcolor: '#fafafa', borderRadius: 1, p: 1, mb: 1 }}>` でラップする
    - _Requirements: 3.5, 3.6, 3.7, 3.8_
  - [ ]* 5.6 ユニットテスト: 背景色の適用確認
    - 5つのセクションそれぞれに `bgcolor` が設定されていることを確認
    - 5つの背景色が全て異なることを確認
    - SectionHeaderが背景色を持つBoxの内部にあることを確認
    - _Requirements: 3.1〜3.8_

- [x] 6. 最終チェックポイント - 全テスト通過確認
  - すべてのテストが通ることを確認し、疑問点があればユーザーに確認する。

## 注意事項

- タスクに `*` が付いているものはオプションであり、MVPとして省略可能
- 日本語を含むファイルの編集は必ずPythonスクリプトを使用すること（UTF-8エンコーディング保護）
- 各タスクは要件との対応が明確になるよう実装すること
- プロパティテストは `@testing-library/react` + `fast-check` を使用する
