#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
買主リスト プログレッシブローディング実装

方針:
- BuyerStatusSidebar: 自分でAPIを呼ばず、外から categories/normalStaffInitials を受け取る
- BuyersPage: 
  1. キャッシュあり → 即座に表示（変更なし）
  2. キャッシュなし → /api/buyers?limit=50 で50件を即座に表示
     同時にバックグラウンドで /api/buyers/status-categories-with-buyers を取得
     完了後にキャッシュ保存 & サイドバー更新
"""

# ===== BuyerStatusSidebar.tsx の書き換え =====
sidebar_new = '''import { useState } from 'react';
import {
  Box,
  Typography,
  ListItemButton,
  ListItemText,
  Badge,
  CircularProgress,
} from '@mui/material';

interface StatusCategory {
  status: string;
  count: number;
  priority: number;
  color: string;
}

export interface BuyerWithStatus {
  buyer_number: string;
  name: string;
  phone_number: string;
  email: string;
  property_number: string;
  latest_status: string;
  initial_assignee: string;
  follow_up_assignee: string;
  inquiry_confidence: string;
  reception_date: string;
  next_call_date: string;
  calculated_status: string;
  status_priority: number;
  [key: string]: any;
}

interface BuyerStatusSidebarProps {
  selectedStatus: string | null;
  onStatusSelect: (status: string | null) => void;
  totalCount?: number;
  // 外から渡されるカテゴリデータ（BuyersPage が管理）
  categories?: StatusCategory[];
  normalStaffInitials?: string[];
  loading?: boolean;
}

// 担当カテゴリかどうか判定（「担当(X)」「当日TEL(X)」形式）
function isAssigneeCategory(status: string): boolean {
  return /^担当\\((.+)\\)$/.test(status) || /^当日TEL\\((.+)\\)$/.test(status);
}

// 担当カテゴリからイニシャルを抽出
function extractInitial(status: string): string {
  const m = status.match(/^(?:担当|当日TEL)\\((.+)\\)$/);
  return m ? m[1] : \'\';
}

export default function BuyerStatusSidebar({
  selectedStatus,
  onStatusSelect,
  totalCount = 0,
  categories = [],
  normalStaffInitials = [],
  loading = false,
}: BuyerStatusSidebarProps) {

  const handleStatusClick = (status: string) => {
    if (selectedStatus === status) {
      onStatusSelect(null);
    } else {
      onStatusSelect(status);
    }
  };

  if (loading) {
    return (
      <Box sx={{ p: 2, display: \'flex\', justifyContent: \'center\', alignItems: \'center\', height: 200 }}>
        <CircularProgress size={24} />
      </Box>
    );
  }

  // 担当カテゴリと通常カテゴリを分離
  const filteredCategories = categories.filter((cat: StatusCategory) => cat.count > 0);
  const normalCategories = filteredCategories.filter(cat => !isAssigneeCategory(cat.status) && cat.status !== \'\');
  const assigneeCategories = filteredCategories.filter(cat => {
    if (!isAssigneeCategory(cat.status)) return false;
    if (normalStaffInitials.length === 0) return true;
    const initial = extractInitial(cat.status);
    return normalStaffInitials.includes(initial);
  });

  const renderCategoryItem = (category: StatusCategory) => {
    const isTodayCallSub = /^当日TEL\\((.+)\\)$/.test(category.status);
    return (
      <ListItemButton
        key={category.status}
        selected={selectedStatus === category.status}
        onClick={() => handleStatusClick(category.status)}
        sx={{
          py: 1,
          pl: isTodayCallSub ? 4 : 2,
          \'&.Mui-selected\': {
            backgroundColor: `${category.color}15`,
          },
          \'&:hover\': {
            backgroundColor: `${category.color}10`,
          }
        }}
      >
        <ListItemText
          primary={isTodayCallSub ? `↳ ${category.status}` : (category.status || \'（未分類）\')}
          primaryTypographyProps={{ variant: \'body2\', color: isTodayCallSub ? \'text.secondary\' : \'text.primary\' }}
          sx={{ flex: 1, minWidth: 0, mr: 1 }}
        />
        <Badge
          badgeContent={category.count}
          sx={{
            ml: 1,
            \'& .MuiBadge-badge\': {
              backgroundColor: category.color,
              color: \'#fff\'
            }
          }}
          max={9999}
        />
      </ListItemButton>
    );
  };

  return (
    <Box>
      <Box sx={{ p: 2, borderBottom: \'1px solid #eee\' }}>
        <Typography variant="subtitle1" fontWeight="bold">ステータス</Typography>
      </Box>

      <Box>
        {/* All カテゴリ */}
        <ListItemButton
          selected={!selectedStatus}
          onClick={() => onStatusSelect(null)}
          sx={{ py: 1 }}
        >
          <ListItemText
            primary="All"
            primaryTypographyProps={{ variant: \'body2\', fontWeight: \'bold\' }}
            sx={{ flex: 1, minWidth: 0 }}
          />
          <Badge
            badgeContent={totalCount}
            color="success"
            max={9999}
            sx={{ ml: 1 }}
          />
        </ListItemButton>

        {/* 通常ステータスカテゴリ */}
        {normalCategories.map(renderCategoryItem)}

        {/* 担当カテゴリ（後尾・薄いグレー背景） */}
        {assigneeCategories.length > 0 && (
          <Box sx={{ backgroundColor: \'#f5f5f5\', mt: 1, borderTop: \'1px solid #e0e0e0\' }}>
            <Typography
              variant="caption"
              sx={{ px: 2, pt: 1, pb: 0.5, display: \'block\', color: \'text.secondary\', fontWeight: \'bold\' }}
            >
              担当別
            </Typography>
            {assigneeCategories.map(renderCategoryItem)}
          </Box>
        )}
      </Box>
    </Box>
  );
}
'''

with open('frontend/frontend/src/components/BuyerStatusSidebar.tsx', 'wb') as f:
    f.write(sidebar_new.encode('utf-8'))
print("✅ BuyerStatusSidebar.tsx を書き換えました")

# ===== BuyersPage.tsx の書き換え =====
with open('frontend/frontend/src/pages/BuyersPage.tsx', 'rb') as f:
    page_text = f.read().decode('utf-8')

# 1. import 行を修正（BuyerWithStatus のみ import、onBuyersLoaded は不要）
old_import = "import BuyerStatusSidebar, { BuyerWithStatus } from '../components/BuyerStatusSidebar';"
new_import = "import BuyerStatusSidebar, { BuyerWithStatus } from '../components/BuyerStatusSidebar';"
# import は変更不要

# 2. state 定義部分を修正
# cachedData, allBuyersWithStatusRef, sidebarLoadedRef, dataReady, onBuyersLoadedRef を整理
old_state = """  // サイドバーから取得した全買主データ（フロントキャッシュ）
  // 初期値：pageDataCacheにキャッシュがあれば即座にロード済みとして扱う
  const cachedData = pageDataCache.get<{ categories: any[]; buyers: BuyerWithStatus[]; normalStaffInitials: string[] }>(CACHE_KEYS.BUYERS_WITH_STATUS);
  const allBuyersWithStatusRef = useRef<BuyerWithStatus[]>(cachedData?.buyers ?? []);
  // sidebarLoadedをrefで管理（stateにするとonBuyersLoaded呼び出しのたびにfetchBuyersが再実行される）
  const sidebarLoadedRef = useRef<boolean>(!!cachedData);
  // バックグラウンド取得完了時にhandleBuyersLoadedを呼ぶためのref
  const onBuyersLoadedRef = useRef<((buyers: BuyerWithStatus[]) => void) | null>(null);
  // テーブル再描画用のトリガー（サイドバーデータ取得完了時のみ更新）
  const [dataReady, setDataReady] = useState(!!cachedData);"""

new_state = """  // キャッシュから初期データを取得
  const cachedData = pageDataCache.get<{ categories: any[]; buyers: BuyerWithStatus[]; normalStaffInitials: string[] }>(CACHE_KEYS.BUYERS_WITH_STATUS);
  // 全買主データ（フロントキャッシュ）
  const allBuyersWithStatusRef = useRef<BuyerWithStatus[]>(cachedData?.buyers ?? []);
  // サイドバーデータ読み込み済みフラグ
  const sidebarLoadedRef = useRef<boolean>(!!cachedData);
  // テーブル再描画用のトリガー
  const [dataReady, setDataReady] = useState(!!cachedData);
  // サイドバー表示用カテゴリ（BuyersPage が管理して prop で渡す）
  const [sidebarCategories, setSidebarCategories] = useState<any[]>(cachedData?.categories ?? []);
  const [sidebarNormalStaffInitials, setSidebarNormalStaffInitials] = useState<string[]>(cachedData?.normalStaffInitials ?? []);
  const [sidebarLoading, setSidebarLoading] = useState(!cachedData);"""

if old_state in page_text:
    page_text = page_text.replace(old_state, new_state)
    print("✅ state 定義を修正しました")
else:
    print("❌ state 定義が見つかりません")
    # デバッグ
    idx = page_text.find("サイドバーから取得した全買主データ")
    if idx >= 0:
        print(f"周辺: {page_text[idx:idx+300]}")

# 3. fetchBuyers のフォールバック部分を修正
old_fallback = """        // サイドバー未ロード時: まず最初の50件を即座に表示（プログレッシブローディング）
        setLoading(true);
        const quickParams: any = {
          page: 1,
          limit: 50,
          sortBy: 'reception_date',
          sortOrder: 'desc',
        };
        if (debouncedSearch) quickParams.search = normalizeSearch(debouncedSearch);

        // 最初の50件を即座に表示
        const quickRes = await api.get('/api/buyers', { params: quickParams });
        if (!cancelled) {
          setBuyers(quickRes.data.data || []);
          setTotal(quickRes.data.total || 0);
          setLoading(false);
        }

        // バックグラウンドで全件取得（キャッシュ保存＆サイドバー更新）
        if (!sidebarLoadedRef.current) {
          api.get('/api/buyers/status-categories-with-buyers').then((res) => {
            if (cancelled) return;
            const result = res.data as {
              categories: any[];
              buyers: BuyerWithStatus[];
              normalStaffInitials: string[];
            };
            // 5分間キャッシュ
            pageDataCache.set(CACHE_KEYS.BUYERS_WITH_STATUS, result, 5 * 60 * 1000);
            // サイドバーを更新（handleBuyersLoaded経由）
            if (onBuyersLoadedRef.current) {
              onBuyersLoadedRef.current(result.buyers);
            }
          }).catch((err) => {
            console.error('Background fetch failed:', err);
          });
        }"""

new_fallback = """        // サイドバー未ロード時: まず最初の50件を即座に表示（プログレッシブローディング）
        setLoading(true);
        const quickParams: any = {
          page: 1,
          limit: 50,
          sortBy: 'reception_date',
          sortOrder: 'desc',
        };
        if (debouncedSearch) quickParams.search = normalizeSearch(debouncedSearch);

        // 最初の50件を即座に表示
        const quickRes = await api.get('/api/buyers', { params: quickParams });
        if (!cancelled) {
          setBuyers(quickRes.data.data || []);
          setTotal(quickRes.data.total || 0);
          setLoading(false);
        }

        // バックグラウンドで全件取得（キャッシュ保存＆サイドバー更新）
        if (!sidebarLoadedRef.current) {
          api.get('/api/buyers/status-categories-with-buyers').then((res) => {
            if (cancelled) return;
            const result = res.data as {
              categories: any[];
              buyers: BuyerWithStatus[];
              normalStaffInitials: string[];
            };
            // 5分間キャッシュ
            pageDataCache.set(CACHE_KEYS.BUYERS_WITH_STATUS, result, 5 * 60 * 1000);
            // サイドバーのカテゴリを更新
            setSidebarCategories(result.categories);
            setSidebarNormalStaffInitials(result.normalStaffInitials || []);
            setSidebarLoading(false);
            // テーブルも全件データで更新
            allBuyersWithStatusRef.current = result.buyers;
            sidebarLoadedRef.current = true;
            setDataReady(prev => !prev); // トリガー更新
          }).catch((err) => {
            console.error('Background fetch failed:', err);
            setSidebarLoading(false);
          });
        }"""

if old_fallback in page_text:
    page_text = page_text.replace(old_fallback, new_fallback)
    print("✅ fetchBuyers フォールバック部分を修正しました")
else:
    print("❌ fetchBuyers フォールバックが見つかりません")

# 4. handleBuyersLoaded と onBuyersLoadedRef の更新コードを削除（不要になった）
old_handle = """  const handleBuyersLoaded = (buyers: BuyerWithStatus[]) => {
    allBuyersWithStatusRef.current = buyers;
    if (!sidebarLoadedRef.current) {
      // 初回ロード時のみdataReadyをtrueにしてfetchBuyersをトリガー
      sidebarLoadedRef.current = true;
      setDataReady(true);
    }
    // 既にロード済みの場合はrefのみ更新（再レンダリング不要）
  };

  // handleBuyersLoaded を ref に保持（バックグラウンド取得完了時に呼ぶため）
  onBuyersLoadedRef.current = handleBuyersLoaded;"""

new_handle = """  // キャッシュヒット時: サイドバーカテゴリを初期化（useEffect で一度だけ実行）
  // ※ cachedData がある場合は state 初期値で設定済みなので追加処理不要"""

if old_handle in page_text:
    page_text = page_text.replace(old_handle, new_handle)
    print("✅ handleBuyersLoaded を削除しました")
else:
    print("❌ handleBuyersLoaded が見つかりません")
    idx = page_text.find("handleBuyersLoaded")
    if idx >= 0:
        print(f"周辺: {page_text[idx:idx+400]}")

# 5. handleSync でサイドバーカテゴリもリセット
old_sync = """      pageDataCache.invalidate(CACHE_KEYS.BUYERS_STATS);
      pageDataCache.invalidate(CACHE_KEYS.BUYERS_WITH_STATUS); // 買主ステータスキャッシュも無効化
      // サイドバーキャッシュをリセット
      allBuyersWithStatusRef.current = [];
      sidebarLoadedRef.current = false;
      setDataReady(false);
      setRefetchTrigger(prev => prev + 1);"""

new_sync = """      pageDataCache.invalidate(CACHE_KEYS.BUYERS_STATS);
      pageDataCache.invalidate(CACHE_KEYS.BUYERS_WITH_STATUS); // 買主ステータスキャッシュも無効化
      // サイドバーキャッシュをリセット
      allBuyersWithStatusRef.current = [];
      sidebarLoadedRef.current = false;
      setSidebarCategories([]);
      setSidebarNormalStaffInitials([]);
      setSidebarLoading(true);
      setDataReady(false);
      setRefetchTrigger(prev => prev + 1);"""

if old_sync in page_text:
    page_text = page_text.replace(old_sync, new_sync)
    print("✅ handleSync を修正しました")
else:
    print("❌ handleSync が見つかりません")

# 6. BuyerStatusSidebar の JSX を修正（onBuyersLoaded を削除、categories/normalStaffInitials/loading を追加）
old_sidebar_jsx = """          <BuyerStatusSidebar
            selectedStatus={selectedCalculatedStatus}
            onStatusSelect={(status) => { setSelectedCalculatedStatus(status); setPage(0); }}
            totalCount={total}
            onBuyersLoaded={handleBuyersLoaded}
          />"""

new_sidebar_jsx = """          <BuyerStatusSidebar
            selectedStatus={selectedCalculatedStatus}
            onStatusSelect={(status) => { setSelectedCalculatedStatus(status); setPage(0); }}
            totalCount={total}
            categories={sidebarCategories}
            normalStaffInitials={sidebarNormalStaffInitials}
            loading={sidebarLoading}
          />"""

if old_sidebar_jsx in page_text:
    page_text = page_text.replace(old_sidebar_jsx, new_sidebar_jsx)
    print("✅ BuyerStatusSidebar JSX を修正しました")
else:
    print("❌ BuyerStatusSidebar JSX が見つかりません")

with open('frontend/frontend/src/pages/BuyersPage.tsx', 'wb') as f:
    f.write(page_text.encode('utf-8'))
print("\n✅ BuyersPage.tsx を保存しました")

# 確認
with open('frontend/frontend/src/pages/BuyersPage.tsx', 'rb') as f:
    verify = f.read().decode('utf-8')

checks = [
    ('sidebarCategories', 'sidebarCategories state'),
    ('sidebarLoading', 'sidebarLoading state'),
    ('バックグラウンドで全件取得', 'バックグラウンド取得'),
    ('setSidebarCategories', 'setSidebarCategories 呼び出し'),
]
for key, label in checks:
    if key in verify:
        print(f"✅ {label} が確認されました")
    else:
        print(f"❌ {label} が見つかりません")
