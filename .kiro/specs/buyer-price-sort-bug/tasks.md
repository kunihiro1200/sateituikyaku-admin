# Implementation Plan

- [x] 1. バグ条件の探索テストを作成する
  - **Property 1: Bug Condition** - 文字列型 inquiry_price の辞書順ソートバグ
  - **重要**: このテストは修正前のコードで必ず FAIL する — 失敗がバグの存在を証明する
  - **修正やコードを変えようとしないこと（失敗が正しい状態）**
  - **目的**: バグが存在することを示すカウンターエグザンプルを見つける
  - **スコープ**: `inquiry_price` が文字列型の場合に限定（isBugCondition: `typeof X.inquiry_price === 'string' && X.inquiry_price !== null && sortConfig.key === 'inquiry_price'`）
  - テスト内容: `inquiry_price: "49800000"` と `inquiry_price: "5800000"` の2件を昇順ソートした場合、`"5800000"` が先頭に来ることをアサートする（未修正コードでは `"49800000"` が先頭になるため FAIL）
  - 降順ソートも同様にテスト: `"49800000"` が先頭に来ることをアサート（未修正コードでは `"5800000"` が先頭になるため FAIL）
  - 複数件テスト: `["49800000", "5800000", "10000000", "3000000"]` を昇順ソートし、数値順 `[3000000, 5800000, 10000000, 49800000]` になることをアサート
  - テストを未修正コードで実行する
  - **期待される結果**: テストが FAIL する（これが正しい — バグの存在を証明）
  - 見つかったカウンターエグザンプルを記録する（例: 「昇順で "49800000" が "5800000" より前に来た」）
  - テストを作成・実行・失敗を記録したらタスク完了とする
  - _Requirements: 1.1, 1.2, 1.3_

- [x] 2. 保全プロパティテストを作成する（修正前に実施）
  - **Property 2: Preservation** - 価格以外のカラムのソート動作保全
  - **重要**: 観察優先メソドロジーに従う
  - 未修正コードで非バグ条件の入力（`inquiry_price` 以外のカラムのソート）の動作を観察する
  - 観察: `buyer_number` でのソートは文字列比較で正しく動作する
  - 観察: `name` でのソートは `localeCompare` で正しく動作する
  - 観察: `viewing_date` でのソートは日付比較で正しく動作する
  - 観察: `inquiry_price: null` の買主は末尾に配置される
  - プロパティベーステスト: 任意の非バグ条件入力（`inquiry_price` 以外のカラムでのソート）に対して、修正前後で同一の結果が返ることをアサートする
  - プロパティベーステスト: `inquiry_price: null` を含む任意の買主リストで、null が常に末尾に配置されることをアサートする
  - テストを未修正コードで実行する
  - **期待される結果**: テストが PASS する（これが正しい — 保全すべきベースライン動作を確認）
  - テストを作成・実行・PASS を確認したらタスク完了とする
  - _Requirements: 3.1, 3.2, 3.3, 3.4_

- [x] 3. inquiry_price 辞書順ソートバグの修正

  - [x] 3.1 修正を実装する
    - `frontend/frontend/src/components/NearbyBuyersList.tsx` の `sortedBuyers` useMemo を修正する
    - `typeof aValue === 'number' && typeof bValue === 'number'` の条件分岐の前に、`sortConfig.key === 'inquiry_price'` の場合は `Number()` で変換してから比較する分岐を追加する
    - 変更前:
      ```typescript
      if (typeof aValue === 'number' && typeof bValue === 'number') {
        return sortConfig.direction === 'asc' ? aValue - bValue : bValue - aValue;
      }
      ```
    - 変更後:
      ```typescript
      if (sortConfig.key === 'inquiry_price') {
        const aNum = Number(aValue);
        const bNum = Number(bValue);
        return sortConfig.direction === 'asc' ? aNum - bNum : bNum - aNum;
      }
      if (typeof aValue === 'number' && typeof bValue === 'number') {
        return sortConfig.direction === 'asc' ? aValue - bValue : bValue - aValue;
      }
      ```
    - 他のソートロジック（日付比較、文字列比較、null処理）は一切変更しない
    - _Bug_Condition: `typeof X.inquiry_price === 'string' && X.inquiry_price !== null && sortConfig.key === 'inquiry_price'`_
    - _Expected_Behavior: `Number(A.inquiry_price) <= Number(B.inquiry_price)` の順序で昇順ソート_
    - _Preservation: 価格以外のカラムのソート・null末尾配置・初期順序は変更しない_
    - _Requirements: 2.1, 2.2, 2.3, 3.1, 3.2, 3.3, 3.4_

  - [x] 3.2 バグ条件の探索テストが PASS することを確認する
    - **Property 1: Expected Behavior** - 文字列型 inquiry_price の数値ソート
    - **重要**: タスク1で作成した同じテストを再実行する — 新しいテストを書かないこと
    - タスク1のテストは期待される動作をエンコードしている
    - このテストが PASS すれば、期待される動作が満たされたことを確認できる
    - タスク1のバグ条件探索テストを実行する
    - **期待される結果**: テストが PASS する（バグが修正されたことを確認）
    - _Requirements: 2.1, 2.2, 2.3_

  - [x] 3.3 保全テストが引き続き PASS することを確認する
    - **Property 2: Preservation** - 価格以外のカラムのソート動作保全
    - **重要**: タスク2で作成した同じテストを再実行する — 新しいテストを書かないこと
    - タスク2の保全プロパティテストを実行する
    - **期待される結果**: テストが PASS する（リグレッションがないことを確認）
    - 修正後も全テストが PASS することを確認する

- [x] 4. チェックポイント — 全テストが PASS することを確認する
  - 全テスト（バグ条件テスト・保全テスト）が PASS していることを確認する
  - 疑問点があればユーザーに確認する
