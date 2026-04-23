import { Router, Request, Response } from 'express';
import { WorkTaskService } from '../services/WorkTaskService';
import { WorkTaskSyncService } from '../services/WorkTaskSyncService';
import { WorkTaskEmailNotificationService } from '../services/WorkTaskEmailNotificationService';

const router = Router();
const workTaskService = new WorkTaskService();
const workTaskSyncService = new WorkTaskSyncService();
const emailNotificationService = new WorkTaskEmailNotificationService();

/**
 * GET /api/work-tasks
 * 業務依頼データ一覧を取得
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || 100;
    const offset = parseInt(req.query.offset as string) || 0;
    const orderBy = (req.query.orderBy as string) || 'created_at';
    const orderDirection = (req.query.orderDirection as string) === 'asc' ? 'asc' : 'desc';

    const workTasks = await workTaskService.list({
      limit,
      offset,
      orderBy,
      orderDirection,
    });

    const total = await workTaskService.count();

    res.json({
      data: workTasks,
      total,
      limit,
      offset,
    });
  } catch (error: any) {
    console.error('業務依頼データ一覧取得エラー:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/work-tasks/mediation-revisions?creator=K&exclude=AA1234
 * 媒介契約修正履歴を取得（creatorなしで全件、creatorありで絞り込み）
 */
router.get('/mediation-revisions', async (req: Request, res: Response) => {
  try {
    const creator = req.query.creator as string | undefined;
    const exclude = req.query.exclude as string | undefined;

    const revisions = await workTaskService.getMediationRevisionsByCreator(creator, exclude);
    return res.json(revisions);
  } catch (error: any) {
    console.error('媒介修正履歴取得エラー:', error);
    return res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/work-tasks/site-registration-revisions
 * サイト登録修正履歴を取得
 */
router.get('/site-registration-revisions', async (req: Request, res: Response) => {
  try {
    const exclude = req.query.exclude as string | undefined;
    const revisions = await workTaskService.getSiteRegistrationRevisions(exclude);
    return res.json(revisions);
  } catch (error: any) {
    console.error('サイト登録修正履歴取得エラー:', error);
    return res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/work-tasks/floor-plan-revision-corrections
 * 間取図修正（当社ミス）履歴を取得
 */
router.get('/floor-plan-revision-corrections', async (req: Request, res: Response) => {
  try {
    const exclude = req.query.exclude as string | undefined;
    const revisions = await workTaskService.getFloorPlanRevisionCorrections(exclude);
    return res.json(revisions);
  } catch (error: any) {
    console.error('間取図修正履歴取得エラー:', error);
    return res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/work-tasks/:propertyNumber
 * 物件番号で業務依頼データを取得
 */
router.get('/:propertyNumber', async (req: Request, res: Response) => {
  try {
    const { propertyNumber } = req.params;
    const workTask = await workTaskService.getByPropertyNumber(propertyNumber);

    if (!workTask) {
      return res.status(404).json({
        error: '業務依頼データが見つかりません',
        propertyNumber,
      });
    }

    return res.json(workTask);
  } catch (error: any) {
    console.error('業務依頼データ取得エラー:', error);
    return res.status(500).json({ error: error.message });
  }
});

/**
 * PUT /api/work-tasks/:propertyNumber
 * 物件番号で業務依頼データを更新
 */
router.put('/:propertyNumber', async (req: Request, res: Response) => {
  try {
    const { propertyNumber } = req.params;
    const updates = req.body;

    // 物件番号は更新不可
    delete updates.property_number;
    delete updates.id;
    delete updates.created_at;

    // 保存前の値を取得（メール通知の変更検知に使用）
    const beforeData = await workTaskService.getByPropertyNumber(propertyNumber);

    const workTask = await workTaskService.updateByPropertyNumber(propertyNumber, updates);

    if (!workTask) {
      return res.status(404).json({
        error: '業務依頼データが見つかりません',
        propertyNumber,
      });
    }

    // DB→スプシ書き戻し（非同期・失敗してもレスポンスには影響しない）
    workTaskSyncService.writeBackToSpreadsheet(propertyNumber, updates).catch((e) =>
      console.error('スプシ書き戻しエラー:', e.message)
    );

    // レスポンスを返す（メール送信を待たない）
    res.json({
      message: '更新が完了しました',
      data: workTask,
    });

    // メール通知（非同期・失敗しても保存に影響しない）
    emailNotificationService
      .processEmailNotifications(propertyNumber, beforeData ?? {}, workTask ?? {})
      .catch((e) => console.error('[WorkTaskEmail] 通知処理エラー:', e.message));

    return;
  } catch (error: any) {
    console.error('業務依頼データ更新エラー:', error);
    return res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/work-tasks/sync
 * 全データを同期
 */
router.post('/sync', async (_req: Request, res: Response) => {
  try {
    console.log('業務依頼データ同期開始...');
    const result = await workTaskSyncService.syncAll();

    console.log(`同期完了: 成功=${result.successCount}, エラー=${result.errorCount}`);

    return res.json({
      message: '同期が完了しました',
      result,
    });
  } catch (error: any) {
    console.error('業務依頼データ同期エラー:', error);
    return res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/work-tasks/sync/:propertyNumber
 * 単一の物件番号でデータを同期
 */
router.post('/sync/:propertyNumber', async (req: Request, res: Response) => {
  try {
    const { propertyNumber } = req.params;
    const workTask = await workTaskSyncService.syncByPropertyNumber(propertyNumber);

    if (!workTask) {
      return res.status(404).json({
        error: 'スプレッドシートに該当データが見つかりません',
        propertyNumber,
      });
    }

    return res.json({
      message: '同期が完了しました',
      data: workTask,
    });
  } catch (error: any) {
    console.error('業務依頼データ同期エラー:', error);
    return res.status(500).json({ error: error.message });
  }
});

export default router;
