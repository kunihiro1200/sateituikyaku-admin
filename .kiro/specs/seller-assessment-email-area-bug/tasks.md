# 実装計画

- [x] 1. バグ条件探索テストを作成する
  - **Property 1: Bug Condition** - 「当社調べ」面積値がメール本文に反映されないバグ
  - **重要**: このテストは未修正コードで必ず FAIL すること — 失敗がバグの存在を証明する
  - **修正やコードを直そうとしないこと（テストが失敗しても）**
  - **注意**: このテストは期待される動作をエンコードしている — 実装後にパスすることで修正を検証する
  - **目的**: バグが存在することを示すカウンター例を発見する
  - **スコープ付きPBTアプローチ**: 決定論的バグのため、具体的な失敗ケースにスコープを絞る
  - テスト対象: `generateValuationEmailTemplate` に `landAreaVerified`/`buildingAreaVerified` を含む `valuationData` を渡す
  - バグ条件（設計ドキュメントの `isBugCondition` より）: `seller.landAreaVerified IS NOT NULL AND > 0` または `seller.buildingAreaVerified IS NOT NULL AND > 0`
  - テストケース1: `landAreaVerified=86, buildingAreaVerified=63` → 未修正コードでは `※土地50㎡、建物50㎡で算出しております。` が生成される（「当社調べ」が反映されない）
  - テストケース2: `landAreaVerified=86, buildingAreaVerified=null` → 未修正コードでは土地に「当社調べ」が付かない
  - テストケース3: `landAreaVerified=null, buildingAreaVerified=63` → 未修正コードでは建物に「当社調べ」が付かない
  - テストケース4: `emails.ts` の `valuationData` に `landAreaVerified` が含まれていないことを確認
  - 未修正コードでテストを実行する
  - **期待される結果**: テスト FAIL（これが正しい — バグの存在を証明する）
  - カウンター例を記録して根本原因を理解する（例: `landAreaVerified=86` を設定しても `土地50㎡` のまま）
  - テストを作成・実行し、失敗を記録したらタスク完了とする
  - _Requirements: 1.1, 1.2, 1.3_

- [x] 2. 保全プロパティテストを作成する（修正実装前に）
  - **Property 2: Preservation** - 「当社調べ」未設定時の既存動作維持
  - **重要**: 観察優先メソドロジーに従うこと
  - 未修正コードで非バグ条件の入力（`landAreaVerified=null, buildingAreaVerified=null`）の動作を観察する
  - 観察: `landArea=50, buildingArea=50, landAreaVerified=null, buildingAreaVerified=null` → `※土地50㎡、建物50㎡で算出しております。` が生成される
  - 観察した動作パターンを保全するプロパティベーステストを作成する（設計ドキュメントの保全要件より）
  - プロパティベーステスト: `landAreaVerified=null, buildingAreaVerified=null` の全ケースで、結果が `landArea`/`buildingArea` のみを使用した面積表記（注記なし）であることを検証
  - 追加テスト: 査定額（`valuationAmount1/2/3`）の表示が変わらないことを確認
  - 追加テスト: 面積行以外の本文内容が変わらないことを確認
  - 未修正コードでテストを実行する
  - **期待される結果**: テスト PASS（ベースライン動作を確認する）
  - テストを作成・実行し、未修正コードでパスすることを確認したらタスク完了とする
  - _Requirements: 3.1, 3.2, 3.3_

- [x] 3. 「当社調べ」面積値がメール本文に反映されないバグの修正

  - [x] 3.1 `emails.ts` の `valuationData` 構築に `landAreaVerified`/`buildingAreaVerified` を追加する
    - `backend/src/routes/emails.ts` を編集する
    - `valuationData` オブジェクトに以下を追加:
      - `landArea: seller.landArea`
      - `buildingArea: seller.buildingArea`
      - `landAreaVerified: seller.landAreaVerified`
      - `buildingAreaVerified: seller.buildingAreaVerified`
    - 日本語ファイルのためPythonスクリプトで変更を適用すること（UTF-8保護ルール）
    - _Bug_Condition: `isBugCondition(seller)` — `seller.landAreaVerified IS NOT NULL AND > 0` または `seller.buildingAreaVerified IS NOT NULL AND > 0`_
    - _Expected_Behavior: `valuationData` に `landAreaVerified`/`buildingAreaVerified` が含まれ、`generateValuationEmailTemplate` に正しく渡される_
    - _Preservation: `landAreaVerified`/`buildingAreaVerified` が null の場合、既存の `landArea`/`buildingArea` のみを使用する動作を維持する_
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5_

  - [x] 3.2 `generateValuationEmailTemplate` に「当社調べ」優先ロジックを追加する
    - `backend/src/services/EmailService.supabase.ts` を編集する
    - 面積値の取得ロジックを以下のように変更:
      - `landAreaValue = valuationData.landAreaVerified || valuationData.landArea`
      - `landAreaSuffix = valuationData.landAreaVerified ? '（当社調べ）' : ''`
      - `landAreaDisplay = landAreaValue ? \`${landAreaValue}㎡${landAreaSuffix}\` : '未設定'`
      - `buildingAreaValue = valuationData.buildingAreaVerified || valuationData.buildingArea`
      - `buildingAreaSuffix = valuationData.buildingAreaVerified ? '（当社調べ）' : ''`
      - `buildingAreaDisplay = buildingAreaValue ? \`${buildingAreaValue}㎡${buildingAreaSuffix}\` : '未設定'`
    - 面積表記行を `※土地${landAreaDisplay}、建物${buildingAreaDisplay}で算出しております。` に変更
    - 日本語ファイルのためPythonスクリプトで変更を適用すること（UTF-8保護ルール）
    - _Bug_Condition: `isBugCondition(seller)` — `landAreaVerified` または `buildingAreaVerified` に値が設定されている_
    - _Expected_Behavior: 「当社調べ」の値が存在する場合はそちらを優先し、「（当社調べ）」注記を付与してメール本文に表示する_
    - _Preservation: `landAreaVerified`/`buildingAreaVerified` が null の場合、元の面積値のみを表示し注記を付与しない_
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 3.1_

  - [x] 3.3 バグ条件探索テストが現在パスすることを確認する
    - **Property 1: Expected Behavior** - 「当社調べ」面積値のメール本文への反映
    - **重要**: タスク1と同じテストを再実行すること — 新しいテストを書かないこと
    - タスク1のテストは期待される動作をエンコードしている
    - このテストがパスすれば、期待される動作が満たされたことを確認できる
    - タスク1のバグ条件探索テストを実行する
    - **期待される結果**: テスト PASS（バグが修正されたことを確認する）
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5_

  - [x] 3.4 保全テストが引き続きパスすることを確認する
    - **Property 2: Preservation** - 「当社調べ」未設定時の既存動作維持
    - **重要**: タスク2と同じテストを再実行すること — 新しいテストを書かないこと
    - タスク2の保全プロパティテストを実行する
    - **期待される結果**: テスト PASS（リグレッションがないことを確認する）
    - 修正後も全テストがパスすることを確認する（リグレッションなし）

- [x] 4. チェックポイント — 全テストがパスすることを確認する
  - 全テスト（バグ条件探索テスト・保全テスト）がパスすることを確認する
  - 疑問点があればユーザーに確認する
