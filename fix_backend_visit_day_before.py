# バックエンドの visitScheduled を visitDayBefore に変更するスクリプト
# - SellerService.supabase.ts
# - backend/src/types/index.ts

# ===== types/index.ts =====
with open('backend/src/types/index.ts', 'rb') as f:
    content = f.read()
text = content.decode('utf-8')

text = text.replace(
    "'all' | 'todayCall' | 'todayCallWithInfo' | 'todayCallAssigned' | 'visitScheduled' | 'visitCompleted' | 'unvaluated' | 'mailingPending' | 'todayCallNotStarted' | 'pinrichEmpty'",
    "'all' | 'todayCall' | 'todayCallWithInfo' | 'todayCallAssigned' | 'visitDayBefore' | 'visitScheduled' | 'visitCompleted' | 'unvaluated' | 'mailingPending' | 'todayCallNotStarted' | 'pinrichEmpty'"
)

with open('backend/src/types/index.ts', 'wb') as f:
    f.write(text.encode('utf-8'))
print('types/index.ts を更新しました')

# ===== SellerService.supabase.ts =====
with open('backend/src/services/SellerService.supabase.ts', 'rb') as f:
    content2 = f.read()
text2 = content2.decode('utf-8')

# 1. switch文の visitScheduled ケースを visitDayBefore に変更（後方互換で visitScheduled も残す）
old_switch = """        case 'visitScheduled':
          // 訪問予定（営担に入力あり AND 訪問日が今日以降）
          query = query
            .not('visit_assignee', 'is', null)
            .neq('visit_assignee', '')
            .gte('visit_date', todayJST);
          break;"""

new_switch = """        case 'visitDayBefore':
        case 'visitScheduled': // 後方互換性
          // 訪問日前日（営担に入力あり AND 今日が訪問日の前営業日）
          // 木曜訪問は2日前（水曜定休）、それ以外は1日前
          {
            const todayDate = new Date(todayJST);
            const dayOfWeek = todayDate.getDay(); // 0=日,1=月,2=火,3=水,4=木,5=金,6=土
            // 今日の曜日から「訪問日前日」に該当する訪問日を計算
            // 今日が火曜（2）→ 木曜訪問（+2日）または水曜訪問（+1日）の両方が対象
            // 今日が火曜の場合: 翌日（水曜）訪問 OR 翌々日（木曜）訪問
            // 今日が他の曜日: 翌日訪問のみ
            const visitDates: string[] = [];
            // 通常: 翌日訪問
            const tomorrow = new Date(todayDate);
            tomorrow.setDate(tomorrow.getDate() + 1);
            const tomorrowStr = tomorrow.toISOString().split('T')[0];
            visitDates.push(tomorrowStr);
            // 火曜（2）の場合: 木曜訪問（+2日）も対象（水曜定休のため）
            if (dayOfWeek === 2) {
              const dayAfterTomorrow = new Date(todayDate);
              dayAfterTomorrow.setDate(dayAfterTomorrow.getDate() + 2);
              const dayAfterTomorrowStr = dayAfterTomorrow.toISOString().split('T')[0];
              visitDates.push(dayAfterTomorrowStr);
            }
            query = query
              .not('visit_assignee', 'is', null)
              .neq('visit_assignee', '')
              .neq('visit_assignee', '外す')
              .in('visit_date', visitDates);
          }
          break;"""

text2 = text2.replace(old_switch, new_switch)

# 2. カウント処理: visitScheduledCount → visitDayBeforeCount に変更
old_count = """    // 1. 訪問予定（営担に入力あり AND 訪問日が今日以降）← 最優先
    const { count: visitScheduledCount } = await this.table('sellers')
      .select('*', { count: 'exact', head: true })
      .is('deleted_at', null)
      .not('visit_assignee', 'is', null)
      .neq('visit_assignee', '')
      .neq('visit_assignee', '外す')
      .gte('visit_date', todayJST);"""

new_count = """    // 1. 訪問日前日（営担に入力あり AND 今日が訪問日の前営業日）
    // 木曜訪問は2日前（火曜）、それ以外は1日前
    const todayDateForVisit = new Date(todayJST);
    const visitDayOfWeek = todayDateForVisit.getDay(); // 0=日,1=月,2=火,3=水,4=木,5=金,6=土
    const visitDayBeforeDates: string[] = [];
    // 通常: 翌日訪問
    const tomorrowForVisit = new Date(todayDateForVisit);
    tomorrowForVisit.setDate(tomorrowForVisit.getDate() + 1);
    visitDayBeforeDates.push(tomorrowForVisit.toISOString().split('T')[0]);
    // 火曜（2）の場合: 木曜訪問（+2日）も対象（水曜定休のため）
    if (visitDayOfWeek === 2) {
      const dayAfterTomorrowForVisit = new Date(todayDateForVisit);
      dayAfterTomorrowForVisit.setDate(dayAfterTomorrowForVisit.getDate() + 2);
      visitDayBeforeDates.push(dayAfterTomorrowForVisit.toISOString().split('T')[0]);
    }
    const { count: visitDayBeforeCount } = await this.table('sellers')
      .select('*', { count: 'exact', head: true })
      .is('deleted_at', null)
      .not('visit_assignee', 'is', null)
      .neq('visit_assignee', '')
      .neq('visit_assignee', '外す')
      .in('visit_date', visitDayBeforeDates);"""

text2 = text2.replace(old_count, new_count)

# 3. レスポンスの visitScheduled → visitDayBefore に変更（型定義も）
old_type1 = "    visitScheduled: number;"
new_type1 = "    visitDayBefore: number;"
# 2箇所あるので両方置換
text2 = text2.replace(old_type1, new_type1)

# 4. sidebarResult の visitScheduled → visitDayBefore
old_result = "      visitScheduled: visitScheduledCount || 0,"
new_result = "      visitDayBefore: visitDayBeforeCount || 0,"
text2 = text2.replace(old_result, new_result)

with open('backend/src/services/SellerService.supabase.ts', 'wb') as f:
    f.write(text2.encode('utf-8'))
print('SellerService.supabase.ts を更新しました')
print('完了！')
