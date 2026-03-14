#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
merge-multiple エンドポイントにデバッグログを追加する
"""

with open('backend/src/routes/emailTemplates.ts', 'rb') as f:
    content = f.read()
text = content.decode('utf-8').replace('\r\n', '\n')

# UUID検索の前にデバッグログを追加
old_search = """    // UUID で検索
    const { data: propertiesById } = await supabase
      .from('property_listings')
      .select('id, property_number, address, price, google_map_url, athome_url, property_type, land_area, building_area')
      .in('id', propertyIds);

    const foundIds = new Set((propertiesById || []).map((p: any) => p.id));
    const missingIds = propertyIds.filter((id: string) => !foundIds.has(id));

    // 見つからなかった分は property_number で検索
    let propertiesByNumber: any[] = [];
    if (missingIds.length > 0) {
      const { data } = await supabase
        .from('property_listings')
        .select('id, property_number, address, price, google_map_url, athome_url, property_type, land_area, building_area')
        .in('property_number', missingIds);
      propertiesByNumber = data || [];
    }

    const allProperties = [...(propertiesById || []), ...propertiesByNumber];
    if (allProperties.length === 0) {
      return res.status(404).json({ error: 'No valid properties found' });
    }"""

new_search = """    // UUID で検索
    console.log('[merge-multiple] propertyIds received:', propertyIds);
    const { data: propertiesById, error: searchError } = await supabase
      .from('property_listings')
      .select('id, property_number, address, price, google_map_url, athome_url, property_type, land_area, building_area')
      .in('id', propertyIds);

    console.log('[merge-multiple] propertiesById:', propertiesById, 'error:', searchError);

    const foundIds = new Set((propertiesById || []).map((p: any) => p.id));
    const missingIds = propertyIds.filter((id: string) => !foundIds.has(id));
    console.log('[merge-multiple] missingIds (will try property_number search):', missingIds);

    // 見つからなかった分は property_number で検索
    let propertiesByNumber: any[] = [];
    if (missingIds.length > 0) {
      const { data, error: numError } = await supabase
        .from('property_listings')
        .select('id, property_number, address, price, google_map_url, athome_url, property_type, land_area, building_area')
        .in('property_number', missingIds);
      console.log('[merge-multiple] propertiesByNumber:', data, 'error:', numError);
      propertiesByNumber = data || [];
    }

    const allProperties = [...(propertiesById || []), ...propertiesByNumber];
    console.log('[merge-multiple] allProperties count:', allProperties.length);
    if (allProperties.length === 0) {
      return res.status(404).json({ error: 'No valid properties found' });
    }"""

if old_search in text:
    text = text.replace(old_search, new_search)
    print("✅ デバッグログを追加しました")
else:
    print("⚠️ パターンが見つかりませんでした")

with open('backend/src/routes/emailTemplates.ts', 'wb') as f:
    f.write(text.encode('utf-8'))

print("✅ 保存完了")
