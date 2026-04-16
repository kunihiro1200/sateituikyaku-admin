# 実装計画

- [x] 1. バグ条件の探索テストを作成する
  - **Property 1: Bug Condition** - ソフトデリート済み買主番号の欠損未検出バグ
  - **重要**: このテストは修正前のコードで必ず**失敗**すること — 失敗がバグの存在を証明する
  - **修正前にテストを実行してもコードを修正しないこと**
  - **目的**: バグが存在することを示す反例を発見する
  - **スコープ付きPBTアプローチ**: 決定論的なバグのため、具体的な失敗ケースにスコープを絞る
    - スプレッドシートに買主番号が存在し、DBに `deleted_at` が非nullのレコードのみが存在するケース
  - テスト内容（design.md の Bug Condition より）:
    - `detectMissingBuyers()` をモックして、スプレッドシートに7373が存在し、DBに `deleted_at` が非nullのレコードが存在する場合に7373が欠損リストに含まれないことを確認
    - `getAllDbBuyerNumbers()` がソフトデリート済みレコードも返すため、7373が「DBに存在する」と誤判定されることを確認
    - 複数のソフトデリート済み買主番号が混在するケースも確認
  - 修正前のコードでテストを実行する
  - **期待される結果**: テストが**失敗**する（バグの存在を証明）
  - 発見した反例を記録する（例: 「7373がソフトデリート状態なのに欠損リストに含まれない」）
  - テストを作成・実行し、失敗を記録したらタスク完了とする
  - _Requirements: 1.1, 1.2_

- [x] 2. 保全プロパティテストを作成する（修正前に実施）
  - **Property 2: Preservation** - アクティブ買主番号の非検出動作の保全
  - **重要**: 観察優先メソドロジーに従うこと
  - 修正前のコードで、バグ条件が成立しない入力（アクティブな買主番号）の動作を観察する:
    - 観察: スプレッドシートに存在し、DBに `deleted_at = null` のレコードが存在する買主番号は欠損リストに含まれない
    - 観察: `detectDeletedBuyers()` は `getAllActiveBuyerNumbers()` を使用しており、この修正の影響を受けない
    - 観察: `syncBuyers()` の安全ガードは変わらない
  - プロパティベーステストを作成（design.md の Preservation Requirements より）:
    - ランダムなアクティブ買主番号セットに対して、`detectMissingBuyers()` が欠損リストに含めないことを検証
    - `detectDeletedBuyers()` の動作が変わらないことを検証
    - `syncBuyers()` の安全ガードが保持されることを検証
  - 修正前のコードでテストを実行する
  - **期待される結果**: テストが**成功**する（保全すべきベースライン動作を確認）
  - テストを作成・実行し、成功を確認したらタスク完了とする
  - _Requirements: 3.1, 3.2, 3.3, 3.4_

- [x] 3. ソフトデリート済み買主番号の欠損未検出バグを修正する

  - [x] 3.1 修正を実装する
    - `backend/src/services/EnhancedAutoSyncService.ts` の `detectMissingBuyers()` メソッド（Line 2830付近）を修正する
    - `getAllDbBuyerNumbers()` を `getAllActiveBuyerNumbers()` に置き換える（1行変更）:
      ```typescript
      // 修正前
      const dbBuyerNumbers = await this.getAllDbBuyerNumbers();

      // 修正後
      const dbBuyerNumbers = await this.getAllActiveBuyerNumbers();
      ```
    - ログメッセージを任意で更新する:
      ```typescript
      // 修正前
      console.log(`📊 Database buyers: ${dbBuyerNumbers.size}`);

      // 修正後
      console.log(`📊 Active database buyers: ${dbBuyerNumbers.size}`);
      ```
    - `getAllDbBuyerNumbers()` メソッド自体は削除しない（他の用途で使用される可能性があるため）
    - _Bug_Condition: isBugCondition(input) — input.buyerNumber がスプレッドシートに存在し、かつ input.dbRecord.deleted_at != null_
    - _Expected_Behavior: detectMissingBuyers() がソフトデリート済み買主番号を欠損リストに含める_
    - _Preservation: アクティブな買主番号（deleted_at = null）は引き続き欠損リストに含まれない_
    - _Requirements: 2.1, 2.2, 3.1, 3.2, 3.3, 3.4_

  - [x] 3.2 バグ条件の探索テストが成功することを確認する
    - **Property 1: Expected Behavior** - ソフトデリート済み買主番号の欠損検出
    - **重要**: タスク1で作成した**同じテスト**を再実行すること — 新しいテストを書かないこと
    - タスク1のテストは期待される動作をエンコードしている
    - このテストが成功すれば、期待される動作が満たされたことを確認できる
    - タスク1のバグ条件探索テストを実行する
    - **期待される結果**: テストが**成功**する（バグが修正されたことを証明）
    - _Requirements: 2.1, 2.2_

  - [x] 3.3 保全テストが引き続き成功することを確認する
    - **Property 2: Preservation** - アクティブ買主番号の非検出動作の保全
    - **重要**: タスク2で作成した**同じテスト**を再実行すること — 新しいテストを書かないこと
    - タスク2の保全プロパティテストを実行する
    - **期待される結果**: テストが**成功**する（リグレッションがないことを確認）
    - 修正後も全ての保全テストが成功することを確認する

- [x] 4. チェックポイント — 全テストの成功を確認する
  - 全テストが成功していることを確認する
  - 疑問点があればユーザーに確認する
