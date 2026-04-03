#!/usr/bin/env python3
# -*- coding: utf-8 -*-

with open('frontend/frontend/src/pages/PropertyListingDetailPage.tsx', 'rb') as f:
    content = f.read()

text = content.decode('utf-8')

# ステップ1: インポート文を追加
import_section = """import { pageDataCache, CACHE_KEYS } from '../store/pageDataCache';"""

new_imports = """import { pageDataCache, CACHE_KEYS } from '../store/pageDataCache';
import ChatHistorySection from '../components/ChatHistorySection';
import { fetchChatHistory } from '../services/chatHistoryService';
import { ChatHistoryItem } from '../types/chatHistory';"""

text = text.replace(import_section, new_imports)

# ステップ2: ステート変数を追加
state_section = """  const [pendingPriceReductionProperties, setPendingPriceReductionProperties] = useState<Set<string>>(new Set());
  const [workTaskMap, setWorkTaskMap] = useState<Record<string, WorkTask[]>>({});"""

new_state = """  const [pendingPriceReductionProperties, setPendingPriceReductionProperties] = useState<Set<string>>(new Set());
  const [workTaskMap, setWorkTaskMap] = useState<Record<string, WorkTask[]>>({});
  const [chatHistory, setChatHistory] = useState<ChatHistoryItem[]>([]);
  const [chatHistoryLoading, setChatHistoryLoading] = useState(false);"""

text = text.replace(state_section, new_state)

# ステップ3: fetchChatHistoryData関数を追加
fetch_function = """  const fetchChatHistoryData = async () => {
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

text = text.replace('  useEffect(() => {', fetch_function)

# ステップ4: useEffectにfetchChatHistoryDataを追加
useeffect_section = """      const results = await Promise.allSettled([
        fetchPropertyData(),
        fetchEmployees(),
        fetchPendingPriceReductions(),
        fetchWorkTasks(),
      ]);"""

new_useeffect = """      const results = await Promise.allSettled([
        fetchPropertyData(),
        fetchEmployees(),
        fetchPendingPriceReductions(),
        fetchWorkTasks(),
        fetchChatHistoryData(),
      ]);"""

text = text.replace(useeffect_section, new_useeffect)

# ステップ5: 担当へCHAT送信後の履歴更新
assignee_success = """          setSnackbar({ open: true, message: 'CHATを送信しました', severity: 'success' });
          setAssigneeMessage('');
        } else {"""

new_assignee_success = """          setSnackbar({ open: true, message: 'CHATを送信しました', severity: 'success' });
          setAssigneeMessage('');
          // CHAT履歴を再取得
          await fetchChatHistoryData();
        } else {"""

text = text.replace(assignee_success, new_assignee_success)

# ステップ6: 事務へCHAT送信後の履歴更新
office_success = """          setSnackbar({ open: true, message: 'CHATを送信しました', severity: 'success' });
          setOfficeMessage('');
        } else {"""

new_office_success = """          setSnackbar({ open: true, message: 'CHATを送信しました', severity: 'success' });
          setOfficeMessage('');
          // CHAT履歴を再取得
          await fetchChatHistoryData();
        } else {"""

text = text.replace(office_success, new_office_success)

# ステップ7: ChatHistorySectionコンポーネントを追加
sidebar_section = """              <PropertySidebarStatus
                listings={listings}
                selectedStatus={selectedStatus}
                onStatusChange={setSelectedStatus}
                pendingPriceReductionProperties={pendingPriceReductionProperties}
                workTaskMap={workTaskMap}
              />"""

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
              />"""

text = text.replace(sidebar_section, new_sidebar)

# UTF-8で書き込む（BOMなし）
with open('frontend/frontend/src/pages/PropertyListingDetailPage.tsx', 'wb') as f:
    f.write(text.encode('utf-8'))

print('✅ PropertyListingDetailPage.tsxに全ての変更を適用しました')
