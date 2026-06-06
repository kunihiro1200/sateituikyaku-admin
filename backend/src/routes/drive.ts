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
    fileSize: 10 * 1024 * 1024, // 10MB制限/ファイル
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
 * POST /api/drive/folders/:sellerNumber/files/batch
 * 複数ファイルを一括アップロード（並列処理）
 * フォルダ作成は1回だけ実行し、全ファイルを並列でアップロードする
 * NOTE: /files より先に定義しないと /files ルートにマッチしてしまう
 */
router.post('/folders/:sellerNumber/files/batch', authenticate, upload.array('files', 20), async (req: Request & { files?: Express.Multer.File[] }, res: Response) => {
  try {
    const { sellerNumber } = req.params;
    const files = (req as Request & { files?: Express.Multer.File[] }).files;

    if (!sellerNumber) {
      return res.status(400).json({ error: '売主番号が必要です' });
    }

    if (!files || files.length === 0) {
      return res.status(400).json({ error: 'ファイルが必要です' });
    }

    // 売主情報を取得（フォルダ作成に必要なため1回だけ実行）
    const baseRepo = new BaseRepository();
    let seller: any = null;
    let sellerError: any = null;

    const result1 = await (baseRepo as any).table('sellers')
      .select('id, name, property_address')
      .eq('seller_number', sellerNumber)
      .single();
    seller = result1.data;
    sellerError = result1.error;

    if (sellerError || !seller) {
      const result2 = await (baseRepo as any).table('property_listings')
        .select('property_number, address')
        .eq('property_number', sellerNumber)
        .single();
      if (!result2.error && result2.data) {
        seller = {
          id: result2.data.property_number,
          name: null,
          property_address: result2.data.address || '',
        };
        sellerError = null;
      }
    }

    if (sellerError || !seller) {
      return res.status(404).json({ error: '売主が見つかりません' });
    }

    const propertyAddress = seller.property_address || '';
    let sellerName = '';
    if (seller.name) {
      try {
        sellerName = decrypt(seller.name);
      } catch {
        sellerName = seller.name;
      }
    }

    // フォルダ取得または作成（1回だけ）
    const folder = await driveService.getOrCreateSellerFolder(
      seller.id,
      sellerNumber,
      propertyAddress,
      sellerName
    );

    // fileNames はJSON文字列の配列で送られてくる想定（UTF-8ファイル名保持のため）
    let fileNames: string[] = [];
    try {
      fileNames = JSON.parse(req.body.fileNames || '[]');
    } catch {
      fileNames = [];
    }

    // 全ファイルを並列アップロード
    const results = await Promise.allSettled(
      files.map(async (file, index) => {
        let fileName = fileNames[index] || file.originalname;
        // multerのoriginalname はLatin-1エンコードのため変換
        if (!fileNames[index] && file.originalname) {
          try {
            fileName = Buffer.from(file.originalname, 'latin1').toString('utf8');
          } catch {
            fileName = file.originalname;
          }
        }

        console.log(`📁 Batch uploading file [${index + 1}/${files.length}]: "${fileName}"`);
        const uploadedFile = await driveService.uploadFile(
          folder.folderId,
          file.buffer,
          fileName,
          file.mimetype
        );
        return { fileName, file: uploadedFile };
      })
    );

    const succeeded = results
      .filter((r): r is PromiseFulfilledResult<any> => r.status === 'fulfilled')
      .map((r) => r.value);

    const failed = results
      .filter((r): r is PromiseRejectedResult => r.status === 'rejected')
      .map((r, i) => ({ fileName: fileNames[i] || `ファイル${i + 1}`, reason: r.reason?.message || 'アップロード失敗' }));

    return res.json({
      success: true,
      uploaded: succeeded.length,
      failed: failed.length,
      files: succeeded.map((s) => s.file),
      errors: failed,
    });
  } catch (error: any) {
    console.error('Error batch uploading files:', error);

    if (error.message === 'GOOGLE_AUTH_REQUIRED') {
      return res.status(401).json({
        error: 'Google認証が必要です',
        code: 'GOOGLE_AUTH_REQUIRED',
      });
    }

    res.status(500).json({ error: error.message || 'ファイルのアップロードに失敗しました' });
  }
});


/**
 * POST /api/drive/folders/:sellerNumber/files
 * ファイルを1件アップロード（後方互換用）
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
    let seller: any = null;
    let sellerError: any = null;

    // まず sellers テーブルで seller_number 検索
    const result1 = await (baseRepo as any).table('sellers')
      .select('id, name, property_address')
      .eq('seller_number', sellerNumber)
      .single();
    seller = result1.data;
    sellerError = result1.error;

    // 見つからない場合は property_listings テーブルから検索してフォールバック
    if (sellerError || !seller) {
      const result2 = await (baseRepo as any).table('property_listings')
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
 * GET /api/drive/search?q=keyword&rootFolderId=xxx
 * 指定フォルダ配下をGoogle Drive APIで全文検索（サブフォルダも含む）
 */
router.get('/search', authenticate, async (req: Request, res: Response) => {
  try {
    const { q, rootFolderId } = req.query as { q?: string; rootFolderId?: string };
    if (!q || q.trim() === '') {
      return res.status(400).json({ error: '検索キーワードを入力してください' });
    }

    const result = await driveService.searchFiles(q.trim(), rootFolderId || null);
    return res.json(result);
  } catch (error: any) {
    console.error('[drive/search] エラー:', error.message);
    return res.status(500).json({ error: error.message || '検索に失敗しました' });
  }
});

/**
 * GET /api/drive/files/:fileId/base64
 * ファイルのBase64データを返す（公課証明比較・建築概要書解析などAI解析用）
 */
router.get('/files/:fileId/base64', authenticate, async (req: Request, res: Response) => {
  try {
    const { fileId } = req.params;
    if (!fileId) return res.status(400).json({ error: 'fileIdが必要です' });

    const fileData = await driveService.getFile(fileId);
    if (!fileData) return res.status(404).json({ error: 'ファイルが見つかりません' });

    const base64 = fileData.data.toString('base64');
    return res.json({ success: true, base64, mimeType: fileData.mimeType });
  } catch (error: any) {
    console.error('[drive/base64] エラー:', error.message);
    return res.status(500).json({ error: error.message || 'ファイル取得に失敗しました' });
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
