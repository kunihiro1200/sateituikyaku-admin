# 実装計画：買主詳細画面 次電日必須バリデーション

## 概要

`BuyerDetailPage` の保存処理に次電日（`next_call_date`）の必須チェックを追加する。
純粋関数 `requiresNextCallDate` によるバリデーション判定、`NextCallDateRequiredDialog` コンポーネントの実装、および `handleSectionSave` への組み込みを行う。

## タスク

- [x] 1. `requiresNextCallDate` 純粋関数の実装
  - `BuyerDetailPage.tsx` 内（またはユーティリティファイル）に `requiresNextCallDate(latestStatus, nextCallDate)` を実装する
  - `latestStatus` が NULL/空文字の場合は `false` を返す
  - `latestStatus` が「AZ」または「BZ」で始まる場合は `false` を返す
  - `latestStatus` に「A」または「B」が含まれ、かつ `nextCallDate` が NULL/空文字の場合のみ `true` を返す
  - _Requirements: 1.2, 1.3, 1.4, 1.5, 1.6, 3.1, 3.2, 3.3, 3.4_

  - [ ]* 1.1 `requiresNextCallDate` のユニットテストを作成する
    - デザインドキュメントのバリデーション判定表に基づく具体例テストを実装する
    - 対象ケース：A系ステータス+未設定→true、B系ステータス+未設定→true、AZ→false、BZ→false、次電日設定済み→false、C系→false、null/空文字→false
    - _Requirements: 1.2, 1.3, 1.4, 1.5, 1.6_

  - [ ]* 1.2 Property 1: バリデーション判定ロジックの正確性（PBT）
    - **Property 1: バリデーション判定ロジックの正確性**
    - fast-check を使用し、任意の `latestStatus` × `nextCallDate` の組み合わせに対して、`requiresNextCallDate` の返り値が期待値（5条件の論理積）と一致することを検証する
    - `numRuns: 100` 以上で実行する
    - **Validates: Requirements 1.2, 1.3, 1.4, 1.5, 1.6, 3.1, 3.2, 3.3, 3.4**

- [x] 2. `NextCallDateRequiredDialog` コンポーネントの実装
  - `BuyerDetailPage.tsx` 内または `frontend/frontend/src/components/NextCallDateRequiredDialog.tsx` として実装する
  - `open: boolean` と `onClose: () => void` を props として受け取る
  - ダイアログタイトルに `WarningAmberIcon`（`color="warning"`）を表示する
  - 警告メッセージ「最新状況がAやBの場合は次電日の設定は必須です。次電日の設定不要の場合はAZもしくはBZを選択してください。」を表示する
  - 「閉じる」ボタン（`variant="contained" color="warning"`）を表示し、押下時に `onClose` を呼ぶ
  - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5_

  - [ ]* 2.1 `NextCallDateRequiredDialog` のユニットテストを作成する
    - `open=true` 時に警告メッセージが表示されること
    - `open=true` 時に「閉じる」ボタンが表示されること
    - `open=true` 時に `WarningAmberIcon` が表示されること
    - 「閉じる」ボタン押下時に `onClose` が呼ばれること
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5_

- [x] 3. `BuyerDetailPage.tsx` への状態変数と組み込み
  - `const [nextCallDateDialogOpen, setNextCallDateDialogOpen] = useState(false)` を追加する
  - `handleSectionSave` の先頭（`changedFields` の空チェック直後）に `requiresNextCallDate` の呼び出しを追加する
  - 最終値の計算：`changedFields` に該当フィールドがあればそれを優先、なければ `buyer` の値を使用する
  - バリデーションが `true` の場合は `setNextCallDateDialogOpen(true)` して `return` する
  - JSX に `<NextCallDateRequiredDialog open={nextCallDateDialogOpen} onClose={() => setNextCallDateDialogOpen(false)} />` を追加する
  - _Requirements: 1.1, 1.2, 2.3_

  - [ ]* 3.1 `handleSectionSave` の統合テストを作成する
    - A系ステータス + 次電日未設定 → ダイアログが開き、API呼び出しが行われないこと
    - A系ステータス + 次電日設定済み → ダイアログが開かず、API呼び出しが行われること
    - AZ系ステータス + 次電日未設定 → ダイアログが開かず、API呼び出しが行われること
    - _Requirements: 1.1, 1.2, 1.3, 1.4_

- [x] 4. チェックポイント — 全テストが通ることを確認する
  - 全テストが通ることを確認し、疑問点があればユーザーに確認する。

## Notes

- `*` が付いたタスクはオプションであり、MVP優先の場合はスキップ可能
- 各タスクは要件との対応が明示されている
- Property 1 は fast-check を使用したプロパティベーステスト（PBT）
- ユニットテストとPBTは補完関係にある（PBTは網羅的、ユニットテストは具体例）
