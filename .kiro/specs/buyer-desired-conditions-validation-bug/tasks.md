# Implementation Plan

- [x] 1. バグ条件の探索テストを書く
  - **Property 1: Bug Condition** - 複数フィールド一括変更時の誤バリデーションエラー
  - **重要**: このテストは未修正コードで必ず FAIL する — 失敗がバグの存在を証明する
  - **修正しようとしない**: テストが失敗しても、コードもテストも修正しないこと
  - **目的**: バグが存在することを示す反例を見つける
  - **スコープ付きPBTアプローチ**: 決定論的バグのため、具体的な失敗ケースにスコープを絞る
  - テスト対象: `handleSaveAll` 内のバリデーションロジック（`checkDistributionRequiredFields` のループ部分）
  - バグ条件（isBugCondition）: `Object.keys(pendingChanges).length > 1` かつ `distribution_type === '要'` かつ `{ ...buyer, ...pendingChanges }` の仮想状態では全必須フィールドが揃っている
  - テストケース1: `pendingChanges = { desired_area: '㊶別府', price_range_land: '3000万円台' }`、`distribution_type = '要'`、`desired_property_type = '土地'`（既存値）→ 未修正コードでは「価格帯（土地）は必須です」エラーが発生する
  - テストケース2: `pendingChanges = { desired_property_type: '戸建て', price_range_house: '3000万円台' }`、`distribution_type = '要'`、`desired_area` が既存値あり → 未修正コードでは「価格帯（戸建）は必須です」エラーが発生する
  - テストケース3: `pendingChanges = { desired_area: '㊶別府', desired_property_type: '土地', price_range_land: '3000万円台' }` → 未修正コードでは最初のフィールドチェック時に他フィールドが無視されてエラーが発生する
  - テストを実行し、**FAIL することを確認**（これが正しい結果）
  - 反例を記録する（例: 「全必須フィールドが pendingChanges に含まれているのに、個別チェックで他フィールドが無視されてエラーが発生」）
  - タスク完了条件: テストを書き、実行し、失敗を記録したとき
  - _Requirements: 1.1, 1.2_

- [x] 2. 保全プロパティテストを書く（修正前に実施）
  - **Property 2: Preservation** - 必須フィールド未入力時のエラー継続・配信メール「要」以外のスキップ
  - **重要**: 観察優先メソドロジーに従うこと
  - 未修正コードで非バグ条件の入力（isBugCondition が false のケース）の動作を観察する
  - 観察1: `pendingChanges = { desired_area: '' }`、`distribution_type = '要'` → 「エリアは必須です」エラーが発生する
  - 観察2: `pendingChanges = { desired_property_type: '土地' }`、`price_range_land` が未入力 → 「価格帯（土地）は必須です」エラーが発生する
  - 観察3: `distribution_type = '不要'` → バリデーションなしで保存処理が実行される
  - 観察4: `pendingChanges = { desired_area: '㊶別府' }`（1フィールドのみ）、全必須フィールドが揃っている → エラーなしで保存される
  - プロパティベーステスト: 任意の `pendingChanges` で `{ ...buyer, ...pendingChanges }` の仮想状態で必須フィールドが欠けている場合は常にエラーが発生することを検証
  - プロパティベーステスト: 任意の `pendingChanges` で `distribution_type` が「要」でない場合は常にバリデーションスキップされることを検証
  - テストを未修正コードで実行し、**PASS することを確認**（ベースライン動作の確認）
  - タスク完了条件: テストを書き、実行し、未修正コードでパスを確認したとき
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_

- [x] 3. handleSaveAll のバリデーションループを一括バリデーションに修正

  - [x] 3.1 修正を実装する
    - `frontend/frontend/src/pages/BuyerDesiredConditionsPage.tsx` の `handleSaveAll` 関数を修正
    - 既存のバリデーションループを削除:
      ```typescript
      for (const [fieldName, newValue] of Object.entries(pendingChanges)) {
        const validationError = checkDistributionRequiredFields(fieldName, newValue);
        if (validationError) { ... }
      }
      ```
    - 一括仮想状態の構築と新しいバリデーションロジックに置き換える:
      ```typescript
      const mergedBuyer = { ...buyer, ...pendingChanges };
      ```
    - `mergedBuyer` を使って `distribution_type === '要'` の場合のみ必須チェックを実行
    - `checkDistributionRequiredFields` 関数自体は変更しない（`handleInlineFieldSave` で引き続き使用）
    - _Bug_Condition: `Object.keys(pendingChanges).length > 1` かつ `distribution_type === '要'` かつ `{ ...buyer, ...pendingChanges }` で全必須フィールドが揃っている_
    - _Expected_Behavior: `mergedBuyer = { ...buyer, ...pendingChanges }` の仮想状態で全必須フィールドを確認し、全て揃っていれば保存を実行する_
    - _Preservation: `handleInlineFieldSave` の1フィールド単位バリデーション、配信メール「要」以外のスキップ、1フィールドのみの場合の動作は変更しない_
    - _Requirements: 2.1, 2.2, 3.1, 3.2, 3.3, 3.4, 3.5_

  - [x] 3.2 バグ条件の探索テストが PASS することを確認
    - **Property 1: Expected Behavior** - 複数フィールド一括変更時の正しいバリデーション
    - **重要**: タスク1で書いた同じテストを再実行する — 新しいテストを書かないこと
    - タスク1のテストは期待動作をエンコードしている
    - このテストが PASS すれば、バグが修正されたことを確認できる
    - タスク1のバグ条件探索テストを実行する
    - **期待される結果**: テストが PASS する（バグが修正されたことを確認）
    - _Requirements: 2.1, 2.2_

  - [x] 3.3 保全テストが引き続き PASS することを確認
    - **Property 2: Preservation** - 必須フィールド未入力時のエラー継続・配信メール「要」以外のスキップ
    - **重要**: タスク2で書いた同じテストを再実行する — 新しいテストを書かないこと
    - タスク2の保全プロパティテストを実行する
    - **期待される結果**: テストが PASS する（リグレッションなしを確認）
    - 修正後も全テストがパスすることを確認する

- [x] 4. チェックポイント — 全テストのパスを確認
  - 全テスト（バグ条件テスト・保全テスト）がパスすることを確認する
  - 疑問点があればユーザーに確認する
