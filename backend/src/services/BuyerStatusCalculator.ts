/**
 * 買主ステータス算出ロジック
 *
 * AppSheetのIFSロジックと同一の優先順位でステータスを算出します。
 * 条件は上から順に評価し、最初に一致した条件のステータスを返します。
 */

import {
  isToday,
  isTomorrow,
  getDayOfWeek,
  isPast,
  isDaysFromToday,
  isTodayOrPast,
  isWithinDaysAgo,
  isAfterOrEqual,
  getTodayDayOfWeek,
} from '../utils/dateHelpers';
import {
  isBlank,
  isNotBlank,
  contains,
  notContains,
  equals,
  notEquals,
  and,
  or,
  not,
} from '../utils/fieldHelpers';
import { getStatusColor } from '../config/buyer-status-definitions';

export interface BuyerData {
  buyer_number: string;
  name: string;
  phone_number?: string | null;
  email?: string | null;
  reception_date?: Date | string | null;
  latest_viewing_date?: Date | string | null;
  next_call_date?: Date | string | null;
  follow_up_assignee?: string | null;
  latest_status?: string | null;
  inquiry_confidence?: string | null;
  inquiry_email_phone?: string | null;
  inquiry_email_reply?: string | null;
  three_calls_confirmed?: string | null;
  broker_inquiry?: string | null;
  inquiry_source?: string | null;
  viewing_result_follow_up?: string | null;
  viewing_unconfirmed?: string | null;
  viewing_type_general?: string | null;
  post_viewing_seller_contact?: string | null;
  notification_sender?: string | null;
  valuation_survey?: string | null;
  valuation_survey_confirmed?: string | null;
  broker_survey?: string | null;
  day_of_week?: string | null;
  pinrich?: string | null;
  email_confirmed?: string | null;
  email_confirmation_assignee?: string | null;
  viewing_promotion_not_needed?: string | null;
  viewing_promotion_sender?: string | null;
  past_buyer_list?: string | null;
  price?: string | null;
  atbb_status?: string | null;
}

export interface StatusResult {
  status: string;
  priority: number;
  matchedCondition: string;
  color: string;
}

export function calculateBuyerStatus(buyer: BuyerData): StatusResult {
  try {
    // Priority 1: 査定アンケート回答あり
    if (and(isNotBlank(buyer.valuation_survey), isBlank(buyer.valuation_survey_confirmed))) {
      const status = '査定アンケート回答あり';
      return { status, priority: 1, matchedCondition: '査定アンケート回答あり', color: getStatusColor(status) };
    }

    // Priority 2: 業者問合せあり
    if (equals(buyer.broker_survey, '未')) {
      const status = '業者問合せあり';
      return { status, priority: 2, matchedCondition: '業者向けアンケート = 未', color: getStatusColor(status) };
    }

    // Priority 3: 内覧日前日（業者問合せは除外、通知送信者が入力済みの場合も除外）
    if (
      and(
        isNotBlank(buyer.latest_viewing_date),
        not(equals(buyer.broker_inquiry, '業者問合せ')),
        isBlank(buyer.notification_sender),
        or(
          and(isTomorrow(buyer.latest_viewing_date), not(equals(getDayOfWeek(buyer.latest_viewing_date), '木曜日'))),
          and(isDaysFromToday(buyer.latest_viewing_date, 2), equals(getDayOfWeek(buyer.latest_viewing_date), '木曜日'))
        )
      )
    ) {
      const status = '内覧日前日';
      return { status, priority: 3, matchedCondition: '内覧日の前日（木曜日は2日前）', color: getStatusColor(status) };
    }

    // Priority 4: 内覧未確定
    if (equals(buyer.viewing_unconfirmed, '未確定')) {
      const status = '内覧未確定';
      return { status, priority: 4, matchedCondition: '内覧が未確定', color: getStatusColor(status) };
    }

    // Priority 8: 一般媒介_内覧後売主連絡未
    // 条件A: 内覧日が2025/8/1以降かつ今日未満 かつ 内覧形態_一般媒介が非空 かつ 内覧後売主連絡が未入力（内覧結果の有無は問わない）
    // 条件B: 内覧後売主連絡 = "未"
    const conditionA = and(
      isNotBlank(buyer.viewing_type_general),
      isNotBlank(buyer.latest_viewing_date),
      isPast(buyer.latest_viewing_date),
      isAfterOrEqual(buyer.latest_viewing_date, '2025-08-01'),
      isBlank(buyer.post_viewing_seller_contact)
    );
    const conditionB = equals(buyer.post_viewing_seller_contact, '未');
    if (or(conditionA, conditionB)) {
      const status = '一般媒介_内覧後売主連絡未';
      return { status, priority: 8, matchedCondition: '一般媒介で内覧後の売主連絡が未完了', color: getStatusColor(status) };
    }

    // Priority 6: 当日TEL（次電日が当日以前 かつ 追客担当なし）
    // 追客担当がある場合は Priority 23以降の担当者別カテゴリで「当日TEL(林)」として表示
    if (
      and(
        isNotBlank(buyer.next_call_date),
        isTodayOrPast(buyer.next_call_date),
        isBlank(buyer.follow_up_assignee)
      )
    ) {
      const status = '当日TEL';
      return { status, priority: 6, matchedCondition: '次電日が当日以前（担当なし）', color: getStatusColor('当日TEL') };
    }

    // Priority 5: 問合メール未対応
    // スプレッドシートのIFS式に合わせてOR条件で判定:
    //   1. 電話対応が "未"
    //   2. メール返信が "未"
    //   3. 内覧日が空欄 かつ 電話対応が "不要" かつ メール返信が "未" または空欄
    if (
      or(
        equals(buyer.inquiry_email_phone, '未'),
        equals(buyer.inquiry_email_reply, '未'),
        and(
          isBlank(buyer.latest_viewing_date),
          equals(buyer.inquiry_email_phone, '不要'),
          or(
            equals(buyer.inquiry_email_reply, '未'),
            isBlank(buyer.inquiry_email_reply)
          )
        )
      )
    ) {
      const status = '問合メール未対応';
      return { status, priority: 5, matchedCondition: '問い合わせメールへの対応が未完了', color: getStatusColor(status) };
    }

    // Priority 7: 3回架電未
    // 条件: [3回架電確認済み] = "3回架電未" AND ([【問合メール】電話対応] = "不通" OR "未")
    if (
      and(
        equals(buyer.three_calls_confirmed, '3回架電未'),
        or(
          equals(buyer.inquiry_email_phone, '不通'),
          equals(buyer.inquiry_email_phone, '未')
        )
      )
    ) {
      const status = '3回架電未';
      return { status, priority: 7, matchedCondition: '3回架電が未完了', color: getStatusColor(status) };
    }

    // Priority 9: Y_内覧後未入力（追加条件あり）
    if (
      and(
        equals(buyer.follow_up_assignee, 'Y'),
        isNotBlank(buyer.latest_viewing_date),
        isPast(buyer.latest_viewing_date),
        isBlank(buyer.viewing_result_follow_up),
        contains(buyer.atbb_status, '公開中'),
        notEquals(buyer.broker_inquiry, '業者問合せ')
      )
    ) {
      return {
        status: 'Y_内覧後未入力',
        priority: 9,
        matchedCondition: '担当Y: 内覧後の入力が未完了（公開中かつ業者問合せでない）',
        color: getStatusColor('Y_内覧後未入力'),
      };
    }

    // Priority 10-15: 担当者別内覧後未入力（Y_内覧後未入力と同じ条件: 公開中かつ業者問合せでない）
    const viewingPostInputConditions = [
      { assignee: '生', priority: 10, status: '生_内覧後未入力' },
      { assignee: 'U', priority: 11, status: 'U_内覧後未入力' },
      { assignee: '久', priority: 12, status: '久_内覧後未入力' },
      { assignee: 'K', priority: 13, status: 'K_内覧後未入力' },
      { assignee: 'I', priority: 14, status: 'I_内覧後未入力' },
      { assignee: 'R', priority: 15, status: 'R_内覧後未入力' },
    ];

    for (const condition of viewingPostInputConditions) {
      if (
        and(
          equals(buyer.follow_up_assignee, condition.assignee),
          isNotBlank(buyer.latest_viewing_date),
          isPast(buyer.latest_viewing_date),
          isBlank(buyer.viewing_result_follow_up),
          contains(buyer.atbb_status, '公開中'),
          notEquals(buyer.broker_inquiry, '業者問合せ')
        )
      ) {
        return {
          status: condition.status,
          priority: condition.priority,
          matchedCondition: `担当${condition.assignee}: 内覧後の入力が未完了（公開中かつ業者問合せでない）`,
          color: getStatusColor(condition.status),
        };
      }
    }

    return calculateBuyerStatusComplete(buyer);
  } catch (error) {
    console.error('[calculateBuyerStatus] Error:', error);
    return { status: '', priority: 0, matchedCondition: 'エラー', color: '#cccccc' };
  }
}

export function calculateBuyerStatusComplete(buyer: BuyerData): StatusResult {
  try {
    const statusAorB = or(
      equals(buyer.latest_status, 'A:この物件を気に入っている（こちらからの一押しが必要）'),
      equals(buyer.latest_status, 'B:1年以内に引っ越し希望だが、この物件ではない。駐車場の要件や、日当たり等が合わない。')
    );

    // Priority 16: 担当(Y)次電日空欄
    if (and(statusAorB, isBlank(buyer.next_call_date), equals(buyer.follow_up_assignee, 'Y'))) {
      const status = '担当(Y)次電日空欄';
      return { status, priority: 16, matchedCondition: '担当Y: 次電日が空欄', color: getStatusColor(status) };
    }

    // Priority 17: 担当(久)次電日空欄
    if (and(statusAorB, isBlank(buyer.broker_inquiry), isBlank(buyer.next_call_date), equals(buyer.follow_up_assignee, '久'))) {
      const status = '担当(久)次電日空欄';
      return { status, priority: 17, matchedCondition: '担当久: 次電日が空欄', color: getStatusColor(status) };
    }

    // Priority 18: 担当(U)次電日空欄
    if (and(statusAorB, isBlank(buyer.next_call_date), isBlank(buyer.broker_inquiry), equals(buyer.follow_up_assignee, 'U'))) {
      const status = '担当(U)次電日空欄';
      return { status, priority: 18, matchedCondition: '担当U: 次電日が空欄', color: getStatusColor(status) };
    }

    // Priority 19: 担当(R)次電日空欄
    if (and(statusAorB, isBlank(buyer.next_call_date), isBlank(buyer.broker_inquiry), equals(buyer.follow_up_assignee, 'R'))) {
      const status = '担当(R)次電日空欄';
      return { status, priority: 19, matchedCondition: '担当R: 次電日が空欄', color: getStatusColor(status) };
    }

    // Priority 20: 担当(K)次電日空欄
    if (and(statusAorB, isBlank(buyer.next_call_date), isBlank(buyer.broker_inquiry), equals(buyer.follow_up_assignee, 'K'))) {
      const status = '担当(K)次電日空欄';
      return { status, priority: 20, matchedCondition: '担当K: 次電日が空欄', color: getStatusColor(status) };
    }

    // Priority 21: 担当(I)次電日空欄
    if (and(statusAorB, isBlank(buyer.next_call_date), isBlank(buyer.broker_inquiry), equals(buyer.follow_up_assignee, 'I'))) {
      const status = '担当(I)次電日空欄';
      return { status, priority: 21, matchedCondition: '担当I: 次電日が空欄', color: getStatusColor(status) };
    }

    // Priority 22: 担当(生)次電日空欄
    if (and(statusAorB, isBlank(buyer.next_call_date), isBlank(buyer.broker_inquiry), equals(buyer.follow_up_assignee, '生'))) {
      const status = '担当(生)次電日空欄';
      return { status, priority: 22, matchedCondition: '担当生: 次電日が空欄', color: getStatusColor(status) };
    }

    // Priority 23-30: 担当者別
    // 次電日が今日以前の場合は「当日TEL(林)」、そうでなければ「担当(林)」
    // 固定リストにない担当者（林など）も汎用的に対応
    const knownAssignees: Array<{ assignee: string; priority: number }> = [
      { assignee: 'Y', priority: 23 },
      { assignee: 'W', priority: 24 },
      { assignee: 'U', priority: 25 },
      { assignee: '生', priority: 26 },
      { assignee: 'K', priority: 27 },
      { assignee: '久', priority: 28 },
      { assignee: 'I', priority: 29 },
      { assignee: 'R', priority: 30 },
    ];

    if (isNotBlank(buyer.follow_up_assignee)) {
      const assignee = buyer.follow_up_assignee || '';
      const known = knownAssignees.find(a => a.assignee === assignee);
      const priority = known ? known.priority : 23; // 未知の担当者は priority 23 扱い

      if (isNotBlank(buyer.next_call_date) && isTodayOrPast(buyer.next_call_date)) {
        // 次電日が今日以前 → 当日TEL(林) として担当カテゴリのサブ扱い
        const status = `当日TEL(${assignee})`;
        return { status, priority, matchedCondition: `担当${assignee}: 次電日が当日以前`, color: getStatusColor('当日TEL') };
      } else {
        // 通常の担当カテゴリ
        const status = `担当(${assignee})`;
        return { status, priority, matchedCondition: `担当${assignee}`, color: getStatusColor(`担当(${assignee})`) };
      }
    }

    // Priority 31: ピンリッチ未登録
    if (
      or(
        and(isBlank(buyer.pinrich), isNotBlank(buyer.email), isBlank(buyer.broker_inquiry)),
        and(equals(buyer.pinrich, '登録無し'), isNotBlank(buyer.email), isBlank(buyer.broker_inquiry))
      )
    ) {
      const status = 'ピンリッチ未登録';
      return { status, priority: 31, matchedCondition: 'ピンリッチに未登録', color: getStatusColor(status) };
    }

    // Priority 32: 内覧促進メール（Pinrich）
    if (
      and(
        isBlank(buyer.price),
        isWithinDaysAgo(buyer.reception_date, 14, 7),
        isBlank(buyer.latest_viewing_date),
        isBlank(buyer.follow_up_assignee),
        isBlank(buyer.latest_status),
        isBlank(buyer.broker_inquiry),
        notEquals(buyer.inquiry_source, '配信希望アンケート'),
        isBlank(buyer.viewing_promotion_not_needed),
        isBlank(buyer.viewing_promotion_sender)
      )
    ) {
      const status = '内覧促進メール（Pinrich)';
      return { status, priority: 32, matchedCondition: '内覧促進メール送信対象（Pinrich）', color: getStatusColor(status) };
    }

    // Priority 33: 要内覧促進客
    if (
      and(
        isWithinDaysAgo(buyer.reception_date, 14, 4),
        isBlank(buyer.latest_viewing_date),
        isBlank(buyer.follow_up_assignee),
        isBlank(buyer.latest_status),
        notEquals(buyer.viewing_promotion_not_needed, '不要'),
        isBlank(buyer.viewing_promotion_sender),
        isBlank(buyer.broker_inquiry),
        notEquals(buyer.inquiry_source, '配信希望アンケート'),
        not(contains(buyer.inquiry_source, 'ピンリッチ')),
        not(contains(buyer.inquiry_source, '2件目以降紹介')),
        and(
          notEquals(buyer.inquiry_confidence, 'e（買付物件の問合せ）'),
          notEquals(buyer.inquiry_confidence, 'd（資料送付不要、条件不適合など）'),
          notEquals(buyer.inquiry_confidence, 'b（内覧検討）')
        )
      )
    ) {
      const status = '要内覧促進客';
      return { status, priority: 33, matchedCondition: '内覧促進が必要な顧客', color: getStatusColor(status) };
    }

    // Priority 34: 買付有り、物件不適合の内覧促進客
    if (
      and(
        isWithinDaysAgo(buyer.reception_date, 7, 4),
        isBlank(buyer.latest_viewing_date),
        isBlank(buyer.follow_up_assignee),
        isBlank(buyer.latest_status),
        isBlank(buyer.viewing_promotion_sender),
        isBlank(buyer.viewing_promotion_not_needed),
        or(
          equals(buyer.inquiry_confidence, 'e（買付物件の問合せ）'),
          equals(buyer.inquiry_confidence, 'd（資料送付不要、条件不適合など）')
        ),
        notEquals(buyer.inquiry_confidence, 'b（内覧検討）'),
        isBlank(buyer.broker_inquiry),
        notEquals(buyer.inquiry_source, '配信希望アンケート')
      )
    ) {
      const status = '買付有り、物件不適合の内覧促進客';
      return { status, priority: 34, matchedCondition: '買付有りだが物件不適合の内覧促進対象', color: getStatusColor(status) };
    }

    // Priority 35: メアド確認必要
    if (
      and(
        isBlank(buyer.email),
        not(contains(buyer.latest_status, '買')),
        isBlank(buyer.follow_up_assignee),
        isAfterOrEqual(buyer.reception_date, '2023-01-01'),
        isBlank(buyer.broker_inquiry),
        isBlank(buyer.past_buyer_list),
        isBlank(buyer.email_confirmation_assignee),
        equals(buyer.email_confirmed, '未確認'),
        not(or(contains(buyer.inquiry_confidence, 'D'), contains(buyer.inquiry_confidence, 'd'))),
        not(or(contains(buyer.latest_status, 'D'), contains(buyer.latest_status, 'd')))
      )
    ) {
      const status = 'メアド確認必要';
      return { status, priority: 35, matchedCondition: 'メールアドレスの確認が必要', color: getStatusColor(status) };
    }

    return { status: '', priority: 0, matchedCondition: '該当なし', color: '#cccccc' };
  } catch (error) {
    console.error('Status calculation error:', error);
    return { status: '', priority: 0, matchedCondition: 'Error', color: '#cccccc' };
  }
}
