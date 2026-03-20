#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""AssigneeSectionを右カラム（overflow:auto）の一番下に移動"""

with open('frontend/frontend/src/pages/CallModePage.tsx', 'rb') as f:
    content = f.read()

text = content.decode('utf-8').replace('\r\n', '\n')

# 現在の位置（外側Box外）から削除
old_outside = """      {/* 担当者設定セクション（全幅） */}
      {seller && (
        <Box sx={{ mt: 2, px: 3 }}>
          <AssigneeSection
            seller={seller}
            onUpdate={(fields) => setSeller((prev) => prev ? { ...prev, ...fields } : prev)}
          />
        </Box>
      )}"""

# 実績セクションの直後（右カラムの </Grid> の直前）に移動
old_end = """            {/* 実績セクション */}
            <CollapsibleSection title="実績" defaultExpanded={false} headerColor="success.light">
              <PerformanceMetricsSection />
            </CollapsibleSection>
          </Grid>
        </Grid>
      </Box>
      </Box>"""

new_end = """            {/* 実績セクション */}
            <CollapsibleSection title="実績" defaultExpanded={false} headerColor="success.light">
              <PerformanceMetricsSection />
            </CollapsibleSection>

            {/* 担当者設定セクション */}
            {seller && (
              <Box sx={{ mt: 2 }}>
                <AssigneeSection
                  seller={seller}
                  onUpdate={(fields) => setSeller((prev) => prev ? { ...prev, ...fields } : prev)}
                />
              </Box>
            )}
          </Grid>
        </Grid>
      </Box>
      </Box>"""

if old_outside not in text:
    print('❌ 削除対象が見つかりません')
    import sys; sys.exit(1)

if old_end not in text:
    print('❌ 挿入対象が見つかりません')
    import sys; sys.exit(1)

# まず外側から削除
text = text.replace(old_outside, '')
# 次に右カラムの末尾に挿入
text = text.replace(old_end, new_end)

print('✅ AssigneeSectionを右カラムの末尾に移動しました')

with open('frontend/frontend/src/pages/CallModePage.tsx', 'wb') as f:
    f.write(text.encode('utf-8'))

print('✅ 書き込み完了')
