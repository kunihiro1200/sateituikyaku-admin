with open('frontend/frontend/src/pages/PropertyListingDetailPage.tsx', 'rb') as f:
    content = f.read()

text = content.decode('utf-8')

# 壊れたimportを修正
text = text.replace(
    "import ChatHistorySection from '../components/ChatHistorySection';\nimport { fetchChatHistory }ervice';\nimport { ChatHistoryItem } from '../types/chatHistory'; from '../services/chatHistoryS",
    "import ChatHistorySection from '../components/ChatHistorySection';\nimport { fetchChatHistory } from '../services/chatHistoryService';\nimport { ChatHistoryItem } from '../types/chatHistory';"
)

with open('frontend/frontend/src/pages/PropertyListingDetailPage.tsx', 'wb') as f:
    f.write(text.encode('utf-8'))

print('Fixed imports!')
