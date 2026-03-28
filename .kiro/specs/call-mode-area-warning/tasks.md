# 実装計画: call-mode-area-warning

## 概要

`CallModePage.tsx` のみを変更し、面積データの異常を検知して担当者に警告する機能を追加する。
変更は `frontend/frontend/src/pages/CallModePage.tsx` 1ファイルのみ。

## タスク

- [x] 1. `calcAreaWarning` 純粋関数と `areaWarningDismissed` state を追加する
  - [x] 1.1 `calcAreaWarning(land: number | null, building: number | null, dismissed: boolean)` 純粋関数をコンポーネント外に定義する
    - 引数: `land`（土地面積）、`building`（建物面積）、`dismissed`（確認済みフラグ）
    - 戻り値: `{ landRed: boolean, buildingRed: boolean, showWarning: boolean }`
    - 条件1: `dismissed === false` かつ `land !== null && building !== null && land < building` → `landRed: true, buildingRed: true`
    - 条件2: `dismissed === false` かつ `land !== null && land <= 99` → `landRed: true`
    - `showWarning` は `landRed || buildingRed` と等価
    - _Requirements: 1.1, 1.2, 1.3, 2.1, 2.2, 3.1, 3.2_
  - [x] 1.2 `const [areaWarningDismissed, setAreaWarningDismissed] = useState(false)` を既存 state 群に追加する
    - _Requirements: 4.2, 4.3, 4.4_

- [x] 2. `areaWarning` useMemo を追加し、土地面積・建物面積の表示に赤文字スタイルを適用する
  - [x] 2.1 `areaWarning` useMemo を追加する
    - `displayLandArea` と `displayBuildingArea` を `parseFloat` で数値変換し `calcAreaWarning` を呼び出す
    - 依存配列: `[displayLandArea, displayBuildingArea, areaWarningDismissed]`
    - _Requirements: 1.1, 1.2, 1.3, 2.1, 2.2_
  - [x] 2.2 土地面積の `<Typography>` に `sx={{ color: areaWarning.landRed ? 'error.main' : 'inherit' }}` を追加する
    - _Requirements: 1.1, 2.1, 4.3_
  - [x] 2.3 建物面積の `<Typography>` に `sx={{ color: areaWarning.buildingRed ? 'error.main' : 'inherit' }}` を追加する
    - _Requirements: 1.2, 4.3_

- [x] 3. 物件種別行の右側に警告メッセージ・確認済みボタン・確認済みテキストを追加する
  - [x] 3.1 物件種別の表示行を `<Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>` でラップする
    - _Requirements: 3.1, 4.1, 4.4_
  - [x] 3.2 `areaWarning.showWarning` が `true` のとき「面積確認してください！」メッセージと「確認済み」ボタンを表示する
    - メッセージ: `<Typography variant="body2" color="error" sx={{ fontWeight: 'bold' }}>面積確認してください！</Typography>`
    - ボタン: `<Button size="small" variant="outlined" color="warning" onClick={() => setAreaWarningDismissed(true)}>確認済み</Button>`
    - _Requirements: 3.1, 4.1, 4.2_
  - [x] 3.3 `areaWarningDismissed` が `true` のとき「面積確認済み」テキストを表示する
    - `<Typography variant="body2" color="text.secondary">面積確認済み</Typography>`
    - _Requirements: 4.4_

- [x] 4. チェックポイント — 全テストが通ることを確認する
  - 全テストが通ることを確認し、疑問があればユーザーに確認する。

- [ ] 5. `calcAreaWarning` のプロパティベーステストを作成する
  - [ ]* 5.1 Property 1: 土地 < 建物 の場合に土地・建物両方が赤文字になる
    - `fc.float({ min: 0.1, max: 999 })` × 2 で `land < building` のとき `landRed === true && buildingRed === true && showWarning === true` を検証
    - `land > 99 && land >= building` のとき `buildingRed === false` を検証
    - **Property 1: 土地 < 建物 の場合に土地・建物両方が赤文字になる**
    - **Validates: Requirements 1.1, 1.2, 1.3**
  - [ ]* 5.2 Property 2: 土地面積 ≤ 99 の場合に土地のみ赤文字になる
    - `fc.float({ min: 0.1, max: 99 })` で `calcAreaWarning(land, null, false)` を呼び出し `landRed === true && buildingRed === false && showWarning === true` を検証
    - **Property 2: 土地面積 ≤ 99 の場合に土地のみ赤文字になる**
    - **Validates: Requirements 2.1, 2.2**
  - [ ]* 5.3 Property 3: 警告条件と警告表示の対応
    - `fc.option(fc.float(...))` × 2 で `showWarning === (landRed || buildingRed)` を検証
    - **Property 3: 警告条件と警告表示の対応**
    - **Validates: Requirements 3.1, 3.2**
  - [ ]* 5.4 Property 4: 確認済みボタンクリック後の状態変化
    - `fc.float({ min: 0.1, max: 99 })` で `dismissed=false` → `showWarning === true`、`dismissed=true` → 全て `false` を検証
    - **Property 4: 確認済みボタンクリック後の状態変化**
    - **Validates: Requirements 4.2, 4.3, 4.4**
  - テストファイル: `frontend/frontend/src/tests/call-mode-area-warning.test.ts`
  - fast-check を使用（`numRuns: 100`）

- [x] 6. 最終チェックポイント — 全テストが通ることを確認する
  - 全テストが通ることを確認し、疑問があればユーザーに確認する。

## Notes

- `*` 付きのサブタスクはオプション（スキップ可能）
- `calcAreaWarning` は純粋関数としてコンポーネント外に定義することでテスト可能にする
- `displayLandArea` / `displayBuildingArea` は既存コードで定義済みの変数を参照する
- バックエンドの変更は一切不要
