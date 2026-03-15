#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
業者問合せフィールドをドロップダウンからテキストボックスに変更する
"""

# ===== NewBuyerPage.tsx =====
with open('frontend/frontend/src/pages/NewBuyerPage.tsx', 'rb') as f:
    content = f.read().decode('utf-8')

# ドロップダウン（FormControl + Select）をテキストフィールドに置き換え
old_new_buyer = '''                {showBrokerInquiry(companyName) && (
                  <Grid item xs={12} sm={6}>
                    <FormControl fullWidth>
                      <InputLabel>業者問合せ</InputLabel>
                      <Select
                        value={brokerInquiry}
                        label="業者問合せ"
                        onChange={(e) => setBrokerInquiry(e.target.value)}
                      >
                        <MenuItem value="">
                          <em>未選択</em>
                        </MenuItem>
                        <MenuItem value="業者問合せ">業者問合せ</MenuItem>
                        <MenuItem value="業者（両手）">業者（両手）</MenuItem>
                      </Select>
                    </FormControl>
                  </Grid>
                )}'''

new_new_buyer = '''                {showBrokerInquiry(companyName) && (
                  <Grid item xs={12} sm={6}>
                    <TextField
                      fullWidth
                      label="業者問合せ"
                      value={brokerInquiry}
                      onChange={(e) => setBrokerInquiry(e.target.value)}
                    />
                  </Grid>
                )}'''

if old_new_buyer in content:
    content = content.replace(old_new_buyer, new_new_buyer)
    print('NewBuyerPage.tsx: ドロップダウン → テキストフィールドに変更しました')
else:
    print('NewBuyerPage.tsx: 対象箇所が見つかりませんでした')

with open('frontend/frontend/src/pages/NewBuyerPage.tsx', 'wb') as f:
    f.write(content.encode('utf-8'))


# ===== BuyerDetailPage.tsx =====
with open('frontend/frontend/src/pages/BuyerDetailPage.tsx', 'rb') as f:
    content = f.read().decode('utf-8')

# fieldType: 'dropdown' → 'text' に変更
old_field_def = "      { key: 'broker_inquiry', label: '業者問合せ', inlineEditable: true, fieldType: 'dropdown', conditionalOn: 'company_name' },"
new_field_def = "      { key: 'broker_inquiry', label: '業者問合せ', inlineEditable: true, fieldType: 'text', conditionalOn: 'company_name' },"

if old_field_def in content:
    content = content.replace(old_field_def, new_field_def)
    print('BuyerDetailPage.tsx: fieldType dropdown → text に変更しました')
else:
    print('BuyerDetailPage.tsx: fieldType定義が見つかりませんでした')

# InlineEditableFieldのfieldType="dropdown"とoptionsをfieldType="text"に変更
old_inline = '''                          <InlineEditableField
                            label={field.label}
                            value={value || ''}
                            fieldName={field.key}
                            fieldType="dropdown"
                            options={[
                              { label: '業者問合せ', value: '業者問合せ' },
                              { label: '業者（両手）', value: '業者（両手）' },
                            ]}
                            onSave={handleFieldSave}
                            buyerId={buyer_number}
                            enableConflictDetection={true}
                            showEditIndicator={true}
                          />'''

new_inline = '''                          <InlineEditableField
                            label={field.label}
                            value={value || ''}
                            fieldName={field.key}
                            fieldType="text"
                            onSave={handleFieldSave}
                            buyerId={buyer_number}
                            enableConflictDetection={true}
                            showEditIndicator={true}
                          />'''

if old_inline in content:
    content = content.replace(old_inline, new_inline)
    print('BuyerDetailPage.tsx: InlineEditableField dropdown → text に変更しました')
else:
    print('BuyerDetailPage.tsx: InlineEditableField箇所が見つかりませんでした')

with open('frontend/frontend/src/pages/BuyerDetailPage.tsx', 'wb') as f:
    f.write(content.encode('utf-8'))

print('完了')
