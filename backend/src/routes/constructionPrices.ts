/**
 * /api/construction-prices
 *
 * 建築単価管理 API
 *
 * エンドポイント一覧:
 *   GET  /api/construction-prices                    一覧取得（全年度・全構造）
 *   GET  /api/construction-prices/available-years    e-Stat で取得可能な年度一覧
 *   GET  /api/construction-prices/candidates         承認待ち候補一覧
 *   POST /api/construction-prices/fetch/:year        指定年度のe-Statデータ取得・保存
 *   POST /api/construction-prices/approve/:year/:structure  候補を承認（本番査定に反映）
 */

import { Router, Request, Response } from 'express';
import { constructionPriceUpdateService } from '../services/ConstructionPriceUpdateService';
import { BaseRepository } from '../repositories/BaseRepository';

const router = Router();
const repo   = new BaseRepository();

// ─── GET /api/construction-prices ─────────────────────────────────────────────
// 全年度・全構造の単価を返す（管理画面用）
router.get('/', async (_req: Request, res: Response) => {
  try {
    const { data, error } = await repo['table']('construction_unit_prices')
      .select('*')
      .order('year', { ascending: true })
      .order('structure');
    if (error) throw error;
    res.json({ data: data ?? [] });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// ─── GET /api/construction-prices/available-years ─────────────────────────────
// e-Stat API で取得可能な年度一覧
router.get('/available-years', async (_req: Request, res: Response) => {
  try {
    const years = await constructionPriceUpdateService.getAvailableYears();
    res.json({ years, note: 'e-Stat dataset 0003114547 の利用可能年度。1965-2010年はe-Stat未対応。' });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// ─── GET /api/construction-prices/candidates ──────────────────────────────────
// 承認待ち候補一覧（is_approved=false の行）
router.get('/candidates', async (req: Request, res: Response) => {
  try {
    const year = req.query.year ? parseInt(req.query.year as string, 10) : undefined;
    const candidates = await constructionPriceUpdateService.listPendingCandidates(year);
    res.json({ data: candidates, count: candidates.length });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// ─── POST /api/construction-prices/fetch/:year ────────────────────────────────
// 指定年度のe-Statデータを取得し、estat_price として保存する
// price_per_sqm（査定計算に使用）は変更しない
router.post('/fetch/:year', async (req: Request, res: Response) => {
  try {
    const year = parseInt(req.params.year, 10);
    if (isNaN(year) || year < 2011 || year > new Date().getFullYear() + 1) {
      return res.status(400).json({
        error: `年度が不正です: ${req.params.year}。e-Stat の利用可能範囲は 2011〜現在です。`,
      });
    }

    console.log(`[construction-prices] e-Stat 取得開始: ${year}年`);
    const result = await constructionPriceUpdateService.fetchAndSaveCandidates(year);

    res.json({
      message:   `${year}年の e-Stat データを取得・保存しました`,
      year:      result.year,
      fetchedAt: result.fetchedAt,
      savedCount: result.savedCount,
      availableYears: result.availableYears,
      candidates: result.candidates.map(c => ({
        structure:   c.structure,
        estatPrice:  c.estatPrice,
        currentPrice: c.currentPrice,
        priceDiff:   c.priceDiff,
        pctChange:   c.pctChange,
        isLightSteelEstimate: c.isLightSteelEstimate,
        validationWarnings: c.validationWarnings,
      })),
      validationWarnings: result.validationWarnings,
    });
  } catch (e: any) {
    console.error('[construction-prices] fetch error:', e);
    res.status(500).json({ error: e.message });
  }
});

// ─── POST /api/construction-prices/approve/:year/:structure ──────────────────
// 指定した候補を承認する（estat_price → price_per_sqm に反映）
// ⚠️ この操作後、TTL 切れ後から本番査定に新単価が使用される
router.post('/approve/:year/:structure', async (req: Request, res: Response) => {
  try {
    const year      = parseInt(req.params.year, 10);
    const structure = decodeURIComponent(req.params.structure);

    if (isNaN(year)) {
      return res.status(400).json({ error: '年度が不正です' });
    }

    console.log(`[construction-prices] 承認: ${year}年 ${structure}`);
    await constructionPriceUpdateService.approveCandidate(year, structure);

    res.json({
      message:   `承認完了: ${year}年 ${structure} の建築単価を更新しました`,
      note:      'ValuationCalculatorService のキャッシュ（TTL 6時間）が切れた後から新単価が適用されます',
    });
  } catch (e: any) {
    console.error('[construction-prices] approve error:', e);
    res.status(400).json({ error: e.message });
  }
});

// ─── POST /api/construction-prices/fetch-all-estat ───────────────────────────
// e-Stat で利用可能な全年度（2011〜現在）を一括取得・保存
// GitHub Actions から呼び出される年次自動更新エンドポイント
router.post('/fetch-all-estat', async (req: Request, res: Response) => {
  // Cron 認証チェック（GitHub Actions からの呼び出し）
  const cronSecret = req.headers['x-cron-secret'] ?? req.headers['authorization'];
  const expected   = process.env.CRON_SECRET;
  if (expected && cronSecret !== expected && cronSecret !== `Bearer ${expected}`) {
    return res.status(401).json({ error: '認証エラー' });
  }

  try {
    const years = await constructionPriceUpdateService.getAvailableYears();
    const results = [];
    const errors  = [];

    // 最新年度を優先（最後の3年分を更新）
    const targetYears = years.slice(0, 3);
    console.log(`[construction-prices] 自動一括取得: ${targetYears.join(', ')}年`);

    for (const year of targetYears) {
      try {
        const r = await constructionPriceUpdateService.fetchAndSaveCandidates(year);
        results.push({ year, savedCount: r.savedCount });
      } catch (e: any) {
        errors.push({ year, error: e.message });
      }
    }

    res.json({
      message:     `e-Stat 一括取得完了`,
      targetYears,
      results,
      errors,
      note:        '更新候補は /api/construction-prices/candidates で確認し、承認後に本番反映してください',
    });
  } catch (e: any) {
    console.error('[construction-prices] fetch-all error:', e);
    res.status(500).json({ error: e.message });
  }
});

// ─── POST /api/construction-prices/invalidate-cache ─────────────────────────
// ValuationCalculatorService のモジュールレベルキャッシュを強制クリアする
// 単価更新後にこのエンドポイントを呼ぶと、次のリクエストから新単価で計算される
router.post('/invalidate-cache', async (req: Request, res: Response) => {
  const cronSecret = req.headers['x-cron-secret'] ?? req.headers['authorization'];
  const expected   = process.env.CRON_SECRET;
  if (expected && cronSecret !== expected && cronSecret !== `Bearer ${expected}`) {
    return res.status(401).json({ error: '認証エラー' });
  }
  try {
    // モジュールレベルキャッシュを直接クリア
    const svcModule = require('../services/ValuationCalculatorService');
    // ValuationCalculatorService.ts のモジュールスコープ変数をリセット
    // Note: require キャッシュ経由では直接変数にはアクセス不可のため、
    //       サービスクラスに clearCache 静的メソッドを追加する方式を使う
    if (typeof svcModule.clearConstructionPriceCache === 'function') {
      svcModule.clearConstructionPriceCache();
      res.json({ message: 'キャッシュをクリアしました。次のリクエストから新単価が使用されます。' });
    } else {
      res.json({ message: 'キャッシュクリア不可（関数未実装）。TTL 6h 後に自動更新されます。', ttl: '6 hours' });
    }
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

export default router;
