# 実装計画

- [x] 1. バグ条件探索テストを作成する
  - **Property 1: Bug Condition** - validateSession キャッシュ混入による誤イニシャル記録
  - **重要**: このテストは修正前のコードで必ず FAIL する — FAIL することがバグの存在を証明する
  - **修正を試みてはいけない**: テストが失敗しても、コードやテストを修正しないこと
  - **注意**: このテストは期待される動作をエンコードしており、修正後に PASS することで修正を検証する
  - **目標**: バグの存在を示すカウンターサンプルを発見する
  - **スコープ付き PBT アプローチ**: 決定論的バグのため、具体的な失敗ケースにスコープを絞る
  - テスト内容（design.md の Bug Condition より）:
    - `_sessionCache` にユーザーBのエントリが存在する状態でユーザーAのトークンで `GET /api/employees/initials-by-email` を呼び出す
    - エンドポイント内で `authService.validateSession(token)` が再度呼ばれ、キャッシュからユーザーBのemployeeが返されることを確認する
    - レスポンスのイニシャルがユーザーAのイニシャルと異なることをアサートする（修正前は FAIL するはず）
  - テストファイル: `backend/src/routes/__tests__/employees.initials-by-email.bug.test.ts`
  - テストを作成し、修正前のコードで実行して FAIL を確認する
  - **期待される結果**: テスト FAIL（バグが存在することを証明）
  - カウンターサンプルを記録して根本原因を理解する
  - テストを作成・実行し、FAIL を記録したらタスク完了とする
  - _Requirements: 1.6_

- [x] 2. 保存プロパティテストを作成する（修正前に実施）
  - **Property 2: Preservation** - 非バグ条件入力での動作保存
  - **重要**: 観察優先メソドロジーに従うこと
  - 修正前のコードで非バグ条件の入力（キャッシュ混入なし）の動作を観察する:
    - `_sessionCache` が空の状態で `initials-by-email` を呼び出す → 正しいイニシャルが返ることを観察
    - `send-template-email` でメール送信が正常に完了することを観察
    - アクティビティログの内容（件名・テンプレート名）が正しく記録されることを観察
  - 観察した動作を保存するプロパティベーステストを作成する（design.md の Preservation Requirements より）:
    - キャッシュが空の場合、`initials-by-email` は常に正しいユーザーのイニシャルを返す
    - メール送信自体（Gmail API呼び出し）は修正前後で同じ動作をする
    - アクティビティログの内容（件名・テンプレート名・送信先）は修正前後で同じ
    - `authenticate` ミドルウェアの動作は修正前後で変わらない
  - テストファイル: `backend/src/routes/__tests__/employees.initials-by-email.preservation.test.ts`
  - 修正前のコードでテストを実行して PASS を確認する
  - **期待される結果**: テスト PASS（保存すべきベースライン動作を確認）
  - テストを作成・実行し、PASS を確認したらタスク完了とする
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7_

- [~] 3. イニシャル誤記録バグの修正

  - [x] 3.1 `backend/src/routes/employees.ts` の二重認証を排除する
    - `GET /api/employees/initials-by-email` エンドポイント内の `authService.validateSession(token)` 呼び出しを削除する
    - `authenticate` ミドルウェアが設定した `req.employee` を直接使用するよう変更する
    - 変更前: `const employee = await authService.validateSession(token)` → `email = employee?.email`
    - 変更後: `email = req.employee?.email`
    - 不要な `authHeader` 解析ロジックも削除する（`authenticate` ミドルウェアが既に処理済み）
    - _Bug_Condition: `_sessionCache` にユーザーBのエントリが存在する状態でユーザーAのリクエストが来た場合、`validateSession` がキャッシュからユーザーBのemployeeを返す_
    - _Expected_Behavior: `req.employee.email` を使用してDBからイニシャルを取得し、常にリクエストしたユーザーの正しいイニシャルを返す_
    - _Preservation: メール送信・SMS送信・電話機能のコアロジックは変更しない。DBにinitialsが存在する場合はDBの値を優先し、存在しない場合はスプレッドシートにフォールバックする既存の優先順位ロジックを維持する_
    - _Requirements: 2.6, 3.6_

  - [x] 3.2 `backend/src/routes/emails.ts` の `senderInitials` 解決ロジックを強化する
    - `POST /:sellerId/send-template-email` エンドポイントで `senderInitials` を解決する際、`req.employee.email` を最優先で使用する
    - `req.employee.email` を使用して `employees` テーブルから `initials` を直接取得する処理を追加する
    - キャッシュを使用せず、常に最新のDBデータを参照するよう変更する
    - `req.employee.initials` が `undefined` の場合のフォールバックロジックも `req.employee.email` ベースに修正する
    - _Bug_Condition: `req.employee.initials` が `undefined` の場合、または `validateSession` キャッシュが古い場合に誤ったイニシャルが使用される_
    - _Expected_Behavior: `req.employee.email` でDBを検索し、常にリクエストしたユーザーの正しいイニシャルを返す_
    - _Preservation: メール送信自体（Gmail API経由の送信）は正常に完了させる。アクティビティログの内容（件名・テンプレート名・送信先）は正しく記録する_
    - _Requirements: 2.7, 3.1, 3.4_

  - [ ] 3.3 （オプション）`backend/src/services/AuthService.supabase.ts` のキャッシュキーを改善する
    - `_sessionCache` のキーをトークンの先頭32文字からトークン全体のハッシュに変更する
    - または、キャッシュTTLを5分から1分に短縮する
    - _Bug_Condition: トークンの先頭32文字が同じ異なるユーザーのトークンが存在する場合、キャッシュキーが衝突してキャッシュ混入が発生する_
    - _Preservation: 認証・セッション管理の動作は変更しない_
    - _Requirements: 1.6, 3.5_

  - [ ] 3.4 （オプション）`frontend/frontend/src/pages/CallModePage.tsx` の `myInitials` 取得を `authStore` と統合する
    - `handleSmsTemplateSelect` と `handleConfirmSend` で `myInitials` を使用する際、`authStore.employee?.initials` を最優先で使用する
    - `initials-by-email` エンドポイントへの呼び出しをフォールバックとして使用する
    - `authStore` の `employee` オブジェクトは `/auth/me` から取得されており、DBの最新データを含む
    - _Bug_Condition: `myInitials` が `loadAllData()` のバックグラウンド並列処理で設定される前にSMS送信・メール送信が実行された場合、空文字列になる_
    - _Preservation: SMS送信・メール送信の機能自体は変更しない_
    - _Requirements: 2.1, 2.2_

  - [x] 3.5 バグ条件探索テストが PASS することを確認する
    - **Property 1: Expected Behavior** - validateSession キャッシュ混入による誤イニシャル記録
    - **重要**: タスク1で作成した同じテストを再実行する — 新しいテストを作成しないこと
    - タスク1のテストは期待される動作をエンコードしており、修正後に PASS することで修正を検証する
    - タスク1のバグ条件探索テストを実行する
    - **期待される結果**: テスト PASS（バグが修正されたことを確認）
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7_

  - [x] 3.6 保存テストが引き続き PASS することを確認する
    - **Property 2: Preservation** - 非バグ条件入力での動作保存
    - **重要**: タスク2で作成した同じテストを再実行する — 新しいテストを作成しないこと
    - タスク2の保存プロパティテストを実行する
    - **期待される結果**: テスト PASS（リグレッションがないことを確認）
    - 修正後も全ての保存テストが PASS することを確認する

- [x] 4. チェックポイント — 全テストが PASS することを確認する
  - タスク1のバグ条件探索テストが PASS することを確認する
  - タスク2の保存プロパティテストが PASS することを確認する
  - 疑問点があればユーザーに確認する

- [-] 5. デプロイ
  - `.kiro/steering/deploy-procedure.md` のデプロイ手順に従ってデプロイを実施する
  - バックエンド（`sateituikyaku-admin-backend`）をデプロイする
  - フロントエンド（`sateituikyaku-admin-frontend`）をデプロイする（オプション修正を実施した場合）
  - デプロイ後、本番環境で通話モードページのアクションを実行し、アクティビティログに正しいイニシャルが記録されることを確認する
