#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""sellers.ts に GET /by-number/:sellerNumber エンドポイントを追加
売主番号（AA12345形式）で売主の名前・住所を返す軽量エンドポイント"""

with open('backend/src/routes/sellers.ts', 'rb') as f:
    content = f.read().decode('utf-8').replace('\r\n', '\n')

# createClient のインポートを追加（まだなければ）
if "from '@supabase/supabase-js'" not in content:
    old_import = "import { Router, Request, Response } from 'express';"
    new_import = "import { Router, Request, Response } from 'express';\nimport { createClient } from '@supabase/supabase-js';"
    content = content.replace(old_import, new_import)
    print('Added supabase import')

# GET /:id の直前に by-number エンドポイントを追加
old_get_id = """/**
 * 売主情報を取得
 */
router.get('/:id', async (req: Request, res: Response) => {"""

new_get_id = """/**
 * 売主番号（AA12345形式）で売主の名前・住所を取得（軽量エンドポイント）
 * GET /api/sellers/by-number/:sellerNumber
 */
router.get('/by-number/:sellerNumber', async (req: Request, res: Response) => {
  try {
    const { sellerNumber } = req.params;
    const supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_KEY!
    );
    const { data, error } = await supabase
      .from('sellers')
      .select('id, seller_number, name, property_address')
      .eq('seller_number', sellerNumber)
      .single();

    if (error || !data) {
      return res.status(404).json({ error: 'Seller not found' });
    }

    // name は暗号化されている可能性があるため SellerService 経由で取得
    const seller = await sellerService.getSeller(data.id);
    if (!seller) {
      return res.status(404).json({ error: 'Seller not found' });
    }

    res.json({
      id: seller.id,
      sellerNumber: seller.sellerNumber,
      name: seller.name,
      propertyAddress: seller.propertyAddress,
    });
  } catch (error) {
    console.error('Get seller by number error:', error);
    res.status(500).json({ error: 'Failed to get seller' });
  }
});

/**
 * 売主情報を取得
 */
router.get('/:id', async (req: Request, res: Response) => {"""

if old_get_id in content:
    content = content.replace(old_get_id, new_get_id)
    print('Added by-number endpoint')
else:
    print('ERROR: pattern not found')

with open('backend/src/routes/sellers.ts', 'wb') as f:
    f.write(content.encode('utf-8'))

print('Done')
