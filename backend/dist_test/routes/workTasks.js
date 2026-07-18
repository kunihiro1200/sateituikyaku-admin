"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const supabase_js_1 = require("@supabase/supabase-js");
const axios_1 = __importDefault(require("axios"));
const WorkTaskService_1 = require("../services/WorkTaskService");
const WorkTaskSyncService_1 = require("../services/WorkTaskSyncService");
const WorkTaskEmailNotificationService_1 = require("../services/WorkTaskEmailNotificationService");
const StaffManagementService_1 = require("../services/StaffManagementService");
// FloorPlanCompareService は動的importで読み込む（起動時エラー防止）
// 決済完了チャット専用Webhook URL
const SETTLEMENT_CHAT_WEBHOOK_URL = 'https://chat.googleapis.com/v1/spaces/AAAAEZtcLfM/messages?key=AIzaSyDdI0hCZtE6vySjMm-WEfRq3CPzqKqqsHI&token=jpLkd-Tp1o9mPLCWA4YMyu-Te_fX4lymfoyj_qFnzLY';
const router = (0, express_1.Router)();
const workTaskService = new WorkTaskService_1.WorkTaskService();
const workTaskSyncService = new WorkTaskSyncService_1.WorkTaskSyncService();
const emailNotificationService = new WorkTaskEmailNotificationService_1.WorkTaskEmailNotificationService();
const staffManagementService = new StaffManagementService_1.StaffManagementService();
/**
 * GET /api/work-tasks
 * 業務依頼データ一覧を取得
 */
router.get('/', async (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 100;
        const offset = parseInt(req.query.offset) || 0;
        const orderBy = req.query.orderBy || 'created_at';
        const orderDirection = req.query.orderDirection === 'asc' ? 'asc' : 'desc';
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
    }
    catch (error) {
        console.error('業務依頼データ一覧取得エラー:', error);
        res.status(500).json({ error: error.message });
    }
});
/**
 * GET /api/work-tasks/mediation-revisions?creator=K&exclude=AA1234
 * 媒介契約修正履歴を取得（creatorなしで全件、creatorありで絞り込み）
 */
router.get('/mediation-revisions', async (req, res) => {
    try {
        const creator = req.query.creator;
        const exclude = req.query.exclude;
        const revisions = await workTaskService.getMediationRevisionsByCreator(creator, exclude);
        return res.json(revisions);
    }
    catch (error) {
        console.error('媒介修正履歴取得エラー:', error);
        return res.status(500).json({ error: error.message });
    }
});
/**
 * GET /api/work-tasks/site-registration-revisions
 * サイト登録修正履歴を取得
 */
router.get('/site-registration-revisions', async (req, res) => {
    try {
        const exclude = req.query.exclude;
        const revisions = await workTaskService.getSiteRegistrationRevisions(exclude);
        return res.json(revisions);
    }
    catch (error) {
        console.error('サイト登録修正履歴取得エラー:', error);
        return res.status(500).json({ error: error.message });
    }
});
/**
 * GET /api/work-tasks/floor-plan-revision-corrections
 * 間取図修正（当社ミス）履歴を取得
 */
router.get('/floor-plan-revision-corrections', async (req, res) => {
    try {
        const exclude = req.query.exclude;
        const revisions = await workTaskService.getFloorPlanRevisionCorrections(exclude);
        return res.json(revisions);
    }
    catch (error) {
        console.error('間取図修正履歴取得エラー:', error);
        return res.status(500).json({ error: error.message });
    }
});
/**
 * GET /api/work-tasks/:propertyNumber
 * 物件番号で業務依頼データを取得
 */
router.get('/:propertyNumber', async (req, res) => {
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
    }
    catch (error) {
        console.error('業務依頼データ取得エラー:', error);
        return res.status(500).json({ error: error.message });
    }
});
/**
 * PUT /api/work-tasks/:propertyNumber
 * 物件番号で業務依頼データを更新
 */
router.put('/:propertyNumber', async (req, res) => {
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
        workTaskSyncService.writeBackToSpreadsheet(propertyNumber, updates).catch((e) => console.error('スプシ書き戻しエラー:', e.message));
        // メール通知（先に実行してからレスポンスを返す）
        try {
            await emailNotificationService.processEmailNotifications(propertyNumber, beforeData ?? {}, workTask ?? {});
        }
        catch (e) {
            console.error('[WorkTaskEmail] 通知処理エラー:', e.message);
        }
        // レスポンスを返す
        res.json({
            message: '更新が完了しました',
            data: workTask,
        });
        return;
    }
    catch (error) {
        console.error('業務依頼データ更新エラー:', error);
        return res.status(500).json({ error: error.message });
    }
});
/**
 * POST /api/work-tasks/manual-sync
 * 手動転記実行：①コード.gs（スプシ→業務依頼集計表）→ ②GyomuWorkTaskSync.gs（集計表→DB）を順番に実行
 */
router.post('/manual-sync', async (_req, res) => {
    // GAS Web App URLs
    const STEP1_URL = 'https://script.google.com/macros/s/AKfycbw7WZf6b4f9zjBKS1QWKNBQUKGaw4E_XFDikSesvp49jxGuHAMKgDRUMhhYxZ1vqDc/exec';
    const STEP2_URL = 'https://script.google.com/macros/s/AKfycbz84oQQ6sI4rcKFFGHYbEFEwpex1J0RTrnoCTgN5xn_HQ-Q7EXItc5T1ei-E_bi/exec';
    try {
        console.log('[manual-sync] ステップ1開始: コード.gs（スプシ→業務依頼集計表）');
        const step1Res = await axios_1.default.get(STEP1_URL, { timeout: 300000 }); // 5分タイムアウト
        const step1Data = step1Res.data;
        console.log('[manual-sync] ステップ1完了:', step1Data);
        if (step1Data?.success === false) {
            return res.status(500).json({
                step: 1,
                error: 'ステップ1（スプシ→業務依頼集計表）でエラーが発生しました',
                detail: step1Data.error,
            });
        }
        console.log('[manual-sync] ステップ2開始: GyomuWorkTaskSync.gs（集計表→DB）');
        const step2Res = await axios_1.default.get(STEP2_URL, { timeout: 300000 });
        const step2Data = step2Res.data;
        console.log('[manual-sync] ステップ2完了:', step2Data);
        if (step2Data?.success === false) {
            return res.status(500).json({
                step: 2,
                error: 'ステップ2（集計表→DB）でエラーが発生しました',
                detail: step2Data.error,
            });
        }
        return res.json({
            success: true,
            message: '転記が完了しました（スプシ→集計表→DB）',
            step1: step1Data,
            step2: step2Data,
        });
    }
    catch (error) {
        console.error('[manual-sync] エラー:', error);
        return res.status(500).json({ error: error.message });
    }
});
/**
 * POST /api/work-tasks/sync
 * 全データを同期
 */
router.post('/sync', async (_req, res) => {
    try {
        console.log('業務依頼データ同期開始...');
        const result = await workTaskSyncService.syncAll();
        console.log(`同期完了: 成功=${result.successCount}, エラー=${result.errorCount}`);
        return res.json({
            message: '同期が完了しました',
            result,
        });
    }
    catch (error) {
        console.error('業務依頼データ同期エラー:', error);
        return res.status(500).json({ error: error.message });
    }
});
/**
 * POST /api/work-tasks/sync/:propertyNumber
 * 単一の物件番号でデータを同期
 */
router.post('/sync/:propertyNumber', async (req, res) => {
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
    }
    catch (error) {
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
router.get('/:propertyNumber/email-history', async (req, res) => {
    try {
        const { propertyNumber } = req.params;
        const supabase = (0, supabase_js_1.createClient)(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);
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
        const emailHistory = (logs || []).map((log) => ({
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
    }
    catch (error) {
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
router.post('/:propertyNumber/send-settlement-chat', async (req, res) => {
    try {
        const { propertyNumber } = req.params;
        const { type, staffName, message } = req.body;
        if (!type || !message) {
            return res.status(400).json({ error: 'type と message は必須です' });
        }
        let webhookUrl;
        if (type === 'settlement') {
            // 決済完了チャット専用URL
            webhookUrl = SETTLEMENT_CHAT_WEBHOOK_URL;
        }
        else if (type === 'staff') {
            // スタッフ管理シートからWebhook URLを取得
            if (!staffName) {
                return res.status(400).json({ error: 'staffName は type=staff の場合に必須です' });
            }
            const result = await staffManagementService.getWebhookUrl(staffName);
            if (!result.success || !result.webhookUrl) {
                return res.status(400).json({ error: result.error || 'Webhook URLの取得に失敗しました' });
            }
            webhookUrl = result.webhookUrl;
        }
        else {
            return res.status(400).json({ error: '無効な type です。settlement または staff を指定してください' });
        }
        const response = await axios_1.default.post(webhookUrl, { text: message }, {
            headers: { 'Content-Type': 'application/json' },
        });
        if (response.status < 200 || response.status >= 300) {
            throw new Error(`Google Chat APIエラー: ${response.status}`);
        }
        console.log(`[WorkTask] チャット送信成功: ${propertyNumber} type=${type} staffName=${staffName || '-'}`);
        return res.json({ success: true, message: 'チャットを送信しました' });
    }
    catch (error) {
        console.error('[WorkTask] チャット送信エラー:', error.message);
        return res.status(500).json({ error: error.message });
    }
});
/**
 * POST /api/work-tasks/floor-plan-compare-run
 * 【STEP2】スプシ内のGASボタンまたは業務詳細画面から呼ぶ
 * フォルダ内の図面をAIで比較してスプシに結果を書き込む
 * 認証: FLOOR_PLAN_API_KEY（環境変数）またはCRON_SECRET
 * ⚠️ /:propertyNumber より前に定義すること（ルーティング競合防止）
 */
router.post('/floor-plan-compare-run', async (req, res) => {
    try {
        // 認証: FLOOR_PLAN_API_KEY または CRON_SECRET のどちらかが一致すればOK
        const authHeader = req.headers.authorization;
        const floorPlanKey = process.env.FLOOR_PLAN_API_KEY;
        const cronSecret = process.env.CRON_SECRET;
        const isAuthorized = (floorPlanKey && authHeader === `Bearer ${floorPlanKey}`) ||
            (cronSecret && authHeader === `Bearer ${cronSecret}`);
        if (!isAuthorized) {
            return res.status(401).json({ success: false, error: '認証エラー' });
        }
        const { spreadsheetId, folderId, propertyNumber } = req.body;
        if (!spreadsheetId || !folderId || !propertyNumber) {
            return res.status(400).json({ error: 'spreadsheetId, folderId, propertyNumber は必須です' });
        }
        console.log(`[FloorPlanCompare] AI比較開始: ${propertyNumber}, フォルダ: ${folderId}`);
        const { FloorPlanCompareService } = await Promise.resolve().then(() => __importStar(require('../services/FloorPlanCompareService')));
        const service = new FloorPlanCompareService();
        const result = await service.runCompare({ spreadsheetId, folderId, propertyNumber });
        console.log(`[FloorPlanCompare] AI比較完了: ${propertyNumber}`);
        return res.json({
            success: true,
            spreadsheetUrl: result.spreadsheetUrl,
            summary: result.summary,
        });
    }
    catch (error) {
        console.error('[FloorPlanCompare] AI比較エラー:', error.message);
        return res.status(500).json({ success: false, error: error.message });
    }
});
/**
 * POST /api/work-tasks/:propertyNumber/floor-plan-compare
 * 【STEP1】業務詳細画面のボタンから呼ぶ
 * 格納先フォルダに「間取図比較チェック」スプシを作成するだけ（AI比較はしない）
 * 既存スプシがあればそのURLを返す（重複作成しない）
 */
router.post('/:propertyNumber/floor-plan-compare', async (req, res) => {
    try {
        const { propertyNumber } = req.params;
        const { storageUrl } = req.body;
        if (!storageUrl) {
            return res.status(400).json({ error: '格納先URLが指定されていません。業務詳細の「格納先URL」を入力してください。' });
        }
        console.log(`[FloorPlanCompare] スプシ作成開始: ${propertyNumber}, URL: ${storageUrl}`);
        const { FloorPlanCompareService } = await Promise.resolve().then(() => __importStar(require('../services/FloorPlanCompareService')));
        const service = new FloorPlanCompareService();
        const result = await service.createSpreadsheet(storageUrl, propertyNumber);
        console.log(`[FloorPlanCompare] スプシ${result.isNew ? '作成' : '既存取得'}完了: ${result.spreadsheetUrl}`);
        return res.json({
            success: true,
            spreadsheetUrl: result.spreadsheetUrl,
            spreadsheetId: result.spreadsheetId,
            isNew: result.isNew,
            message: result.isNew
                ? 'チェックシートをドライブに作成しました。掲載用図面が揃ったらスプシを開いてメニューから比較を実行してください。'
                : '既存のチェックシートを開きます。メニューから比較を再実行できます。',
        });
    }
    catch (error) {
        console.error('[FloorPlanCompare] スプシ作成エラー:', error.message);
        return res.status(500).json({ error: error.message });
    }
});
exports.default = router;
