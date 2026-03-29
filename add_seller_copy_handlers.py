# NewBuyerPage.tsx に売主コピーハンドラ関数を追加するスクリプト
# file-encoding-protection.md のルールに従い、UTF-8で書き込む

with open('frontend/frontend/src/pages/NewBuyerPage.tsx', 'rb') as f:
    content = f.read()

text = content.decode('utf-8')

# 挿入するハンドラ関数（fetchPropertyInfoとshowBrokerInquiryの間に追加）
handlers_to_insert = """
  // 売主コピー検索ハンドラ
  const handleSellerCopySearch = async (query: string) => {
    if (!query || query.length < 2) {
      setSellerCopyOptions([]);
      return;
    }
    setSellerCopyLoading(true);
    try {
      const response = await api.get(`/api/sellers/search?q=${encodeURIComponent(query)}`);
      setSellerCopyOptions(response.data || []);
    } catch (err) {
      setSellerCopyOptions([]);
    } finally {
      setSellerCopyLoading(false);
    }
  };

  const handleSellerCopySelect = async (option: {sellerNumber: string; name: string; id: string} | null) => {
    if (!option) return;
    try {
      const response = await api.get(`/api/sellers/by-number/${option.sellerNumber}`);
      const seller = response.data;
      if (seller.name) setName(seller.name);
      if (seller.phoneNumber) setPhoneNumber(seller.phoneNumber);
      if (seller.email) setEmail(seller.email);
      setInquirySource('売主');
    } catch (err) {
      setError('売主情報の取得に失敗しました');
    }
  };

  // 買主コピー検索ハンドラ
  const handleBuyerCopySearch = async (query: string) => {
    if (!query || query.length < 2) {
      setBuyerCopyOptions([]);
      return;
    }
    setBuyerCopyLoading(true);
    try {
      const response = await api.get(`/api/buyers/search?q=${encodeURIComponent(query)}&limit=20`);
      setBuyerCopyOptions(response.data || []);
    } catch (err) {
      setBuyerCopyOptions([]);
    } finally {
      setBuyerCopyLoading(false);
    }
  };

  const handleBuyerCopySelect = async (option: {buyer_number: string; name: string} | null) => {
    if (!option) return;
    try {
      const response = await api.get(`/api/buyers/${option.buyer_number}`);
      const buyer = response.data;
      if (buyer.name) setName(buyer.name);
      if (buyer.phoneNumber || buyer.phone_number) setPhoneNumber(buyer.phoneNumber || buyer.phone_number);
      if (buyer.email) setEmail(buyer.email);
      setInquirySource('2件目以降');
    } catch (err) {
      setError('買主情報の取得に失敗しました');
    }
  };

"""

# fetchPropertyInfoの終わりの後、showBrokerInquiryの前に挿入
target = """  // 法人名に入力がある場合のみ業者問合せを表示する
  const showBrokerInquiry = (name: string): boolean => {"""

replacement = handlers_to_insert + """  // 法人名に入力がある場合のみ業者問合せを表示する
  const showBrokerInquiry = (name: string): boolean => {"""

if target in text:
    text = text.replace(target, replacement, 1)
    print('✅ ハンドラ関数を挿入しました')
else:
    print('❌ 挿入ターゲットが見つかりませんでした')
    print('--- 検索対象 ---')
    print(repr(target[:100]))

# UTF-8で書き込む（BOMなし）
with open('frontend/frontend/src/pages/NewBuyerPage.tsx', 'wb') as f:
    f.write(text.encode('utf-8'))

print('✅ ファイルを保存しました')

# BOMチェック
with open('frontend/frontend/src/pages/NewBuyerPage.tsx', 'rb') as f:
    first_bytes = f.read(3)
print(f'BOM check: {repr(first_bytes)} (should NOT start with b"\\xef\\xbb\\xbf")')
