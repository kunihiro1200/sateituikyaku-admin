import { Router, Request, Response } from 'express';
import multer, { FileFilterCallback } from 'multer';
import { GoogleDriveService } from '../services/GoogleDriveService';
import { authenticate } from '../middleware/auth';
import { BaseRepository } from '../repositories/BaseRepository';
import { decrypt } from '../utils/encryption';

const router = Router();
const driveService = new GoogleDriveService();

// ファイルアップロード用のmulter設定
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB制限
  },
  fileFilter: (_req: Request, file: Express.Multer.File, cb: FileFilterCallback) => {
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
    } else {
      cb(new Error('許可されていないファイル形式です。PDF、JPEG、PNG、GIF、WebPのみアップロード可能です。'));
    }
  },
});

/**
 * GET /api/drive/folders/contents
 * フォルダの内容を取得（フォルダとファイルの一覧）
 * NOTE: This route must be defined BEFORE /folders/:sellerNumber to avoid path conflicts
 */
router.get('/folders/contents', authenticate, async (req: Request, res: Response) => {
  try {
    const { folderId } = req.query;
    
    console.log('📁 Listing folder contents:', { folderId });

    const result = await driveService.listFolderContents(folderId as string | null);
    
    console.log(`✅ Found ${result.files.length} items`);
    
    res.json(result);
  } catch (error: any) {
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
 * GET /api/drive/debug
 * デバッグ: 共有ドライブへのアクセス確認
 */
router.get('/debug', authenticate, async (req: Request, res: Response) => {
  try {
    const { google } = require('googleapis');
    const parentFolderId = process.env.GOOGLE_DRIVE_PARENT_FOLDER_ID || '';
    const sharedDriveId = process.env.GOOGLE_SHARED_DRIVE_ID || '';
    
    let keyFile: any;
    if (process.env.GOOGLE_SERVICE_ACCOUNT_JSON) {
      keyFile = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON);
      if (keyFile.private_key) keyFile.private_key = keyFile.private_key.replace(/\\n/g, '\n');
    }
    
    const auth = new google.auth.GoogleAuth({
      credentials: keyFile,
      scopes: ['https://www.googleapis.com/auth/drive'],
    });
    const authClient = await auth.getClient();
    const drive = google.drive({ version: 'v3', auth: authClient });
    
    // 1. 共有ドライブ一覧を取得
    const drivesRes = await drive.drives.list({ pageSize: 10 });
    
    // 2. 親フォルダの情報を取得
    let folderInfo = null;
    try {
      const folderRes = await drive.files.get({
        fileId: parentFolderId,
        fields: 'id, name, parents',
        supportsAllDrives: true,
      });
      folderInfo = folderRes.data;
    } catch (e: any) {
      folderInfo = { error: e.message };
    }
    
    res.json({
      parentFolderId,
      sharedDriveId,
      serviceAccountEmail: keyFile?.client_email,
      drives: drivesRes.data.drives,
      folderInfo,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message, stack: error.stack });
  }
});

/**
 * GET /api/drive/folders/:sellerNumber
 * 売主フォルダの情報を取得（存在しない場合は作成）
 */
router.get('/folders/:sellerNumber', authenticate, async (req: Request, res: Response) => {
  try {
    const { sellerNumber } = req.params;

    if (!sellerNumber) {
      return res.status(400).json({ error: '売主番号が必要です' });
    }

    // 売主情報を取得（物件住所と依頼者名も含む）
    const baseRepo = new BaseRepository();
    const { data: seller, error: sellerError } = await (baseRepo as any).table('sellers')
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
        sellerName = decrypt(seller.name);
      } catch {
        // 復号化に失敗した場合はそのまま使用（暗号化されていない可能性）
        sellerName = seller.name;
      }
    }

    const folder = await driveService.getOrCreateSellerFolder(
      seller.id, 
      sellerNumber,
      propertyAddress,
      sellerName
    );
    
    res.json(folder);
  } catch (error: any) {
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
router.post('/folders/:sellerNumber/files', authenticate, upload.single('file'), async (req: Request & { file?: Express.Multer.File }, res: Response) => {
  try {
    const { sellerNumber } = req.params;
    const file = (req as Request & { file?: Express.Multer.File }).file;

    if (!sellerNumber) {
      return res.status(400).json({ error: '売主番号が必要です' });
    }

    if (!file) {
      return res.status(400).json({ error: 'ファイルが必要です' });
    }

    // 売主情報を取得（物件住所と依頼者名も含む）
    const baseRepo = new BaseRepository();
    const { data: seller, error: sellerError } = await (baseRepo as any).table('sellers')
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
        sellerName = decrypt(seller.name);
      } catch {
        // 復号化に失敗した場合はそのまま使用（暗号化されていない可能性）
        sellerName = seller.name;
      }
    }

    // フォルダを取得または作成
    const folder = await driveService.getOrCreateSellerFolder(
      seller.id, 
      sellerNumber,
      propertyAddress,
      sellerName
    );
    
    // ファイル名を取得
    // フォームデータから送信されたfileNameを優先（UTF-8エンコード済み）
    // multerのoriginalname はLatin-1でエンコードされるため日本語が文字化けする
    let fileName = req.body.fileName || file.originalname;
    
    // originalname がLatin-1でエンコードされている場合、UTF-8にデコード
    if (!req.body.fileName && file.originalname) {
      try {
        // Latin-1 → Buffer → UTF-8 変換
        fileName = Buffer.from(file.originalname, 'latin1').toString('utf8');
      } catch (e) {
        // 変換に失敗した場合はそのまま使用
        fileName = file.originalname;
      }
    }
    
    console.log(`📁 Uploading file: "${fileName}" (original: "${file.originalname}")`);
    
    // ファイルをアップロード
    const uploadedFile = await driveService.uploadFile(
      folder.folderId,
      file.buffer,
      fileName,
      file.mimetype
    );

    res.json({ file: uploadedFile });
  } catch (error: any) {
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
router.delete('/files/:fileId', authenticate, async (req: Request, res: Response) => {
  try {
    const { fileId } = req.params;

    if (!fileId) {
      return res.status(400).json({ error: 'ファイルIDが必要です' });
    }

    await driveService.deleteFile(fileId);
    
    res.json({ success: true });
  } catch (error: any) {
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
router.get('/folders/:folderId/path', authenticate, async (req: Request, res: Response) => {
  try {
    const { folderId } = req.params;

    if (!folderId) {
      return res.status(400).json({ error: 'フォルダIDが必要です' });
    }

    const path = await driveService.getFolderPath(folderId);
    
    res.json({ path });
  } catch (error: any) {
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

export default router;
