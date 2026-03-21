import { Router, Request, Response } from 'express';
import { body, validationResult } from 'express-validator';
import { FollowUpService } from '../services/FollowUpService.supabase';
import { invalidateListSellersCache } from '../services/SellerService.supabase';
import { authenticate } from '../middleware/auth';
import { ActivityType, ConfidenceLevel } from '../types';

const router = Router();
const followUpService = new FollowUpService();

// 活動履歴のインメモリキャッシュ（TTL: 60秒）
const activitiesCache = new Map<string, { data: any[]; expiresAt: number }>();
const ACTIVITIES_CACHE_TTL_MS = 60 * 1000; // 60秒

function getActivitiesCache(sellerId: string): any[] | null {
  const entry = activitiesCache.get(sellerId);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    activitiesCache.delete(sellerId);
    return null;
  }
  return entry.data;
}

function setActivitiesCache(sellerId: string, data: any[]): void {
  activitiesCache.set(sellerId, { data, expiresAt: Date.now() + ACTIVITIES_CACHE_TTL_MS });
}

function invalidateActivitiesCache(sellerId: string): void {
  activitiesCache.delete(sellerId);
}

// 全てのルートに認証を適用
router.use(authenticate);

/**
 * 追客活動を記録
 */
router.post(
  '/:sellerId/activities',
  [
    body('type').isIn(Object.values(ActivityType)).withMessage('Invalid activity type'),
    body('content').notEmpty().withMessage('Content is required'),
  ],
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Validation failed',
            details: errors.array(),
            retryable: false,
          },
        });
      }

      const { sellerId } = req.params;
      const { type, content, result, metadata } = req.body;

      const activity = await followUpService.recordActivity({
        sellerId,
        employeeId: req.employee!.id,
        type,
        content,
        result,
        metadata,
      });
      // 新規活動を記録したのでキャッシュを無効化
      invalidateActivitiesCache(sellerId);
      // phone_call の場合は売主一覧の lastCalledAt キャッシュも無効化
      if (type === 'phone_call') {
        invalidateListSellersCache();
        // 売主追客ログスプレッドシートに非同期で追記（失敗してもレスポンスには影響しない）
        appendCallLogToSpreadsheet(
          activity.id,
          sellerId,
          req.employee!.initials || req.employee!.name,
          new Date(activity.created_at)
        ).catch((err: any) => {
          console.error('[CallLog] Failed to append to spreadsheet:', err.message);
        });
      }
      res.status(201).json(activity);
    } catch (error) {
      console.error('Record activity error:', error);
      res.status(500).json({
        error: {
          code: 'RECORD_ACTIVITY_ERROR',
          message: 'Failed to record activity',
          retryable: true,
        },
      });
    }
  }
);

/**
 * 追客履歴を取得
 */
router.get('/:sellerId/activities', async (req: Request, res: Response) => {
  try {
    const { sellerId } = req.params;
    const typeFilter = req.query.type as string | undefined;

    // キャッシュキーにtypeフィルタを含める
    const cacheKey = typeFilter ? `${sellerId}:${typeFilter}` : sellerId;

    // キャッシュを確認（60秒TTL）
    const cached = getActivitiesCache(cacheKey);
    if (cached) {
      return res.json(cached);
    }

    const activities = await followUpService.getActivityHistory(sellerId, typeFilter);
    setActivitiesCache(cacheKey, activities);
    res.json(activities);
  } catch (error) {
    console.error('Get activity history error:', error);
    res.status(500).json({
      error: {
        code: 'GET_ACTIVITY_HISTORY_ERROR',
        message: 'Failed to get activity history',
        retryable: true,
      },
    });
  }
});

/**
 * ヒアリング内容を記録
 */
router.post(
  '/:sellerId/hearing',
  [body('content').notEmpty().withMessage('Hearing content is required')],
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Validation failed',
            details: errors.array(),
            retryable: false,
          },
        });
      }

      const { sellerId } = req.params;
      const { content, metadata } = req.body;

      const activity = await followUpService.recordHearing({
        sellerId,
        employeeId: req.employee!.id,
        content,
        metadata,
      });
      // ヒアリング記録したのでキャッシュを無効化
      invalidateActivitiesCache(sellerId);
      res.status(201).json(activity);
    } catch (error) {
      console.error('Record hearing error:', error);
      res.status(500).json({
        error: {
          code: 'RECORD_HEARING_ERROR',
          message: 'Failed to record hearing',
          retryable: true,
        },
      });
    }
  }
);

/**
 * 次電日を設定
 */
router.put(
  '/:sellerId/next-call-date',
  [body('date').isISO8601().withMessage('Invalid date format')],
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Validation failed',
            details: errors.array(),
            retryable: false,
          },
        });
      }

      const { sellerId } = req.params;
      const { date } = req.body;

      await followUpService.setNextCallDate(sellerId, new Date(date));
      res.json({ message: 'Next call date updated successfully' });
    } catch (error) {
      console.error('Set next call date error:', error);
      res.status(500).json({
        error: {
          code: 'SET_NEXT_CALL_DATE_ERROR',
          message: 'Failed to set next call date',
          retryable: true,
        },
      });
    }
  }
);

/**
 * 確度を更新
 */
router.put(
  '/:sellerId/confidence',
  [
    body('level')
      .isIn(Object.values(ConfidenceLevel))
      .withMessage('Invalid confidence level'),
  ],
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Validation failed',
            details: errors.array(),
            retryable: false,
          },
        });
      }

      const { sellerId } = req.params;
      const { level } = req.body;

      await followUpService.updateConfidence(sellerId, level);
      res.json({ message: 'Confidence level updated successfully' });
    } catch (error) {
      console.error('Update confidence error:', error);
      res.status(500).json({
        error: {
          code: 'UPDATE_CONFIDENCE_ERROR',
          message: 'Failed to update confidence level',
          retryable: true,
        },
      });
    }
  }
);

/**
 * 売主追客ログスプレッドシートに通話ログを追記する
 * スプレッドシートID: 1wKBRLWbT6pSKa9IlTDabjhjTnfs_GxX6Rn6M6kbio1I
 * シート名: 売主追客ログ
 * A列: 日付時間（JST）, B列: キー（activity UUID先頭8文字）, C列: 売主番号, E列: 担当イニシャル
 */
async function appendCallLogToSpreadsheet(
  activityId: string,
  sellerId: string,
  initials: string,
  createdAt: Date
): Promise<void> {
  // 売主番号を取得
  const supabase = (await import('../config/supabase')).default;
  const { data: seller, error } = await supabase
    .from('sellers')
    .select('seller_number')
    .eq('id', sellerId)
    .single();

  if (error || !seller) {
    throw new Error(`Seller not found for id: ${sellerId}`);
  }

  const sellerNumber = seller.seller_number;

  // JST日時文字列を生成
  const jstDate = new Date(createdAt.getTime() + 9 * 60 * 60 * 1000);
  const jstDateString = jstDate.toISOString().replace('T', ' ').substring(0, 19);

  // Google Sheets クライアントを初期化
  const { GoogleSheetsClient } = await import('../services/GoogleSheetsClient');
  const sheetsClient = new GoogleSheetsClient({
    spreadsheetId: '1wKBRLWbT6pSKa9IlTDabjhjTnfs_GxX6Rn6M6kbio1I',
    sheetName: '売主追客ログ',
    serviceAccountKeyPath: process.env.GOOGLE_SERVICE_ACCOUNT_KEY_PATH || './google-service-account.json',
  });

  await sheetsClient.authenticate();

  // 追記するデータ（ヘッダーに合わせた列名で指定）
  const rowData: Record<string, string> = {
    '日付': jstDateString,
    '売主追客ログ': activityId.substring(0, 8),
    '売主番号': sellerNumber,
    '担当（前半）': initials,
  };

  await sheetsClient.appendRow(rowData);
  console.log(`[CallLog] Appended to spreadsheet: ${sellerNumber} by ${initials} at ${jstDateString}`);
}

export default router;
