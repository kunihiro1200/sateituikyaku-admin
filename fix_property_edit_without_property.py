# 物件情報セクションをpropertyがない場合でも編集できるよう修正
with open('frontend/frontend/src/pages/CallModePage.tsx', 'rb') as f:
    content = f.read()

text = content.decode('utf-8')

NL = '\r\n' if '\r\n' in text else '\n'
print(f'NL: {"CRLF" if NL == chr(13)+chr(10) else "LF"}')

# ========== 1. 編集ボタンの条件を {property && ...} から {seller && ...} に変更 ==========
old1 = (
    f"              {{property && ({NL}"
    f"                <Button{NL}"
    f"                  size=\"small\"{NL}"
    f"                  onClick={{() => {{{NL}"
    f"                    if (editingProperty) {{{NL}"
    f"                      // キャンセル時は元の値に戻す{NL}"
    f"                      setEditedPropertyAddress(property.address || '');{NL}"
    f"                      setEditedPropertyType(property.propertyType || '');{NL}"
    f"                      setEditedLandArea(property.landArea?.toString() || '');{NL}"
    f"                      setEditedBuildingArea(property.buildingArea?.toString() || '');{NL}"
    f"                      setEditedBuildYear(property.buildYear?.toString() || '');{NL}"
    f"                      setEditedFloorPlan(property.floorPlan || '');{NL}"
    f"                      setEditedStructure(property.structure || '');{NL}"
    f"                      setEditedSellerSituation(property.sellerSituation || '');{NL}"
    f"                    }}{NL}"
    f"                    setEditingProperty(!editingProperty);{NL}"
    f"                  }}}}{NL}"
    f"                >{NL}"
    f"                  {{editingProperty ? 'キャンセル' : '編集'}}{NL}"
    f"                </Button>{NL}"
    f"              )}}"
)

new1 = (
    f"              {{seller && ({NL}"
    f"                <Button{NL}"
    f"                  size=\"small\"{NL}"
    f"                  onClick={{() => {{{NL}"
    f"                    if (editingProperty) {{{NL}"
    f"                      // キャンセル時は元の値に戻す（propertyまたはsellerの値）{NL}"
    f"                      setEditedPropertyAddress(property?.address || seller?.propertyAddress || '');{NL}"
    f"                      setEditedPropertyType(property?.propertyType || seller?.propertyType || '');{NL}"
    f"                      setEditedLandArea((property?.landArea || seller?.landArea)?.toString() || '');{NL}"
    f"                      setEditedBuildingArea((property?.buildingArea || seller?.buildingArea)?.toString() || '');{NL}"
    f"                      setEditedBuildYear((property?.buildYear || seller?.buildYear)?.toString() || '');{NL}"
    f"                      setEditedFloorPlan(property?.floorPlan || seller?.floorPlan || '');{NL}"
    f"                      setEditedStructure(property?.structure || seller?.structure || '');{NL}"
    f"                      setEditedSellerSituation(property?.sellerSituation || seller?.currentStatus || '');{NL}"
    f"                    }}{NL}"
    f"                    setEditingProperty(!editingProperty);{NL}"
    f"                  }}}}{NL}"
    f"                >{NL}"
    f"                  {{editingProperty ? 'キャンセル' : '編集'}}{NL}"
    f"                </Button>{NL}"
    f"              )}}"
)

if old1 in text:
    text = text.replace(old1, new1, 1)
    print('✅ Step 1: edit button condition updated')
else:
    print('❌ Step 1: not found')
    idx = text.find('setEditedSellerSituation(property.sellerSituation')
    if idx >= 0:
        print(repr(text[idx-200:idx+100]))

# ========== 2. 編集モードの条件を property && editingProperty から editingProperty に変更 ==========
old2 = (
    f"                // 編集モードはpropertyオブジェクトがある場合のみ{NL}"
    f"                if (property && editingProperty) {{"
)

new2 = (
    f"                // 編集モード（propertyがなくてもsellerの直接フィールドで編集可能）{NL}"
    f"                if (editingProperty) {{"
)

if old2 in text:
    text = text.replace(old2, new2, 1)
    print('✅ Step 2: edit mode condition updated')
else:
    print('❌ Step 2: not found')
    idx = text.find('editingProperty')
    if idx >= 0:
        print(repr(text[idx-50:idx+100]))

# ========== 3. handleSavePropertyをpropertyなしでも動作するよう修正 ==========
# 現在: if (!property) return;
# 修正: propertyがある場合はproperties APIを呼び、ない場合はsellers APIを呼ぶ
old3 = (
    f"  const handleSaveProperty = async () => {{{NL}"
    f"    if (!property) return;{NL}"
    f"    {NL}"
    f"    try {{{NL}"
    f"      setSavingProperty(true);{NL}"
    f"      setError(null);{NL}"
    f"      setSuccessMessage(null);{NL}"
    f"{NL}"
    f"      await api.put(`/properties/${{property.id}}`, {{{NL}"
    f"        address: editedPropertyAddress,{NL}"
    f"        propertyType: editedPropertyType || null,{NL}"
    f"        landArea: editedLandArea ? parseFloat(editedLandArea) : null,{NL}"
    f"        buildingArea: editedBuildingArea ? parseFloat(editedBuildingArea) : null,{NL}"
    f"        buildYear: editedBuildYear ? parseInt(editedBuildYear, 10) : null,{NL}"
    f"        floorPlan: editedFloorPlan || null,{NL}"
    f"        structure: editedStructure || null,{NL}"
    f"        sellerSituation: editedSellerSituation || null,{NL}"
    f"      }});{NL}"
    f"{NL}"
    f"      setSuccessMessage('物件情報を更新しました');{NL}"
    f"      setEditingProperty(false);{NL}"
    f"      {NL}"
    f"      // データを再読み込み{NL}"
    f"      await loadAllData();"
)

new3 = (
    f"  const handleSaveProperty = async () => {{{NL}"
    f"    if (!seller) return;{NL}"
    f"    {NL}"
    f"    try {{{NL}"
    f"      setSavingProperty(true);{NL}"
    f"      setError(null);{NL}"
    f"      setSuccessMessage(null);{NL}"
    f"{NL}"
    f"      if (property) {{{NL}"
    f"        // propertiesテーブルを更新{NL}"
    f"        await api.put(`/properties/${{property.id}}`, {{{NL}"
    f"          address: editedPropertyAddress,{NL}"
    f"          propertyType: editedPropertyType || null,{NL}"
    f"          landArea: editedLandArea ? parseFloat(editedLandArea) : null,{NL}"
    f"          buildingArea: editedBuildingArea ? parseFloat(editedBuildingArea) : null,{NL}"
    f"          buildYear: editedBuildYear ? parseInt(editedBuildYear, 10) : null,{NL}"
    f"          floorPlan: editedFloorPlan || null,{NL}"
    f"          structure: editedStructure || null,{NL}"
    f"          sellerSituation: editedSellerSituation || null,{NL}"
    f"        }});{NL}"
    f"      }} else {{{NL}"
    f"        // propertyがない場合はsellersテーブルを直接更新{NL}"
    f"        await api.put(`/api/sellers/${{id}}`, {{{NL}"
    f"          propertyAddress: editedPropertyAddress || null,{NL}"
    f"          propertyType: editedPropertyType || null,{NL}"
    f"          landArea: editedLandArea ? parseFloat(editedLandArea) : null,{NL}"
    f"          buildingArea: editedBuildingArea ? parseFloat(editedBuildingArea) : null,{NL}"
    f"          buildYear: editedBuildYear ? parseInt(editedBuildYear, 10) : null,{NL}"
    f"          floorPlan: editedFloorPlan || null,{NL}"
    f"          structure: editedStructure || null,{NL}"
    f"          currentStatus: editedSellerSituation || null,{NL}"
    f"        }});{NL}"
    f"        // ローカル状態も更新{NL}"
    f"        setSeller(prev => prev ? {{{NL}"
    f"          ...prev,{NL}"
    f"          propertyAddress: editedPropertyAddress || undefined,{NL}"
    f"          propertyType: editedPropertyType || undefined,{NL}"
    f"          landArea: editedLandArea ? parseFloat(editedLandArea) : undefined,{NL}"
    f"          buildingArea: editedBuildingArea ? parseFloat(editedBuildingArea) : undefined,{NL}"
    f"          buildYear: editedBuildYear ? parseInt(editedBuildYear, 10) : undefined,{NL}"
    f"          floorPlan: editedFloorPlan || undefined,{NL}"
    f"          structure: editedStructure || undefined,{NL}"
    f"          currentStatus: editedSellerSituation || undefined,{NL}"
    f"        }} : prev);{NL}"
    f"      }}{NL}"
    f"{NL}"
    f"      setSuccessMessage('物件情報を更新しました');{NL}"
    f"      setEditingProperty(false);{NL}"
    f"      {NL}"
    f"      // データを再読み込み{NL}"
    f"      await loadAllData();"
)

if old3 in text:
    text = text.replace(old3, new3, 1)
    print('✅ Step 3: handleSaveProperty updated')
else:
    print('❌ Step 3: not found')
    idx = text.find('handleSaveProperty = async')
    if idx >= 0:
        print(repr(text[idx:idx+300]))

# ========== 4. 表示モードの物件住所をInlineEditableFieldに変更 ==========
# 現在: 読み取り専用のTypography
# 修正: InlineEditableFieldで編集可能に
old4 = (
    f"                    <Grid item xs={{12}}>{NL}"
    f"                      <Box sx={{{{ mb: 2 }}}}>{NL}"
    f"                        <Typography variant=\"body2\" color=\"text.secondary\">{NL}"
    f"                          物件住所{NL}"
    f"                        </Typography>{NL}"
    f"                        <Typography variant=\"body1\" sx={{{{ fontWeight: 'bold' }}}}>{NL}"
    f"                          {{property?.address || seller?.propertyAddress || '未登録'}}{NL}"
    f"                        </Typography>{NL}"
    f"                      </Box>{NL}"
    f"                    </Grid>"
)

new4 = (
    f"                    <Grid item xs={{12}}>{NL}"
    f"                      <InlineEditableField{NL}"
    f"                        label=\"物件住所\"{NL}"
    f"                        value={{property?.address || seller?.propertyAddress || ''}}{NL}"
    f"                        fieldName=\"propertyAddress\"{NL}"
    f"                        fieldType=\"text\"{NL}"
    f"                        onSave={{async (newValue) => {{{NL}"
    f"                          if (property) {{{NL}"
    f"                            await api.put(`/properties/${{property.id}}`, {{ address: newValue }});{NL}"
    f"                          }} else {{{NL}"
    f"                            await api.put(`/api/sellers/${{id}}`, {{ propertyAddress: newValue }});{NL}"
    f"                            setSeller(prev => prev ? {{ ...prev, propertyAddress: newValue }} : prev);{NL}"
    f"                          }}{NL}"
    f"                        }}}}{NL}"
    f"                        buyerId={{id}}{NL}"
    f"                        showEditIndicator={{true}}{NL}"
    f"                      />{NL}"
    f"                    </Grid>"
)

if old4 in text:
    text = text.replace(old4, new4, 1)
    print('✅ Step 4: property address made editable')
else:
    print('❌ Step 4: not found')
    idx = text.find('property?.address || seller?.propertyAddress')
    if idx >= 0:
        print(repr(text[idx-100:idx+100]))

# ========== 5. 土地面積・建物面積・築年・間取りをInlineEditableFieldに変更 ==========
# 土地面積
old5 = (
    f"                    {{(property?.landArea || seller?.landArea) && ({NL}"
    f"                      <Grid item xs={{12}}>{NL}"
    f"                        <Box sx={{{{ mb: 2 }}}}>{NL}"
    f"                          <Typography variant=\"body2\" color=\"text.secondary\">{NL}"
    f"                            土地面積{NL}"
    f"                          </Typography>{NL}"
    f"                          <Typography variant=\"body1\">{{property?.landArea || seller?.landArea}} m²</Typography>{NL}"
    f"                        </Box>{NL}"
    f"                      </Grid>{NL}"
    f"                    )}}"
)

new5 = (
    f"                    <Grid item xs={{12}}>{NL}"
    f"                      <InlineEditableField{NL}"
    f"                        label=\"土地面積 (m²)\"{NL}"
    f"                        value={{(property?.landArea || seller?.landArea)?.toString() || ''}}{NL}"
    f"                        fieldName=\"landArea\"{NL}"
    f"                        fieldType=\"text\"{NL}"
    f"                        onSave={{async (newValue) => {{{NL}"
    f"                          const parsed = newValue ? parseFloat(newValue) : null;{NL}"
    f"                          if (property) {{{NL}"
    f"                            await api.put(`/properties/${{property.id}}`, {{ landArea: parsed }});{NL}"
    f"                          }} else {{{NL}"
    f"                            await api.put(`/api/sellers/${{id}}`, {{ landArea: parsed }});{NL}"
    f"                            setSeller(prev => prev ? {{ ...prev, landArea: parsed ?? undefined }} : prev);{NL}"
    f"                          }}{NL}"
    f"                        }}}}{NL}"
    f"                        buyerId={{id}}{NL}"
    f"                        showEditIndicator={{true}}{NL}"
    f"                      />{NL}"
    f"                    </Grid>"
)

if old5 in text:
    text = text.replace(old5, new5, 1)
    print('✅ Step 5: land area made editable')
else:
    print('❌ Step 5: not found')
    idx = text.find('property?.landArea || seller?.landArea')
    if idx >= 0:
        print(repr(text[idx-100:idx+100]))

# 建物面積
old6 = (
    f"                    {{(property?.buildingArea || seller?.buildingArea) && ({NL}"
    f"                      <Grid item xs={{12}}>{NL}"
    f"                        <Box sx={{{{ mb: 2 }}}}>{NL}"
    f"                          <Typography variant=\"body2\" color=\"text.secondary\">{NL}"
    f"                            建物面積{NL}"
    f"                          </Typography>{NL}"
    f"                          <Typography variant=\"body1\">{{property?.buildingArea || seller?.buildingArea}} m²</Typography>{NL}"
    f"                        </Box>{NL}"
    f"                      </Grid>{NL}"
    f"                    )}}"
)

new6 = (
    f"                    <Grid item xs={{12}}>{NL}"
    f"                      <InlineEditableField{NL}"
    f"                        label=\"建物面積 (m²)\"{NL}"
    f"                        value={{(property?.buildingArea || seller?.buildingArea)?.toString() || ''}}{NL}"
    f"                        fieldName=\"buildingArea\"{NL}"
    f"                        fieldType=\"text\"{NL}"
    f"                        onSave={{async (newValue) => {{{NL}"
    f"                          const parsed = newValue ? parseFloat(newValue) : null;{NL}"
    f"                          if (property) {{{NL}"
    f"                            await api.put(`/properties/${{property.id}}`, {{ buildingArea: parsed }});{NL}"
    f"                          }} else {{{NL}"
    f"                            await api.put(`/api/sellers/${{id}}`, {{ buildingArea: parsed }});{NL}"
    f"                            setSeller(prev => prev ? {{ ...prev, buildingArea: parsed ?? undefined }} : prev);{NL}"
    f"                          }}{NL}"
    f"                        }}}}{NL}"
    f"                        buyerId={{id}}{NL}"
    f"                        showEditIndicator={{true}}{NL}"
    f"                      />{NL}"
    f"                    </Grid>"
)

if old6 in text:
    text = text.replace(old6, new6, 1)
    print('✅ Step 6: building area made editable')
else:
    print('❌ Step 6: not found')
    idx = text.find('property?.buildingArea || seller?.buildingArea')
    if idx >= 0:
        print(repr(text[idx-100:idx+100]))

# 築年
old7 = (
    f"                    {{(property?.buildYear || seller?.buildYear) && ({NL}"
    f"                      <Grid item xs={{12}}>{NL}"
    f"                        <Box sx={{{{ mb: 2 }}}}>{NL}"
    f"                          <Typography variant=\"body2\" color=\"text.secondary\">{NL}"
    f"                            築年{NL}"
    f"                          </Typography>{NL}"
    f"                          <Typography variant=\"body1\">{{property?.buildYear || seller?.buildYear}}年</Typography>{NL}"
    f"                        </Box>{NL}"
    f"                      </Grid>{NL}"
    f"                    )}}"
)

new7 = (
    f"                    <Grid item xs={{12}}>{NL}"
    f"                      <InlineEditableField{NL}"
    f"                        label=\"築年\"{NL}"
    f"                        value={{(property?.buildYear || seller?.buildYear)?.toString() || ''}}{NL}"
    f"                        fieldName=\"buildYear\"{NL}"
    f"                        fieldType=\"text\"{NL}"
    f"                        onSave={{async (newValue) => {{{NL}"
    f"                          const parsed = newValue ? parseInt(newValue, 10) : null;{NL}"
    f"                          if (property) {{{NL}"
    f"                            await api.put(`/properties/${{property.id}}`, {{ buildYear: parsed }});{NL}"
    f"                          }} else {{{NL}"
    f"                            await api.put(`/api/sellers/${{id}}`, {{ buildYear: parsed }});{NL}"
    f"                            setSeller(prev => prev ? {{ ...prev, buildYear: parsed ?? undefined }} : prev);{NL}"
    f"                          }}{NL}"
    f"                        }}}}{NL}"
    f"                        buyerId={{id}}{NL}"
    f"                        showEditIndicator={{true}}{NL}"
    f"                      />{NL}"
    f"                    </Grid>"
)

if old7 in text:
    text = text.replace(old7, new7, 1)
    print('✅ Step 7: build year made editable')
else:
    print('❌ Step 7: not found')
    idx = text.find('property?.buildYear || seller?.buildYear')
    if idx >= 0:
        print(repr(text[idx-100:idx+100]))

# 間取り
old8 = (
    f"                    {{(property?.floorPlan || seller?.floorPlan) && ({NL}"
    f"                      <Grid item xs={{12}}>{NL}"
    f"                        <Box sx={{{{ mb: 2 }}}}>{NL}"
    f"                          <Typography variant=\"body2\" color=\"text.secondary\">{NL}"
    f"                            間取り{NL}"
    f"                          </Typography>{NL}"
    f"                          <Typography variant=\"body1\">{{property?.floorPlan || seller?.floorPlan}}</Typography>{NL}"
    f"                        </Box>{NL}"
    f"                      </Grid>{NL}"
    f"                    )}}"
)

new8 = (
    f"                    <Grid item xs={{12}}>{NL}"
    f"                      <InlineEditableField{NL}"
    f"                        label=\"間取り\"{NL}"
    f"                        value={{property?.floorPlan || seller?.floorPlan || ''}}{NL}"
    f"                        fieldName=\"floorPlan\"{NL}"
    f"                        fieldType=\"text\"{NL}"
    f"                        onSave={{async (newValue) => {{{NL}"
    f"                          if (property) {{{NL}"
    f"                            await api.put(`/properties/${{property.id}}`, {{ floorPlan: newValue || null }});{NL}"
    f"                          }} else {{{NL}"
    f"                            await api.put(`/api/sellers/${{id}}`, {{ floorPlan: newValue || null }});{NL}"
    f"                            setSeller(prev => prev ? {{ ...prev, floorPlan: newValue || undefined }} : prev);{NL}"
    f"                          }}{NL}"
    f"                        }}}}{NL}"
    f"                        buyerId={{id}}{NL}"
    f"                        showEditIndicator={{true}}{NL}"
    f"                      />{NL}"
    f"                    </Grid>"
)

if old8 in text:
    text = text.replace(old8, new8, 1)
    print('✅ Step 8: floor plan made editable')
else:
    print('❌ Step 8: not found')
    idx = text.find('property?.floorPlan || seller?.floorPlan')
    if idx >= 0:
        print(repr(text[idx-100:idx+100]))

with open('frontend/frontend/src/pages/CallModePage.tsx', 'wb') as f:
    f.write(text.encode('utf-8'))
print('Done!')
