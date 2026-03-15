#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""PropertyReportPage.tsx: ヘッダーの売主名を sellers API から取得"""

with open('frontend/frontend/src/pages/PropertyReportPage.tsx', 'rb') as f:
    raw = f.read()

content = raw.decode('utf-8').replace('\r\n', '\n')

# useEffect に fetchSellerName を追加
old_use_effect = """  useEffect(() => {
    if (propertyNumber) {
      fetchData();
      fetchJimuInitials();
      fetchTemplates();
    }
  }, [propertyNumber]);"""

new_use_effect = """  useEffect(() => {
    if (propertyNumber) {
      fetchData();
      fetchJimuInitials();
      fetchTemplates();
      fetchSellerName();
    }
  }, [propertyNumber]);"""

content = content.replace(old_use_effect, new_use_effect)

# fetchData の後に fetchSellerName を追加
old_after_fetch = """  const fetchJimuInitials = async () => {"""

new_after_fetch = """  const fetchSellerName = async () => {
    if (!propertyNumber) return;
    try {
      const response = await api.get(`/api/sellers/by-number/${propertyNumber}`);
      const name = response.data?.name || response.data?.decryptedName || '';
      if (name) {
        setReportData((prev) => ({ ...prev, owner_name: name }));
      }
    } catch {
      // 売主が見つからない場合は無視
    }
  };

  const fetchJimuInitials = async () => {"""

content = content.replace(old_after_fetch, new_after_fetch)

with open('frontend/frontend/src/pages/PropertyReportPage.tsx', 'wb') as f:
    f.write(content.encode('utf-8'))

print('Done: PropertyReportPage.tsx updated with seller name fetch')
