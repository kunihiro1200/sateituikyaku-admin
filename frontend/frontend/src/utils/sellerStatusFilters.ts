/**
 * Seller Status Filter Utility Functions
 * 
 * 売主リスト�EサイドバースチE�Eタスフィルター用のユーチE��リチE��関数
 * 
 * 【サイドバースチE�Eタス定義、E * 
 * 1. 「当日TEL刁E��E *    - 条件: 状況E��当社�E�に「追客中」が含まれる AND 次電日が今日以剁E *    - 追加条件: コミュニケーション惁E���E�連絡方況E連絡取りめE��ぁE��閁E電話拁E��）が**全て空**
 *    - 表示: コミュニケーション惁E��が�Eて空の売主のみ
 * 
 * 2. 「当日TEL�E��E容�E�、E *    - 条件: 状況E��当社�E�に「追客中」が含まれる AND 次電日が今日以剁E *    - 追加条件: コミュニケーション惁E��のぁE��れかに入力がある
 *    - 表示: 当日TEL(Eメール)、当日TEL(Y)など、�E容付きで表示
 *    - 侁E AA13489�E�Eメール�E�、AA13507�E�E�E�E * 
 * 3. 「未査定、E *    - 条件: 査定顁E,2,3が�Eて空 AND 反響日付が2025/12/8以陁EAND 営拁E��空
 * 
 * 4. 「査定（郵送E��、E *    - 条件: 郵送スチE�Eタスが「未、E * 
 * Requirements:
 * - 1.2: 当日TEL フィルター�E�コミュニケーション惁E��なし！E * - 1.3: 当日TEL�E��E容�E�フィルター�E�コミュニケーション惁E��あり�E�E * - 2.2: 未査宁Eフィルター
 * - 3.2: 査定（郵送E��Eフィルター
 */

import { Seller } from '../types';
import { isVisitDayBefore as isVisitDayBeforeUtil, parseDate } from './sellerStatusUtils';

// スチE�EタスカチE��リの型定義
// todayCall: コミュニケーション惁E��が�Eて空の当日TEL�E�営拁E��し！E// todayCallWithInfo: コミュニケーション惁E��のぁE��れかに入力がある当日TEL�E�営拁E��し！E// todayCallAssigned: 営拁E��めE+ 訪問日なぁE+ 次電日が今日以剁E// visitDayBefore: 訪問日前日�E�訪問日が�E日、また�E木曜訪問�E場合�E明後日�E�E// visitCompleted: 訪問済み�E�営拁E��入力あり、訪問日が昨日以前！E// todayCallNotStarted: 当日TEL_未着手（不通が空欁E+ 反響日付が2026/1/1以降！E// pinrichEmpty: Pinrich空欁E��Einrichカラムが空欁E��E// exclusive: 専任カチE��リー�E�専任他決打合ぁE<> "完亁E + 次電日 <> TODAY() + 状況が専任媒介関連�E�E// general: 一般カチE��リー�E�専任他決打合ぁE<> "完亁E + 次電日 <> TODAY() + 状況が一般媒仁E+ 契紁E��朁E>= 2025/6/23�E�E// visitOtherDecision: 訪問後他決カチE��リー�E�専任他決打合ぁE<> "完亁E + 次電日 <> TODAY() + 状況が他決関連 + 営拁E��り！E// unvisitedOtherDecision: 未訪問他決カチE��リー�E�専任他決打合ぁE<> "完亁E + 次電日 <> TODAY() + 状況が他決関連 + 営拁E��し！Eexport type StatusCategory = 'all' | 'todayCall' | 'todayCallWithInfo' | 'todayCallAssigned' | 'visitDayBefore' | 'visitCompleted' | 'unvaluated' | 'mailingPending' | 'todayCallNotStarted' | 'pinrichEmpty' | 'pinrichChangeRequired' | 'exclusive' | 'general' | 'visitOtherDecision' | 'unvisitedOtherDecision' | 'matching' | 'restored'
  | `visitAssigned:${string}`        // 拁E��カチE��リー�E�侁E visitAssigned:Y�E�E  | `todayCallAssigned:${string}`    // 当日TELサブカチE��リー�E�侁E todayCallAssigned:Y�E�E  | `todayCallWithInfo:${string}`    // 当日TEL�E��E容�E�ラベル別カチE��リー�E�侁E todayCallWithInfo:当日TEL(I・Eメール)�E�E  | `visitThankYouPending:${string}`  // 訪問後御礼サブカチE��リー�E�侁E visitThankYouPending:Y�E�E  | `unvisitedOtherDecision:${string}`; // 未訪問他決の月別サブカチE��リー�E�侁E unvisitedOtherDecision:2026-08�E�E
// カチE��リカウント�Eインターフェース
export interface CategoryCounts {
  all: number;
  todayCall: number;           // 当日TEL刁E��コミュニケーション惁E��なし、営拁E��し！E  todayCallWithInfo: number;   // 当日TEL�E��E容�E�（コミュニケーション惁E��あり、営拁E��し！E  todayCallAssigned: number;   // 当日TEL�E�担当）（営拁E��り、訪問日なし、次電日が今日以前！E  visitDayBefore: number;      // 訪問日前日�E�訪問日が翌営業日�E�E  visitCompleted: number;      // 訪問済み�E�営拁E��入力あり、訪問日が昨日以前！E  unvaluated: number;
  mailingPending: number;
  todayCallNotStarted: number; // 当日TEL_未着手（不通が空欁E+ 反響日付が2026/1/1以降！E  pinrichEmpty: number;        // Pinrich空欁E��Einrichカラムが空欁E��E  pinrichChangeRequired: number; // Pinrich要変更�E�条件A〜DのぁE��れかを満たす�E�E  exclusive: number;           // 専任カチE��リー�E�専任他決打合ぁE<> "完亁E + 次電日 <> TODAY() + 状況が専任媒介関連�E�E  general: number;             // 一般カチE��リー�E�専任他決打合ぁE<> "完亁E + 次電日 <> TODAY() + 状況が一般媒仁E+ 契紁E��朁E>= 2025/6/23�E�E  visitOtherDecision: number;  // 訪問後他決カチE��リー�E�専任他決打合ぁE<> "完亁E + 次電日 <> TODAY() + 状況が他決関連 + 営拁E��り（「外す」含む�E�！E  unvisitedOtherDecision: number; // 未訪問他決カチE��リー�E�専任他決打合ぁE<> "完亁E + 次電日 <> TODAY() + 状況が他決関連 + 営拁E��し！E  restored: number;            // 復允E��チE��リー�E�削除から復允E��れたレコード！E  visitAssignedCounts?: Record<string, number>;     // 拁E��老E��件数�E��E売主�E�E  todayCallAssignedCounts?: Record<string, number>; // 拁E��老E��当日TEL件数
  todayCallWithInfoLabels?: string[];               // 当日TEL�E��E容�E��Eユニ�Eクラベル一覧�E��E件対象�E�E  todayCallWithInfoLabelCounts?: Record<string, number>; // ラベル別件数�E��E件対象�E�E  // 福岡�E�EI�E�専用カウンチE  fi_todayCall?: number;
  fi_todayCallNotStarted?: number;
  fi_todayCallWithInfo?: number;
  fi_unvaluated?: number;
  fi_mailingPending?: number;
  fi_todayCallWithInfoLabelCounts?: Record<string, number>;
}

/**
 * 日本時間�E�EST�E�で今日の日付文字�Eを取得！EYYY-MM-DD形式！E * タイムゾーンに依存しなぁE��付比輁E�Eため、文字�Eで比輁E��めE */
const getTodayJSTString = (): string => {
  const now = new Date();
  // UTCに変換してから9時間足してJSTにする
  const jstTime = new Date(now.getTime() + (9 * 60 * 60 * 1000));
  const year = jstTime.getUTCFullYear();
  const month = String(jstTime.getUTCMonth() + 1).padStart(2, '0');
  const day = String(jstTime.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

/**
 * 日付文字�Eを正規化�E�EYYY-MM-DD形式に変換�E�E * タイムゾーンに依存しなぁE��付比輁E�Eため
 */
const normalizeDateString = (dateStr: string | Date | undefined | null): string | null => {
  if (!dateStr) return null;
  
  try {
    let dateString: string;
    
    if (dateStr instanceof Date) {
      // UTC基準で日付文字�Eを生成！Eercel UTC環墁E��の一致を保証�E�E      // getFullYear()はローカルタイム依存�Eため使用しなぁE      const year = dateStr.getUTCFullYear();
      const month = String(dateStr.getUTCMonth() + 1).padStart(2, '0');
      const day = String(dateStr.getUTCDate()).padStart(2, '0');
      dateString = `${year}-${month}-${day}`;
    } else {
      dateString = dateStr;
    }
    
    // "2026/1/27" 形式を "2026-01-27" 形式に変換
    if (dateString.includes('/')) {
      const parts = dateString.split('/');
      if (parts.length === 3) {
        const year = parts[0];
        const month = parts[1].padStart(2, '0');
        const day = parts[2].padStart(2, '0');
        return `${year}-${month}-${day}`;
      }
    }
    
    // "2026-01-27" 形式�E場合、日付部刁E�Eみ抽出
    if (dateString.includes('-')) {
      // ISO形式！E区刁E���E�また�Eスペ�Eス区刁E��の日時文字�E�E�E2026-05-19 01:34:33"�E�に対忁E      const datePart = dateString.split('T')[0].split(' ')[0]; // 日付部刁E�Eみ抽出
      const parts = datePart.split('-');
      if (parts.length === 3) {
        const year = parts[0];
        const month = parts[1].padStart(2, '0');
        const day = parts[2].padStart(2, '0');
        return `${year}-${month}-${day}`;
      }
    }
    
    return null;
  } catch {
    return null;
  }
};

/**
 * 安�Eな日付比輁E�Eルパ�E関数�E�後方互換性のため残す�E�E * 無効な日付�E場合�Enullを返す
 */
const safeParseDate = (dateStr: string | Date | undefined | null): Date | null => {
  const normalized = normalizeDateString(dateStr);
  if (!normalized) return null;
  
  const parts = normalized.split('-');
  const year = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10) - 1;
  const day = parseInt(parts[2], 10);
  
  const date = new Date(year, month, day);
  date.setHours(0, 0, 0, 0);
  return date;
};

/**
 * 日本時間�E�EST�E�で今日の日付を取得（後方互換性のため残す�E�E */
const getTodayJST = (): Date => {
  const todayStr = getTodayJSTString();
  const parts = todayStr.split('-');
  const date = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
  date.setHours(0, 0, 0, 0);
  return date;
};

/**
 * 日付が今日以前かどぁE��を判定！EST基準、文字�E比輁E��E * タイムゾーンに依存しなぁE��確な比輁E */
const isTodayOrBefore = (dateStr: string | Date | undefined | null): boolean => {
  const normalized = normalizeDateString(dateStr);
  if (!normalized) return false;
  
  const todayStr = getTodayJSTString();
  // 斁E���E比輁E��EYYY-MM-DD形式なので辞書頁E��比輁E��能�E�E  return normalized <= todayStr;
};

/**
 * 日付が昨日以前かどぁE��を判定！EST基準、文字�E比輁E��E * タイムゾーンに依存しなぁE��確な比輁E */
const isYesterdayOrBefore = (dateStr: string | Date | undefined | null): boolean => {
  const normalized = normalizeDateString(dateStr);
  if (!normalized) return false;
  
  const todayStr = getTodayJSTString();
  // 斁E���E比輁E��EYYY-MM-DD形式なので辞書頁E��比輁E��能�E�E  // 昨日以剁E= 今日より剁E  return normalized < todayStr;
};

/**
 * 営拁E��EisitAssignee�E�に有効な入力があるかどぁE��を判宁E * 「外す」�E有効な営業拁E���E値として扱ぁE */
const hasVisitAssignee = (seller: Seller | any): boolean => {
  // visitAssigneeInitials�E��Eのイニシャル�E�を優先して確誁E  // visitAssigneeはフルネ�Eムに変換されてぁE��場合があるため
  // visitAssignee�E�EamelCase�E�も参�E�E�EPIレスポンスの形式に対応！E  const visitAssignee = seller.visitAssigneeInitials || seller.visit_assignee || seller.visitAssignee || '';
  // 空斁E��また�E「外す」�E場合�E拁E��なしとみなぁE  // 「外す」�E営拁E��外す持E��であり、実質皁E��拁E��なしと同じ扱ぁE  if (!visitAssignee || visitAssignee.trim() === '' || visitAssignee.trim() === '外す') {
    return false;
  }
  return true;
};

/**
 * 日付が今日以降かどぁE��を判定！EST基準、文字�E比輁E��E * タイムゾーンに依存しなぁE��確な比輁E */
const isTodayOrAfter = (dateStr: string | Date | undefined | null): boolean => {
  const normalized = normalizeDateString(dateStr);
  if (!normalized) return false;
  
  const todayStr = getTodayJSTString();
  // 斁E���E比輁E��EYYY-MM-DD形式なので辞書頁E��比輁E��能�E�E  return normalized >= todayStr;
};

/**
 * 訪問日前日判宁E * 
 * 【サイドバー表示】「訪問日前日、E * 
 * 条件:
 * - 営拁E��EisitAssignee�E�に入力がある
 * - 今日が訪問日の「前営業日」である
 *   - 通常: 訪問日の1日剁E *   - 木曜訪問�E場吁E 2日前（水曜が定休日のため火曜に通知�E�E * 
 * @param seller 売主チE�Eタ
 * @returns 訪問日前日対象かどぁE��
 */
export const isVisitDayBefore = (seller: Seller | any): boolean => {
  // チE��チE��ログ
  console.log('[isVisitDayBefore] Checking seller:', seller.sellerNumber || seller.seller_number);
  
  if (!hasVisitAssignee(seller)) {
    console.log('[isVisitDayBefore] No visit assignee');
    return false;
  }
  
  let visitDate = seller.visitDate || seller.visit_date;
  if (!visitDate) {
    console.log('[isVisitDayBefore] No visit date');
    return false;
  }
  
  console.log('[isVisitDayBefore] Original visit_date:', visitDate);
  
  // 🚨 TIMESTAMP型対忁E visit_dateから日付部刁E�Eみを抽出
  // visit_date は "YYYY-MM-DD HH:MM:SS" また�E "YYYY-MM-DDTHH:MM:SS.000Z" 形弁E  if (typeof visitDate === 'string') {
    // スペ�Eスまた�ETで刁E��して日付部刁E�Eみを取征E    if (visitDate.includes(' ')) {
      visitDate = visitDate.split(' ')[0]; // "YYYY-MM-DD HH:MM:SS" ↁE"YYYY-MM-DD"
    } else if (visitDate.includes('T')) {
      visitDate = visitDate.split('T')[0]; // "YYYY-MM-DDTHH:MM:SS.000Z" ↁE"YYYY-MM-DD"
    }
  }
  
  console.log('[isVisitDayBefore] Extracted visit_date:', visitDate);
  
  // visitReminderAssigneeに値がある場合�E除外（通知拁E��が既に割り当て済み�E�E  const visitReminderAssignee = seller.visitReminderAssignee || seller.visit_reminder_assignee || '';
  if (visitReminderAssignee.trim() !== '') {
    console.log('[isVisitDayBefore] Visit reminder assignee already set');
    return false;
  }
  
  // sellerStatusUtils の実裁E��使用�E�水曜定休�E木曁E日前ロジチE���E�E  const todayStr = getTodayJSTString();
  const todayParts = todayStr.split('-');
  const todayDate = new Date(
    parseInt(todayParts[0]),
    parseInt(todayParts[1]) - 1,
    parseInt(todayParts[2])
  );
  todayDate.setHours(0, 0, 0, 0);
  
  console.log('[isVisitDayBefore] Today:', todayStr, todayDate);
  
  // 日付形式が不正な場合�Efalseを返す�E�防御皁E�Eログラミング�E�E  try {
    const result = isVisitDayBeforeUtil(String(visitDate), todayDate);
    console.log('[isVisitDayBefore] Result:', result);
    return result;
  } catch (error) {
    console.error('[isVisitDayBefore] Invalid visit_date format:', visitDate, error);
    return false;
  }
};

// 後方互換性のためのエイリアス�E�旧 isVisitScheduled�E�Eexport const isVisitScheduled = isVisitDayBefore;

/**
 * 訪問済み判定（営拁E��入力あり、訪問日が昨日以前！E * 
 * 【サイドバー表示】「訪問済み�E�イニシャル�E�、E * 
 * 条件:
 * - 営拁E��EisitAssignee�E�に入力がある
 * - 訪問日�E�EisitDate�E�が昨日以剁E * 
 * @param seller 売主チE�Eタ
 * @returns 訪問済み対象かどぁE��
 */
export const isVisitCompleted = (seller: Seller | any): boolean => {
  if (!hasVisitAssignee(seller)) {
    return false;
  }
  
  const visitDate = seller.visitDate || seller.visit_date;
  if (!visitDate) {
    return false;
  }
  
  return isYesterdayOrBefore(visitDate);
};

// 訪問後御礼の対象開始日�E�この日以降�E訪問が対象�E�Econst VISIT_THANK_YOU_CUTOFF = '2026-05-28';

/**
 * 訪問後御礼メール未送信判宁E * 
 * 【サイドバー表示】「�E 訪問後御礼(イニシャル)、E * 
 * 条件:
 * - 営拁E��EisitAssignee�E�に入力がある
 * - 訪問日�E�EisitDate�E�が 2026/5/28 以降かつ今日以前（訪問済み�E�E * - visitThankYouSent フラグぁEfalse�E�バチE��エンドから付与！E * 
 * @param seller 売主チE�Eタ�E�EisitThankYouSent フィールドを含む�E�E * @returns 訪問後御礼メール未送信かどぁE��
 */
export const isVisitThankYouPending = (seller: Seller | any): boolean => {
  // 営拁E��なぁE��合�E対象夁E  if (!hasVisitAssignee(seller)) {
    return false;
  }
  // 訪問日を取得�E正規化
  let visitDate = seller.visitDate || seller.visit_date;
  if (!visitDate) {
    return false;
  }
  const normalized = normalizeDateString(visitDate);
  if (!normalized) {
    return false;
  }
  // 訪問日ぁE2026-05-28 以降かつ今日以前（訪問済み�E�E  const todayStr = getTodayJSTString();
  if (normalized < VISIT_THANK_YOU_CUTOFF || normalized > todayStr) {
    return false;
  }
  // バックエンドから付与された「御礼メール送信済み」フラグで判宁E  // visitThankYouSent ぁEtrue なら送信済み ↁE対象夁E  if (seller.visitThankYouSent === true) {
    return false;
  }
  return true;
};

/**
 * 訪問後御礼の表示ラベルを取征E * 
 * @param seller 売主チE�Eタ
 * @returns 表示ラベル�E�侁E "訪問後御礼(Y)"�E�E */
export const getVisitThankYouPendingLabel = (seller: Seller | any): string => {
  const visitAssignee = seller.visitAssigneeInitials || seller.visit_assignee || seller.visitAssignee || '';
  if (visitAssignee && visitAssignee.trim() !== '') {
    return `訪問後御礼(${visitAssignee})`;
  }
  return '訪問後御礼';
};

/**
 * 訪問予宁E訪問済みの表示ラベルを取征E * 
 * @param seller 売主チE�Eタ
 * @param type 'scheduled' | 'completed'
 * @returns 表示ラベル�E�侁E "訪問予宁EY)"、E訪問済み(I)"�E�E */
export const getVisitStatusLabel = (seller: Seller | any, type: 'scheduled' | 'completed'): string => {
  const visitAssignee = seller.visitAssignee || seller.visit_assignee || '';
  const prefix = type === 'scheduled' ? '訪問予宁E : '訪問済み';
  
  if (visitAssignee && visitAssignee.trim() !== '') {
    return `${prefix}(${visitAssignee})`;
  }
  
  return prefix;
};

/**
 * 拁E���E判定（営拁E��入力あり、訪問日なし！E * 
 * 【サイドバー表示】「担当�E�E�イニシャル�E�、E * 
 * 条件:
 * - 営拁E��EisitAssignee�E�に入力がある
 * - 訪問日�E�EisitDate�E�が空
 * 
 * @param seller 売主チE�Eタ
 * @returns 拁E���E対象かどぁE��
 */
export const isAssignedNoVisitDate = (seller: Seller | any): boolean => {
  if (!hasVisitAssignee(seller)) {
    return false;
  }
  
  const visitDate = seller.visitDate || seller.visit_date;
  // 訪問日が空の場合�Eみ「担当�E、E  return !visitDate || (typeof visitDate === 'string' && visitDate.trim() === '');
};

/**
 * 拁E���Eの表示ラベルを取征E * 
 * @param seller 売主チE�Eタ
 * @returns 表示ラベル�E�侁E "拁E���E(Y)"、E拁E���E(I)"�E�E */
export const getAssignedNoVisitDateLabel = (seller: Seller | any): string => {
  const visitAssignee = seller.visitAssignee || seller.visit_assignee || '';
  
  if (visitAssignee && visitAssignee.trim() !== '') {
    return `拁E���E(${visitAssignee})`;
  }
  
  return '拁E���E';
};

/**
 * 当日TEL�E�担当）判定（営拁E��めE+ 次電日が今日以前！E * 
 * 【サイドバー表示】「当日TEL�E�イニシャル�E�、E * 
 * 条件:
 * - 営拁E��EisitAssignee�E�に入力がある
 * - 次電日が今日以剁E * 
 * 注愁E 訪問日の有無に関係なく、次電日が今日以前であれば対象
 * 
 * @param seller 売主チE�Eタ
 * @returns 当日TEL�E�担当）対象かどぁE��
 */
export const isTodayCallAssigned = (seller: Seller | any): boolean => {
  // 営拁E��なぁE��合�E対象夁E  if (!hasVisitAssignee(seller)) {
    return false;
  }
  
  // 状況E��当社�E�に「追客中」が含まれるかチェチE��
  const status = seller.status || '';
  if (!status.includes('追客中')) {
    return false;
  }
  
  // 追客不要、専任媒介、一般媒介が含まれる場合�E対象夁E  if (status.includes('追客不要E) || status.includes('専任媒仁E) || status.includes('一般媒仁E)) {
    return false;
  }
  
  // 次電日が今日以前かチェチE��
  const nextCallDate = seller.nextCallDate || seller.next_call_date;
  return isTodayOrBefore(nextCallDate);
};

/**
 * 当日TEL�E�担当）�E表示ラベルを取征E * 
 * @param seller 売主チE�Eタ
 * @returns 表示ラベル�E�侁E "当日TEL(Y)"、E当日TEL(I)"�E�E */
export const getTodayCallAssignedLabel = (seller: Seller | any): string => {
  const visitAssignee = seller.visitAssignee || seller.visit_assignee || '';
  
  if (visitAssignee && visitAssignee.trim() !== '') {
    return `当日TEL(${visitAssignee})`;
  }
  
  return '当日TEL�E�担当！E;
};

/**
 * 当日TELの共通条件を判宁E * 
 * 修正後�E条件:
 * - 状況E��当社�E�に「追客」とぁE��斁E���Eが含まれる�E�部刁E��致�E�E * - ただし「追客不要」「専任媒介」「一般媒介」を含む場合�E除夁E * - 次電日が今日以前（かつ空でなぁE��E * 
 * @param seller 売主チE�Eタ
 * @returns 当日TELの共通条件を満たすかどぁE��
 */
const isTodayCallBase = (seller: Seller | any): boolean => {
  // 状況E��当社�E�に「追客」が含まれるかチェチE���E�部刁E��致�E�E  const status = seller.status || seller.situation_company || '';
  
  // 「追客」が含まれなぁE��合�E対象夁E  if (typeof status !== 'string' || !status.includes('追客')) {
    return false;
  }
  
  // 「追客不要」「専任媒介」「一般媒介」が含まれる場合�E対象夁E  if (status.includes('追客不要E) || status.includes('専任媒仁E) || status.includes('一般媒仁E)) {
    return false;
  }
  
  // 次電日が空でなぁE��つ今日以前かチェチE��
  const nextCallDate = seller.nextCallDate || seller.next_call_date;
  if (!nextCallDate) return false;
  
  return isTodayOrBefore(nextCallDate);
};

/**
 * コミュニケーション惁E��があるかどぁE��を判宁E * 
 * コミュニケーション惁E��の3つのフィールチE
 * 1. 連絡方況E(contact_method)
 * 2. 連絡取りめE��ぁE��閁E(preferred_contact_time)
 * 3. 電話拁E��E(phone_contact_person)
 * 
 * @param seller 売主チE�Eタ
 * @returns コミュニケーション惁E��のぁE��れかに入力があるかどぁE��
 */
const hasContactInfo = (seller: Seller | any): boolean => {
  const contactMethod = seller.contactMethod || seller.contact_method || '';
  const preferredContactTime = seller.preferredContactTime || seller.preferred_contact_time || '';
  const phoneContactPerson = seller.phoneContactPerson || seller.phone_contact_person || '';
  
  // "null" 斁E���Eも空扱ぁE  const isValid = (v: string): boolean => !!(v && v.trim() !== '' && v.trim().toLowerCase() !== 'null');
  
  return isValid(contactMethod) || isValid(preferredContactTime) || isValid(phoneContactPerson);
};

/**
 * 当日TEL刁E��定（コミュニケーション惁E��が�Eて空の売主のみ�E�E * 
 * 【サイドバー表示】「当日TEL刁E��E * 
 * 条件:
 * - 状況E��当社�E�に「追客中」が含まれる
 * - 次電日が今日以剁E * - コミュニケーション惁E���E�連絡方況E連絡取りめE��ぁE��閁E電話拁E��）が**全て空**
 * - 営拁E��EisitAssignee�E�が空�E�営業拁E��が設定されてぁE��売主は除外！E * 
 * 注愁E コミュニケーション惁E��のぁE��れかに入力がある売主は
 * 「当日TEL刁E��としてカウントしなぁEↁE「当日TEL�E��E容�E�」に刁E��される
 * 
 * 【優先頁E��、E * 1. 営拁E��めEↁE当日TEL刁E��ら除外（訪問日の有無に関係なく！E * 2. 当日TEL刁E当日TEL�E��E容�E��E 営拁E��空の場合�Eみ
 * 
 * @param seller 売主チE�Eタ
 * @returns 当日TEL刁E��象かどぁE��
 * 
 * Requirements: 1.2
 */
export const isTodayCall = (seller: Seller | any): boolean => {
  // 営拁E��入力がある売主は当日TELから除外（訪問日の有無に関係なく！E  if (hasVisitAssignee(seller)) {
    return false;
  }
  
  // 共通条件をチェチE��
  if (!isTodayCallBase(seller)) {
    return false;
  }
  
  // コミュニケーション惁E��が�Eて空の場合�Eみ「当日TEL刁E��としてカウンチE  return !hasContactInfo(seller);
};

/**
 * 当日TEL�E��E容�E�判定（コミュニケーション惁E��のぁE��れかに入力がある売主�E�E * 
 * 【サイドバー表示】「当日TEL�E��E容�E�、E * 
 * 条件:
 * - 状況E��当社�E�に「追客中」が含まれる
 * - 次電日が今日以剁E * - コミュニケーション惁E���E�連絡方況E連絡取りめE��ぁE��閁E電話拁E��）�E**ぁE��れかに入力がある**
 * - 営拁E��EisitAssignee�E�が空�E�営業拁E��が設定されてぁE��売主は除外！E * 
 * 侁E
 * - AA13489: contact_method = "Eメール" ↁE当日TEL(Eメール)
 * - AA13507: phone_contact_person = "Y" ↁE当日TEL(Y)
 * 
 * 【優先頁E��、E * 1. 営拁E��めEↁE当日TEL�E��E容�E�から除外（訪問日の有無に関係なく！E * 2. 当日TEL刁E当日TEL�E��E容�E��E 営拁E��空の場合�Eみ
 * 
 * @param seller 売主チE�Eタ
 * @returns 当日TEL�E��E容�E�対象かどぁE��
 * 
 * Requirements: 1.3
 */
export const isTodayCallWithInfo = (seller: Seller | any): boolean => {
  // 営拁E��入力がある売主は当日TELから除外（訪問日の有無に関係なく！E  if (hasVisitAssignee(seller)) {
    return false;
  }
  
  // 共通条件をチェチE��
  if (!isTodayCallBase(seller)) {
    return false;
  }
  
  // コミュニケーション惁E��のぁE��れかに入力がある場合「当日TEL�E��E容�E�」としてカウンチE  return hasContactInfo(seller);
};

/**
 * 当日TEL�E��E容�E��E表示ラベルを取征E * 
 * コミュニケーション惁E��の表示頁E
 * 1. 電話拁E��E(phone_contact_person) ↁE当日TEL(Y)
 * 2. 連絡取りめE��ぁE��閁E(preferred_contact_time) ↁE当日TEL(午前中)
 * 3. 連絡方況E(contact_method) ↁE当日TEL(Eメール)
 * 
 * 褁E��のフィールドに値がある場合�E・で結合して表示する
 * 侁E phone_contact_person="I", contact_method="Eメール" ↁE当日TEL(I・Eメール)
 * 
 * @param seller 売主チE�Eタ
 * @returns 表示ラベル�E�侁E "当日TEL(I・Eメール)"�E�E */
export const getTodayCallWithInfoLabel = (seller: Seller | any): string => {
  const contactMethod = seller.contactMethod || seller.contact_method || '';
  const preferredContactTime = seller.preferredContactTime || seller.preferred_contact_time || '';
  const phoneContactPerson = seller.phoneContactPerson || seller.phone_contact_person || '';

  // "null" 斁E���Eも空扱ぁE  const isValid = (v: string): boolean => !!(v && v.trim() !== '' && v.trim().toLowerCase() !== 'null');

  // 表示頁E 電話拁E���E連絡取りめE��ぁE��間�E連絡方況E  const parts: string[] = [];
  if (isValid(phoneContactPerson)) parts.push(phoneContactPerson);
  if (isValid(preferredContactTime)) parts.push(preferredContactTime);
  if (isValid(contactMethod)) parts.push(contactMethod);

  if (parts.length === 0) {
    return '当日TEL�E��E容�E�E;
  }

  return `当日TEL(${parts.join('・')})`;
};

/**
 * 査定不要かどぁE��を判宁E * 査定方法が「不要」�E場合�E査定不要とみなぁE */
const isValuationNotRequired = (seller: Seller | any): boolean => {
  // valuationMethodが「不要」�E場合�E査定不要E  // 🚨 重要E mailingStatus�E�郵送スチE�Eタス�E�ではなく、valuationMethod�E�査定方法）をチェチE��
  if (seller.valuationMethod === '不要E || seller.valuation_method === '不要E) return true;
  
  // 他�E査定不要条件があれ�Eここに追加
  // 侁E seller.valuationNotRequired === true
  
  return false;
};

/**
 * 当日TEL_未着手判宁E * 
 * APPSHEETの「当日TEL刁E未着手」条件:
 * - 反響日仁E>= 2026/1/1�E�独自設定！E * - 状況E��当社�E�E "追客中"�E�完�E一致�E�E * - 営拁E= ""�E�EsTodayCallで拁E��！E * - 不送E= ""�E�空欁E��E * - 確度 <> "ダブり"
 * - 確度 <> "D"
 * - 確度 <> "AI査宁E
 * - 次電日 <= TODAY()�E�EsTodayCallBaseで拁E��！E * - コミュニケーション惁E��が�Eて空�E�EsTodayCallで拁E��！E * - 除外日にすること = ""�E�空�E�E * 
 * @param seller 売主チE�Eタ
 * @returns 当日TEL_未着手対象かどぁE��
 */
export const isTodayCallNotStarted = (seller: Seller | any): boolean => {
  const CUTOFF_DATE_STR = '2026-01-01';
  
  // まず当日TEL刁E�E条件を満たすかチェチE���E�営拁E��ぁE+ 追客中系 + 次電日今日以剁E+ コミュニケーション惁E��なし！E  if (!isTodayCall(seller)) {
    return false;
  }
  
  // 状況が「追客中」�Eみ�E�完�E一致�E�E  // 「除外後追客中」「他決→追客」�E当日TEL_未着手�E対象夁E  const status = seller.status || '';
  if (status !== '追客中') {
    return false;
  }
  
  // 不通カラムが空欁E��チェチE��
  const unreachableStatus = seller.unreachableStatus || seller.unreachable_status || '';
  if (unreachableStatus && unreachableStatus.trim() !== '') {
    return false;
  }
  
  // 確度が「ダブり」「D」「AI査定」�E場合�E除夁E  const confidence = seller.confidence || seller.confidenceLevel || seller.confidence_level || '';
  if (confidence === 'ダブり' || confidence === 'D' || confidence === 'AI査宁E) {
    return false;
  }
  
  // 反響日付が2026/1/1以降かチェチE��
  const inquiryDate = seller.inquiryDate || seller.inquiry_date || seller.inquiryDetailedDatetime;
  const normalizedInquiryDate = normalizeDateString(inquiryDate);
  
  if (!normalizedInquiryDate) {
    return false;
  }
  
  return normalizedInquiryDate >= CUTOFF_DATE_STR;
};

/**
 * 未査定判宁E * 
 * 条件:
 * - 査定顁E, 2, 3が�Eて空欁E���E動計算と手動入力�E両方�E�E * - 反響日付が2025/12/8以陁E * - 査定不要ではなぁE * - 営拁E��EisitAssignee�E�が空欁E * - 状況E��当社�E�に「追客中」が含まれる
 * 
 * @param seller 売主チE�Eタ
 * @returns 未査定対象かどぁE��
 * 
 * Requirements: 2.2
 */
export const isUnvaluated = (seller: Seller | any): boolean => {
  // 未査定�E基準日: 2025/12/8�E�文字�E比輁E���E�E  const CUTOFF_DATE_STR = '2025-12-08';
  
  // 査定不要�E場合�E未査定として表示しなぁE  if (isValuationNotRequired(seller)) {
    return false;
  }
  
  // 状況E��当社�E�に「追客中」が含まれるかチェチE��
  const status = seller.status || seller.situation_company || '';
  const isFollowingUp = typeof status === 'string' && status.includes('追客中');
  if (!isFollowingUp) {
    return false;
  }
  
  // 営拁E��値がある場合�E未査定として表示しなぁE  const hasAssignee = (seller.visitAssigneeInitials || seller.visit_assignee || seller.visitAssignee) && 
                      typeof (seller.visitAssigneeInitials || seller.visit_assignee || seller.visitAssignee) === 'string' && 
                      (seller.visitAssigneeInitials || seller.visit_assignee || seller.visitAssignee).trim() !== '';
  if (hasAssignee) {
    return false;
  }
  
  // 査定額が全て空欁E��チェチE���E��E動計算と手動入力�E両方�E�E  // valuationAmount1/2/3: 通常の査定額（手動�E力優先、なければ自動計算！E  // manualValuationAmount1/2/3: 手動入力査定額（存在する場合！E  const hasNoValuation = !seller.valuationAmount1 && 
                         !seller.valuationAmount2 && 
                         !seller.valuationAmount3 &&
                         !seller.manualValuationAmount1 &&
                         !seller.manualValuationAmount2 &&
                         !seller.manualValuationAmount3;
  
  if (!hasNoValuation) {
    return false;
  }
  
  // 反響日付が基準日以降かチェチE���E�文字�E比輁E��E  // inquiryDate�E�Enquiry_date�E�を優先する（バチE��エンド�EカウントロジチE��と一致�E�E  // inquiryDetailedDatetime は詳細日時�Eため、日付比輁E��は inquiry_date を使用
  const inquiryDate = seller.inquiryDate || seller.inquiry_date || seller.inquiryDetailedDatetime;
  const normalizedInquiryDate = normalizeDateString(inquiryDate);
  
  if (!normalizedInquiryDate) {
    return false;
  }
  
  // 当日TEL_未着手�E条件を満たす場合�E未査定から除外（未着手が優先！E  if (isTodayCallNotStarted(seller)) {
    return false;
  }

  return normalizedInquiryDate >= CUTOFF_DATE_STR;
};

/**
 * 査定（郵送E��判宁E * 
 * 条件:
 * - 郵送スチE�Eタス�E�EailingStatus�E�が「未、E * 
 * @param seller 売主チE�Eタ
 * @returns 査定（郵送E��対象かどぁE��
 * 
 * Requirements: 3.2
 */
export const isMailingPending = (seller: Seller | any): boolean => {
  return seller.mailingStatus === '未';
};

/**
 * 復允E��ィルター
 * 
 * 条件: is_restored = true
 */
export const isRestored = (seller: Seller | any): boolean => {
  return seller.isRestored === true;
};

/**
 * Pinrich空欁E��宁E * 
 * 条件:
 * - 状況E��当社�E�に「追客中」が含まれる�E�部刁E��致�E�E * - Pinrichカラム�E�EinrichStatus�E�が空欁E * - 反響日付が2026/1/1以陁E * - 営拁E��EisitAssignee�E�が空欁E * ※ 次電日は条件に含まなぁE * 
 * @param seller 売主チE�Eタ
 * @returns Pinrich空欁E��象かどぁE��
 */
export const isPinrichEmpty = (seller: Seller | any): boolean => {
  // 状況E��当社�E�に「追客中」が含まれるかチェチE���E�部刁E��致�E�E  const status = seller.status || seller.situation_company || '';
  if (typeof status !== 'string' || !status.includes('追客')) return false;
  if (status.includes('追客不要E) || status.includes('専任媒仁E) || status.includes('一般媒仁E)) return false;

  // 営拁E��空欁E��チェチE��
  if (hasVisitAssignee(seller)) return false;

  // Pinrichカラムが空欁E��チェチE��
  const pinrichStatus = seller.pinrichStatus || seller.pinrich_status || '';
  if (pinrichStatus && pinrichStatus.trim() !== '') return false;

  // 反響日付が2026/1/1以降かチェチE��
  const inquiryDate = seller.inquiryDate || seller.inquiry_date || '';
  const normalizedInquiry = normalizeDateString(inquiryDate);
  if (!normalizedInquiry || normalizedInquiry < '2026-01-01') return false;

  return true;
};

/**
 * Pinrich要変更カチE��リー判定（新条件�E�E * 
 * 条件:
 * - pinrichStatus === '配信中'
 * - visitAssignee に有効な値がある（空・null・'外す' は除外！E * - inquiryDate >= '2026-01-01'
 * 
 * @param seller 売主チE�Eタ
 * @returns Pinrich要変更対象かどぁE��
 * 
 * Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 4.1
 */
export const isPinrichNeedsChange = (seller: Seller | any): boolean => {
  const pinrichStatus = seller.pinrichStatus || seller.pinrich_status || '';
  if (pinrichStatus !== '配信中') return false;

  const visitAssignee = seller.visitAssigneeInitials || seller.visit_assignee || seller.visitAssignee || '';
  if (!visitAssignee || visitAssignee.trim() === '' || visitAssignee.trim() === '外す') return false;

  const inquiryDate = seller.inquiryDate || seller.inquiry_date || '';
  const normalized = normalizeDateString(inquiryDate);
  if (!normalized || normalized < '2026-01-01') return false;

  return true;
};

/**
 * Pinrich要変更カチE��リー判宁E * 
 * 条件�E�E〜DのぁE��れかを満たす�E�E
 * - 条件A: visit_assignee = "外す" AND pinrich_status = "クローズ" AND status = "追客中"
 * - 条件B: confidence_level = "D" AND pinrich_status が除外リスト夁E * - 条件C: visit_date が空欁E��なぁEAND pinrich_status = "配信中" AND visit_assignee が空欁E��なぁEAND status が特定スチE�EタスのぁE��れか
 * - 条件D: status が特定スチE�EタスのぁE��れか AND pinrich_status = "クローズ" AND contract_year_month >= "2025-05-01"
 * 
 * @param seller 売主チE�Eタ
 * @returns Pinrich要変更対象かどぁE��
 * 
 * Requirements: 2.1, 2.2
 */
export const isPinrichChangeRequired = (seller: Seller | any): boolean => {
  const pinrichStatus = seller.pinrichStatus || seller.pinrich_status || '';
  const status = seller.status || '';
  const visitAssignee = seller.visitAssigneeInitials || seller.visit_assignee || seller.visitAssignee || '';
  const confidenceLevel = seller.confidenceLevel || seller.confidence_level || '';
  const visitDate = seller.visitDate || seller.visit_date || '';
  const contractYearMonth = seller.contractYearMonth || seller.contract_year_month || '';

  // 条件A: visit_assignee = "外す" AND pinrich_status = "クローズ" AND status = "追客中"
  const conditionA = visitAssignee === '外す'
    && pinrichStatus === 'クローズ'
    && status === '追客中';

  // 条件B: confidence_level = "D" AND pinrich_status が除外リスト夁E  const excludedPinrichB = new Set([
    'クローズ',
    '登録不要E,
    'アドレスエラー',
    '配信不要E��他決後、訪問後、担当付！E,
    '△配信停止',
  ]);
  const conditionB = confidenceLevel === 'D'
    && !excludedPinrichB.has(pinrichStatus);

  // 条件C: visit_date が空欁E��なぁEAND pinrich_status = "配信中" AND visit_assignee が空欁E��なぁEAND status が特定スチE�EタスのぁE��れか
  const validStatusC = new Set(['専任媒仁E, '追客中', '除外後追客中']);
  const hasVisitDate = visitDate !== null && visitDate !== undefined && String(visitDate).trim() !== '';
  const hasVisitAssigneeC = visitAssignee !== null && visitAssignee !== undefined && String(visitAssignee).trim() !== '';
  const conditionC = hasVisitDate
    && pinrichStatus === '配信中'
    && hasVisitAssigneeC
    && validStatusC.has(status);

  // 条件D: status が特定スチE�EタスのぁE��れか AND pinrich_status = "クローズ" AND contract_year_month >= "2025-05-01"
  const validStatusD = new Set(['他決→追客', '他決→追客不要E, '一般媒仁E]);
  const normalizedContractDate = contractYearMonth ? String(contractYearMonth).substring(0, 10) : '';
  const conditionD = validStatusD.has(status)
    && pinrichStatus === 'クローズ'
    && normalizedContractDate >= '2025-05-01';

  return conditionA || conditionB || conditionC || conditionD;
};

/**
 * 専任カチE��リー判宁E * 
 * 条件:
 * - exclusive_other_decision_meeting <> "完亁E
 * - next_call_date <> TODAY()
 * - status IN ("専任媒仁E, "他決→専任", "リースバック�E�専任�E�E)
 * 
 * @param seller 売主チE�Eタ
 * @returns 専任カチE��リー対象かどぁE��
 * 
 * Requirements: 1.2
 */
export const isExclusive = (seller: Seller | any): boolean => {
  // 専任他決打合せが「完亁E���E場合�E除夁E  const exclusiveOtherDecisionMeeting = seller.exclusiveOtherDecisionMeeting || seller.exclusive_other_decision_meeting || '';
  if (exclusiveOtherDecisionMeeting === '完亁E) {
    return false;
  }
  
  // 次電日が今日の場合�E除夁E  const nextCallDate = seller.nextCallDate || seller.next_call_date;
  const todayStr = getTodayJSTString();
  const normalizedNextCallDate = normalizeDateString(nextCallDate);
  if (!normalizedNextCallDate || normalizedNextCallDate === todayStr) {
    return false;
  }
  
  // 状況E��当社�E�が専任媒介関連かチェチE��
  const status = seller.status || '';
  return status === '専任媒仁E || status === '他決→専任' || status === 'リースバック�E�専任�E�E;
};

/**
 * 一般カチE��リー判宁E * 
 * 条件:
 * - exclusive_other_decision_meeting <> "完亁E
 * - next_call_date <> TODAY()
 * - status = "一般媒仁E
 * - contract_year_month >= "2025/6/23"
 * 
 * @param seller 売主チE�Eタ
 * @returns 一般カチE��リー対象かどぁE��
 * 
 * Requirements: 2.2
 */
export const isGeneral = (seller: Seller | any): boolean => {
  // 専任他決打合せが「完亁E���E場合�E除夁E  const exclusiveOtherDecisionMeeting = seller.exclusiveOtherDecisionMeeting || seller.exclusive_other_decision_meeting || '';
  if (exclusiveOtherDecisionMeeting === '完亁E) {
    return false;
  }
  
  // 次電日が今日の場合�E除夁E  const nextCallDate = seller.nextCallDate || seller.next_call_date;
  const todayStr = getTodayJSTString();
  const normalizedNextCallDate = normalizeDateString(nextCallDate);
  if (!normalizedNextCallDate || normalizedNextCallDate === todayStr) {
    return false;
  }
  
  // 状況E��当社�E�が一般媒介かチェチE��
  const status = seller.status || '';
  if (status !== '一般媒仁E) {
    return false;
  }
  
  // 契紁E��月が2025/6/23以降かチェチE��
  const contractYearMonth = seller.contractYearMonth || seller.contract_year_month;
  if (!contractYearMonth) {
    return false;
  }
  
  const cutoffDate = '2025-06-23';
  const normalizedContractDate = normalizeDateString(contractYearMonth);
  if (!normalizedContractDate) {
    return false;
  }
  
  return normalizedContractDate >= cutoffDate;
};

/**
 * 訪問後他決カチE��リー判宁E * 
 * 条件:
 * - exclusive_other_decision_meeting <> "完亁E
 * - next_call_date <> TODAY()
 * - status IN ("他決→追客", "他決→追客不要E, "一般→他決", "他社買叁E)
 * - visit_assignee <> "" �E�「外す」�E拁E��ありとして扱ぁE��E * 
 * @param seller 売主チE�Eタ
 * @returns 訪問後他決カチE��リー対象かどぁE��
 * 
 * Requirements: 3.2
 */
export const isVisitOtherDecision = (seller: Seller | any): boolean => {
  // 専任他決打合せが「完亁E���E場合�E除夁E  const exclusiveOtherDecisionMeeting = seller.exclusiveOtherDecisionMeeting || seller.exclusive_other_decision_meeting || '';
  if (exclusiveOtherDecisionMeeting === '完亁E) {
    return false;
  }
  
  // 次電日が今日の場合�E除夁E  const nextCallDate = seller.nextCallDate || seller.next_call_date;
  const todayStr = getTodayJSTString();
  const normalizedNextCallDate = normalizeDateString(nextCallDate);
  if (!normalizedNextCallDate || normalizedNextCallDate === todayStr) {
    return false;
  }
  
  // 状況E��当社�E�が他決関連かチェチE��
  const status = seller.status || '';
  const isOtherDecisionStatus = 
    status === '他決→追客' || 
    status === '他決→追客不要E || 
    status === '一般→他決' || 
    status === '他社買叁E;
  if (!isOtherDecisionStatus) {
    return false;
  }
  
  // 営拁E��入力があるかチェチE���E�「外す」�E拁E��ありとして扱ぁE��E  const visitAssignee = seller.visitAssigneeInitials || seller.visit_assignee || seller.visitAssignee || '';
  if (!visitAssignee || visitAssignee.trim() === '') {
    return false;
  }
  
  return true;
};

/**
 * 未訪問他決カチE��リー判宁E * 
 * 条件:
 * - exclusive_other_decision_meeting <> "完亁E
 * - next_call_date <> TODAY()
 * - status IN ("他決→追客", "他決→追客不要E, "一般→他決", "他社買叁E)
 * - visit_assignee = "" �E�営拁E��し！E * 
 * @param seller 売主チE�Eタ
 * @returns 未訪問他決カチE��リー対象かどぁE��
 */
export const isUnvisitedOtherDecision = (seller: Seller | any): boolean => {
  // 専任他決打合せが「完亁E���E場合�E除夁E  const exclusiveOtherDecisionMeeting = seller.exclusiveOtherDecisionMeeting || seller.exclusive_other_decision_meeting || '';
  if (exclusiveOtherDecisionMeeting === '完亁E) {
    return false;
  }
  
  // 次電日が今日以前�E場合�E除外！EAS・バックエンドと条件を統一�E�E  // バックエンチE .gt('next_call_date', todayJST) = 次電日 > 今日
  // GAS: nextCallDate !== todayStr = 次電日 ≠ 今日
  // フロントエンチE 次電日 > 今日�E�今日以前を除外！E  const nextCallDate = seller.nextCallDate || seller.next_call_date;
  const todayStr = getTodayJSTString();
  const normalizedNextCallDate = normalizeDateString(nextCallDate);
  
  // 次電日が空、また�E今日以前�E場合�E除夁E  if (!normalizedNextCallDate || normalizedNextCallDate <= todayStr) {
    return false;
  }
  
  // 状況E��当社�E�が他決関連かチェチE��
  const status = seller.status || '';
  const isOtherDecisionStatus = 
    status === '他決→追客' || 
    status === '他決→追客不要E || 
    status === '一般→他決' || 
    status === '他社買叁E;
  if (!isOtherDecisionStatus) {
    return false;
  }
  
  // 営拁E��空かチェチE��
  const visitAssignee = seller.visitAssigneeInitials || seller.visit_assignee || seller.visitAssignee || '';
  if (visitAssignee && visitAssignee.trim() !== '') {
    return false;
  }
  
  return true;
};

/**
 * 特定�E拁E��老E��イニシャル�E�に該当する売主を判宁E * 
 * @param seller 売主チE�Eタ
 * @param assignee 拁E��老E��ニシャル
 * @returns 持E��した担当老E��割り当てられてぁE��かどぁE��
 */
export const isVisitAssignedTo = (seller: Seller | any, assignee: string): boolean => {
  // 空斁E���E拁E��なしと同じ扱ぁE  if (!assignee || assignee.trim() === '') {
    return false;
  }
  
  // 「他社買取」を含む売主を除夁E  const status = seller.status || '';
  if (typeof status === 'string' && status.includes('他社買叁E)) {
    return false;
  }
  
  // visitAssigneeInitials�E��Eのイニシャル�E�を優先して比輁E  // visitAssigneeはフルネ�Eムに変換されてぁE��場合があるため
  // visitAssignee�E�EamelCase�E�も参�E�E�EPIレスポンスの形式に対応！E  const visitAssigneeInitials = seller.visitAssigneeInitials || seller.visit_assignee || seller.visitAssignee || '';
  return visitAssigneeInitials.trim() === assignee;
};

/**
 * 特定�E拁E��老E�E当日TEL対象かどぁE��を判宁E * 
 * 条件:
 * - 持E��した担当老E��イニシャル�E�に割り当てられてぁE��
 * - 次電日が今日以前！EsTodayCallAssigned の条件�E�E * 
 * @param seller 売主チE�Eタ
 * @param assignee 拁E��老E��ニシャル
 * @returns 持E��した担当老E�E当日TEL対象かどぁE��
 */
export const isTodayCallAssignedTo = (seller: Seller | any, assignee: string): boolean => {
  return isVisitAssignedTo(seller, assignee) && isTodayCallAssigned(seller);
};

/**
 * 売主リストからユニ�Eクな拁E��老E��ニシャルを取征E * 「外す」と空斁E��を除外し、E��褁E��排除してソートして返す
 * 
 * @param sellers 売主リスチE * @returns ユニ�Eクな拁E��老E��ニシャルの配�E�E�ソート済み�E�E */
export const getUniqueAssignees = (sellers: (Seller | any)[]): string[] => {
  // 「他社買取」を含む売主を除外してから拁E��老E��抽出
  const filteredSellers = sellers.filter(s => {
    const status = s.status || '';
    return !(typeof status === 'string' && status.includes('他社買叁E));
  });
  
  // visitAssigneeInitials�E��Eのイニシャル�E�を優先して使用
  // visitAssigneeはフルネ�Eムに変換されてぁE��場合があるため
  // visitAssignee�E�EamelCase�E�も参�E�E�EPIレスポンスの形式に対応！E  const assignees = filteredSellers
    .map(s => s.visitAssigneeInitials || s.visit_assignee || s.visitAssignee || '')
    .filter(a => a && a.trim() !== '');
  return [...new Set(assignees)].sort();
};

/**
 * カチE��リ別の売主数をカウンチE * 
 * @param sellers 売主リスチE * @returns 吁E��チE��リの件数
 * 
 * Requirements: 4.1, 4.2, 4.3, 1.3, 2.3, 3.3
 */
export const getCategoryCounts = (sellers: (Seller | any)[]): CategoryCounts => {
  return {
    all: sellers.length,
    todayCall: sellers.filter(isTodayCall).length,
    todayCallWithInfo: sellers.filter(isTodayCallWithInfo).length,
    todayCallAssigned: sellers.filter(isTodayCallAssigned).length,
    visitDayBefore: sellers.filter(isVisitDayBefore).length,
    visitCompleted: sellers.filter(isVisitCompleted).length,
    unvaluated: sellers.filter(isUnvaluated).length,
    mailingPending: sellers.filter(isMailingPending).length,
    todayCallNotStarted: sellers.filter(isTodayCallNotStarted).length,
    pinrichEmpty: sellers.filter(isPinrichEmpty).length,
    pinrichChangeRequired: sellers.filter(isPinrichChangeRequired).length,
    exclusive: sellers.filter(isExclusive).length,
    general: sellers.filter(isGeneral).length,
    visitOtherDecision: sellers.filter(isVisitOtherDecision).length,
    unvisitedOtherDecision: sellers.filter(isUnvisitedOtherDecision).length,
  };
};

/**
 * カチE��リ別にフィルタリング
 * 
 * @param sellers 売主リスチE * @param category 選択されたカチE��リ
 * @returns フィルタリングされた売主リスチE * 
 * Requirements: 1.3, 2.3, 3.3, 5.2, 5.1, 5.2, 5.3
 */
export const filterSellersByCategory = (
  sellers: (Seller | any)[],
  category: StatusCategory
): (Seller | any)[] => {
  // FI�E�福岡�E�売主かどぁE��を判定する�Eルパ�E
  const isFiSeller = (s: any): boolean =>
    ((s.sellerNumber || s.seller_number || '') as string).toUpperCase().startsWith('FI');

  // 動的カチE��リーの処琁E��Ewitch斁E��り前に処琁E��E  if (typeof category === 'string' && category.startsWith('visitAssigned:')) {
    const assignee = category.replace('visitAssigned:', '');
    return sellers.filter(s => isVisitAssignedTo(s, assignee));
  }
  if (typeof category === 'string' && category.startsWith('todayCallAssigned:')) {
    const assignee = category.replace('todayCallAssigned:', '');
    return sellers.filter(s => isTodayCallAssignedTo(s, assignee));
  }
  if (typeof category === 'string' && category.startsWith('todayCallWithInfo:')) {
    const targetLabel = category.replace('todayCallWithInfo:', '');
    // FI売主は一般の当日TEL�E��E容�E�に含めなぁE    return sellers.filter(s => !isFiSeller(s) && isTodayCallWithInfo(s) && getTodayCallWithInfoLabel(s) === targetLabel);
  }

  switch (category) {
    case 'todayCall':
      // FI売主は福岡専用カチE��リー�E�Ei:todayCall�E�に表示するため除夁E      return sellers.filter(s => !isFiSeller(s) && isTodayCall(s) && !isTodayCallNotStarted(s));
    case 'todayCallWithInfo':
      // FI売主は福岡専用カチE��リー�E�Ei:todayCallWithInfo�E�に表示するため除夁E      return sellers.filter(s => !isFiSeller(s) && isTodayCallWithInfo(s));
    case 'todayCallAssigned':
      return sellers.filter(isTodayCallAssigned);
    case 'visitDayBefore':
      return sellers.filter(isVisitDayBefore);
    case 'visitScheduled': // 後方互換性
      return sellers.filter(isVisitDayBefore);
    case 'visitCompleted':
      return sellers.filter(isVisitCompleted);
    case 'unvaluated':
      // FI売主は福岡専用カチE��リー�E�Ei:unvaluated�E�に表示するため除夁E      return sellers.filter(s => !isFiSeller(s) && isUnvaluated(s));
    case 'mailingPending':
      // FI売主は福岡専用カチE��リー�E�Ei:mailingPending�E�に表示するため除夁E      return sellers.filter(s => !isFiSeller(s) && isMailingPending(s));
    case 'todayCallNotStarted':
      // FI売主は福岡専用カチE��リー�E�Ei:todayCallNotStarted�E�に表示するため除夁E      return sellers.filter(s => !isFiSeller(s) && isTodayCallNotStarted(s));
    case 'pinrichEmpty':
      return sellers.filter(isPinrichEmpty);
    case 'pinrichChangeRequired':
      return sellers.filter(isPinrichChangeRequired);
    case 'exclusive':
      return sellers.filter(isExclusive);
    case 'general':
      return sellers.filter(isGeneral);
    case 'visitOtherDecision':
      return sellers.filter(isVisitOtherDecision);
    case 'unvisitedOtherDecision':
      return sellers.filter(isUnvisitedOtherDecision);
    case 'all':
    default:
      return sellers;
  }
};

/**
 * マッチングカチE��リー判宁E * 
 * 条件:
 * - match_updated_at ぁENULL でなぁE���EチE��ングボタンぁEON�E�E * 
 * @param seller 売主チE�Eタ
 * @returns マッチングカチE��リー対象かどぁE��
