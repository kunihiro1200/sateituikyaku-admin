import re

with open('frontend/frontend/src/components/BuyerStatusSidebar.tsx', 'rb') as f:
    content = f.read()

text = content.decode('utf-8')

# loading の初期値を true から、キャッシュの有無で決定するように変更
# また、categories と normalStaffInitials もキャッシュから初期化する

old = """export default function BuyerStatusSidebar({
  selectedStatus,
  onStatusSelect,
  totalCount: totalCountProp,
  onBuyersLoaded,
}: BuyerStatusSidebarProps) {
  const [categories, setCategories] = useState<StatusCategory[]>([]);
  const [normalStaffInitials, setNormalStaffInitials] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [internalTotalCount, setInternalTotalCount] = useState(0);

  useEffect(() => {
    fetchStatusCategories();
  }, []);"""

new = """export default function BuyerStatusSidebar({
  selectedStatus,
  onStatusSelect,
  totalCount: totalCountProp,
  onBuyersLoaded,
}: BuyerStatusSidebarProps) {
  // キャッシュがあれば初期値として使用（再マウント時のちらつきを防ぐ）
  const _initialCache = pageDataCache.get<{
    categories: StatusCategory[];
    buyers: BuyerWithStatus[];
    normalStaffInitials: string[];
  }>(CACHE_KEYS.BUYERS_WITH_STATUS);

  const [categories, setCategories] = useState<StatusCategory[]>(
    _initialCache ? _initialCache.categories.filter((cat: StatusCategory) => cat.count > 0) : []
  );
  const [normalStaffInitials, setNormalStaffInitials] = useState<string[]>(
    _initialCache ? (_initialCache.normalStaffInitials || []) : []
  );
  const [loading, setLoading] = useState(!_initialCache);
  const [internalTotalCount, setInternalTotalCount] = useState(
    _initialCache ? _initialCache.categories.reduce((sum: number, cat: StatusCategory) => sum + cat.count, 0) : 0
  );

  useEffect(() => {
    // キャッシュがある場合は onBuyersLoaded を即座に呼ぶ（useEffect内で同期的に）
    if (_initialCache) {
      if (onBuyersLoaded) {
        onBuyersLoaded(_initialCache.buyers);
      }
      return;
    }
    fetchStatusCategories();
  }, []);"""

if old in text:
    text = text.replace(old, new)
    print('置換成功')
else:
    print('置換失敗 - テキストが見つかりません')
    # デバッグ用に前後を確認
    idx = text.find('const [loading, setLoading] = useState(true);')
    if idx >= 0:
        print(f'loading行発見: {idx}')
        print(repr(text[idx-200:idx+100]))

with open('frontend/frontend/src/components/BuyerStatusSidebar.tsx', 'wb') as f:
    f.write(text.encode('utf-8'))

print('完了')
