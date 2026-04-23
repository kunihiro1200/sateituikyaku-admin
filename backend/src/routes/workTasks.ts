import { Router, Request, Response } from 'express';
import { createClient } from '@supabase/supabase-js';
import axios from 'axios';
import { WorkTaskService } from '../services/WorkTaskService';
import { WorkTaskSyncService } from '../services/WorkTaskSyncService';
import { WorkTaskEmailNotificationService } from '../services/WorkTaskEmailNotificationService';
import { StaffManagementService } from '../services/StaffManagementService';

// 決済完了チャット専用Webhook URL
const SETTLEMENT_CHAT_WEBHOOK_URL = 'https://chat.googleapis.com/v1/spaces/AAAAEZtcLfM/messages?key=AIzaSyDdI0hCZtE6vySjMm-WEfRq3CPzqKqqsHI&token=jpLkd-Tp1o9mPLCWA4YMyu-Te_fX4lymfoyj_qFnzLY';

const router = Router();
const workTaskService = new WorkTaskService();
const workTaskSyncService = new WorkTaskSyncService();
const emailNotificationService = new WorkTaskEmailNotificationService();
const staffManagementService = new StaffManagementService();

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

    // list と count を並列実行してレスポンスを高速化
    const [workTasks, total] = await Promise.all([
      workTaskService.list({
        limit,
        offset,
        orderBy,
        orderDirection,
      }),
      workTaskService.count(),
    ]);

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

    // 修正内容が空になった場合、対応する「あり」フラグも自動リセット
    if ('site_registration_revision_content' in updates && (updates.site_registration_revision_content ?? '').toString().trim() === '') {
      updates.site_registration_revision_content = null;
      updates.site_registration_revision = null;
    }
    if ('mediation_revision_content' in updates && (updates.mediation_revision_content ?? '').toString().trim() === '') {
      updates.mediation_revision_content = null;
      updates.mediation_revision = null;
    }
    if ('floor_plan_revision_correction_content' in updates && (updates.floor_plan_revision_correction_content ?? '').toString().trim() === '') {
      updates.floor_plan_revision_correction_content = null;
      updates.floor_plan_revision_correction = null;
    }
    if ('contract_revision_content' in updates && (updates.contract_revision_content ?? '').toString().trim() === '') {
      updates.contract_revision_content = null;
      updates.contract_revision_exists = null;
    }

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

/**
 * GET /api/work-tasks/:propertyNumber/email-history
 * 業務詳細のEmail送信履歴を取得
 * sellers.seller_number = propertyNumber で seller.id を取得し、
 * activity_logs から email アクションの履歴を返す
 */
router.get('/:propertyNumber/email-history', async (req: Request, res: Response) => {
  try {
    const { propertyNumber } = req.params;

    const supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_KEY!
    );

    // seller_number で seller.id を取得
    const { data: seller, error: sellerError } = await supabase
      .from('sellers')
      .select('id')
      .eq('seller_number', propertyNumber)
      .single();

    if (sellerError || !seller) {
      // 売主が見つからない場合は空配列を返す（エラーにしない）
      return res.json({ emailHistory: [] });
    }

    // activity_logs から email アクションの履歴を取得
    const { data: logs, error: logsError } = await supabase
      .from('activity_logs')
      .select('id, created_at, metadata, employee:employees(id, name, initials)')
      .eq('target_type', 'seller')
      .eq('target_id', seller.id)
      .eq('action', 'email')
      .order('created_at', { ascending: false })
      .limit(50);

    if (logsError) {
      console.error('Email履歴取得エラー:', logsError);
      return res.status(500).json({ error: logsError.message });
    }

    const emailHistory = (logs || []).map((log: any) => ({
      id: log.id,
      sentAt: log.created_at,
      subject: log.metadata?.subject || '',
      body: log.metadata?.body || '',
      templateName: log.metadata?.templateName || '',
      recipientEmail: log.metadata?.recipient_email || '',
      senderEmail: log.metadata?.sender_email || '',
      senderName: log.employee?.name || log.employee?.initials || log.metadata?.sender_email || '',
      senderInitials: log.employee?.initials || '',
    }));

    return res.json({ emailHistory });
  } catch (error: any) {
    console.error('Email履歴取得エラー:', error);
    return res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/work-tasks/:propertyNumber/send-settlement-chat
 * 決済完了チャット送信
 * type: 'settlement' → 決済完了チャット専用URLへ送信
 * type: 'staff' → スタッフ管理シートのChatへ送信（staffNameで担当者を特定）
 */
router.post('/:propertyNumber/send-settlement-chat', async (req: Request, res: Response) => {
  try {
    const { propertyNumber } = req.params;
    const { type, staffName, message } = req.body;

    if (!type || !message) {
      return res.status(400).json({ error: 'type と message は必須です' });
    }

    let webhookUrl: string;

    if (type === 'settlement') {
      // 決済完了チャット専用URL
      webhookUrl = SETTLEMENT_CHAT_WEBHOOK_URL;
    } else if (type === 'staff') {
      // スタッフ管理シートからWebhook URLを取得
      if (!staffName) {
        return res.status(400).json({ error: 'staffName は type=staff の場合に必須です' });
      }
      const result = await staffManagementService.getWebhookUrl(staffName);
      if (!result.success || !result.webhookUrl) {
        return res.status(400).json({ error: result.error || 'Webhook URLの取得に失敗しました' });
      }
      webhookUrl = result.webhookUrl;
    } else {
      return res.status(400).json({ error: '無効な type です。settlement または staff を指定してください' });
    }

    const response = await axios.post(webhookUrl, { text: message }, {
      headers: { 'Content-Type': 'application/json' },
    });

    if (response.status < 200 || response.status >= 300) {
      throw new Error(`Google Chat APIエラー: ${response.status}`);
    }

    console.log(`[WorkTask] チャット送信成功: ${propertyNumber} type=${type} staffName=${staffName || '-'}`);
    return res.json({ success: true, message: 'チャットを送信しました' });
  } catch (error: any) {
    console.error('[WorkTask] チャット送信エラー:', error.message);
    return res.status(500).json({ error: error.message });
  }
});

export default router;
