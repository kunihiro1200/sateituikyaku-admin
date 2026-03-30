import re

# BuyerDetailPage.tsx: vendor_survey -> broker_survey
with open('frontend/frontend/src/pages/BuyerDetailPage.tsx', 'rb') as f:
    content = f.read()

text = content.decode('utf-8')

# Replace all occurrences of vendor_survey with broker_survey
text = text.replace("key: 'vendor_survey'", "key: 'broker_survey'")
text = text.replace("// vendor_surveyフィールドは特別処理（値がある場合のみ表示、「未」のときはオレンジ強調）",
                    "// broker_surveyフィールドは特別処理（値がある場合のみ表示、「未」のときはオレンジ強調）")
text = text.replace("if (field.key === 'vendor_survey')", "if (field.key === 'broker_survey')")
text = text.replace("if (!buyer?.vendor_survey || !String(buyer.vendor_survey).trim())",
                    "if (!buyer?.broker_survey || !String(buyer.broker_survey).trim())")
text = text.replace("const isUmi = buyer?.vendor_survey === '未';",
                    "const isUmi = buyer?.broker_survey === '未';")

with open('frontend/frontend/src/pages/BuyerDetailPage.tsx', 'wb') as f:
    f.write(text.encode('utf-8'))

print('BuyerDetailPage.tsx: done')

# NewBuyerPage.tsx: vendor_survey -> broker_survey
with open('frontend/frontend/src/pages/NewBuyerPage.tsx', 'rb') as f:
    content = f.read()

text = content.decode('utf-8')
text = text.replace('vendor_survey: vendorSurvey || null,', 'broker_survey: vendorSurvey || null,')

with open('frontend/frontend/src/pages/NewBuyerPage.tsx', 'wb') as f:
    f.write(text.encode('utf-8'))

print('NewBuyerPage.tsx: done')
