# Implementation Plan

- [x] 1. Write bug condition exploration test
  - **Property 1: Bug Condition** - driveIdにparentFolderIdが渡されるバグ
  - **CRITICAL**: このテストは未修正コードで必ずFAILする - FAILすることでバグの存在を確認する
  - **DO NOT attempt to fix the test or the code when it fails**
  - **NOTE**: このテストは期待される動作をエンコードしている - 修正後にPASSすることで修正を検証する
  - **GOAL**: バグが存在することを示すカウンターサンプルを見つける
  - **Scoped PBT Approach**: 決定論的バグのため、具体的な失敗ケースにスコープを絞る
  - `GoogleDriveService` をインスタンス化し、`GOOGLE_DRIVE_PARENT_FOLDER_ID` と異なる `GOOGLE_SHARED_DRIVE_ID` を設定した状態で各メソッドをモックでテストする
  - `findFolderByName`、`listFiles`、`listFolderContents`、`listImagesWithThumbnails` の4メソッドで `driveId` に `parentFolderId` が渡されることを確認する（Bug Conditionの `isBugCondition` 疑似コードに基づく）
  - テストアサーション: `driveId` が `sharedDriveId` と等しいこと（未修正コードではFAILする）
  - 未修正コードでテストを実行する
  - **EXPECTED OUTCOME**: テストFAIL（これが正しい - バグの存在を証明する）
  - カウンターサンプルを記録して根本原因を理解する（例: `driveId: "1d9oHRSQ1_UAC5XakBLijUsendj0ZxD4F"` が渡されている）
  - テストを書き、実行し、FAILを記録したらタスク完了とする
  - _Requirements: 1.2, 1.3_

- [x] 2. Write preservation property tests (BEFORE implementing fix)
  - **Property 2: Preservation** - driveIdを使用しない機能の動作が変わらない
  - **IMPORTANT**: 観察優先メソドロジーに従う
  - 未修正コードで `driveId` を使用しない操作（`uploadFile`、`deleteFile`、`getOrCreateSellerFolder` のDB参照部分）の動作を観察する
  - 観察: `uploadFile` は `supportsAllDrives: true` のみ使用し `driveId` を使用しない
  - 観察: `deleteFile` は `supportsAllDrives: true` のみ使用し `driveId` を使用しない
  - 観察: `seller_drive_folders` テーブルのIDが存在する場合はそれを優先して使用する
  - プロパティベーステスト: `driveId` を使用しない全操作で、修正前後の動作が一致することを検証する
  - 未修正コードでテストを実行する
  - **EXPECTED OUTCOME**: テストPASS（ベースライン動作を確認する）
  - テストを書き、実行し、未修正コードでPASSしたらタスク完了とする
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_

- [x] 3. Fix for driveIdに誤ったparentFolderIdが渡されるバグ

  - [x] 3.1 Implement the fix
    - `GoogleDriveService` クラスに `private sharedDriveId: string` プロパティを追加する
    - コンストラクタで `this.sharedDriveId = process.env.GOOGLE_SHARED_DRIVE_ID || ''` を設定する
    - `GOOGLE_SHARED_DRIVE_ID` が未設定の場合の警告ログを追加する: `console.warn('⚠️ GOOGLE_SHARED_DRIVE_ID is not configured')`
    - `findFolderByName` の `queryParams.driveId = this.parentFolderId` を `queryParams.driveId = this.sharedDriveId` に変更する
    - `listFiles` の `driveId: this.parentFolderId` を `driveId: this.sharedDriveId` に変更する
    - `listFolderContents` の `driveId: this.parentFolderId` を `driveId: this.sharedDriveId` に変更する
    - `listImagesWithThumbnails` の `queryParams.driveId = this.parentFolderId` を `queryParams.driveId = this.sharedDriveId` に変更する
    - `.env.local` に `GOOGLE_SHARED_DRIVE_ID=` を追加する（値はユーザーが設定）
    - _Bug_Condition: isBugCondition(request) where request.params.corpora = 'drive' AND request.params.driveId = this.parentFolderId_
    - _Expected_Behavior: driveId に GOOGLE_SHARED_DRIVE_ID（共有ドライブのルートID）を渡し、Google Drive APIが正常なレスポンスを返す_
    - _Preservation: driveIdを使用しない操作（uploadFile、deleteFile、メタデータ取得など）は修正前後で同じ動作を維持する_
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 3.1, 3.2, 3.3, 3.4, 3.5_

  - [x] 3.2 Verify bug condition exploration test now passes
    - **Property 1: Expected Behavior** - driveIdに正しいsharedDriveIdが渡される
    - **IMPORTANT**: タスク1と同じテストを再実行する - 新しいテストを書かない
    - タスク1のテストは期待される動作をエンコードしている
    - このテストがPASSすれば、期待される動作が満たされていることを確認できる
    - タスク1のバグ条件探索テストを実行する
    - **EXPECTED OUTCOME**: テストPASS（バグが修正されたことを確認する）
    - _Requirements: デザインのExpected Behavior Properties（2.1, 2.2, 2.3, 2.4）_

  - [x] 3.3 Verify preservation tests still pass
    - **Property 2: Preservation** - driveIdを使用しない機能の動作が変わらない
    - **IMPORTANT**: タスク2と同じテストを再実行する - 新しいテストを書かない
    - タスク2の保持プロパティテストを実行する
    - **EXPECTED OUTCOME**: テストPASS（リグレッションがないことを確認する）
    - 修正後も全テストがPASSすることを確認する（リグレッションなし）

- [x] 4. Checkpoint - Ensure all tests pass
  - 全テストがPASSすることを確認する。疑問が生じた場合はユーザーに確認する。
  - ユーザーに `GOOGLE_SHARED_DRIVE_ID` の値（共有ドライブのルートID）をGoogle Driveから確認して `.env.local` と Vercel環境変数に設定するよう案内する
