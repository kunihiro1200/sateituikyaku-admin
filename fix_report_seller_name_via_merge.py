#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
2つの修正:
1. emailTemplates.ts の /property/merge レスポンスに sellerName を追加
2. PropertyReportPage.tsx: fetchSellerName を削除し、
   fetchData で property_listings の owner_name を取得、
   なければ merge API 呼び出し時に sellerName をヘッダーにセット
"""

# --- 1. emailTemplates.ts: レスポンスに sellerName を追加 ---
with open('backend/src/routes/emailTemplates.ts', 'rb') as f:
    content = f.read().decode('utf-8').replace('\r\n', '\n')

old_res = "    res.json({ subject: mergedSubject, body: mergedBody });\n  } catch (error: any) {\n    console.error('Error merging property template:', error);"

new_res = "    res.json({ subject: mergedSubject, body: mergedBody, sellerName });\n  } catch (error: any) {\n    console.error('Error merging property template:', error);"

if old_res in content:
    content = content.replace(old_res, new_res)
    print('emailTemplates.ts: sellerName added to response')
else:
    print('ERROR: pattern not found in emailTemplates.ts')
    print(repr(content[content.find('res.json({ subject: mergedSubject'):content.find('res.json({ subject: mergedSubject')+200]))

with open('backend/src/routes/emailTemplates.ts', 'wb') as f:
    f.write(content.encode('utf-8'))

# --- 2. PropertyReportPage.tsx: fetchSellerName を削除し、
#        handleTemplateSelect で sellerName をヘッダーにセット ---
with open('frontend/frontend/src/pages/PropertyReportPage.tsx', 'rb') as f:
    content = f.read().decode('utf-8').replace('\r\n', '\n')

# fetchSellerName の呼び出しを削除
old_effect = """  useEffect(() => {
    if (propertyNumber) {
      fetchData();
      fetchJimuInitials();
      fetchTemplates();
      fetchSellerName();
    }
  }, [propertyNumber]);"""

new_effect = """  useEffect(() => {
    if (propertyNumber) {
      fetchData();
      fetchJimuInitials();
      fetchTemplates();
    }
  }, [propertyNumber]);"""

if old_effect in content:
    content = content.replace(old_effect, new_effect)
    print('PropertyReportPage.tsx: removed fetchSellerName from useEffect')
else:
    print('WARNING: old_effect not found (may already be correct)')

# fetchSellerName 関数を削除
old_fetch_seller = """  const fetchSellerName = async () => {
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

new_fetch_seller = """  const fetchJimuInitials = async () => {"""

if old_fetch_seller in content:
    content = content.replace(old_fetch_seller, new_fetch_seller)
    print('PropertyReportPage.tsx: removed fetchSellerName function')
else:
    print('WARNING: fetchSellerName function not found (may already be removed)')

# handleTemplateSelect で sellerName をレスポンスから取得してヘッダーにセット
old_handle = """  const handleTemplateSelect = async (template: EmailTemplate) => {
    setTemplateDialogOpen(false);
    try {
      // プレースホルダー置換済みの件名・本文を取得
      const mergeResponse = await api.post('/api/email-templates/property/merge', {
        propertyNumber,
        templateId: template.id,
      });
      const { subject: mergedSubject, body: mergedBody } = mergeResponse.data;"""

new_handle = """  const handleTemplateSelect = async (template: EmailTemplate) => {
    setTemplateDialogOpen(false);
    try {
      // プレースホルダー置換済みの件名・本文を取得
      const mergeResponse = await api.post('/api/email-templates/property/merge', {
        propertyNumber,
        templateId: template.id,
      });
      const { subject: mergedSubject, body: mergedBody, sellerName } = mergeResponse.data;
      // 売主名をヘッダーにセット
      if (sellerName && !reportData.owner_name) {
        setReportData((prev) => ({ ...prev, owner_name: sellerName }));
      }"""

if old_handle in content:
    content = content.replace(old_handle, new_handle)
    print('PropertyReportPage.tsx: sellerName from merge response added')
else:
    print('ERROR: handleTemplateSelect pattern not found')

with open('frontend/frontend/src/pages/PropertyReportPage.tsx', 'wb') as f:
    f.write(content.encode('utf-8'))

print('Done')
