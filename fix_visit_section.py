with open('frontend/frontend/src/pages/NewSellerPage.tsx', 'rb') as f:
    content = f.read()

text = content.decode('utf-8')

# 1. importにgetActiveEmployees, Employee, CalendarTodayを追加
old_import = "import api from '../services/api';\nimport RichTextCommentEditor, { RichTextCommentEditorHandle } from '../components/RichTextCommentEditor';\nimport { useRef } from 'react';"
new_import = "import api from '../services/api';\nimport RichTextCommentEditor, { RichTextCommentEditorHandle } from '../components/RichTextCommentEditor';\nimport { useRef, useEffect } from 'react';\nimport { getActiveEmployees, Employee } from '../services/employeeService';"
if old_import in text:
    text = text.replace(old_import, new_import, 1)
    print('OK: import')
else:
    print('ERROR: import not found')

# CalendarTodayをMUIアイコンに追加
old_icon = "import { \n  ArrowBack as ArrowBackIcon,\n} from '@mui/icons-material';"
new_icon = "import { \n  ArrowBack as ArrowBackIcon,\n  CalendarToday,\n} from '@mui/icons-material';"
if old_icon in text:
    text = text.replace(old_icon, new_icon, 1)
    print('OK: icon')
else:
    print('ERROR: icon not found')

# 2. employees stateを追加（sellerCopyLoading stateの後）
old_state = "  const [sellerCopyLoading, setSellerCopyLoading] = useState(false);\n\n  // コメント"
new_state = "  const [sellerCopyLoading, setSellerCopyLoading] = useState(false);\n\n  // 社員リスト\n  const [employees, setEmployees] = useState<Employee[]>([]);\n\n  // コメント"
if old_state in text:
    text = text.replace(old_state, new_state, 1)
    print('OK: employees state')
else:
    print('ERROR: employees state not found')

# 3. useEffectで社員リストを取得（売主番号取得のuseEffectの後）
old_effect = "  // 売主コピー検索ハンドラ"
new_effect = """  // 社員リストを取得
  useEffect(() => {
    getActiveEmployees().then(setEmployees).catch(console.error);
  }, []);

  // 売主コピー検索ハンドラ"""
if old_effect in text:
    text = text.replace(old_effect, new_effect, 1)
    print('OK: useEffect')
else:
    print('ERROR: useEffect not found')

# 4. 訪問査定情報セクションの営担フィールドをプルダウンに変更し、カレンダーボタンを追加
old_visit_section = """              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="営担"
                  value={visitAssignee}
                  onChange={(e) => setVisitAssignee(e.target.value)}
                />
              </Grid>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  multiline
                  rows={3}
                  label="訪問時注意点"
                  value={visitNotes}
                  onChange={(e) => setVisitNotes(e.target.value)}
                />
              </Grid>
            </Grid>
          </Paper>"""

new_visit_section = """              <Grid item xs={12} sm={6}>
                <FormControl fullWidth>
                  <InputLabel>営担</InputLabel>
                  <Select
                    value={visitAssignee}
                    label="営担"
                    onChange={(e) => setVisitAssignee(e.target.value)}
                  >
                    <MenuItem value=""><em>未選択</em></MenuItem>
                    {employees.map((emp) => {
                      const initials = (emp as any).initials || emp.name || emp.email;
                      return (
                        <MenuItem key={(emp as any).id} value={initials}>
                          {emp.name} ({initials})
                        </MenuItem>
                      );
                    })}
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  multiline
                  rows={3}
                  label="訪問時注意点"
                  value={visitNotes}
                  onChange={(e) => setVisitNotes(e.target.value)}
                />
              </Grid>
              {visitDate && visitAssignee && (
                <Grid item xs={12}>
                  <Button
                    variant="outlined"
                    startIcon={<CalendarToday />}
                    onClick={() => {
                      const dateStr = visitDate;
                      const timeStr = visitTime || '10:00';
                      const dateTimeStr = `${dateStr}T${timeStr}:00`;
                      const date = new Date(dateTimeStr);
                      const startDateStr = date.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
                      const endDate = new Date(date.getTime() + 60 * 60 * 1000);
                      const endDateStr = endDate.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
                      const propertyAddr = propertyAddress || '物件所在地未設定';
                      const title = encodeURIComponent(`【訪問】${propertyAddr}`);
                      const details = encodeURIComponent(
                        `売主名: ${name}\\n` +
                        `住所: ${requestorAddress || propertyAddr}\\n` +
                        `電話: ${phoneNumber}\\n` +
                        `\\n訪問時注意点: ${visitNotes || 'なし'}`
                      );
                      const location = encodeURIComponent(propertyAddr);
                      const assignedEmployee = employees.find(e =>
                        (e as any).initials === visitAssignee || e.name === visitAssignee
                      );
                      const assignedEmail = (assignedEmployee as any)?.email || '';
                      const srcParam = assignedEmail ? `&src=${encodeURIComponent(assignedEmail)}` : '';
                      window.open(`https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&dates=${startDateStr}/${endDateStr}&details=${details}&location=${location}${srcParam}`, '_blank');
                    }}
                  >
                    📅 Googleカレンダーに送信
                  </Button>
                </Grid>
              )}
            </Grid>
          </Paper>"""

if old_visit_section in text:
    text = text.replace(old_visit_section, new_visit_section, 1)
    print('OK: visit section')
else:
    print('ERROR: visit section not found')

with open('frontend/frontend/src/pages/NewSellerPage.tsx', 'wb') as f:
    f.write(text.encode('utf-8'))

print('Done!')
