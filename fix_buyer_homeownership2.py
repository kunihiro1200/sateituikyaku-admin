#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""BuyerDetailPage.tsx に問合時持家ヒアリング機能を追加"""

with open('frontend/frontend/src/pages/BuyerDetailPage.tsx', 'rb') as f:
    content = f.read()

text = content.decode('utf-8')

# タスク2.1: BUYER_FIELD_SECTIONS に3フィールドを追加
old1 = (
    "      { key: 'owned_home_hearing', label: '\u6301\u5bb6\u30d2\u30a2\u30ea\u30f3\u30b0', inlineEditable: true },\n"
    "      // viewing_notes \u306f PropertyInfoCard \u5185\u306b\u79fb\u52d5"
)
new1 = (
    "      { key: 'owned_home_hearing', label: '\u6301\u5bb6\u30d2\u30a2\u30ea\u30f3\u30b0', inlineEditable: true },\n"
    "      { key: 'owned_home_hearing_inquiry', label: '\u554f\u5408\u6642\u6301\u5bb6\u30d2\u30a2\u30ea\u30f3\u30b0', inlineEditable: true, fieldType: 'staffSelect' },\n"
    "      { key: 'owned_home_hearing_result', label: '\u6301\u5bb6\u30d2\u30a2\u30ea\u30f3\u30b0\u7d50\u679c', inlineEditable: true, fieldType: 'homeHearingResult' },\n"
    "      { key: 'valuation_required', label: '\u8981\u67fb\u5b9a', inlineEditable: true, fieldType: 'valuationRequired' },\n"
    "      // viewing_notes \u306f PropertyInfoCard \u5185\u306b\u79fb\u52d5"
)

if old1 in text:
    text = text.replace(old1, new1)
    print("OK task2.1")
else:
    print("NG task2.1")

# タスク2.2/2.4/2.7: カスタムレンダリングを追加
old2 = (
    "                    // \u305d\u306e\u4ed6\u306e\u30d5\u30a3\u30fc\u30eb\u30c9\n"
    "                    const handleFieldSave = async (newValue: any) => {"
)

new2 = (
    "                    // owned_home_hearing_inquiry \u30d5\u30a3\u30fc\u30eb\u30c9\u306f\u7279\u5225\u51e6\u7406\uff08\u30b9\u30bf\u30c3\u30d5\u30a4\u30cb\u30b7\u30e3\u30eb\u9078\u629e\uff09\n"
    "                    if (field.key === 'owned_home_hearing_inquiry') {\n"
    "                      return (\n"
    "                        <Grid item xs={12} key={`${section.title}-${field.key}`}>\n"
    "                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>\n"
    "                            <Typography variant=\"caption\" color=\"text.secondary\" sx={{ whiteSpace: 'nowrap', flexShrink: 0 }}>\n"
    "                              {field.label}\n"
    "                            </Typography>\n"
    "                            <Box sx={{ display: 'flex', gap: 0.5, flex: 1 }}>\n"
    "                              {normalInitials.map((initial) => {\n"
    "                                const isSelected = buyer.owned_home_hearing_inquiry === initial;\n"
    "                                return (\n"
    "                                  <Button\n"
    "                                    key={initial}\n"
    "                                    size=\"small\"\n"
    "                                    variant={isSelected ? 'contained' : 'outlined'}\n"
    "                                    color=\"primary\"\n"
    "                                    onClick={async () => {\n"
    "                                      const newValue = isSelected ? '' : initial;\n"
    "                                      handleFieldChange(section.title, field.key, newValue);\n"
    "                                      await handleInlineFieldSave(field.key, newValue);\n"
    "                                    }}\n"
    "                                    sx={{\n"
    "                                      flex: 1,\n"
    "                                      py: 0.5,\n"
    "                                      fontWeight: isSelected ? 'bold' : 'normal',\n"
    "                                      borderRadius: 1,\n"
    "                                    }}\n"
    "                                  >\n"
    "                                    {initial}\n"
    "                                  </Button>\n"
    "                                );\n"
    "                              })}\n"
    "                            </Box>\n"
    "                          </Box>\n"
    "                        </Grid>\n"
    "                      );\n"
    "                    }\n"
    "\n"
    "                    // owned_home_hearing_result \u30d5\u30a3\u30fc\u30eb\u30c9\u306f\u7279\u5225\u51e6\u7406\uff084\u62e9\u30dc\u30bf\u30f3\u30fb\u6761\u4ef6\u4ed8\u304d\u8868\u793a\uff09\n"
    "                    if (field.key === 'owned_home_hearing_result') {\n"
    "                      if (!buyer.owned_home_hearing_inquiry) return null;\n"
    "                      const RESULT_OPTIONS = ['\u6301\u5bb6\uff08\u30de\u30f3\u30b7\u30e7\u30f3\uff09', '\u6301\u5bb6\uff08\u6238\u5efa\uff09', '\u8cc3\u8cb8', '\u4ed6\u4e0d\u660e'];\n"
    "                      const showValuationText = ['\u6301\u5bb6\uff08\u30de\u30f3\u30b7\u30e7\u30f3\uff09', '\u6301\u5bb6\uff08\u6238\u5efa\uff09'].includes(\n"
    "                        buyer.owned_home_hearing_result\n"
    "                      );\n"
    "                      return (\n"
    "                        <Grid item xs={12} key={`${section.title}-${field.key}`}>\n"
    "                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>\n"
    "                            <Typography variant=\"caption\" color=\"text.secondary\" sx={{ whiteSpace: 'nowrap', flexShrink: 0 }}>\n"
    "                              {field.label}\n"
    "                            </Typography>\n"
    "                            <Box sx={{ display: 'flex', flexDirection: 'column', flex: 1, gap: 0.5 }}>\n"
    "                              <Box sx={{ display: 'flex', gap: 0.5 }}>\n"
    "                                {RESULT_OPTIONS.map((option) => {\n"
    "                                  const isSelected = buyer.owned_home_hearing_result === option;\n"
    "                                  return (\n"
    "                                    <Button\n"
    "                                      key={option}\n"
    "                                      size=\"small\"\n"
    "                                      variant={isSelected ? 'contained' : 'outlined'}\n"
    "                                      color=\"primary\"\n"
    "                                      onClick={async () => {\n"
    "                                        const newValue = isSelected ? '' : option;\n"
    "                                        handleFieldChange(section.title, field.key, newValue);\n"
    "                                        await handleInlineFieldSave(field.key, newValue);\n"
    "                                      }}\n"
    "                                      sx={{\n"
    "                                        flex: 1,\n"
    "                                        py: 0.5,\n"
    "                                        fontWeight: isSelected ? 'bold' : 'normal',\n"
    "                                        borderRadius: 1,\n"
    "                                      }}\n"
    "                                    >\n"
    "                                      {option}\n"
    "                                    </Button>\n"
    "                                  );\n"
    "                                })}\n"
    "                              </Box>\n"
    "                              {showValuationText && (\n"
    "                                <Typography variant=\"caption\" color=\"primary.main\" sx={{ mt: 0.5 }}>\n"
    "                                  \u673a\u4e0a\u67fb\u5b9a\u3092\u7121\u6599\u3067\u884c\u3063\u3066\u3044\u307e\u3059\u304c\u3053\u306e\u5f8c\u30e1\u30fc\u30eb\u3067\u67fb\u5b9a\u984d\u5dee\u3057\u4e0a\u3052\u307e\u3057\u3087\u3046\u304b\uff1f\n"
    "                                </Typography>\n"
    "                              )}\n"
    "                            </Box>\n"
    "                          </Box>\n"
    "                        </Grid>\n"
    "                      );\n"
    "                    }\n"
    "\n"
    "                    // valuation_required \u30d5\u30a3\u30fc\u30eb\u30c9\u306f\u7279\u5225\u51e6\u7406\uff082\u62e9\u30dc\u30bf\u30f3\u30fb\u6761\u4ef6\u4ed8\u304d\u8868\u793a\uff09\n"
    "                    if (field.key === 'valuation_required') {\n"
    "                      const showValuation = ['\u6301\u5bb6\uff08\u30de\u30f3\u30b7\u30e7\u30f3\uff09', '\u6301\u5bb6\uff08\u6238\u5efa\uff09'].includes(\n"
    "                        buyer.owned_home_hearing_result\n"
    "                      );\n"
    "                      if (!showValuation) return null;\n"
    "                      const VALUATION_OPTIONS = ['\u8981', '\u4e0d\u8981'];\n"
    "                      return (\n"
    "                        <Grid item xs={12} key={`${section.title}-${field.key}`}>\n"
    "                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>\n"
    "                            <Typography variant=\"caption\" color=\"text.secondary\" sx={{ whiteSpace: 'nowrap', flexShrink: 0 }}>\n"
    "                              {field.label}\n"
    "                            </Typography>\n"
    "                            <Box sx={{ display: 'flex', gap: 0.5, flex: 1 }}>\n"
    "                              {VALUATION_OPTIONS.map((option) => {\n"
    "                                const isSelected = buyer.valuation_required === option;\n"
    "                                return (\n"
    "                                  <Button\n"
    "                                    key={option}\n"
    "                                    size=\"small\"\n"
    "                                    variant={isSelected ? 'contained' : 'outlined'}\n"
    "                                    color=\"primary\"\n"
    "                                    onClick={async () => {\n"
    "                                      const newValue = isSelected ? '' : option;\n"
    "                                      handleFieldChange(section.title, field.key, newValue);\n"
    "                                      await handleInlineFieldSave(field.key, newValue);\n"
    "                                    }}\n"
    "                                    sx={{\n"
    "                                      flex: 1,\n"
    "                                      py: 0.5,\n"
    "                                      fontWeight: isSelected ? 'bold' : 'normal',\n"
    "                                      borderRadius: 1,\n"
    "                                    }}\n"
    "                                  >\n"
    "                                    {option}\n"
    "                                  </Button>\n"
    "                                );\n"
    "                              })}\n"
    "                            </Box>\n"
    "                          </Box>\n"
    "                        </Grid>\n"
    "                      );\n"
    "                    }\n"
    "\n"
    "                    // \u305d\u306e\u4ed6\u306e\u30d5\u30a3\u30fc\u30eb\u30c9\n"
    "                    const handleFieldSave = async (newValue: any) => {"
)

if old2 in text:
    text = text.replace(old2, new2)
    print("OK task2.2/2.4/2.7")
else:
    print("NG task2.2/2.4/2.7")

# UTF-8で書き込む（BOMなし）
with open('frontend/frontend/src/pages/BuyerDetailPage.tsx', 'wb') as f:
    f.write(text.encode('utf-8'))

print("saved")

# 確認
with open('frontend/frontend/src/pages/BuyerDetailPage.tsx', 'rb') as f:
    verify = f.read().decode('utf-8')
print("owned_home_hearing_inquiry:", 'owned_home_hearing_inquiry' in verify)
print("owned_home_hearing_result:", 'owned_home_hearing_result' in verify)
print("valuation_required:", 'valuation_required' in verify)
