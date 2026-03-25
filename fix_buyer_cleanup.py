# -*- coding: utf-8 -*-
"""
email_type の残存コードとインポートをクリーンアップ
"""

with open('frontend/frontend/src/pages/BuyerDetailPage.tsx', 'rb') as f:
    content = f.read()

text = content.decode('utf-8')

# 1. email_typeの特別処理ブロックを削除
old_email_type_block = """                    // email_typeフィールドは特別処理（ドロップダウン）
                    if (field.key === 'email_type') {
                      const handleFieldSave = async (newValue: any) => {
                        const result = await handleInlineFieldSave(field.key, newValue);
                        if (result && !result.success && result.error) {
                          throw new Error(result.error);
                        }
                      };

                      return (
                        <Grid item {...gridSize} key={`${section.title}-${field.key}`}>
                          <InlineEditableField
                            label={field.label}
                            value={value || ''}
                            fieldName={field.key}
                            fieldType="dropdown"
                            options={EMAIL_TYPE_OPTIONS}
                            onSave={handleFieldSave}
                            onChange={(fieldName, newValue) => handleFieldChange(section.title, fieldName, newValue)}
                            buyerId={buyer_number}
                            enableConflictDetection={true}
                            showEditIndicator={true}
                          />
                        </Grid>
                      );
                    }

"""
text = text.replace(old_email_type_block, '')

# 2. EMAIL_TYPE_OPTIONS のインポートを削除
old_import = """  INQUIRY_EMAIL_PHONE_OPTIONS, 
  THREE_CALLS_CONFIRMED_OPTIONS, 
  EMAIL_TYPE_OPTIONS, 
} from '../utils/buyerFieldOptions';"""
new_import = """  INQUIRY_EMAIL_PHONE_OPTIONS, 
  THREE_CALLS_CONFIRMED_OPTIONS, 
} from '../utils/buyerFieldOptions';"""
text = text.replace(old_import, new_import)

with open('frontend/frontend/src/pages/BuyerDetailPage.tsx', 'wb') as f:
    f.write(text.encode('utf-8'))

print('Done! email_type の残存コードとインポートを削除しました')
