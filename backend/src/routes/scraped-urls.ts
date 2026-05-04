import { Router, Request, Response } from 'express';
import { ScrapedUrlService } from '../services/ScrapedUrlService';

const router = Router();
const scrapedUrlService = new ScrapedUrlService();

/**
 * URLの重複チェック
 * POST /api/scraped-urls/check-duplicate
 */
router.post('/check-duplicate', async (req: Request, res: Response) => {
  try {
    const { url } = req.body;

    if (!url) {
      return res.status(400).json({
        success: false,
        error: 'URLが指定されていません',
      });
    }

    const result = await scrapedUrlService.checkDuplicate(url);

    return res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error('Error checking duplicate URL:', error);
    return res.status(500).json({
      success: false,
      error: 'URLの重複チェックに失敗しました',
    });
  }
});

/**
 * 物件番号での重複チェック
 * POST /api/scraped-urls/check-duplicate-by-property-number
 */
router.post(
  '/check-duplicate-by-property-number',
  async (req: Request, res: Response) => {
    try {
      const { propertyNumber, sourceSite } = req.body;

      if (!propertyNumber) {
        return res.status(400).json({
          success: false,
          error: '物件番号が指定されていません',
        });
      }

      const result = await scrapedUrlService.checkDuplicateByPropertyNumber(
        propertyNumber,
        sourceSite || 'athome'
      );

      return res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      console.error('Error checking duplicate by property number:', error);
      return res.status(500).json({
        success: false,
        error: '物件番号での重複チェックに失敗しました',
      });
    }
  }
);

/**
 * スクレイピングしたURLを保存
 * POST /api/scraped-urls
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    const {
      url,
      referenceUrl,
      scrapedResultUrl,
      propertyNumber,
      sourceSite,
      title,
      price,
      address,
    } = req.body;

    if (!url || !sourceSite) {
      return res.status(400).json({
        success: false,
        error: 'URLとsourceSiteは必須です',
      });
    }

    await scrapedUrlService.saveScrapedUrl({
      url,
      referenceUrl,
      scrapedResultUrl,
      propertyNumber,
      sourceSite,
      title,
      price,
      address,
    });

    return res.json({
      success: true,
      message: 'スクレイピングしたURLを保存しました',
    });
  } catch (error) {
    console.error('Error saving scraped URL:', error);
    return res.status(500).json({
      success: false,
      error: 'URLの保存に失敗しました',
    });
  }
});

/**
 * 掲載済みとしてマーク
 * PUT /api/scraped-urls/:url/mark-as-posted
 */
router.put('/:url/mark-as-posted', async (req: Request, res: Response) => {
  try {
    const { url } = req.params;
    const decodedUrl = decodeURIComponent(url);

    await scrapedUrlService.markAsPosted(decodedUrl);

    return res.json({
      success: true,
      message: '掲載済みとしてマークしました',
    });
  } catch (error) {
    console.error('Error marking URL as posted:', error);
    return res.status(500).json({
      success: false,
      error: '掲載済みマークに失敗しました',
    });
  }
});

/**
 * 未掲載のスクレイピング済みURLを取得
 * GET /api/scraped-urls/unposted
 */
router.get('/unposted', async (req: Request, res: Response) => {
  try {
    const { sourceSite } = req.query;

    const urls = await scrapedUrlService.getUnpostedUrls(
      sourceSite as string | undefined
    );

    return res.json({
      success: true,
      data: urls,
    });
  } catch (error) {
    console.error('Error getting unposted URLs:', error);
    return res.status(500).json({
      success: false,
      error: '未掲載URLの取得に失敗しました',
    });
  }
});

/**
 * スクレイピング履歴を取得
 * GET /api/scraped-urls/history
 */
router.get('/history', async (req: Request, res: Response) => {
  try {
    const { limit, sourceSite } = req.query;

    const history = await scrapedUrlService.getScrapingHistory(
      limit ? parseInt(limit as string) : 50,
      sourceSite as string | undefined
    );

    return res.json({
      success: true,
      data: history,
    });
  } catch (error) {
    console.error('Error getting scraping history:', error);
    return res.status(500).json({
      success: false,
      error: 'スクレイピング履歴の取得に失敗しました',
    });
  }
});

export default router;
