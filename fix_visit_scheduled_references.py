#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
visitScheduled -> visitDayBefore への変更スクリプト
日本語ファイルをUTF-8で安全に編集する
"""

import os

def fix_file(filepath, replacements):
    """ファイルを読み込み、置換を適用してUTF-8で書き込む"""
    with open(filepath, 'rb') as f:
        content = f.read()
    
    text = content.decode('utf-8')
    original = text
    
    for old, new in replacements:
        text = text.replace(old, new)
    
    if text != original:
        with open(filepath, 'wb') as f:
            f.write(text.encode('utf-8'))
        print(f'✅ Updated: {filepath}')
    else:
        print(f'⚠️  No changes: {filepath}')

# ============================================================
# 1. SellersPage.tsx: visitScheduled -> visitDayBefore
# ============================================================
sellers_page = 'frontend/frontend/src/pages/SellersPage.tsx'
fix_file(sellers_page, [
    # 型定義
    ('    visitScheduled: number;\n', '    visitDayBefore: number;\n'),
    # 初期値（2箇所）
    ('    visitScheduled: 0,\n    visitCompleted: 0,\n    unvaluated: 0,\n    mailingPending: 0,\n    todayCallNotStarted: 0,\n    pinrichEmpty: 0,\n  });\n', 
     '    visitDayBefore: 0,\n    visitCompleted: 0,\n    unvaluated: 0,\n    mailingPending: 0,\n    todayCallNotStarted: 0,\n    pinrichEmpty: 0,\n  });\n'),
    # エラー時リセット
    ('        visitScheduled: 0,\n        visitCompleted: 0,\n        unvaluated: 0,\n        mailingPending: 0,\n        todayCallNotStarted: 0,\n        pinrichEmpty: 0,\n      });', 
     '        visitDayBefore: 0,\n        visitCompleted: 0,\n        unvaluated: 0,\n        mailingPending: 0,\n        todayCallNotStarted: 0,\n        pinrichEmpty: 0,\n      });'),
])

# ============================================================
# 2. CallModePage.tsx: statusCategory: 'visitScheduled' -> 'visitDayBefore'
# ============================================================
call_mode_page = 'frontend/frontend/src/pages/CallModePage.tsx'
fix_file(call_mode_page, [
    ("            statusCategory: 'visitScheduled', // 営担でフィルタリングするために使用",
     "            statusCategory: 'visitDayBefore', // 営担でフィルタリングするために使用"),
])

# ============================================================
# 3. SellerStatusSidebar.bugfix.test.tsx: visitScheduled -> visitDayBefore, テスト名更新
# ============================================================
sidebar_test = 'frontend/frontend/src/components/__tests__/SellerStatusSidebar.bugfix.test.tsx'
fix_file(sidebar_test, [
    # categoryCounts内のvisitScheduled -> visitDayBefore
    ('      visitScheduled: 0, // 訪問予定が1件', '      visitDayBefore: 0, // 訪問日前日が1件'),
    ('      visitScheduled: 1, // 訪問予定が1件', '      visitDayBefore: 1, // 訪問日前日が1件'),
    # 他のvisitScheduled: 0
    ('      visitScheduled: 0,\n      visitCompleted: 0,\n      unvaluated: 0,\n      mailingPending: 0,\n      todayCallNotStarted: 0,\n      pinrichEmpty: 0,',
     '      visitDayBefore: 0,\n      visitCompleted: 0,\n      unvaluated: 0,\n      mailingPending: 0,\n      todayCallNotStarted: 0,\n      pinrichEmpty: 0,'),
    # テスト名と表示テキスト
    ("test('訪問予定の売主が存在する場合、「①訪問予定」ボタンが表示される', () => {",
     "test('訪問日前日の売主が存在する場合、「①訪問日前日」ボタンが表示される', () => {"),
    ("    // 「①訪問予定」ボタンが存在することを確認",
     "    // 「①訪問日前日」ボタンが存在することを確認"),
    ("    const elements = screen.getAllByText('①訪問予定');",
     "    const elements = screen.getAllByText('①訪問日前日');"),
])

# ============================================================
# 4. callmode-navigation-preservation.test.ts: isVisitScheduled -> isVisitDayBefore, visitScheduled -> visitDayBefore
# ============================================================
nav_test = 'frontend/frontend/src/__tests__/callmode-navigation-preservation.test.ts'
fix_file(nav_test, [
    # インポート
    ('  isVisitScheduled,\n', '  isVisitDayBefore,\n'),
    # 変数名
    ('            const visitScheduledSeller = createTestSeller({',
     '            const visitDayBeforeSeller = createTestSeller({'),
    # 関数呼び出し
    ('            expect(isVisitScheduled(visitScheduledSeller)).toBe(true);',
     '            expect(isVisitDayBefore(visitDayBeforeSeller)).toBe(true);'),
    ('            expect(isVisitCompleted(visitScheduledSeller)).toBe(false);',
     '            expect(isVisitCompleted(visitDayBeforeSeller)).toBe(false);'),
    ('            const sellers = [visitScheduledSeller];',
     '            const sellers = [visitDayBeforeSeller];'),
    ("            const filtered = filterSellersByCategory(sellers, 'visitScheduled');",
     "            const filtered = filterSellersByCategory(sellers, 'visitDayBefore');"),
    ("            expect(isVisitScheduled(visitCompletedSeller)).toBe(false);",
     "            expect(isVisitDayBefore(visitCompletedSeller)).toBe(false);"),
    # getCategoryCounts の期待値
    ("            expect(counts.visitScheduled).toBe(\n              filterSellersByCategory(normalizedSellers, 'visitScheduled').length\n            );",
     "            expect(counts.visitDayBefore).toBe(\n              filterSellersByCategory(normalizedSellers, 'visitDayBefore').length\n            );"),
    # シナリオテスト
    ("    const visitScheduledFiltered = filterSellersByCategory(sellers, 'visitScheduled');",
     "    const visitDayBeforeFiltered = filterSellersByCategory(sellers, 'visitDayBefore');"),
    ('    expect(visitScheduledFiltered).toHaveLength(1);',
     '    expect(visitDayBeforeFiltered).toHaveLength(1);'),
    ("    expect(visitScheduledFiltered[0].sellerNumber).toBe('AA13503');",
     "    expect(visitDayBeforeFiltered[0].sellerNumber).toBe('AA13503');"),
])

print('\n✅ 全ファイルの更新完了')
