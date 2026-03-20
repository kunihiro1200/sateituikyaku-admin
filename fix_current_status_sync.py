# 状況（売主）をsellers.current_statusにも同期するスクリプト
with open('backend/src/services/EnhancedAutoSyncService.ts', 'rb') as f:
    content = f.read()

text = content.decode('utf-8')

# 改行コードを確認
if '\r\n' in text:
    NL = '\r\n'
    print('CRLF detected')
else:
    NL = '\n'
    print('LF detected')

# ========== 1. updateSingleSeller: updateDataにcurrent_statusを追加 ==========
old1 = (
    f"    // 物件関連フィールドを追加{NL}"
    f"    if (propertyAddress) {{{NL}"
    f"      updateData.property_address = String(propertyAddress);{NL}"
    f"    }}{NL}"
    f"    if (propertyType) {{{NL}"
    f"      updateData.property_type = String(propertyType);{NL}"
    f"    }}"
)

new1 = (
    f"    // 状況（売主）をsellers.current_statusにも保存{NL}"
    f"    const currentStatus = row['状況（売主）'];{NL}"
    f"    if (currentStatus) {{{NL}"
    f"      updateData.current_status = String(currentStatus);{NL}"
    f"    }}{NL}"
    f"{NL}"
    f"    // 物件関連フィールドを追加{NL}"
    f"    if (propertyAddress) {{{NL}"
    f"      updateData.property_address = String(propertyAddress);{NL}"
    f"    }}{NL}"
    f"    if (propertyType) {{{NL}"
    f"      updateData.property_type = String(propertyType);{NL}"
    f"    }}"
)

if old1 in text:
    text = text.replace(old1, new1, 1)
    print('✅ Step 1: updateSingleSeller - current_status added')
else:
    print('❌ Step 1: not found')
    idx = text.find('updateData.property_address')
    if idx >= 0:
        print(repr(text[idx-80:idx+80]))

# ========== 2. syncSingleSeller: encryptedDataにcurrent_statusを追加 ==========
old2 = (
    f"    // 物件関連フィールドを追加{NL}"
    f"    if (propertyAddress) {{{NL}"
    f"      encryptedData.property_address = String(propertyAddress);{NL}"
    f"    }}{NL}"
    f"    if (propertyType) {{{NL}"
    f"      encryptedData.property_type = String(propertyType);{NL}"
    f"    }}"
)

new2 = (
    f"    // 状況（売主）をsellers.current_statusにも保存{NL}"
    f"    const currentStatusNew = row['状況（売主）'];{NL}"
    f"    if (currentStatusNew) {{{NL}"
    f"      encryptedData.current_status = String(currentStatusNew);{NL}"
    f"    }}{NL}"
    f"{NL}"
    f"    // 物件関連フィールドを追加{NL}"
    f"    if (propertyAddress) {{{NL}"
    f"      encryptedData.property_address = String(propertyAddress);{NL}"
    f"    }}{NL}"
    f"    if (propertyType) {{{NL}"
    f"      encryptedData.property_type = String(propertyType);{NL}"
    f"    }}"
)

if old2 in text:
    text = text.replace(old2, new2, 1)
    print('✅ Step 2: syncSingleSeller - current_status added')
else:
    print('❌ Step 2: not found')
    idx = text.find('encryptedData.property_address')
    if idx >= 0:
        print(repr(text[idx-80:idx+80]))

with open('backend/src/services/EnhancedAutoSyncService.ts', 'wb') as f:
    f.write(text.encode('utf-8'))
print('Done!')
