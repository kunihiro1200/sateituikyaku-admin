# Implementation Plan

- [x] 1. バグ条件の探索テストを作成する
  - **Property 1: Bug Condition** - 土地の場合に件名に「事前に内覧可能です！」が含まれるバグ
  - **重要**: このテストは修正前のコードで必ず FAIL すること — 失敗がバグの存在を証明する
  - **修正前にテストを実行してはいけない（コードを修正しない）**
  - **注意**: このテストは期待される動作をエンコードしている — 修正後に PASS することで修正を検証する
  - **目的**: バグが存在することを示すカウンターサンプルを発見する
  - **スコープ付き PBT アプローチ**: 決定論的なバグのため、具体的な失敗ケースにスコープを絞る
    - `effectivePropertyType = '土地'` で件名に「事前に内覧可能です！」が含まれないことをアサート（修正前は FAIL）
    - `effectivePropertyType = '土'` で同様にアサート
    - `effectivePropertyType = 'land'` で同様にアサート
  - バグ条件（design.md の Bug Condition より）: `isLand(effectivePropertyType) = true` の場合、件名に「事前に内覧可能です！」が含まれる
  - 期待される動作（design.md の Expected Behavior より）: 件名が `${address}に興味のあるかた！もうすぐ売り出します！` のみ（「事前に内覧可能です！」を含まない）
  - 修正前のコードでテストを実行する
  - **期待される結果**: テストが FAIL する（これが正しい — バグの存在を証明する）
  - カウンターサンプルを記録して根本原因を理解する（例: `effectivePropertyType='土地'` で件名に「事前に内覧可能です！」が含まれる）
  - テストを作成し、実行し、失敗を記録したらタスク完了とする
  - _Requirements: 1.1, 2.1_

- [x] 2. 保全プロパティテストを作成する（修正前に実施）
  - **Property 2: Preservation** - 土地以外の場合は件名が変わらない
  - **重要**: 観察優先メソドロジーに従う
  - 修正前のコードで非バグ条件の入力（`isLand()` が `false` を返す場合）の動作を観察する
    - 観察: `effectivePropertyType = '戸建'` → 件名に「事前に内覧可能です！」が含まれる
    - 観察: `effectivePropertyType = 'マンション'` → 件名に「事前に内覧可能です！」が含まれる
    - 観察: `effectivePropertyType = '収益物件'` → 件名に「事前に内覧可能です！」が含まれる
    - 観察: `effectivePropertyType = null` → 件名に「事前に内覧可能です！」が含まれる
    - 観察: `effectivePropertyType = undefined` → 件名に「事前に内覧可能です！」が含まれる
  - プロパティベーステストを作成: `isLand()` が `false` を返す全ての入力で、件名に「事前に内覧可能です！」が含まれることを検証（design.md の Preservation Requirements より）
  - プロパティベーステストが多様な非土地物件種別を自動生成してエッジケースを検出できることを確認
  - 修正前のコードでテストを実行する
  - **期待される結果**: テストが PASS する（ベースライン動作を確認）
  - テストを作成し、実行し、修正前コードで PASS することを確認したらタスク完了とする
  - _Requirements: 3.1_

- [x] 3. 土地の件名バグを修正する

  - [x] 3.1 件名生成ロジックに `isLand()` チェックを実装する
    - `frontend/frontend/src/components/NearbyBuyersList.tsx` の `handleSendEmail` 関数（約541行目）を修正する
    - 修正前: `const subject = \`${address}に興味のあるかた！もうすぐ売り出します！事前に内覧可能です！\`;`
    - 修正後:
      ```typescript
      const subject = isLand(effectivePropertyType)
        ? `${address}に興味のあるかた！もうすぐ売り出します！`
        : `${address}に興味のあるかた！もうすぐ売り出します！事前に内覧可能です！`;
      ```
    - `isLand` は既に26行目でインポート済みのため追加インポート不要
    - `effectivePropertyType` は同スコープ内で定義済みのため追加変更不要
    - _Bug_Condition: isLand(effectivePropertyType) = true の場合、件名に「事前に内覧可能です！」が含まれる_
    - _Expected_Behavior: isLand(effectivePropertyType) = true の場合、件名は `${address}に興味のあるかた！もうすぐ売り出します！` のみ_
    - _Preservation: isLand(effectivePropertyType) = false の場合（土地以外・null・undefined）、件名は `${address}に興味のあるかた！もうすぐ売り出します！事前に内覧可能です！` を維持_
    - _Requirements: 2.1, 3.1_

  - [x] 3.2 バグ条件の探索テストが PASS することを確認する
    - **Property 1: Expected Behavior** - 土地の場合は件名に「事前に内覧可能です！」を含まない
    - **重要**: タスク1で作成した同じテストを再実行する — 新しいテストを書かない
    - タスク1のテストは期待される動作をエンコードしている
    - このテストが PASS することで、期待される動作が満たされていることを確認する
    - タスク1のバグ条件探索テストを実行する
    - **期待される結果**: テストが PASS する（バグが修正されたことを確認）
    - _Requirements: 2.1_

  - [x] 3.3 保全テストが引き続き PASS することを確認する
    - **Property 2: Preservation** - 土地以外の場合は件名が変わらない
    - **重要**: タスク2で作成した同じテストを再実行する — 新しいテストを書かない
    - タスク2の保全プロパティテストを実行する
    - **期待される結果**: テストが PASS する（リグレッションがないことを確認）
    - 修正後も全テストが PASS することを確認する（リグレッションなし）

- [x] 4. チェックポイント — 全テストが PASS することを確認する
  - 全テストが PASS していることを確認する。疑問点があればユーザーに確認する。
