with open('frontend/frontend/src/pages/BuyersPage.tsx', 'rb') as f:
    content = f.read()
text = content.decode('utf-8')

# キャッシュ初期化部分にデバッグログを追加
old = """  // サイドバーから取得した全買主データ（フロントキャッシュ）
  // 初期値：pageDataCacheにキャッシュがあれば即座にロード済みとして扱う
  const cachedData = pageDataCache.get<{ categories: any[]; buyers: BuyerWithStatus[]; normalStaffInitials: string[] }>(CACHE_KEYS.BUYERS_WITH_STATUS);
  const allBuyersWithStatusRef = useRef<BuyerWithStatus[]>(cachedData?.buyers ?? []);
  const [sidebarLoaded, setSidebarLoaded] = useState(!!cachedData);"""

new = """  // サイドバーから取得した全買主データ（フロントキャッシュ）
  // 初期値：pageDataCacheにキャッシュがあれば即座にロード済みとして扱う
  const cachedData = pageDataCache.get<{ categories: any[]; buyers: BuyerWithStatus[]; normalStaffInitials: string[] }>(CACHE_KEYS.BUYERS_WITH_STATUS);
  console.log('[BuyersPage] mount: cachedData=', !!cachedData, 'buyers=', cachedData?.buyers?.length ?? 0);
  const allBuyersWithStatusRef = useRef<BuyerWithStatus[]>(cachedData?.buyers ?? []);
  const [sidebarLoaded, setSidebarLoaded] = useState(!!cachedData);"""

text = text.replace(old, new)

# fetchBuyers内にもログ追加
old2 = """        // サイドバーデータ読み込み済みの場合はフロント側でフィルタリング（APIコール不要）
        // キャッシュヒット時はsetLoading(true)をスキップして画面のちらつきを防ぐ
        if (sidebarLoaded && allBuyersWithStatusRef.current.length > 0) {"""

new2 = """        // サイドバーデータ読み込み済みの場合はフロント側でフィルタリング（APIコール不要）
        // キャッシュヒット時はsetLoading(true)をスキップして画面のちらつきを防ぐ
        console.log('[BuyersPage] fetchBuyers: sidebarLoaded=', sidebarLoaded, 'buyers=', allBuyersWithStatusRef.current.length);
        if (sidebarLoaded && allBuyersWithStatusRef.current.length > 0) {"""

text = text.replace(old2, new2)

with open('frontend/frontend/src/pages/BuyersPage.tsx', 'wb') as f:
    f.write(text.encode('utf-8'))

print('Done! デバッグログを追加しました')
