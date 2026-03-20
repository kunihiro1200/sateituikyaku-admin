with open('frontend/frontend/src/pages/CallModePage.tsx', 'rb') as f:
    content = f.read()

# CRLF -> LF に変換して処理
text = content.decode('utf-8').replace('\r\n', '\n')

# 1. 土地面積 (m²) を readOnly に変更（種別が土の場合は編集不可）
old1 = '                    <Grid item xs={12}>\n                      <InlineEditableField\n                        label="土地面積 (m²)"\n                        value={(property?.landArea || seller?.landArea)?.toString() || \'\'}\n                        fieldName="landArea"\n                        fieldType="text"\n                        onSave={async (newValue) => {\n                          const parsed = newValue ? parseFloat(newValue) : null;\n                          if (property) {\n                            await api.put(`/properties/${property.id}`, { landArea: parsed });\n                          } else {\n                            await api.put(`/api/sellers/${id}`, { landArea: parsed });\n                            setSeller(prev => prev ? { ...prev, landArea: parsed ?? undefined } : prev);\n                          }\n                        }}\n                        buyerId={id}\n                        showEditIndicator={true}\n                      />\n                    </Grid>'

new1 = '                    <Grid item xs={12}>\n                      <InlineEditableField\n                        label="土地面積 (m²)"\n                        value={(property?.landArea || seller?.landArea)?.toString() || \'\'}\n                        fieldName="landArea"\n                        fieldType="text"\n                        readOnly={propInfo.propertyType === \'land\'}\n                        onSave={async (newValue) => {\n                          const parsed = newValue ? parseFloat(newValue) : null;\n                          if (property) {\n                            await api.put(`/properties/${property.id}`, { landArea: parsed });\n                          } else {\n                            await api.put(`/api/sellers/${id}`, { landArea: parsed });\n                            setSeller(prev => prev ? { ...prev, landArea: parsed ?? undefined } : prev);\n                          }\n                        }}\n                        buyerId={id}\n                        showEditIndicator={true}\n                      />\n                    </Grid>'

if old1 in text:
    text = text.replace(old1, new1)
    print('Step 1 done: landArea readOnly added')
else:
    print('ERROR Step 1: target not found')
    idx = text.find('土地面積 (m²)')
    print(repr(text[idx-100:idx+300]))

# 2. 建物面積 (m²) を種別が土の場合は非表示
old2 = '                    <Grid item xs={12}>\n                      <InlineEditableField\n                        label="建物面積 (m²)"\n                        value={(property?.buildingArea || seller?.buildingArea)?.toString() || \'\'}\n                        fieldName="buildingArea"\n                        fieldType="text"\n                        onSave={async (newValue) => {\n                          const parsed = newValue ? parseFloat(newValue) : null;\n                          if (property) {\n                            await api.put(`/properties/${property.id}`, { buildingArea: parsed });\n                          } else {\n                            await api.put(`/api/sellers/${id}`, { buildingArea: parsed });\n                            setSeller(prev => prev ? { ...prev, buildingArea: parsed ?? undefined } : prev);\n                          }\n                        }}\n                        buyerId={id}\n                        showEditIndicator={true}\n                      />\n                    </Grid>'

new2 = '                    {propInfo.propertyType !== \'land\' && (\n                    <Grid item xs={12}>\n                      <InlineEditableField\n                        label="建物面積 (m²)"\n                        value={(property?.buildingArea || seller?.buildingArea)?.toString() || \'\'}\n                        fieldName="buildingArea"\n                        fieldType="text"\n                        onSave={async (newValue) => {\n                          const parsed = newValue ? parseFloat(newValue) : null;\n                          if (property) {\n                            await api.put(`/properties/${property.id}`, { buildingArea: parsed });\n                          } else {\n                            await api.put(`/api/sellers/${id}`, { buildingArea: parsed });\n                            setSeller(prev => prev ? { ...prev, buildingArea: parsed ?? undefined } : prev);\n                          }\n                        }}\n                        buyerId={id}\n                        showEditIndicator={true}\n                      />\n                    </Grid>\n                    )}'

if old2 in text:
    text = text.replace(old2, new2)
    print('Step 2 done: buildingArea hidden for land')
else:
    print('ERROR Step 2: target not found')

# 3. 建物面積（当社調べ）を種別が土の場合は非表示
old3 = '                    <Grid item xs={12}>\n                      <InlineEditableField\n                        label="建物面積（当社調べ）(m²)"\n                        value={property?.buildingAreaVerified?.toString() || seller?.buildingAreaVerified?.toString() || \'\'}\n                        fieldName="buildingAreaVerified"\n                        fieldType="text"\n                        onSave={async (newValue) => {\n                          const parsed = newValue ? parseFloat(newValue) : null;\n                          if (property) {\n                            await api.put(`/properties/${property.id}`, { buildingAreaVerified: parsed });\n                            setProperty(prev => prev ? { ...prev, buildingAreaVerified: parsed ?? undefined } : prev);\n                          } else if (seller) {\n                            await api.put(`/sellers/${seller.id}`, { buildingAreaVerified: parsed });\n                            setSeller(prev => prev ? { ...prev, buildingAreaVerified: parsed ?? undefined } : prev);\n                          }\n                        }}\n                        buyerId={id}\n                        showEditIndicator={true}\n                      />\n                    </Grid>'

new3 = '                    {propInfo.propertyType !== \'land\' && (\n                    <Grid item xs={12}>\n                      <InlineEditableField\n                        label="建物面積（当社調べ）(m²)"\n                        value={property?.buildingAreaVerified?.toString() || seller?.buildingAreaVerified?.toString() || \'\'}\n                        fieldName="buildingAreaVerified"\n                        fieldType="text"\n                        onSave={async (newValue) => {\n                          const parsed = newValue ? parseFloat(newValue) : null;\n                          if (property) {\n                            await api.put(`/properties/${property.id}`, { buildingAreaVerified: parsed });\n                            setProperty(prev => prev ? { ...prev, buildingAreaVerified: parsed ?? undefined } : prev);\n                          } else if (seller) {\n                            await api.put(`/sellers/${seller.id}`, { buildingAreaVerified: parsed });\n                            setSeller(prev => prev ? { ...prev, buildingAreaVerified: parsed ?? undefined } : prev);\n                          }\n                        }}\n                        buyerId={id}\n                        showEditIndicator={true}\n                      />\n                    </Grid>\n                    )}'

if old3 in text:
    text = text.replace(old3, new3)
    print('Step 3 done: buildingAreaVerified hidden for land')
else:
    print('ERROR Step 3: target not found')

# 4. 築年を種別が土の場合は非表示
old4 = '                    <Grid item xs={12}>\n                      <InlineEditableField\n                        label="築年"\n                        value={(property?.buildYear || seller?.buildYear)?.toString() || \'\'}\n                        fieldName="buildYear"\n                        fieldType="text"\n                        onSave={async (newValue) => {\n                          const parsed = newValue ? parseInt(newValue, 10) : null;\n                          if (property) {\n                            await api.put(`/properties/${property.id}`, { buildYear: parsed });\n                          } else {\n                            await api.put(`/api/sellers/${id}`, { buildYear: parsed });\n                            setSeller(prev => prev ? { ...prev, buildYear: parsed ?? undefined } : prev);\n                          }\n                        }}\n                        buyerId={id}\n                        showEditIndicator={true}\n                      />\n                    </Grid>'

new4 = '                    {propInfo.propertyType !== \'land\' && (\n                    <Grid item xs={12}>\n                      <InlineEditableField\n                        label="築年"\n                        value={(property?.buildYear || seller?.buildYear)?.toString() || \'\'}\n                        fieldName="buildYear"\n                        fieldType="text"\n                        onSave={async (newValue) => {\n                          const parsed = newValue ? parseInt(newValue, 10) : null;\n                          if (property) {\n                            await api.put(`/properties/${property.id}`, { buildYear: parsed });\n                          } else {\n                            await api.put(`/api/sellers/${id}`, { buildYear: parsed });\n                            setSeller(prev => prev ? { ...prev, buildYear: parsed ?? undefined } : prev);\n                          }\n                        }}\n                        buyerId={id}\n                        showEditIndicator={true}\n                      />\n                    </Grid>\n                    )}'

if old4 in text:
    text = text.replace(old4, new4)
    print('Step 4 done: buildYear hidden for land')
else:
    print('ERROR Step 4: target not found')

# 5. 間取りを種別が土の場合は非表示
old5 = '                    <Grid item xs={12}>\n                      <InlineEditableField\n                        label="間取り"\n                        value={property?.floorPlan || seller?.floorPlan || \'\'}\n                        fieldName="floorPlan"\n                        fieldType="text"\n                        onSave={async (newValue) => {\n                          if (property) {\n                            await api.put(`/properties/${property.id}`, { floorPlan: newValue || null });\n                          } else {\n                            await api.put(`/api/sellers/${id}`, { floorPlan: newValue || null });\n                            setSeller(prev => prev ? { ...prev, floorPlan: newValue || undefined } : prev);\n                          }\n                        }}\n                        buyerId={id}\n                        showEditIndicator={true}\n                      />\n                    </Grid>'

new5 = '                    {propInfo.propertyType !== \'land\' && (\n                    <Grid item xs={12}>\n                      <InlineEditableField\n                        label="間取り"\n                        value={property?.floorPlan || seller?.floorPlan || \'\'}\n                        fieldName="floorPlan"\n                        fieldType="text"\n                        onSave={async (newValue) => {\n                          if (property) {\n                            await api.put(`/properties/${property.id}`, { floorPlan: newValue || null });\n                          } else {\n                            await api.put(`/api/sellers/${id}`, { floorPlan: newValue || null });\n                            setSeller(prev => prev ? { ...prev, floorPlan: newValue || undefined } : prev);\n                          }\n                        }}\n                        buyerId={id}\n                        showEditIndicator={true}\n                      />\n                    </Grid>\n                    )}'

if old5 in text:
    text = text.replace(old5, new5)
    print('Step 5 done: floorPlan hidden for land')
else:
    print('ERROR Step 5: target not found')

# 6. 構造を種別が土の場合は非表示
old6 = '                    <Grid item xs={12}>\n                      <InlineEditableField\n                        label="構造"\n                        value={property?.structure || seller?.structure || \'\'}\n                        fieldName="structure"\n                        fieldType="dropdown"\n                        options={STRUCTURE_OPTIONS}\n                        onSave={async (newValue) => {\n                          await api.put(`/api/sellers/${id}`, {\n                            structure: newValue,\n                          });\n                          // ローカル状態を更新\n                          setSeller(prev => prev ? { ...prev, structure: newValue } : prev);\n                          setEditedStructure(newValue);\n                        }}\n                        buyerId={id}\n                        enableConflictDetection={true}\n                        showEditIndicator={true}\n                        oneClickDropdown={true}\n                      />\n                    </Grid>'

new6 = '                    {propInfo.propertyType !== \'land\' && (\n                    <Grid item xs={12}>\n                      <InlineEditableField\n                        label="構造"\n                        value={property?.structure || seller?.structure || \'\'}\n                        fieldName="structure"\n                        fieldType="dropdown"\n                        options={STRUCTURE_OPTIONS}\n                        onSave={async (newValue) => {\n                          await api.put(`/api/sellers/${id}`, {\n                            structure: newValue,\n                          });\n                          // ローカル状態を更新\n                          setSeller(prev => prev ? { ...prev, structure: newValue } : prev);\n                          setEditedStructure(newValue);\n                        }}\n                        buyerId={id}\n                        enableConflictDetection={true}\n                        showEditIndicator={true}\n                        oneClickDropdown={true}\n                      />\n                    </Grid>\n                    )}'

if old6 in text:
    text = text.replace(old6, new6)
    print('Step 6 done: structure hidden for land')
else:
    print('ERROR Step 6: target not found')

# CRLF に戻して書き込み
with open('frontend/frontend/src/pages/CallModePage.tsx', 'wb') as f:
    f.write(text.replace('\n', '\r\n').encode('utf-8'))

print('All done!')
