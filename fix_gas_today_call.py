# fix_gas_today_call.py
# gas_buyer_complete_code.js の当日TELカウントバグを修正する

with open('gas_buyer_complete_code.js', 'rb') as f:
    content = f.read()

text = content.decode('utf-8')

# 修正1: assignee取得順序を修正（initial_assignee優先 → follow_up_assignee優先）
old_assignee = "      var assignee = buyer.initial_assignee || buyer.follow_up_assignee || '';"
new_assignee = "      var assignee = buyer.follow_up_assignee || buyer.initial_assignee || '';"

if old_assignee in text:
    text = text.replace(old_assignee, new_assignee)
    print('✅ assignee取得順序を修正')
else:
    print('⚠️  assignee取得順序の修正対象が見つからない（既に修正済みか確認が必要）')

# 修正2: 当日TEL判定ロジックを修正
old_today_call = """      // 本日架電
      if (nextCallDate === todayStr) {
        counts.todayCall++;
        if (assignee) {
          counts.todayCallAssigned[assignee] = (counts.todayCallAssigned[assignee] || 0) + 1;
        }
      }"""

new_today_call = """      // 本日架電（次電日が今日以前かつ追客担当なし）
      // バックエンドの calculateBuyerStatus() と条件を一致させる
      if (nextCallDate && nextCallDate <= todayStr) {
        if (!buyer.follow_up_assignee) {
          // 担当なし → 当日TEL
          counts.todayCall++;
        } else {
          // 担当あり → 当日TEL(担当) として todayCallAssigned にカウント
          counts.todayCallAssigned[buyer.follow_up_assignee] = (counts.todayCallAssigned[buyer.follow_up_assignee] || 0) + 1;
        }
      }"""

if old_today_call in text:
    text = text.replace(old_today_call, new_today_call)
    print('✅ 当日TEL判定ロジックを修正')
else:
    print('⚠️  当日TEL判定ロジックの修正対象が見つからない')
    # 実際のコードを確認するため周辺を表示
    idx = text.find('// 本日架電')
    if idx >= 0:
        print('現在の「本日架電」周辺コード:')
        print(repr(text[idx:idx+300]))

with open('gas_buyer_complete_code.js', 'wb') as f:
    f.write(text.encode('utf-8'))

print('完了')
