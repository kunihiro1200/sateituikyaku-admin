# fix_callmode_performance.py
# 通話モードページの遅延を改善
# 1. 毎回のキャッシュクリアを削除（キャッシュを活用する）
# 2. 重いconsole.log（JSON.stringify）を削除

with open('frontend/frontend/src/pages/CallModePage.tsx', 'rb') as f:
    content = f.read()

text = content.decode('utf-8')

# CRLF -> LF
text = text.replace('\r\n', '\n')

# 1. キャッシュクリア処理を削除
old_cache_clear = '''      // キャッシュをクリアして最新データを取得
      try {
        await api.delete(`/cache/seller/${id}`);
        console.log('✅ キャッシュをクリアしました');
      } catch (cacheError) {
        console.log('⚠️ キャッシュクリアに失敗（続行）:', cacheError);
      }
      
      // 並列で全データを取得（AI要約以外）'''

new_cache_clear = '''      // 並列で全データを取得（AI要約以外）'''

text = text.replace(old_cache_clear, new_cache_clear)

# 2. 重いconsole.log（JSON.stringify）を削除
old_log = '''      console.log('=== APIレスポンス ===');
      console.log('sellerResponse.data:', JSON.stringify(sellerResponse.data, null, 2));
      console.log('activitiesResponse:', activitiesResponse.data);
      console.log('employeesResponse:', employeesResponse.data);'''

new_log = ''

text = text.replace(old_log, new_log)

# LF -> CRLF
text = text.replace('\n', '\r\n')

with open('frontend/frontend/src/pages/CallModePage.tsx', 'wb') as f:
    f.write(text.encode('utf-8'))

print('Done! パフォーマンス改善を適用しました')
