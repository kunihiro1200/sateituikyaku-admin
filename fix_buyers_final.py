with open('frontend/frontend/src/pages/BuyersPage.tsx', 'rb') as f:
    content = f.read()
text = content.decode('utf-8')

# 問題: sidebarLoadedがuseEffectの依存配列に入っているため、
# BuyerStatusSidebarがonBuyersLoadedを呼ぶたびにfetchBuyersが再実行される
# 解決: sidebarLoadedをrefで管理して、依存配列から外す

# 1. sidebarLoadedをstateからrefに変更
old_state = """  // サイドバーから取得した全買主データ（フロントキャッシュ）
  // 初期値：pageDataCacheにキャッシュがあれば即座にロード済みとして扱う
  const cachedData = pageDataCache.get<{ categories: any[]; buyers: BuyerWithStatus[]; normalStaffInitials: string[] }>(CACHE_KEYS.BUYERS_WITH_STATUS);
  const allBuyersWithStatusRef = useRef<BuyerWithStatus[]>(cachedData?.buyers ?? []);
  const [sidebarLoaded, setSidebarLoaded] = useState(!!cachedData);"""

new_state = """  // サイドバーから取得した全買主データ（フロントキャッシュ）
  // 初期値：pageDataCacheにキャッシュがあれば即座にロード済みとして扱う
  const cachedData = pageDataCache.get<{ categories: any[]; buyers: BuyerWithStatus[]; normalStaffInitials: string[] }>(CACHE_KEYS.BUYERS_WITH_STATUS);
  const allBuyersWithStatusRef = useRef<BuyerWithStatus[]>(cachedData?.buyers ?? []);
  // sidebarLoadedをrefで管理（stateにするとonBuyersLoaded呼び出しのたびにfetchBuyersが再実行される）
  const sidebarLoadedRef = useRef<boolean>(!!cachedData);
  // テーブル再描画用のトリガー（サイドバーデータ取得完了時のみ更新）
  const [dataReady, setDataReady] = useState(!!cachedData);"""

text = text.replace(old_state, new_state)

# 2. fetchBuyers内のsidebarLoaded参照をsidebarLoadedRef.currentに変更
old_check = """        console.log('[BuyersPage] fetchBuyers: sidebarLoaded=', sidebarLoaded, 'buyers=', allBuyersWithStatusRef.current.length);
        if (sidebarLoaded && allBuyersWithStatusRef.current.length > 0) {"""

# デバッグログがない場合の通常パターン
old_check2 = """        if (sidebarLoaded && allBuyersWithStatusRef.current.length > 0) {"""

new_check = """        if (sidebarLoadedRef.current && allBuyersWithStatusRef.current.length > 0) {"""

if old_check in text:
    text = text.replace(old_check, new_check)
    print('replaced with debug log version')
elif old_check2 in text:
    text = text.replace(old_check2, new_check)
    print('replaced normal version')
else:
    print('ERROR: could not find sidebarLoaded check')

# 3. useEffectの依存配列からsidebarLoadedを削除し、dataReadyに変更
old_deps = """  }, [page, rowsPerPage, debouncedSearch, selectedCalculatedStatus, refetchTrigger, sidebarLoaded]);"""
new_deps = """  }, [page, rowsPerPage, debouncedSearch, selectedCalculatedStatus, refetchTrigger, dataReady]);"""

text = text.replace(old_deps, new_deps)

# 4. handleBuyersLoadedでsidebarLoadedRef + setDataReadyを使う
old_handler = """  const handleBuyersLoaded = (buyers: BuyerWithStatus[]) => {
    allBuyersWithStatusRef.current = buyers;
    setSidebarLoaded(true);
  };"""

new_handler = """  const handleBuyersLoaded = (buyers: BuyerWithStatus[]) => {
    allBuyersWithStatusRef.current = buyers;
    if (!sidebarLoadedRef.current) {
      // 初回ロード時のみdataReadyをtrueにしてfetchBuyersをトリガー
      sidebarLoadedRef.current = true;
      setDataReady(true);
    }
    // 既にロード済みの場合はrefのみ更新（再レンダリング不要）
  };"""

text = text.replace(old_handler, new_handler)

# 5. handleSync内のsidebarLoaded関連をrefに変更
old_sync = """      // サイドバーキャッシュをリセット
      allBuyersWithStatusRef.current = [];
      setSidebarLoaded(false);
      setRefetchTrigger(prev => prev + 1);"""

new_sync = """      // サイドバーキャッシュをリセット
      allBuyersWithStatusRef.current = [];
      sidebarLoadedRef.current = false;
      setDataReady(false);
      setRefetchTrigger(prev => prev + 1);"""

text = text.replace(old_sync, new_sync)

# 6. APIフォールバック時のsetLoading(true)の前にsidebarLoadedRef確認
# （既にAPIコール時のみsetLoading(true)になっているはず）

with open('frontend/frontend/src/pages/BuyersPage.tsx', 'wb') as f:
    f.write(text.encode('utf-8'))

print('Done!')
print('変更内容:')
print('1. sidebarLoadedをstateからrefに変更（不要な再レンダリングを防止）')
print('2. dataReadyというstateを追加（初回ロード完了時のみトリガー）')
print('3. handleBuyersLoadedで初回のみsetDataReady(true)を呼ぶ')
print('4. useEffectの依存配列をdataReadyに変更')
