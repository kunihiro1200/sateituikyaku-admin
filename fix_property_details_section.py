#!/usr/bin/env python3
# PropertyDetailsSection.tsx に売出価格・月々ローン支払いを追加

with open('frontend/frontend/src/components/PropertyDetailsSection.tsx', 'rb') as f:
    content = f.read()

text = content.decode('utf-8')

# 1. インターフェースに sales_price, price, property_type を追加
old_interface = """interface PropertyListing {
  land_area?: number;
  building_area?: number;
  exclusive_area?: number;
  structure?: string;
  construction_year_month?: string;
  floor_plan?: string;
  contract_date?: string;
  settlement_date?: string;
}"""

new_interface = """interface PropertyListing {
  land_area?: number;
  building_area?: number;
  exclusive_area?: number;
  structure?: string;
  construction_year_month?: string;
  floor_plan?: string;
  contract_date?: string;
  settlement_date?: string;
  sales_price?: number;
  price?: number;
  property_type?: string;
}"""

text = text.replace(old_interface, new_interface)

# 2. 月々ローン計算ヘルパー関数を追加（コンポーネント定義の直前）
old_export = "export default function PropertyDetailsSection({"

new_export = """// 月々ローン支払い計算（元利均等返済、金利3%/年、35年）
function calcMonthlyPayment(price: number): number {
  const r = 0.0007916666667; // 月利 = 3% / 12
  const n = 420; // 35年 * 12ヶ月
  return price * r * Math.pow(1 + r, n) / (Math.pow(1 + r, n) - 1);
}

export default function PropertyDetailsSection({"""

text = text.replace(old_export, new_export)

# 3. 表示モード（isEditMode=false）の Grid に売出価格・月々ローンを追加
# 決済日の後に追加する
old_display_end = """          <Grid item xs={6}>
            <Typography variant="body2" sx={{ fontWeight: 700, fontSize: '1rem', color: 'text.primary', mb: 0.5 }}>
              決済日
            </Typography>
            <Typography variant="body1">
              {formatValue(data.settlement_date)}
            </Typography>
          </Grid>
        </Grid>
      )}
    </Box>
  );
}"""

new_display_end = """          <Grid item xs={6}>
            <Typography variant="body2" sx={{ fontWeight: 700, fontSize: '1rem', color: 'text.primary', mb: 0.5 }}>
              決済日
            </Typography>
            <Typography variant="body1">
              {formatValue(data.settlement_date)}
            </Typography>
          </Grid>
          <Grid item xs={6}>
            <Typography variant="body2" sx={{ fontWeight: 700, fontSize: '1rem', color: 'text.primary', mb: 0.5 }}>
              売出価格
            </Typography>
            <Typography variant="body1">
              {(data.price || data.sales_price) ? `¥${(data.price || data.sales_price)!.toLocaleString()}` : '-'}
            </Typography>
          </Grid>
          {(data.property_type === '戸建て' || data.property_type === 'マンション') && (data.price || data.sales_price) && (
            <Grid item xs={6}>
              <Typography variant="body2" sx={{ fontWeight: 700, fontSize: '1rem', color: 'text.primary', mb: 0.5 }}>
                月々ローン支払い
              </Typography>
              <Typography variant="body1" sx={{ color: '#1565c0', fontWeight: 'bold' }}>
                約¥{Math.round(calcMonthlyPayment(data.price || data.sales_price!)).toLocaleString()}/月
              </Typography>
              <Typography variant="caption" color="text.secondary">
                （金利3%・35年・元利均等）
              </Typography>
            </Grid>
          )}
        </Grid>
      )}
    </Box>
  );
}"""

text = text.replace(old_display_end, new_display_end)

# 4. 編集モード（isEditMode=true）の Grid にも売出価格を追加（読み取り専用表示）
old_edit_end = """          <Grid item xs={6}>
            <Typography variant="body2" sx={{ fontWeight: 700, fontSize: '1rem', color: 'text.primary', mb: 0.5 }}>
              決済日
            </Typography>
            <TextField
              fullWidth
              size="small"
              type="date"
              value={getValue('settlement_date', data.settlement_date)}
              onChange={(e) => onFieldChange('settlement_date', e.target.value)}
              InputLabelProps={{ shrink: true }}
            />
          </Grid>
        </Grid>
      ) : ("""

new_edit_end = """          <Grid item xs={6}>
            <Typography variant="body2" sx={{ fontWeight: 700, fontSize: '1rem', color: 'text.primary', mb: 0.5 }}>
              決済日
            </Typography>
            <TextField
              fullWidth
              size="small"
              type="date"
              value={getValue('settlement_date', data.settlement_date)}
              onChange={(e) => onFieldChange('settlement_date', e.target.value)}
              InputLabelProps={{ shrink: true }}
            />
          </Grid>
          <Grid item xs={6}>
            <Typography variant="body2" sx={{ fontWeight: 700, fontSize: '1rem', color: 'text.primary', mb: 0.5 }}>
              売出価格（参照）
            </Typography>
            <Typography variant="body1">
              {(data.price || data.sales_price) ? `¥${(data.price || data.sales_price)!.toLocaleString()}` : '-'}
            </Typography>
          </Grid>
          {(data.property_type === '戸建て' || data.property_type === 'マンション') && (data.price || data.sales_price) && (
            <Grid item xs={6}>
              <Typography variant="body2" sx={{ fontWeight: 700, fontSize: '1rem', color: 'text.primary', mb: 0.5 }}>
                月々ローン支払い
              </Typography>
              <Typography variant="body1" sx={{ color: '#1565c0', fontWeight: 'bold' }}>
                約¥{Math.round(calcMonthlyPayment(data.price || data.sales_price!)).toLocaleString()}/月
              </Typography>
              <Typography variant="caption" color="text.secondary">
                （金利3%・35年・元利均等）
              </Typography>
            </Grid>
          )}
        </Grid>
      ) : ("""

text = text.replace(old_edit_end, new_edit_end)

with open('frontend/frontend/src/components/PropertyDetailsSection.tsx', 'wb') as f:
    f.write(text.encode('utf-8'))

print('Done! PropertyDetailsSection.tsx updated.')
