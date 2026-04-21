# Implementation Plan

- [x] 1. バグ条件探索テストを作成する
  - **Property 1: Bug Condition** - 同じオプション再クリックで値がクリアされないバグ
  - **CRITICAL**: このテストは未修正コードで必ず FAIL する — FAIL がバグの存在を証明する
  - **DO NOT attempt to fix the test or the code when it fails**
  - **NOTE**: このテストは期待動作をエンコードしている — 修正後に PASS することで修正を検証する
  - **GOAL**: バグが存在することを示す反例を見つける
  - **Scoped PBT Approach**: 決定論的バグのため、具体的な失敗ケースにスコープを絞る
  - テスト対象: `EditableButtonSelect` の `onClick` ハンドラをシミュレートし、`handleFieldChange` の呼び出し引数を検証
  - バグ条件: `currentValue === clickedOption`（例: `site_registration_confirmed` が「他」の状態で「他」をクリック）
  - 期待動作（修正後）: `handleFieldChange(field, null)` が呼ばれること
  - 実際の動作（未修正）: `handleFieldChange(field, '他')` が呼ばれること（null にならない）
  - 反例例: `handleFieldChange('site_registration_confirmed', '他')` が呼ばれる（null ではない）
  - 未修正コードでテストを実行する
  - **EXPECTED OUTCOME**: テスト FAILS（これが正しい — バグの存在を証明する）
  - 見つかった反例を記録して根本原因を理解する
  - テストを作成・実行し、FAIL を記録したらタスク完了とする
  - _Requirements: 1.1, 1.2, 1.3_

- [x] 2. 保持プロパティテストを作成する（修正実装前に）
  - **Property 2: Preservation** - バグ条件外の操作で動作が変わらない
  - **IMPORTANT**: 観察優先メソドロジーに従う
  - 未修正コードで非バグ条件の入力（`currentValue !== clickedOption`）の動作を観察する
  - 観察1: `null` 状態で「確認中」をクリック → `handleFieldChange(field, '確認中')` が呼ばれる
  - 観察2: 「確認中」が選択中に「完了」をクリック → `handleFieldChange(field, '完了')` が呼ばれる
  - 観察3: `EditableYesNo` で Y ボタンをクリック → 既存のトグル動作（`getValue(field) === 'Y' ? null : 'Y'`）が維持される
  - プロパティベーステスト: バグ条件外（`currentValue !== clickedOption`）の全ケースで `handleFieldChange(field, clickedOption)` が呼ばれることを検証
  - 多様なフィールド名・オプション配列・現在値の組み合わせを自動生成して検証
  - 未修正コードでテストを実行する
  - **EXPECTED OUTCOME**: テスト PASSES（これが正しい — 保持すべきベースライン動作を確認する）
  - テストを作成・実行し、PASS を確認したらタスク完了とする
  - _Requirements: 3.1, 3.2, 3.3, 3.4_

- [x] 3. EditableButtonSelect トグルクリアバグの修正

  - [x] 3.1 トグルロジックを実装する
    - ファイル: `frontend/frontend/src/components/WorkTaskDetailModal.tsx`
    - コンポーネント: `EditableButtonSelect`
    - 修正前: `onClick={(e) => { (e.currentTarget as HTMLButtonElement).blur(); handleFieldChange(field, opt); }}`
    - 修正後: `onClick={(e) => { (e.currentTarget as HTMLButtonElement).blur(); handleFieldChange(field, getValue(field) === opt ? null : opt); }}`
    - `EditableYesNo` の既存トグルパターン（`getValue(field) === 'Y' ? null : 'Y'`）と同じアプローチを適用する
    - スプレッドシート同期・バックエンドは変更不要（`writeBackToSpreadsheet` は `null` → `''` で自動処理済み）
    - _Bug_Condition: isBugCondition(X) where X.currentValue === X.clickedOption_
    - _Expected_Behavior: handleFieldChange(field, null) が呼ばれ、フィールド値が null になる_
    - _Preservation: currentValue !== clickedOption の場合は handleFieldChange(field, opt) が呼ばれる（変更なし）_
    - _Requirements: 2.1, 2.2, 2.3, 3.1, 3.2, 3.3, 3.4_

  - [x] 3.2 バグ条件探索テストが PASS することを確認する
    - **Property 1: Expected Behavior** - 同じオプション再クリックで値が null になる
    - **IMPORTANT**: タスク 1 と同じテストを再実行する — 新しいテストを書かない
    - タスク 1 のテストは期待動作をエンコードしている
    - このテストが PASS すれば、期待動作が満たされていることを確認できる
    - タスク 1 のバグ条件探索テストを実行する
    - **EXPECTED OUTCOME**: テスト PASSES（バグが修正されたことを確認する）
    - _Requirements: 2.1, 2.2, 2.3_

  - [x] 3.3 保持テストが引き続き PASS することを確認する
    - **Property 2: Preservation** - バグ条件外の動作が変わらない
    - **IMPORTANT**: タスク 2 と同じテストを再実行する — 新しいテストを書かない
    - タスク 2 の保持プロパティテストを実行する
    - **EXPECTED OUTCOME**: テスト PASSES（リグレッションがないことを確認する）
    - 修正後も全テストが PASS することを確認する（リグレッションなし）

  - [x] 3.4 スプレッドシート即時同期の動作確認
    - `WorkTaskDetailModal` を開き、`site_registration_confirmed` に「他」を設定して保存する
    - 再度「他」をクリックして保存する
    - DB の値が `null` になっていることを確認する
    - スプレッドシートの対応セルが空欄になっていることを確認する（`writeBackToSpreadsheet` の `null → ''` 変換）
    - 「確認中」→「完了」への切り替えが正常に動作することを確認する
    - _Requirements: 2.1, 2.2, 2.3_

- [x] 4. フロントエンドを Vercel にデプロイする
  - `frontend/frontend` ディレクトリでビルドエラーがないことを確認する
  - `sateituikyaku-admin-frontend` Vercel プロジェクトにデプロイする
  - デプロイ完了後、本番環境（`https://sateituikyaku-admin-frontend.vercel.app`）で動作確認する
  - 本番環境で `site_registration_confirmed` のトグルクリア動作を確認する
  - 本番環境でスプレッドシート即時同期が正常に動作することを確認する

- [x] 5. チェックポイント — 全テストが PASS することを確認する
  - 全テストが PASS していることを確認する。疑問点があればユーザーに確認する。
