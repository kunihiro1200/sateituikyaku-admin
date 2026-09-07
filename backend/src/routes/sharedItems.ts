import { Router, Request, Response } from 'express';
import { SharedItemsService } from '../services/SharedItemsService';
import { SharedItemImageCommentsService } from '../services/SharedItemImageCommentsService';
import { SharedItemImagesService } from '../services/SharedItemImagesService';
import { EmailService } from '../services/EmailService';
import multer from 'multer';
import { createClient } from '@supabase/supabase-js';
import pool from '../config/database';

const router = Router();
const sharedItemsService = new SharedItemsService();
const imageCommentsService = new SharedItemImageCommentsService();
const imagesService = new SharedItemImagesService();
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
      .not('initials', 'in', '(IF,業者)') // 特殊なスタッフを除外
      .not('initials', 'is', null) // initialsがnullのスタッフを除外
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
          ? previousStaffNotShared.split(/[,\s　]+/).map((s: string) => s.trim()).filter(Boolean)
          : [];
        const newNames = newStaffNotShared
          ? newStaffNotShared.split(/[,\s　]+/).map((s: string) => s.trim()).filter(Boolean)
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
 * DELETE /api/shared-items/:id - 削除
 */
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    await ensureInitialized();
    await sharedItemsService.delete(req.params.id);
    // チームアンサーも削除（存在する場合）
    try {
      const supabase = createClient(
        process.env.SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY!
      );
      await supabase.from('shared_item_team_answers').delete().eq('shared_item_id', req.params.id);
    } catch (e) {
      // チームアンサー削除失敗は無視
    }
    res.json({ success: true });
  } catch (error: any) {
    console.error('Failed to delete shared item:', error);
    res.status(500).json({
      error: '共有データの削除に失敗しました',
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

/**
 * GET /api/shared-items/:id/team-answers - チームアンサー取得
 */
router.get('/:id/team-answers', async (req: Request, res: Response) => {
  try {
    const supabaseUrl = process.env.SUPABASE_URL!;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY!;
    const axios = (await import('axios')).default;
    const response = await axios.get(
      `${supabaseUrl}/rest/v1/shared_item_team_answers?shared_item_id=eq.${encodeURIComponent(req.params.id)}&limit=1`,
      { headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}`, Accept: 'application/json' } }
    );
    const rows = response.data;
    res.json({ data: rows.length > 0 ? rows[0] : null });
  } catch (error: any) {
    console.error('Failed to fetch team answers:', error);
    res.status(500).json({ error: 'チームアンサーの取得に失敗しました', details: error.message });
  }
});

/**
 * PUT /api/shared-items/:id/team-answers - チームアンサー保存
 */
router.put('/:id/team-answers', async (req: Request, res: Response) => {
  try {
    const supabaseUrl = process.env.SUPABASE_URL!;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY!;
    const axios = (await import('axios')).default;
    const sharedItemId = req.params.id;
    const { question, answer_kuniHiro, answer_yamamoto, answer_ura, answer_kadoi, answer_hayashida, answer_aso, summary } = req.body;
    const fields = {
      shared_item_id: sharedItemId,
      question: question ?? null,
      answer_kunihiro: answer_kuniHiro ?? null,
      answer_yamamoto: answer_yamamoto ?? null,
      answer_ura: answer_ura ?? null,
      answer_kadoi: answer_kadoi ?? null,
      answer_hayashida: answer_hayashida ?? null,
      answer_aso: answer_aso ?? null,
      summary: summary ?? null,
      updated_at: new Date().toISOString(),
    };
    const headers = {
      apikey: supabaseKey,
      Authorization: `Bearer ${supabaseKey}`,
      'Content-Type': 'application/json',
      Prefer: 'resolution=merge-duplicates,return=representation',
    };
    // upsert via POST with on_conflict
    const upsertResp = await axios.post(
      `${supabaseUrl}/rest/v1/shared_item_team_answers?on_conflict=shared_item_id`,
      fields,
      { headers }
    );
    res.json({ data: Array.isArray(upsertResp.data) ? upsertResp.data[0] : upsertResp.data });
  } catch (error: any) {
    console.error('Failed to save team answers:', error);
    res.status(500).json({ error: 'チームアンサーの保存に失敗しました', details: error.response?.data || error.message });
  }
});

/**
 * POST /api/shared-items/:id/team-answers/toggle-visibility - チームアンサーの公開状態切り替え
 */
router.post('/:id/team-answers/toggle-visibility', async (req: Request, res: Response) => {
  try {
    const supabaseUrl = process.env.SUPABASE_URL!;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY!;
    const axios = (await import('axios')).default;
    const sharedItemId = req.params.id;
    const { member, isVisible } = req.body;

    // メンバー名からカラム名にマッピング
    const visibilityColumnMap: Record<string, string> = {
      '国広': 'is_kunihiro_visible',
      '山本': 'is_yamamoto_visible',
      '裏': 'is_ura_visible',
      '角井': 'is_kadoi_visible',
      '林田': 'is_hayashida_visible',
      '麻生': 'is_aso_visible',
    };

    const columnName = visibilityColumnMap[member];
    if (!columnName) {
      return res.status(400).json({ error: '不正なメンバー名です' });
    }

    console.log(`[DEBUG BACKEND] member: ${member}, columnName: ${columnName}, isVisible: ${isVisible}`);

    const headers = {
      apikey: supabaseKey,
      Authorization: `Bearer ${supabaseKey}`,
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
    };

    const updatePayload = { [columnName]: isVisible, updated_at: new Date().toISOString() };
    console.log(`[DEBUG BACKEND] updatePayload:`, updatePayload);

    // 既存レコードを更新
    const patchResponse = await axios.patch(
      `${supabaseUrl}/rest/v1/shared_item_team_answers?shared_item_id=eq.${encodeURIComponent(sharedItemId)}`,
      updatePayload,
      { headers }
    );

    console.log(`[DEBUG BACKEND] patchResponse.status:`, patchResponse.status);
    console.log(`[DEBUG BACKEND] patchResponse.data:`, patchResponse.data);

    // 更新後のデータを再取得
    const getResponse = await axios.get(
      `${supabaseUrl}/rest/v1/shared_item_team_answers?shared_item_id=eq.${encodeURIComponent(sharedItemId)}&limit=1`,
      { headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}`, Accept: 'application/json' } }
    );

    const updatedData = Array.isArray(getResponse.data) && getResponse.data.length > 0 
      ? getResponse.data[0] 
      : null;

    res.json({ data: updatedData });
  } catch (error: any) {
    console.error('Failed to toggle visibility:', error);
    res.status(500).json({ error: '公開状態の切り替えに失敗しました', details: error.response?.data || error.message });
  }
});

/**
 * POST /api/shared-items/bulk-toggle-visibility - 特定チームの自分の全案件を一括公開/非公開
 */
router.post('/bulk-toggle-visibility', async (req: Request, res: Response) => {
  try {
    const supabaseUrl = process.env.SUPABASE_URL!;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY!;
    const axios = (await import('axios')).default;
    const { member, isVisible, sharingLocation } = req.body;

    // メンバー名からカラム名にマッピング
    const visibilityColumnMap: Record<string, string> = {
      '国広': 'is_kunihiro_visible',
      '山本': 'is_yamamoto_visible',
      '裏': 'is_ura_visible',
      '角井': 'is_kadoi_visible',
      '林田': 'is_hayashida_visible',
      '麻生': 'is_aso_visible',
    };

    const columnName = visibilityColumnMap[member];
    if (!columnName) {
      return res.status(400).json({ error: '不正なメンバー名です' });
    }

    if (!sharingLocation || !['物件数チーム', '契約率チーム'].includes(sharingLocation)) {
      return res.status(400).json({ error: '不正な共有場です' });
    }

    console.log(`[BULK TOGGLE] member: ${member}, columnName: ${columnName}, isVisible: ${isVisible}, sharingLocation: ${sharingLocation}`);

    // 1. 対象チームの全shared_itemを取得
    const sharedItems = await sharedItemsService.getAll();
    const targetItems = sharedItems.filter((item: any) => item['共有場'] === sharingLocation);
    const targetIds = targetItems.map((item: any) => item.id);

    console.log(`[BULK TOGGLE] 対象案件数: ${targetIds.length}`);

    if (targetIds.length === 0) {
      return res.json({ success: true, updatedCount: 0, message: '対象案件がありません' });
    }

    // 2. 各shared_itemのteam_answersを一括更新
    const headers = {
      apikey: supabaseKey,
      Authorization: `Bearer ${supabaseKey}`,
      'Content-Type': 'application/json',
    };

    const updatePayload = { [columnName]: isVisible, updated_at: new Date().toISOString() };

    // shared_item_idがtargetIdsのいずれかに一致するレコードを一括更新
    // PostgREST の in. フィルタを使用
    const patchUrl = `${supabaseUrl}/rest/v1/shared_item_team_answers?shared_item_id=in.(${targetIds.map(id => `"${id}"`).join(',')})`;
    
    const patchResponse = await axios.patch(
      patchUrl,
      updatePayload,
      { headers }
    );

    console.log(`[BULK TOGGLE] patchResponse.status:`, patchResponse.status);
    console.log(`[BULK TOGGLE] 更新件数:`, patchResponse.data?.length || 0);

    res.json({ 
      success: true, 
      updatedCount: patchResponse.data?.length || 0,
      message: `${member}の${sharingLocation}の全案件を${isVisible ? '公開' : '非公開'}にしました`
    });
  } catch (error: any) {
    console.error('Failed to bulk toggle visibility:', error);
    res.status(500).json({ 
      error: '一括公開/非公開の切り替えに失敗しました', 
      details: error.response?.data || error.message 
    });
  }
});

/**
 * POST /api/shared-items/:id/send-chat - チャット送信
 * 共有場が「他」の場合に、Google Chatへメッセージを送信
 */
router.post('/:id/send-chat', async (req: Request, res: Response) => {
  try {
    await ensureInitialized();
    const itemId = req.params.id;
    const { scheduledDatetime, includeWarningText = true } = req.body; // 送信予定日時（オプション）、注意文含めるか（デフォルトtrue）

    // 共有アイテムを取得
    const allItems = await sharedItemsService.getAll();
    const item = allItems.find((i) => i.id === itemId);

    if (!item) {
      return res.status(404).json({ error: '共有アイテムが見つかりません' });
    }

    // 共有場が「他」であることを確認
    const sharingLocation = item['共有場'] || item.sharing_location;
    if (sharingLocation !== '他') {
      return res.status(400).json({ error: 'チャット送信は共有場が「他」の場合のみ利用できます' });
    }

    // 予定日時が指定されている場合は予約として保存
    if (scheduledDatetime) {
      // scheduled_chat_datetime を更新（実際の送信は cron で行う）
      const supabase = createClient(
        process.env.SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY!
      );

      const { error: updateError } = await supabase
        .from('shared_items')
        .update({ scheduled_chat_datetime: scheduledDatetime })
        .eq('id', itemId);

      if (updateError) {
        throw new Error(`予約送信の設定に失敗しました: ${updateError.message}`);
      }

      console.log(`[sharedItems] チャット予約送信を設定: ${itemId} → ${scheduledDatetime}`);
      return res.json({ 
        success: true, 
        scheduled: true,
        message: `${new Date(scheduledDatetime).toLocaleString('ja-JP')} に送信予定です` 
      });
    }

    // 即時送信の場合
    const { GoogleChatService } = await import('../services/GoogleChatService');
    const chatService = new GoogleChatService();

    // チャットWebhook URL
    const CHAT_WEBHOOK_URL = 'https://chat.googleapis.com/v1/spaces/AAAAlknS4P0/messages?key=AIzaSyDdI0hCZtE6vySjMm-WEfRq3CPzqKqqsHI&token=61OklKGHQpRoIFhiI00wGZPmcRHd4oY_BV47uQGMWbg';

    // メッセージ作成
    const title = item['タイトル'] || item.title || '（タイトルなし）';
    const content = item['内容'] || item.content || '';
    const pdfUrl = item['PDF'] || item.pdf_url || '';
    const imageUrl = item['画像'] || item.image_url || '';
    
    // フロントエンドの詳細画面URL
    const frontendBaseUrl = process.env.NODE_ENV === 'production'
      ? 'https://sateituikyaku-admin-frontend.vercel.app'
      : (process.env.FRONTEND_URL?.split(',')[0] || 'http://localhost:5173');
    const detailUrl = `${frontendBaseUrl}/shared-items/${itemId}`;

    let message = `【共有事項】\n`;
    message += `タイトル: ${title}\n\n`;
    message += `${content}\n\n`;
    
    // includeWarningTextがtrueの場合のみ注意文を含める
    if (includeWarningText) {
      message += `**「共有できていないスタッフ」の自分のアカウントにチェックして必ず保存してください**\n\n`;
    }
    
    message += `詳細: ${detailUrl}\n`;

    if (pdfUrl) {
      message += `\nPDF: ${pdfUrl}`;
    }
    if (imageUrl) {
      message += `\n画像: ${imageUrl}`;
    }

    // Google Chatに送信
    const result = await chatService.sendMessage(CHAT_WEBHOOK_URL, message);

    if (!result.success) {
      return res.status(500).json({ 
        success: false, 
        error: result.error || 'チャット送信に失敗しました' 
      });
    }

    // 送信成功 → chat_sent_at を記録
    const supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY!
    );

    const { error: updateError } = await supabase
      .from('shared_items')
      .update({ chat_sent_at: new Date().toISOString() })
      .eq('id', itemId);

    if (updateError) {
      console.error('[sharedItems] chat_sent_at更新エラー:', updateError.message);
      // 送信は成功しているのでエラーは無視
    }

    console.log(`[sharedItems] チャット送信成功: ${itemId}`);
    res.json({ success: true, scheduled: false, message: 'チャットを送信しました' });
  } catch (error: any) {
    console.error('[sharedItems] チャット送信エラー:', error.message);
    res.status(500).json({ 
      success: false, 
      error: error.message || 'チャット送信に失敗しました' 
    });
  }
});

/**
 * GET /api/shared-items/:id/image-comments - 画像コメント取得
 */
router.get('/:id/image-comments', async (req: Request, res: Response) => {
  try {
    const comments = await imageCommentsService.getComments(req.params.id);
    res.json({ data: comments });
  } catch (error: any) {
    console.error('Failed to fetch image comments:', error);
    res.status(500).json({ error: '画像コメントの取得に失敗しました' });
  }
});

/**
 * PUT /api/shared-items/:id/image-comments - 画像コメント保存
 */
router.put('/:id/image-comments', async (req: Request, res: Response) => {
  try {
    const { comments } = req.body;
    if (!comments || typeof comments !== 'object') {
      return res.status(400).json({ error: 'コメントデータが不正です' });
    }
    
    await imageCommentsService.saveComments(req.params.id, comments);
    res.json({ success: true });
  } catch (error: any) {
    console.error('Failed to save image comments:', error);
    res.status(500).json({ error: '画像コメントの保存に失敗しました' });
  }
});

/**
 * GET /api/shared-items/:id/images - 画像5〜10取得
 */
router.get('/:id/images', async (req: Request, res: Response) => {
  try {
    const images = await imagesService.getImages(req.params.id);
    res.json({ data: images });
  } catch (error: any) {
    console.error('Failed to fetch images:', error);
    res.status(500).json({ error: '画像の取得に失敗しました' });
  }
});

/**
 * PUT /api/shared-items/:id/images - 画像5〜10保存
 */
router.put('/:id/images', async (req: Request, res: Response) => {
  try {
    const { images } = req.body;
    if (!images || typeof images !== 'object') {
      return res.status(400).json({ error: '画像データが不正です' });
    }
    
    await imagesService.saveImages(req.params.id, images);
    res.json({ success: true });
  } catch (error: any) {
    console.error('Failed to save images:', error);
    res.status(500).json({ error: '画像の保存に失敗しました' });
  }
});

// ============================================================
// 未確認スタッフ管理（DB管理）
// ============================================================

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_KEY = () => process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY!;

/**
 * GET /api/shared-items/unconfirmed-summary
 * サイドバー用：スタッフごとの未確認件数を返す
 * [{ staffName: '山田', count: 3 }, ...]
 */
router.get('/unconfirmed-summary', async (req: Request, res: Response) => {
  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_KEY());
    const { data, error } = await supabase
      .from('shared_item_unconfirmed_staff')
      .select('staff_name');
    if (error) throw error;

    const map = new Map<string, number>();
    for (const row of data || []) {
      map.set(row.staff_name, (map.get(row.staff_name) || 0) + 1);
    }
    const summary = Array.from(map.entries())
      .sort((a, b) => a[0].localeCompare(b[0], 'ja'))
      .map(([staffName, count]) => ({ staffName, count }));

    res.json({ data: summary });
  } catch (error: any) {
    console.error('Failed to get unconfirmed summary:', error);
    res.status(500).json({ error: '未確認サマリーの取得に失敗しました', details: error.message });
  }
});

/**
 * GET /api/shared-items/unconfirmed-by-staff/:staffName
 * 特定スタッフの未確認アイテムID一覧を返す（フィルター用）
 */
router.get('/unconfirmed-by-staff/:staffName', async (req: Request, res: Response) => {
  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_KEY());
    const { data, error } = await supabase
      .from('shared_item_unconfirmed_staff')
      .select('shared_item_id')
      .eq('staff_name', decodeURIComponent(req.params.staffName));
    if (error) throw error;

    const itemIds = (data || []).map((r) => r.shared_item_id);
    res.json({ data: itemIds });
  } catch (error: any) {
    console.error('Failed to get unconfirmed item ids:', error);
    res.status(500).json({ error: '未確認アイテムIDの取得に失敗しました', details: error.message });
  }
});

/**
 * GET /api/shared-items/:id/unconfirmed-staff
 * 特定アイテムの未確認スタッフ一覧を返す
 */
router.get('/:id/unconfirmed-staff', async (req: Request, res: Response) => {
  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_KEY());
    const { data, error } = await supabase
      .from('shared_item_unconfirmed_staff')
      .select('staff_name')
      .eq('shared_item_id', req.params.id);
    if (error) throw error;

    const staffNames = (data || []).map((r) => r.staff_name);
    res.json({ data: staffNames });
  } catch (error: any) {
    console.error('Failed to get unconfirmed staff:', error);
    res.status(500).json({ error: '未確認スタッフの取得に失敗しました', details: error.message });
  }
});

/**
 * POST /api/shared-items/:id/unconfirmed-staff
 * スタッフを未確認リストに追加（ボタンON）
 * Body: { staffName: string }
 */
router.post('/:id/unconfirmed-staff', async (req: Request, res: Response) => {
  try {
    const { staffName } = req.body;
    if (!staffName) return res.status(400).json({ error: 'staffName は必須です' });

    const supabase = createClient(SUPABASE_URL, SUPABASE_KEY());
    const { error } = await supabase
      .from('shared_item_unconfirmed_staff')
      .upsert({ shared_item_id: req.params.id, staff_name: staffName }, { onConflict: 'shared_item_id,staff_name' });
    if (error) throw error;

    res.json({ success: true });
  } catch (error: any) {
    console.error('Failed to add unconfirmed staff:', error);
    res.status(500).json({ error: '未確認スタッフの追加に失敗しました', details: error.message });
  }
});

/**
 * DELETE /api/shared-items/:id/unconfirmed-staff/:staffName
 * スタッフを未確認リストから削除（ボタンOFF＝確認済み）
 */
router.delete('/:id/unconfirmed-staff/:staffName', async (req: Request, res: Response) => {
  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_KEY());
    const { error } = await supabase
      .from('shared_item_unconfirmed_staff')
      .delete()
      .eq('shared_item_id', req.params.id)
      .eq('staff_name', decodeURIComponent(req.params.staffName));
    if (error) throw error;

    res.json({ success: true });
  } catch (error: any) {
    console.error('Failed to remove unconfirmed staff:', error);
    res.status(500).json({ error: '未確認スタッフの削除に失敗しました', details: error.message });
  }
});

export default router;


