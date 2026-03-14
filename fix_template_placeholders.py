#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
<<>> プレースホルダー置換処理を EmailTemplateService に追加し、
merge-multiple エンドポイントで実際の DB データを使うよう修正する
"""

# ============================================================
# 1. EmailTemplateService.ts に mergeAngleBracketPlaceholders を追加
# ============================================================
with open('backend/src/services/EmailTemplateService.ts', 'rb') as f:
    content = f.read().decode('utf-8')

new_method = '''
  /**
   * <<>> 形式のプレースホルダーを実際のデータで置換する
   * 例: <<住居表示>> → 物件住所, <<●氏名・会社名>> → 買主名
   */
  mergeAngleBracketPlaceholders(
    text: string,
    buyer: { name?: string; company_name?: string; buyer_number?: string; email?: string; [key: string]: any },
    properties: Array<{
      propertyNumber: string;
      address: string;
      price?: number;
      googleMapUrl?: string;
      athomeUrl?: string;
      detailUrl?: string;
      [key: string]: any;
    }>
  ): string {
    let result = text;

    // 買主情報の置換
    const buyerName = buyer.company_name
      ? `${buyer.name || ''}・${buyer.company_name}`
      : (buyer.name || buyer.buyerName || '');
    result = result.replace(/<<●氏名・会社名>>/g, buyerName);
    result = result.replace(/<<氏名>>/g, buyer.name || buyer.buyerName || '');
    result = result.replace(/<<買主番号>>/g, buyer.buyer_number || '');
    result = result.replace(/<<メールアドレス>>/g, buyer.email || '');

    if (properties.length === 0) return result;

    if (properties.length === 1) {
      const prop = properties[0];
      result = result.replace(/<<住居表示>>/g, prop.address || '');
      result = result.replace(/<<GoogleMap>>/g, prop.googleMapUrl ? `Googleマップ: ${prop.googleMapUrl}` : '');
      result = result.replace(/<<athome URL>>/g, prop.athomeUrl || '');
      result = result.replace(/<<物件詳細URL>>/g, prop.detailUrl || prop.athomeUrl || '');
    } else {
      const addressList = properties.map((p, i) => `【物件${i + 1}】${p.address || ''}`).join('\\n');
      const mapList = properties.filter(p => p.googleMapUrl).map((p, i) => `【物件${i + 1}】Googleマップ: ${p.googleMapUrl}`).join('\\n');
      const athomeList = properties.filter(p => p.athomeUrl).map(p => p.athomeUrl).join('\\n');
      const detailList = properties.map(p => p.detailUrl || p.athomeUrl || '').filter(Boolean).join('\\n');
      result = result.replace(/<<住居表示>>/g, addressList);
      result = result.replace(/<<GoogleMap>>/g, mapList ? `Googleマップ:\\n${mapList}` : '');
      result = result.replace(/<<athome URL>>/g, athomeList);
      result = result.replace(/<<物件詳細URL>>/g, detailList);
    }

    // 未置換のプレースホルダーを空文字に
    result = result.replace(/<<SUUMO\u3000URLの表示>>/g, '');
    result = result.replace(/<<内覧前伝達事項v>>/g, '');

    return result;
  }
'''

# クラスの閉じ括弧の直前に挿入
old_tail = '    return { subject, body };\n  }\n}'
new_tail = '    return { subject, body };\n  }\n' + new_method + '}'

if old_tail in content:
    content = content.replace(old_tail, new_tail, 1)
    print('EmailTemplateService.ts: mergeAngleBracketPlaceholders を追加しました')
else:
    # CRLF 対応
    old_tail_crlf = '    return { subject, body };\r\n  }\r\n}'
    new_tail_crlf = '    return { subject, body };\r\n  }\r\n' + new_method + '}'
    if old_tail_crlf in content:
        content = content.replace(old_tail_crlf, new_tail_crlf, 1)
        print('EmailTemplateService.ts: mergeAngleBracketPlaceholders を追加しました (CRLF)')
    else:
        print('ERROR: 挿入位置が見つかりません')
        # デバッグ用
        idx = content.rfind('return { subject, body }')
        print(f'  末尾付近: {repr(content[idx:idx+50])}')

with open('backend/src/services/EmailTemplateService.ts', 'wb') as f:
    f.write(content.encode('utf-8'))

# ============================================================
# 2. emailTemplates.ts の merge-multiple エンドポイントを修正
# ============================================================
with open('backend/src/routes/emailTemplates.ts', 'rb') as f:
    content2 = f.read().decode('utf-8')

# import に createClient を追加（まだなければ）
if "from '@supabase/supabase-js'" not in content2:
    old_import = "import express from 'express';"
    new_import = "import express from 'express';\nimport { createClient } from '@supabase/supabase-js';"
    content2 = content2.replace(old_import, new_import, 1)
    print('emailTemplates.ts: createClient import を追加しました')

# merge-multiple ルートハンドラ全体を置換
# "router.post('/:templateId/merge-multiple'" から始まる部分を探す
import re

# ルートハンドラを正規表現で検索して置換
pattern = r"router\.post\('/:templateId/merge-multiple'[\s\S]+?\}\);"
new_handler = """router.post('/:templateId/merge-multiple', async (req, res) => {
  try {
    const { templateId } = req.params;
    const { buyer, propertyIds } = req.body;

    if (!buyer) {
      return res.status(400).json({ error: 'Buyer data is required' });
    }
    if (!propertyIds || !Array.isArray(propertyIds) || propertyIds.length === 0) {
      return res.status(400).json({ error: 'Property IDs array is required' });
    }

    const template = await templateService.getTemplateById(templateId);
    if (!template) {
      return res.status(404).json({ error: 'Template not found' });
    }

    // Supabase から物件データを取得
    const supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY!
    );

    // UUID で検索
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
    }

    // <<>> プレースホルダー用データ
    const propertyDataForPlaceholders = allProperties.map((p: any) => ({
      propertyNumber: p.property_number || '',
      address: p.address || '',
      price: p.price,
      googleMapUrl: p.google_map_url || '',
      athomeUrl: p.athome_url || '',
      detailUrl: p.athome_url || '',
      propertyType: p.property_type || '',
      landArea: p.land_area,
      buildingArea: p.building_area,
    }));

    // {{}} 形式用データ（後方互換）
    const legacyProperties = allProperties.map((p: any) => ({
      propertyNumber: p.property_number || '',
      propertyAddress: p.address || '',
      price: p.price || 0,
      propertyType: p.property_type || '',
      landArea: p.land_area,
      buildingArea: p.building_area,
    }));

    // {{}} 形式を置換してから <<>> 形式を置換
    let mergedContent = templateService.mergeMultipleProperties(template, buyer, legacyProperties);
    mergedContent.subject = templateService.mergeAngleBracketPlaceholders(
      mergedContent.subject, buyer, propertyDataForPlaceholders
    );
    mergedContent.body = templateService.mergeAngleBracketPlaceholders(
      mergedContent.body, buyer, propertyDataForPlaceholders
    );

    res.json(mergedContent);
  } catch (error: any) {
    console.error('Error merging template with multiple properties:', error);
    res.status(500).json({ error: 'Failed to merge template with multiple properties' });
  }
});"""

match = re.search(pattern, content2, re.DOTALL)
if match:
    content2 = content2[:match.start()] + new_handler + content2[match.end():]
    print('emailTemplates.ts: merge-multiple エンドポイントを修正しました')
else:
    print('ERROR: merge-multiple ルートが見つかりません')

with open('backend/src/routes/emailTemplates.ts', 'wb') as f:
    f.write(content2.encode('utf-8'))

print('完了')
