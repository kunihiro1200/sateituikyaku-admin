with open('frontend/frontend/src/pages/PropertyListingDetailPage.tsx', 'rb') as f:
    content = f.read()

text = content.decode('utf-8')

# useEffectにfetchChatHistoryDataを追加
old_code = """      Promise.allSettled([
        fetchPropertyData(),
        fetchBuyers(),
        fetchWorkTaskData(),
        getActiveEmployees().then(setActiveEmployees).catch(() => {}),
      ]);"""

new_code = """      Promise.allSettled([
        fetchPropertyData(),
        fetchBuyers(),
        fetchWorkTaskData(),
        fetchChatHistoryData(),
        getActiveEmployees().then(setActiveEmployees).catch(() => {}),
      ]);"""

text = text.replace(old_code, new_code)

with open('frontend/frontend/src/pages/PropertyListingDetailPage.tsx', 'wb') as f:
    f.write(text.encode('utf-8'))

print('Added fetchChatHistoryData to useEffect!')
