# 土地（当社調べ）・建物（当社調べ）フィールドの追加
# 1. CallModePage.tsx - 土地面積・建物面積の下に「当社調べ」フィールドを追加
# 2. EnhancedAutoSyncService.ts - スプレッドシートから同期
# 3. valuations.ts - propertyInfo構築時にlandAreaVerifiedを含める

# ============================================================
# 1. CallModePage.tsx
# ============================================================
with open('frontend/frontend/src/pages/CallModePage.tsx', 'rb') as f:
    content = f.read()
text = content.decode('utf-8')
NL = '\r\n' if '\r\n' in text else '\n'
print(f'CallModePage NL: {"CRLF" if NL == chr(13)+chr(10) else "LF"}')

# 土地面積フィールドの後に「土地（当社調べ）」を追加
old1 = (
    f'                    <Grid item xs={{12}}>{NL}'
    f'                      <InlineEditableField{NL}'
    f'                        label="土地面積 (m²)"{NL}'
    f'                        value={{(property?.landArea || seller?.landArea)?.toString() || \'\'}}{NL}'
    f'                        fieldName="landArea"{NL}'
    f'                        fieldType="text"{NL}'
    f'                        onSave={{async (newValue) => {{{NL}'
    f'                          const parsed = newValue ? parseFloat(newValue) : null;{NL}'
    f'                          if (property) {{{NL}'
    f'                            await api.put(`/properties/${{property.id}}`, {{ landArea: parsed }});{NL}'
    f'                          }} else {{{NL}'
    f'                            await api.put(`/api/sellers/${{id}}`, {{ landArea: parsed }});{NL}'
    f'                            setSeller(prev => prev ? {{ ...prev, landArea: parsed ?? undefined }} : prev);{NL}'
    f'                          }}{NL}'
    f'                        }}}}{NL}'
    f'                        buyerId={{id}}{NL}'
    f'                        showEditIndicator={{true}}{NL}'
    f'                      />{NL}'
    f'                    </Grid>{NL}'
    f'                    <Grid item xs={{12}}>{NL}'
    f'                      <InlineEditableField{NL}'
    f'                        label="建物面積 (m²)"{NL}'
    f'                        value={{(property?.buildingArea || seller?.buildingArea)?.toString() || \'\'}}{NL}'
    f'                        fieldName="buildingArea"{NL}'
    f'                        fieldType="text"{NL}'
    f'                        onSave={{async (newValue) => {{{NL}'
    f'                          const parsed = newValue ? parseFloat(newValue) : null;{NL}'
    f'                          if (property) {{{NL}'
    f'                            await api.put(`/properties/${{property.id}}`, {{ buildingArea: parsed }});{NL}'
    f'                          }} else {{{NL}'
    f'                            await api.put(`/api/sellers/${{id}}`, {{ buildingArea: parsed }});{NL}'
    f'                            setSeller(prev => prev ? {{ ...prev, buildingArea: parsed ?? undefined }} : prev);{NL}'
    f'                          }}{NL}'
    f'                        }}}}{NL}'
    f'                        buyerId={{id}}{NL}'
    f'                        showEditIndicator={{true}}{NL}'
    f'                      />{NL}'
    f'                    </Grid>'
)

new1 = (
    f'                    <Grid item xs={{12}}>{NL}'
    f'                      <InlineEditableField{NL}'
    f'                        label="土地面積 (m²)"{NL}'
    f'                        value={{(property?.landArea || seller?.landArea)?.toString() || \'\'}}{NL}'
    f'                        fieldName="landArea"{NL}'
    f'                        fieldType="text"{NL}'
    f'                        onSave={{async (newValue) => {{{NL}'
    f'                          const parsed = newValue ? parseFloat(newValue) : null;{NL}'
    f'                          if (property) {{{NL}'
    f'                            await api.put(`/properties/${{property.id}}`, {{ landArea: parsed }});{NL}'
    f'                          }} else {{{NL}'
    f'                            await api.put(`/api/sellers/${{id}}`, {{ landArea: parsed }});{NL}'
    f'                            setSeller(prev => prev ? {{ ...prev, landArea: parsed ?? undefined }} : prev);{NL}'
    f'                          }}{NL}'
    f'                        }}}}{NL}'
    f'                        buyerId={{id}}{NL}'
    f'                        showEditIndicator={{true}}{NL}'
    f'                      />{NL}'
    f'                    </Grid>{NL}'
    f'                    <Grid item xs={{12}}>{NL}'
    f'                      <InlineEditableField{NL}'
    f'                        label="土地面積（当社調べ）(m²)"{NL}'
    f'                        value={{property?.landAreaVerified?.toString() || \'\'}}{NL}'
    f'                        fieldName="landAreaVerified"{NL}'
    f'                        fieldType="text"{NL}'
    f'                        onSave={{async (newValue) => {{{NL}'
    f'                          const parsed = newValue ? parseFloat(newValue) : null;{NL}'
    f'                          if (property) {{{NL}'
    f'                            await api.put(`/properties/${{property.id}}`, {{ landAreaVerified: parsed }});{NL}'
    f'                            setProperty(prev => prev ? {{ ...prev, landAreaVerified: parsed ?? undefined }} : prev);{NL}'
    f'                          }}{NL}'
    f'                        }}}}{NL}'
    f'                        buyerId={{id}}{NL}'
    f'                        showEditIndicator={{true}}{NL}'
    f'                      />{NL}'
    f'                    </Grid>{NL}'
    f'                    <Grid item xs={{12}}>{NL}'
    f'                      <InlineEditableField{NL}'
    f'                        label="建物面積 (m²)"{NL}'
    f'                        value={{(property?.buildingArea || seller?.buildingArea)?.toString() || \'\'}}{NL}'
    f'                        fieldName="buildingArea"{NL}'
    f'                        fieldType="text"{NL}'
    f'                        onSave={{async (newValue) => {{{NL}'
    f'                          const parsed = newValue ? parseFloat(newValue) : null;{NL}'
    f'                          if (property) {{{NL}'
    f'                            await api.put(`/properties/${{property.id}}`, {{ buildingArea: parsed }});{NL}'
    f'                          }} else {{{NL}'
    f'                            await api.put(`/api/sellers/${{id}}`, {{ buildingArea: parsed }});{NL}'
    f'                            setSeller(prev => prev ? {{ ...prev, buildingArea: parsed ?? undefined }} : prev);{NL}'
    f'                          }}{NL}'
    f'                        }}}}{NL}'
    f'                        buyerId={{id}}{NL}'
    f'                        showEditIndicator={{true}}{NL}'
    f'                      />{NL}'
    f'                    </Grid>{NL}'
    f'                    <Grid item xs={{12}}>{NL}'
    f'                      <InlineEditableField{NL}'
    f'                        label="建物面積（当社調べ）(m²)"{NL}'
    f'                        value={{property?.buildingAreaVerified?.toString() || \'\'}}{NL}'
    f'                        fieldName="buildingAreaVerified"{NL}'
    f'                        fieldType="text"{NL}'
    f'                        onSave={{async (newValue) => {{{NL}'
    f'                          const parsed = newValue ? parseFloat(newValue) : null;{NL}'
    f'                          if (property) {{{NL}'
    f'                            await api.put(`/properties/${{property.id}}`, {{ buildingAreaVerified: parsed }});{NL}'
    f'                            setProperty(prev => prev ? {{ ...prev, buildingAreaVerified: parsed ?? undefined }} : prev);{NL}'
    f'                          }}{NL}'
    f'                        }}}}{NL}'
    f'                        buyerId={{id}}{NL}'
    f'                        showEditIndicator={{true}}{NL}'
    f'                      />{NL}'
    f'                    </Grid>'
)

if old1 in text:
    text = text.replace(old1, new1, 1)
    print('✅ Step 1: CallModePage - landAreaVerified/buildingAreaVerified fields added')
else:
    print('❌ Step 1: not found')
    idx = text.find('label="土地面積 (m²)"')
    if idx >= 0:
        print(repr(text[idx-50:idx+200]))

with open('frontend/frontend/src/pages/CallModePage.tsx', 'wb') as f:
    f.write(text.encode('utf-8'))
print('CallModePage done')

# ============================================================
# 2. EnhancedAutoSyncService.ts - updateSingleSeller
# ============================================================
with open('backend/src/services/EnhancedAutoSyncService.ts', 'rb') as f:
    content = f.read()
text = content.decode('utf-8')
NL = '\r\n' if '\r\n' in text else '\n'
print(f'EnhancedAutoSyncService NL: {"CRLF" if NL == chr(13)+chr(10) else "LF"}')

# updateSingleSeller: land_area/building_areaの後にland_area_verified/building_area_verifiedを追加
old2 = (
    f'    const landArea = row[\'土（㎡）\'];{NL}'
    f'    const buildingArea = row[\'建（㎡）\'];{NL}'
    f'    const buildYear = row[\'築年\'];{NL}'
    f'    const structure = row[\'構造\'];{NL}'
    f'    const floorPlan = row[\'間取り\'];{NL}'
    f'{NL}'
    f'    const updateData: any = {{'
)

new2 = (
    f'    const landArea = row[\'土（㎡）\'];{NL}'
    f'    const buildingArea = row[\'建（㎡）\'];{NL}'
    f'    const landAreaVerified = row[\'土地（当社調べ）\'];{NL}'
    f'    const buildingAreaVerified = row[\'建物（当社調べ）\'];{NL}'
    f'    const buildYear = row[\'築年\'];{NL}'
    f'    const structure = row[\'構造\'];{NL}'
    f'    const floorPlan = row[\'間取り\'];{NL}'
    f'{NL}'
    f'    const updateData: any = {{'
)

if old2 in text:
    text = text.replace(old2, new2, 1)
    print('✅ Step 2a: updateSingleSeller - landAreaVerified variable added')
else:
    print('❌ Step 2a: not found')

# updateSingleSeller: parsedBuildingAreaの後にverifiedを追加
old3 = (
    f'    const parsedBuildingArea = this.parseNumeric(buildingArea);{NL}'
    f'    if (parsedBuildingArea !== null) {{{NL}'
    f'      updateData.building_area = parsedBuildingArea;{NL}'
    f'    }}{NL}'
    f'    const parsedBuildYear = this.parseNumeric(buildYear);{NL}'
    f'    if (parsedBuildYear !== null) {{{NL}'
    f'      updateData.build_year = parsedBuildYear;{NL}'
    f'    }}{NL}'
    f'    if (structure) {{{NL}'
    f'      updateData.structure = String(structure);{NL}'
    f'    }}{NL}'
    f'    if (floorPlan) {{{NL}'
    f'      updateData.floor_plan = String(floorPlan);{NL}'
    f'    }}{NL}'
    f'{NL}'
    f'    // 反響関連フィールドを追加{NL}'
    f'    if (inquiryYear) {{{NL}'
    f'      updateData.inquiry_year = this.parseNumeric(inquiryYear);'
)

new3 = (
    f'    const parsedBuildingArea = this.parseNumeric(buildingArea);{NL}'
    f'    if (parsedBuildingArea !== null) {{{NL}'
    f'      updateData.building_area = parsedBuildingArea;{NL}'
    f'    }}{NL}'
    f'    // 土地（当社調べ）・建物（当社調べ）を同期{NL}'
    f'    const parsedLandAreaVerified = this.parseNumeric(landAreaVerified);{NL}'
    f'    if (parsedLandAreaVerified !== null) {{{NL}'
    f'      updateData.land_area_verified = parsedLandAreaVerified;{NL}'
    f'    }}{NL}'
    f'    const parsedBuildingAreaVerified = this.parseNumeric(buildingAreaVerified);{NL}'
    f'    if (parsedBuildingAreaVerified !== null) {{{NL}'
    f'      updateData.building_area_verified = parsedBuildingAreaVerified;{NL}'
    f'    }}{NL}'
    f'    const parsedBuildYear = this.parseNumeric(buildYear);{NL}'
    f'    if (parsedBuildYear !== null) {{{NL}'
    f'      updateData.build_year = parsedBuildYear;{NL}'
    f'    }}{NL}'
    f'    if (structure) {{{NL}'
    f'      updateData.structure = String(structure);{NL}'
    f'    }}{NL}'
    f'    if (floorPlan) {{{NL}'
    f'      updateData.floor_plan = String(floorPlan);{NL}'
    f'    }}{NL}'
    f'{NL}'
    f'    // 反響関連フィールドを追加{NL}'
    f'    if (inquiryYear) {{{NL}'
    f'      updateData.inquiry_year = this.parseNumeric(inquiryYear);'
)

if old3 in text:
    text = text.replace(old3, new3, 1)
    print('✅ Step 2b: updateSingleSeller - land_area_verified/building_area_verified sync added')
else:
    print('❌ Step 2b: not found')
    idx = text.find('updateData.building_area = parsedBuildingArea')
    if idx >= 0:
        print(repr(text[idx:idx+300]))

# ============================================================
# syncSingleSeller: 同様の変更
# ============================================================
old4 = (
    f'    const landArea = row[\'土（㎡）\'];{NL}'
    f'    const buildingArea = row[\'建（㎡）\'];{NL}'
    f'    const buildYear = row[\'築年\'];{NL}'
    f'    const structure = row[\'構造\'];{NL}'
    f'    const floorPlan = row[\'間取り\'];{NL}'
    f'{NL}'
    f'    const encryptedData: any = {{'
)

new4 = (
    f'    const landArea = row[\'土（㎡）\'];{NL}'
    f'    const buildingArea = row[\'建（㎡）\'];{NL}'
    f'    const landAreaVerified = row[\'土地（当社調べ）\'];{NL}'
    f'    const buildingAreaVerified = row[\'建物（当社調べ）\'];{NL}'
    f'    const buildYear = row[\'築年\'];{NL}'
    f'    const structure = row[\'構造\'];{NL}'
    f'    const floorPlan = row[\'間取り\'];{NL}'
    f'{NL}'
    f'    const encryptedData: any = {{'
)

if old4 in text:
    text = text.replace(old4, new4, 1)
    print('✅ Step 3a: syncSingleSeller - landAreaVerified variable added')
else:
    print('❌ Step 3a: not found')

old5 = (
    f'    const parsedBuildingArea = this.parseNumeric(buildingArea);{NL}'
    f'    if (parsedBuildingArea !== null) {{{NL}'
    f'      encryptedData.building_area = parsedBuildingArea;{NL}'
    f'    }}{NL}'
    f'    const parsedBuildYear = this.parseNumeric(buildYear);{NL}'
    f'    if (parsedBuildYear !== null) {{{NL}'
    f'      encryptedData.build_year = parsedBuildYear;{NL}'
    f'    }}{NL}'
    f'    if (structure) {{{NL}'
    f'      encryptedData.structure = String(structure);{NL}'
    f'    }}{NL}'
    f'    if (floorPlan) {{{NL}'
    f'      encryptedData.floor_plan = String(floorPlan);{NL}'
    f'    }}{NL}'
    f'{NL}'
    f'    // 反響関連フィールドを追加{NL}'
    f'    if (inquiryYear) {{{NL}'
    f'      encryptedData.inquiry_year = this.parseNumeric(inquiryYear);'
)

new5 = (
    f'    const parsedBuildingArea = this.parseNumeric(buildingArea);{NL}'
    f'    if (parsedBuildingArea !== null) {{{NL}'
    f'      encryptedData.building_area = parsedBuildingArea;{NL}'
    f'    }}{NL}'
    f'    // 土地（当社調べ）・建物（当社調べ）を同期{NL}'
    f'    const parsedLandAreaVerified = this.parseNumeric(landAreaVerified);{NL}'
    f'    if (parsedLandAreaVerified !== null) {{{NL}'
    f'      encryptedData.land_area_verified = parsedLandAreaVerified;{NL}'
    f'    }}{NL}'
    f'    const parsedBuildingAreaVerified = this.parseNumeric(buildingAreaVerified);{NL}'
    f'    if (parsedBuildingAreaVerified !== null) {{{NL}'
    f'      encryptedData.building_area_verified = parsedBuildingAreaVerified;{NL}'
    f'    }}{NL}'
    f'    const parsedBuildYear = this.parseNumeric(buildYear);{NL}'
    f'    if (parsedBuildYear !== null) {{{NL}'
    f'      encryptedData.build_year = parsedBuildYear;{NL}'
    f'    }}{NL}'
    f'    if (structure) {{{NL}'
    f'      encryptedData.structure = String(structure);{NL}'
    f'    }}{NL}'
    f'    if (floorPlan) {{{NL}'
    f'      encryptedData.floor_plan = String(floorPlan);{NL}'
    f'    }}{NL}'
    f'{NL}'
    f'    // 反響関連フィールドを追加{NL}'
    f'    if (inquiryYear) {{{NL}'
    f'      encryptedData.inquiry_year = this.parseNumeric(inquiryYear);'
)

if old5 in text:
    text = text.replace(old5, new5, 1)
    print('✅ Step 3b: syncSingleSeller - land_area_verified/building_area_verified sync added')
else:
    print('❌ Step 3b: not found')
    idx = text.find('encryptedData.building_area = parsedBuildingArea')
    if idx >= 0:
        print(repr(text[idx:idx+300]))

with open('backend/src/services/EnhancedAutoSyncService.ts', 'wb') as f:
    f.write(text.encode('utf-8'))
print('EnhancedAutoSyncService done')

# ============================================================
# 3. valuations.ts - propertyInfo構築時にlandAreaVerifiedを含める
# ============================================================
with open('backend/src/routes/valuations.ts', 'rb') as f:
    content = f.read()
text = content.decode('utf-8')
NL = '\r\n' if '\r\n' in text else '\n'
print(f'valuations.ts NL: {"CRLF" if NL == chr(13)+chr(10) else "LF"}')

old6 = (
    f'      propertyInfo = {{{NL}'
    f'        id: \'\',{NL}'
    f'        sellerId: seller.id || \'\',{NL}'
    f'        address: seller.propertyAddress || \'\',{NL}'
    f'        propertyType: seller.propertyType || \'\',{NL}'
    f'        landArea: seller.landArea || 0,{NL}'
    f'        buildingArea: seller.buildingArea || 0,{NL}'
    f'        buildYear: seller.buildYear || 0,{NL}'
    f'        structure: seller.structure || \'\',{NL}'
    f'        floorPlan: seller.floorPlan || \'\',{NL}'
    f'        currentStatus: seller.currentStatus || \'\',{NL}'
    f'        sellerSituation: seller.currentStatus || \'\',{NL}'
    f'      }} as any;'
)

new6 = (
    f'      propertyInfo = {{{NL}'
    f'        id: \'\',{NL}'
    f'        sellerId: seller.id || \'\',{NL}'
    f'        address: seller.propertyAddress || \'\',{NL}'
    f'        propertyType: seller.propertyType || \'\',{NL}'
    f'        landArea: seller.landArea || 0,{NL}'
    f'        buildingArea: seller.buildingArea || 0,{NL}'
    f'        landAreaVerified: seller.landAreaVerified || undefined,{NL}'
    f'        buildingAreaVerified: seller.buildingAreaVerified || undefined,{NL}'
    f'        buildYear: seller.buildYear || 0,{NL}'
    f'        structure: seller.structure || \'\',{NL}'
    f'        floorPlan: seller.floorPlan || \'\',{NL}'
    f'        currentStatus: seller.currentStatus || \'\',{NL}'
    f'        sellerSituation: seller.currentStatus || \'\',{NL}'
    f'      }} as any;'
)

if old6 in text:
    text = text.replace(old6, new6, 1)
    print('✅ Step 4: valuations.ts - landAreaVerified/buildingAreaVerified added to propertyInfo')
else:
    print('❌ Step 4: not found')
    idx = text.find('landArea: seller.landArea')
    if idx >= 0:
        print(repr(text[idx-100:idx+200]))

with open('backend/src/routes/valuations.ts', 'wb') as f:
    f.write(text.encode('utf-8'))
print('valuations.ts done')
print('All done!')
