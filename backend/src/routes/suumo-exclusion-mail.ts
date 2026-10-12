// SUUMO反響除外申請メール送信ルート
// 通話モードページの「除外申請」セクションの送信ボタンから呼ばれる。
// 除外申請スプシ(Googleスプレッドシート)を .xlsx に変換して添付し、
// Gmail(tenant@ifoo-oita.com) から jds_support@r.recruit.co.jp へ送信する。
//
// 認証: index.ts 側で authenticate ミドルウェアを通して登録する。

import { Router, Request, Response } from 'express';

const router = Router();

/**
 * POST /api/suumo-exclusion/send-mail
 * SUUMO反響除外申請フォーマット(.xlsx)をJDSサポートへメール送信する。
 */
router.post('/send-mail', async (_req: Request, res: Response) => {
  try {
    const { sendSuumoExclusionRequestMail, JDS_SUPPORT_EMAIL } = await import(
      '../services/SuumoExclusionRequestService'
    );
    const result = await sendSuumoExclusionRequestMail();
    if (result.success) {
      return res.json({
        success: true,
        to: JDS_SUPPORT_EMAIL,
        messageId: result.messageId,
        message: `除外申請メールを ${JDS_SUPPORT_EMAIL} へ送信しました`,
      });
    }
    return res.status(500).json({ success: false, error: result.error });
  } catch (error: any) {
    console.error('[suumo-exclusion/send-mail] エラー:', error.message);
    return res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
