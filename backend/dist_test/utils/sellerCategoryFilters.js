"use strict";
/**
 * 売主カテゴリーフィルター共通関数
 *
 * ⚠️ このファイルが「唯一の真実の源（Single Source of Truth）」です。
 *
 * カテゴリー判定ロジックはここにのみ定義し、以下の全箇所から参照してください：
 *   1. SellerSidebarCountsUpdateService.ts  - updateSellerSidebarCounts()
 *   2. SellerSidebarCountsUpdateService.ts  - updateAffectedCategories()
 *   3. SellerService.supabase.ts            - getSidebarCountsFallback()
 *   4. SellerService.supabase.ts            - listSellers() の fi:xxx JSフィルタ
 *
 * フロントエンド（sellerStatusFilters.ts）も同じ条件を実装していますが、
 * camelCase フィールドを扱うため別実装になっています。
 * 条件を変更する場合は必ず両方を同時に更新してください。
 *
 * 入力データ形式：DBから直接取得した snake_case フィールドを持つオブジェクト
 * （decryptSeller() 経由の camelCase データには対応していません）
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.isUnvaluated = exports.isTodayCallNotStarted = exports.getTodayCallWithInfoLabel = exports.isTodayCallWithInfo = exports.isTodayCallNoInfo = exports.isTodayCallBase = exports.isFiSeller = exports.hasContactInfo = exports.hasValidVisitAssignee = void 0;
// ============================================================
// ヘルパー関数
// ============================================================
/**
 * 営担（visit_assignee）が有効かどうかを判定
 * 「外す」は担当なし扱い
 */
const hasValidVisitAssignee = (visitAssignee) => {
    if (!visitAssignee)
        return false;
    const trimmed = visitAssignee.trim();
    return trimmed !== '' && trimmed !== '外す';
};
exports.hasValidVisitAssignee = hasValidVisitAssignee;
/**
 * コミュニケーション情報（3フィールド）のいずれかに有効な値があるか判定
 * "null" 文字列も空扱い
 */
const hasContactInfo = (s) => {
    const isValid = (v) => !!(v && v.trim() !== '' && v.trim().toLowerCase() !== 'null');
    return isValid(s.phone_contact_person) ||
        isValid(s.preferred_contact_time) ||
        isValid(s.contact_method);
};
exports.hasContactInfo = hasContactInfo;
/**
 * FI（福岡）売主かどうかを判定
 */
const isFiSeller = (s) => {
    const num = (s.seller_number || '').toString();
    return num.startsWith('FI');
};
exports.isFiSeller = isFiSeller;
// ============================================================
// 当日TEL系 共通ベース条件
// ============================================================
/**
 * 当日TELのベース条件（営担チェックなし）
 * - status に「追客中」が含まれる（部分一致）
 * - 「追客不要」「専任媒介」「一般媒介」は除外
 * - next_call_date が todayJST 以前
 */
const isTodayCallBase = (s, todayJST) => {
    const status = s.status || '';
    if (!status.includes('追客中'))
        return false;
    if (status.includes('追客不要') || status.includes('専任媒介') || status.includes('一般媒介'))
        return false;
    if (!s.next_call_date)
        return false;
    return s.next_call_date <= todayJST;
};
exports.isTodayCallBase = isTodayCallBase;
// ============================================================
// 当日TEL分（todayCall）
// ============================================================
/**
 * 当日TEL分判定
 * 条件: ベース条件 + 営担なし + コミュニケーション情報が全て空
 * ※ 未着手（todayCallNotStarted）に該当する売主は除外（未着手を優先）
 */
const isTodayCallNoInfo = (s, todayJST) => {
    if (!(0, exports.isTodayCallBase)(s, todayJST))
        return false;
    if ((0, exports.hasValidVisitAssignee)(s.visit_assignee))
        return false;
    if ((0, exports.hasContactInfo)(s))
        return false;
    // 未着手条件を満たす場合は todayCall から除外（todayCallNotStarted にのみカウント）
    if ((0, exports.isTodayCallNotStarted)(s, todayJST))
        return false;
    return true;
};
exports.isTodayCallNoInfo = isTodayCallNoInfo;
/**
 * 当日TEL（内容）判定
 * 条件: ベース条件 + 営担なし + コミュニケーション情報のいずれかに入力あり
 */
const isTodayCallWithInfo = (s, todayJST) => {
    if (!(0, exports.isTodayCallBase)(s, todayJST))
        return false;
    if ((0, exports.hasValidVisitAssignee)(s.visit_assignee))
        return false;
    return (0, exports.hasContactInfo)(s);
};
exports.isTodayCallWithInfo = isTodayCallWithInfo;
/**
 * 当日TEL（内容）のラベルを生成
 */
const getTodayCallWithInfoLabel = (s) => {
    const isValid = (v) => !!(v && v.trim() !== '' && v.trim().toLowerCase() !== 'null');
    const parts = [];
    if (isValid(s.phone_contact_person))
        parts.push(s.phone_contact_person.trim());
    if (isValid(s.preferred_contact_time))
        parts.push(s.preferred_contact_time.trim());
    if (isValid(s.contact_method))
        parts.push(s.contact_method.trim());
    return parts.length > 0 ? `当日TEL(${parts.join('・')})` : '当日TEL（内容）';
};
exports.getTodayCallWithInfoLabel = getTodayCallWithInfoLabel;
// ============================================================
// 当日TEL_未着手（todayCallNotStarted）
// ============================================================
/**
 * 当日TEL_未着手判定
 *
 * 条件（全て満たす必要あり）:
 * - status === '追客中'（完全一致。「除外後追客中」「他決→追客」は除外）
 * - next_call_date が todayJST 以前
 * - 営担なし（visit_assignee が空 or '外す'）
 * - コミュニケーション情報が全て空
 * - unreachable_status が空
 * - confidence_level が 'ダブり', 'D', 'AI査定' でない
 * - inquiry_date >= '2026-01-01'
 */
const isTodayCallNotStarted = (s, todayJST) => {
    // status は完全一致（「除外後追客中」「他決→追客」は除外）
    if (s.status !== '追客中')
        return false;
    // 次電日が今日以前
    if (!s.next_call_date || s.next_call_date > todayJST)
        return false;
    // 営担なし
    if ((0, exports.hasValidVisitAssignee)(s.visit_assignee))
        return false;
    // コミュニケーション情報が全て空
    if ((0, exports.hasContactInfo)(s))
        return false;
    // 不通が空
    if ((s.unreachable_status || '').trim() !== '')
        return false;
    // 確度チェック
    const c = s.confidence_level || '';
    if (c === 'ダブり' || c === 'D' || c === 'AI査定')
        return false;
    // 反響日付が2026/1/1以降
    return (s.inquiry_date || '') >= '2026-01-01';
};
exports.isTodayCallNotStarted = isTodayCallNotStarted;
// ============================================================
// 未査定（unvaluated）
// ============================================================
/**
 * 未査定判定
 *
 * 条件（全て満たす必要あり）:
 * - status に「追客中」が含まれる
 * - 査定額1,2,3が全て空
 * - valuation_method が '不要' でない
 * - inquiry_date >= '2025-12-08'
 * - 営担なし
 * - 当日TEL_未着手に該当しない（未着手を優先）
 */
const isUnvaluated = (s, todayJST) => {
    const status = s.status || '';
    if (!status.includes('追客中') || status.includes('追客不要'))
        return false;
    if ((0, exports.hasValidVisitAssignee)(s.visit_assignee))
        return false;
    const hasValuation = s.valuation_amount_1 || s.valuation_amount_2 || s.valuation_amount_3;
    if (hasValuation)
        return false;
    if ((s.valuation_method || '') === '不要')
        return false;
    if ((s.inquiry_date || '') < '2025-12-08')
        return false;
    // 当日TEL_未着手に該当する場合は除外（未着手を優先）
    if ((0, exports.isTodayCallNotStarted)(s, todayJST))
        return false;
    return true;
};
exports.isUnvaluated = isUnvaluated;
