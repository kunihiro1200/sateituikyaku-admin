
# PropertySidebarStatus.tsx の statusCounts に suumo_required / reins_suumo_required の動的判定を追加

with open('frontend/frontend/src/components/PropertySidebarStatus.tsx', 'rb') as f:
    text = f.read().decode('utf-8')

old = """      // 「本日公開予定」も常にcalculatePropertyStatusで判定（公開予定日が動的に変わるため）
      if (workTaskMap && computed.key === 'today_publish') {
        counts['本日公開予定'] = (counts['本日公開予定'] || 0) + 1;
        return;
      }

      // sidebar_status === '専任・公開中' の分解処理"""

new = """      // 「本日公開予定」も常にcalculatePropertyStatusで判定（公開予定日が動的に変わるため）
      if (workTaskMap && computed.key === 'today_publish') {
        counts['本日公開予定'] = (counts['本日公開予定'] || 0) + 1;
        return;
      }

      // 「SUUMO URL 要登録」「レインズ登録＋SUUMO URL 要登録」も動的判定
      // DBのsidebar_statusに依存せず、atbb_status/suumo_url/suumo_registered/公開予定日から計算
      if (computed.key === 'suumo_required') {
        counts['SUUMO URL\u3000要登録'] = (counts['SUUMO URL\u3000要登録'] || 0) + 1;
        return;
      }
      if (computed.key === 'reins_suumo_required') {
        counts['レインズ登録＋SUUMO URL 要登録'] = (counts['レインズ登録＋SUUMO URL 要登録'] || 0) + 1;
        return;
      }

      // sidebar_status === '専任・公開中' の分解処理"""

count = text.count(old)
print(f'PropertySidebarStatus.tsx: 置換対象の出現回数: {count}')
text = text.replace(old, new)

with open('frontend/frontend/src/components/PropertySidebarStatus.tsx', 'wb') as f:
    f.write(text.encode('utf-8'))
print('PropertySidebarStatus.tsx: Done')

# PropertyListingsPage.tsx のフィルタリングも動的判定に変更
with open('frontend/frontend/src/pages/PropertyListingsPage.tsx', 'rb') as f:
    text2 = f.read().decode('utf-8')

old2 = """      } else if (sidebarStatus === '本日公開予定') {
        // 「本日公開予定」はDBのsidebar_statusに保存されないため、calculatePropertyStatusで判定
        listings = listings.filter(l => calculatePropertyStatus(l as any, workTaskMap).key === 'today_publish');
      } else if (['Y専任公開中',"""

new2 = """      } else if (sidebarStatus === '本日公開予定') {
        // 「本日公開予定」はDBのsidebar_statusに保存されないため、calculatePropertyStatusで判定
        listings = listings.filter(l => calculatePropertyStatus(l as any, workTaskMap).key === 'today_publish');
      } else if (sidebarStatus === 'SUUMO URL\u3000要登録') {
        // 「SUUMO URL 要登録」は動的判定（DBのsidebar_statusに依存しない）
        listings = listings.filter(l => calculatePropertyStatus(l as any, workTaskMap).key === 'suumo_required');
      } else if (sidebarStatus === 'レインズ登録＋SUUMO URL 要登録') {
        // 「レインズ登録＋SUUMO URL 要登録」は動的判定（DBのsidebar_statusに依存しない）
        listings = listings.filter(l => calculatePropertyStatus(l as any, workTaskMap).key === 'reins_suumo_required');
      } else if (['Y専任公開中',"""

count2 = text2.count(old2)
print(f'PropertyListingsPage.tsx: 置換対象の出現回数: {count2}')
text2 = text2.replace(old2, new2)

with open('frontend/frontend/src/pages/PropertyListingsPage.tsx', 'wb') as f:
    f.write(text2.encode('utf-8'))
print('PropertyListingsPage.tsx: Done')
