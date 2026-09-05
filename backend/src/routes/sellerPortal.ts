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

/** FI案件（福岡＝くじら不動産）かどうか。既存の isFiSeller ルールと同じ（売主番号がFIで始まるか） */
function isFiSellerNumber(sellerNumber: string): boolean {
  return sellerNumber.startsWith('FI');
}

/** 会社名（件名・本文で使う）。FI案件は株式会社くじら不動産、それ以外は株式会社いふう */
function getCompanyName(sellerNumber: string): string {
  return isFiSellerNumber(sellerNumber) ? '株式会社くじら不動産' : '株式会社いふう';
}

/** 署名ブロック。既存のemailTemplates.tsの福岡署名・EmailService.supabase.tsの大分署名と同じ内容にする */
function getEmailSignature(sellerNumber: string): string {
  if (isFiSellerNumber(sellerNumber)) {
    return (
      `***************************\n` +
      `株式会社くじら不動産\n` +
      `〒810-0073　福岡市中央区舞鶴3－1－10\n` +
      `TEL：092-401-5331\n` +
      `MAIL：tenant@ifoo-oita.com\n` +
      `***************************`
    );
  }
  return (
    `***************************\n` +
    `株式会社いふう\n` +
    `〒870-0044\n` +
    `大分市舞鶴町1丁目3-30\n` +
    `TEL：097-533-2022\n` +
    `MAIL：tenant@ifoo-oita.com\n` +
    `***************************`
  );
}

function getPortalFrontendBaseUrl(): string {
  return process.env.NODE_ENV === 'production'
    ? 'https://sateituikyaku-admin-frontend.vercel.app'
    : (process.env.FRONTEND_URL?.split(',')[0]?.trim() || 'http://localhost:5173');
}

/** HTMLエスケープ用ユーティリティ（bot向けHTML生成で使用） */
function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/**
 * スタッフが売却サポートページのチャットで返信したことを、売主本人にメールで知らせる。
 * 失敗しても返信処理自体（DB保存）は成功させたいため、呼び出し元でエラーを握って
 * ログのみ出すこと（この関数内では例外を投げない）。
 */
async function notifySellerOfStaffReply(params: {
  sellerId: string;
  sellerNumber: string;
  conversationId: string;
  replyContent: string;
}): Promise<void> {
  const { sellerId, sellerNumber, conversationId, replyContent } = params;

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

    const companyName = getCompanyName(sellerNumber);
    const questionContent = await sellerPortalService.getLastSellerMessageContent(conversationId);

    const subject = `ご質問への回答がございます【${companyName}／売却サポートページ】`;
    const body =
      `いつもお世話になっております。\n\n` +
      (questionContent
        ? `売却サポートページにいただいたご質問に、担当スタッフより回答いたしました。\n\n` +
          `---ご質問内容---\n${questionContent}\n---------------\n\n`
        : `売却サポートページにいただいたご質問に、担当スタッフより回答いたしました。\n\n`) +
      `---回答内容---\n${replyContent}\n---------------\n\n` +
      `以下のURLから売却サポートページをご確認ください。\n${portalUrl}\n\n` +
      `よろしくお願いいたします。\n\n` +
      getEmailSignature(sellerNumber);

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

/**
 * GET /api/seller-portal/portal-html/:token
 * SMS・メールのリンクプレビュー用HTML（iMessage/LINE等のクローラー向け）。
 * vercel.json の rewrites で、bot User-Agent の場合のみ /portal/:token からここに転送される
 * （property-preview/html/:slug と同じパターン）。
 *
 * SellerPortalPage.tsx の react-helmet-async によるタイトル・OGP設定はクライアントサイド
 * （JS実行後）にしか反映されないため、JSを実行しないリンクプレビュークローラーには効かない。
 * そのためこのエンドポイントでサーバーサイドから直接メタタグを埋め込んだHTMLを返す。
 *
 * FI売主番号かどうかで会社名・OGP画像（ロゴ）を切り替える。
 */
router.get('/portal-html/:token', async (req: Request, res: Response) => {
  try {
    const { token } = req.params;
    const sellerNumber = await sellerPortalService.resolveTokenSellerNumber(token);

    const frontendBaseUrl = getPortalFrontendBaseUrl();
    const pageTitle = '査定の根拠と手残りリスト';
    const description = '査定額の根拠や手残り金額の詳細、売却スケジュールをご確認いただけます。';

    // トークンが無効・期限切れの場合でも、リンク自体は開けるようにしておく
    // （実際のページ側でエラー表示される。プレビューの会社名判定だけデフォルト＝いふうにする）
    const isFi = sellerNumber ? isFiSellerNumber(sellerNumber) : false;
    const ogImage = isFi
      ? `${frontendBaseUrl}/ifoo-assets/kujira-fudosan-logo.png`
      : `${frontendBaseUrl}/ifoo-assets/ifoo-logo-yellow.png`;
    const siteName = isFi ? '株式会社くじら不動産' : '株式会社いふう';
    const canonicalUrl = `${frontendBaseUrl}/portal/${token}`;

    let html: string;
    try {
      const axios = (await import('axios')).default;
      const indexRes = await axios.get(`${frontendBaseUrl}/index.html`, { timeout: 5000 });
      html = indexRes.data as string;
    } catch {
      html = `<!DOCTYPE html><html lang="ja"><head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width, initial-scale=1.0"/></head><body><div id="root"></div></body></html>`;
    }

    const metaTags = `
    <title>${escapeHtml(pageTitle)}</title>
    <meta name="description" content="${escapeHtml(description)}" />
    <meta name="robots" content="noindex, nofollow" />
    <meta property="og:title" content="${escapeHtml(pageTitle)}" />
    <meta property="og:description" content="${escapeHtml(description)}" />
    <meta property="og:type" content="website" />
    <meta property="og:url" content="${escapeHtml(canonicalUrl)}" />
    <meta property="og:image" content="${escapeHtml(ogImage)}" />
    <meta property="og:site_name" content="${escapeHtml(siteName)}" />
    <meta property="og:locale" content="ja_JP" />
    <meta name="twitter:card" content="summary" />
    <meta name="twitter:title" content="${escapeHtml(pageTitle)}" />
    <meta name="twitter:description" content="${escapeHtml(description)}" />
    <meta name="twitter:image" content="${escapeHtml(ogImage)}" />`;

    html = html
      .replace(/<title>.*?<\/title>/s, '')
      .replace(/<head>/, `<head>${metaTags}`);

    res.set('Content-Type', 'text/html; charset=utf-8');
    res.set('Cache-Control', 'private, no-store'); // 個人情報を含むページのため、CDN等にキャッシュさせない
    res.send(html);
  } catch (error: any) {
    console.error('[SellerPortal] GET /portal-html error:', error.message);
    res.status(500).send('<html><body><h1>エラーが発生しました</h1></body></html>');
  }
});

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

    // トップ画面表示＝査定額セクションを見たとみなす（全体分析ダッシュボード集計用。レスポンスをブロックしない）
    sellerPortalService
      .recordSectionView(resolved.sellerId, resolved.sellerNumber, 'valuation')
      .catch((e: any) => console.error('⚠️ [SellerPortal] recordSectionView(valuation) error:', e));

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
    sellerPortalService
      .recordSectionView(resolved.sellerId, resolved.sellerNumber, 'valuation_breakdown')
      .catch((e: any) => console.error('⚠️ [SellerPortal] recordSectionView(valuation_breakdown) error:', e));
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
    sellerPortalService
      .recordSectionView(resolved.sellerId, resolved.sellerNumber, 'net_proceeds_rough')
      .catch((e: any) => console.error('⚠️ [SellerPortal] recordSectionView(net_proceeds_rough) error:', e));
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

    const { rows, taxBreakdown } = await sellerPortalService.getDetailedProceeds(resolved.sellerId, {
      loanBalance,
      mortgageReleaseFee,
      transferTax,
    });
    await sellerPortalService.markViewed(resolved.sellerId, resolved.sellerNumber, 'detailed');
    sellerPortalService
      .recordSectionView(resolved.sellerId, resolved.sellerNumber, 'net_proceeds_detailed')
      .catch((e: any) => console.error('⚠️ [SellerPortal] recordSectionView(net_proceeds_detailed) error:', e));
    res.json({ success: true, rows, taxBreakdown });
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
 * POST /api/seller-portal/portal/pwa-install-click
 * body: { token }
 * 「この査定ページを保存」ボタン（InstallPwaBanner/InstallPwaPrompt）が押されて、
 * ホーム画面保存の案内ダイアログ（InstallPwaGuideDialog）を開いたタイミングで呼ぶ。
 * 実際にインストールされたかどうか（特にiOSは検知不可能）までは分からないため、
 * 「保存を試みた回数」として全体分析ダッシュボードに表示する。
 */
router.post('/portal/pwa-install-click', async (req: Request, res: Response) => {
  try {
    const resolved = await requireValidToken(req, res);
    if (!resolved) return;

    await sellerPortalService.recordSectionView(resolved.sellerId, resolved.sellerNumber, 'pwa_install');
    res.json({ success: true });
  } catch (error: any) {
    console.error('[SellerPortal] POST /portal/pwa-install-click error:', error.message);
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
  // 新形式（Base62・約22文字、SMS対策で短縮）と旧形式（hex・64文字、既発行URLとの互換性維持）の両方を許可する。
  if (!/^[0-9A-Za-z]{15,64}$/.test(token)) {
    return res.status(400).json({ error: 'トークンの形式が正しくありません' });
  }

  // トークンからFI/AA判定してロゴ・会社名を切り替える
  // （トークンが無効・期限切れでもmanifest自体は返す。実際のページ側でエラー表示されるだけなので、
  //  判定できない場合はデフォルト＝いふうのロゴにする）
  const sellerNumberForManifest = await sellerPortalService.resolveTokenSellerNumber(token);
  const isFi = sellerNumberForManifest ? isFiSellerNumber(sellerNumberForManifest) : false;
  const logoPath = isFi ? '/ifoo-assets/kujira-fudosan-logo.png' : '/ifoo-assets/logo.png';
  const appName = isFi ? '売却サポート（くじら不動産）' : '売却サポート（いふう）';

  res.set('Content-Type', 'application/manifest+json');
  res.json({
    name: appName,
    short_name: '売却サポート',
    description: isFi ? 'くじら不動産の売却サポートページ' : '株式会社いふうの売却サポートページ',
    start_url: `/portal/${token}`,
    scope: `/portal/${token}`,
    display: 'standalone',
    background_color: '#f5f6f8',
    theme_color: '#0B2545',
    icons: [
      { src: logoPath, sizes: '192x192', type: 'image/png' },
      { src: logoPath, sizes: '512x512', type: 'image/png' },
    ],
  });
});

/** GET /api/seller-portal/portal/schedule?token=xxx */
router.get('/portal/schedule', async (req: Request, res: Response) => {
  try {
    const resolved = await requireValidToken(req, res);
    if (!resolved) return;

    const schedule = await sellerPortalService.calculateSchedule(resolved.sellerId);
    sellerPortalService
      .recordSectionView(resolved.sellerId, resolved.sellerNumber, 'schedule')
      .catch((e: any) => console.error('⚠️ [SellerPortal] recordSectionView(schedule) error:', e));
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

/**
 * GET /api/seller-portal/admin/:sellerId/portal-url?sellerNumber=xxx
 * 読み取り専用：既存の有効な専用URLがあれば返す。無ければ発行せずnullを返す。
 * SMS「査定Sメール２」等の<<売却サポートURL>>置換で、送信前にURLの有無だけを確認するために使う。
 * ここでは絶対に自動発行しない（発行は明示的な操作＝管理モーダルの発行ボタンのみで行う）。
 */
router.get('/admin/:sellerId/portal-url', authenticate, async (req: Request, res: Response) => {
  try {
    const { sellerId } = req.params;
    const activeToken = await sellerPortalService.getActivePlainToken(sellerId);
    const activeUrl = activeToken ? `${getPortalFrontendBaseUrl()}/portal/${activeToken}` : null;
    res.json({ success: true, activeUrl });
  } catch (error: any) {
    console.error('[SellerPortal] GET /admin/portal-url error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/seller-portal/admin/analytics-detail?section=valuation
 * 分析ダッシュボードで行をクリックしたときに、そのセクションにアクセスした
 * 売主番号・専用URL・アクセス回数の一覧を返す。
 * section='url_access' で有効トークンを持つ全売主を返す（URLアクセス行用）。
 */
router.get('/admin/analytics-detail', authenticate, async (req: Request, res: Response) => {
  try {
    const section = req.query.section as string;
    if (!section) return res.status(400).json({ error: 'sectionが必要です' });
    const detail = await sellerPortalService.getAnalyticsDetail(section);
    res.json({ success: true, detail });
  } catch (error: any) {
    console.error('[SellerPortal] GET /admin/analytics-detail error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/seller-portal/admin/analytics-summary
 * 全体分析ダッシュボード用：このURL自体のアクセス数・セクション別アクセス数・
 * PWA保存ボタンのクリック数を、福岡（FI）/大分（FI以外）/全体（合計）別に返す。
 */
router.get('/admin/analytics-summary', authenticate, async (req: Request, res: Response) => {
  try {
    const summary = await sellerPortalService.getAnalyticsSummary();
    res.json({ success: true, ...summary });
  } catch (error: any) {
    console.error('[SellerPortal] GET /admin/analytics-summary error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

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

/**
 * GET /api/seller-portal/admin/:sellerId/status : トークン発行状況・アクセス状況・入力内容・未読件数
 *
 * valuation / valuationBreakdown / roughProceeds / schedule も含める：
 * スタッフが売主からの質問に返信する際、売主がどのセクション（査定額/査定根拠/手残り/スケジュール）を
 * 見ながら質問したのかが分かるよう、各チャットの横に該当セクションの内容をそのまま表示するため。
 * 1つでも失敗しても他の情報の取得・返信自体は継続できるよう、個別にtry/catchする。
 */
router.get('/admin/:sellerId/status', authenticate, async (req: Request, res: Response) => {
  try {
    const { sellerId } = req.params;
    // 🚨 このエンドポイントは状況を確認するためだけの読み取り専用とする（副作用でトークンを
    // 発行しない）。SMS/メール送信直前に必要なら POST /admin/:sellerId/ensure-token を使うこと。
    // 理由：ここでも自動発行してしまうと、スタッフが「まだ発行されていない」ことを画面で確認
    // できなくなり、SMSテンプレートの表示切り替え（発行済みのときだけ表示する）が機能しなくなる。
    const [tokenStatus, preferences, unreadCount, valuation, valuationBreakdown, roughProceeds, schedule, activeToken] = await Promise.all([
      sellerPortalService.getTokenStatus(sellerId),
      sellerPortalService.getPreferences(sellerId),
      sellerPortalService.getUnreadCountForStaff(sellerId),
      sellerPortalService.getValuationSummary(sellerId),
      sellerPortalService.getValuationBreakdown(sellerId).catch(() => null),
      sellerPortalService.getRoughProceeds(sellerId).catch(() => []),
      sellerPortalService.calculateSchedule(sellerId).catch(() => null),
      sellerPortalService.getActivePlainToken(sellerId),
    ]);
    // モーダルを開き直しても専用URLを常時表示できるようにする（発行済みのトークンをここで返す）
    const activeUrl = activeToken ? `${getPortalFrontendBaseUrl()}/portal/${activeToken}` : null;
    res.json({ success: true, tokenStatus, preferences, unreadCount, valuation, valuationBreakdown, roughProceeds, schedule, activeUrl });
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
      notifySellerOfStaffReply({ sellerId, sellerNumber, conversationId, replyContent: content }).catch((err: any) => {
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
