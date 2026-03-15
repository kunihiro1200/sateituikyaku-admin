#!/usr/bin/env python3
# PropertyReportPage.tsx のヘッダー売主名表示を修正
# owner_name は property_listings に存在しないため、seller_name を使い、
# それも空の場合は /api/sellers/by-number/:sellerNumber で取得する

with open('frontend/frontend/src/pages/PropertyReportPage.tsx', 'rb') as f:
    content = f.read()

text = content.decode('utf-8')

# fetchData 内の owner_name 取得を seller_name に変更し、
# seller_name が空の場合は by-number API を呼び出す
old_fetch = """  const fetchData = async () => {
    if (!propertyNumber) return;
    setLoading(true);
    try {
      const response = await api.get(`/api/property-listings/${propertyNumber}`);
      const d = response.data;
      setReportData({
        report_date: d.report_date || '',
        report_completed: d.report_completed || 'N',
        report_assignee: d.report_assignee || d.sales_assignee || '',
        sales_assignee: d.sales_assignee || '',
        address: d.address || d.property_address || '',
        owner_name: d.owner_name || '',
      });
    } catch (error) {
      console.error('Failed to fetch property data:', error);
      setSnackbar({ open: true, message: '物件データの取得に失敗しました', severity: 'error' });
    } finally {
      setLoading(false);
    }
  };"""

new_fetch = """  const fetchData = async () => {
    if (!propertyNumber) return;
    setLoading(true);
    try {
      const response = await api.get(`/api/property-listings/${propertyNumber}`);
      const d = response.data;
      // seller_name を優先して使用
      let ownerName = d.seller_name || '';
      // seller_name が空の場合は sellers テーブルから取得（復号化済み）
      if (!ownerName) {
        try {
          const sellerRes = await api.get(`/api/sellers/by-number/${propertyNumber}`);
          ownerName = sellerRes.data?.name || '';
        } catch {
          // 売主が見つからない場合は空のまま
        }
      }
      setReportData({
        report_date: d.report_date || '',
        report_completed: d.report_completed || 'N',
        report_assignee: d.report_assignee || d.sales_assignee || '',
        sales_assignee: d.sales_assignee || '',
        address: d.address || d.property_address || '',
        owner_name: ownerName,
      });
    } catch (error) {
      console.error('Failed to fetch property data:', error);
      setSnackbar({ open: true, message: '物件データの取得に失敗しました', severity: 'error' });
    } finally {
      setLoading(false);
    }
  };"""

text = text.replace(old_fetch, new_fetch)

# handleTemplateSelect でも sellerName をヘッダーに反映する条件を修正
# 現在: if (sellerName && !reportData.owner_name) → 常に上書きするよう変更
old_setter = "      if (sellerName && !reportData.owner_name) {\n        setReportData((prev) => ({ ...prev, owner_name: sellerName }));\n      }"
new_setter = "      if (sellerName) {\n        setReportData((prev) => ({ ...prev, owner_name: sellerName }));\n      }"

text = text.replace(old_setter, new_setter)

with open('frontend/frontend/src/pages/PropertyReportPage.tsx', 'wb') as f:
    f.write(text.encode('utf-8'))

print('Done! PropertyReportPage.tsx updated to fetch seller name correctly.')
