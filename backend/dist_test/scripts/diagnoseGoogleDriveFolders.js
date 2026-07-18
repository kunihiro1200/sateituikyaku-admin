"use strict";
/**
 * Google Driveフォルダ診断スクリプト
 * 共有ドライブ内のフォルダを検索して、物件番号のフォルダが存在するか確認
 *
 * 使い方:
 * npx ts-node src/scripts/diagnoseGoogleDriveFolders.ts AA13069
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const dotenv_1 = __importDefault(require("dotenv"));
const GoogleDriveService_1 = require("../services/GoogleDriveService");
dotenv_1.default.config();
async function diagnoseGoogleDriveFolders(searchTerm) {
    console.log('='.repeat(60));
    console.log('Google Driveフォルダ診断');
    console.log('='.repeat(60));
    console.log('');
    try {
        const driveService = new GoogleDriveService_1.GoogleDriveService();
        // 1. 共有ドライブの情報を取得
        console.log('📋 ステップ1: 共有ドライブの情報を確認');
        const drive = await driveService['getDriveClient']();
        // 共有ドライブ一覧を取得
        const drivesResponse = await drive.drives.list({
            pageSize: 10,
        });
        if (!drivesResponse.data.drives || drivesResponse.data.drives.length === 0) {
            console.log('❌ 共有ドライブが見つかりません');
            console.log('');
            console.log('考えられる原因:');
            console.log('- サービスアカウントに共有ドライブへのアクセス権限がない');
            console.log('- 共有ドライブが存在しない');
            return;
        }
        console.log(`✅ ${drivesResponse.data.drives.length}個の共有ドライブが見つかりました:`);
        drivesResponse.data.drives.forEach((drive, index) => {
            console.log(`  ${index + 1}. ${drive.name} (ID: ${drive.id})`);
        });
        console.log('');
        // 2. 各共有ドライブ内のフォルダを検索
        console.log('🔍 ステップ2: フォルダを検索');
        if (searchTerm) {
            console.log(`検索キーワード: "${searchTerm}"`);
            console.log('');
            for (const sharedDrive of drivesResponse.data.drives) {
                console.log(`📁 共有ドライブ: ${sharedDrive.name}`);
                try {
                    // フォルダを検索
                    const query = `name contains '${searchTerm}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`;
                    const filesResponse = await drive.files.list({
                        q: query,
                        driveId: sharedDrive.id,
                        corpora: 'drive',
                        includeItemsFromAllDrives: true,
                        supportsAllDrives: true,
                        fields: 'files(id, name, parents, webViewLink)',
                        pageSize: 20,
                    });
                    if (filesResponse.data.files && filesResponse.data.files.length > 0) {
                        console.log(`  ✅ ${filesResponse.data.files.length}個のフォルダが見つかりました:`);
                        filesResponse.data.files.forEach((file, index) => {
                            console.log(`    ${index + 1}. ${file.name}`);
                            console.log(`       ID: ${file.id}`);
                            console.log(`       URL: ${file.webViewLink}`);
                            console.log('');
                        });
                    }
                    else {
                        console.log(`  ❌ フォルダが見つかりませんでした`);
                    }
                }
                catch (error) {
                    console.error(`  ❌ エラー: ${error.message}`);
                }
                console.log('');
            }
        }
        else {
            console.log('検索キーワードが指定されていません');
            console.log('');
            console.log('各共有ドライブのルートフォルダを表示します:');
            console.log('');
            for (const sharedDrive of drivesResponse.data.drives) {
                console.log(`📁 共有ドライブ: ${sharedDrive.name}`);
                try {
                    // ルートフォルダの直下のフォルダを取得
                    const query = `'${sharedDrive.id}' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false`;
                    const filesResponse = await drive.files.list({
                        q: query,
                        driveId: sharedDrive.id,
                        corpora: 'drive',
                        includeItemsFromAllDrives: true,
                        supportsAllDrives: true,
                        fields: 'files(id, name, webViewLink)',
                        pageSize: 20,
                    });
                    if (filesResponse.data.files && filesResponse.data.files.length > 0) {
                        console.log(`  ✅ ${filesResponse.data.files.length}個のフォルダが見つかりました:`);
                        filesResponse.data.files.forEach((file, index) => {
                            console.log(`    ${index + 1}. ${file.name} (ID: ${file.id})`);
                        });
                    }
                    else {
                        console.log(`  ❌ フォルダが見つかりませんでした`);
                    }
                }
                catch (error) {
                    console.error(`  ❌ エラー: ${error.message}`);
                }
                console.log('');
            }
        }
        console.log('='.repeat(60));
        console.log('診断完了');
        console.log('='.repeat(60));
    }
    catch (error) {
        console.error('❌ エラーが発生しました:', error.message);
        console.error(error);
    }
}
// コマンドライン引数から検索キーワードを取得
const searchTerm = process.argv[2];
diagnoseGoogleDriveFolders(searchTerm)
    .then(() => process.exit(0))
    .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
});
