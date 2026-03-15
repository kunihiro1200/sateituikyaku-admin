# BuyerDetailPage.tsx のフィールドキーをセクション名込みに変更するスクリプト
# latest_status が複数セクションに存在するため、Reactキーの重複を防ぐ

with open('frontend/frontend/src/pages/BuyerDetailPage.tsx', 'rb') as f:
    content = f.read()

text = content.decode('utf-8')

# BUYER_FIELD_SECTIONS.map の key を section.title + field.key に変更
old_str = "                {section.fields.map((field: any) => {"
new_str = "                {section.fields.map((field: any, fieldIndex: number) => {"

if old_str in text:
    text = text.replace(old_str, new_str, 1)
    print('✅ fieldIndex を追加しました')
else:
    print('❌ 対象文字列が見つかりませんでした（fieldIndex）')

# Grid item の key を section.title + field.key に変更（全箇所）
# key={field.key} → key={`${section.title}-${field.key}`}
# ただし section は外側のスコープにあるので、fieldIndex を使う方が安全
# 実際には section.title + field.key で一意になるので、それを使う

# 全ての key={field.key} を key={`${section.title}-${field.key}`} に変更
import re

# Grid item の key={field.key} を置換
text = re.sub(
    r'(<Grid item \{\.\.\.gridSize\} key=\{)field\.key(\}>)',
    r'\1`${section.title}-${field.key}`\2',
    text
)

count = text.count('`${section.title}-${field.key}`')
print(f'✅ Grid item key を {count} 箇所変更しました')

with open('frontend/frontend/src/pages/BuyerDetailPage.tsx', 'wb') as f:
    f.write(text.encode('utf-8'))

print('✅ ファイルを保存しました')
