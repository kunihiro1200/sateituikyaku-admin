#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""PropertyReportPage.tsx を更新:
1. ヘッダーに売主氏名・所在地を表示
2. テンプレート選択後に /api/email-templates/property/merge を呼び出してGmail開く
"""

with open('frontend/frontend/src/pages/PropertyReportPage.tsx', 'rb') as f:
    content = f.read().decode('utf-8')

# ReportData に address/ownerName を追加
old_interface = """interface ReportData {
  report_date?: string;
  report_completed?: string;
  report_assignee?: string;
  sales_assignee?: string;
}"""

new_interface = """interface ReportData {
  report_date?: string;
  report_completed?: string;
  report_assignee?: string;
  sales_assignee?: string;
  address?: string;
  owner_name?: string;
}"""

content = content.replace(old_interface, new_interface)

# fetchData で address/owner_name もセット
old_fetch_data = """      setReportData({
        report_date: d.report_date || '',
        report_completed: d.report_completed || 'N',
        report_assignee: d.report_assignee || d.sales_assignee || '',
        sales_assignee: d.sales_assignee || '',
      });"""

new_fetch_data = """      setReportData({
        report_date: d.report_date || '',
        report_completed: d.report_completed || 'N',
        report_assignee: d.report_assignee || d.sales_assignee || '',
        sales_assignee: d.sales_assignee || '',
        address: d.address || d.property_address || '',
        owner_name: d.owner_name || '',
      });"""

content = content.replace(old_fetch_data, new_fetch_data)

# handleTemplateSelect を更新: merge API を呼び出す
old_handle_template = """  const handleTemplateSelect = (template: EmailTemplate) => {
    setTemplateDialogOpen(false);
    // Gmailの作成画面をURLで開く
    const subject = encodeURIComponent(template.subject);
    const body = encodeURIComponent(template.body);
    const gmailUrl = `https://mail.google.com/mail/?view=cm&fs=1&su=${subject}&body=${body}`;
    window.open(gmailUrl, '_blank');
  };"""

new_handle_template = """  const handleTemplateSelect = async (template: EmailTemplate) => {
    setTemplateDialogOpen(false);
    try {
      // プレースホルダー置換済みの件名・本文を取得
      const mergeResponse = await api.post('/api/email-templates/property/merge', {
        propertyNumber,
        templateId: template.id,
      });
      const { subject: mergedSubject, body: mergedBody } = mergeResponse.data;
      const subject = encodeURIComponent(mergedSubject || template.subject);
      const body = encodeURIComponent(mergedBody || template.body);
      const gmailUrl = `https://mail.google.com/mail/?view=cm&fs=1&su=${subject}&body=${body}`;
      window.open(gmailUrl, '_blank');
    } catch (error) {
      console.error('Failed to merge template:', error);
      // フォールバック: 置換なしで開く
      const subject = encodeURIComponent(template.subject);
      const body = encodeURIComponent(template.body);
      const gmailUrl = `https://mail.google.com/mail/?view=cm&fs=1&su=${subject}&body=${body}`;
      window.open(gmailUrl, '_blank');
    }
  };"""

content = content.replace(old_handle_template, new_handle_template)

# ヘッダーを更新: 物件番号の右隣に売主氏名・所在地を表示
old_header = """      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
        <IconButton onClick={handleBack} size="large">
          <ArrowBackIcon />
        </IconButton>
        <Typography variant="h5" fontWeight="bold" sx={{ color: SECTION_COLORS.property.main }}>
          報告 - {propertyNumber}
        </Typography>
      </Box>"""

new_header = """      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
        <IconButton onClick={handleBack} size="large">
          <ArrowBackIcon />
        </IconButton>
        <Box>
          <Typography variant="h5" fontWeight="bold" sx={{ color: SECTION_COLORS.property.main }}>
            報告 - {propertyNumber}
            {reportData.owner_name && (
              <Typography component="span" variant="h6" sx={{ ml: 2, color: 'text.primary', fontWeight: 'normal' }}>
                {reportData.owner_name}
              </Typography>
            )}
          </Typography>
          {reportData.address && (
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
              {reportData.address}
            </Typography>
          )}
        </Box>
      </Box>"""

content = content.replace(old_header, new_header)

with open('frontend/frontend/src/pages/PropertyReportPage.tsx', 'wb') as f:
    f.write(content.encode('utf-8'))

print('Done: PropertyReportPage.tsx updated')
