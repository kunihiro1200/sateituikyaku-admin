# 実装計画

- [x] 1. バグ条件の探索テストを書く
  - **Property 1: Bug Condition** - 手入力査定額のUI復元失敗 & スプシCB/CC/CD列同期欠落
  - **重要**: このテストは修正前のコードで実行すること
  - **目的**: バグが存在することを確認するカウンターエグザンプルを記録する
  - **スコープ**: 決定論的バグのため、具体的な失敗ケースに絞る
  - **バグ1テスト**: `valuationAmount1=30000000, fixedAssetTaxRoadPrice=null` のデータで `loadAllData()` の査定額初期化ロジックをテスト
    - `isManualValuation` が `false` のままであることを確認（未修正コードでは `setIsManualValuation(false)` が無条件実行されるため）
    - `editedManualValuationAmount1` が `''` のままであることを確認
  - **バグ2テスト**: `valuation_amount_1=30000000` のデータで `ColumnMapper.mapToSheet()` を呼び出し
    - 返り値に `査定額1` キーが存在しないことを確認（マッピングが存在しないため）
    - 返り値に `査定額2`・`査定額3` キーが存在しないことを確認
  - **期待される結果**: テストが FAIL する（バグの存在を証明）
  - カウンターエグザンプルを記録する（例: `isManualValuation=false` のまま、`査定額1` キーなし）
  - テストを書き、実行し、失敗を記録したらタスク完了とする
  - _Requirements: 1.1, 1.2, 1.3, 1.4_

- [x] 2. 保全プロパティテストを書く（修正前に実施）
  - **Property 2: Preservation** - 手入力未保存時の動作・BC/BD/BE列の既存同期維持
  - **重要**: 観察優先メソドロジーに従う
  - **観察1**: `valuationAmount1=null` のデータで `loadAllData()` を呼び出す → `isManualValuation=false`、空欄維持（未修正コードで確認）
  - **観察2**: `valuationAmount1=30000000, fixedAssetTaxRoadPrice=50000` のデータ → `isManualValuation=false`（自動計算モード）
  - **観察3**: `valuation_amount_1=30000000` で `mapToSheet()` を呼び出す → `査定額1（自動計算）v: 3000` が含まれる
  - プロパティベーステスト: `valuationAmount1=null` の任意の入力で `isManualValuation=false` かつ空欄維持
  - プロパティベーステスト: `fixedAssetTaxRoadPrice` が非nullの任意の入力で `isManualValuation=false`
  - プロパティベーステスト: 任意の `valuation_amount_1/2/3` 値で `mapToSheet()` が `査定額1（自動計算）v` / `査定額2（自動計算）v` / `査定額3（自動計算）v` を含む
  - **期待される結果**: テストが PASS する（保全すべきベースライン動作を確認）
  - テストを書き、実行し、パスを確認したらタスク完了とする
  - _Requirements: 3.1, 3.2, 3.3_

- [x] 3. 手入力査定額保存バグの修正

  - [x] 3.1 `CallModePage.tsx` の `loadAllData()` に手入力査定額復元ロジックを追加
    - `valuationAmount1` が存在し かつ `fixedAssetTaxRoadPrice` が `null` の場合を手入力モードと判定
    - 手入力モードの場合: `setIsManualValuation(true)` を設定し、万円単位（÷10000）に変換した値を `setEditedManualValuationAmount1/2/3` にセット
    - それ以外の場合: 既存の `setIsManualValuation(false)` / 空文字セットを維持
    - **注意**: 日本語を含むファイルのため、Pythonスクリプトで変更を適用すること（file-encoding-protection.md参照）
    - _Bug_Condition: `valuationAmount1 != null AND fixedAssetTaxRoadPrice == null`_
    - _Expected_Behavior: `isManualValuation=true`, `editedManualValuationAmount1=String(Math.round(valuationAmount1/10000))`_
    - _Preservation: `valuationAmount1=null` の場合は `isManualValuation=false` / 空欄維持_
    - _Requirements: 2.1, 2.2, 3.1, 3.2_

  - [x] 3.2 `ColumnMapper.ts` の `mapToSheet()` に CB/CC/CD列への書き込みを追加
    - `valuation_amount_1/2/3` の処理ブロック内で、BC/BD/BE列（既存）に加えてCB/CC/CD列（`査定額1/2/3`）にも同じ万円単位の値を書き込む
    - `manualColumnMap` を定義: `{ 'valuation_amount_1': '査定額1', 'valuation_amount_2': '査定額2', 'valuation_amount_3': '査定額3' }`
    - **注意**: `backend/src/services/ColumnMapper.ts` のみ編集すること（`backend/api/` は触らない）
    - _Bug_Condition: `trigger='saveManualValuation'` → CB/CC/CD列が更新されない_
    - _Expected_Behavior: `mapToSheet({ valuation_amount_1: 30000000 })` → `{ '査定額1（自動計算）v': 3000, '査定額1': 3000 }`_
    - _Preservation: BC/BD/BE列（`査定額1（自動計算）v` 等）への既存書き込みは維持_
    - _Requirements: 2.3, 2.4, 3.3_

  - [x] 3.3 バグ条件の探索テストが PASS することを確認
    - **Property 1: Expected Behavior** - 手入力査定額のUI復元 & CB/CC/CD列同期
    - **重要**: タスク1で書いた同じテストを再実行する（新しいテストを書かない）
    - `valuationAmount1=30000000, fixedAssetTaxRoadPrice=null` → `isManualValuation=true`, `editedManualValuationAmount1='3000'`
    - `mapToSheet({ valuation_amount_1: 30000000 })` → `{ '査定額1（自動計算）v': 3000, '査定額1': 3000 }`
    - **期待される結果**: テストが PASS する（バグが修正されたことを確認）
    - _Requirements: 2.1, 2.2, 2.3, 2.4_

  - [x] 3.4 保全プロパティテストが引き続き PASS することを確認
    - **Property 2: Preservation** - 手入力未保存時の動作・BC/BD/BE列の既存同期維持
    - **重要**: タスク2で書いた同じテストを再実行する（新しいテストを書かない）
    - **期待される結果**: テストが PASS する（リグレッションなし）
    - _Requirements: 3.1, 3.2, 3.3_

- [x] 4. チェックポイント - 全テストのパスを確認
  - 全テストが PASS していることを確認する
  - 疑問点があればユーザーに確認する
