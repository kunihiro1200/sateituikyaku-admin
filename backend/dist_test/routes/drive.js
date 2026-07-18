"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const multer_1 = __importDefault(require("multer"));
const GoogleDriveService_1 = require("../services/GoogleDriveService");
const auth_1 = require("../middleware/auth");
const BaseRepository_1 = require("../repositories/BaseRepository");
const encryption_1 = require("../utils/encryption");
const router = (0, express_1.Router)();
const driveService = new GoogleDriveService_1.GoogleDriveService();
// ファイルアップロード用のmulter設定
const upload = (0, multer_1.default)({
    storage: multer_1.default.memoryStorage(),
    limits: {
        fileSize: 10 * 1024 * 1024, // 10MB制限
    },
    fileFilter: (_req, file, cb) => {
        // PDFと画像ファイルのみ許可
        const allowedMimes = [
            'application/pdf',
            'image/jpeg',
            'image/png',
            'image/gif',
            'image/webp',
        ];
        if (allowedMimes.includes(file.mimetype)) {
            cb(null, true);
        }
        else {
            cb(new Error('許可されていないファイル形式です。PDF、JPEG、PNG、GIF、WebPのみアップロード可能です。'));
        }
    },
});
/**
 * GET /api/drive/folders/contents
 * フォルダの内容を取得（フォルダとファイルの一覧）
 * NOTE: This route must be defined BEFORE /folders/:sellerNumber to avoid path conflicts
 */
router.get('/folders/contents', auth_1.authenticate, async (req, res) => {
    try {
        const { folderId } = req.query;
        console.log('📁 Listing folder contents:', { folderId });
        const result = await driveService.listFolderContents(folderId);
        console.log(`✅ Found ${result.files.length} items`);
        res.json(result);
    }
    catch (error) {
        console.error('❌ Error listing folder contents:', error);
        console.error('Error details:', {
            message: error.message,
            stack: error.stack,
            response: error.response?.data
        });
        if (error.message === 'GOOGLE_AUTH_REQUIRED') {
            return res.status(401).json({
                error: 'Google認証が必要です',
                code: 'GOOGLE_AUTH_REQUIRED'
            });
        }
        res.status(500).json({
            error: {
                message: error.message || 'フォルダ内容の取得に失敗しました',
                details: error.response?.data || error.toString()
            }
        });
    }
});
/**
 * GET /api/drive/folders/:sellerNumber
 * 売主フォルダの情報を取得（存在しない場合は作成）
 */
router.get('/folders/:sellerNumber', auth_1.authenticate, async (req, res) => {
    try {
        const { sellerNumber } = req.params;
        if (!sellerNumber) {
            return res.status(400).json({ error: '売主番号が必要です' });
        }
        // 売主情報を取得（物件住所と依頼者名も含む）
        const baseRepo = new BaseRepository_1.BaseRepository();
        const { data: seller, error: sellerError } = await baseRepo.table('sellers')
            .select('id, name, property_address')
            .eq('seller_number', sellerNumber)
            .single();
        if (sellerError || !seller) {
            console.error('Seller not found:', { sellerNumber, error: sellerError });
            return res.status(404).json({ error: '売主が見つかりません' });
        }
        // 物件住所を取得（sellersテーブルのproperty_addressカラムから直接取得）
        const propertyAddress = seller.property_address || '';
        // 依頼者名を復号化（暗号化されている場合）
        let sellerName = '';
        if (seller.name) {
            try {
                sellerName = (0, encryption_1.decrypt)(seller.name);
            }
            catch {
                // 復号化に失敗した場合はそのまま使用（暗号化されていない可能性）
                sellerName = seller.name;
            }
        }
        const folder = await driveService.getOrCreateSellerFolder(seller.id, sellerNumber, propertyAddress, sellerName);
        res.json(folder);
    }
    catch (error) {
        console.error('Error getting seller folder:', error);
        if (error.message === 'GOOGLE_AUTH_REQUIRED') {
            return res.status(401).json({
                error: 'Google認証が必要です',
                code: 'GOOGLE_AUTH_REQUIRED'
            });
        }
        res.status(500).json({ error: error.message || 'フォルダの取得に失敗しました' });
    }
});
/**
 * POST /api/drive/folders/:sellerNumber/files
 * ファイルをアップロード
 */
router.post('/folders/:sellerNumber/files', auth_1.authenticate, upload.single('file'), async (req, res) => {
    try {
        const { sellerNumber } = req.params;
        const file = req.file;
        if (!sellerNumber) {
            return res.status(400).json({ error: '売主番号が必要です' });
        }
        if (!file) {
            return res.status(400).json({ error: 'ファイルが必要です' });
        }
        // 売主情報を取得（物件住所と依頼者名も含む）
        const baseRepo = new BaseRepository_1.BaseRepository();
        let seller = null;
        let sellerError = null;
        // まず sellers テーブルで seller_number 検索
        const result1 = await baseRepo.table('sellers')
            .select('id, name, property_address')
            .eq('seller_number', sellerNumber)
            .single();
        seller = result1.data;
        sellerError = result1.error;
        // 見つからない場合は property_listings テーブルから検索してフォールバック
        if (sellerError || !seller) {
            const result2 = await baseRepo.table('property_listings')
                .select('property_number, address')
                .eq('property_number', sellerNumber)
                .single();
            if (!result2.error && result2.data) {
                // property_listings から仮の seller オブジェクトを構築
                seller = {
                    id: result2.data.property_number,
                    name: null,
                    property_address: result2.data.address || '',
                };
                sellerError = null;
            }
        }
        if (sellerError || !seller) {
            console.error('Seller not found:', { sellerNumber, error: sellerError });
            return res.status(404).json({ error: '売主が見つかりません' });
        }
        // 物件住所を取得（sellersテーブルのproperty_addressカラムから直接取得）
        const propertyAddress = seller.property_address || '';
        // 依頼者名を復号化（暗号化されている場合）
        let sellerName = '';
        if (seller.name) {
            try {
                sellerName = (0, encryption_1.decrypt)(seller.name);
            }
            catch {
                // 復号化に失敗した場合はそのまま使用（暗号化されていない可能性）
                sellerName = seller.name;
            }
        }
        // フォルダを取得または作成
        const folder = await driveService.getOrCreateSellerFolder(seller.id, sellerNumber, propertyAddress, sellerName);
        // ファイル名を取得
        // フォームデータから送信されたfileNameを優先（UTF-8エンコード済み）
        // multerのoriginalname はLatin-1でエンコードされるため日本語が文字化けする
        let fileName = req.body.fileName || file.originalname;
        // originalname がLatin-1でエンコードされている場合、UTF-8にデコード
        if (!req.body.fileName && file.originalname) {
            try {
                // Latin-1 → Buffer → UTF-8 変換
                fileName = Buffer.from(file.originalname, 'latin1').toString('utf8');
            }
            catch (e) {
                // 変換に失敗した場合はそのまま使用
                fileName = file.originalname;
            }
        }
        console.log(`📁 Uploading file: "${fileName}" (original: "${file.originalname}")`);
        // ファイルをアップロード
        const uploadedFile = await driveService.uploadFile(folder.folderId, file.buffer, fileName, file.mimetype);
        res.json({ file: uploadedFile });
    }
    catch (error) {
        console.error('Error uploading file:', error);
        if (error.message === 'GOOGLE_AUTH_REQUIRED') {
            return res.status(401).json({
                error: 'Google認証が必要です',
                code: 'GOOGLE_AUTH_REQUIRED'
            });
        }
        if (error.message?.includes('許可されていないファイル形式')) {
            return res.status(400).json({ error: error.message });
        }
        res.status(500).json({ error: error.message || 'ファイルのアップロードに失敗しました' });
    }
});
/**
 * DELETE /api/drive/files/:fileId
 * ファイルを削除
 */
router.delete('/files/:fileId', auth_1.authenticate, async (req, res) => {
    try {
        const { fileId } = req.params;
        if (!fileId) {
            return res.status(400).json({ error: 'ファイルIDが必要です' });
        }
        await driveService.deleteFile(fileId);
        res.json({ success: true });
    }
    catch (error) {
        console.error('Error deleting file:', error);
        if (error.message === 'GOOGLE_AUTH_REQUIRED') {
            return res.status(401).json({
                error: 'Google認証が必要です',
                code: 'GOOGLE_AUTH_REQUIRED'
            });
        }
        res.status(500).json({ error: error.message || 'ファイルの削除に失敗しました' });
    }
});
/**
 * GET /api/drive/folders/:folderId/path
 * フォルダのパスを取得（ルートからのパンくずリスト）
 */
router.get('/folders/:folderId/path', auth_1.authenticate, async (req, res) => {
    try {
        const { folderId } = req.params;
        if (!folderId) {
            return res.status(400).json({ error: 'フォルダIDが必要です' });
        }
        const path = await driveService.getFolderPath(folderId);
        res.json({ path });
    }
    catch (error) {
        console.error('Error getting folder path:', error);
        if (error.message === 'GOOGLE_AUTH_REQUIRED') {
            return res.status(401).json({
                error: 'Google認証が必要です',
                code: 'GOOGLE_AUTH_REQUIRED'
            });
        }
        res.status(500).json({ error: error.message || 'フォルダパスの取得に失敗しました' });
    }
});
exports.default = router;
