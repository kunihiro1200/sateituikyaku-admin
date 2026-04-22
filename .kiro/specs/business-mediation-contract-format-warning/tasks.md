# 実装計画：媒介契約フォーマット警告機能

## 概要

`WorkTaskDetailModal.tsx` に媒介契約フォーマット警告機能を追加する。
純粋関数・ダイアログコンポーネント・ステート・保存フロー修正の順に実装し、既存の警告チェーンに組み込む。

## タスク

- [x] 1. `checkMediationFormatWarning` 純粋関数の追加
  - `WorkTaskDetailModal.tsx` のモジュールレベルに純粋関数を追加する
  - 引数 `getValue: (field: string) => any` を受け取り `boolean` を返す
  - `property_address === '不要'` かつ `!isEmpty(mediation_creator)` の場合のみ `true` を返す
  - 既存の `isEmpty` 関数を再利用する
  - _Requirements: 1.2, 1.6, 1.7_

  - [ ]* 1.1 `checkMediationFormatWarning` のプロパティテストを作成する
    - **Property 1: 媒介契約フォーマット警告の条件判定**
    - `property_address` と `mediation_creator` の任意の組み合わせに対して、`property_address === '不要'` かつ `mediation_creator` が空欄でない場合のみ `true` を返すことを検証する
    - `fast-check` を使用し `numRuns: 100` で実行する
    - **Validates: Requirements 1.2, 1.6, 1.7**

  - [ ]* 1.2 `getValue` の優先順位プロパティテストを作成する
    - **Property 2: getValue の優先順位**
    - `editedData[field]` が `undefined` でない場合は `editedData[field]` を返し、`undefined` の場合は `data[field]` を返すことを検証する
    - `fast-check` を使用し `numRuns: 100` で実行する
    - **Validates: Requirements 1.1**

- [x] 2. `MediationFormatWarningDialog` コンポーネントの追加
  - `WorkTaskDetailModal.tsx` のモジュールレベルにコンポーネントを追加する
  - `props`: `open: boolean`, `onConfirm: () => void`
  - タイトル部分に `WarningAmberIcon`（`warning.main` カラー）と「フォーマット警告」テキストを表示する
  - メッセージ内のURLを MUI `Link` コンポーネントでクリック可能なリンクとして表示する
  - 「OK」ボタンを `primary` カラー・`contained` バリアントで表示する
  - `onClose` プロパティを渡さず、ダイアログ外クリックで閉じないようにする
  - _Requirements: 1.3, 1.4, 3.1, 3.2, 3.3, 3.4_

  - [ ]* 2.1 `MediationFormatWarningDialog` の単体テストを作成する
    - `open=true` 時にダイアログが表示されることを確認する
    - タイトルに「フォーマット警告」が含まれることを確認する
    - `WarningAmberIcon` が表示されることを確認する
    - 指定URLがクリック可能なリンクとして表示されることを確認する
    - 「OK」ボタンが `primary` カラーで表示されることを確認する
    - OKボタンクリック時に `onConfirm` が呼ばれることを確認する
    - _Requirements: 1.3, 1.4, 3.1, 3.2, 3.3, 3.4_

- [x] 3. `mediationFormatWarningDialog` ステートの追加
  - `WorkTaskDetailModal` コンポーネント内に `useState` でステートを追加する
  - 型: `{ open: boolean }`、初期値: `{ open: false }`
  - _Requirements: 1.2_

- [x] 4. `handleSave` の修正（MediationFormatWarning チェックの挿入）
  - 既存の `RowAddWarningDialog` チェック通過後に新規チェックを挿入する
  - `checkMediationFormatWarning(getValue)` が `true` の場合、`mediationFormatWarningDialog` を `{ open: true }` にセットして処理を中断する
  - `false` の場合は既存の `checkSiteRegistrationWarning` / `checkFloorPlanWarning` チェックへ続行する
  - _Requirements: 1.2, 2.1, 2.2, 2.3, 2.4_

  - [ ]* 4.1 `handleSave` のチェック順序統合テストを作成する
    - `RowAddWarning` 条件が満たされる場合、`MediationFormatWarning` より先に表示されることを確認する
    - `RowAddWarning` 条件が満たされない場合、`MediationFormatWarning` チェックが実行されることを確認する
    - `MediationFormatWarning` が `false` の場合、`SiteRegistration` / `FloorPlan` チェックへ続行することを確認する
    - _Requirements: 2.1, 2.2, 2.3, 2.4_

- [x] 5. OKハンドラーの追加と `MediationFormatWarningDialog` のレンダリング
  - OKボタン押下時のハンドラーを追加する（`mediationFormatWarningDialog` を閉じ、`executeSave` を呼び出す）
  - `WorkTaskDetailModal` の JSX に `MediationFormatWarningDialog` を追加する（`open` と `onConfirm` を渡す）
  - _Requirements: 1.5_

- [x] 6. チェックポイント — 全テストが通ることを確認する
  - 全テストが通ることを確認する。問題があればユーザーに確認する。

## Notes

- `*` が付いたタスクはオプションであり、MVP優先の場合はスキップ可能
- 各タスクは要件番号で追跡可能
- チェックポイントで段階的な動作確認を行う
- プロパティテストは `fast-check` を使用し、最低100回実行する
