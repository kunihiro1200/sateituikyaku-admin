import { Router, Request, Response } from 'express';
import { createClient } from '@supabase/supabase-js';
import { sellerPortalService } from '../services/SellerPortalService';
import { SellerSidebarCountsUpdateService } from '../services/SellerSidebarCountsUpdateService';
import { SellerService } from '../services/SellerService.supabase';
import { EmailService } from '../services/EmailService';
import { authenticate } from '../middleware/auth';

const sellerService = new SellerService();
const emailService = new EmailService();

/** このテスト用売主番号にはメール通知を送らない */
const EMAIL_NOTIFICATION_EXCLUDED_SELLER_NUMBERS = new Set(['FI1226']);

function getPortalFrontendBaseUrl(): string {
  return process.env.NODE_ENV === 'production'
    ? 'https://sateituikyaku-admin-frontend.vercel.app'
    : (process.env.FRONTEND_URL?.split(',')[0]?.trim() || 'http://localhost:5173');
}

/**
 * スタッフが売却サポートページのチャットで返信したことを、売主本人にメールで知らせる。
 * 失敗しても返信処理自体（DB保存）は成功させたいため、呼び出し元でエラーを握って
 * ログのみ出すこと（この関数内では例外を投げない）。
 */
async function notifySellerOfStaffReply(params: { sellerId: string; sellerNumber: string; replyContent: string }): Promise<void> {
  const { sellerId, sellerNumber, replyContent } = params;

  if (EMAIL_NOTIFICATION_EXCLUDED_SELLER_NUMBERS.has(sellerNumber)) {
    console.log(`[SellerPortal] ${sellerNumber} はテスト用売主のためメール通知をスキップします`);
    return;
  }

  try {
    const seller = await sellerService.getSeller(sellerId);
    if (!seller?.email) {
      console.log(`[SellerPortal] ${sellerNumber} にはメールアドレスが登録されていないため通知をスキップします`);
      return;
    }

    // 既存の有効なURL（ホーム画面に設置済みの可能性がある）を壊さないよう、新規発行ではなく
    // 追加発行する。1件も有効なトークンがない場合は初回発行として issueAdditionalToken を使う。
    const plainToken = await sellerPortalService.issueAdditionalToken(sellerId, sellerNumber);
    const portalUrl = `${getPortalFrontendBaseUrl()}/portal/${plainToken}`;

    const subject = 'ご質問への回答がございます【売却サポートページ】';
    const body =
      `いつもお世話になっております。\n\n` +
      `売却サポートページにいただいたご質問に、担当スタッフより回答いたしました。\n\n` +
      `---回答内容---\n${replyContent}\n---------------\n\n` +
      `以下のURLから売却サポートページをご確認ください。\n${portalUrl}\n\n` +
      `よろしくお願いいたします。`;

    await emailService.sendEmail({ to: [seller.email], subject, body });
  } catch (err: any) {
    console.error(`[SellerPortal] ${sellerNumber} への返信通知メール送信に失敗しました:`, err.message);
  }
}

/**
 * 「売却サポートページ：対応が必要」サイドバーカテゴリーを非同期で再計算する。
 * 呼び出し元のレスポンスをブロックしない（失敗してもチャット送信・保存自体は成功させる）。
 */
function refreshSellerPortalAttentionSidebar(): void {
  const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_KEY!);
  const service = new SellerSidebarCountsUpdateService(supabase);
  service.updateSellerPortalAttentionCategory().catch((err: any) => {
    console.error('⚠️ [SellerPortal] sellerPortalAttention sidebar update error:', err);
  });
}

/**
 * 査定依頼者向け「売却サポートページ」API。
 * 売主管理システム（backend/src/、ポート3000）に属する。
 *
 * 認証方式が2種類ある:
 * - 顧客向け（/portal/*）: 認証不要。専用URLトークン（ハッシュ化保存）を body/query で受け取り、
 *   sellerPortalService.verifyToken() で都度検証する（既存のauthenticateミドルウェアは使わない）。
 * - スタッフ向け（/admin/*）: 既存の authenticate ミドルウェアで保護する。
 */

const router = Router();

/** トークンを検証し、有効な場合は { sellerId, sellerNumber } を返す。無効なら null を返して401を書き込む。 */
async function requireValidToken(req: Request, res: Response): Promise<{ sellerId: string; sellerNumber: string } | null> {
  const token = (req.body?.token || req.query?.token) as string | undefined;
  if (!token) {
    res.status(400).json({ error: 'トークンが指定されていません' });
    return null;
  }
  const resolved = await sellerPortalService.verifyToken(token);
  if (!resolved) {
    res.status(401).json({ error: 'このページは無効か期限切れです。担当者にご確認ください。' });
    return null;
  }
  return resolved;
}

// ============================================================
// 顧客向け（認証不要、トークン検証）
// ============================================================

/** GET /api/seller-portal/portal?token=xxx : トップ画面の初期データ一括取得 */
router.get('/portal', async (req: Request, res: Response) => {
  try {
    const resolved = await requireValidToken(req, res);
    if (!resolved) return;

    const [valuation, preferences, propertySummary] = await Promise.all([
      sellerPortalService.getValuationSummary(resolved.sellerId),
      sellerPortalService.getPreferences(resolved.sellerId),
      sellerPortalService.getPropertySummary(resolved.sellerId),
    ]);

    res.json({ success: true, sellerNumber: resolved.sellerNumber, valuation, preferences, propertySummary });
  } catch (error: any) {
    console.error('[SellerPortal] GET /portal error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

/** GET /api/seller-portal/portal/valuation-breakdown?token=xxx */
router.get('/portal/valuation-breakdown', async (req: Request, res: Response) => {
  try {
    const resolved = await requireValidToken(req, res);
    if (!resolved) return;

    const breakdown = await sellerPortalService.getValuationBreakdown(resolved.sellerId);
    res.json({ success: true, breakdown });
  } catch (error: any) {
    console.error('[SellerPortal] GET /portal/valuation-breakdown error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

/** GET /api/seller-portal/portal/rough-proceeds?token=xxx */
router.get('/portal/rough-proceeds', async (req: Request, res: Response) => {
  try {
    const resolved = await requireValidToken(req, res);
    if (!resolved) return;

    const rows = await sellerPortalService.getRoughProceeds(resolved.sellerId);
    await sellerPortalService.markViewed(resolved.sellerId, resolved.sellerNumber, 'rough');
    res.json({ success: true, rows });
  } catch (error: any) {
    console.error('[SellerPortal] GET /portal/rough-proceeds error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/seller-portal/portal/detailed-proceeds
 * body: { token, loanBalance?, mortgageReleaseFee?, transferTax: {...} }
 */
router.post('/portal/detailed-proceeds', async (req: Request, res: Response) => {
  try {
    const resolved = await requireValidToken(req, res);
    if (!resolved) return;

    const { loanBalance, mortgageReleaseFee, transferTax } = req.body;
    if (!transferTax || !transferTax.mode) {
      return res.status(400).json({ error: 'transferTax.mode が必要です' });
    }

    const rows = await sellerPortalService.getDetailedProceeds(resolved.sellerId, {
      loanBalance,
      mortgageReleaseFee,
      transferTax,
    });
    await sellerPortalService.markViewed(resolved.sellerId, resolved.sellerNumber, 'detailed');
    res.json({ success: true, rows });
  } catch (error: any) {
    console.error('[SellerPortal] POST /portal/detailed-proceeds error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

/** POST /api/seller-portal/portal/known-facts  body: { token, facts } */
router.post('/portal/known-facts', async (req: Request, res: Response) => {
  try {
    const resolved = await requireValidToken(req, res);
    if (!resolved) return;

    const { facts } = req.body;
    if (!facts || typeof facts !== 'object') {
      return res.status(400).json({ error: 'factsが必要です' });
    }

    await sellerPortalService.updateKnownFacts(resolved.sellerId, resolved.sellerNumber, facts);
    res.json({ success: true });
  } catch (error: any) {
    console.error('[SellerPortal] POST /portal/known-facts error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

/**
 * PUT /api/seller-portal/portal/preferences
 * body: { token, desiredSalePrice?, minimumSalePrice?, desiredSettlementYearMonth? }
 */
router.put('/portal/preferences', async (req: Request, res: Response) => {
  try {
    const resolved = await requireValidToken(req, res);
    if (!resolved) return;

    const { desiredSalePrice, minimumSalePrice, desiredSettlementYearMonth } = req.body;
    await sellerPortalService.upsertPreferences(resolved.sellerId, resolved.sellerNumber, {
      desiredSalePrice,
      minimumSalePrice,
      desiredSettlementYearMonth,
    });

    // 「いつまでに売りたいですか？」が入力されたら、Google Chatではなく
    // 売主リストのサイドバーカテゴリー「売却サポート：対応が必要」で気づける仕組みにする
    if (desiredSettlementYearMonth) {
      refreshSellerPortalAttentionSidebar();
    }

    res.json({ success: true });
  } catch (error: any) {
    console.error('[SellerPortal] PUT /portal/preferences error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/seller-portal/portal/buyout-request
 * body: { token }
 * 「3ヶ月以内の売却でしたら買取をオススメ致します」の案内に対して、
 * 売主が「買取依頼」ボタンを押した際に呼ばれる。
 */
router.post('/portal/buyout-request', async (req: Request, res: Response) => {
  try {
    const resolved = await requireValidToken(req, res);
    if (!resolved) return;

    await sellerPortalService.requestBuyout(resolved.sellerId, resolved.sellerNumber);
    // Google Chatではなく、サイドバーカテゴリー「売却サポート：対応が必要」で気づける仕組みにする
    refreshSellerPortalAttentionSidebar();
    res.json({ success: true });
  } catch (error: any) {
    console.error('[SellerPortal] POST /portal/buyout-request error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/seller-portal/portal/manifest.json?token=xxx
 * 売主ごとに異なる start_url（トークン付き）を持つ動的Web App Manifest。
 * ホーム画面に保存したアイコンから起動すると、必ずこの売主自身の専用ページが直接開く。
 */
router.get('/portal/manifest.json', async (req: Request, res: Response) => {
  const token = req.query.token as string | undefined;
  if (!token) {
    return res.status(400).json({ error: 'トークンが指定されていません' });
  }
  // トークンの有効性チェックはしない（manifestはブラウザが取得するだけの静的情報のため、
  // 実際の認可は各APIエンドポイント側のverifyTokenで行う）。ただし形式だけ簡易チェックする。
  if (!/^[a-f0-9]{64}$/.test(token)) {
    return res.status(400).json({ error: 'トークンの形式が正しくありません' });
  }

  res.set('Content-Type', 'application/manifest+json');
  res.json({
    name: '売却サポート',
    short_name: '売却サポート',
    description: 'くじら不動産の売却サポートページ',
    start_url: `/portal/${token}`,
    scope: `/portal/${token}`,
    display: 'standalone',
    background_color: '#f5f6f8',
    theme_color: '#0B2545',
    icons: [
      { src: '/ifoo-assets/logo.png', sizes: '192x192', type: 'image/png' },
      { src: '/ifoo-assets/logo.png', sizes: '512x512', type: 'image/png' },
    ],
  });
});

/** GET /api/seller-portal/portal/schedule?token=xxx */
router.get('/portal/schedule', async (req: Request, res: Response) => {
  try {
    const resolved = await requireValidToken(req, res);
    if (!resolved) return;

    const schedule = await sellerPortalService.calculateSchedule(resolved.sellerId);
    res.json({ success: true, schedule });
  } catch (error: any) {
    console.error('[SellerPortal] GET /portal/schedule error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/seller-portal/portal/messages
 * body: { token, contextTag, content }
 * 売主本人からスタッフへメッセージを送る。
 */
router.post('/portal/messages', async (req: Request, res: Response) => {
  try {
    const resolved = await requireValidToken(req, res);
    if (!resolved) return;

    const { contextTag, content } = req.body;
    if (!content || typeof content !== 'string') {
      return res.status(400).json({ error: 'contentが必要です' });
    }

    const conversationId = await sellerPortalService.startOrGetConversation(
      resolved.sellerId,
      resolved.sellerNumber,
      contextTag || 'general'
    );
    await sellerPortalService.sendMessage({
      conversationId,
      sellerNumber: resolved.sellerNumber,
      senderType: 'seller',
      content,
    });
    // 売主からの質問も同じく、サイドバーカテゴリーで気づける仕組みにする
    refreshSellerPortalAttentionSidebar();
    res.json({ success: true, conversationId });
  } catch (error: any) {
    console.error('[SellerPortal] POST /portal/messages error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/seller-portal/portal/messages?token=xxx&markAsRead=false
 * 売主本人が自分の全会話を見る。
 * markAsRead=false のときは既読化しない（FABの未読バッジ確認用に、開いていないのに既読になるのを防ぐため）。
 */
router.get('/portal/messages', async (req: Request, res: Response) => {
  try {
    const resolved = await requireValidToken(req, res);
    if (!resolved) return;

    const conversations = await sellerPortalService.getConversationsWithMessages(resolved.sellerId);
    const shouldMarkAsRead = req.query.markAsRead !== 'false';
    if (shouldMarkAsRead) {
      // 売主が画面を開いたタイミングで、スタッフからの未読メッセージを既読にする
      for (const c of conversations) {
        await sellerPortalService.markMessagesReadBySeller(c.id);
      }
    }
    res.json({ success: true, conversations });
  } catch (error: any) {
    console.error('[SellerPortal] GET /portal/messages error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// ============================================================
// スタッフ向け（認証必須）
// ============================================================

/** POST /api/seller-portal/admin/:sellerId/issue-token : 専用URLトークンを発行（再発行含む） */
router.post('/admin/:sellerId/issue-token', authenticate, async (req: Request, res: Response) => {
  try {
    const { sellerId } = req.params;
    const { sellerNumber } = req.body;
    if (!sellerNumber) return res.status(400).json({ error: 'sellerNumberが必要です' });

    const token = await sellerPortalService.issueToken(sellerId, sellerNumber);
    res.json({ success: true, token });
  } catch (error: any) {
    console.error('[SellerPortal] POST /admin/issue-token error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

/** GET /api/seller-portal/admin/:sellerId/status : トークン発行状況・アクセス状況・入力内容・未読件数 */
router.get('/admin/:sellerId/status', authenticate, async (req: Request, res: Response) => {
  try {
    const { sellerId } = req.params;
    const [tokenStatus, preferences, unreadCount] = await Promise.all([
      sellerPortalService.getTokenStatus(sellerId),
      sellerPortalService.getPreferences(sellerId),
      sellerPortalService.getUnreadCountForStaff(sellerId),
    ]);
    res.json({ success: true, tokenStatus, preferences, unreadCount });
  } catch (error: any) {
    console.error('[SellerPortal] GET /admin/status error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

/** POST /api/seller-portal/admin/:sellerId/confirm-settlement : 決済希望月の入力をスタッフが確認したことを記録する */
router.post('/admin/:sellerId/confirm-settlement', authenticate, async (req: Request, res: Response) => {
  try {
    const { sellerId } = req.params;
    const { sellerNumber } = req.body;
    if (!sellerNumber) return res.status(400).json({ error: 'sellerNumberが必要です' });

    await sellerPortalService.confirmSettlementInput(sellerId, sellerNumber);
    refreshSellerPortalAttentionSidebar();
    res.json({ success: true });
  } catch (error: any) {
    console.error('[SellerPortal] POST /admin/confirm-settlement error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

/** POST /api/seller-portal/admin/:sellerId/confirm-buyout : 買取依頼をスタッフが確認したことを記録する */
router.post('/admin/:sellerId/confirm-buyout', authenticate, async (req: Request, res: Response) => {
  try {
    const { sellerId } = req.params;
    const { sellerNumber } = req.body;
    if (!sellerNumber) return res.status(400).json({ error: 'sellerNumberが必要です' });

    await sellerPortalService.confirmBuyoutRequest(sellerId, sellerNumber);
    refreshSellerPortalAttentionSidebar();
    res.json({ success: true });
  } catch (error: any) {
    console.error('[SellerPortal] POST /admin/confirm-buyout error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

/** POST /api/seller-portal/admin/:sellerId/recalculate-breakdown : 査定根拠の再計算・保存（土地・戸建のみ） */
router.post('/admin/:sellerId/recalculate-breakdown', authenticate, async (req: Request, res: Response) => {
  try {
    const { sellerId } = req.params;
    await sellerPortalService.recalculateAndSaveBreakdown(sellerId);
    res.json({ success: true });
  } catch (error: any) {
    console.error('[SellerPortal] POST /admin/recalculate-breakdown error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

/** GET /api/seller-portal/admin/:sellerId/messages : スタッフが会話一覧を見る */
router.get('/admin/:sellerId/messages', authenticate, async (req: Request, res: Response) => {
  try {
    const { sellerId } = req.params;
    const conversations = await sellerPortalService.getConversationsWithMessages(sellerId);
    res.json({ success: true, conversations });
  } catch (error: any) {
    console.error('[SellerPortal] GET /admin/messages error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/seller-portal/admin/:sellerId/messages
 * body: { conversationId, content }
 * スタッフが売主へ返信する。
 */
router.post('/admin/:sellerId/messages', authenticate, async (req: Request, res: Response) => {
  try {
    const { conversationId, content } = req.body;
    if (!conversationId || !content) {
      return res.status(400).json({ error: 'conversationId, content が必要です' });
    }

    const { sellerId } = req.params;
    const sellerNumber = req.body.sellerNumber; // フロントから明示的に渡す想定（sellerNumberの非正規化カラム用）
    await sellerPortalService.sendMessage({
      conversationId,
      sellerNumber: sellerNumber || '',
      senderType: 'staff',
      senderEmployeeId: req.employee?.id,
      content,
    });
    await sellerPortalService.markMessagesReadByStaff(conversationId);
    refreshSellerPortalAttentionSidebar();

    // 売主本人にメールで返信を知らせる（レスポンスをブロックしない。失敗してもチャット送信自体は成功とする）
    if (sellerNumber) {
      notifySellerOfStaffReply({ sellerId, sellerNumber, replyContent: content }).catch((err: any) => {
        console.error('⚠️ [SellerPortal] notifySellerOfStaffReply unexpected error:', err);
      });
    }

    res.json({ success: true });
  } catch (error: any) {
    console.error('[SellerPortal] POST /admin/messages error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

export default router;
