import { Router, Request, Response } from 'express';
import { SharedItemsService } from '../services/SharedItemsService';
import { EmailService } from '../services/EmailService';
import multer from 'multer';
import { createClient } from '@supabase/supabase-js';

const router = Router();
const sharedItemsService = new SharedItemsService();
const emailService = new EmailService();

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
      process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY!
    );

    const { data: staff, error } = await supabase
      .from('employees')
      .select('name, initials, is_active')
      .eq('is_active', true)
      .neq('name', '')
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

    // ファイルパスを生成: {folder}/{timestamp}_{sanitized_filename}
    // 日本語などのマルチバイト文字はSupabase StorageでInvalid keyになるため、
    // ファイル名をサニタイズして英数字とハイフン・ドットのみにする
    const timestamp = Date.now();
    const originalName = req.file.originalname;
    const ext = originalName.includes('.') ? '.' + originalName.split('.').pop() : '';
    const baseName = originalName.slice(0, originalName.length - ext.length);
    const safeName = baseName.replace(/[^a-zA-Z0-9_-]/g, '_').replace(/^_+|_+$/g, '') || 'file';
    const filePath = `${folder}/${timestamp}_${safeName}${ext}`;

    // Supabase クライアントを初期化
    const supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY!
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
 * 「共有できていないスタッフ」に新たに追加されたスタッフがいて、かつ「確認日」が空欄の場合、
 * そのスタッフのメールアドレスに朝礼共有事項の通知メールを送信する
 */
router.put('/:id', async (req: Request, res: Response) => {
  try {
    await ensureInitialized();

    const itemId = req.params.id;
    const updates = req.body;

    // 更新前の現在データを取得して「共有できていないスタッフ」の変化を検知
    const newStaffNotShared: string = updates['共有できていない'] || updates['staff_not_shared'] || '';
    const newConfirmationDate: string = updates['確認日'] || updates['confirmation_date'] || '';

    // 確認日が空欄の場合のみメール送信を検討
    if (!newConfirmationDate) {
      try {
        // 現在のデータを取得して以前の「共有できていないスタッフ」を確認
        const allItems = await sharedItemsService.getAll();
        const currentItem = allItems.find((i) => i.id === itemId);
        const previousStaffNotShared: string = currentItem?.['共有できていない'] || currentItem?.staff_not_shared || '';

        const previousNames = previousStaffNotShared
          ? previousStaffNotShared.split(',').map((s: string) => s.trim()).filter(Boolean)
          : [];
        const newNames = newStaffNotShared
          ? newStaffNotShared.split(',').map((s: string) => s.trim()).filter(Boolean)
          : [];

        // 新たに追加されたスタッフ名を特定（以前は入っていなかった名前）
        const addedStaffNames = newNames.filter((name) => !previousNames.includes(name));

        if (addedStaffNames.length > 0) {
          // Supabaseからスタッフのメールアドレスを取得
          const supabase = createClient(
            process.env.SUPABASE_URL!,
            process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY!
          );

          const { data: employees } = await supabase
            .from('employees')
            .select('name, email')
            .in('name', addedStaffNames)
            .eq('is_active', true);

          const emailAddresses = (employees || [])
            .map((e: { name: string; email: string }) => e.email)
            .filter((email: string) => email && email.includes('@'));

          if (emailAddresses.length > 0) {
            // フロントエンドの詳細画面URL
            const frontendBaseUrl = process.env.NODE_ENV === 'production'
              ? 'https://sateituikyaku-admin-frontend.vercel.app'
              : (process.env.FRONTEND_URL?.split(',')[0] || 'http://localhost:5173');
            const detailUrl = `${frontendBaseUrl}/shared-items/${itemId}`;

            await emailService.sendEmail({
              to: emailAddresses,
              subject: '朝礼での共有事項があります。ご確認お願い致します。',
              body: `本日の朝礼で下記の共有事項がありましたので、確認お願いします。\n\n${detailUrl}`,
            });

            console.log(`[sharedItems] 朝礼共有通知メール送信: ${emailAddresses.join(', ')} (スタッフ: ${addedStaffNames.join(', ')})`);
          }
        }
      } catch (emailError: any) {
        // メール送信失敗は保存処理を止めない
        console.error('[sharedItems] メール送信エラー（保存は続行）:', emailError.message);
      }
    }

    const item = await sharedItemsService.update(itemId, updates);
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
