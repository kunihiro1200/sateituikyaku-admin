/**
 * GoogleDriveService バグ条件探索テスト
 *
 * このテストは未修正コードで FAIL することが期待されます。
 * FAIL することでバグの存在を証明します。
 *
 * バグの根本原因:
 * `GoogleDriveService` の以下の4メソッドで、Google Drive API の `corpora: 'drive'` と
 * 組み合わせて使用する `driveId` に、共有ドライブのルートID（`GOOGLE_SHARED_DRIVE_ID`）ではなく
 * 「業務依頼」フォルダのID（`this.parentFolderId`）を誤って渡している。
 *
 * 影響メソッド:
 * 1. `findFolderByName` - `queryParams.driveId = this.parentFolderId`
 * 2. `listFiles` - `driveId: this.parentFolderId`
 * 3. `listFolderContents` - `driveId: this.parentFolderId`
 * 4. `listImagesWithThumbnails` - `queryParams.driveId = this.parentFolderId`
 *
 * Validates: Requirements 1.2, 1.3
 */

// テスト用の環境変数（モジュールロード前に設定）
const PARENT_FOLDER_ID = 'parent-folder-id-xxx';
const SHARED_DRIVE_ID = 'shared-drive-root-id-yyy';

process.env.GOOGLE_DRIVE_PARENT_FOLDER_ID = PARENT_FOLDER_ID;
process.env.GOOGLE_SHARED_DRIVE_ID = SHARED_DRIVE_ID;
process.env.GOOGLE_SERVICE_ACCOUNT_JSON = JSON.stringify({
  type: 'service_account',
  project_id: 'test-project',
  private_key_id: 'key-id',
  private_key: '-----BEGIN RSA PRIVATE KEY-----\nMIIEowIBAAKCAQEA0Z3VS5JJcds\n-----END RSA PRIVATE KEY-----\n',
  client_email: 'test@test-project.iam.gserviceaccount.com',
  client_id: '123456789',
  auth_uri: 'https://accounts.google.com/o/oauth2/auth',
  token_uri: 'https://oauth2.googleapis.com/token',
});

// drive.files.list のモック関数（モジュールロード前に定義）
const mockFilesList = jest.fn().mockResolvedValue({
  data: {
    files: [
      { id: 'file-1', name: 'test-folder', mimeType: 'application/vnd.google-apps.folder' },
    ],
  },
});

const mockFilesGet = jest.fn().mockResolvedValue({
  data: {
    id: 'file-1',
    name: 'test-file',
    mimeType: 'image/jpeg',
    size: '1024',
    modifiedTime: '2024-01-01T00:00:00Z',
    webViewLink: '',
    webContentLink: '',
    parents: [],
  },
});

const mockDriveInstance = {
  files: {
    list: mockFilesList,
    get: mockFilesGet,
  },
};

// googleapis をモック
jest.mock('googleapis', () => ({
  google: {
    drive: jest.fn().mockReturnValue(mockDriveInstance),
    auth: {
      GoogleAuth: jest.fn().mockImplementation(() => ({
        getClient: jest.fn().mockResolvedValue({}),
      })),
    },
  },
}));

// BaseRepository をモック（Supabase接続が不要なため）
jest.mock('../../repositories/BaseRepository', () => ({
  BaseRepository: class MockBaseRepository {
    protected supabase = {
      from: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({ data: null, error: null }),
          }),
        }),
        upsert: jest.fn().mockResolvedValue({ data: null, error: null }),
      }),
    };
    protected table(tableName: string) {
      return this.supabase.from(tableName);
    }
  },
}));

// fs モック（サービスアカウントファイル読み込みを回避）
jest.mock('fs', () => ({
  existsSync: jest.fn().mockReturnValue(false),
  readFileSync: jest.fn(),
}));

// path モック
jest.mock('path', () => ({
  resolve: jest.fn().mockReturnValue('/mock/path/google-service-account.json'),
}));

import { GoogleDriveService } from '../GoogleDriveService';

describe('GoogleDriveService バグ条件探索テスト', () => {
  let service: GoogleDriveService;

  beforeEach(() => {
    jest.clearAllMocks();
    // モックをリセット後に再設定
    mockFilesList.mockResolvedValue({
      data: {
        files: [
          { id: 'file-1', name: 'test-folder', mimeType: 'application/vnd.google-apps.folder' },
        ],
      },
    });
    service = new GoogleDriveService();
  });

  /**
   * テスト1: findFolderByName の driveId バグ確認
   *
   * 未修正コードでは `queryParams.driveId = this.parentFolderId` のため、
   * driveId に PARENT_FOLDER_ID が渡される → FAIL
   *
   * 修正後は `queryParams.driveId = this.sharedDriveId` のため、
   * driveId に SHARED_DRIVE_ID が渡される → PASS
   */
  it('findFolderByName: driveId に sharedDriveId が渡されること（未修正コードでFAIL）', async () => {
    // findFolderByName を呼び出す（isSharedDrive=true）
    await service.findFolderByName('some-parent-id', 'test-folder', true);

    // drive.files.list が呼び出されたことを確認
    expect(mockFilesList).toHaveBeenCalled();

    // 呼び出し時の引数を取得
    const callArgs = mockFilesList.mock.calls[0][0] as any;

    // アサーション: driveId が sharedDriveId（SHARED_DRIVE_ID）と等しいこと
    // 未修正コードでは driveId = parentFolderId（PARENT_FOLDER_ID）が渡されるため FAIL する
    expect(callArgs.driveId).toBe(SHARED_DRIVE_ID);
  });

  /**
   * テスト2: listFiles の driveId バグ確認
   *
   * 未修正コードでは `driveId: this.parentFolderId` のため、
   * driveId に PARENT_FOLDER_ID が渡される → FAIL
   *
   * 修正後は `driveId: this.sharedDriveId` のため、
   * driveId に SHARED_DRIVE_ID が渡される → PASS
   */
  it('listFiles: driveId に sharedDriveId が渡されること（未修正コードでFAIL）', async () => {
    // listFiles を呼び出す
    await service.listFiles('some-folder-id');

    // drive.files.list が呼び出されたことを確認
    expect(mockFilesList).toHaveBeenCalled();

    // 呼び出し時の引数を取得
    const callArgs = mockFilesList.mock.calls[0][0] as any;

    // アサーション: driveId が sharedDriveId（SHARED_DRIVE_ID）と等しいこと
    // 未修正コードでは driveId = parentFolderId（PARENT_FOLDER_ID）が渡されるため FAIL する
    expect(callArgs.driveId).toBe(SHARED_DRIVE_ID);
  });

  /**
   * テスト3: listFolderContents の driveId バグ確認
   *
   * 未修正コードでは `driveId: this.parentFolderId` のため、
   * driveId に PARENT_FOLDER_ID が渡される → FAIL
   *
   * 修正後は `driveId: this.sharedDriveId` のため、
   * driveId に SHARED_DRIVE_ID が渡される → PASS
   */
  it('listFolderContents: driveId に sharedDriveId が渡されること（未修正コードでFAIL）', async () => {
    // listFolderContents を呼び出す（folderId を指定）
    await service.listFolderContents('some-folder-id');

    // drive.files.list が呼び出されたことを確認
    expect(mockFilesList).toHaveBeenCalled();

    // 呼び出し時の引数を取得
    const callArgs = mockFilesList.mock.calls[0][0] as any;

    // アサーション: driveId が sharedDriveId（SHARED_DRIVE_ID）と等しいこと
    // 未修正コードでは driveId = parentFolderId（PARENT_FOLDER_ID）が渡されるため FAIL する
    expect(callArgs.driveId).toBe(SHARED_DRIVE_ID);
  });

  /**
   * テスト4: listImagesWithThumbnails の driveId バグ確認
   *
   * 未修正コードでは `queryParams.driveId = this.parentFolderId` のため、
   * driveId に PARENT_FOLDER_ID が渡される → FAIL
   *
   * 修正後は `queryParams.driveId = this.sharedDriveId` のため、
   * driveId に SHARED_DRIVE_ID が渡される → PASS
   */
  it('listImagesWithThumbnails: driveId に sharedDriveId が渡されること（未修正コードでFAIL）', async () => {
    // listImagesWithThumbnails を呼び出す
    await service.listImagesWithThumbnails('some-folder-id');

    // drive.files.list が呼び出されたことを確認
    expect(mockFilesList).toHaveBeenCalled();

    // 呼び出し時の引数を取得
    const callArgs = mockFilesList.mock.calls[0][0] as any;

    // アサーション: driveId が sharedDriveId（SHARED_DRIVE_ID）と等しいこと
    // 未修正コードでは driveId = parentFolderId（PARENT_FOLDER_ID）が渡されるため FAIL する
    expect(callArgs.driveId).toBe(SHARED_DRIVE_ID);
  });
});
