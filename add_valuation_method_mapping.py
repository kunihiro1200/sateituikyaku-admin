# updateSellerにvaluationMethodのマッピングを追加するスクリプト
with open('backend/src/services/SellerService.supabase.ts', 'rb') as f:
    content = f.read()

text = content.decode('utf-8')

# valuationAssignedByのマッピングの直後にvaluationMethodを追加
old = """    if (data.valuationAssignedBy !== undefined) {
      updates.valuation_assigned_by = data.valuationAssignedBy;
    }"""

new = """    if (data.valuationAssignedBy !== undefined) {
      updates.valuation_assigned_by = data.valuationAssignedBy;
    }
    if ((data as any).valuationMethod !== undefined) {
      updates.valuation_method = (data as any).valuationMethod;
    }"""

if old in text:
    text = text.replace(old, new)
    with open('backend/src/services/SellerService.supabase.ts', 'wb') as f:
        f.write(text.encode('utf-8'))
    print('✅ valuationMethod mapping added successfully')
else:
    print('❌ Target string not found. Please check the file manually.')
