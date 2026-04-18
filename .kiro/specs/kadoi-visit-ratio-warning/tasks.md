# 実装計画：角井訪問査定割合警告機能

## 概要

通話モードページ（`/sellers/:id/call`）の訪問予約セクションで「I（角井）」が営担として選択された際に、当月の訪問査定割合が15%を超えている場合に警告ダイアログを表示する機能を実装する。

バックエンドの `GET /api/sellers/visit-stats` APIは既存のため新規作成不要。フロントエンドに純粋関数・ダイアログコンポーネント・ハンドラ拡張を追加し、プロパティベーステストで正確性を検証する。

## タスク

- [x] 1. 純粋関数 `calcKadoiVisitRatio` を実装する
  - [x] 1.1 `frontend/frontend/src/utils/visitRatioCalculator.ts` を新規作成する
    - `VisitStatEntry` および `VisitStatsResponse` インターフェースを定義する
    - `calcKadoiVisitRatio(stats, yamamotoInitials?)` 関数を実装する
    - 計算ロジック: `対象メンバー合計 = totalVisits - (yamamotoStats?.count ?? 0)`、`I件数 / 対象メンバー合計 * 100`
    - 分母が0の場合は0を返す（ゼロ除算安全）
    - _Requirements: 1.1, 1.2, 1.3, 1.4_

  - [ ]* 1.2 `calcKadoiVisitRatio` のプロパティベーステストを書く（Property 1）
    - **Property 1: 割合の値域不変条件（ゼロ除算安全性を包含）**
    - **Validates: Requirements 1.3, 1.5**
    - `fc.nat(100)` で I件数・山本件数・その他件数を生成し、結果が常に `0 <= ratio <= 100` であることを検証
    - テストファイル: `frontend/frontend/src/__tests__/visitRatioCalculator.property.test.ts`
    - `numRuns: 100`

  - [ ]* 1.3 `calcKadoiVisitRatio` のプロパティベーステストを書く（Property 2）
    - **Property 2: 山本除外後の割合増加不変条件**
    - **Validates: Requirements 1.2**
    - 山本件数1以上のケースで、山本あり割合 ≤ 山本なし割合 を検証
    - `numRuns: 100`

  - [ ]* 1.4 `calcKadoiVisitRatio` のユニットテストを書く
    - I=2, 全体=10, 山本=0 → 20%
    - I=1, 全体=10, 山本=2 → 12.5%（山本除外後の分母=8）
    - I=0, 全体=0 → 0%（ゼロ除算なし）
    - I=0, 全体=5 → 0%
    - _Requirements: 1.1, 1.2, 1.3_

- [x] 2. チェックポイント - 純粋関数の動作確認
  - 全テストが通ることを確認する。問題があればユーザーに確認する。

- [x] 3. `KadoiVisitRatioWarningDialog` コンポーネントを実装する
  - [x] 3.1 `frontend/frontend/src/components/KadoiVisitRatioWarningDialog.tsx` を新規作成する
    - `KadoiVisitRatioWarningDialogProps` インターフェースを定義する（`open`, `ratio`, `onContinue`, `onCancel`）
    - MUI `Dialog` を使用してダイアログを実装する
    - メッセージ: `今月の角井の訪問査定割合が15%を超えています（現在XX.X%）。このまま登録しますか？`
    - 「続ける」ボタンと「キャンセル」ボタンを表示する
    - `ratio.toFixed(1)` で小数点以下1桁表示
    - _Requirements: 2.4, 2.5_

  - [ ]* 3.2 `KadoiVisitRatioWarningDialog` のプロパティベーステストを書く（Property 3）
    - **Property 3: ダイアログメッセージへの割合値の埋め込み**
    - **Validates: Requirements 2.4**
    - `fc.float({ min: 0, max: 100, noNaN: true })` で任意の割合値を生成し、レンダリングされたメッセージに `ratio.toFixed(1) + '%'` が含まれることを検証
    - テストファイル: `frontend/frontend/src/__tests__/KadoiVisitRatioWarningDialog.property.test.tsx`
    - `numRuns: 100`

  - [ ]* 3.3 `KadoiVisitRatioWarningDialog` の統合テストを書く
    - 「続ける」ボタン押下で `onContinue` が呼ばれることを検証
    - 「キャンセル」ボタン押下で `onCancel` が呼ばれることを検証
    - _Requirements: 3.1, 3.2_

- [-] 4. `CallModePage.tsx` の営担変更ハンドラを拡張する
  - [x] 4.1 必要な状態変数とインポートを追加する
    - `visitRatioCalculator.ts` と `KadoiVisitRatioWarningDialog` をインポートする
    - 状態変数を追加: `kadoiWarningOpen`, `kadoiCurrentRatio`, `pendingVisitAssignee`, `previousVisitAssignee`
    - ローディング状態変数を追加: `loadingKadoiCheck`
    - _Requirements: 2.1, 4.2_

  - [x] 4.2 `handleVisitAssigneeChange` 非同期ハンドラを実装する
    - 新値が `'I'` の場合: `GET /api/sellers/visit-stats?month=YYYY-MM`（JST基準の当月）を呼び出す
    - API呼び出し中は `loadingKadoiCheck` を `true` にしてローディング表示
    - 割合が15%超の場合: `previousVisitAssignee` に現在値を保存し、警告ダイアログを表示
    - 割合が15%以下の場合: 通常通り `setEditedAssignedTo(newValue)` を呼び出す
    - APIエラー時: コンソールにログ出力し、フェイルオープンで `setEditedAssignedTo(newValue)` を呼び出す
    - _Requirements: 2.1, 2.2, 2.3, 4.1, 4.2, 4.3_

  - [x] 4.3 既存の `setEditedAssignedTo` 直接呼び出しを `handleVisitAssigneeChange` に置き換える
    - 行5569の `onClick={() => setEditedAssignedTo(initial)}` を `onClick={() => handleVisitAssigneeChange(initial)}` に変更する
    - 「外す」ボタン（`setEditedAssignedTo('')`）は `'I'` 以外なのでそのまま、または `handleVisitAssigneeChange('')` に統一する
    - 日本語ファイルのため、Pythonスクリプトで変更を適用する
    - _Requirements: 2.1_

  - [x] 4.4 `KadoiVisitRatioWarningDialog` をJSXに追加する
    - 「続ける」押下: `setEditedAssignedTo(pendingVisitAssignee!)` → `setKadoiWarningOpen(false)`
    - 「キャンセル」押下: `setEditedAssignedTo(previousVisitAssignee)` → `setKadoiWarningOpen(false)`
    - ローディング中は営担ボタン群に `CircularProgress` を表示する
    - _Requirements: 3.1, 3.2, 3.3, 4.2_

- [x] 5. チェックポイント - 全テストが通ることを確認する
  - 全テストが通ることを確認する。問題があればユーザーに確認する。

## 注意事項

- `*` が付いたサブタスクはオプションであり、スキップ可能
- 日本語を含むファイル（`CallModePage.tsx`）の編集は必ずPythonスクリプトを使用してUTF-8を保護する
- `backend/api/` は触らない（公開物件サイト用）
- `GET /api/sellers/visit-stats` は既存APIのため新規実装不要
- デプロイ（git commit & push）はコーディングエージェントのスコープ外のため含めない
