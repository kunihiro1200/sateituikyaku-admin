# 実装タスク

- [x] 1. バグ条件探索テスト（修正前に実行）
  - **Property 1: Bug Condition** - inquiry_id表示バグの確認
  - **重要**: このテストは修正前に実行し、バグの存在を確認する
  - **目標**: バグが発生する具体的な条件を特定する
  - **スコープ付きPBTアプローチ**: AA13175（`inquiry_id = 'CO2511-94507'`、サイト「す」または「L」）を具体的なテストケースとして使用
  - テスト内容:
    - データベースに`inquiry_id = 'CO2511-94507'`が保存されているか確認（Supabaseダッシュボードで`SELECT inquiry_id FROM sellers WHERE seller_number = 'AA13175'`を実行）
    - `SellerService.getSeller()`が`inquiryId`を含めて返すか確認（`backend/test-aa13175-seller-service.ts`を作成して実行）
    - APIレスポンス（`GET /api/sellers/:id`）に`inquiryId`が含まれるか確認（`curl http://localhost:3000/api/sellers/:id`を実行）
    - フロントエンドで`seller.inquiryId`が受け取られているか確認（ブラウザのDevToolsで確認）
  - **未修正コードで実行**
  - **期待される結果**: テストが失敗し、どの段階で`inquiry_id`が失われるかが特定される
  - 反例を記録: 例「APIレスポンスに`inquiryId`が含まれていない」または「フロントエンドで`inquiryId`が`undefined`」
  - タスク完了条件: テストを実行し、失敗を記録し、根本原因を特定したら完了
  - _Requirements: 1.1, 1.2, 1.3_

- [x] 2. 保存確認プロパティテスト（修正前に実行）
  - **Property 2: Preservation** - inquiry_id空欄時とサイト条件外の表示
  - **重要**: 観察優先の方法論に従う
  - 観察: `inquiry_id`が空（NULL または空文字列）の売主で「－」と表示されることを確認（未修正コードで実行）
  - 観察: サイトが「H」「ウ」などの売主で「ID」フィールドが表示されないことを確認（未修正コードで実行）
  - 観察: 名前、電話番号、反響詳細日時などの他のフィールドが正しく表示されることを確認（未修正コードで実行）
  - プロパティベーステストを作成: 全ての非バグ条件入力（`inquiry_id`が空、またはサイトが「す」「L」以外）で、観察された動作が保持されることを確認
  - プロパティベーステストにより多くのテストケースを自動生成し、より強力な保証を提供
  - **未修正コードでテストを実行**
  - **期待される結果**: テストが成功（ベースライン動作を確認）
  - タスク完了条件: テストを作成し、未修正コードで実行して成功したら完了
  - _Requirements: 3.1, 3.2, 3.3_

- [x] 3. inquiry_id表示バグの修正

  - [x] 3.1 根本原因の特定と修正の実装
    - タスク1の探索テストで特定された根本原因に基づいて修正を実装
    - **仮説1**: `backend/src/services/SellerService.supabase.ts`の`getSeller()`メソッドがSupabaseから`inquiry_id`を取得していない
      - SELECT句を確認し、明示的なカラム指定を使用している場合は`inquiry_id`を追加
    - **仮説2**: `backend/src/services/SellerService.supabase.ts`の`decryptSeller()`メソッドに`inquiry_id`のマッピングが含まれていない
      - `inquiryId: seller.inquiry_id`を追加
    - **仮説3**: `frontend/frontend/src/types/index.ts`の`Seller`型に`inquiryId`が定義されていない
      - `inquiryId?: string;`を追加
    - **仮説4**: `backend/src/routes/sellers.ts`の`GET /:id`エンドポイントが`inquiry_id`を除外している
      - レスポンスを確認し、必要に応じて修正
    - デバッグログを追加:
      - `backend/src/routes/sellers.ts`: `console.log('inquiry_id:', seller.inquiryId)`
      - `frontend/frontend/src/pages/CallModePage.tsx`: `console.log('seller.inquiryId:', seller.inquiryId)`
    - _Bug_Condition: isBugCondition(input) where (input.site IN ['す', 'L']) AND (dbInquiryId IS NOT NULL AND dbInquiryId != '') AND (seller.inquiryId IS NULL OR seller.inquiryId == '')_
    - _Expected_Behavior: inquiry_idがデータベースに存在し、サイトが「す」または「L」の場合、通話モードページの「ID」フィールドにinquiry_idの値が表示される_
    - _Preservation: inquiry_idが空の売主、サイトが「す」「L」以外の売主の表示は変更されない_
    - _Requirements: 2.1, 2.2, 2.3, 3.1, 3.2, 3.3_

  - [x] 3.2 バグ条件探索テストが成功することを確認
    - **Property 1: Expected Behavior** - inquiry_id表示の確認
    - **重要**: タスク1と同じテストを再実行する（新しいテストを作成しない）
    - タスク1のテストは期待される動作をエンコードしている
    - このテストが成功すれば、期待される動作が満たされていることを確認できる
    - タスク1のバグ条件探索テストを再実行:
      - データベースに`inquiry_id = 'CO2511-94507'`が保存されているか確認
      - `SellerService.getSeller()`が`inquiryId`を含めて返すか確認
      - APIレスポンス（`GET /api/sellers/:id`）に`inquiryId`が含まれるか確認
      - フロントエンドで`seller.inquiryId`が受け取られているか確認
    - **期待される結果**: テストが成功（バグが修正されたことを確認）
    - _Requirements: Expected Behavior Properties from design (2.1, 2.2, 2.3)_

  - [x] 3.3 保存確認テストが引き続き成功することを確認
    - **Property 2: Preservation** - inquiry_id空欄時とサイト条件外の表示
    - **重要**: タスク2と同じテストを再実行する（新しいテストを作成しない）
    - タスク2の保存確認プロパティテストを再実行
    - **期待される結果**: テストが成功（リグレッションがないことを確認）
    - 全てのテストが修正後も成功することを確認（リグレッションなし）

- [x] 4. チェックポイント - 全てのテストが成功することを確認
  - 全てのテストが成功することを確認し、質問があればユーザーに確認する
