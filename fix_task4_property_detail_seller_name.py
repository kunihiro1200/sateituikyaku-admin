#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
PropertyListingDetailPage.tsx: 種別の左側に売主氏名を追加
"""

filepath = 'frontend/frontend/src/pages/PropertyListingDetailPage.tsx'

with open(filepath, 'rb') as f:
    content = f.read()

text = content.decode('utf-8')

# 種別の Grid item の前に売主氏名の Grid item を追加
old_section = """          <Grid item xs={12} sm={6} md={3}>
            <Typography variant="body2" color="text.secondary" fontWeight="bold">種別</Typography>
            <Typography variant="body1" fontWeight="medium">
              {data.property_type || '-'}
            </Typography>
          </Grid>"""

new_section = """          <Grid item xs={12} sm={6} md={3}>
            <Typography variant="body2" color="text.secondary" fontWeight="bold">売主氏名</Typography>
            <Typography variant="body1" fontWeight="medium">
              {data.seller_name || '-'}
            </Typography>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Typography variant="body2" color="text.secondary" fontWeight="bold">種別</Typography>
            <Typography variant="body1" fontWeight="medium">
              {data.property_type || '-'}
            </Typography>
          </Grid>"""

if old_section in text:
    text = text.replace(old_section, new_section)
    print('種別の左側に売主氏名を追加しました')
else:
    print('ERROR: 対象箇所が見つかりませんでした')

with open(filepath, 'wb') as f:
    f.write(text.encode('utf-8'))

print('Done!')
