# 実装計画: CallModePage SMS・メール送信履歴モーダル表示機能

## 概要

`frontend/frontend/src/pages/CallModePage.tsx` において、SMS・メール送信履歴のインライン展開表示をMUI Dialogモーダルに変更し、本文中の `<BR>` / `<br>` 文字列を改行として正しく表示する。バックエンド変更なし。

## タスク

- [x] 1. `convertBrToNewline` ユーティリティ関数の実装
  - `CallModePage.tsx` 内（またはファイル先頭付近）に `convertBrToNewline` 関数を追加する
  - `<BR>` / `<br>`（大文字・小文字問わず）を `\n` に変換する
  - null / undefined 入力に対して空文字列を返す
  - _Requirements: 2.1, 2.3, 2.4_

  - [ ]* 1.1 `convertBrToNewline` のプロパティテストを書く
    - **Property 1: BR変換の完全性**
    - **Validates: Requirements 2.1, 2.3, 2.4**
    - fast-check を使用し、任意の文字列に対して変換後に `<BR>` / `<br>` が残らないことを検証する（numRuns: 100）

- [x] 2. `SmsEmailHistoryModal` コンポーネントの実装
  - [x] 2.1 `SmsEmailHistoryModal` コンポーネントを `CallModePage.tsx` 内に追加する
    - Props: `open: boolean`, `activity: ActivityWithEmployee | null`, `onClose: () => void`
    - MUI `Dialog` を使用する（Requirements 3.4）
    - タイトルに種別ラベル（`💬 SMS` / `📧 メール`）とアイコン・色を表示する（Requirements 1.2, 3.3）
    - 送信日時・送信者名を表示する（Requirements 1.3）
    - メール種別の場合のみ件名（`activity.metadata?.subject`）を表示する（Requirements 1.4）
    - 本文（SMS: `activity.content` / メール: `activity.metadata?.body`）に `convertBrToNewline` を適用し `whiteSpace: 'pre-wrap'` で表示する（Requirements 1.5, 2.2, 2.3, 2.4）
    - 本文が null / undefined の場合は `'本文データなし（旧形式）'` を表示する（Requirements 2.5）
    - 本文が長い場合にスクロール可能な領域内に表示する（Requirements 3.1）
    - モバイル（sm ブレークポイント以下）でも正しく表示されるレスポンシブ対応（Requirements 3.2）
    - _Requirements: 1.2, 1.3, 1.4, 1.5, 2.2, 2.3, 2.4, 2.5, 3.1, 3.2, 3.3, 3.4_

  - [ ]* 2.2 `SmsEmailHistoryModal` のプロパティテストを書く（種別ラベル）
    - **Property 2: モーダルに種別ラベルが表示される**
    - **Validates: Requirements 1.2, 3.3**
    - fast-check で任意の `sms` / `email` Activity に対してタイトルに種別ラベルが含まれることを検証する（numRuns: 100）

  - [ ]* 2.3 `SmsEmailHistoryModal` のプロパティテストを書く（送信者情報）
    - **Property 3: モーダルに送信者情報が表示される**
    - **Validates: Requirements 1.3**
    - fast-check で任意の Activity（`employee.name` あり）に対してモーダル内に送信者名が表示されることを検証する（numRuns: 100）

  - [ ]* 2.4 `SmsEmailHistoryModal` のプロパティテストを書く（件名表示）
    - **Property 4: メール種別では件名が表示される**
    - **Validates: Requirements 1.4**
    - fast-check で任意の `email` 型 Activity（`metadata.subject` あり）に対してモーダル内に件名が表示されることを検証する（numRuns: 100）

  - [ ]* 2.5 `SmsEmailHistoryModal` のユニットテストを書く
    - 閉じるボタンクリック → `onClose` が呼ばれることを確認（Requirements 1.6）
    - モーダル外クリック → `onClose` が呼ばれることを確認（Requirements 1.7）
    - 本文 null → `'本文データなし（旧形式）'` が表示されることを確認（Requirements 2.5）
    - `whiteSpace: 'pre-wrap'` スタイルが本文要素に適用されていることを確認（Requirements 2.2）
    - _Requirements: 1.6, 1.7, 2.2, 2.5_

- [x] 3. チェックポイント - 全テストが通ることを確認
  - 全テストが通ることを確認する。問題があればユーザーに確認する。

- [-] 4. `CallModePage.tsx` の既存インライン展開ロジックを削除・置換する
  - [x] 4.1 不要な状態・関数を削除する
    - `expandedActivityIds` state（`useState<Set<string>>`）を削除する
    - `toggleActivityExpand` 関数（`useCallback`）を削除する
    - `renderActivityBody` ヘルパー関数を削除する
    - 展開パネル JSX（`{expandedActivityIds.has(activity.id) && <Box>...}`）を削除する
    - 履歴セクションの `ExpandMoreIcon` / `ExpandLessIcon` 使用箇所を削除する（他箇所での使用を確認してからインポートを削除）
    - _Requirements: 1.8, 1.9_

  - [x] 4.2 モーダル用の状態・ハンドラーを追加する
    - `selectedActivity` state（`useState<ActivityWithEmployee | null>(null)`）を追加する
    - `handleActivityClick` 関数を追加する（Activity をセットしてモーダルを開く）
    - `handleModalClose` 関数を追加する（`selectedActivity` を null にリセット）
    - _Requirements: 1.1_

  - [x] 4.3 履歴アイテムのクリックハンドラーを差し替え、`SmsEmailHistoryModal` を配置する
    - 履歴アイテムの `onClick` を `handleActivityClick` に変更する
    - JSX 内に `<SmsEmailHistoryModal>` を追加し、`open`・`activity`・`onClose` を渡す
    - _Requirements: 1.1, 1.6, 1.7_

  - [ ]* 4.4 統合ユニットテストを書く
    - 履歴アイテムクリック → モーダルが開くことを確認（Requirements 1.1）
    - `expandedActivityIds` / `toggleActivityExpand` が存在しないことを確認（Requirements 1.8）
    - 展開アイコンが履歴セクションに存在しないことを確認（Requirements 1.9）
    - _Requirements: 1.1, 1.8, 1.9_

- [x] 5. 最終チェックポイント - 全テストが通ることを確認
  - 全テストが通ることを確認する。問題があればユーザーに確認する。

## Notes

- `*` が付いたタスクはオプションであり、MVP優先の場合はスキップ可能
- 各タスクは要件番号でトレーサビリティを確保
- プロパティテストには fast-check を使用（numRuns: 100 以上）
- バックエンド変更は不要（フロントエンドの表示ロジックのみ）
- `ExpandMoreIcon` / `ExpandLessIcon` の削除前に他の使用箇所を必ず確認すること
