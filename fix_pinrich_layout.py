import re

with open('frontend/frontend/src/pages/BuyerDetailPage.tsx', 'rb') as f:
    content = f.read()

text = content.decode('utf-8')

# 修正1: distribution_type と pinrich を横並び1行にする
# distribution_typeのGrid item xs={12} を xs={6} に変更し、pinrichも xs={6} に
# → BUYER_FIELD_SECTIONSのフィールド定義に gridSize ヒントを追加する方法ではなく、
#   レンダリング側で distribution_type の Grid を xs={6} にして、
#   pinrich の Grid も xs={6} にする

# distribution_typeのGrid item
old_dist = '''                    // distribution_typeフィールドは特別処理（必須・ボタン選択UI）
                    if (field.key === 'distribution_type') {
                      const isDistributionMissing = missingRequiredFields.has('distribution_type');
                      return (
                        <Grid item xs={12} key={`${section.title}-${field.key}`}>'''

new_dist = '''                    // distribution_typeフィールドは特別処理（必須・ボタン選択UI）
                    if (field.key === 'distribution_type') {
                      const isDistributionMissing = missingRequiredFields.has('distribution_type');
                      return (
                        <Grid item xs={12} sm={6} key={`${section.title}-${field.key}`}>'''

text = text.replace(old_dist, new_dist)

# pinrichのGrid item xs={12} を xs={12} sm={6} に
old_pinrich_grid = '''                        <Grid item xs={12} key={`${section.title}-${field.key}`}>
                          <FormControl fullWidth size="small">
                            <InputLabel>{field.label}</InputLabel>
                            <Select
                              value={buyer[field.key] || ''}
                              label={field.label}'''

new_pinrich_grid = '''                        <Grid item xs={12} sm={6} key={`${section.title}-${field.key}`}>
                          <FormControl fullWidth size="small">
                            <InputLabel>{field.label}</InputLabel>
                            <Select
                              value={buyer[field.key] || ''}
                              label={field.label}'''

text = text.replace(old_pinrich_grid, new_pinrich_grid)

# 修正2: pinrich_link が inlineEditable: false のため通常フィールドとして "-" 表示される問題を修正
# inlineEditable でない場合のフォールバック処理の前に pinrich_link チェックを追加
# → 現在 pinrich_link の特別処理は if (field.inlineEditable) ブロック内にある
# → inlineEditable: false なので、そのブロックに入らない
# → BUYER_FIELD_SECTIONS の定義を inlineEditable: true に変更する（リンクなので保存不要だが表示のため）
# → または、inlineEditable: false のフォールバック処理に pinrich_link チェックを追加する

# 方法: BUYER_FIELD_SECTIONSの pinrich_link を inlineEditable: true に変更
old_pinrich_link_def = "      { key: 'pinrich_link', label: 'Pinrichリンク', inlineEditable: false, fieldType: 'pinrichLink' },"
new_pinrich_link_def = "      { key: 'pinrich_link', label: 'Pinrichリンク', inlineEditable: true, fieldType: 'pinrichLink' },"

text = text.replace(old_pinrich_link_def, new_pinrich_link_def)

with open('frontend/frontend/src/pages/BuyerDetailPage.tsx', 'wb') as f:
    f.write(text.encode('utf-8'))

print('Done!')
print('Changes:')
print('1. distribution_type Grid: xs={12} -> xs={12} sm={6}')
print('2. pinrich Grid: xs={12} -> xs={12} sm={6}')
print('3. pinrich_link inlineEditable: false -> true')
