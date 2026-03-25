# Implementation Plan

- [x] 1. バグ条件の探索テストを書く
  - **Property 1: Bug Condition** - 全角数字入力時の変換なしナビゲーション
  - **CRITICAL**: このテストは修正前のコードで必ず FAIL する — 失敗がバグの存在を証明する
  - **DO NOT attempt to fix the test or the code when it fails**
  - **NOTE**: このテストは期待動作をエンコードしている — 修正後に PASS することで修正を検証する
  - **GOAL**: バグが存在することを示す反例を見つける
  - **Scoped PBT Approach**: 決定論的バグのため、具体的な失敗ケースにスコープを絞る
  - `BuyerDetailPage.tsx` の `onKeyDown` ハンドラーのロジックを単体でテスト
  - isBugCondition: `e.key === 'Enter' AND searchValue.trim() !== '' AND searchValue に全角数字（０-９）が含まれる`
  - テストケース: 「４３７０」を入力してEnterキーをシミュレート → `navigate('/buyers/４３７０')` が呼ばれる（変換されない）
  - テストケース: 「１２３４５」を入力してEnterキーをシミュレート → `navigate('/buyers/１２３４５')` が呼ばれる（変換されない）
  - 修正前のコードでテストを実行する
  - **EXPECTED OUTCOME**: テスト FAILS（これが正しい — バグの存在を証明する）
  - 反例を記録して根本原因を理解する（例: `navigate('/buyers/４３７０')` が呼ばれ、`/buyers/4370` ではない）
  - テストを書き、実行し、失敗を記録したらタスク完了とする
  - _Requirements: 1.1, 1.2_

- [x] 2. 保全プロパティテストを書く（修正前に実施）
  - **Property 2: Preservation** - 半角数字入力時の動作維持
  - **IMPORTANT**: 観察優先メソドロジーに従う
  - 修正前のコードで非バグ条件の入力（全角数字を含まない）の動作を観察する
  - 観察: `handleKeyDown({ key: 'Enter', searchValue: '4370' })` → `navigate('/buyers/4370')` が呼ばれる
  - 観察: `handleKeyDown({ key: 'Enter', searchValue: '' })` → `navigate` が呼ばれない
  - 観察: `handleKeyDown({ key: 'Tab', searchValue: '4370' })` → `navigate` が呼ばれない
  - プロパティベーステスト: 全角数字を含まない文字列（半角数字のみ）に対して、`toHalfWidth` 適用後も値が変わらないことを確認
  - プロパティベーステスト: 空文字に対してEnterキーを押しても `navigate` が呼ばれないことを確認
  - 修正前のコードでテストを実行する
  - **EXPECTED OUTCOME**: テスト PASSES（これが正しい — 維持すべきベースライン動作を確認する）
  - テストを書き、実行し、修正前コードで PASS を確認したらタスク完了とする
  - _Requirements: 3.1, 3.2, 3.3_

- [x] 3. 全角数字入力バグの修正

  - [x] 3.1 修正を実装する
    - `frontend/frontend/src/pages/BuyerDetailPage.tsx` のみ変更
    - `BUYER_FIELD_SECTIONS` 定数定義の前に `toHalfWidth` 関数を追加する:
      ```typescript
      // 全角数字を半角数字に変換する
      const toHalfWidth = (str: string): string => {
        return str.replace(/[０-９]/g, (ch) =>
          String.fromCharCode(ch.charCodeAt(0) - 0xFEE0)
        );
      };
      ```
    - 検索バー `TextField` の `onKeyDown` ハンドラーを修正する:
      ```typescript
      onKeyDown={(e) => {
        if (e.key === 'Enter' && buyerNumberSearch.trim()) {
          navigate(`/buyers/${toHalfWidth(buyerNumberSearch.trim())}`);
        }
      }}
      ```
    - _Bug_Condition: `e.key === 'Enter' AND searchValue.trim() !== '' AND searchValue に全角数字（０-９）が含まれる`_
    - _Expected_Behavior: `navigate('/buyers/' + toHalfWidth(searchValue.trim()))` が呼ばれる_
    - _Preservation: 半角数字入力・空入力・Enterキー以外のキーの動作は変更しない_
    - _Requirements: 2.1, 2.2, 3.1, 3.2, 3.3_

  - [x] 3.2 バグ条件の探索テストが PASS することを確認する
    - **Property 1: Expected Behavior** - 全角数字入力時の自動変換ナビゲーション
    - **IMPORTANT**: タスク1で書いた同じテストを再実行する — 新しいテストを書かない
    - タスク1のテストは期待動作をエンコードしている
    - このテストが PASS すれば、期待動作が満たされていることを確認できる
    - タスク1のバグ条件探索テストを実行する
    - **EXPECTED OUTCOME**: テスト PASSES（バグが修正されたことを確認する）
    - _Requirements: 2.1, 2.2_

  - [x] 3.3 保全テストが引き続き PASS することを確認する
    - **Property 2: Preservation** - 半角数字入力時の動作維持
    - **IMPORTANT**: タスク2で書いた同じテストを再実行する — 新しいテストを書かない
    - タスク2の保全プロパティテストを実行する
    - **EXPECTED OUTCOME**: テスト PASSES（リグレッションがないことを確認する）
    - 修正後も全てのテストが PASS することを確認する

- [x] 4. チェックポイント — 全テストが PASS することを確認する
  - 全テストが PASS していることを確認する。疑問があればユーザーに確認する。
