#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
契約書修正内容テキストエリアを defaultValue + onBlur パターンに変更
（インラインコンポーネント再マウント問題の回避）
"""
import sys

FILE_PATH = 'frontend/frontend/src/components/WorkTaskDetailModal.tsx'

with open(FILE_PATH, 'rb') as f:
    content = f.read()

text = content.decode('utf-8')

# controlled TextField を uncontrolled (defaultValue + onBlur) に変更
OLD_FIELD = '''              {/* 「あり」の場合のみ修正内容を表示（必須） */}
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
              )}'''

NEW_FIELD = '''              {/* 「あり」の場合のみ修正内容を表示（必須） */}
              {getValue('contract_revision_exists') === 'あり' && (
                <Grid container spacing={2} alignItems="flex-start" sx={{ mb: 1.5 }}>
                  <Grid item xs={4}>
                    <Typography variant="body2" color="error" sx={{ fontWeight: 700 }}>
                      契約書、重説他の修正内容*（必須）
                    </Typography>
                  </Grid>
                  <Grid item xs={8}>
                    <TextField
                      key={`contract_revision_content_${propertyNumber}`}
                      fullWidth
                      multiline
                      minRows={4}
                      size="small"
                      defaultValue={getValue('contract_revision_content') || ''}
                      onBlur={(e) => {
                        if (e.target.value !== (getValue('contract_revision_content') || '')) {
                          handleFieldChange('contract_revision_content', e.target.value);
                        }
                      }}
                      placeholder="修正内容を入力してください"
                      error={!getValue('contract_revision_content')}
                      helperText={!getValue('contract_revision_content') ? '必須項目です' : ''}
                    />
                  </Grid>
                </Grid>
              )}'''

if OLD_FIELD not in text:
    print('ERROR: テキストフィールドの置き換え箇所が見つかりません')
    sys.exit(1)

text = text.replace(OLD_FIELD, NEW_FIELD, 1)
print('✅ テキストフィールドをdefaultValue+onBlurパターンに変更しました')

with open(FILE_PATH, 'wb') as f:
    f.write(text.encode('utf-8'))

with open(FILE_PATH, 'rb') as f:
    head = f.read(3)
print('✅ BOMなしUTF-8' if head != b'\xef\xbb\xbf' else 'WARNING: BOM付き')
print('完了！')
