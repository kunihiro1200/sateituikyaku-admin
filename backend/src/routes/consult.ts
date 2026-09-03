import { Router, Request, Response } from 'express';
import { ConsultService } from '../services/ConsultService';
import { authenticate } from '../middleware/auth';

/**
 * 不動産相談チャットアプリ（Consult App）のAPI。
 * 売主管理システム（backend/src/、ポート3000）に属する。認証不要（顧客向け公開API）。
 * 本人確認（売主番号 or 電話番号）は router 内で個別に行い、以降はセッショントークンで識別する。
 */

const router = Router();
const consultService = new ConsultService();

/**
 * POST /api/consult/verify
 * body: { sellerNumber?: string, phoneNumber?: string }
 * 売主番号または電話番号で本人確認し、セッショントークンを発行する。
 */
router.post('/verify', async (req: Request, res: Response) => {
  try {
    const { sellerNumber, phoneNumber } = req.body;

    if (!sellerNumber && !phoneNumber) {
      return res.status(400).json({ error: '売主番号または電話番号を入力してください' });
    }

    const result = await consultService.verify({ sellerNumber, phoneNumber });

    if (!result) {
      return res.status(404).json({ error: '該当する情報が見つかりませんでした。入力内容をご確認ください。' });
    }

    return res.json({ success: true, ...result });
  } catch (error: any) {
    console.error('[Consult] verify error:', error.message);
    return res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/consult/session/:token
 * 端末に保存済みのセッショントークンから自動ログインする。
 */
router.get('/session/:token', async (req: Request, res: Response) => {
  try {
    const { token } = req.params;
    const resolved = await consultService.resolveSession(token);

    if (!resolved) {
      return res.status(401).json({ error: 'セッションが無効です。再度本人確認を行ってください。' });
    }

    return res.json({ success: true, ...resolved });
  } catch (error: any) {
    console.error('[Consult] session resolve error:', error.message);
    return res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/consult/:sellerId/profile
 * 蓄積された既知情報（謄本情報・チャットで判明した事実）を取得する。
 */
router.get('/:sellerId/profile', async (req: Request, res: Response) => {
  try {
    const { sellerId } = req.params;
    const { sellerNumber } = req.query as { sellerNumber?: string };
    if (!sellerNumber) return res.status(400).json({ error: 'sellerNumberが必要です' });

    const profile = await consultService.getOrCreateProfile(sellerId, sellerNumber);
    return res.json({ success: true, profile });
  } catch (error: any) {
    console.error('[Consult] get profile error:', error.message);
    return res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/consult/:sellerId/toki-upload
 * body: { sellerNumber: string, files: Array<{ name, mimeType, base64 }> }
 * 謄本の写メ（複数枚可）をClaude Visionで読み取り、プロフィールに保存する。
 * 抽出ロジック・sanitizeOwnerInfoは既存のTokiExtractServiceをそのまま利用する。
 */
router.post('/:sellerId/toki-upload', async (req: Request, res: Response) => {
  try {
    const { sellerId } = req.params;
    const { sellerNumber, files } = req.body;

    if (!sellerNumber) return res.status(400).json({ error: 'sellerNumberが必要です' });
    if (!Array.isArray(files) || files.length === 0) {
      return res.status(400).json({ error: '謄本の画像が指定されていません' });
    }

    const profile = await consultService.extractAndSaveToki(sellerId, sellerNumber, files);
    return res.json({ success: true, profile });
  } catch (error: any) {
    console.error('[Consult] toki-upload error:', error.message);

    if (error?.status === 429 || error?.error?.type === 'rate_limit_error') {
      return res.status(429).json({ error: 'APIのレート制限に達しました。しばらく待ってから再試行してください。' });
    }

    return res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/consult/:sellerId/conversations
 * body: { sellerNumber: string }
 * 新しい会話セッションを開始する。
 */
router.post('/:sellerId/conversations', async (req: Request, res: Response) => {
  try {
    const { sellerId } = req.params;
    const { sellerNumber } = req.body;
    if (!sellerNumber) return res.status(400).json({ error: 'sellerNumberが必要です' });

    const conversationId = await consultService.startConversation(sellerId, sellerNumber);
    return res.json({ success: true, conversationId });
  } catch (error: any) {
    console.error('[Consult] start conversation error:', error.message);
    return res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/consult/:sellerId/chat
 * body: { sellerNumber: string, conversationId: string, message: string }
 * チャット本体。プロフィールを参照して回答を生成し、メッセージログを保存する。
 */
router.post('/:sellerId/chat', async (req: Request, res: Response) => {
  try {
    const { sellerId } = req.params;
    const { sellerNumber, conversationId, message } = req.body;

    if (!sellerNumber) return res.status(400).json({ error: 'sellerNumberが必要です' });
    if (!conversationId) return res.status(400).json({ error: 'conversationIdが必要です' });
    if (!message || typeof message !== 'string') return res.status(400).json({ error: 'messageが必要です' });

    const profile = await consultService.getOrCreateProfile(sellerId, sellerNumber);
    const history = await consultService.getConversationHistory(conversationId);

    // ユーザーの発言を先に保存（テーマ分類は回答生成後に確定するため一旦タグなしで保存）
    await consultService.saveMessage({
      conversationId,
      sellerNumber,
      role: 'user',
      content: message,
    });

    const result = await consultService.generateReply({ profile, userMessage: message, history });

    // ユーザー発言にテーマタグ・回答ソースを反映するため、user側にも同じタグで別途保存はせず、
    // assistant側のメッセージにタグを持たせて統計集計のキーとする。
    await consultService.saveMessage({
      conversationId,
      sellerNumber,
      role: 'assistant',
      content: result.reply,
      themeTag: result.themeTag,
      answerSource: result.answerSource,
      llmConfidence: result.confidence,
    });

    return res.json({
      success: true,
      reply: result.reply,
      themeTag: result.themeTag,
      answerSource: result.answerSource,
    });
  } catch (error: any) {
    console.error('[Consult] chat error:', error.message);

    if (error?.status === 429 || error?.error?.type === 'rate_limit_error') {
      return res.status(429).json({ error: 'APIのレート制限に達しました。しばらく待ってから再試行してください。' });
    }

    return res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/consult/:sellerId/known-facts
 * body: { facts: Record<string, any> }
 * チャットの選択肢回答などで判明した事実をプロフィールに保存する（二度聞き防止）。
 */
router.post('/:sellerId/known-facts', async (req: Request, res: Response) => {
  try {
    const { sellerId } = req.params;
    const { facts } = req.body;

    if (!facts || typeof facts !== 'object') {
      return res.status(400).json({ error: 'factsが必要です' });
    }

    await consultService.updateKnownFacts(sellerId, facts);
    return res.json({ success: true });
  } catch (error: any) {
    console.error('[Consult] known-facts error:', error.message);
    return res.status(500).json({ error: error.message });
  }
});

// ============================================================
// 社内管理システム向け（認証必須エリアから呼ばれる想定）
// CallModePage の「相談履歴」リンク・統計ダッシュボード用
// 🚨 顧客向け公開エンドポイント（上記）とは異なり、必ず認証を要求する
// ============================================================

/**
 * GET /api/consult/admin/theme-stats?days=30
 * テーマ別の質問数ランキングを取得する。
 */
router.get('/admin/theme-stats', authenticate, async (req: Request, res: Response) => {
  try {
    const days = req.query.days ? parseInt(req.query.days as string, 10) : 30;
    const stats = await consultService.getThemeStats(days);
    return res.json({ success: true, stats });
  } catch (error: any) {
    console.error('[Consult] theme-stats error:', error.message);
    return res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/consult/admin/unanswered
 * 回答できなかった質問の一覧を取得する（ナレッジベース化の候補）。
 */
router.get('/admin/unanswered', authenticate, async (req: Request, res: Response) => {
  try {
    const questions = await consultService.getUnansweredQuestions();
    return res.json({ success: true, questions });
  } catch (error: any) {
    console.error('[Consult] unanswered error:', error.message);
    return res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/consult/admin/history/:sellerNumber
 * 特定の売主の相談履歴を取得する（CallModePageの「相談履歴」リンク用）。
 */
router.get('/admin/history/:sellerNumber', authenticate, async (req: Request, res: Response) => {
  try {
    const { sellerNumber } = req.params;
    const history = await consultService.getConversationsBySellerNumber(sellerNumber);
    return res.json({ success: true, history });
  } catch (error: any) {
    console.error('[Consult] history error:', error.message);
    return res.status(500).json({ error: error.message });
  }
});

export default router;
