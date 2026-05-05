import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { createClient } from '@supabase/supabase-js';
import { Pool } from 'pg';
import { createRateLimiter } from '../middleware/rateLimiter';
import { GoogleSheetsClient } from '../services/GoogleSheetsClient';

const router = Router();

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY!
);

// PostgreSQLプールを初期化（property_inquiriesテーブル用 - PostgRESTをバイパス）
// 現在は使用していないのでコメントアウト
// const pgPool = new Pool({
//   connectionString: process.env.DATABASE_URL,
//   ssl: {
//     rejectUnauthorized: false
//   }
// });

// GoogleSheetsClientを直接初期化
const sheetsClient = new GoogleSheetsClient({
  spreadsheetId: process.env.GOOGLE_SHEETS_SPREADSHEET_ID!,
  sheetName: process.env.GOOGLE_SHEETS_BUYER_SHEET_NAME || '買主リスト',
  // Vercel環境では環境変数から読み込む（serviceAccountKeyPathは使用しない）
});

// 認証を実行（同期的に待つ）
let isAuthenticated = false;
sheetsClient.authenticate()
  .then(() => {
    isAuthenticated = true;
    console.log('[publicInquiries] GoogleSheetsClient authenticated successfully');
  })
  .catch(error => {
    console.error('[publicInquiries] GoogleSheetsClient認証エラー:', error);
  });

// Validation schema for inquiry form
const inquirySchema = z.object({
  property_id: z.string().min(1, '物件IDまたは物件番号を指定してください').optional(),
  propertyId: z.string().min(1, '物件IDまたは物件番号を指定してください').optional(),
  propertyAddress: z.string().optional(), // 物件住所
  sourceUrl: z.string().optional(), // 元のURL
  previewUrl: z.string().optional(), // プレビューURL
  name: z.string().min(1, '名前を入力してください').max(100, '名前は100文字以内で入力してください'),
  email: z.string().email('有効なメールアドレスを入力してください').max(255, 'メールアドレスは255文字以内で入力してください'),
  phone: z.string()
    .min(10, '有効な電話番号を入力してください')
    .max(15, '電話番号は15文字以内で入力してください')
    .regex(/^[0-9\-+() ]+$/, '電話番号は数字、ハイフン、括弧のみ使用できます'),
  message: z.string().min(1, 'お問い合わせ内容を入力してください').max(2000, 'お問い合わせ内容は2000文字以内で入力してください')
}).refine(data => {
  // property_idまたはpropertyIdのいずれかが存在すればOK
  const hasPropertyId = (data.property_id && data.property_id.length > 0) || 
                        (data.propertyId && data.propertyId.length > 0);
  return hasPropertyId;
}, {
  message: '物件IDまたは物件番号を指定してください',
  path: ['propertyId'],
});

type InquiryFormData = z.infer<typeof inquirySchema>;

/**
 * POST /api/public/inquiries
 * Submit a property inquiry
 * 
 * TODO: テスト完了後にレート制限を戻すこと！
 * Rate limit temporarily disabled for testing
 */
router.post(
  '/',
  // createRateLimiter({
  //   windowMs: 60 * 60 * 1000, // 1 hour
  //   maxRequests: 10
  // }),
  async (req: Request, res: Response) => {
    try {
      console.log('[publicInquiries] Received inquiry request:', {
        body: req.body,
        property_id: req.body.property_id,
        propertyId: req.body.propertyId
      });

      // Validate request body
      const validationResult = inquirySchema.safeParse(req.body);
      
      if (!validationResult.success) {
        console.error('[publicInquiries] Validation error:', validationResult.error);
        return res.status(400).json({
          success: false,
          message: '入力内容に誤りがあります',
          errors: validationResult.error.issues?.map(err => ({
            field: err.path.join('.'),
            message: err.message
          })) || []
        });
      }

      const inquiryData: InquiryFormData = validationResult.data;
      
      // property_idまたはpropertyIdを取得
      const propertyIdOrNumber = (inquiryData as any).property_id || (inquiryData as any).propertyId;

      console.log('[publicInquiries] Property ID or Number:', propertyIdOrNumber);

      // UUIDかどうかをチェック（UUID形式: 8-4-4-4-12の形式）
      const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(propertyIdOrNumber);

      console.log('[publicInquiries] Is UUID:', isUUID);

      // Verify that the property exists and is public
      let query = supabase
        .from('property_listings')
        .select('id, property_number, address, atbb_status');

      // UUIDの場合はidで検索、それ以外は物件番号で検索
      if (isUUID) {
        console.log('[publicInquiries] Searching by UUID:', propertyIdOrNumber);
        query = query.eq('id', propertyIdOrNumber);
      } else {
        console.log('[publicInquiries] Searching by property_number:', propertyIdOrNumber);
        query = query.eq('property_number', propertyIdOrNumber);
      }

      const { data: property, error: propertyError } = await query.single();

      console.log('[publicInquiries] Property search result:', { property, propertyError });

      // 物件が見つからない場合でも問い合わせを受け付ける
      // property_numberは空、問合せ物件所在地にpropertyIdOrNumberを記録
      let propertyNumber = '';
      let propertyAddress = '';
      let inquirySource = 'サイト'; // デフォルト

      if (propertyError || !property) {
        console.log('[publicInquiries] Property not found, but accepting inquiry. Using propertyId as address.');
        // 物件が見つからない場合は、propertyIdOrNumberを住所として扱う
        propertyAddress = propertyIdOrNumber;
      } else {
        // 物件が見つかった場合
        propertyNumber = property.property_number;
        propertyAddress = property.address || '';
        
        // ATBB状況に基づいて問合せ元を判定
        if (property.atbb_status) {
          const status = property.atbb_status.toLowerCase();
          if (status.includes('公開中')) {
            inquirySource = 'いふう独自サイト';
          } else if (status.includes('公開前')) {
            inquirySource = '公開前・いふう独自サイト';
          } else if (status.includes('非公開')) {
            inquirySource = '非公開・いふう独自サイト';
          }
        }
      }

      // 公開物件かどうかのチェックは一旦スキップ（全ての物件に対して問い合わせを受け付ける）
      // TODO: site_displayカラムが利用可能になったら、公開チェックを追加

      // Get client IP for logging
      const clientIp = req.ip || req.socket.remoteAddress || 'unknown';

      // 買主番号を採番
      const buyerNumber = Date.now() % 1000000; // 一時的な採番方法

      // フィールドマッピング
      const normalizedPhone = inquiryData.phone.replace(/[^0-9]/g, ''); // 数字のみ抽出
      const receptionDate = new Date().toLocaleDateString('ja-JP'); // 受付日（今日の日付）

      // コメント欄に追記する情報を整形
      const additionalInfo = [];
      if ((inquiryData as any).propertyAddress) {
        additionalInfo.push(`物件住所: ${(inquiryData as any).propertyAddress}`);
      }
      if ((inquiryData as any).previewUrl) {
        additionalInfo.push(`プレビューURL: ${(inquiryData as any).previewUrl}`);
      }
      if ((inquiryData as any).sourceUrl) {
        additionalInfo.push(`元のURL: ${(inquiryData as any).sourceUrl}`);
      }
      
      // ユーザーのメッセージと追加情報を結合
      const fullMessage = additionalInfo.length > 0
        ? `${inquiryData.message}\n\n--- 物件情報 ---\n${additionalInfo.join('\n')}`
        : inquiryData.message;

      // まずDBに保存（必ず成功させる）
      let sheetSyncStatus = 'pending'; // デフォルトは保留
      
      const { data: savedInquiry, error: saveError } = await supabase
        .from('property_inquiries')
        .insert({
          property_id: null, // UUIDがないのでnull
          property_number: propertyNumber,
          name: inquiryData.name,
          email: inquiryData.email,
          phone: inquiryData.phone,
          message: fullMessage,
          buyer_number: buyerNumber,
          sheet_sync_status: sheetSyncStatus,
          created_at: new Date().toISOString()
        })
        .select()
        .single();

      if (saveError) {
        console.error('[publicInquiries] Database save error:', saveError);
        return res.status(500).json({
          success: false,
          message: 'お問い合わせの保存中にエラーが発生しました。'
        });
      }

      console.log('[publicInquiries] Inquiry saved to database:', savedInquiry.id);

      // スプレッドシートに転記を試みる（失敗しても問題ない）
      try {
        // GoogleSheetsClientの認証を確認
        if (!isAuthenticated) {
          console.error('[publicInquiries] GoogleSheetsClient not authenticated yet');
          await sheetsClient.authenticate();
          isAuthenticated = true;
        }

        const rowData = {
          '買主番号': buyerNumber.toString(),
          '受付日': receptionDate,
          '●氏名・会社名': inquiryData.name,
          '●問合時ヒアリング': fullMessage,
          '●電話番号\n（ハイフン不要）': normalizedPhone,
          '●メアド': inquiryData.email,
          '●問合せ元': inquirySource,
          '物件番号': propertyNumber,
          '問合せ物件所在地': propertyAddress,
        };

        console.log('[publicInquiries] Appending row to buyer sheet with data:', rowData);
        await sheetsClient.appendRow(rowData);
        console.log('[publicInquiries] Row appended successfully');

        // 成功したらステータスを更新
        await supabase
          .from('property_inquiries')
          .update({ sheet_sync_status: 'synced' })
          .eq('id', savedInquiry.id);

        sheetSyncStatus = 'synced';

        console.log('Inquiry synced to buyer sheet:', {
          buyerNumber,
          propertyNumber: propertyNumber,
          customerName: inquiryData.name
        });

      } catch (syncError) {
        // 転記エラーはログに記録するが、ユーザーにはエラーを返さない
        console.error('Failed to sync inquiry to buyer sheet:', syncError);
        console.error('Sync error details:', {
          message: (syncError as Error).message,
          stack: (syncError as Error).stack
        });
        
        // ステータスを'failed'に更新
        await supabase
          .from('property_inquiries')
          .update({ sheet_sync_status: 'failed' })
          .eq('id', savedInquiry.id);

        console.log('[publicInquiries] Inquiry saved to DB but sheet sync failed. Will retry later.');
      }

      // ユーザーには常に成功を返す（DBに保存されているので）
      return res.status(201).json({
        success: true,
        message: 'お問い合わせを受け付けました。担当者より折り返しご連絡いたします。'
      });

    } catch (error) {
      console.error('Unexpected error in inquiry submission:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('Error message:', errorMessage);
      console.error('Error stack:', error instanceof Error ? error.stack : 'No stack trace');
      
      return res.status(500).json({
        success: false,
        message: `お問い合わせの送信中にエラーが発生しました: ${errorMessage}`,
        error: process.env.NODE_ENV === 'development' ? errorMessage : undefined
      });
    }
  }
);

export default router;
