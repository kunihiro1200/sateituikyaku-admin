#!/usr/bin/env python3
# -*- coding: utf-8 -*-
# BuyerDetailPage.tsx changes

FILE_PATH = 'frontend/frontend/src/pages/BuyerDetailPage.tsx'

with open(FILE_PATH, 'rb') as f:
    text = f.read().decode('utf-8')

# 1. Add ConfirmationToAssignee import
old_import = "import RelatedBuyerNotificationBadge from '../components/RelatedBuyerNotificationBadge';"
new_import = old_import + "\nimport { ConfirmationToAssignee } from '../components/ConfirmationToAssignee';"
if "ConfirmationToAssignee" not in text:
    text = text.replace(old_import, new_import)
    print("OK: import added")
else:
    print("SKIP: import already exists")

# 2. Replace distribution_type field with confirmation_to_assignee in BUYER_FIELD_SECTIONS
old_field = "      { key: 'distribution_type', label: '\u914d\u4fe1\u7a2e\u5225', inlineEditable: true, fieldType: 'dropdown' },"
new_field = "      { key: 'confirmation_to_assignee', label: '\u62c5\u5f53\u3078\u306e\u78ba\u8a8d\u4e8b\u9805', inlineEditable: true, fieldType: 'confirmationToAssignee' },"
if old_field in text:
    text = text.replace(old_field, new_field)
    print("OK: distribution_type replaced with confirmation_to_assignee")
else:
    print("WARN: distribution_type field not found")

# 3. Remove 'other' section from BUYER_FIELD_SECTIONS
other_start = ",\n  {\n    title: '\u305d\u306e\u4ed6',"
other_end = "    ],\n  },\n];"
idx_start = text.find(other_start)
if idx_start != -1:
    idx_end = text.find(other_end, idx_start)
    if idx_end != -1:
        text = text[:idx_start] + "\n];" + text[idx_end + len(other_end):]
        print("OK: 'other' section removed")
    else:
        print("WARN: end of 'other' section not found")
else:
    print("WARN: 'other' section not found")

# 4. Replace distribution_type render block with confirmation_to_assignee component
old_render = """                    // distribution_type\u30d5\u30a3\u30fc\u30eb\u30c9\u306f\u7279\u5225\u51e6\u7406\uff08\u30c9\u30ed\u30c3\u30d7\u30c0\u30a6\u30f3\uff09
                    if (field.key === 'distribution_type') {
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
                            options={DISTRIBUTION_TYPE_OPTIONS}
                            onSave={handleFieldSave}
                            onChange={(fieldName, newValue) => handleFieldChange(section.title, fieldName, newValue)}
                            buyerId={buyer_number}
                            enableConflictDetection={true}
                            showEditIndicator={true}
                          />
                        </Grid>
                      );
                    }"""

new_render = """                    // confirmation_to_assignee\u30d5\u30a3\u30fc\u30eb\u30c9\u306f ConfirmationToAssignee \u30b3\u30f3\u30dd\u30fc\u30cd\u30f3\u30c8\u3067\u8868\u793a
                    // \u7269\u4ef6\u62c5\u5f53\u8005\uff08sales_assignee\uff09\u304c\u8a2d\u5b9a\u3055\u308c\u3066\u3044\u308b\u5834\u5408\u306e\u307f\u8868\u793a
                    if (field.key === 'confirmation_to_assignee') {
                      const propertyAssignee = linkedProperties[0]?.sales_assignee || null;
                      if (!propertyAssignee) return null;
                      return (
                        <Grid item xs={12} key={`${section.title}-${field.key}`}>
                          <ConfirmationToAssignee
                            buyer={{
                              buyer_number: buyer.buyer_number,
                              name: buyer.name || '',
                              property_number: linkedProperties[0]?.property_number || '',
                              confirmation_to_assignee: buyer.confirmation_to_assignee,
                            }}
                            propertyAssignee={propertyAssignee}
                            onSendSuccess={() => {
                              fetchBuyer();
                              setSnackbar({ open: true, message: '\u30c1\u30e3\u30c3\u30c8\u3092\u9001\u4fe1\u3057\u307e\u3057\u305f', severity: 'success' });
                            }}
                          />
                        </Grid>
                      );
                    }"""

if old_render in text:
    text = text.replace(old_render, new_render)
    print("OK: distribution_type render replaced with confirmation_to_assignee")
else:
    print("WARN: distribution_type render block not found")

with open(FILE_PATH, 'wb') as f:
    f.write(text.encode('utf-8'))

with open(FILE_PATH, 'rb') as f:
    bom = f.read(3)
if bom == b'\xef\xbb\xbf':
    print("WARN: BOM detected")
else:
    print("OK: saved as UTF-8 without BOM")

print("Done!")
