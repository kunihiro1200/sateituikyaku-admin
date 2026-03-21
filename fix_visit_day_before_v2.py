# sellerStatusFilters.ts の isVisitDayBefore を
# sellerStatusUtils.ts の既存実装を使うように整理する

with open('frontend/frontend/src/utils/sellerStatusFilters.ts', 'rb') as f:
    content = f.read()

text = content.decode('utf-8')

# 1. sellerStatusUtils から isVisitDayBefore と parseDate をインポート追加
old_import = "import { Seller } from '../types';"
new_import = "import { Seller } from '../types';\nimport { isVisitDayBefore as isVisitDayBeforeUtil, parseDate } from './sellerStatusUtils';"
text = text.replace(old_import, new_import)

# 2. sellerStatusFilters.ts 内の重複した isVisitDayBefore 実装を削除し、
#    ラッパー関数に置き換える
old_func = '''/**
 * 訪問日前日判定
 * 
 * 【サイドバー表示】「訪問日前日」
 * 
 * 条件:
 * - 営担（visitAssignee）に入力がある
 * - 今日が訪問日の「前営業日」である
 *   - 通常: 訪問日の1日前
 *   - 木曜訪問の場合: 2日前（水曜が定休日のため火曜に通知）
 * 
 * @param seller 売主データ
 * @returns 訪問日前日対象かどうか
 */
export const isVisitDayBefore = (seller: Seller | any): boolean => {
  if (!hasVisitAssignee(seller)) {
    return false;
  }
  
  const visitDate = seller.visitDate || seller.visit_date;
  if (!visitDate) {
    return false;
  }
  
  const normalizedVisit = normalizeDateString(visitDate);
  if (!normalizedVisit) return false;
  
  const todayStr = getTodayJSTString();
  const todayParts = todayStr.split('-');
  const todayDate = new Date(
    parseInt(todayParts[0]),
    parseInt(todayParts[1]) - 1,
    parseInt(todayParts[2])
  );
  
  const visitParts = normalizedVisit.split('-');
  const visitDateObj = new Date(
    parseInt(visitParts[0]),
    parseInt(visitParts[1]) - 1,
    parseInt(visitParts[2])
  );
  
  // 訪問日の曜日を取得（0=日, 1=月, 2=火, 3=水, 4=木, 5=金, 6=土）
  const visitDayOfWeek = visitDateObj.getDay();
  
  // 木曜訪問（4）の場合は2日前（火曜）、それ以外は1日前
  const daysBeforeVisit = visitDayOfWeek === 4 ? 2 : 1;
  
  // 今日が「訪問日 - daysBeforeVisit日」かどうかを判定
  const expectedNotifyDate = new Date(visitDateObj);
  expectedNotifyDate.setDate(expectedNotifyDate.getDate() - daysBeforeVisit);
  
  const expectedStr = `${expectedNotifyDate.getFullYear()}-${String(expectedNotifyDate.getMonth() + 1).padStart(2, '0')}-${String(expectedNotifyDate.getDate()).padStart(2, '0')}`;
  
  return todayStr === expectedStr;
};

// 後方互換性のためのエイリアス（旧 isVisitScheduled）
export const isVisitScheduled = isVisitDayBefore;'''

new_func = '''/**
 * 訪問日前日判定
 * 
 * 【サイドバー表示】「訪問日前日」
 * 
 * 条件:
 * - 営担（visitAssignee）に入力がある
 * - 今日が訪問日の「前営業日」である
 *   - 通常: 訪問日の1日前
 *   - 木曜訪問の場合: 2日前（水曜が定休日のため火曜に通知）
 * 
 * @param seller 売主データ
 * @returns 訪問日前日対象かどうか
 */
export const isVisitDayBefore = (seller: Seller | any): boolean => {
  if (!hasVisitAssignee(seller)) {
    return false;
  }
  
  const visitDate = seller.visitDate || seller.visit_date;
  if (!visitDate) {
    return false;
  }
  
  // sellerStatusUtils の実装を使用（水曜定休・木曜2日前ロジック）
  const todayStr = getTodayJSTString();
  const todayParts = todayStr.split('-');
  const todayDate = new Date(
    parseInt(todayParts[0]),
    parseInt(todayParts[1]) - 1,
    parseInt(todayParts[2])
  );
  todayDate.setHours(0, 0, 0, 0);
  
  return isVisitDayBeforeUtil(String(visitDate), todayDate);
};

// 後方互換性のためのエイリアス（旧 isVisitScheduled）
export const isVisitScheduled = isVisitDayBefore;'''

text = text.replace(old_func, new_func)

with open('frontend/frontend/src/utils/sellerStatusFilters.ts', 'wb') as f:
    f.write(text.encode('utf-8'))

print('sellerStatusFilters.ts を整理しました')
