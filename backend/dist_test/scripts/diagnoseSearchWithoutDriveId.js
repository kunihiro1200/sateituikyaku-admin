"use strict";
/**
 * driveIdなしでGoogle Drive検索を診断
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const dotenv_1 = __importDefault(require("dotenv"));
const GoogleDriveService_1 = require("../services/GoogleDriveService");
dotenv_1.default.config();
async function diagnoseSearchWithoutDriveId(searchTerm) {
    console.log('='.repeat(60));
    console.log('Google Drive検索診断（driveIdなし）');
    console.log('='.repeat(60));
    console.log('');
    try {
        const driveService = new GoogleDriveService_1.GoogleDriveService();
        const drive = await driveService['getDriveClient']();
        console.log(`🔍 検索キーワード: "${searchTerm}"`);
        console.log('');
        // パターン1: driveIdとcorporaを指定
        console.log('📋 パターン1: driveId + corpora = "drive"');
        try {
            const response1 = await drive.files.list({
                q: `name contains '${searchTerm}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
                fields: 'files(id, name, parents, webViewLink)',
                supportsAllDrives: true,
                includeItemsFromAllDrives: true,
                corpora: 'drive',
                driveId: '0AJd1KlohTQaTUk9PVA',
                pageSize: 20,
            });
            const files1 = response1.data.files || [];
            console.log(`結果: ${files1.length}個のフォルダ`);
            files1.forEach((f, i) => console.log(`  ${i + 1}. ${f.name} (${f.id})`));
        }
        catch (error) {
            console.error(`エラー: ${error.message}`);
        }
        console.log('');
        // パターン2: corporaを"allDrives"に変更
        console.log('📋 パターン2: corpora = "allDrives"（driveIdなし）');
        try {
            const response2 = await drive.files.list({
                q: `name contains '${searchTerm}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
                fields: 'files(id, name, parents, webViewLink)',
                supportsAllDrives: true,
                includeItemsFromAllDrives: true,
                corpora: 'allDrives',
                pageSize: 20,
            });
            const files2 = response2.data.files || [];
            console.log(`結果: ${files2.length}個のフォルダ`);
            files2.forEach((f, i) => console.log(`  ${i + 1}. ${f.name} (${f.id})`));
        }
        catch (error) {
            console.error(`エラー: ${error.message}`);
        }
        console.log('');
        // パターン3: corporaを"user"に変更
        console.log('📋 パターン3: corpora = "user"');
        try {
            const response3 = await drive.files.list({
                q: `name contains '${searchTerm}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
                fields: 'files(id, name, parents, webViewLink)',
                supportsAllDrives: true,
                includeItemsFromAllDrives: true,
                corpora: 'user',
                pageSize: 20,
            });
            const files3 = response3.data.files || [];
            console.log(`結果: ${files3.length}個のフォルダ`);
            files3.forEach((f, i) => console.log(`  ${i + 1}. ${f.name} (${f.id})`));
        }
        catch (error) {
            console.error(`エラー: ${error.message}`);
        }
        console.log('');
        // パターン4: corporaなし
        console.log('📋 パターン4: corporaなし');
        try {
            const response4 = await drive.files.list({
                q: `name contains '${searchTerm}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
                fields: 'files(id, name, parents, webViewLink)',
                supportsAllDrives: true,
                includeItemsFromAllDrives: true,
                pageSize: 20,
            });
            const files4 = response4.data.files || [];
            console.log(`結果: ${files4.length}個のフォルダ`);
            files4.forEach((f, i) => console.log(`  ${i + 1}. ${f.name} (${f.id})`));
        }
        catch (error) {
            console.error(`エラー: ${error.message}`);
        }
        console.log('');
        console.log('='.repeat(60));
        console.log('診断完了');
        console.log('='.repeat(60));
    }
    catch (error) {
        console.error('❌ エラーが発生しました:', error.message);
        console.error(error);
    }
}
const searchTerm = process.argv[2] || 'AA13069';
diagnoseSearchWithoutDriveId(searchTerm)
    .then(() => process.exit(0))
    .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
});
