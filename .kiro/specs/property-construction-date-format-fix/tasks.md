# 実装計画

- [x] 1. バグ条件の探索テストを作成する
  - **Property 1: Bug Condition** - 新築年月の未フォーマット表示バグ
  - **重要**: このテストは修正前のコードで必ず FAIL すること（バグの存在を確認するため）
  - **修正前にテストが失敗しても、コードを修正しないこと**
  - **目的**: バグが存在することを示す反例（counterexample）を見つける
  - **スコープ限定PBTアプローチ**: 決定論的なバグのため、具体的な失敗ケースにスコープを絞る
  - テスト対象: `PropertyDetailsSection.tsx` を `isEditMode=false` でレンダリングし、`construction_year_month` に各種形式の値を渡す
  - バグ条件（design.md の isBugCondition より）: `construction_year_month` が `formatConstructionDate()` を通さずそのまま描画される
  - テストケース1: `construction_year_month = "Sat Apr 01 1978 00:00:00 GMT+0900 (Japan Standard Time)"` → 生の文字列がそのまま表示されることを確認（修正前は FAIL）
  - テストケース2: `construction_year_month = "2020-03"` → `"2020年03月"` に変換されないことを確認（修正前は FAIL）
  - 修正前のコードでテストを実行し、FAIL することを確認する（これがバグの存在証明）
  - 見つかった反例を記録する（例: `"Sat Apr 01 1978..."` がフォーマットされずそのまま表示される）
  - テストを作成・実行し、失敗を記録したらタスク完了とする
  - _Requirements: 1.1, 1.2_

- [x] 2. 保全プロパティテストを作成する（修正前に実施）
  - **Property 2: Preservation** - 空値・他フィールドの表示維持
  - **重要**: 観察優先メソドロジーに従うこと
  - 修正前のコードで非バグ条件の入力（`isBugCondition` が false を返すケース）の動作を観察する
  - 観察1: `construction_year_month = null` → `-` が表示される（修正前コードで確認）
  - 観察2: `construction_year_month = undefined` → `-` が表示される（修正前コードで確認）
  - 観察3: `construction_year_month = ""` → `-` が表示される（修正前コードで確認）
  - 観察4: `land_area`, `building_area`, `structure` などの他フィールドの表示が変わらない（修正前コードで確認）
  - 観察5: `isEditMode=true` の場合、テキストフィールドに生の値が表示される（修正前コードで確認）
  - プロパティベーステスト: null/undefined/空文字の場合は常に `-` が表示されることを検証
  - プロパティベーステスト: ランダムな物件データで `construction_year_month` 以外のフィールドの表示が変わらないことを検証
  - 修正前のコードでテストを実行し、PASS することを確認する（ベースライン動作の確認）
  - テストを作成・実行し、PASS を確認したらタスク完了とする
  - _Requirements: 3.1, 3.2_

- [x] 3. 新築年月フォーマットバグの修正

  - [x] 3.1 `formatConstructionDate()` のDate.toString()形式対応を追加する（オプション強化）
    - 対象ファイル: `frontend/frontend/src/utils/constructionDateFormatter.ts`
    - Date.toString()形式（例: `"Sat Apr 01 1978 00:00:00 GMT+0900 (Japan Standard Time)"`）のパース処理を追加
    - 正規表現 `/^[A-Za-z]{3}\s[A-Za-z]{3}\s\d{2}\s(\d{4})/` でマッチを確認
    - `new Date(trimmed)` でパースし、`getFullYear()` と `getMonth()+1` から `YYYY年MM月` 形式を生成
    - _Bug_Condition: isBugCondition(input) where input.construction_year_month MATCHES /^[A-Za-z]{3}\s[A-Za-z]{3}\s\d{2}\s\d{4}/_
    - _Expected_Behavior: formatConstructionDate() が `YYYY年MM月` 形式の文字列を返す_
    - _Requirements: 2.1, 2.2_

  - [x] 3.2 `PropertyDetailsSection.tsx` に `formatConstructionDate()` の呼び出しを追加する
    - 対象ファイル: `frontend/frontend/src/components/PropertyDetailsSection.tsx`
    - `import { formatConstructionDate } from '../utils/constructionDateFormatter';` を追加
    - 表示モード（`isEditMode === false`）の `construction_year_month` フィールドを修正
    - `{formatValue(data.construction_year_month)}` を `{formatConstructionDate(data.construction_year_month) ?? formatValue(data.construction_year_month)}` に変更
    - 編集モード（`isEditMode === true`）は変更しない
    - _Bug_Condition: isBugCondition(input) where formatConstructionDate() が呼ばれていない_
    - _Expected_Behavior: formatConstructionDate(data.construction_year_month) が `YYYY年MM月` 形式を返す_
    - _Preservation: null/undefined/空文字の場合は formatConstructionDate() が null を返し、formatValue() にフォールバックして `-` を表示_
    - _Requirements: 2.1, 2.2, 3.1, 3.2_

  - [x] 3.3 バグ条件の探索テストが PASS することを確認する
    - **Property 1: Expected Behavior** - 新築年月の日本語フォーマット表示
    - **重要**: タスク1で作成した同じテストを再実行すること（新しいテストを書かない）
    - タスク1のテストはバグ修正後の期待動作をエンコードしている
    - このテストが PASS すれば、バグが修正されたことが確認できる
    - タスク1のバグ条件探索テストを実行する
    - **期待結果**: テストが PASS する（バグが修正されたことを確認）
    - _Requirements: 2.1, 2.2_

  - [x] 3.4 保全テストが引き続き PASS することを確認する
    - **Property 2: Preservation** - 空値・他フィールドの表示維持
    - **重要**: タスク2で作成した同じテストを再実行すること（新しいテストを書かない）
    - タスク2の保全プロパティテストを実行する
    - **期待結果**: テストが PASS する（リグレッションがないことを確認）
    - null/undefined/空文字の場合は引き続き `-` が表示されることを確認
    - 他フィールドの表示が変わっていないことを確認

- [x] 4. チェックポイント - 全テストの通過確認
  - 全テストが PASS していることを確認する
  - タスク1のバグ条件探索テスト（修正後は PASS するはず）
  - タスク2の保全プロパティテスト（引き続き PASS するはず）
  - 疑問点があればユーザーに確認する
