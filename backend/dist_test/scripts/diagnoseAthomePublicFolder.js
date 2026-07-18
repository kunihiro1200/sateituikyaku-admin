"use strict";
/**
 * athome公開フォルダの診断スクリプト
 * 物件番号のフォルダを検索
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const dotenv_1 = __importDefault(require("dotenv"));
const GoogleDriveService_1 = require("../services/GoogleDriveService");
dotenv_1.default.config();
async function diagnoseAthomePublicFolder(searchTerm) {
    console.log('='.repeat(60));
    console.log('athome公開フォルダ診断');
    console.log('='.repeat(60));
    console.log('');
    try {
        const driveService = new GoogleDriveService_1.GoogleDriveService();
        const drive = await driveService['getDriveClient']();
        // athome公開フォルダID
        const athomeFolderId = '1koHdBU_2UnhkGxaZP3OoNS1AYracP5Vg';
        console.log('📋 ステップ1: athome公開フォルダの情報を確認');
        console.log(`フォルダID: ${athomeFolderId}`);
        console.log('');
        // フォルダ内のサブフォルダを取得
        console.log('📁 ステップ2: フォルダ内のサブフォルダを取得（最初の50件）');
        let query = `'${athomeFolderId}' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false`;
        if (searchTerm) {
            query += ` and name contains '${searchTerm}'`;
            console.log(`検索キーワード: "${searchTerm}"`);
        }
        console.log('');
        const response = await drive.files.list({
            q: query,
            fields: 'files(id, name, webViewLink)',
            orderBy: 'name',
            pageSize: 50,
            supportsAllDrives: true,
            includeItemsFromAllDrives: true,
            corpora: 'drive',
            driveId: '0AJd1KlohTQaTUk9PVA', // 業務依頼の共有ドライブID
        });
        const folders = response.data.files || [];
        if (folders.length === 0) {
            console.log('❌ サブフォルダが見つかりませんでした');
            return;
        }
        console.log(`✅ ${folders.length}個のサブフォルダが見つかりました:`);
        console.log('');
        folders.forEach((folder, index) => {
            console.log(`${index + 1}. ${folder.name}`);
            console.log(`   ID: ${folder.id}`);
            console.log(`   URL: ${folder.webViewLink}`);
            console.log('');
        });
        if (searchTerm) {
            // 検索キーワードで始まるフォルダを検索
            console.log(`🔍 ステップ3: ${searchTerm}で始まるフォルダを検索`);
            const matchingFolders = folders.filter(f => f.name?.startsWith(searchTerm));
            if (matchingFolders.length > 0) {
                console.log(`✅ ${matchingFolders.length}個の${searchTerm}フォルダが見つかりました:`);
                matchingFolders.forEach((folder, index) => {
                    console.log(`${index + 1}. ${folder.name}`);
                    console.log(`   ID: ${folder.id}`);
                    console.log(`   URL: ${folder.webViewLink}`);
                    console.log('');
                });
            }
            else {
                console.log(`❌ ${searchTerm}で始まるフォルダが見つかりませんでした`);
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
diagnoseAthomePublicFolder(searchTerm)
    .then(() => process.exit(0))
    .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
});
