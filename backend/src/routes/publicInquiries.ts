import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { createClient } from '@supabase/supabase-js';
import { createRateLimiter } from '../middleware/rateLimiter';

const router = Router();

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY!
);

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
 * スプレッドシート同期を廃止し、buyersテーブルに直接保存する方式に変更
 * サイドバーカテゴリーに自動的に表示される
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

      // 買主番号を採番（タイムスタンプベース）
      const buyerNumber = (Date.now() % 1000000).toString();
      
      // buyer_idを生成（buyer_number + タイムスタンプ）
      const buyerId = `buyer_${buyerNumber}_${Date.now()}`;

      // 電話番号を正規化（数字のみ）
      const normalizedPhone = inquiryData.phone.replace(/[^0-9]/g, '');
      
      // 受付日（今日の日付）
      const receptionDate = new Date();

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

      // buyersテーブルに直接保存
      const { data: savedBuyer, error: saveError } = await supabase
        .from('buyers')
        .insert({
          buyer_id: buyerId,
          buyer_number: buyerNumber,
          name: inquiryData.name,
          phone_number: normalizedPhone,
          email: inquiryData.email,
          inquiry_hearing: fullMessage,
          inquiry_source: inquirySource,
          property_number: propertyNumber,
          property_address: propertyAddress || propertyIdOrNumber,
          reception_date: receptionDate.toISOString(),
          created_datetime: receptionDate.toISOString(),
          created_at: receptionDate.toISOString(),
          updated_at: receptionDate.toISOString(),
          is_deleted: false
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

      console.log('[publicInquiries] Buyer saved to database:', {
        buyer_id: savedBuyer.buyer_id,
        buyer_number: savedBuyer.buyer_number,
        name: savedBuyer.name
      });

      // property_inquiriesテーブルにも記録（履歴用）
      await supabase
        .from('property_inquiries')
        .insert({
          property_id: null,
          property_number: propertyNumber,
          name: inquiryData.name,
          email: inquiryData.email,
          phone: inquiryData.phone,
          message: fullMessage,
          buyer_number: parseInt(buyerNumber, 10),
          sheet_sync_status: 'synced', // buyersテーブルに保存済みなので'synced'
          created_at: receptionDate.toISOString()
        });

      console.log('[publicInquiries] Inquiry also saved to property_inquiries table');

      // ユーザーには成功を返す
      return res.status(201).json({
        success: true,
        message: 'お問い合わせを受け付けました。担当者より折り返しご連絡いたします。',
        buyer_number: buyerNumber
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
