import { Router, Request, Response } from 'express';
import { SharedItemsService } from '../services/SharedItemsService';
import multer from 'multer';
import { createClient } from '@supabase/supabase-js';

const router = Router();
const sharedItemsService = new SharedItemsService();

// multer のメモリストレージ設定（ファイルをバッファとして保持）
const storage = multer.memoryStorage();
const upload = multer({ storage });

// サービスの初期化
let initialized = false;
async function ensureInitialized() {
  if (!initialized) {
    await sharedItemsService.initialize();
    initialized = true;
  }
}

/**
 * GET /api/shared-items - 全件取得
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    await ensureInitialized();
    const items = await sharedItemsService.getAll();
    const sortedItems = sharedItemsService.sortItems(items);
    res.json({ data: sortedItems });
  } catch (error: any) {
    console.error('Failed to fetch shared items:', error);
    res.status(500).json({
      error: '共有データの取得に失敗しました',
      details: error.message
    });
  }
});

/**
 * GET /api/shared-items/categories - カテゴリー一覧取得
 */
router.get('/categories', async (req: Request, res: Response) => {
  try {
    await ensureInitialized();
    const categories = await sharedItemsService.getCategories();
    res.json({ data: categories });
  } catch (error: any) {
    console.error('Failed to fetch categories:', error);
    res.status(500).json({
      error: 'カテゴリーの取得に失敗しました',
      details: error.message
    });
  }
});

/**
 * GET /api/shared-items/staff - 通常スタッフ取得
 */
router.get('/staff', async (req: Request, res: Response) => {
  try {
    const supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { data: staff, error } = await supabase
      .from('employees')
      .select('name, is_normal')
      .eq('is_normal', true)
      .order('name');

    if (error) {
      throw error;
    }

    res.json({ data: staff || [] });
  } catch (error: any) {
    console.error('Failed to fetch staff:', error);
    res.status(500).json({
      error: 'スタッフ情報の取得に失敗しました',
      details: error.message
    });
  }
});

/**
 * POST /api/shared-items - 新規作成
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    await ensureInitialized();
    const item = await sharedItemsService.create(req.body);
    res.json({ data: item });
  } catch (error: any) {
    console.error('Failed to create shared item:', error);
    res.status(500).json({
      error: '共有データの作成に失敗しました',
      details: error.message
    });
  }
});

/**
 * POST /api/shared-items/upload - ファイルアップロード
 * multipart/form-data でファイルを受け取り、Supabase Storage にアップロードする
 * Request: multipart/form-data
 *   - file: アップロードするファイル（PDFまたは画像）
 *   - type: 'pdf' | 'image' - サブフォルダを決定するパラメータ
 * Response: { url: string } - アップロード後の公開URL
 */
router.post('/upload', upload.single('file'), async (req: Request, res: Response) => {
  try {
    // ファイルが存在しない場合は400エラーを返す
    if (!req.file) {
      return res.status(400).json({ error: 'ファイルが指定されていません' });
    }

    // type パラメータからサブフォルダを決定（'pdf' → 'pdfs/', 'image' → 'images/'）
    const type = req.body.type as 'pdf' | 'image';
    const folder = type === 'pdf' ? 'pdfs' : 'images';

    // ファイルパスを生成: {folder}/{timestamp}_{originalname}
    const timestamp = Date.now();
    const originalName = req.file.originalname;
    const filePath = `${folder}/${timestamp}_${originalName}`;

    // Supabase クライアントを初期化
    const supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Supabase Storage の shared-items バケットにファイルをアップロード
    const { error: uploadError } = await supabase.storage
      .from('shared-items')
      .upload(filePath, req.file.buffer, {
        contentType: req.file.mimetype,
        upsert: false,
      });

    if (uploadError) {
      console.error('Supabase Storage アップロードエラー:', uploadError);
      return res.status(500).json({
        error: 'ファイルのアップロードに失敗しました',
        details: uploadError.message,
      });
    }

    // アップロード後の公開URLを取得
    const { data: publicUrlData } = supabase.storage
      .from('shared-items')
      .getPublicUrl(filePath);

    res.json({ url: publicUrlData.publicUrl });
  } catch (error: any) {
    console.error('ファイルアップロード処理エラー:', error);
    res.status(500).json({
      error: 'ファイルのアップロードに失敗しました',
      details: error.message,
    });
  }
});

/**
 * PUT /api/shared-items/:id - 更新
 */
router.put('/:id', async (req: Request, res: Response) => {
  try {
    await ensureInitialized();
    const item = await sharedItemsService.update(req.params.id, req.body);
    res.json({ data: item });
  } catch (error: any) {
    console.error('Failed to update shared item:', error);
    res.status(500).json({
      error: '共有データの更新に失敗しました',
      details: error.message
    });
  }
});

/**
 * POST /api/shared-items/:id/staff-confirmation - スタッフ確認追加
 */
router.post('/:id/staff-confirmation', async (req: Request, res: Response) => {
  try {
    await ensureInitialized();
    const { staffName } = req.body;

    if (!staffName) {
      return res.status(400).json({ error: 'スタッフ名が指定されていません' });
    }

    await sharedItemsService.addStaffConfirmation(req.params.id, staffName);
    res.json({ success: true });
  } catch (error: any) {
    console.error('Failed to add staff confirmation:', error);
    res.status(500).json({
      error: 'スタッフ確認の追加に失敗しました',
      details: error.message
    });
  }
});

/**
 * POST /api/shared-items/:id/mark-confirmed - スタッフ確認完了
 */
router.post('/:id/mark-confirmed', async (req: Request, res: Response) => {
  try {
    await ensureInitialized();
    const { staffName } = req.body;

    if (!staffName) {
      return res.status(400).json({ error: 'スタッフ名が指定されていません' });
    }

    await sharedItemsService.markStaffConfirmed(req.params.id, staffName);
    res.json({ success: true });
  } catch (error: any) {
    console.error('Failed to mark staff confirmed:', error);
    res.status(500).json({
      error: 'スタッフ確認完了の設定に失敗しました',
      details: error.message
    });
  }
});

export default router;
