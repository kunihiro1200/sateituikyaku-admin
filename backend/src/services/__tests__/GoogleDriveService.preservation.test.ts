/**
 * GoogleDriveService 保持プロパティテスト
 *
 * このテストは未修正コードで PASS することが期待されます。
 * ベースライン動作を確認します。
 *
 * 保持プロパティの確認内容:
 * - `uploadFile` が `supportsAllDrives: true` のみ使用し `driveId` を使用しないこと
 * - `deleteFile` が `supportsAllDrives: true` のみ使用し `driveId` を使用しないこと
 * - `getOrCreateSellerFolder` で `seller_drive_folders` テーブルのIDが存在する場合はそれを優先して使用すること
 *
 * Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5
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

// drive.files.create のモック関数（uploadFile 用）
const mockFilesCreate = jest.fn().mockResolvedValue({
  data: {
    id: 'uploaded-file-id',
    name: 'test-file.jpg',
    mimeType: 'image/jpeg',
    size: '1024',
    modifiedTime: '2024-01-01T00:00:00Z',
    webViewLink: 'https://drive.google.com/file/d/uploaded-file-id/view',
    webContentLink: 'https://drive.google.com/uc?export=download&id=uploaded-file-id',
  },
});

// drive.files.delete のモック関数（deleteFile 用）
const mockFilesDelete = jest.fn().mockResolvedValue({ data: {} });

// drive.files.list のモック関数
const mockFilesList = jest.fn().mockResolvedValue({
  data: {
    files: [
      { id: 'file-1', name: 'test-folder', mimeType: 'application/vnd.google-apps.folder' },
    ],
  },
});

// drive.files.get のモック関数
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

// drive.files.update のモック関数
const mockFilesUpdate = jest.fn().mockResolvedValue({ data: {} });

const mockDriveInstance = {
  files: {
    list: mockFilesList,
    get: mockFilesGet,
    create: mockFilesCreate,
    delete: mockFilesDelete,
    update: mockFilesUpdate,
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
const mockSingle = jest.fn().mockResolvedValue({ data: null, error: null });
const mockEq = jest.fn().mockReturnValue({ single: mockSingle });
const mockSelect = jest.fn().mockReturnValue({ eq: mockEq });
const mockUpsert = jest.fn().mockResolvedValue({ data: null, error: null });
const mockFrom = jest.fn().mockReturnValue({
  select: mockSelect,
  upsert: mockUpsert,
});

jest.mock('../../repositories/BaseRepository', () => ({
  BaseRepository: class MockBaseRepository {
    protected supabase = {
      from: mockFrom,
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

describe('GoogleDriveService 保持プロパティテスト', () => {
  let service: GoogleDriveService;

  beforeEach(() => {
    jest.clearAllMocks();

    // モックをリセット後に再設定
    mockFilesCreate.mockResolvedValue({
      data: {
        id: 'uploaded-file-id',
        name: 'test-file.jpg',
        mimeType: 'image/jpeg',
        size: '1024',
        modifiedTime: '2024-01-01T00:00:00Z',
        webViewLink: 'https://drive.google.com/file/d/uploaded-file-id/view',
        webContentLink: 'https://drive.google.com/uc?export=download&id=uploaded-file-id',
      },
    });
    mockFilesDelete.mockResolvedValue({ data: {} });
    mockFilesList.mockResolvedValue({
      data: {
        files: [
          { id: 'file-1', name: 'test-folder', mimeType: 'application/vnd.google-apps.folder' },
        ],
      },
    });
    mockSingle.mockResolvedValue({ data: null, error: null });

    service = new GoogleDriveService();
  });

  /**
   * テスト1: uploadFile が driveId を使用しないことを確認
   *
   * uploadFile は `supportsAllDrives: true` のみ使用し、
   * `driveId` を使用しない。
   * この動作は修正前後で変わらないことを確認する。
   *
   * Validates: Requirements 3.1
   */
  it('uploadFile: supportsAllDrives: true のみ使用し driveId を使用しないこと（未修正コードでPASS）', async () => {
    const fileBuffer = Buffer.from('test file content');
    const fileName = 'test-file.jpg';
    const mimeType = 'image/jpeg';
    const folderId = 'some-folder-id';

    // uploadFile を呼び出す
    await service.uploadFile(folderId, fileBuffer, fileName, mimeType);

    // drive.files.create が呼び出されたことを確認
    expect(mockFilesCreate).toHaveBeenCalled();

    // 呼び出し時の引数を取得
    const callArgs = mockFilesCreate.mock.calls[0][0] as any;

    // アサーション1: supportsAllDrives: true が設定されていること
    expect(callArgs.supportsAllDrives).toBe(true);

    // アサーション2: driveId が設定されていないこと（保持プロパティ）
    // uploadFile は driveId を使用しないため、修正前後で変わらない
    expect(callArgs.driveId).toBeUndefined();
  });

  /**
   * テスト2: deleteFile が driveId を使用しないことを確認
   *
   * deleteFile は `supportsAllDrives: true` のみ使用し、
   * `driveId` を使用しない。
   * この動作は修正前後で変わらないことを確認する。
   *
   * Validates: Requirements 3.2
   */
  it('deleteFile: supportsAllDrives: true のみ使用し driveId を使用しないこと（未修正コードでPASS）', async () => {
    const fileId = 'some-file-id';

    // deleteFile を呼び出す
    await service.deleteFile(fileId);

    // drive.files.delete が呼び出されたことを確認
    expect(mockFilesDelete).toHaveBeenCalled();

    // 呼び出し時の引数を取得
    const callArgs = mockFilesDelete.mock.calls[0][0] as any;

    // アサーション1: fileId が正しく渡されていること
    expect(callArgs.fileId).toBe(fileId);

    // アサーション2: supportsAllDrives: true が設定されていること
    expect(callArgs.supportsAllDrives).toBe(true);

    // アサーション3: driveId が設定されていないこと（保持プロパティ）
    // deleteFile は driveId を使用しないため、修正前後で変わらない
    expect(callArgs.driveId).toBeUndefined();
  });

  /**
   * テスト3: getOrCreateSellerFolder が seller_drive_folders テーブルのIDを優先して使用することを確認
   *
   * seller_drive_folders テーブルに既存のフォルダIDが保存されている場合、
   * そのIDを優先して使用する動作は修正前後で変わらないことを確認する。
   *
   * Validates: Requirements 3.4
   */
  it('getOrCreateSellerFolder: seller_drive_folders テーブルのIDが存在する場合はそれを優先して使用すること（未修正コードでPASS）', async () => {
    const existingFolderId = 'existing-folder-id-from-db';

    // seller_drive_folders テーブルにフォルダIDが存在する場合のモック
    mockSingle.mockResolvedValue({
      data: { drive_folder_id: existingFolderId },
      error: null,
    });

    // listFiles のモックを設定（フォルダ内のファイル一覧取得用）
    mockFilesList.mockResolvedValue({
      data: { files: [] },
    });

    // getOrCreateSellerFolder を呼び出す
    const result = await service.getOrCreateSellerFolder(
      'seller-uuid-123',
      'AA13501',
      '東京都渋谷区',
      'テスト太郎'
    );

    // アサーション1: 返されたフォルダIDがDBのIDと一致すること
    expect(result.folderId).toBe(existingFolderId);

    // アサーション2: drive.files.create が呼び出されていないこと
    // （DBにIDがある場合は新規作成しない）
    expect(mockFilesCreate).not.toHaveBeenCalled();

    // アサーション3: seller_drive_folders テーブルが参照されたこと
    expect(mockFrom).toHaveBeenCalledWith('seller_drive_folders');
  });

  /**
   * テスト4: getOrCreateSellerFolder が seller_drive_folders テーブルにIDがない場合は
   * Google Drive を検索することを確認
   *
   * seller_drive_folders テーブルにIDがない場合は、Google Drive を検索して
   * フォルダを取得または作成する動作を確認する。
   *
   * Validates: Requirements 3.4
   */
  it('getOrCreateSellerFolder: seller_drive_folders テーブルにIDがない場合は Google Drive を検索すること（未修正コードでPASS）', async () => {
    // seller_drive_folders テーブルにフォルダIDが存在しない場合のモック
    mockSingle.mockResolvedValue({
      data: null,
      error: null,
    });

    // findFolderByName のモック（フォルダが見つかった場合）
    mockFilesList.mockResolvedValue({
      data: {
        files: [
          {
            id: 'found-folder-id',
            name: 'AA13501_東京都渋谷区_テスト太郎',
            mimeType: 'application/vnd.google-apps.folder',
          },
        ],
      },
    });

    // getOrCreateSellerFolder を呼び出す
    const result = await service.getOrCreateSellerFolder(
      'seller-uuid-123',
      'AA13501',
      '東京都渋谷区',
      'テスト太郎'
    );

    // アサーション1: drive.files.list が呼び出されたこと（Google Drive 検索）
    expect(mockFilesList).toHaveBeenCalled();

    // アサーション2: 返されたフォルダIDが Google Drive で見つかったIDと一致すること
    expect(result.folderId).toBe('found-folder-id');
  });

  /**
   * テスト5: uploadFile が正しいフォルダIDにファイルをアップロードすることを確認
   *
   * uploadFile は指定されたフォルダIDにファイルをアップロードする。
   * この動作は修正前後で変わらないことを確認する。
   *
   * Validates: Requirements 3.1
   */
  it('uploadFile: 指定されたフォルダIDにファイルをアップロードすること（未修正コードでPASS）', async () => {
    const fileBuffer = Buffer.from('test file content');
    const fileName = 'test-image.png';
    const mimeType = 'image/png';
    const folderId = 'target-folder-id';

    // uploadFile を呼び出す
    const result = await service.uploadFile(folderId, fileBuffer, fileName, mimeType);

    // drive.files.create が呼び出されたことを確認
    expect(mockFilesCreate).toHaveBeenCalled();

    // 呼び出し時の引数を取得
    const callArgs = mockFilesCreate.mock.calls[0][0] as any;

    // アサーション1: 正しいフォルダIDが parents に設定されていること
    expect(callArgs.requestBody.parents).toContain(folderId);

    // アサーション2: 正しいファイル名が設定されていること
    expect(callArgs.requestBody.name).toBe(fileName);

    // アサーション3: 返されたファイルIDが正しいこと
    expect(result.id).toBe('uploaded-file-id');
  });

  /**
   * テスト6: deleteFile が正しいファイルIDを削除することを確認
   *
   * deleteFile は指定されたファイルIDを削除する。
   * この動作は修正前後で変わらないことを確認する。
   *
   * Validates: Requirements 3.2
   */
  it('deleteFile: 指定されたファイルIDを削除すること（未修正コードでPASS）', async () => {
    const fileId = 'file-to-delete-id';

    // deleteFile を呼び出す
    await service.deleteFile(fileId);

    // drive.files.delete が呼び出されたことを確認
    expect(mockFilesDelete).toHaveBeenCalled();

    // 呼び出し時の引数を取得
    const callArgs = mockFilesDelete.mock.calls[0][0] as any;

    // アサーション: 正しいファイルIDが渡されていること
    expect(callArgs.fileId).toBe(fileId);
  });
});
