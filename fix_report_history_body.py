#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
送信履歴の修正:
1. バックエンド: report-history の INSERT/SELECT に body を追加
2. フロントエンド: 
   - ReportHistory インターフェースに body を追加
   - recordSendHistory に body を渡す
   - 行クリックで件名・本文ダイアログ表示
   - 「前回メール内容」セクションを追加
"""

# ===== 1. バックエンド: propertyListings.ts の report-history エンドポイント修正 =====
backend_path = 'backend/src/routes/propertyListings.ts'
with open(backend_path, 'rb') as f:
    content = f.read()
text = content.decode('utf-8')

# INSERT に body を追加
old_insert = """    const { template_name, subject, report_date, report_assignee, report_completed } = req.body;
    const supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_KEY!
    );
    const { data, error } = await supabase
      .from('property_report_history')
      .insert({
        property_number: propertyNumber,
        template_name: template_name || null,
        subject: subject || null,
        report_date: report_date || null,
        report_assignee: report_assignee || null,
        report_completed: report_completed || 'N',
        sent_at: new Date().toISOString(),
      })"""

new_insert = """    const { template_name, subject, body, report_date, report_assignee, report_completed } = req.body;
    const supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_KEY!
    );
    const { data, error } = await supabase
      .from('property_report_history')
      .insert({
        property_number: propertyNumber,
        template_name: template_name || null,
        subject: subject || null,
        body: body || null,
        report_date: report_date || null,
        report_assignee: report_assignee || null,
        report_completed: report_completed || 'N',
        sent_at: new Date().toISOString(),
      })"""

if old_insert in text:
    text = text.replace(old_insert, new_insert)
    print("[1] バックエンド: report-history INSERT に body 追加 ✓")
else:
    print("[1] バックエンド: 対象文字列が見つかりません")

with open(backend_path, 'wb') as f:
    f.write(text.encode('utf-8'))

# ===== 2. フロントエンド: PropertyReportPage.tsx の修正 =====
frontend_path = 'frontend/frontend/src/pages/PropertyReportPage.tsx'
with open(frontend_path, 'rb') as f:
    content = f.read()
text = content.decode('utf-8')

# 2-1. useRef を削除（未使用警告を解消）
old_import = "import { useState, useEffect, useRef } from 'react';"
new_import = "import { useState, useEffect } from 'react';"
if old_import in text:
    text = text.replace(old_import, new_import)
    print("[2-1] useRef インポート削除 ✓")

# 2-2. ReportHistory インターフェースに body を追加
old_interface = """interface ReportHistory {
  id: number;
  property_number: string;
  report_date: string | null;
  report_assignee: string | null;
  report_completed: string | null;
  sent_at: string;
  template_name: string | null;
  subject: string | null;
}"""
new_interface = """interface ReportHistory {
  id: number;
  property_number: string;
  report_date: string | null;
  report_assignee: string | null;
  report_completed: string | null;
  sent_at: string;
  template_name: string | null;
  subject: string | null;
  body: string | null;
}"""
if old_interface in text:
    text = text.replace(old_interface, new_interface)
    print("[2-2] ReportHistory インターフェースに body 追加 ✓")
else:
    print("[2-2] ReportHistory インターフェース: 対象が見つかりません")

# 2-3. state に selectedHistory と historyDialogOpen を追加
old_state = """  const [reportHistory, setReportHistory] = useState<ReportHistory[]>([]);
  const [snackbar, setSnackbar] = useState<{"""
new_state = """  const [reportHistory, setReportHistory] = useState<ReportHistory[]>([]);
  const [selectedHistory, setSelectedHistory] = useState<ReportHistory | null>(null);
  const [historyDialogOpen, setHistoryDialogOpen] = useState(false);
  const [snackbar, setSnackbar] = useState<{"""
if old_state in text:
    text = text.replace(old_state, new_state)
    print("[2-3] selectedHistory / historyDialogOpen state 追加 ✓")
else:
    print("[2-3] state 追加: 対象が見つかりません")

# 2-4. recordSendHistory に body を追加
old_record = """  const recordSendHistory = async (templateName: string, subject: string) => {
    if (!propertyNumber) return;
    try {
      await api.post(`/api/property-listings/${propertyNumber}/report-history`, {
        template_name: templateName,
        subject,
        report_date: reportData.report_date || null,
        report_assignee: reportData.report_assignee || null,
        report_completed: reportData.report_completed || 'N',
      });"""
new_record = """  const recordSendHistory = async (templateName: string, subject: string, body?: string) => {
    if (!propertyNumber) return;
    try {
      await api.post(`/api/property-listings/${propertyNumber}/report-history`, {
        template_name: templateName,
        subject,
        body: body || null,
        report_date: reportData.report_date || null,
        report_assignee: reportData.report_assignee || null,
        report_completed: reportData.report_completed || 'N',
      });"""
if old_record in text:
    text = text.replace(old_record, new_record)
    print("[2-4] recordSendHistory に body 引数追加 ✓")
else:
    print("[2-4] recordSendHistory: 対象が見つかりません")

# 2-5. handleTemplateSelect でキャッシュ使用時に body を渡す
old_cached = """      window.open(gmailUrl, '_blank');
      // 送信後に履歴を記録
      recordSendHistory(template.name, cached.subject);
      return;"""
new_cached = """      window.open(gmailUrl, '_blank');
      // 送信後に履歴を記録
      recordSendHistory(template.name, cached.subject, cached.body);
      return;"""
if old_cached in text:
    text = text.replace(old_cached, new_cached)
    print("[2-5] キャッシュ使用時に body を渡す ✓")
else:
    print("[2-5] キャッシュ使用時: 対象が見つかりません")

# 2-6. handleTemplateSelect でマージ後に body を渡す
old_merge = """      window.open(gmailUrl, '_blank');
      recordSendHistory(template.name, mergedSubject || template.subject);"""
new_merge = """      window.open(gmailUrl, '_blank');
      recordSendHistory(template.name, mergedSubject || template.subject, mergedBody || template.body);"""
if old_merge in text:
    text = text.replace(old_merge, new_merge)
    print("[2-6] マージ後に body を渡す ✓")
else:
    print("[2-6] マージ後: 対象が見つかりません")

# 2-7. 送信履歴テーブルの行をクリック可能にし、前回メール内容セクションを追加
# TableRow をクリック可能に変更
old_tablerow = """                {reportHistory.map((h) => (
                  <TableRow key={h.id}>
                    <TableCell>
                      {new Date(h.sent_at).toLocaleString('ja-JP', {
                        month: '2-digit',
                        day: '2-digit',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </TableCell>
                    <TableCell>{h.template_name || '-'}</TableCell>
                    <TableCell>{h.report_assignee ? getFullName(h.report_assignee) : '-'}</TableCell>
                    <TableCell>
                      <Chip
                        label={h.report_completed === 'Y' ? '完了' : '未完了'}
                        size="small"
                        color={h.report_completed === 'Y' ? 'success' : 'default'}
                      />
                    </TableCell>
                  </TableRow>
                ))}"""
new_tablerow = """                {reportHistory.map((h) => (
                  <TableRow
                    key={h.id}
                    hover
                    onClick={() => { setSelectedHistory(h); setHistoryDialogOpen(true); }}
                    sx={{ cursor: 'pointer' }}
                  >
                    <TableCell>
                      {new Date(h.sent_at).toLocaleString('ja-JP', {
                        month: '2-digit',
                        day: '2-digit',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </TableCell>
                    <TableCell>{h.template_name || '-'}</TableCell>
                    <TableCell>{h.report_assignee ? getFullName(h.report_assignee) : '-'}</TableCell>
                    <TableCell>
                      <Chip
                        label={h.report_completed === 'Y' ? '完了' : '未完了'}
                        size="small"
                        color={h.report_completed === 'Y' ? 'success' : 'default'}
                      />
                    </TableCell>
                  </TableRow>
                ))}"""
if old_tablerow in text:
    text = text.replace(old_tablerow, new_tablerow)
    print("[2-7] TableRow クリック可能に変更 ✓")
else:
    print("[2-7] TableRow: 対象が見つかりません")

# 2-8. 送信履歴Paperの後に「前回メール内容」セクションを追加
old_after_history = """      {/* テンプレート選択ダイアログ */}"""
new_after_history = """      {/* 前回メール内容 */}
      {reportHistory.length > 0 && reportHistory[0].body && (
        <Paper sx={{ p: 3, mt: 3 }}>
          <Typography variant="h6" fontWeight="bold" sx={{ mb: 1, color: SECTION_COLORS.property.main }}>
            前回メール内容
          </Typography>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
            {new Date(reportHistory[0].sent_at).toLocaleString('ja-JP', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}
            　{reportHistory[0].template_name || ''}
          </Typography>
          {reportHistory[0].subject && (
            <Typography variant="body2" fontWeight="bold" sx={{ mb: 1 }}>
              件名: {reportHistory[0].subject}
            </Typography>
          )}
          <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', fontSize: '0.8rem', color: 'text.secondary', maxHeight: 200, overflow: 'auto', bgcolor: '#f9f9f9', p: 1.5, borderRadius: 1 }}>
            {reportHistory[0].body}
          </Typography>
        </Paper>
      )}

      {/* テンプレート選択ダイアログ */}"""
if old_after_history in text:
    text = text.replace(old_after_history, new_after_history)
    print("[2-8] 前回メール内容セクション追加 ✓")
else:
    print("[2-8] 前回メール内容: 対象が見つかりません")

# 2-9. 送信履歴詳細ダイアログを追加（Snackbarの前）
old_snackbar = """      <Snackbar
        open={snackbar.open}"""
new_snackbar = """      {/* 送信履歴詳細ダイアログ */}
      <Dialog open={historyDialogOpen} onClose={() => setHistoryDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>
          送信履歴の詳細
          {selectedHistory && (
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
              {new Date(selectedHistory.sent_at).toLocaleString('ja-JP')}　{selectedHistory.template_name || ''}
            </Typography>
          )}
        </DialogTitle>
        <DialogContent dividers>
          {selectedHistory?.subject && (
            <Box sx={{ mb: 2 }}>
              <Typography variant="body2" color="text.secondary" fontWeight="bold" gutterBottom>件名</Typography>
              <Typography variant="body2">{selectedHistory.subject}</Typography>
            </Box>
          )}
          {selectedHistory?.body ? (
            <Box>
              <Typography variant="body2" color="text.secondary" fontWeight="bold" gutterBottom>本文</Typography>
              <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', fontSize: '0.85rem', bgcolor: '#f9f9f9', p: 1.5, borderRadius: 1 }}>
                {selectedHistory.body}
              </Typography>
            </Box>
          ) : (
            <Typography variant="body2" color="text.secondary">本文データがありません</Typography>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setHistoryDialogOpen(false)}>閉じる</Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={snackbar.open}"""
if old_snackbar in text:
    text = text.replace(old_snackbar, new_snackbar)
    print("[2-9] 送信履歴詳細ダイアログ追加 ✓")
else:
    print("[2-9] 送信履歴詳細ダイアログ: 対象が見つかりません")

with open(frontend_path, 'wb') as f:
    f.write(text.encode('utf-8'))

print("\n全修正完了")
