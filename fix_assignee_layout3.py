            minWidth: '44px',
                    flex: '0 0 auto',
                    bgcolor: currentValue === '不要' ? undefined : 'grey.100',
                    borderColor: 'grey.300',
                  }}"""

if old_fuyou_btn in text:
    text = text.replace(old_fuyou_btn, new_fuyou_btn)
    print('✅ 不要ボタンのスタイルを更新しました')
else:
    print('❌ 不要ボタンのスタイルが見つかりません')

with open(filepath, 'wb') as f:
    f.write(text.encode('utf-8'))

print('✅ 完了')
  text = text.replace(old_initial_btn, new_initial_btn)
    print('✅ イニシャルボタンのスタイルを更新しました')
else:
    print('❌ イニシャルボタンのスタイルが見つかりません')

old_fuyou_btn = """                  sx={{
                    py: 0.75,
                    fontSize: '0.85rem',
                    bgcolor: currentValue === '不要' ? undefined : 'grey.100',
                    borderColor: 'grey.300',
                  }}"""

new_fuyou_btn = """                  sx={{
                    py: 0.75,
                    fontSize: '0.85rem',
        rem',
                      minWidth: '44px',
                      flex: '0 0 auto',
                      bgcolor: currentValue === initial ? undefined : 'grey.100',
                      borderColor: 'grey.300',
                    }}"""

if old_initial_btn in text:
  d("display: 'grid'")
    if idx >= 0:
        print(repr(text[idx-100:idx+200]))

# ボタンのスタイルにminWidthとflexShrinkを追加（均等幅）
old_initial_btn = """                    sx={{
                      py: 0.75,
                      fontSize: '0.85rem',
                      bgcolor: currentValue === initial ? undefined : 'grey.100',
                      borderColor: 'grey.300',
                    }}"""

new_initial_btn = """                    sx={{
                      py: 0.75,
                      fontSize: '0.85       width: '100%',
                }}
              >"""

if old_box in text:
    text = text.replace(old_box, new_box)
    print('✅ ボタンコンテナをflexWrapに変更しました')
else:
    print('❌ ボタンコンテナが見つかりません')
    print('--- 現在のgrid部分を検索 ---')
    idx = text.finath, 'rb') as f:
    content = f.read()

text = content.decode('utf-8')

# ボタン群のBoxコンテナを修正: gridからflexWrapに変更し、全幅を確保
old_box = """              <Box
                sx={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(52px, 1fr))',
                  gap: 0.5,
                }}
              >"""

new_box = """              <Box
                sx={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: 0.5,
           import re

filepath = 'frontend/frontend/src/components/AssigneeSection.tsx'

with open(filep