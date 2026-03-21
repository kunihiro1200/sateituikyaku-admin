# 訪問予定カテゴリを「訪問日前日」に変更するスクリプト
# - 水曜定休のため、木曜訪問は2日前（火曜）に通知
# - それ以外は1日前に通知
# - sellerStatusFilters.ts と SellerStatusSidebar.tsx を修正

import re

# ===== sellerStatusFilters.ts の修正 =====
with open('frontend/frontend/src/utils/sellerStatusFilters.ts', 'rb') as f:
    content = f.read()

text = content.decode('utf-8')

# 1. StatusCategory型から visitScheduled を visitDayBefore に変更
text = text.replace(
    "// visitScheduled: 訪問予定（営担に入力あり、訪問日が今日以降）",
    "// visitDayBefore: 訪問日前日（訪問日が明日、または木曜訪問の場合は明後日）"
)
text = text.replace(
    "export type StatusCategory = 'all' | 'todayCall' | 'todayCallWithInfo' | 'todayCallAssigned' | 'visitScheduled' | 'visitCompleted' | 'unvaluated' | 'mailingPending' | 'todayCallNotStarted' | 'pinrichEmpty'",
    "export type StatusCategory = 'all' | 'todayCall' | 'todayCallWithInfo' | 'todayCallAssigned' | 'visitDayBefore' | 'visitCompleted' | 'unvaluated' | 'mailingPending' | 'todayCallNotStarted' | 'pinrichEmpty'"
)

# 2. CategoryCounts インターフェースの visitScheduled を visitDayBefore に変更
text = text.replace(
    "  visitScheduled: number;      // 訪問予定（営担に入力あり、訪問日が今日以降）",
    "  visitDayBefore: number;      // 訪問日前日（訪問日が翌営業日）"
)

# 3. isVisitScheduled 関数を isVisitDayBefore に置き換え
old_func = '''/**
 * 訪問予定判定（営担に入力あり、訪問日が今日以降）
 * 
 * 【サイドバー表示】「訪問予定（イニシャル）」
 * 
 * 条件:
 * - 営担（visitAssignee）に入力がある
 * - 訪問日（visitDate）が今日以降
 * 
 * @param seller 売主データ
 * @returns 訪問予定対象かどうか
 */
export const isVisitScheduled = (seller: Seller | any): boolean => {
  if (!hasVisitAssignee(seller)) {
    return false;
  }
  
  const visitDate = seller.visitDate || seller.visit_date;
  if (!visitDate) {
    return false;
  }
  
  return isTodayOrAfter(visitDate);
};'''

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

text = text.replace(old_func, new_func)

# 4. getCategoryCounts の visitScheduled を visitDayBefore に変更
text = text.replace(
    "    visitScheduled: sellers.filter(isVisitScheduled).length,",
    "    visitDayBefore: sellers.filter(isVisitDayBefore).length,"
)

# 5. filterSellersByCategory の visitScheduled を visitDayBefore に変更
text = text.replace(
    "    case 'visitScheduled':\n      return sellers.filter(isVisitScheduled);",
    "    case 'visitDayBefore':\n      return sellers.filter(isVisitDayBefore);\n    case 'visitScheduled': // 後方互換性\n      return sellers.filter(isVisitDayBefore);"
)

with open('frontend/frontend/src/utils/sellerStatusFilters.ts', 'wb') as f:
    f.write(text.encode('utf-8'))

print('sellerStatusFilters.ts を更新しました')

# ===== SellerStatusSidebar.tsx の修正 =====
with open('frontend/frontend/src/components/SellerStatusSidebar.tsx', 'rb') as f:
    content2 = f.read()

text2 = content2.decode('utf-8')

# 1. import に isVisitDayBefore を追加（isVisitScheduled を置き換え）
text2 = text2.replace(
    "  isVisitScheduled,\n  isVisitCompleted,",
    "  isVisitDayBefore,\n  isVisitScheduled,\n  isVisitCompleted,"
)

# 2. filterSellersByCategory 内の visitScheduled を visitDayBefore に変更
text2 = text2.replace(
    "    case 'visitScheduled':\n      return sellers.filter(isVisitScheduled);",
    "    case 'visitDayBefore':\n      return sellers.filter(isVisitDayBefore);\n    case 'visitScheduled': // 後方互換性\n      return sellers.filter(isVisitDayBefore);"
)

# 3. renderAllCategories 内の visitScheduled ボタンを visitDayBefore に変更
text2 = text2.replace(
    "      {renderCategoryButton('visitScheduled', '①訪問予定', '#2e7d32')}",
    "      {renderCategoryButton('visitDayBefore', '①訪問日前日', '#2e7d32')}"
)

with open('frontend/frontend/src/components/SellerStatusSidebar.tsx', 'wb') as f:
    f.write(text2.encode('utf-8'))

print('SellerStatusSidebar.tsx を更新しました')
print('完了！')
