"""
AssigneeSectionを右カラムのGrid itemの終端直前に移動するスクリプト
"""

with open('frontend/frontend/src/pages/CallModePage.tsx', 'rb') as f:
    content = f.read()

text = content.decode('utf-8')

# 改行コードを正規化
text = text.replace('\r\n', '\n')

# 現在の「担当者設定セクション（全幅）」ブロックを削除
old_block = '''
        {/* 担当者設定セクション（全幅） */}
        {seller && (
          <Box sx={{ mt: 2 }}>
            <AssigneeSection
              seller={seller}
              onUpdate={(fields) => setSeller((prev) => prev ? { ...prev, ...fields } : prev)}
            />
          </Box>
        )}'''

# 右カラムの終端直前に挿入するコード
new_assignee_jsx = '''
            {/* 担当者設定セクション */}
            {seller && (
              <Box sx={{ mt: 2 }}>
                <AssigneeSection
                  seller={seller}
                  onUpdate={(fields) => setSeller((prev) => prev ? { ...prev, ...fields } : prev)}
                />
              </Box>
            )}'''

# 右カラムの終端マーカー（実績セクションの後）
right_col_end_marker = '''            </CollapsibleSection>
          </Grid>
        </Grid>'''

right_col_end_replacement = '''            </CollapsibleSection>
''' + new_assignee_jsx + '''
          </Grid>
        </Grid>'''

# まず全幅ブロックを削除
if old_block in text:
    text = text.replace(old_block, '', 1)
    print('✅ 全幅AssigneeSectionブロックを削除しました')
else:
    print('⚠️ 全幅AssigneeSectionブロックが見つかりません。手動確認が必要です。')
    # 現在のAssigneeSectionの位置を確認
    lines = text.split('\n')
    for i, line in enumerate(lines):
        if 'AssigneeSection' in line:
            print(f'  Line {i+1}: {line}')

# 右カラム終端に挿入
if right_col_end_marker in text:
    text = text.replace(right_col_end_marker, right_col_end_replacement, 1)
    print('✅ 右カラム終端にAssigneeSectionを挿入しました')
else:
    print('⚠️ 右カラム終端マーカーが見つかりません')
    # デバッグ: 実績セクション周辺を確認
    lines = text.split('\n')
    for i, line in enumerate(lines):
        if 'PerformanceMetricsSection' in line or '実績' in line:
            print(f'  Line {i+1}: {line}')

# UTF-8で書き込む
with open('frontend/frontend/src/pages/CallModePage.tsx', 'wb') as f:
    f.write(text.encode('utf-8'))

print('✅ ファイルを保存しました')

# 確認
with open('frontend/frontend/src/pages/CallModePage.tsx', 'rb') as f:
    verify = f.read().decode('utf-8')

lines = verify.split('\n')
print('\n--- AssigneeSectionの配置確認 ---')
for i, line in enumerate(lines):
    if 'AssigneeSection' in line:
        print(f'Line {i+1}: {line}')
