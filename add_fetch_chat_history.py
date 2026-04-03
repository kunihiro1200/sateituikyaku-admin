with open('frontend/frontend/src/pages/PropertyListingDetailPage.tsx', 'rb') as f:
    content = f.read()

text = content.decode('utf-8')

# fetchBuyers関数の後にfetchChatHistoryData関数を追加
old_code = """  const fetchBuyers = async () => {
    if (!propertyNumber) return;
    setBuyersLoading(true);
    try {
      const response = await api.get(`/api/property-listings/${propertyNumber}/buyers`);
      setBuyers(response.data);
    } catch (error) {
      console.error('Failed to fetch buyers:', error);
    } finally {
      setBuyersLoading(false);
    }
  };"""

new_code = """  const fetchBuyers = async () => {
    if (!propertyNumber) return;
    setBuyersLoading(true);
    try {
      const response = await api.get(`/api/property-listings/${propertyNumber}/buyers`);
      setBuyers(response.data);
    } catch (error) {
      console.error('Failed to fetch buyers:', error);
    } finally {
      setBuyersLoading(false);
    }
  };

  const fetchChatHistoryData = async () => {
    if (!propertyNumber) return;
    setChatHistoryLoading(true);
    try {
      const history = await fetchChatHistory(propertyNumber);
      setChatHistory(history);
    } catch (error) {
      console.error('Failed to fetch chat history:', error);
    } finally {
      setChatHistoryLoading(false);
    }
  };"""

text = text.replace(old_code, new_code)

with open('frontend/frontend/src/pages/PropertyListingDetailPage.tsx', 'wb') as f:
    f.write(text.encode('utf-8'))

print('Added fetchChatHistoryData function!')
