import { Router, Request, Response } from 'express';
import { EmailService } from '../services/EmailService';

const router = Router();

// ===== 送信先 =====
const RECIPIENTS = [
  'tenant@ifoo-oita.com',
  'jyuna.wada@ifoo-oita.com',
  'mariko.kume@ifoo-oita.com',
  'yurine.kimura@ifoo-oita.com',
];

interface Notification {
  type: string;
  subject: string;
  body: string;
  day?: number;
  month?: number;
  year?: number;
  dates?: { month: number; day: number }[];
}

/**
 * 今日送信すべきかを判定
 */
function shouldSendToday(notification: Notification, today: Date): boolean {
  const day = today.getDate();
  const month = today.getMonth() + 1; // 1-12
  const year = today.getFullYear();
  const dow = today.getDay(); // 0=日, 1=月, ..., 6=土

  switch (notification.type) {
    case 'monthly_day':
      return day === notification.day;

    case 'monthly_last_day': {
      const lastDay = new Date(year, month, 0).getDate();
      return day === lastDay;
    }

    case 'monthly_last_sunday': {
      const lastDayOfMonth = new Date(year, month, 0).getDate();
      for (let d = lastDayOfMonth; d >= 1; d--) {
        if (new Date(year, month - 1, d).getDay() === 0) {
          return day === d;
        }
      }
      return false;
    }

    case 'monthly_first_sunday': {
      for (let d = 1; d <= 7; d++) {
        if (new Date(year, month - 1, d).getDay() === 0) {
          return day === d;
        }
      }
      return false;
    }

    case 'monthly_first_saturday': {
      for (let d = 1; d <= 7; d++) {
        if (new Date(year, month - 1, d).getDay() === 6) {
          return day === d;
        }
      }
      return false;
    }

    case 'weekly_friday':
      return dow === 5;

    case 'weekly_saturday':
      return dow === 6;

    case 'weekly_sunday':
      return dow === 0;

    case 'yearly_dates':
      return (notification.dates || []).some(
        (dt) => month === dt.month && day === dt.day
      );

    case 'yearly_date':
      return month === notification.month && day === notification.day;

    case 'yearly_first_monday_of_month': {
      if (month !== notification.month) return false;
      for (let d = 1; d <= 7; d++) {
        if (new Date(year, month - 1, d).getDay() === 1) {
          return day === d;
        }
      }
      return false;
    }

    case 'one_time':
      return (
        year === notification.year &&
        month === notification.month &&
        day === notification.day
      );

    default:
      return false;
  }
}

/**
 * 全通知スケジュール定義
 */
function getAllNotifications(): Notification[] {
  return [
    // ===== 毎月 =====
    {
      type: 'monthly_day', day: 18,
      subject: '【管理】白山クリニックへ来月の休みの確認お願いいたします！',
      body: 'お疲れ様です。\n白山クリニックへ来月の休みの日の確認お願いします。\n０９７－５３３－８９３０\nhttps://docs.google.com/spreadsheets/d/1K8aKUSdDbGPmmANgsS9XX6-vmrQv-iXI/edit?gid=1491948914#gid=1491948914',
    },
    {
      type: 'monthly_day', day: 4,
      subject: '【管理】STビルの検針お願いいたします！',
      body: 'お疲れ様です。\nSTビルの検針お願いいたします。\nhttps://docs.google.com/spreadsheets/d/1K8aKUSdDbGPmmANgsS9XX6-vmrQv-iXI/edit?gid=1766319884#gid=1766319884',
    },
    {
      type: 'monthly_day', day: 28,
      subject: '【管理】STビルのビル予定表の貼出しをお願いいたします！',
      body: 'お疲れ様です。\nSTビルの予定表の貼り出しお願いいたします。\nhttps://docs.google.com/spreadsheets/d/1K8aKUSdDbGPmmANgsS9XX6-vmrQv-iXI/edit?gid=1491948914#gid=1491948914',
    },
    {
      type: 'monthly_day', day: 12,
      subject: '【経理】グループビル請求書の作成お願いします',
      body: 'お疲れ様です！\nグループビル請求書の作成をして、フレックスへ連絡お願いします。',
    },
    {
      type: 'monthly_day', day: 14,
      subject: '【経理】売上、経費入力',
      body: 'お疲れ様です。\n今日中に、経費入力お願いします。入力後、フレックス（アイアイエー）へ連絡してください。\nhttps://docs.google.com/spreadsheets/d/1RPQ65k5joKlyyni-mVbJcO9XspwYa6jnPejwnkPXlC0/edit?gid=1270640911#gid=1270640911',
    },
    {
      type: 'monthly_day', day: 14,
      subject: '【経理】顧問料支払い',
      body: 'お疲れ様です。\n15日までに、顧問料支払い処理をしてください。',
    },
    {
      type: 'monthly_day', day: 15,
      subject: '【管理】勤怠提出',
      body: 'お疲れ様です。\nフレックスに勤怠提出をお願いいたします。',
    },
    {
      type: 'monthly_day', day: 15,
      subject: '【経理】火災保険',
      body: 'お疲れ様です。\n火災保険の清算書は毎月20日までに確認し出力、-であれば振り込む・+は振り込まれる　（代勘清算→清算書→右下ご清算書ＰＤＦ）',
    },
    {
      type: 'monthly_day', day: 28,
      subject: '【管理】物件数確認',
      body: 'お疲れ様です。\n毎月の物件数の確認です！\nhttps://docs.google.com/spreadsheets/d/10b0mO7HzvoVf-f8JB5gTYpFF9eBYKN7sUClAeIrmku8/edit?gid=513922181#gid=513922181\n上記の物件数の入力をお願いいたします。\n終了しましたら山本さんにご報告お願いします。',
    },

    // ===== 毎月（特殊日） =====
    {
      type: 'monthly_last_sunday',
      subject: '【経理】売上、経費入力',
      body: 'お疲れ様です。\n売上、経費を次回朝礼時までに入力し、次回朝礼時に説明お願いします。',
    },
    {
      type: 'monthly_last_day',
      subject: '【管理】データバックアップ',
      body: 'お疲れ様です。\n青色のUSBに毎月データのバックアップを取ります。\n\nフォルダ名：「売買関係（毎月保存）」\n・売主・買主リスト→毎月\n・ID・PW→6月と12月\n・重説契約書→9月\n\n売主リストと物件買主一覧のスプレッドシートは.xlsx形式でダウンロードしています。\n他のシートはどの形式でも良いです。',
    },
    {
      type: 'monthly_first_sunday',
      subject: '【管理】全宅連　書式更新の確認お願いします！',
      body: '全宅連のHPより、書式更新の確認をし、雛形を更新してください。\nhttps://docs.google.com/spreadsheets/d/1djSrEhCLC3JuhoX8CkNHKDqRrq2l58yErdk0dqRGZAQ/edit?usp=sharing\n\n終わったらこのメールを「対応済」に入れてください',
    },
    {
      type: 'monthly_first_saturday',
      subject: '【重要】非公開メール配信',
      body: 'お疲れ様です。\n非公開物件のメール配信をお願いいたします。',
    },

    // ===== 毎週 =====
    {
      type: 'weekly_friday',
      subject: '【経理】マネーフォワードの処理お願いします！',
      body: 'お疲れ様です。\nマネーフォワードは週1で処理お願いいたします！',
    },
    {
      type: 'weekly_sunday',
      subject: '【管理】公開延長',
      body: 'お疲れ様です。\nat-homeとSUUMOの公開延長をお願いいたします。\nhttps://docs.google.com/document/d/1qXQ9dYuIXS5HgqWDt-0S7fAsFzVTxxv3xtn3zFCFXEo/edit?tab=t.fixsoaz1qtnq',
    },
    {
      type: 'weekly_saturday',
      subject: '【重要】SUUMO確認',
      body: 'お疲れ様です。\n\n①掲載枠確認（残5件になったら枠数を増加申請）\n増枠はリクルートの船越様に連絡（rio_funakoshi@r.recruit.co.jp）\n→返信メールのＵＲＬから申込み\n　ＩＤ：K16337100100\n　ＰＷ：ifoo1200\n→やり方は返信メールにあります。\n・枠数選択不可、25枠単位での変更のみ\n・毎週火曜〆、翌水曜日反映\n\n②公開期日\n日曜更新（やり方はhttps://docs.google.com/document/d/1qXQ9dYuIXS5HgqWDt-0S7fAsFzVTxxv3xtn3zFCFXEo/edit?tab=t.fixsoaz1qtnq参照）→8日間公開延長',
    },

    // ===== 毎年（複数回） =====
    {
      type: 'yearly_dates',
      dates: [{ month: 5, day: 1 }, { month: 10, day: 1 }],
      subject: '【管理】各テナントへエアコンの定期清掃の通知お願いいいたします！',
      body: 'お疲れ様です。\n各テナントへエアコンの定期清掃の通知をお願いいたします！\nhttps://docs.google.com/spreadsheets/d/1K8aKUSdDbGPmmANgsS9XX6-vmrQv-iXI/edit?gid=477030585#gid=477030585',
    },
    {
      type: 'yearly_dates',
      dates: [{ month: 1, day: 20 }, { month: 5, day: 20 }, { month: 9, day: 20 }],
      subject: '人事考課提出',
      body: 'お疲れ様です。\n人事考課は今月２５日までに各上長に提出願います。',
    },
    {
      type: 'yearly_dates',
      dates: [{ month: 8, day: 1 }, { month: 12, day: 1 }],
      subject: '【重要・訪問予約スケジュールの日程確認】',
      body: 'お疲れ様です。\n売主リストの訪問予約カレンダーの休日の調整お願いいたします。\n\n８月　お盆休み\n\n１２月　正月休み\n\nよろしくお願いいたします。',
    },
    {
      type: 'yearly_dates',
      dates: [{ month: 6, day: 1 }, { month: 10, day: 1 }],
      subject: '【管理】室外機管理について',
      body: 'お疲れ様です。\n\n6月1日　エアコン冷却開始\n　11F屋上の緑のバルブを開けて蛇口全て閉める\n\n10月1日　エアコン冷却終了\n　11F屋上の緑のバルブを閉めて蛇口全てより水抜きする（凍結防止）',
    },

    // ===== 毎年（1回） =====
    {
      type: 'yearly_first_monday_of_month', month: 9,
      subject: '【事務】毎年の9月の作業のリマインドをお願いします。',
      body: 'お疲れ様です。\n毎年の9月の作業のリマインドです。\nhttps://docs.google.com/spreadsheets/d/1CPuQ-bF_Um5dSDO4hCbv4XNHVYr7jYVqoJqdBQ0DKuM/edit?gid=1928448449#gid=1928448449',
    },
    {
      type: 'yearly_date', month: 1, day: 6,
      subject: '【事務】毎年の１月の作業のリマインド',
      body: 'お疲れ様です。\n毎年の１月の作業のリマインドです。\nhttps://docs.google.com/spreadsheets/d/1CPuQ-bF_Um5dSDO4hCbv4XNHVYr7jYVqoJqdBQ0DKuM/edit?gid=1789234243#gid=1789234243',
    },
    {
      type: 'yearly_date', month: 7, day: 1,
      subject: '【重要・一般媒介整理】',
      body: 'お疲れ様です。\n一般媒介の整理作業お願いします。\n\n①一般媒介の方全てに連絡（いつまでに連絡していつまでに非公開にするか上長へ報告ください）\n条件：過去３ヶ月以上売り主と連絡取っていない物件：\n（値下げ履歴、問合せ、備忘録等に過去３ヶ月以上何も履歴がないもの）\n\n②「備考」欄に不通であればイニシャル/日付/不通　と入力\nと同時にメール送信（テンプレの一般媒介（公開非公開）を選択して送信）\n→APPSHEETの「一般媒介（非公開予定）」とステータスが上がってきます\n\n③１週間後に「一般媒介（非公開予定）」のステータス案件にお手紙郵送します。\n\n④郵送後２週間以内に、宛先不明で返ってくるOR音沙汰なしであれば、全て、非公開、物件ファイルの処理を行う\n\n⑤完了後、上長まで報告お願いします。',
    },

    {
      type: 'yearly_date', month: 12, day: 25,
      subject: '【管理】年末年始休み前の作業のリマインド',
      body: 'お疲れ様です。\n年末年始休みに入る前の作業のリマインドです\n\n①アットホーム上に休暇のお知らせを出す\n②アットホームの問い合わせがあった際の自動応答メッセージを年末仕様に変更（SUUMOなし）\n③HPのブログに年末挨拶投稿\n④年末清掃後にアットホームからもらう年末年始の休暇お知らせポスター貼る\n⑤しめ縄をいふうの自動ドアとビルに飾る（STビル用は消耗品費として翌月IIAに請求）\n⑥査定サイトクローズ\n⑦営業終了後固定電話を留守設定にする',
    },
    {
      type: 'yearly_date', month: 8, day: 5,
      subject: '【管理】お盆休み前の作業のリマインド',
      body: 'お疲れ様です。\nお盆休みに入る前の作業のリマインドです。\n\n①入口にお盆休み休暇のお知らせを貼る（at-homeからもらえる）\n②各査定サイト反響を停める\n③at-home上に休暇のお知らせを出す+お知らせメッセージも変更\n④営業終了後固定電話を留守設定にする',
    },

    // ===== 1回きり（リースバック退去通知） =====
    {
      type: 'one_time', year: 2026, month: 10, day: 1,
      subject: '【重要・リースバック退去通知】宮崎台　白岩様',
      body: 'お疲れ様です。\n\n宮崎台戸建\n2023/3/24決済\n担当：事務\n080-9868-0888\n最終年月：2027年3月\n\n退去通知お願いします。\n\nまた、保証会社：レンツへ連絡もお願いいたします。',
    },
    {
      type: 'one_time', year: 2032, month: 11, day: 1,
      subject: '【重要・リースバック退去通知】高崎　小田原様',
      body: 'お疲れ様です。\n\n高崎戸建\n担当：事務\n080-1737-6752\n2023年4月契約\n終了年月：2033年4月\n\n退去通知と保証会社のレンツへ報告お願いいたします。',
    },
    {
      type: 'one_time', year: 2028, month: 5, day: 1,
      subject: '【重要・リースバック退去通知】鉄輪　こや様',
      body: 'お疲れ様です。\n\n鉄輪戸建\n担当：事務\n090-6427-5991\n2024年10月契約\n終了年月：2029年10月\n\n退去通知と保証会社のレンツへ報告お願いいたします。',
    },
  ];
}

/**
 * POST /api/scheduled-notifications/send
 * 今日送信すべき通知をチェックして送信する
 * CRON_SECRET認証（GitHub Actionsから呼び出し）
 */
router.post('/send', async (req: Request, res: Response) => {
  // CRON_SECRET認証
  const authHeader = req.headers.authorization;
  const cronSecret = process.env.CRON_SECRET || 'a0z8ahNnFyUY+BXloL5JsotDTbuu9b5L6UApoflR59s=';

  if (authHeader !== `Bearer ${cronSecret}`) {
    return res.status(401).json({ success: false, error: 'Unauthorized' });
  }

  try {
    // 日本時間で今日の日付を取得
    const now = new Date();
    const jstOffset = 9 * 60 * 60 * 1000;
    const today = new Date(now.getTime() + jstOffset);

    const notifications = getAllNotifications();
    const sent: string[] = [];
    const errors: string[] = [];

    for (const n of notifications) {
      if (shouldSendToday(n, today)) {
        try {
          const emailService = new EmailService();
          await emailService.sendEmail({
            to: RECIPIENTS,
            subject: n.subject,
            body: n.body,
          });
          sent.push(n.subject);
          console.log(`[scheduled-notifications] ✅ 送信完了: ${n.subject}`);
        } catch (err: any) {
          errors.push(`${n.subject}: ${err.message}`);
          console.error(`[scheduled-notifications] ❌ 送信失敗: ${n.subject}`, err);
        }
      }
    }

    console.log(`[scheduled-notifications] 送信結果: ${sent.length}件送信, ${errors.length}件エラー`);

    return res.json({
      success: true,
      date: today.toISOString().split('T')[0],
      sent,
      errors,
      totalScheduled: notifications.length,
    });
  } catch (error: any) {
    console.error('[scheduled-notifications] エラー:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/scheduled-notifications/preview
 * 今日送信予定の通知をプレビュー（送信しない）
 * CRON_SECRET認証
 */
router.get('/preview', async (req: Request, res: Response) => {
  const authHeader = req.headers.authorization;
  const cronSecret = process.env.CRON_SECRET || 'a0z8ahNnFyUY+BXloL5JsotDTbuu9b5L6UApoflR59s=';

  if (authHeader !== `Bearer ${cronSecret}`) {
    return res.status(401).json({ success: false, error: 'Unauthorized' });
  }

  const now = new Date();
  const jstOffset = 9 * 60 * 60 * 1000;
  const today = new Date(now.getTime() + jstOffset);

  const notifications = getAllNotifications();
  const todayNotifications = notifications.filter((n) => shouldSendToday(n, today));

  return res.json({
    success: true,
    date: today.toISOString().split('T')[0],
    dayOfWeek: ['日', '月', '火', '水', '木', '金', '土'][today.getDay()],
    recipients: RECIPIENTS,
    notifications: todayNotifications.map((n) => ({
      subject: n.subject,
      bodyPreview: n.body.substring(0, 100) + '...',
    })),
    count: todayNotifications.length,
  });
});

export default router;
