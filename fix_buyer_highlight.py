# -*- coding: utf-8 -*-
"""
修正内容:
1. inquiry_source / latest_status の InlineEditableField を必須ハイライト対応ラッパーで囲む
2. inquiry_email_phone のボタンエリアに必須ハイライト追加
3. ラベルに * マーク追加（未入力時）
"""

with open('frontend/frontend/src/pages/BuyerDetailPage.tsx', 'rb') as f:
    content = f.read()

text = content.decode('utf-8')

# ---- 1. inquiry_source の InlineEditableField を必須ハイライト対応に ----
old_inquiry_source_field = """                      return (
                        <Grid item {...gridSize} key={`${section.title}-${field.key}`}>
                          <InlineEditableField
                            label={field.label}
                            value={value || ''}
                            fieldName={field.key}
                            fieldType="dropdown"
                            options={INQUIRY_SOURCE_OPTIONS}
                            onSave={handleFieldSave}
                            onChange={(fieldName, newValue) => handleFieldChange(section.title, fieldName, newValue)}
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

                    // latest_statusフィールドは特別処理（ドロップダウン）"""

new_inquiry_source_field = """                      const isInquirySourceMissing = missingRequiredFields.has('inquiry_source');
                      return (
                        <Grid item {...gridSize} key={`${section.title}-${field.key}`}>
                          <Box sx={{
                            border: isInquirySourceMissing ? '2px solid #f44336' : 'none',
                            borderRadius: isInquirySourceMissing ? 1 : 0,
                            p: isInquirySourceMissing ? 0.5 : 0,
                            bgcolor: isInquirySourceMissing ? 'rgba(244,67,54,0.05)' : 'transparent',
                          }}>
                            {isInquirySourceMissing && (
                              <Typography variant="caption" color="error" sx={{ fontWeight: 'bold', display: 'block', mb: 0.25 }}>
                                {field.label} *
                              </Typography>
                            )}
                            <InlineEditableField
                              label={isInquirySourceMissing ? '' : field.label}
                              value={value || ''}
                              fieldName={field.key}
                              fieldType="dropdown"
                              options={INQUIRY_SOURCE_OPTIONS}
                              onSave={handleFieldSave}
                              onChange={(fieldName, newValue) => handleFieldChange(section.title, fieldName, newValue)}
                              buyerId={buyer_number}
                              enableConflictDetection={true}
                              showEditIndicator={true}
                              validation={(newValue) => {
                                if (buyer.broker_inquiry === '業者問合せ') return null;
                                if (!newValue || !String(newValue).trim()) return '問合せ元は必須です';
                                return null;
                              }}
                            />
                          </Box>
                        </Grid>
                      );
                    }

                    // latest_statusフィールドは特別処理（ドロップダウン）"""

text = text.replace(old_inquiry_source_field, new_inquiry_source_field)

# ---- 2. latest_status の InlineEditableField を必須ハイライト対応に ----
old_latest_status_field = """                      return (
                        <Grid item {...gridSize} key={`${section.title}-${field.key}`}>
                          <InlineEditableField
                            label={field.label}
                            value={value || ''}
                            fieldName={field.key}
                            fieldType="dropdown"
                            options={LATEST_STATUS_OPTIONS}
                            onSave={handleFieldSave}
                            onChange={(fieldName, newValue) => handleFieldChange(section.title, fieldName, newValue)}
                            buyerId={buyer_number}
                            enableConflictDetection={true}
                            showEditIndicator={true}
                          />
                        </Grid>
                      );
                    }

                    // inquiry_email_phoneフィールドは特別処理（ボタン選択 + 即時保存）"""

new_latest_status_field = """                      const isLatestStatusMissing = missingRequiredFields.has('latest_status');
                      return (
                        <Grid item {...gridSize} key={`${section.title}-${field.key}`}>
                          <Box sx={{
                            border: isLatestStatusMissing ? '2px solid #f44336' : 'none',
                            borderRadius: isLatestStatusMissing ? 1 : 0,
                            p: isLatestStatusMissing ? 0.5 : 0,
                            bgcolor: isLatestStatusMissing ? 'rgba(244,67,54,0.05)' : 'transparent',
                          }}>
                            {isLatestStatusMissing && (
                              <Typography variant="caption" color="error" sx={{ fontWeight: 'bold', display: 'block', mb: 0.25 }}>
                                {field.label} *
                              </Typography>
                            )}
                            <InlineEditableField
                              label={isLatestStatusMissing ? '' : field.label}
                              value={value || ''}
                              fieldName={field.key}
                              fieldType="dropdown"
                              options={LATEST_STATUS_OPTIONS}
                              onSave={handleFieldSave}
                              onChange={(fieldName, newValue) => handleFieldChange(section.title, fieldName, newValue)}
                              buyerId={buyer_number}
                              enableConflictDetection={true}
                              showEditIndicator={true}
                            />
                          </Box>
                        </Grid>
                      );
                    }

                    // inquiry_email_phoneフィールドは特別処理（ボタン選択 + 即時保存）"""

text = text.replace(old_latest_status_field, new_latest_status_field)

# ---- 3. inquiry_email_phone のラベルと外枠に必須ハイライト追加 ----
old_email_phone_label = """                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <Typography variant="caption" color="text.secondary" sx={{ whiteSpace: 'nowrap', flexShrink: 0 }}>
                              {field.label}
                            </Typography>
                            <Box sx={{ display: 'flex', gap: 0.5, flex: 1 }}>
                              {INQUIRY_EMAIL_PHONE_BTNS.map((opt) => {"""

new_email_phone_label = """                          <Box sx={{
                            display: 'flex', alignItems: 'center', gap: 1,
                            border: missingRequiredFields.has('inquiry_email_phone') ? '2px solid #f44336' : 'none',
                            borderRadius: missingRequiredFields.has('inquiry_email_phone') ? 1 : 0,
                            p: missingRequiredFields.has('inquiry_email_phone') ? 0.5 : 0,
                            bgcolor: missingRequiredFields.has('inquiry_email_phone') ? 'rgba(244,67,54,0.05)' : 'transparent',
                          }}>
                            <Typography variant="caption" color={missingRequiredFields.has('inquiry_email_phone') ? 'error' : 'text.secondary'} sx={{ whiteSpace: 'nowrap', flexShrink: 0, fontWeight: missingRequiredFields.has('inquiry_email_phone') ? 'bold' : 'normal' }}>
                              {field.label}{missingRequiredFields.has('inquiry_email_phone') ? ' *' : ''}
                            </Typography>
                            <Box sx={{ display: 'flex', gap: 0.5, flex: 1 }}>
                              {INQUIRY_EMAIL_PHONE_BTNS.map((opt) => {"""

text = text.replace(old_email_phone_label, new_email_phone_label)

with open('frontend/frontend/src/pages/BuyerDetailPage.tsx', 'wb') as f:
    f.write(text.encode('utf-8'))

print('Done!')
