import { Router, Request, Response } from 'express';
import { query, body, validationResult } from 'express-validator';
import { ActivityLogService, LogFilter } from '../services/ActivityLogService';
import { authenticate, requireRole } from '../middleware/auth';

const router = Router();
const activityLogService = new ActivityLogService();

// 全てのルートに認証を適用
router.use(authenticate);

/**
 * 活動ログを取得
 */
router.get(
  '/',
  [
    query('employeeId').optional().isUUID().withMessage('Invalid employee ID'),
    query('dateFrom').optional().isISO8601().withMessage('Invalid date format'),
    query('dateTo').optional().isISO8601().withMessage('Invalid date format'),
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

      const filter: LogFilter = {
        employeeId: req.query.employeeId as string,
        dateFrom: req.query.dateFrom ? new Date(req.query.dateFrom as string) : undefined,
        dateTo: req.query.dateTo ? new Date(req.query.dateTo as string) : undefined,
        activityType: req.query.activityType as string,
        sellerId: req.query.sellerId as string,
        targetType: req.query.target_type as string,
        targetId: req.query.target_id as string,
      };

      const logs = await activityLogService.getLogs(filter);
      res.json(logs);
    } catch (error) {
      console.error('Get activity logs error:', error);
      res.status(500).json({
        error: {
          code: 'GET_LOGS_ERROR',
          message: 'Failed to get activity logs',
          retryable: true,
        },
      });
    }
  }
);

/**
 * 活動統計を取得
 */
router.get(
  '/statistics',
  requireRole('admin', 'agent'),
  [
    query('dateFrom').optional().isISO8601().withMessage('Invalid date format'),
    query('dateTo').optional().isISO8601().withMessage('Invalid date format'),
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

      const dateFrom = req.query.dateFrom ? new Date(req.query.dateFrom as string) : undefined;
      const dateTo = req.query.dateTo ? new Date(req.query.dateTo as string) : undefined;

      const statistics = await activityLogService.getStatistics(dateFrom, dateTo);
      res.json(statistics);
    } catch (error) {
      console.error('Get statistics error:', error);
      res.status(500).json({
        error: {
          code: 'GET_STATISTICS_ERROR',
          message: 'Failed to get statistics',
          retryable: true,
        },
      });
    }
  }
);

/**
 * メール送信履歴を記録
 */
router.post(
  '/email',
  [
    body('buyerId').optional().isString().withMessage('Invalid buyer ID'),
    body('sellerId').optional().isString().withMessage('Invalid seller ID'),
    body('propertyNumbers').isArray().withMessage('Property numbers must be an array'),
    body('recipientEmail').isEmail().withMessage('Invalid recipient email'),
    body('subject').isString().notEmpty().withMessage('Subject is required'),
    body('templateName').optional().isString().withMessage('Invalid template name'),
    body('senderEmail').isEmail().withMessage('Invalid sender email'),
    body('source').optional().isString().withMessage('Invalid source'),
    body('preViewingNotes').optional().isString().withMessage('Invalid pre-viewing notes'),
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

      const { buyerId, sellerId, propertyNumbers, recipientEmail, subject, templateName, senderEmail, source, preViewingNotes } = req.body;

      // buyerIdまたはsellerIdのいずれかが必須
      if (!buyerId && !sellerId) {
        return res.status(400).json({
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Either buyerId or sellerId is required',
            retryable: false,
          },
        });
      }

      // 認証されたユーザーIDを取得
      const createdBy = (req as any).user?.id;
      if (!createdBy) {
        return res.status(401).json({
          error: {
            code: 'UNAUTHORIZED',
            message: 'User not authenticated',
            retryable: false,
          },
        });
      }

      await activityLogService.logEmail({
        buyerId,
        sellerId,
        propertyNumbers,
        recipientEmail,
        subject,
        templateName,
        senderEmail,
        source,
        preViewingNotes,
        createdBy,
      });

      res.status(201).json({ success: true });
    } catch (error) {
      console.error('Log email error:', error);
      res.status(500).json({
        error: {
          code: 'LOG_EMAIL_ERROR',
          message: 'Failed to log email',
          retryable: true,
        },
      });
    }
  }
);

/**
 * 活動ログ（SMS履歴など）を削除
 * 買主詳細ページのSMS履歴を「×」で消すために使用。
 * 誤削除防止のため target_type / target_id / action で照合する。
 */
router.delete('/:activityId', async (req: Request, res: Response) => {
  try {
    const { activityId } = req.params;
    const targetType = req.query.target_type as string | undefined;
    const targetId = req.query.target_id as string | undefined;
    const action = req.query.action as string | undefined;

    if (
      !activityId ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(activityId)
    ) {
      return res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid activity ID',
          retryable: false,
        },
      });
    }

    if (!targetType || !targetId) {
      return res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'target_type and target_id are required',
          retryable: false,
        },
      });
    }

    const deleted = await activityLogService.deleteActivityLog({
      activityId,
      targetType,
      targetId,
      action,
    });

    if (!deleted) {
      return res.status(404).json({
        error: {
          code: 'ACTIVITY_NOT_FOUND',
          message: '履歴が見つかりません',
          retryable: false,
        },
      });
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Delete activity log error:', error);
    res.status(500).json({
      error: {
        code: 'DELETE_ACTIVITY_ERROR',
        message: '履歴の削除に失敗しました',
        retryable: true,
      },
    });
  }
});

export default router;
