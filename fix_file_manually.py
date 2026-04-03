#!/usr/bin/env python3
# -*- coding: utf-8 -*-

with open('frontend/frontend/src/pages/PropertyListingDetailPage.tsx', 'rb') as f:
    content = f.read()

text = content.decode('utf-8')

# 壊れたインポート文を削除
broken_lines = """import ChatHistorySection from '../components/ChatHistorySection';
import { fetchChatHistory }ervice';
import { ChatHistoryItem } from '../types/chatHistory'; from '../services/chatHistoryS"""

text = text.replace(broken_lines, '')

# UTF-8で書き込む（BOMなし）
with open('frontend/frontend/src/pages/PropertyListingDetailPage.tsx', 'wb') as f:
    f.write(text.encode('utf-8'))

print('✅ 壊れたインポート文を削除しました')
