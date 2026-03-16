import re

# ===== 問題1: PropertyListingDetailPage.tsx の salesPrice={data.price} を data.sales_price に修正 =====
with open('frontend/frontend/src/pages/PropertyListingDetailPage.tsx', 'rb') as f:
    content = f.read().decode('utf-8')

# salesPrice={data.price} → salesPrice={data.sales_price}
old = '                  salesPrice={data.price}'
new = '                  salesPrice={data.sales_price}'
if old in content:
    content = content.replace(old, new)
    print('✅ Fix 1: salesPrice={data.price} → salesPrice={data.sales_price}')
else:
    print('❌ Fix 1: pattern not found')

with open('frontend/frontend/src/pages/PropertyListingDetailPage.tsx', 'wb') as f:
    f.write(content.encode('utf-8'))

# ===== 問題3: PropertyReportPage.tsx のprefetchを遅延化（Gmailボタン押下時のみ実行）=====
with open('frontend/frontend/src/pages/PropertyReportPage.tsx', 'rb') as f:
    content = f.read().decode('utf-8')

# useEffectからprefetchMergedTemplatesの呼び出しを削除
old = """  useEffect(() => {
    if (propertyNumber) {
      fetchData();
      fetchJimuInitials();
      fetchJimuStaff();
      fetchTemplates().then(() => {
        prefetchMergedTemplates();
      });
      fetchReportHistory();
    }
  }, [propertyNumber]);"""

new = """  useEffect(() => {
    if (propertyNumber) {
      fetchData();
      fetchJimuInitials();
      fetchJimuStaff();
      fetchTemplates();
      fetchReportHistory();
    }
  }, [propertyNumber]);"""

if old in content:
    content = content.replace(old, new)
    print('✅ Fix 3a: removed prefetchMergedTemplates from useEffect')
else:
    print('❌ Fix 3a: pattern not found')

# Gmailボタンクリック時にprefetchを実行するよう変更
old = """        <Button
          variant="outlined"
          fullWidth
          startIcon={prefetching ? <CircularProgress size={16} /> : <EmailIcon />}
          onClick={() => setTemplateDialogOpen(true)}"""

new = """        <Button
          variant="outlined"
          fullWidth
          startIcon={prefetching ? <CircularProgress size={16} /> : <EmailIcon />}
          onClick={() => {
            setTemplateDialogOpen(true);
            if (Object.keys(mergedTemplates).length === 0 && !prefetching) {
              prefetchMergedTemplates();
            }
          }}"""

if old in content:
    content = content.replace(old, new)
    print('✅ Fix 3b: prefetch on Gmail button click')
else:
    print('❌ Fix 3b: pattern not found')

with open('frontend/frontend/src/pages/PropertyReportPage.tsx', 'wb') as f:
    f.write(content.encode('utf-8'))

print('\nDone!')
