#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
seller_sidebar_counts テーブルから1クエリで読むように getSidebarCounts() を変更する。
既存の重いDBクエリ群は getSidebarCountsFallback() に移動する。
"""

import re

FILE_PATH = 'backend/src/services/SellerService.supabase.ts'

with open(FILE_PATH, 'rb') as f:
    content = f.read()

text = content.decode('utf-8')

# 置き換え対象: getSidebarCounts メソッド全体（行1793〜2079）
# 開始マーカー（CRLF対応）
START_MARKER = '  /**\r\n   * サイドバー用のカテゴリカウントを取得\r\n   * 各カテゴリの条件に合う売主のみをデータベースから直接カウント'
# 終了マーカー（メソッドの最後の行）
END_MARKER = '    return sidebarResult;\r\n  }\r\n}'

if START_MARKER not in text:
    print('ERROR: 開始マーカーが見つかりませんでした')
    print('最初の200文字:', repr(text[:200]))
    exit(1)

if END_MARKER not in text:
    print('ERROR: 終了マーカーが見つかりませんでした')
    exit(1)

# 開始位置と終了位置を特定
start_idx = text.index(START_MARKER)
end_idx = text.index(END_MARKER) + len(END_MARKER)

# 置き換え後のコード
NEW_CODE = '''  /**
   * サイドバー用のカテゴリカウントを取得
   * seller_sidebar_counts テーブルから1クエリで高速取得。
   * テーブルが空または取得失敗の場合は重いDBクエリにフォールバック。
   */
  async getSidebarCounts(): Promise<{
    todayCall: number;
    todayCallWithInfo: number;
    todayCallAssigned: number;
    visitDayBefore: number;
    visitCompleted: number;
    unvaluated: number;
    mailingPending: number;
    todayCallNotStarted: number;
    pinrichEmpty: number;
    visitAssignedCounts: Record<string, number>;
    todayCallAssignedCounts: Record<string, number>;
    todayCallWithInfoLabels: string[];
    todayCallWithInfoLabelCounts: Record<string, number>;
  }> {
    try {
      // seller_sidebar_counts テーブルから1クエリで取得（超高速）
      const { data: rows, error } = await this.supabase
        .from('seller_sidebar_counts')
        .select('category, count, label, assignee')
        .order('category');

      if (error) throw error;
      if (!rows || rows.length === 0) {
        console.log('⚠️ seller_sidebar_counts is empty, falling back to DB queries');
        return this.getSidebarCountsFallback();
      }

      // テーブルのデータを集計
      let todayCall = 0;
      let todayCallWithInfo = 0;
      let todayCallAssigned = 0;
      let visitDayBefore = 0;
      let visitCompleted = 0;
      let unvaluated = 0;
      let mailingPending = 0;
      let todayCallNotStarted = 0;
      let pinrichEmpty = 0;
      const visitAssignedCounts: Record<string, number> = {};
      const todayCallAssignedCounts: Record<string, number> = {};
      const todayCallWithInfoLabelCounts: Record<string, number> = {};

      for (const row of rows) {
        const cnt = Number(row.count) || 0;
        switch (row.category) {
          case 'todayCall': todayCall = cnt; break;
          case 'todayCallWithInfo':
            todayCallWithInfo += cnt;
            if (row.label) todayCallWithInfoLabelCounts[row.label] = (todayCallWithInfoLabelCounts[row.label] || 0) + cnt;
            break;
          case 'todayCallAssigned':
            todayCallAssigned += cnt;
            if (row.assignee) todayCallAssignedCounts[row.assignee] = (todayCallAssignedCounts[row.assignee] || 0) + cnt;
            break;
          case 'visitDayBefore': visitDayBefore = cnt; break;
          case 'visitCompleted':
            visitCompleted += cnt;
            if (row.assignee) visitAssignedCounts[row.assignee] = (visitAssignedCounts[row.assignee] || 0) + cnt;
            break;
          case 'visitAssigned':
            if (row.assignee) visitAssignedCounts[row.assignee] = (visitAssignedCounts[row.assignee] || 0) + cnt;
            break;
          case 'unvaluated': unvaluated = cnt; break;
          case 'mailingPending': mailingPending = cnt; break;
          case 'todayCallNotStarted': todayCallNotStarted = cnt; break;
          case 'pinrichEmpty': pinrichEmpty = cnt; break;
        }
      }

      const todayCallWithInfoLabels = Object.keys(todayCallWithInfoLabelCounts);

      console.log('✅ seller_sidebar_counts から高速取得成功');
      return {
        todayCall,
        todayCallWithInfo,
        todayCallAssigned,
        visitDayBefore,
        visitCompleted,
        unvaluated,
        mailingPending,
        todayCallNotStarted,
        pinrichEmpty,
        visitAssignedCounts,
        todayCallAssignedCounts,
        todayCallWithInfoLabels,
        todayCallWithInfoLabelCounts,
      };
    } catch (err) {
      console.error('❌ seller_sidebar_counts 取得失敗、フォールバック実行:', err);
      return this.getSidebarCountsFallback();
    }
  }

  /**
   * サイドバーカウントのフォールバック（重いDBクエリ版）
   * seller_sidebar_counts テーブルが空または取得失敗時に使用
   */
  private async getSidebarCountsFallback(): Promise<{
    todayCall: number;
    todayCallWithInfo: number;
    todayCallAssigned: number;
    visitDayBefore: number;
    visitCompleted: number;
    unvaluated: number;
    mailingPending: number;
    todayCallNotStarted: number;
    pinrichEmpty: number;
    visitAssignedCounts: Record<string, number>;
    todayCallAssignedCounts: Record<string, number>;
    todayCallWithInfoLabels: string[];
    todayCallWithInfoLabelCounts: Record<string, number>;
  }> {
    // キャッシュキー（日付を含めることで日付変更時に自動無効化）
    const now = new Date();
    const jstTime = new Date(now.getTime() + (9 * 60 * 60 * 1000));
    const todayJST = `${jstTime.getUTCFullYear()}-${String(jstTime.getUTCMonth() + 1).padStart(2, '0')}-${String(jstTime.getUTCDate()).padStart(2, '0')}`;
    const sidebarCacheKey = `sellers:sidebar-counts:${todayJST}`;

    // キャッシュをチェック（60秒TTL）
    const cachedCounts = await CacheHelper.get<{
      todayCall: number;
      todayCallWithInfo: number;
      todayCallAssigned: number;
      visitDayBefore: number;
      visitCompleted: number;
      unvaluated: number;
      mailingPending: number;
      todayCallNotStarted: number;
      pinrichEmpty: number;
      visitAssignedCounts: Record<string, number>;
      todayCallAssignedCounts: Record<string, number>;
      todayCallWithInfoLabels: string[];
      todayCallWithInfoLabelCounts: Record<string, number>;
    }>(sidebarCacheKey);
    if (cachedCounts) {
      console.log('✅ Cache hit for sidebar counts (fallback)');
      return cachedCounts;
    }

    // 未査定の基準日
    const cutoffDate = '2025-12-08';

    // ヘルパー関数: 営担が有効かどうかを判定（「外す」は担当なしと同じ扱い）
    const hasValidVisitAssignee = (visitAssignee: string | null | undefined): boolean => {
      if (!visitAssignee || visitAssignee.trim() === '' || visitAssignee.trim() === '外す') {
        return false;
      }
      return true;
    };

    // 1. 訪問日前日（営担に入力あり AND 訪問日あり）← 前営業日ロジックをJSで計算
    const { data: visitAssigneeSellers } = await this.table('sellers')
      .select('visit_date, visit_assignee, visit_reminder_assignee')
      .is('deleted_at', null)
      .not('visit_assignee', 'is', null)
      .neq('visit_assignee', '')
      .neq('visit_assignee', '外す')
      .not('visit_date', 'is', null);

    const visitDayBeforeCount = (visitAssigneeSellers || []).filter(s => {
      const visitDateStr = s.visit_date;
      if (!visitDateStr) return false;
      const reminderAssignee = (s as any).visit_reminder_assignee || '';
      if (reminderAssignee.trim() !== '') return false;
      const parts = visitDateStr.split('-');
      if (parts.length !== 3) return false;
      const visitDate = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
      const visitDayOfWeek = visitDate.getDay();
      const daysBeforeVisit = visitDayOfWeek === 4 ? 2 : 1;
      const expectedNotifyDate = new Date(visitDate);
      expectedNotifyDate.setDate(visitDate.getDate() - daysBeforeVisit);
      const expectedNotifyStr = `${expectedNotifyDate.getFullYear()}-${String(expectedNotifyDate.getMonth() + 1).padStart(2, '0')}-${String(expectedNotifyDate.getDate()).padStart(2, '0')}`;
      return expectedNotifyStr === todayJST;
    }).length;

    // 2. 訪問済み
    const { count: visitCompletedCount } = await this.table('sellers')
      .select('*', { count: 'exact', head: true })
      .is('deleted_at', null)
      .not('visit_assignee', 'is', null)
      .neq('visit_assignee', '')
      .neq('visit_assignee', '外す')
      .lt('visit_date', todayJST);

    // 3. 当日TEL（担当）
    const { data: todayCallAssignedSellers } = await this.table('sellers')
      .select('id, visit_assignee')
      .is('deleted_at', null)
      .not('visit_assignee', 'is', null)
      .neq('visit_assignee', '')
      .neq('visit_assignee', '外す')
      .lte('next_call_date', todayJST)
      .not('status', 'ilike', '%追客不要%');

    const todayCallAssignedCount = (todayCallAssignedSellers || []).length;

    const { data: allAssignedSellers } = await this.table('sellers')
      .select('visit_assignee')
      .is('deleted_at', null)
      .not('visit_assignee', 'is', null)
      .neq('visit_assignee', '')
      .neq('visit_assignee', '外す');

    const visitAssignedCounts: Record<string, number> = {};
    (allAssignedSellers || []).forEach((s: any) => {
      const a = s.visit_assignee;
      if (a) visitAssignedCounts[a] = (visitAssignedCounts[a] || 0) + 1;
    });

    const todayCallAssignedCounts: Record<string, number> = {};
    (todayCallAssignedSellers || []).forEach((s: any) => {
      const a = s.visit_assignee;
      if (a) todayCallAssignedCounts[a] = (todayCallAssignedCounts[a] || 0) + 1;
    });

    // 4. 当日TEL分/当日TEL（内容）
    const [todayCallBaseResult1, todayCallBaseResult2] = await Promise.all([
      this.table('sellers')
        .select('id, visit_assignee, phone_contact_person, preferred_contact_time, contact_method, unreachable_status, inquiry_date, pinrich_status, confidence_level, exclusion_date, status')
        .is('deleted_at', null)
        .ilike('status', '%追客中%')
        .not('next_call_date', 'is', null)
        .lte('next_call_date', todayJST),
      this.table('sellers')
        .select('id, visit_assignee, phone_contact_person, preferred_contact_time, contact_method, unreachable_status, inquiry_date, pinrich_status, confidence_level, exclusion_date, status')
        .is('deleted_at', null)
        .eq('status', '他決→追客')
        .not('next_call_date', 'is', null)
        .lte('next_call_date', todayJST),
    ]);
    const allTodayCallBase = [...(todayCallBaseResult1.data || []), ...(todayCallBaseResult2.data || [])];
    const seenIds = new Set<string>();
    const todayCallBaseSellers = allTodayCallBase.filter(s => {
      if (seenIds.has(s.id)) return false;
      seenIds.add(s.id);
      return true;
    });

    const filteredTodayCallSellers = (todayCallBaseSellers || []).filter(s => {
      return !hasValidVisitAssignee(s.visit_assignee);
    });

    const todayCallWithInfoSellers = filteredTodayCallSellers.filter(s => {
      const hasInfo = (s.phone_contact_person && s.phone_contact_person.trim() !== '') ||
                      (s.preferred_contact_time && s.preferred_contact_time.trim() !== '') ||
                      (s.contact_method && s.contact_method.trim() !== '');
      return hasInfo;
    });
    const todayCallWithInfoCount = todayCallWithInfoSellers.length;

    const labelCountMap: Record<string, number> = {};
    todayCallWithInfoSellers.forEach(s => {
      const content = s.contact_method?.trim() || s.preferred_contact_time?.trim() || s.phone_contact_person?.trim() || '';
      const label = `当日TEL(${content})`;
      labelCountMap[label] = (labelCountMap[label] || 0) + 1;
    });
    const todayCallWithInfoLabels = Object.keys(labelCountMap);

    const todayCallNoInfoCount = filteredTodayCallSellers.filter(s => {
      const hasInfo = (s.phone_contact_person && s.phone_contact_person.trim() !== '') ||
                      (s.preferred_contact_time && s.preferred_contact_time.trim() !== '') ||
                      (s.contact_method && s.contact_method.trim() !== '');
      return !hasInfo;
    }).length;

    // 5. 未査定
    const { data: unvaluatedSellers } = await this.table('sellers')
      .select('id, valuation_amount_1, valuation_amount_2, valuation_amount_3, visit_assignee, mailing_status')
      .is('deleted_at', null)
      .ilike('status', '%追客中%')
      .gte('inquiry_date', cutoffDate)
      .or('visit_assignee.is.null,visit_assignee.eq.,visit_assignee.eq.外す');

    const unvaluatedCount = (unvaluatedSellers || []).filter(s => {
      const hasNoValuation = !s.valuation_amount_1 && !s.valuation_amount_2 && !s.valuation_amount_3;
      const isNotRequired = s.mailing_status === '不要';
      return hasNoValuation && !isNotRequired;
    }).length;

    // 6. 査定（郵送）
    const { count: mailingPendingCount } = await this.table('sellers')
      .select('*', { count: 'exact', head: true })
      .is('deleted_at', null)
      .eq('mailing_status', '未');

    // 7. 当日TEL_未着手
    const todayCallNotStartedCount = filteredTodayCallSellers.filter(s => {
      const hasInfo = (s.phone_contact_person && s.phone_contact_person.trim() !== '') ||
                      (s.preferred_contact_time && s.preferred_contact_time.trim() !== '') ||
                      (s.contact_method && s.contact_method.trim() !== '');
      if (hasInfo) return false;
      const status = (s as any).status || '';
      if (status !== '追客中') return false;
      const unreachable = (s as any).unreachable_status || '';
      if (unreachable && unreachable.trim() !== '') return false;
      const confidence = (s as any).confidence_level || '';
      if (confidence === 'ダブり' || confidence === 'D' || confidence === 'AI査定') return false;
      const exclusionDate = (s as any).exclusion_date || '';
      if (exclusionDate && exclusionDate.trim() !== '') return false;
      const inquiryDate = (s as any).inquiry_date || '';
      return inquiryDate >= '2026-01-01';
    }).length;

    // 8. Pinrich空欄
    const pinrichEmptyCount = filteredTodayCallSellers.filter(s => {
      const hasInfo = (s.phone_contact_person && s.phone_contact_person.trim() !== '') ||
                      (s.preferred_contact_time && s.preferred_contact_time.trim() !== '') ||
                      (s.contact_method && s.contact_method.trim() !== '');
      if (hasInfo) return false;
      const pinrich = (s as any).pinrich_status || '';
      return !pinrich || pinrich.trim() === '';
    }).length;

    const sidebarResult = {
      todayCall: todayCallNoInfoCount || 0,
      todayCallWithInfo: todayCallWithInfoCount || 0,
      todayCallAssigned: todayCallAssignedCount || 0,
      visitDayBefore: visitDayBeforeCount || 0,
      visitCompleted: visitCompletedCount || 0,
      unvaluated: unvaluatedCount || 0,
      mailingPending: mailingPendingCount || 0,
      todayCallNotStarted: todayCallNotStartedCount || 0,
      pinrichEmpty: pinrichEmptyCount || 0,
      visitAssignedCounts,
      todayCallAssignedCounts,
      todayCallWithInfoLabels,
      todayCallWithInfoLabelCounts: labelCountMap,
    };

    // キャッシュに保存（60秒TTL）
    await CacheHelper.set(sidebarCacheKey, sidebarResult, CACHE_TTL.SIDEBAR_COUNTS);

    return sidebarResult;
  }
}
'''

# 置き換え実行（CRLFに変換）
new_code_crlf = NEW_CODE.replace('\n', '\r\n')
new_text = text[:start_idx] + new_code_crlf

with open(FILE_PATH, 'wb') as f:
    f.write(new_text.encode('utf-8'))

print('✅ 置き換え完了')
print(f'  変更前の長さ: {len(text)} 文字')
print(f'  変更後の長さ: {len(new_text)} 文字')
