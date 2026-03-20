#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""AssigneeSectionを overflow:hidden の外側Boxの外に移動"""

with open('frontend/frontend/src/pages/CallModePage.tsx', 'rb') as f:
    content = f.read()

text = content.decode('utf-8')

# \r\n を \n に正規化して処理
text_normalized = text.replace('\r\n', '\n')

old = """          </Grid>
        </Grid>

        {/* 担当者設定セクション（全幅） */}
        {seller && (
          <Box sx={{ mt: 2 }}>
            <AssigneeSection
              seller={seller}
              onUpdate={(fields) => setSeller((prev) => prev ? { ...prev, ...fields } : prev)}
            />
          </Box>
        )}
      </Box>
      </Box>"""

new = """          </Grid>
        </Grid>
      </Box>
      </Box>

      {/* 担当者設定セクション（全幅） */}
      {seller && (
        <Box sx={{ mt: 2, px: 3 }}>
          <AssigneeSection
            seller={seller}
            onUpdate={(fields) => setSeller((prev) => prev ? { ...prev, ...fields } : prev)}
          />
        </Box>
      )}"""

if old in text_normalized:
    text_normalized = text_normalized.replace(old, new)
    print('✅ AssigneeSectionを外側Boxの外に移動しました')
else:
    print('❌ 対象文字列が見つかりません')
    idx = text_normalized.find('担当者設定セクション（全幅）')
    if idx >= 0:
        print('現在の配置:')
        print(repr(text_normalized[idx-100:idx+400]))
    import sys
    sys.exit(1)

# \r\n に戻す（元のファイルに合わせる）
result = text_normalized.replace('\n', '\r\n')

with open('frontend/frontend/src/pages/CallModePage.tsx', 'wb') as f:
    f.write(result.encode('utf-8'))

print('✅ 書き込み完了')
