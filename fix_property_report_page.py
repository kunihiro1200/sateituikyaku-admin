#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
PropertyReportPage.tsx の変更:
- タスク2.1: 送信履歴テーブルを5行固定表示に変更
- タスク4.1: 買主データ取得ロジックを追加
- タスク4.3: CompactBuyerListForProperty を追加
"""

with open('frontend/frontend/src/pages/PropertyReportPage.tsx', 'rb') as f:
    content = f.read()

text = content.decode('utf-8')

# ===== タスク4.1 & 4.3: インポートに CompactBuyerListForProperty を追加 =====
old_import = "import ImageSelectorModal from '../components/ImageSelectorModal';"
new_import = """import ImageSelectorModal from '../components/ImageSelectorModal';
import CompactBuyerListForProperty from '../components/CompactBuyerListForProperty';"""

text = text.replace(old_import, new_import, 1)

# ===== タスク4.1: buyers / buyersLoading ステートを追加 =====
old_state = """  const [snackbar, setSnackbar] = useState<{
    open: boolean;
    message: string;
    severity: 'success' | 'error';
  }>({ open: false, message: '', severity: 'success' });"""

new_state = """  const [buyers, setBuyers] = useState<any[]>([]);
  const [buyersLoading, setBuyersLoading] = useState(false);
  const [snackbar, setSnackbar] = useState<{
    open: boolean;
    message: string;
    severity: 'success' | 'error';
  }>({ open: false, message: '', severity: 'success' });"""

text = text.replace(old_state, new_state, 1)

# ===== タスク4.1: useEffect に fetchBuyers() を追加 =====
old_effect = """  useEffect(() => {
    if (propertyNumber) {
      fetchData();
      fetchJimuInitials();
      fetchJimuStaff();
      fetchTemplates();
      fetchReportHistory();
    }
  }, [propertyNumber]);"""

new_effect = """  useEffect(() => {
    if (propertyNumber) {
      fetchData();
      fetchJimuInitials();
      fetchJimuStaff();
      fetchTemplates();
      fetchReportHistory();
      fetchBuyers();
    }
  }, [propertyNumber]);"""

text = text.replace(old_effect, new_effect, 1)

# ===== タスク4.1: fetchBuyers 関数を追加（fetchReportHistory の後） =====
old_fetch_history = """  const fetchReportHistory = async () => {
    if (!propertyNumber) return;
    try {
      const response = await api.get(`/api/property-listings/${propertyNumber}/report-history`);
      setReportHistory(response.data || []);
    } catch (error) {
      // 報告履歴が取得できない場合は空のまま（エラー表示しない）
      setReportHistory([]);
    }
  };"""

new_fetch_history = """  const fetchReportHistory = async () => {
    if (!propertyNumber) return;
    try {
      const response = await api.get(`/api/property-listings/${propertyNumber}/report-history`);
      setReportHistory(response.data || []);
    } catch (error) {
      // 報告履歴が取得できない場合は空のまま（エラー表示しない）
      setReportHistory([]);
    }
  };

  const fetchBuyers = async () => {
    if (!propertyNumber) return;
    setBuyersLoading(true);
    try {
      const response = await api.get(`/api/property-listings/${propertyNumber}/buyers`);
      setBuyers(response.data || []);
    } catch (error) {
      // エラーは無視して空リストを表示（要件2.5）
      setBuyers([]);
    } finally {
      setBuyersLoading(false);
    }
  };"""

text = text.replace(old_fetch_history, new_fetch_history, 1)

# ===== タスク2.1: 送信履歴テーブルを5行固定表示に変更 =====
old_history_table = """          {/* 送信履歴 */}
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" fontWeight="bold" sx={{ mb: 2, color: SECTION_COLORS.property.main }}>
              送信履歴
            </Typography>
            {reportHistory.length === 0 ? (
              <Typography variant="body2" color="text.secondary">
                送信履歴はありません
              </Typography>
            ) : (
              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 'bold' }}>送信日時</TableCell>
                      <TableCell sx={{ fontWeight: 'bold' }}>テンプレート</TableCell>
                      <TableCell sx={{ fontWeight: 'bold' }}>担当</TableCell>
                      <TableCell sx={{ fontWeight: 'bold' }}>完了</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {reportHistory.map((h) => (
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
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            )}
          </Paper>"""

new_history_table = """          {/* 送信履歴（5行固定表示） */}
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" fontWeight="bold" sx={{ mb: 2, color: SECTION_COLORS.property.main }}>
              送信履歴
            </Typography>
            <TableContainer sx={{ maxHeight: 220, overflow: 'auto' }}>
              <Table size="small" stickyHeader>
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 'bold' }}>送信日時</TableCell>
                    <TableCell sx={{ fontWeight: 'bold' }}>テンプレート</TableCell>
                    <TableCell sx={{ fontWeight: 'bold' }}>担当</TableCell>
                    <TableCell sx={{ fontWeight: 'bold' }}>完了</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {getDisplayRows(reportHistory).map((h, index) =>
                    h === null ? (
                      <TableRow key={`empty-${index}`} sx={{ cursor: 'default' }}>
                        <TableCell>-</TableCell>
                        <TableCell>-</TableCell>
                        <TableCell>-</TableCell>
                        <TableCell>-</TableCell>
                      </TableRow>
                    ) : (
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
                    )
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          </Paper>"""

text = text.replace(old_history_table, new_history_table, 1)

# ===== タスク4.3: CompactBuyerListForProperty を前回メール内容の下に追加 =====
old_last_mail = """          {/* 前回メール内容 */}
          {reportHistory.length > 0 && reportHistory[0].body && (
            <Paper sx={{ p: 3 }}>
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
              <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', fontSize: '0.8rem', color: 'text.secondary', maxHeight: 300, overflow: 'auto', bgcolor: '#f9f9f9', p: 1.5, borderRadius: 1 }}>
                {reportHistory[0].body}
              </Typography>
            </Paper>
          )}
        </Box>
      </Box>"""

new_last_mail = """          {/* 前回メール内容 */}
          {reportHistory.length > 0 && reportHistory[0].body && (
            <Paper sx={{ p: 3 }}>
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
              <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', fontSize: '0.8rem', color: 'text.secondary', maxHeight: 300, overflow: 'auto', bgcolor: '#f9f9f9', p: 1.5, borderRadius: 1 }}>
                {reportHistory[0].body}
              </Typography>
            </Paper>
          )}

          {/* 買主一覧 */}
          <CompactBuyerListForProperty
            buyers={buyers}
            propertyNumber={propertyNumber || ''}
            loading={buyersLoading}
          />
        </Box>
      </Box>"""

text = text.replace(old_last_mail, new_last_mail, 1)

# UTF-8 (BOMなし) で書き込む
with open('frontend/frontend/src/pages/PropertyReportPage.tsx', 'wb') as f:
    f.write(text.encode('utf-8'))

print('Done! PropertyReportPage.tsx を更新しました。')

# 変更確認
with open('frontend/frontend/src/pages/PropertyReportPage.tsx', 'rb') as f:
    result = f.read()
result_text = result.decode('utf-8')

checks = [
    ('CompactBuyerListForProperty インポート', "import CompactBuyerListForProperty from '../components/CompactBuyerListForProperty';"),
    ('buyers ステート', 'const [buyers, setBuyers] = useState<any[]>([]);'),
    ('buyersLoading ステート', 'const [buyersLoading, setBuyersLoading] = useState(false);'),
    ('fetchBuyers 呼び出し', 'fetchBuyers();'),
    ('fetchBuyers 関数', 'const fetchBuyers = async () => {'),
    ('getDisplayRows 使用', 'getDisplayRows(reportHistory)'),
    ('空行の表示', 'key={`empty-${index}`}'),
    ('CompactBuyerListForProperty 使用', '<CompactBuyerListForProperty'),
    ('送信履歴はありません 削除確認', '送信履歴はありません' not in result_text),
]

for name, check in checks:
    if isinstance(check, bool):
        status = '✅' if check else '❌'
        print(f'{status} {name}')
    else:
        status = '✅' if check in result_text else '❌'
        print(f'{status} {name}')
