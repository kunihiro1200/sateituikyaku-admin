"""
CallModePage.tsx のサイドバーデータ取得を非同期化するスクリプト（行番号ベース）

修正内容:
1. fetchSidebarSellers と fetchSidebarCounts を並列取得（Promise.all）
2. サイドバーuseEffect を非ブロッキング化（メインコンテンツ表示後にバックグラウンドで取得）
"""

with open('frontend/frontend/src/pages/CallModePage.tsx', 'rb') as f:
    content = f.read()

text = content.decode('utf-8')
lines = text.split('\n')

print(f'総行数: {len(lines)}')

# 修正対象の行範囲を特定
# fetchSidebarSellers の開始行（0-indexed: 960）
# useEffect の終了行（0-indexed: 1028）

# 修正前の行（0-indexed: 961-1029）を確認
start_line = 960  # 0-indexed（行961）
end_line = 1029   # 0-indexed（行1030、exclusive）

print('=== 修正前の対象行 ===')
for i in range(start_line, end_line):
    print(f'{i+1}: {lines[i]}')

# 修正後の内容（インデントはスペース2つ）
new_lines = [
    '  const fetchSidebarSellers = useCallback(async () => {',
    "    console.log('=== サイドバー売主リスト取得開始（バックグラウンド） ===');",
    "    console.log('現在時刻:', new Date().toISOString());",
    '    ',
    '    // 認証トークンを確認',
    "    const sessionToken = localStorage.getItem('session_token');",
    "    const refreshToken = localStorage.getItem('refresh_token');",
    '    ',
    '    if (!sessionToken && !refreshToken) {',
    "      console.warn('⚠️ 認証トークンが存在しません。ログインが必要です。');",
    '      setSidebarLoading(false);',
    '      return;',
    '    }',
    '    ',
    '    // 現在の売主の営担を取得',
    '    if (!seller || !seller.visitAssignee) {',
    "      console.log('⚠️ 現在の売主の営担が設定されていません。サイドバーを表示しません。');",
    '      setSidebarSellers([]);',
    '      setSidebarLoading(false);',
    '      return;',
    '    }',
    '    ',
    '    const currentVisitAssignee = seller.visitAssignee;',
    '    console.log(`📋 営担「${currentVisitAssignee}」の売主のみを取得します`);',
    '    ',
    '    try {',
    '      // fetchSidebarSellers（pageSize=500）と fetchSidebarCounts を並列取得',
    '      // メインコンテンツ（売主詳細）はすでに表示済みのため、ここはバックグラウンドで実行',
    "      console.log('📡 サイドバー売主リストとカウントを並列取得中...');",
    '      ',
    '      const [response] = await Promise.all([',
    "        api.get('/api/sellers', {",
    '          params: {',
    '            page: 1,',
    '            pageSize: 500, // バックエンドの最大値は500',
    "            sortBy: 'next_call_date',",
    "            sortOrder: 'asc',",
    "            statusCategory: 'visitScheduled', // 営担でフィルタリングするために使用",
    '            visitAssignee: currentVisitAssignee,',
    '          },',
    '        }),',
    '        // サイドバーカウントを並列で取得',
    '        fetchSidebarCounts(),',
    '      ]);',
    '      ',
    '      const allSellers = response.data?.data || [];',
    "      console.log('=== サイドバー売主リスト取得完了 ===');",
    '      console.log(`営担「${currentVisitAssignee}」の売主件数:`, allSellers.length);',
    '      ',
    '      setSidebarSellers(allSellers);',
    '    } catch (error: any) {',
    "      console.error('❌ サイドバー売主リスト取得エラー:', error);",
    '      setSidebarSellers([]);',
    '    } finally {',
    '      setSidebarLoading(false);',
    '    }',
    '  }, [fetchSidebarCounts]);',
    '',
    '  // サイドバー用の売主リストを取得（sellerが読み込まれた後にバックグラウンドで実行）',
    '  // メインコンテンツ（売主詳細）はすでに表示済みのため、サイドバーデータは非ブロッキングで取得',
    '  useEffect(() => {',
    "    console.log('=== サイドバーuseEffect実行 ===');",
    "    console.log('seller:', seller ? seller.sellerNumber : 'null');",
    '    if (seller) {',
    "      console.log('→ fetchSidebarSellers をバックグラウンドで呼び出します');",
    '      // 非ブロッキング: await しないことでメインコンテンツの表示をブロックしない',
    '      // サイドバーデータ取得中は sidebarLoading=true でローディングインジケーターを表示',
    '      setSidebarLoading(true);',
    '      fetchSidebarSellers();',
    '    } else {',
    "      console.log('→ sellerがnullのため、fetchSidebarSellersをスキップ');",
    '    }',
    '  }, [seller, fetchSidebarSellers]);',
]

# 行を置換
new_text_lines = lines[:start_line] + new_lines + lines[end_line:]
new_text = '\n'.join(new_text_lines)

print(f'\n修正後の総行数: {len(new_text_lines)}')

# UTF-8で書き込む（BOMなし）
with open('frontend/frontend/src/pages/CallModePage.tsx', 'wb') as f:
    f.write(new_text.encode('utf-8'))

print('✅ ファイルを保存しました')
