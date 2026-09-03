import { Router, Request, Response } from 'express';
import { sellerPortalService } from '../services/SellerPortalService';
import { authenticate } from '../middleware/auth';

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
    res.json({ success: true });
  } catch (error: any) {
    console.error('[SellerPortal] PUT /portal/preferences error:', error.message);
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
    res.json({ success: true, conversationId });
  } catch (error: any) {
    console.error('[SellerPortal] POST /portal/messages error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

/** GET /api/seller-portal/portal/messages?token=xxx : 売主本人が自分の全会話を見る */
router.get('/portal/messages', async (req: Request, res: Response) => {
  try {
    const resolved = await requireValidToken(req, res);
    if (!resolved) return;

    const conversations = await sellerPortalService.getConversationsWithMessages(resolved.sellerId);
    // 売主が画面を開いたタイミングで、スタッフからの未読メッセージを既読にする
    for (const c of conversations) {
      await sellerPortalService.markMessagesReadBySeller(c.id);
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

    const seller = req.body.sellerNumber; // フロントから明示的に渡す想定（sellerNumberの非正規化カラム用）
    await sellerPortalService.sendMessage({
      conversationId,
      sellerNumber: seller || '',
      senderType: 'staff',
      senderEmployeeId: req.employee?.id,
      content,
    });
    await sellerPortalService.markMessagesReadByStaff(conversationId);
    res.json({ success: true });
  } catch (error: any) {
    console.error('[SellerPortal] POST /admin/messages error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

export default router;
