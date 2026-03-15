#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
inquiry_source フィールドに validation を追加するスクリプト
broker_inquiry === '業者問合せ' の場合は必須免除
"""

with open('frontend/frontend/src/pages/BuyerDetailPage.tsx', 'rb') as f:
    content = f.read()

text = content.decode('utf-8')

# 変更前: inquiry_source の InlineEditableField（validation なし）
old_str = '''                      return (
                        <Grid item {...gridSize} key={field.key}>
                          <InlineEditableField
                            label={field.label}
                            value={value || ''}
                            fieldName={field.key}
                            fieldType="dropdown"
                            options={INQUIRY_SOURCE_OPTIONS}
                            onSave={handleFieldSave}
                            buyerId={buyer_number}
                            enableConflictDetection={true}
                            showEditIndicator={true}
                          />
                        </Grid>
                      );
                    }

                    // latest_statusフィールドは特別処理（ドロップダウン）'''

# 変更後: validation を追加
new_str = '''                      return (
                        <Grid item {...gridSize} key={field.key}>
                          <InlineEditableField
                            label={field.label}
                            value={value || ''}
                            fieldName={field.key}
                            fieldType="dropdown"
                            options={INQUIRY_SOURCE_OPTIONS}
                            onSave={handleFieldSave}
                            buyerId={buyer_number}
                            enableConflictDetection={true}
                            showEditIndicator={true}
                            validation={(newValue) => {
                              if (buyer.broker_inquiry === '業者問合せ') return null;
                              if (!newValue || !String(newValue).trim()) return '問合せ元は必須です';
                              return null;
                            }}
                          />
                        </Grid>
                      );
                    }

                    // latest_statusフィールドは特別処理（ドロップダウン）'''

if old_str in text:
    text = text.replace(old_str, new_str)
    print('✅ inquiry_source validation を追加しました')
else:
    print('❌ 対象箇所が見つかりませんでした')
    # デバッグ用に周辺テキストを表示
    idx = text.find('options={INQUIRY_SOURCE_OPTIONS}')
    if idx >= 0:
        print('周辺テキスト:')
        print(repr(text[idx-200:idx+300]))

with open('frontend/frontend/src/pages/BuyerDetailPage.tsx', 'wb') as f:
    f.write(text.encode('utf-8'))

print('完了')
