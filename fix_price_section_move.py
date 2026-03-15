#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
1. PriceSection.tsx: 「売出価格」を削除し、「月々ローン支払い」を追加
2. PropertyListingDetailPage.tsx: 基本情報に「売出価格」を追加、PriceSectionにprops追加
"""

# ===== 1. PriceSection.tsx の修正 =====
with open('frontend/frontend/src/components/PriceSection.tsx', 'rb') as f:
    content = f.read()
text = content.decode('utf-8')

# interfaceに salesPriceActual と propertyType を追加
old_interface = """interface PriceSectionProps {
  salesPrice?: number;
  listingPrice?: number;"""
new_interface = """// 月々ローン支払い計算（元利均等返済、金利3%/年、35年）
function calcMonthlyPayment(price: number): number {
  const r = 0.03 / 12;
  const n = 35 * 12;
  return Math.round(price * r * Math.pow(1 + r, n) / (Math.pow(1 + r, n) - 1));
}

interface PriceSectionProps {
  salesPrice?: number;
  salesPriceActual?: number;
  listingPrice?: number;
  propertyType?: string;"""
text = text.replace(old_interface, new_interface)

# 関数引数に追加
old_args = """export default function PriceSection({
  salesPrice,
  listingPrice,"""
new_args = """export default function PriceSection({
  salesPrice,
  salesPriceActual,
  listingPrice,
  propertyType,"""
text = text.replace(old_args, new_args)

# 表示変数の後に月々ローン計算を追加
old_display = """  const displaySalesPrice = editedData.sales_price !== undefined ? editedData.sales_price : salesPrice;
  const displayListingPrice = editedData.listing_price !== undefined ? editedData.listing_price : listingPrice;"""
new_display = """  const displaySalesPrice = editedData.sales_price !== undefined ? editedData.sales_price : salesPrice;
  const displayListingPrice = editedData.listing_price !== undefined ? editedData.listing_price : listingPrice;
  const actualPrice = editedData.sales_price !== undefined ? editedData.sales_price : salesPriceActual;
  const showMonthlyPayment = propertyType === '戸建て' || propertyType === 'マンション' || propertyType === '戸' || propertyType === 'マ';
  const monthlyPayment = actualPrice ? calcMonthlyPayment(actualPrice) : null;"""
text = text.replace(old_display, new_display)

# 編集モードの「売出価格」フィールドを削除
old_edit_listing = """          <Grid item xs={12} sm={6}>
            <Typography variant="body2" color="text.secondary" gutterBottom>
              売出価格
            </Typography>
            <TextField
              fullWidth
              type="number"
              value={displayListingPrice || ''}
              onChange={(e) => onFieldChange('listing_price', e.target.value ? Number(e.target.value) : null)}
              InputProps={{
                startAdornment: <Typography sx={{ mr: 1 }}>¥</Typography>,
              }}
              sx={{
                '& .MuiInputBase-input': {
                  fontSize: '20px',
                  fontWeight: 'medium',
                },
              }}
            />
          </Grid>"""
text = text.replace(old_edit_listing, '')

# 表示モードの「売出価格」ブロックを削除し、月々ローンを追加
old_view_listing = """          <Box sx={{ mb: 2 }}>
            <Typography variant="body1" color="text.secondary" gutterBottom sx={{ fontSize: '1.1rem', fontWeight: 'bold' }}>
              売出価格
            </Typography>
            <Typography variant="h4" fontWeight="medium" sx={{ fontSize: '2rem' }}>
              {formatPrice(displayListingPrice)}
            </Typography>
          </Box>"""
new_view_listing = """          {showMonthlyPayment && monthlyPayment && (
            <Box sx={{ mb: 2 }}>
              <Typography variant="body1" color="text.secondary" gutterBottom sx={{ fontSize: '1.1rem', fontWeight: 'bold' }}>
                月々ローン支払い
              </Typography>
              <Typography variant="h4" fontWeight="medium" sx={{ fontSize: '1.8rem', color: '#1976d2' }}>
                ¥{monthlyPayment.toLocaleString()}/月
              </Typography>
              <Typography variant="caption" color="text.secondary">
                ※金利3%・35年・元利均等返済
              </Typography>
            </Box>
          )}"""
text = text.replace(old_view_listing, new_view_listing)

with open('frontend/frontend/src/components/PriceSection.tsx', 'wb') as f:
    f.write(text.encode('utf-8'))

print('PriceSection.tsx 修正完了')

# ===== 2. PropertyListingDetailPage.tsx の修正 =====
with open('frontend/frontend/src/pages/PropertyListingDetailPage.tsx', 'rb') as f:
    content = f.read()
text = content.decode('utf-8')

# PriceSectionに salesPriceActual と propertyType を追加
old_price_section = """                <PriceSection
                  salesPrice={data.price}
                  listingPrice={data.listing_price}"""
new_price_section = """                <PriceSection
                  salesPrice={data.price}
                  salesPriceActual={editedData.sales_price !== undefined ? editedData.sales_price : data.sales_price}
                  listingPrice={data.listing_price}
                  propertyType={editedData.property_type !== undefined ? editedData.property_type : data.property_type}"""
text = text.replace(old_price_section, new_price_section)

# 基本情報セクションの「種別」の後に「売出価格」を追加
old_basic_type = """              <Grid item xs={6}>
                <Typography variant="body2" sx={{ fontWeight: 700, fontSize: '1rem', color: 'text.primary', mb: 0.5 }}>種別</Typography>
                {isBasicInfoEditMode ? (
                  <TextField fullWidth size="small"
                    value={editedData.property_type !== undefined ? editedData.property_type : (data.property_type || '')}
                    onChange={(e) => handleFieldChange('property_type', e.target.value)} />
                ) : (
                  <Typography variant="body1">{data.property_type || '-'}</Typography>
                )}
              </Grid>"""
new_basic_type = """              <Grid item xs={6}>
                <Typography variant="body2" sx={{ fontWeight: 700, fontSize: '1rem', color: 'text.primary', mb: 0.5 }}>種別</Typography>
                {isBasicInfoEditMode ? (
                  <TextField fullWidth size="small"
                    value={editedData.property_type !== undefined ? editedData.property_type : (data.property_type || '')}
                    onChange={(e) => handleFieldChange('property_type', e.target.value)} />
                ) : (
                  <Typography variant="body1">{data.property_type || '-'}</Typography>
                )}
              </Grid>
              <Grid item xs={6}>
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
text = text.replace(old_basic_type, new_basic_type)

with open('frontend/frontend/src/pages/PropertyListingDetailPage.tsx', 'wb') as f:
    f.write(text.encode('utf-8'))

print('PropertyListingDetailPage.tsx 修正完了')
print('完了！')
