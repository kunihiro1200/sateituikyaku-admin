#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
物件概要セクションに「公開日」フィールドを追加するスクリプト
- 表示モード: formatDisplayDate(data.distribution_date) で YYYY/MM/DD 形式表示
- 編集モード: type="date" の TextField で distribution_date を編集
"""

with open('frontend/frontend/src/pages/PropertyListingDetailPage.tsx', 'rb') as f:
    content = f.read()

text = content.decode('utf-8')

# 担当フィールドの後（</Grid> の後）に公開日フィールドを追加
# 担当フィールドの終わりを特定するための文字列
old_str = '''          <Grid item xs={6} sm={4} md={2}>
            <Typography variant="caption" color="text.secondary" fontWeight="bold" sx={{ fontSize: '0.75rem', lineHeight: 1.2 }}>担当</Typography>
            {isHeaderEditMode ? (
              <TextField
                size="small"
                fullWidth
                value={editedData.sales_assignee !== undefined ? editedData.sales_assignee : (data.sales_assignee || '')}
                onChange={(e) => handleFieldChange('sales_assignee', e.target.value)}
                sx={{ mt: 0.5 }}
              />
            ) : (
              <Typography variant="body2" fontWeight="medium" sx={{ fontSize: '0.9rem' }}>
                {data.sales_assignee || '-'}
              </Typography>
            )}
          </Grid>
        </Grid>
      </Paper>'''

new_str = '''          <Grid item xs={6} sm={4} md={2}>
            <Typography variant="caption" color="text.secondary" fontWeight="bold" sx={{ fontSize: '0.75rem', lineHeight: 1.2 }}>担当</Typography>
            {isHeaderEditMode ? (
              <TextField
                size="small"
                fullWidth
                value={editedData.sales_assignee !== undefined ? editedData.sales_assignee : (data.sales_assignee || '')}
                onChange={(e) => handleFieldChange('sales_assignee', e.target.value)}
                sx={{ mt: 0.5 }}
              />
            ) : (
              <Typography variant="body2" fontWeight="medium" sx={{ fontSize: '0.9rem' }}>
                {data.sales_assignee || '-'}
              </Typography>
            )}
          </Grid>
          <Grid item xs={6} sm={4} md={2}>
            <Typography variant="caption" color="text.secondary" fontWeight="bold" sx={{ fontSize: '0.75rem', lineHeight: 1.2 }}>公開日</Typography>
            {isHeaderEditMode ? (
              <TextField
                size="small"
                fullWidth
                type="date"
                value={editedData.distribution_date !== undefined ? editedData.distribution_date : (data.distribution_date || '')}
                onChange={(e) => handleFieldChange('distribution_date', e.target.value)}
                sx={{ mt: 0.5 }}
                InputLabelProps={{ shrink: true }}
              />
            ) : (
              <Typography variant="body2" fontWeight="medium" sx={{ fontSize: '0.9rem' }}>
                {formatDisplayDate(data.distribution_date)}
              </Typography>
            )}
          </Grid>
        </Grid>
      </Paper>'''

if old_str in text:
    text = text.replace(old_str, new_str)
    print('✅ 公開日フィールドを追加しました')
else:
    print('❌ 対象文字列が見つかりませんでした')
    # デバッグ用: 担当フィールド周辺を確認
    idx = text.find('担当</Typography>')
    if idx >= 0:
        print(f'担当フィールドは {idx} 文字目に見つかりました')
        print(repr(text[idx-200:idx+400]))
    else:
        print('担当フィールドも見つかりません')

# UTF-8 (BOMなし) で書き込む
with open('frontend/frontend/src/pages/PropertyListingDetailPage.tsx', 'wb') as f:
    f.write(text.encode('utf-8'))

print('Done!')
