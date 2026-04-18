"""
PropertyListingDetailPage.tsx の2つのバグを修正する:
1. 保存後に画面が白くなる問題 → fetchPropertyData に silent フラグを追加
2. 保存後に青いCHATバーが消える問題 → priceSavedButNotSent フラグを追加
"""

with open('frontend/frontend/src/pages/PropertyListingDetailPage.tsx', 'rb') as f:
    content = f.read()

text = content.decode('utf-8')

# ===== 修正1: fetchPropertyData に silent フラグを追加 =====
# setLoading(true) を silent でない場合のみ呼ぶ
old_fetch = """  const fetchPropertyData = async () => {
    if (!propertyNumber) return;
    setLoading(true);
    try {"""

new_fetch = """  const fetchPropertyData = async (silent = false) => {
    if (!propertyNumber) return;
    if (!silent) setLoading(true);
    try {"""

text = text.replace(old_fetch, new_fetch)

# ===== 修正2: priceSavedButNotSent 状態変数を追加 =====
# useState の宣言群の近くに追加
old_state = """  const [editedData, setEditedData] = useState<Record<string, any>>({});"""

new_state = """  const [editedData, setEditedData] = useState<Record<string, any>>({});
  const [priceSavedButNotSent, setPriceSavedButNotSent] = useState(false);"""

text = text.replace(old_state, new_state)

# ===== 修正3: handleSavePrice で保存後に silent=true で再取得し、フラグを立てる =====
old_save_price = """      await fetchPropertyData();
      setEditedData({});
    } catch (error) {
      setSnackbar({
        open: true,
        message: '保存に失敗しました',
        severity: 'error',
      });
      throw error;
    }
  };

  const handleSaveHeader"""

new_save_price = """      await fetchPropertyData(true);  // silent=true: ローディング画面を表示しない
      setEditedData({});
      setPriceSavedButNotSent(true);  // 保存済みだがCHATがまだ送信されていない
    } catch (error) {
      setSnackbar({
        open: true,
        message: '保存に失敗しました',
        severity: 'error',
      });
      throw error;
    }
  };

  const handleSaveHeader"""

text = text.replace(old_save_price, new_save_price)

# ===== 修正4: handlePriceChatSendSuccess で priceSavedButNotSent をリセット =====
old_chat_success = """  // PriceSection Chat送信成功時のハンドラー
  const handlePriceChatSendSuccess = async (message: string) => {
    // スナックバー表示（既存処理）
    setSnackbar({ open: true, message, severity: 'success' });"""

new_chat_success = """  // PriceSection Chat送信成功時のハンドラー
  const handlePriceChatSendSuccess = async (message: string) => {
    // スナックバー表示（既存処理）
    setSnackbar({ open: true, message, severity: 'success' });
    setPriceSavedButNotSent(false);  // CHAT送信完了でフラグをリセット"""

text = text.replace(old_chat_success, new_chat_success)

# ===== 修正5: PriceSection に priceSavedButNotSent prop を渡す =====
old_price_section = """                <PriceSection
                  salesPrice={data.price}
                  salesPriceActual={editedData.price !== undefined ? editedData.price : data.price}
                  listingPrice={data.listing_price}
                  propertyType={editedData.property_type !== undefined ? editedData.property_type : data.property_type}
                  priceReductionHistory={data.price_reduction_history}
                  priceReductionScheduledDate={data.price_reduction_scheduled_date}
                  onFieldChange={handleFieldChange}
                  editedData={editedData}
                  isEditMode={isPriceEditMode}
                  propertyNumber={data.property_number}
                  salesAssignee={data.sales_assignee}
                  address={data.address}
                  onChatSendSuccess={handlePriceChatSendSuccess}
                  onChatSendError={(message) => setSnackbar({ open: true, message, severity: 'error' })}
                  onChatSend={handlePropertyChatSend}
                />"""

new_price_section = """                <PriceSection
                  salesPrice={data.price}
                  salesPriceActual={editedData.price !== undefined ? editedData.price : data.price}
                  listingPrice={data.listing_price}
                  propertyType={editedData.property_type !== undefined ? editedData.property_type : data.property_type}
                  priceReductionHistory={data.price_reduction_history}
                  priceReductionScheduledDate={data.price_reduction_scheduled_date}
                  onFieldChange={handleFieldChange}
                  editedData={editedData}
                  isEditMode={isPriceEditMode}
                  propertyNumber={data.property_number}
                  salesAssignee={data.sales_assignee}
                  address={data.address}
                  onChatSendSuccess={handlePriceChatSendSuccess}
                  onChatSendError={(message) => setSnackbar({ open: true, message, severity: 'error' })}
                  onChatSend={handlePropertyChatSend}
                  priceSavedButNotSent={priceSavedButNotSent}
                />"""

text = text.replace(old_price_section, new_price_section)

# UTF-8 で書き込む（BOMなし）
with open('frontend/frontend/src/pages/PropertyListingDetailPage.tsx', 'wb') as f:
    f.write(text.encode('utf-8'))

print('PropertyListingDetailPage.tsx の修正完了')

# 変更確認
checks = [
    ('silent フラグ追加', 'fetchPropertyData(true)'),
    ('priceSavedButNotSent 状態', 'priceSavedButNotSent'),
    ('setPriceSavedButNotSent(true)', 'setPriceSavedButNotSent(true)'),
    ('setPriceSavedButNotSent(false)', 'setPriceSavedButNotSent(false)'),
    ('prop渡し', 'priceSavedButNotSent={priceSavedButNotSent}'),
]
for name, pattern in checks:
    found = pattern in text
    print(f'  {"✅" if found else "❌"} {name}: {found}')
