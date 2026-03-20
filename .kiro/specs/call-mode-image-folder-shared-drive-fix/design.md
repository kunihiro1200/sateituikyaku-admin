# call-mode-image-folder-shared-drive-fix バグ修正デザイン

## Overview

通話モードページの「画像」ボタン押下時に `GET /api/drive/folders/:sellerNumber` が500エラーを返すバグを修正する。

根本原因は `GoogleDriveService.ts` の複数メソッドで、Google Drive API の `corpora: 'drive'` パラメータと組み合わせて使用する `driveId` に、共有ドライブのルートIDではなく「業務依頼」フォルダのID（`this.parentFolderId`）を誤って渡していることである。

修正方針は**方法A**：新しい環境変数 `GOOGLE_SHARED_DRIVE_ID` を追加し、`driveId` にはこの値を使用する。

## Glossary

- **Bug_Condition (C)**: `corpora: 'drive'` を使用するAPIリクエストで `driveId` に共有ドライブのルートIDではなく `parentFolderId`（「業務依頼」フォルダのID）を渡している状態
- **Property (P)**: `driveId` に正しい共有ドライブのルートID（`GOOGLE_SHARED_DRIVE_ID`）を渡し、Google Drive APIが正常にレスポンスを返す
- **Preservation**: ファイルアップロード・削除・フォルダ内容取得など、`driveId` を使用しない既存機能は変更の影響を受けない
- **parentFolderId**: `process.env.GOOGLE_DRIVE_PARENT_FOLDER_ID` の値。「業務依頼」フォルダのID（例: `1d9oHRSQ1_UAC5XakBLijUsendj0ZxD4F`）。共有ドライブのルートIDではない
- **sharedDriveId**: `process.env.GOOGLE_SHARED_DRIVE_ID` の値（新規追加）。共有ドライブ自体のルートID
- **GoogleDriveService**: `backend/src/services/GoogleDriveService.ts` に定義されたサービスクラス。Google Drive APIとのやり取りを担当する

## Bug Details

### Bug Condition

Google Drive API の `corpora: 'drive'` を使用する場合、`driveId` には共有ドライブ自体のルートIDを指定する必要がある。しかし現在の実装では、`this.parentFolderId`（「業務依頼」フォルダのID）を `driveId` として渡しているため、APIが「Shared drive not found」エラーを返す。

**Formal Specification:**
```
FUNCTION isBugCondition(request)
  INPUT: request of type GoogleDriveAPIRequest
  OUTPUT: boolean

  RETURN request.params.corpora = 'drive'
         AND request.params.driveId = this.parentFolderId
         AND this.parentFolderId ≠ sharedDriveRootId
END FUNCTION
```

### Examples

- `findFolderByName` 呼び出し時: `driveId: "1d9oHRSQ1_UAC5XakBLijUsendj0ZxD4F"` → `Shared drive not found` エラー
- `listFiles` 呼び出し時: `driveId: "1d9oHRSQ1_UAC5XakBLijUsendj0ZxD4F"` → `Shared drive not found` エラー
- `listFolderContents` 呼び出し時: `driveId: "1d9oHRSQ1_UAC5XakBLijUsendj0ZxD4F"` → `Shared drive not found` エラー
- `listImagesWithThumbnails` 呼び出し時: `driveId: "1d9oHRSQ1_UAC5XakBLijUsendj0ZxD4F"` → `Shared drive not found` エラー
- 正しい `sharedDriveId` を渡した場合: APIが正常にファイル一覧を返す（バグ条件を満たさない）

## Expected Behavior

### Preservation Requirements

**Unchanged Behaviors:**
- ファイルアップロード機能（`POST /api/drive/folders/:sellerNumber/files`）は引き続き正常に動作する
- ファイル削除機能（`DELETE /api/drive/files/:fileId`）は引き続き正常に動作する
- `seller_drive_folders` テーブルに既存のフォルダIDが保存されている場合、そのIDを優先して使用する動作は変わらない
- 公開物件サイト用バックエンド（`backend/api/`）は変更の影響を受けない

**Scope:**
`driveId` パラメータを使用しないAPIリクエスト（ファイルアップロード、ファイル削除、メタデータ取得など）はこの修正の影響を受けない。また、`backend/api/` ディレクトリは作業対象外であり、変更しない。

## Hypothesized Root Cause

コード調査により根本原因は確認済みである：

1. **driveIdの誤設定**: `corpora: 'drive'` を使用する4つのメソッドすべてで `driveId: this.parentFolderId` を指定している。Google Drive APIの仕様では `driveId` には共有ドライブのルートIDが必要だが、`parentFolderId` は共有ドライブ内のサブフォルダ（「業務依頼」フォルダ）のIDである

2. **環境変数の不足**: 共有ドライブのルートIDを管理する専用の環境変数が存在しない。`GOOGLE_DRIVE_PARENT_FOLDER_ID` は「業務依頼」フォルダのIDとして正しく使用されているが、`driveId` 用の別変数が必要

3. **影響を受けるメソッド**（コード確認済み）:
   - `findFolderByName`（約130行目）: `queryParams.driveId = this.parentFolderId`
   - `listFiles`（約330行目）: `driveId: this.parentFolderId`
   - `listFolderContents`（約500行目）: `driveId: this.parentFolderId`
   - `listImagesWithThumbnails`（約400行目）: `queryParams.driveId = this.parentFolderId`

## Correctness Properties

Property 1: Bug Condition - 共有ドライブAPIリクエストに正しいdriveIdを使用する

_For any_ Google Drive APIリクエストで `corpora: 'drive'` を使用する場合、修正後の各メソッドは `driveId` に `GOOGLE_SHARED_DRIVE_ID`（共有ドライブのルートID）を渡し、Google Drive APIが「Shared drive not found」エラーを返さずに正常なレスポンスを返す。

**Validates: Requirements 2.1, 2.2, 2.3, 2.4**

Property 2: Preservation - driveIdを使用しない機能の動作が変わらない

_For any_ リクエストで `corpora: 'drive'` と `driveId` を使用しない操作（ファイルアップロード、ファイル削除、メタデータ取得など）は、修正後も修正前と同じ動作を維持し、既存機能に影響を与えない。

**Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5**

## Fix Implementation

### Changes Required

根本原因分析に基づく修正内容：

**File**: `backend/src/services/GoogleDriveService.ts`

**Specific Changes**:

1. **新しいプロパティの追加**: `private sharedDriveId: string` を `GoogleDriveService` クラスに追加し、コンストラクタで `process.env.GOOGLE_SHARED_DRIVE_ID || ''` を設定する

2. **`findFolderByName` の修正**: `queryParams.driveId = this.parentFolderId` を `queryParams.driveId = this.sharedDriveId` に変更する

3. **`listFiles` の修正**: `driveId: this.parentFolderId` を `driveId: this.sharedDriveId` に変更する

4. **`listFolderContents` の修正**: `driveId: this.parentFolderId` を `driveId: this.sharedDriveId` に変更する

5. **`listImagesWithThumbnails` の修正**: `queryParams.driveId = this.parentFolderId` を `queryParams.driveId = this.sharedDriveId` に変更する

**File**: `backend/src/services/GoogleDriveService.ts` コンストラクタ

```typescript
constructor() {
  super();
  this.parentFolderId = process.env.GOOGLE_DRIVE_PARENT_FOLDER_ID || '';
  this.sharedDriveId = process.env.GOOGLE_SHARED_DRIVE_ID || '';  // 新規追加
  
  if (!this.parentFolderId) {
    console.warn('⚠️ GOOGLE_DRIVE_PARENT_FOLDER_ID is not configured');
  }
  if (!this.sharedDriveId) {
    console.warn('⚠️ GOOGLE_SHARED_DRIVE_ID is not configured');
  }
  
  this.initializeServiceAccount();
}
```

**Environment Variables**:
- `.env.local` に `GOOGLE_SHARED_DRIVE_ID=<共有ドライブのルートID>` を追加
- Vercel の環境変数設定にも同様に追加

## Testing Strategy

### Validation Approach

テスト戦略は2フェーズで構成される：まず未修正コードでバグを再現するテストを実行し、次に修正後のコードで正しい動作と既存機能の保持を検証する。

### Exploratory Bug Condition Checking

**Goal**: 未修正コードでバグを再現し、根本原因分析を確認する。

**Test Plan**: `GoogleDriveService` の各メソッドをモックなしで呼び出し、`driveId` に `parentFolderId` が渡されることを確認する。未修正コードでこれらのテストが失敗することを観察する。

**Test Cases**:
1. **findFolderByName テスト**: `findFolderByName` を呼び出し、APIリクエストの `driveId` が `parentFolderId` と一致することを確認（未修正コードで失敗）
2. **listFiles テスト**: `listFiles` を呼び出し、APIリクエストの `driveId` が `parentFolderId` と一致することを確認（未修正コードで失敗）
3. **listFolderContents テスト**: `listFolderContents` を呼び出し、APIリクエストの `driveId` が `parentFolderId` と一致することを確認（未修正コードで失敗）
4. **listImagesWithThumbnails テスト**: `listImagesWithThumbnails` を呼び出し、APIリクエストの `driveId` が `parentFolderId` と一致することを確認（未修正コードで失敗）

**Expected Counterexamples**:
- `driveId` に `parentFolderId`（「業務依頼」フォルダのID）が渡されており、共有ドライブのルートIDではない
- Google Drive APIが「Shared drive not found」エラーを返す

### Fix Checking

**Goal**: バグ条件を満たすすべての入力に対して、修正後のメソッドが正しい動作をすることを検証する。

**Pseudocode:**
```
FOR ALL method WHERE isBugCondition(method.apiRequest) DO
  result := method_fixed(input)
  ASSERT result.driveId = GOOGLE_SHARED_DRIVE_ID
  ASSERT result.error ≠ "Shared drive not found"
END FOR
```

### Preservation Checking

**Goal**: バグ条件を満たさない入力（`driveId` を使用しない操作）に対して、修正後も修正前と同じ動作をすることを検証する。

**Pseudocode:**
```
FOR ALL operation WHERE NOT isBugCondition(operation) DO
  ASSERT original_behavior(operation) = fixed_behavior(operation)
END FOR
```

**Testing Approach**: プロパティベーステストが推奨される理由：
- 多様な入力パターンを自動生成できる
- 手動テストでは見落としがちなエッジケースを検出できる
- 修正前後の動作が一致することを強く保証できる

**Test Plan**: 未修正コードでファイルアップロード・削除などの動作を観察し、修正後も同じ動作をすることをテストで検証する。

**Test Cases**:
1. **ファイルアップロード保持**: `uploadFile` が修正前後で同じ動作をすることを確認
2. **ファイル削除保持**: `deleteFile` が修正前後で同じ動作をすることを確認
3. **DBキャッシュ優先保持**: `seller_drive_folders` テーブルのIDが引き続き優先されることを確認

### Unit Tests

- 各修正メソッド（`findFolderByName`、`listFiles`、`listFolderContents`、`listImagesWithThumbnails`）で `driveId` に `sharedDriveId` が使用されることをテスト
- `GOOGLE_SHARED_DRIVE_ID` が未設定の場合の警告ログ出力をテスト
- `sharedDriveId` が空の場合のフォールバック動作をテスト

### Property-Based Tests

- ランダムな `folderId` を生成し、`listFiles` が常に `driveId: sharedDriveId` を使用することを検証
- ランダムな検索クエリを生成し、`findFolderByName` が常に正しい `driveId` を使用することを検証
- `driveId` を使用しないメソッド（`uploadFile`、`deleteFile`）が任意の入力に対して修正前後で同じ動作をすることを検証

### Integration Tests

- 通話モードページの「画像」ボタン押下から `GET /api/drive/folders/:sellerNumber` のレスポンスまでの完全なフローをテスト
- 正しい `GOOGLE_SHARED_DRIVE_ID` を設定した状態で、売主フォルダの取得・作成が正常に動作することを確認
- ファイルアップロード後にファイル一覧が正しく表示されることを確認
