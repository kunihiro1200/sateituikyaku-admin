# 実装計画: メール・SMS履歴本文展開表示

## 概要

`CallModePage.tsx` のメール・SMS履歴セクションに、各ログエントリをクリックして送信内容（メール件名・本文、SMSメッセージ）を展開表示する機能を追加する。変更対象はフロントエンドの1ファイルのみ。

## タスク

- [x] 1. 展開状態管理の実装
  - `expandedActivityIds` state（`Set<string>`）を `CallModePage` コンポーネントに追加する
  - `toggleActivityExpand` コールバック関数を実装する（展開中なら削除、未展開なら追加）
  - _Requirements: 1.1, 1.2, 1.3_

  - [ ]* 1.1 `toggleActivityExpand` のプロパティテストを作成する
    - **Property 1: トグルのラウンドトリップ** — 同一IDを2回トグルすると元の状態（折りたたみ）に戻る
    - **Validates: Requirements 1.2**
  - [ ]* 1.2 展開状態の独立性プロパティテストを作成する
    - **Property 2: 展開状態の独立性** — IDが異なる2エントリの展開操作は互いに影響しない
    - **Validates: Requirements 1.3**

- [x] 2. 展開パネルのレンダリングロジック実装
  - `renderActivityBody` ヘルパー関数をコンポーネント内に定義する
  - メール種別（`type === 'email'`）の場合: `metadata?.subject`（件名）と `metadata?.body`（本文）を表示する
  - `metadata.body` が未設定の場合は「本文データなし（旧形式）」を表示する
  - `metadata.subject` が未設定の場合は件名欄を省略する
  - SMS種別（`type === 'sms'`）の場合: `content` フィールドを表示する
  - `content` が空または未設定の場合は「メッセージ内容なし」を表示する
  - 本文表示には `dangerouslySetInnerHTML` を使用せず、MUI `Typography` + `component="pre"` でプレーンテキスト表示する
  - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 3.1, 3.2_

  - [ ]* 2.1 メール本文XSS防止プロパティテストを作成する
    - **Property 3: メール本文の表示** — 任意の文字列（HTMLタグ含む）が `textContent` としてそのまま表示される（HTMLレンダリングなし）
    - **Validates: Requirements 2.2, 2.5**
  - [ ]* 2.2 SMS内容表示プロパティテストを作成する
    - **Property 4: SMS内容の表示** — 任意の非空 `content` 文字列が展開後に表示される
    - **Validates: Requirements 3.1**

- [x] 3. メール・SMS履歴セクションのUI更新
  - 既存のメール・SMS履歴セクション（行 4199〜4244 付近）の各エントリカードに展開トグル用の矢印アイコン（`ExpandMore` / `ExpandLess`）を追加する
  - エントリカードのクリックハンドラーに `toggleActivityExpand(activity.id)` を接続する
  - `expandedActivityIds.has(activity.id)` が `true` の場合、カード直下に展開パネルを表示する
  - 展開パネルのスタイル: 白背景、`maxHeight: 200px`、`overflow: auto`、`padding`
  - 展開パネル内で `renderActivityBody(activity)` を呼び出す
  - _Requirements: 1.1, 1.2, 1.4, 4.1, 4.2, 4.3, 4.4, 4.5_

  - [ ]* 3.1 メールラベル表示プロパティテストを作成する
    - **Property 5: メールラベルの表示** — メール種別の展開後に「件名:」「本文:」ラベルが表示される（subject 存在時は「件名:」も）
    - **Validates: Requirements 4.5**

- [x] 4. チェックポイント — 全テストが通ることを確認する
  - 全テストが通ることを確認し、疑問点があればユーザーに確認する。

## Notes

- `*` 付きのサブタスクはオプション（スキップ可能）
- 変更対象ファイルは `frontend/frontend/src/pages/CallModePage.tsx` のみ
- バックエンド変更なし（APIはすでに必要なデータを返している）
- プロパティテストには fast-check を使用する（プロジェクトで既に使用中）
- 各タスクは前のタスクの成果物を前提として積み上げる構造になっている
