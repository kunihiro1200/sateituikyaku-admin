# encoding: utf-8
with open('frontend/frontend/src/pages/AreaReportPage.tsx', 'rb') as f:
    text = f.read().decode('utf-8')

start_idx = text.find('  const generate = async () => {')
end_idx = text.find('\n  useEffect(', start_idx)

new_generate = """  const generate = async () => {
    setLoading(true);
    setError(null);
    setHtml(null);
    try {
      const res = await api.post(`/api/sellers/${sellerId}/area-report`);
      const htmlContent: string = res.data.html || '';
      const name: string = res.data.areaName || '';
      setHtml(htmlContent);
      setAreaName(name);
    } catch (e: any) {
      setError(e?.response?.data?.error || 'レポートの生成に失敗しました');
    } finally {
      setLoading(false);
    }
  };
"""

new_text = text[:start_idx] + new_generate + text[end_idx:]
with open('frontend/frontend/src/pages/AreaReportPage.tsx', 'wb') as f:
    f.write(new_text.encode('utf-8'))
print('Done!')
