#!/usr/bin/env python3
# -*- coding: utf-8 -*-

with open('frontend/frontend/src/pages/PropertyListingDetailPage.tsx', 'rb') as f:
    content = f.read()

text = content.decode('utf-8')

# 壊れたインポート文を修正
old_import = """import ChatHistorySection from '../components/ChatHistorySection';
import { fetchChatHistory }ervice';
import { ChatHistoryItem } from '../types/chatHistory'; from '../services/chatHistoryS"""

new_import = """import ChatHistorySection from '../components/ChatHistorySection';
import { fetchChatHistory } from '../services/chatHistoryService';
import { ChatHistoryItem } from '../types/chatHistory';"""

text = text.replace(old_import, new_import)

# UTF-8で書き込む（BOMなし）
with open('frontend/frontend/src/pages/PropertyListingDetailPage.tsx', 'wb') as f:
    f.write(text.encode('utf-8'))

print('✅ インポート文を修正しました')
