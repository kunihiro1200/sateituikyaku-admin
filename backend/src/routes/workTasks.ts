import { Router, Request, Response } from 'express';
import { createClient } from '@supabase/supabase-js';
import axios from 'axios';
import { WorkTaskService } from '../services/WorkTaskService';
import { WorkTaskSyncService } from '../services/WorkTaskSyncService';
import { WorkTaskEmailNotificationService } from '../services/WorkTaskEmailNotificationService';
import { StaffManagementService } from '../services/StaffManagementService';
// FloorPlanCompareService は動的importで読み込む（起動時エラー防止）

// 決済完了チャット専用Webhook URL
const SETTLEMENT_CHAT_WEBHOOK_URL = 'https://chat.googleapis.com/v1/spaces/AAAAEZtcLfM/messages?key=AIzaSyDdI0hCZtE6vySjMm-WEfRq3CPzqKqqsHI&token=jpLkd-Tp1o9mPLCWA4YMyu-Te_fX4lymfoyj_qFnzLY';

const router = Router();
const workTaskService = new WorkTaskService();

/**
 * employees テーブルから「名前/表記揺れ → 正規イニシャル」変換関数を構築する。
 * 例: "国広智子" → "K"、"ｗ" → "W"、"k" → "K"
 * （sellers.ts の buildNormalizeInitialMap と同等のロジック）
 */
async function buildWorkTaskNormalizeInitialMap(
  supabase: any
): Promise<(raw: string) => string> {
  try {
    const { data: employees } = await supabase
      .from('employees')
      .select('initials, name')
      .not('initials', 'is', null);

    const nameToInitial = new Map<string, string>();
    const normalizedInitials = new Map<string, string>();

    for (const emp of (employees as any[]) || []) {
      const initial: string = emp.initials ? String(emp.initials).trim() : '';
      const name: string = emp.name ? String(emp.name).trim() : '';
      if (!initial) continue;

      if (name) nameToInitial.set(name, initial);

      const halfWidth = initial.replace(/[Ａ-Ｚａ-ｚ]/g, (c) =>
        String.fromCharCode(c.charCodeAt(0) - 0xfee0)
      );
      const upper = halfWidth.toUpperCase();
      if (halfWidth !== initial) normalizedInitials.set(initial, upper);
      if (upper !== initial && upper !== halfWidth)
        normalizedInitials.set(halfWidth.toLowerCase(), upper);
      normalizedInitials.set(initial.toLowerCase(), upper);
      normalizedInitials.set(halfWidth, upper);
      normalizedInitials.set(upper, upper);
    }

    return (raw: string): string => {
      const trimmed = raw.trim();
      if (nameToInitial.has(trimmed)) return nameToInitial.get(trimmed)!;
      const halfWidth = trimmed.replace(/[Ａ-Ｚａ-ｚ]/g, (c) =>
        String.fromCharCode(c.charCodeAt(0) - 0xfee0)
      );
      const upper = halfWidth.toUpperCase();
      if (normalizedInitials.has(upper)) return normalizedInitials.get(upper)!;
      if (normalizedInitials.has(trimmed)) return normalizedInitials.get(trimmed)!;
      return upper || trimmed;
    };
  } catch (err) {
    console.error('[buildWorkTaskNormalizeInitialMap] エラー:', err);
    return (raw: string) => raw.trim();
  }
}
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
 * GET /api/work-tasks/today-publications
 * 本日（JST）公開予定の物件一覧を返す。
 * work_tasks.publish_scheduled_date が当日と一致する物件を返す。
 * アプリ起動時の「本日サイト公開物件あり」アナウンス表示に使用（メール通知非依存）。
 */
router.get('/today-publications', async (req: Request, res: Response) => {
  try {
    const supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_KEY!
    );

    // JST（UTC+9）の当日 YYYY-MM-DD
    const now = new Date();
    const jst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
    const todayJST = `${jst.getUTCFullYear()}-${String(jst.getUTCMonth() + 1).padStart(2, '0')}-${String(jst.getUTCDate()).padStart(2, '0')}`;

    const { data, error } = await supabase
      .from('work_tasks')
      .select('property_number, property_address, seller_name, property_type, sales_assignee, publish_scheduled_date')
      .eq('publish_scheduled_date', todayJST)
      .not('publish_scheduled_date', 'is', null);

    if (error) {
      console.error('[today-publications] 取得エラー:', error);
      return res.status(500).json({ error: error.message });
    }

    return res.json({
      date: todayJST,
      count: (data || []).length,
      properties: data || [],
    });
  } catch (error: any) {
    console.error('[today-publications] エラー:', error.message);
    return res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/work-tasks/office-meeting-stats
 * 事務会議用の集計を「月ごと」に返す。
 *  - 業務依頼（work_tasks）の担当者6項目をスタッフ別にカウント
 *      媒介作成者 / サイト登録依頼者 / 間取り図確認者 / サイト登録確認者 /
 *      社員が契約書作成 / 二重チェック（売買契約確認=確認OK）
 *  - メール送信対応（activity_logs / property_chat_history）のうち
 *    「値下げ対応」「レインズ対応」を送信者スタッフ別にカウント
 *    ※ 値下げ対応は送信回数ではなく「対応した物件数（target_id のユニーク数／月・イニシャル別）」で数える。
 *      レインズ対応は従来どおり送信回数。
 *
 * 月別集計の基準日（すべて JST で月境界を切る）:
 *  - work_tasks       : 各作業の実施日カラム（媒介締め日 / サイト登録納期 / 間取図完了日 等）。
 *                       充足率96〜100%。取れない行のみ created_at にフォールバック。
 *  - activity_logs    : created_at（送信日時）
 *  - property_chat_history : sent_at（送信日時・NOT NULL）
 *
 * レスポンス: { metrics, months: [{ month:'YYYY-MM', rows, totals }], availableMonths, updatedAt }
 *   months は新しい月が先頭（降順）。除外したいイニシャルは ?excludeInitials=U,I,K で指定できる。
 */
router.get('/office-meeting-stats', async (req: Request, res: Response) => {
  try {
    const supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_KEY!
    );

    // 除外イニシャル（カンマ区切り）。指定がなければデフォルトの除外のみ。
    const excludeParam = (req.query.excludeInitials as string | undefined) || '';
    const userExcluded = excludeParam
      .split(',')
      .map((s) => s.trim().toUpperCase())
      .filter((s) => s !== '');

    // ---- employees から名前→イニシャル正規化マップを構築 ----
    const normalizeInitial = await buildWorkTaskNormalizeInitialMap(supabase);

    // ---- 月キー（JST基準の YYYY-MM）を作るヘルパ ----
    // 値が 'YYYY-MM-DD...' の日付文字列（work_tasks の DATE カラム等）は、
    // タイムゾーン変換せず先頭の YYYY-MM をそのまま使う（JSTずれ防止・timezone-handling-rules準拠）。
    // それ以外（ISO日時・UTC保存の created_at/sent_at 等）は +9h して JST の年月を取る。
    const toMonthKey = (value: any): string | null => {
      if (!value) return null;
      const str = String(value).trim();
      const ymd = str.match(/^(\d{4})-(\d{2})-\d{2}/);
      // Z / +09:00 等のタイムゾーン指定が無い純粋な日付/日時文字列はそのまま年月を採用
      if (ymd && !/[zZ]|[+-]\d{2}:?\d{2}$/.test(str)) {
        return `${ymd[1]}-${ymd[2]}`;
      }
      const d = new Date(str);
      if (isNaN(d.getTime())) return null;
      const jst = new Date(d.getTime() + 9 * 60 * 60 * 1000);
      const y = jst.getUTCFullYear();
      const m = String(jst.getUTCMonth() + 1).padStart(2, '0');
      return `${y}-${m}`;
    };

    // ---- 業務依頼（work_tasks）を取得 ----
    // 月別集計の基準日は「各作業の実施日カラム」（媒介締め日・サイト登録納期など）を使う。
    // 実データ調査で充足率96〜100%と確認済み。created_at は登録月であり作業月とずれるため使わない。
    const { data: tasks, error: taskError } = await supabase
      .from('work_tasks')
      .select(
        [
          'created_at',
          'mediation_creator',
          'mediation_deadline',
          'site_registration_requester',
          'site_registration_request_date',
          'site_registration_due_date',
          'floor_plan_confirmer',
          'floor_plan_completed_date',
          'floor_plan_due_date',
          'site_registration_confirmer',
          'site_registration_confirm_request_date',
          'employee_contract_creation',
          'sales_contract_confirmed',
          'sales_contract_assignee',
          'sales_contract_deadline',
          'settlement_date',
        ].join(', ')
      );

    if (taskError) {
      console.error('[OfficeMeetingStats] work_tasks 取得エラー:', taskError);
      return res.status(500).json({ error: taskError.message });
    }

    // 集計対象の項目定義（key, 担当者カラム, 実施月の基準日カラム）
    type TaskMetric = {
      key: string;
      label: string;
      assigneeCol: string;
      // 実施月の基準日カラム（先頭から順に、値が取れた最初のものを採用）。
      // いずれも取れない行は created_at にフォールバックする。
      dateCols: string[];
      // 担当者としてカウントする条件（省略時は担当者が入っていればカウント）
      predicate?: (row: any) => boolean;
    };
    const taskMetrics: TaskMetric[] = [
      {
        key: 'mediationCreator',
        label: '媒介作成者',
        assigneeCol: 'mediation_creator',
        dateCols: ['mediation_deadline'],
      },
      {
        key: 'siteRegistrationRequester',
        label: 'サイト登録依頼者',
        assigneeCol: 'site_registration_requester',
        dateCols: ['site_registration_request_date', 'site_registration_due_date'],
      },
      {
        key: 'floorPlanConfirmer',
        label: '間取り図確認者',
        assigneeCol: 'floor_plan_confirmer',
        dateCols: ['floor_plan_completed_date', 'floor_plan_due_date'],
      },
      {
        key: 'siteRegistrationConfirmer',
        label: 'サイト登録確認者',
        assigneeCol: 'site_registration_confirmer',
        dateCols: ['site_registration_confirm_request_date', 'site_registration_due_date'],
      },
      {
        key: 'employeeContractCreation',
        label: '社員が契約書作成',
        assigneeCol: 'employee_contract_creation',
        dateCols: ['sales_contract_deadline', 'settlement_date'],
      },
      {
        // 二重チェック: 売買契約確認が「確認OK」になったものを担当者別にカウント
        key: 'doubleCheck',
        label: '二重チェック',
        assigneeCol: 'sales_contract_assignee',
        dateCols: ['sales_contract_deadline', 'settlement_date'],
        predicate: (row: any) => String(row.sales_contract_confirmed || '').includes('OK'),
      },
    ];

    // 月別集計コンテナ: { month: { metricKey: { initial: count } } }
    const monthly: Record<string, Record<string, Record<string, number>>> = {};
    const ensureBucket = (month: string, metricKey: string): Record<string, number> => {
      if (!monthly[month]) monthly[month] = {};
      if (!monthly[month][metricKey]) monthly[month][metricKey] = {};
      return monthly[month][metricKey];
    };
    const addCount = (month: string | null, metricKey: string, initial: string) => {
      if (!month || !initial) return;
      const bucket = ensureBucket(month, metricKey);
      bucket[initial] = (bucket[initial] || 0) + 1;
    };

    // ---- 業務依頼（work_tasks）を月別に集計 ----
    // 各作業の実施月は、その作業に対応する日付カラムから決める（実施日に近い順）。
    // どの日付カラムも取れない場合は created_at にフォールバック。
    for (const rawRow of tasks || []) {
      const row = rawRow as any;
      for (const m of taskMetrics) {
        const rawAssignee = row[m.assigneeCol];
        if (!rawAssignee || String(rawAssignee).trim() === '') continue;
        if (m.predicate && !m.predicate(row)) continue;
        const initial = normalizeInitial(String(rawAssignee).trim());
        if (!initial) continue;

        // 実施月の基準日を決定
        let month: string | null = null;
        for (const dc of m.dateCols) {
          month = toMonthKey(row[dc]);
          if (month) break;
        }
        if (!month) month = toMonthKey(row.created_at);
        if (!month) continue;

        addCount(month, m.key, initial);
      }
    }

    // ---- メール送信対応（値下げ / レインズ）を月別に集計 ----
    // 値下げ判定はテンプレート名「公開前・値下げメール」で行う。
    // （件名の「価格変更」だけで判定すると「未公開物件のお知らせ」等の一斉配信も誤検出するため）
    const isPriceReduction = (templateName: string) => templateName.includes('値下げ');
    const isReins = (text: string) => text.includes('レインズ');
    // 件名から物件を識別するキーを作る（先頭の【価格変更】等のラベルを除去）
    const propertyKeyFromSubject = (subject: string): string =>
      String(subject || '')
        .replace(/^【[^】]*】/, '')
        .replace(/\s+/g, '')
        .trim();

    // (A) activity_logs（action='email'）— 1000件上限を回避するため全件ページング取得
    //     月別集計の基準日は created_at（送信日時）。
    const emailLogs: any[] = [];
    {
      const PAGE = 1000;
      let offset = 0;
      // eslint-disable-next-line no-constant-condition
      while (true) {
        const { data: page, error: pageErr } = await supabase
          .from('activity_logs')
          .select('metadata, created_at, target_id, employee:employees(initials, name)')
          .eq('action', 'email')
          .range(offset, offset + PAGE - 1);
        if (pageErr) {
          console.error('[OfficeMeetingStats] activity_logs 取得エラー:', pageErr);
          break;
        }
        if (!page || page.length === 0) break;
        emailLogs.push(...page);
        if (page.length < PAGE) break;
        offset += PAGE;
      }
    }

    // 値下げ対応は「送信回数」ではなく「対応した物件数（ユニーク）」で数える。
    // 値下げメールは買主全員への一斉配信のため、1物件の値下げで同じ件名のログが
    // 買主の数だけ生成される。物件は「件名（物件所在）」で識別し、同一物件・同一月は1件に丸める。
    // { month: { initial: Set<物件キー(件名)> } }
    const priceReductionProperties: Record<string, Record<string, Set<string>>> = {};

    for (const log of emailLogs || []) {
      const meta = (log as any).metadata || {};
      const templateName = String(meta.templateName || '');
      const emp = (log as any).employee;
      const rawInitial = emp?.initials || emp?.name || '';
      if (!rawInitial) continue;
      const initial = normalizeInitial(String(rawInitial).trim());
      if (!initial) continue;
      const month = toMonthKey((log as any).created_at);
      if (!month) continue;
      if (isPriceReduction(templateName)) {
        // 件名から物件を識別。件名が空のログは物件単位で数えられないためスキップ
        const propertyKey = propertyKeyFromSubject(meta.subject);
        if (propertyKey) {
          if (!priceReductionProperties[month]) priceReductionProperties[month] = {};
          if (!priceReductionProperties[month][initial]) priceReductionProperties[month][initial] = new Set<string>();
          priceReductionProperties[month][initial].add(propertyKey);
        }
      }
      if (isReins(templateName || meta.subject)) addCount(month, 'reinsEmail', initial);
    }

    // ユニーク物件数を priceReductionEmail の件数として monthly に反映
    for (const [month, byInitial] of Object.entries(priceReductionProperties)) {
      const bucket = ensureBucket(month, 'priceReductionEmail');
      for (const [initial, propSet] of Object.entries(byInitial)) {
        bucket[initial] = propSet.size;
      }
    }

    // 注: 値下げメールは activity_logs を唯一のソースとする。
    // （1回の送信で activities テーブルにも書かれるため、両方数えると二重計上になる）

    // (C) レインズ対応は property_chat_history（売主へのGMAIL/メール送信履歴）にある。
    //     「サイト公開＆レインズ登録証明書のご案内」等。activity_logs には無いためこちらで集計。
    //     月別集計の基準日は sent_at（送信日時・NOT NULL）。
    const chatRows: any[] = [];
    {
      const PAGE = 1000;
      let offset = 0;
      // eslint-disable-next-line no-constant-condition
      while (true) {
        const { data: page, error: pageErr } = await supabase
          .from('property_chat_history')
          .select('subject, message, sender_name, sent_at')
          .in('chat_type', ['seller_email', 'seller_sms', 'seller_gmail'])
          .range(offset, offset + PAGE - 1);
        if (pageErr) {
          console.error('[OfficeMeetingStats] property_chat_history 取得エラー:', pageErr);
          break;
        }
        if (!page || page.length === 0) break;
        chatRows.push(...page);
        if (page.length < PAGE) break;
        offset += PAGE;
      }
    }

    for (const row of chatRows) {
      const haystack = `${row.subject || ''} ${row.message || ''}`;
      if (!isReins(haystack)) continue; // レインズのみ（値下げは activity_logs で計上済み）
      const rawInitial = String(row.sender_name || '').trim();
      if (!rawInitial) continue;
      const initial = normalizeInitial(rawInitial);
      if (!initial) continue;
      const month = toMonthKey(row.sent_at);
      if (!month) continue;
      addCount(month, 'reinsEmail', initial);
    }

    // 集計対象外のイニシャルを除外
    // - TENANT / 空 / '-' はプレースホルダ
    // - IF / T / G / 生 / H / M は共有ページから除外（要望により固定除外）
    //   ※ I / K / U は表示・集計対象（除外しない）
    const EXCLUDED = new Set<string>([
      'TENANT', '', '-',
      'IF', 'T', 'G', '生', 'H', 'M',
      ...userExcluded,
    ]);

    const metrics = [
      ...taskMetrics.map((m) => ({ key: m.key, label: m.label })),
      { key: 'priceReductionEmail', label: '値下げ対応物件数' },
      { key: 'reinsEmail', label: 'レインズ対応メール' },
    ];

    // ---- 月ごとに rows / totals を構築 ----
    // 月キーを降順（新しい月が先頭）に並べる
    const monthKeys = Object.keys(monthly).sort((a, b) => b.localeCompare(a));

    const months = monthKeys.map((month) => {
      const metricBuckets = monthly[month];

      // この月に登場した全イニシャルを集約
      const allInitials = new Set<string>();
      for (const m of metrics) {
        const bucket = metricBuckets[m.key] || {};
        for (const init of Object.keys(bucket)) allInitials.add(init);
      }

      const rows = Array.from(allInitials)
        .filter((init) => !EXCLUDED.has(init))
        .map((initial) => {
          const counts: Record<string, number> = {};
          let total = 0;
          for (const m of metrics) {
            const c = (metricBuckets[m.key] || {})[initial] || 0;
            counts[m.key] = c;
            total += c;
          }
          return { initial, counts, total };
        })
        .sort((a, b) => b.total - a.total || a.initial.localeCompare(b.initial));

      const totals: Record<string, number> = {};
      for (const m of metrics) {
        totals[m.key] = rows.reduce((sum, r) => sum + (r.counts[m.key] || 0), 0);
      }

      return { month, rows, totals };
    });

    return res.json({
      metrics,
      months,
      availableMonths: monthKeys,
      updatedAt: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('[OfficeMeetingStats] 集計エラー:', error);
    return res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/work-tasks/site-due-date-counts
 * 浅沼様のサイト登録納期予定日の日付別件数を取得
 * CWの方が浅沼様の依頼で、サイト登録確認が「完了」でないものの日付別カウント
 */
router.get('/site-due-date-counts', async (req: Request, res: Response) => {
  try {
    const supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_KEY!
    );

    const exclude = req.query.exclude as string | undefined;

    // 浅沼様が担当で、サイト登録が完了していない（未納品）タスクの納期予定日を取得
    let query = supabase
      .from('work_tasks')
      .select('property_number, site_registration_due_date, cw_person')
      .not('site_registration_due_date', 'is', null)
      .neq('site_registration_confirmed', '完了')
      .not('cw_person', 'is', null);

    const { data: rows, error } = await query;

    if (error) {
      console.error('サイト納期カウント取得エラー:', error);
      return res.status(500).json({ error: error.message });
    }

    // 浅沼様のみフィルタリング
    const asanumaRows = (rows || []).filter((row: any) => {
      if (!row.cw_person) return false;
      // exclude指定がある場合はその物件番号を除外
      if (exclude && row.property_number === exclude) return false;
      return true;
    });

    // 日付別にカウント（YYYY-MM-DD形式でグループ化）
    const dateCounts: Record<string, number> = {};
    asanumaRows.forEach((row: any) => {
      if (!row.site_registration_due_date) return;
      const dateStr = row.site_registration_due_date.split('T')[0];
      dateCounts[dateStr] = (dateCounts[dateStr] || 0) + 1;
    });

    return res.json({ dateCounts });
  } catch (error: any) {
    console.error('サイト納期カウント取得エラー:', error);
    return res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/work-tasks/review-campaign-stats
 * 口コミ・キャンペーン集計データを取得
 * 業務依頼スプレッドシートの「口コミ、キャンペーン」シートから直接読み取り
 */
router.get('/review-campaign-stats', async (req: Request, res: Response) => {
  try {
    const { google } = await import('googleapis');

    // Google Sheets API認証
    let auth;
    if (process.env.GOOGLE_SERVICE_ACCOUNT_JSON) {
      const credentials = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON);
      auth = new google.auth.GoogleAuth({
        credentials,
        scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
      });
    } else {
      auth = new google.auth.GoogleAuth({
        keyFile: process.env.GOOGLE_SERVICE_ACCOUNT_KEY_PATH || './google-service-account.json',
        scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
      });
    }

    const sheets = google.sheets({ version: 'v4', auth });

    // 業務依頼スプレッドシートの「口コミ、キャンペーン」シートからA35:H39を読み取り
    const spreadsheetId = '1MO2vs0mDUFCgM-rjXXPRIy3pKKdfIFvUDwacM-2174g';
    const range = "'口コミ、キャンペーン'!A35:H39";

    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range,
    });

    const rows = response.data.values || [];

    // データ構造: A35:H39
    // 行0: ヘッダー (取得件数 2025/10/1〜集計, Y, U, I, K, 林, 麻, 計)
    // 行1: 新紹介者キャンペーン
    // 行2: 口コミ登録合計
    // 行3: 口コミ目標
    // 行4: 口コミ達成率

    const assignees = ['Y', 'U', 'I', 'K', '林', '麻'];

    const campaignRow = rows[1] || [];
    const reviewRow = rows[2] || [];
    const goalRow = rows[3] || [];

    const stats: Record<string, { campaign_count: number; review_points: number }> = {};
    for (let i = 0; i < assignees.length; i++) {
      stats[assignees[i]] = {
        campaign_count: Number(campaignRow[i + 1]) || 0,
        review_points: Number(reviewRow[i + 1]) || 0,
      };
    }

    const goalPerPerson = Number(goalRow[1]) || 72;
    const monthlyGoal = 6;

    const startDate = new Date(2025, 9, 1);
    const now = new Date();
    const elapsedMonths = (now.getFullYear() - startDate.getFullYear()) * 12 + (now.getMonth() - startDate.getMonth());
    const currentMonthTarget = monthlyGoal * elapsedMonths;

    const result = {
      period_start: '2025-10-01',
      assignees,
      goal_per_person: goalPerPerson,
      monthly_goal: monthlyGoal,
      elapsed_months: elapsedMonths,
      current_month_target: currentMonthTarget,
      stats,
    };

    return res.json(result);
  } catch (error: any) {
    console.error('[review-campaign-stats] エラー:', error.message);
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

    // 間取図修正回数：文字列を数値型に変換（INTEGER型カラムのため）
    if ('floor_plan_revision_count' in updates) {
      const value = updates.floor_plan_revision_count;
      if (value === null || value === undefined || value === '') {
        updates.floor_plan_revision_count = null;
      } else {
        const parsed = parseInt(String(value), 10);
        updates.floor_plan_revision_count = isNaN(parsed) ? null : parsed;
      }
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

    // メール通知（先に実行してからレスポンスを返す）
    try {
      await emailNotificationService.processEmailNotifications(propertyNumber, beforeData ?? {}, workTask ?? {});
    } catch (e: any) {
      console.error('[WorkTaskEmail] 通知処理エラー:', e.message);
    }

    // レスポンスを返す
    res.json({
      message: '更新が完了しました',
      data: workTask,
    });

    return;
  } catch (error: any) {
    console.error('業務依頼データ更新エラー:', error);
    return res.status(500).json({ error: error.message });
  }
});

/**
 * DELETE /api/work-tasks/:propertyNumber
 * 物件番号で業務依頼データを削除
 */
router.delete('/:propertyNumber', async (req: Request, res: Response) => {
  try {
    const { propertyNumber } = req.params;

    await workTaskService.deleteByPropertyNumber(propertyNumber);

    return res.json({
      message: '削除が完了しました',
      propertyNumber,
    });
  } catch (error: any) {
    console.error('業務依頼データ削除エラー:', error);
    return res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/work-tasks/manual-sync
 * 手動転記実行：
 *   ① コード.gs（スプシ→業務依頼集計表）をGASで実行（これは数秒で完了する）
 *   ② 集計表→DB の同期は バックエンド内で syncAll() を直接実行する
 *
 * 【変更理由 / 過去の障害】
 * 以前は②を GyomuWorkTaskSync.gs（GAS Web App）へのHTTP呼び出しで行っていたが、
 * GAS側が全行(約650件)のupsert + CWカウント同期 + 媒介シート同期を同期実行するため、
 * axiosの300秒タイムアウトを超えて必ず失敗し、「転記実行しても転記されない」状態になっていた。
 * 集計表→DB は backend の WorkTaskSyncService.syncAll() が同じ処理を行えるため、
 * GASのタイムアウトに依存しないバックエンド内実行に置き換えた。
 */
router.post('/manual-sync', async (_req: Request, res: Response) => {
  // Step1 のみ GAS を使う（スプシ→業務依頼集計表）
  const STEP1_URL = 'https://script.google.com/macros/s/AKfycbw7WZf6b4f9zjBKS1QWKNBQUKGaw4E_XFDikSesvp49jxGuHAMKgDRUMhhYxZ1vqDc/exec';

  try {
    console.log('[manual-sync] ステップ1開始: コード.gs（スプシ→業務依頼集計表）');
    const step1Res = await axios.get(STEP1_URL, { timeout: 120000 }); // 2分タイムアウト（Step1は数秒で完了する）
    const step1Data = step1Res.data;
    console.log('[manual-sync] ステップ1完了:', step1Data);

    if (step1Data?.success === false) {
      return res.status(500).json({
        step: 1,
        error: 'ステップ1（スプシ→業務依頼集計表）でエラーが発生しました',
        detail: step1Data.error,
      });
    }

    console.log('[manual-sync] ステップ2開始: 集計表→DB（バックエンド内 syncAll）');
    const step2Result = await workTaskSyncService.syncAll();
    console.log(
      `[manual-sync] ステップ2完了: 成功=${step2Result.successCount}, エラー=${step2Result.errorCount}`
    );

    // 全件失敗（＝スプシ取得自体に失敗した等）の場合のみエラー扱いにする
    if (step2Result.successCount === 0 && step2Result.errorCount > 0) {
      return res.status(500).json({
        step: 2,
        error: 'ステップ2（集計表→DB）でエラーが発生しました',
        detail: step2Result.errors.slice(0, 5),
      });
    }

    return res.json({
      success: true,
      message: `転記が完了しました（スプシ→集計表→DB / 成功${step2Result.successCount}件${
        step2Result.errorCount > 0 ? ` / エラー${step2Result.errorCount}件` : ''
      }）`,
      step1: step1Data,
      step2: {
        successCount: step2Result.successCount,
        errorCount: step2Result.errorCount,
      },
    });
  } catch (error: any) {
    console.error('[manual-sync] エラー:', error);
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

/**
 * POST /api/work-tasks/floor-plan-compare-run
 * 【STEP2】スプシ内のGASボタンまたは業務詳細画面から呼ぶ
 * フォルダ内の図面をAIで比較してスプシに結果を書き込む
 * 認証: FLOOR_PLAN_API_KEY（環境変数）またはCRON_SECRET
 * ⚠️ /:propertyNumber より前に定義すること（ルーティング競合防止）
 */
router.post('/floor-plan-compare-run', async (req: Request, res: Response) => {
  try {
    // 認証: FLOOR_PLAN_API_KEY または CRON_SECRET のどちらかが一致すればOK
    const authHeader = req.headers.authorization;
    const floorPlanKey = process.env.FLOOR_PLAN_API_KEY;
    const cronSecret = process.env.CRON_SECRET;
    const isAuthorized =
      (floorPlanKey && authHeader === `Bearer ${floorPlanKey}`) ||
      (cronSecret && authHeader === `Bearer ${cronSecret}`);
    if (!isAuthorized) {
      return res.status(401).json({ success: false, error: '認証エラー' });
    }

    const { spreadsheetId, folderId, propertyNumber } = req.body;

    if (!spreadsheetId || !folderId || !propertyNumber) {
      return res.status(400).json({ error: 'spreadsheetId, folderId, propertyNumber は必須です' });
    }

    console.log(`[FloorPlanCompare] AI比較開始: ${propertyNumber}, フォルダ: ${folderId}`);

    const { FloorPlanCompareService } = await import('../services/FloorPlanCompareService');
    const service = new FloorPlanCompareService();
    const result = await service.runCompare({ spreadsheetId, folderId, propertyNumber });

    console.log(`[FloorPlanCompare] AI比較完了: ${propertyNumber}`);

    return res.json({
      success: true,
      spreadsheetUrl: result.spreadsheetUrl,
      summary: result.summary,
    });
  } catch (error: any) {
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
router.post('/:propertyNumber/floor-plan-compare', async (req: Request, res: Response) => {
  try {
    const { propertyNumber } = req.params;
    const { storageUrl } = req.body;

    if (!storageUrl) {
      return res.status(400).json({ error: '格納先URLが指定されていません。業務詳細の「格納先URL」を入力してください。' });
    }

    console.log(`[FloorPlanCompare] スプシ作成開始: ${propertyNumber}, URL: ${storageUrl}`);

    const { FloorPlanCompareService } = await import('../services/FloorPlanCompareService');
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
  } catch (error: any) {
    console.error('[FloorPlanCompare] スプシ作成エラー:', error.message);
    return res.status(500).json({ error: error.message });
  }
});

export default router;
