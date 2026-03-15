#!/usr/bin/env python3
# PropertyListingDetailPage.tsx の修正:
# 1. 基本情報セクションから「売出価格」を削除
# 2. PropertyDetailsSection に price/sales_price/property_type を渡す

with open('frontend/frontend/src/pages/PropertyListingDetailPage.tsx', 'rb') as f:
    content = f.read()

text = content.decode('utf-8')

# 1. 基本情報セクションの「売出価格」フィールドを削除
old_sales_price_field = """              <Grid item xs={6}>
                <Typography variant="body2" sx={{ fontWeight: 700, fontSize: '1rem', color: 'text.primary', mb: 0.5 }}>売出価格</Typography>
                {isBasicInfoEditMode ? (
                  <TextField fullWidth size="small" type="number"
                    value={editedData.listing_price !== undefined ? editedData.listing_price : (data.listing_price || '')}
                    onChange={(e) => handleFieldChange('listing_price', e.target.value ? Number(e.target.value) : null)}
                    InputProps={{ startAdornment: <Typography sx={{ mr: 0.5 }}>¥</Typography> }} />
                ) : (
                  <Typography variant="body1">{data.listing_price ? `¥${data.listing_price.toLocaleString()}` : '-'}</Typography>
                )}
              </Grid>"""

text = text.replace(old_sales_price_field, '')

# 2. PropertyDetailsSection に price/sales_price/property_type を渡す
old_details_section = """                <PropertyDetailsSection data={data} editedData={editedData}
                  onFieldChange={handleFieldChange} isEditMode={isPropertyDetailsEditMode} />"""

new_details_section = """                <PropertyDetailsSection
                  data={{
                    ...data,
                    price: editedData.price !== undefined ? editedData.price : data.price,
                    sales_price: editedData.sales_price !== undefined ? editedData.sales_price : data.sales_price,
                    property_type: editedData.property_type !== undefined ? editedData.property_type : data.property_type,
                  }}
                  editedData={editedData}
                  onFieldChange={handleFieldChange}
                  isEditMode={isPropertyDetailsEditMode}
                />"""

text = text.replace(old_details_section, new_details_section)

with open('frontend/frontend/src/pages/PropertyListingDetailPage.tsx', 'wb') as f:
    f.write(text.encode('utf-8'))

print('Done! PropertyListingDetailPage.tsx updated.')
