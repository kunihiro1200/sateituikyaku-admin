#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
契約決済タブの「社員が契約書作成」の下に売買契約確認フィールドを追加
"""
import sys

FILE_PATH = 'frontend/frontend/src/components/WorkTaskDetailModal.tsx'

with open(FILE_PATH, 'rb') as f:
    content = f.read()

text = content.decode('utf-8')

# 「社員が契約書作成」の直後、「製本予定日」の前に挿入
OLD = '''          <EditableButtonSelect label="社員が契約書作成" field="employee_contract_creation" options={normalInitials} />
          <EditableField label="製本予定日" field="binding_scheduled_date" type="date" />
          <EditableField label="製本完了" field="binding_completed" />
        </Box>
      </Box>

      {/* 右ペイン: 決済詳細 */}'''

NEW = '''          <EditableButtonSelect label="社員が契約書作成" field="employee_contract_creation" options={normalInitials} />

          {/* 売買契約確認（スプシAM列と同期） */}
          <EditableButtonSelect label="売買契約確認" field="sales_contract_confirmed" options={['確認中', '確認OK']} />

          {/* 確認OKの場合のみ表示 */}
          {getValue('sales_contract_confirmed') === '確認OK' && (
            <Box sx={{ bgcolor: '#fff8e1', borderRadius: 1, p: 1.5, mb: 1 }}>
              {/* 契約書、重説他　修正点（必須） */}
              <Grid container spacing={2} alignItems="center" sx={{ mb: 1.5 }}>
                <Grid item xs={4}>
                  <Typography variant="body2" color="error" sx={{ fontWeight: 700 }}>
                    契約書、重説他　修正点*（必須）
                  </Typography>
                </Grid>
                <Grid item xs={8}>
                  <ButtonGroup size="small" variant="outlined">
                    {['あり', 'なし'].map((opt) => (
                      <Button
                        key={opt}
                        variant={getValue('contract_revision_exists') === opt ? 'contained' : 'outlined'}
                        color={getValue('contract_revision_exists') === opt ? (opt === 'あり' ? 'error' : 'success') : 'inherit'}
                        onClick={(e) => { (e.currentTarget as HTMLButtonElement).blur(); handleFieldChange('contract_revision_exists', getValue('contract_revision_exists') === opt ? null : opt); }}
                      >
                        {opt}
                      </Button>
                    ))}
                  </ButtonGroup>
                  {!getValue('contract_revision_exists') && (
                    <Typography variant="caption" color="error" sx={{ display: 'block', mt: 0.5 }}>
                      必須項目です
                    </Typography>
                  )}
                </Grid>
              </Grid>

              {/* 「あり」の場合のみ修正内容を表示（必須） */}
              {getValue('contract_revision_exists') === 'あり' && (
                <Grid container spacing={2} alignItems="flex-start" sx={{ mb: 1.5 }}>
                  <Grid item xs={4}>
                    <Typography variant="body2" color="error" sx={{ fontWeight: 700 }}>
                      契約書、重説他の修正内容*（必須）
                    </Typography>
                  </Grid>
                  <Grid item xs={8}>
                    <TextField
                      fullWidth
                      multiline
                      minRows={4}
                      size="small"
                      value={getValue('contract_revision_content') || ''}
                      onChange={(e) => handleFieldChange('contract_revision_content', e.target.value)}
                      placeholder="修正内容を入力してください"
                      error={!getValue('contract_revision_content')}
                      helperText={!getValue('contract_revision_content') ? '必須項目です' : ''}
                    />
                  </Grid>
                </Grid>
              )}
            </Box>
          )}

          <EditableField label="製本予定日" field="binding_scheduled_date" type="date" />
          <EditableField label="製本完了" field="binding_completed" />
        </Box>
      </Box>

      {/* 右ペイン: 決済詳細 */}'''

if OLD not in text:
    print('ERROR: 挿入箇所が見つかりません')
    sys.exit(1)

text = text.replace(OLD, NEW, 1)
print('✅ 契約決済タブに売買契約確認フィールドを追加しました')

with open(FILE_PATH, 'wb') as f:
    f.write(text.encode('utf-8'))

with open(FILE_PATH, 'rb') as f:
    head = f.read(3)
if head == b'\xef\xbb\xbf':
    print('WARNING: BOM付き')
else:
    print('✅ BOMなしUTF-8で書き込み完了')

print('完了！')
