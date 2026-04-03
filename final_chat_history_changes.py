#!/usr/bin/env python3
# -*- coding: utf-8 -*-

with open('frontend/frontend/src/pages/PropertyListingDetailPage.tsx', 'rb') as f:
    content = f.read()

text = content.decode('utf-8')

# ステップ1: インポート文を追加
old_import = "import { getPurchaseStatusText, hasBuyerPurchaseStatus } from '../utils/purchaseStatusUtils';"

new_import = """import { getPurchaseStatusText, hasBuyerPurchaseStatus } from '../utils/purchaseStatusUtils';
import { pageDataCache, CACHE_KEYS } from '../store/pageDataCache';
import ChatHistorySection from '../components/ChatHistorySection';
import { fetchChatHistory } from '../services/chatHistoryService';
import { ChatHistoryItem } from '../types/chatHistory';"""

text = text.replace(old_import, new_import)

# ステップ2: ステート変数を追加（workTaskMapの後に追加）
old_state = "  const [workTaskMap, setWorkTaskMap] = useState<Record<string, WorkTask[]>>({});"

new_state = """  const [workTaskMap, setWorkTaskMap] = useState<Record<string, WorkTask[]>>({});
  const [chatHistory, setChatHistory] = useState<ChatHistoryItem[]>([]);
  const [chatHistoryLoading, setChatHistoryLoading] = useState(false);"""

text = text.replace(old_state, new_state)

# ステップ3: fetchChatHistoryData関数を追加（useEffectの直前）
old_useeffect = "  useEffect(() => {"

new_useeffect = """  const fetchChatHistoryData = async () => {
    if (!propertyNumber) return;
    
    setChatHistoryLoading(true);
    try {
      const history = await fetchChatHistory(propertyNumber);
      setChatHistory(history);
    } catch (error) {
      console.error('CHAT履歴の取得に失敗しました:', error);
      setChatHistory([]);
    } finally {
      setChatHistoryLoading(false);
    }
  };

  useEffect(() => {"""

text = text.replace(old_useeffect, new_useeffect, 1)  # 最初の1回だけ置換

# ステップ4: useEffectにfetchChatHistoryDataを追加
old_promise = """      const results = await Promise.allSettled([
        fetchPropertyData(),
        fetchEmployees(),
        fetchPendingPriceReductions(),
        fetchWorkTasks(),
      ]);"""

new_promise = """      const results = await Promise.allSettled([
        fetchPropertyData(),
        fetchEmployees(),
        fetchPendingPriceReductions(),
        fetchWorkTasks(),
        fetchChatHistoryData(),
      ]);"""

text = text.replace(old_promise, new_promise)

# ステップ5: 担当へCHAT送信後の履歴更新
old_assignee = """          setSnackbar({ open: true, message: 'CHATを送信しました', severity: 'success' });
          setAssigneeMessage('');
        } else {"""

new_assignee = """          setSnackbar({ open: true, message: 'CHATを送信しました', severity: 'success' });
          setAssigneeMessage('');
          // CHAT履歴を再取得
          await fetchChatHistoryData();
        } else {"""

text = text.replace(old_assignee, new_assignee)

# ステップ6: 事務へCHAT送信後の履歴更新
old_office = """          setSnackbar({ open: true, message: 'CHATを送信しました', severity: 'success' });
          setOfficeMessage('');
        } else {"""

new_office = """          setSnackbar({ open: true, message: 'CHATを送信しました', severity: 'success' });
          setOfficeMessage('');
          // CHAT履歴を再取得
          await fetchChatHistoryData();
        } else {"""

text = text.replace(old_office, new_office)

# ステップ7: ChatHistorySectionコンポーネントを追加
old_sidebar = """              <PropertySidebarStatus
                listings={listings}
                selectedStatus={selectedStatus}
                onStatusChange={setSelectedStatus}
                pendingPriceReductionProperties={pendingPriceReductionProperties}
                workTaskMap={workTaskMap}
              />
            </Box>"""

new_sidebar = """              <PropertySidebarStatus
                listings={listings}
                selectedStatus={selectedStatus}
                onStatusChange={setSelectedStatus}
                pendingPriceReductionProperties={pendingPriceReductionProperties}
                workTaskMap={workTaskMap}
              />
              
              <ChatHistorySection
                history={chatHistory}
                loading={chatHistoryLoading}
              />
            </Box>"""

text = text.replace(old_sidebar, new_sidebar)

# UTF-8で書き込む（BOMなし）
with open('frontend/frontend/src/pages/PropertyListingDetailPage.tsx', 'wb') as f:
    f.write(text.encode('utf-8'))

print('✅ PropertyListingDetailPage.tsxに全ての変更を適用しました')
