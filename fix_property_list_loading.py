#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
物件リスト画面のプログレッシブローディング修正
最初の1000件を即座に表示し、残りをバックグラウンドで取得する
"""

with open('frontend/frontend/src/pages/PropertyListingsPage.tsx', 'rb') as f:
    content = f.read()

text = content.decode('utf-8')

# fetchAllData関数を修正：最初のバッチを即座に表示
old_code = '''  const fetchAllData = async (forceRefresh = false) => {
    // キャッシュが有効な場合はAPIを叩かない
    if (!forceRefresh) {
      const cached = pageDataCache.get<PropertyListing[]>(CACHE_KEYS.PROPERTY_LISTINGS);
      if (cached) {
        setAllListings(cached);
        setLoading(false);
        return;
      }
    }

    try {
      setLoading(true);

      const allListingsData: PropertyListing[] = [];
      let offset = 0;
      const limit = 1000;
      let hasMore = true;

      console.log('物件データを取得中...');

      while (hasMore) {
        const listingsRes = await api.get('/api/property-listings', {
          params: { limit, offset, orderBy: 'distribution_date', orderDirection: 'desc' },
        });

        const fetchedData = listingsRes.data.data || [];
        allListingsData.push(...fetchedData);

        console.log(`取得: ${offset + 1}～${offset + fetchedData.length}件 / 合計${listingsRes.data.total}件`);

        if (fetchedData.length < limit) {
          hasMore = false;
        } else {
          offset += limit;
        }
      }

      // キャッシュに保存（5分間有効）
      pageDataCache.set(CACHE_KEYS.PROPERTY_LISTINGS, allListingsData, 5 * 60 * 1000);
      setAllListings(allListingsData);

      console.log('✅ データ取得成功:', { 物件数: allListingsData.length });'''

new_code = '''  const fetchAllData = async (forceRefresh = false) => {
    // キャッシュが有効な場合はAPIを叩かない
    if (!forceRefresh) {
      const cached = pageDataCache.get<PropertyListing[]>(CACHE_KEYS.PROPERTY_LISTINGS);
      if (cached) {
        setAllListings(cached);
        setLoading(false);
        return;
      }
    }

    try {
      setLoading(true);

      const allListingsData: PropertyListing[] = [];
      let offset = 0;
      const limit = 1000;
      let hasMore = true;
      let isFirstBatch = true;

      console.log('物件データを取得中...');

      while (hasMore) {
        const listingsRes = await api.get('/api/property-listings', {
          params: { limit, offset, orderBy: 'distribution_date', orderDirection: 'desc' },
        });

        const fetchedData = listingsRes.data.data || [];
        allListingsData.push(...fetchedData);

        console.log(`取得: ${offset + 1}～${offset + fetchedData.length}件 / 合計${listingsRes.data.total}件`);

        // 最初のバッチを取得したら即座に表示（ローディングを解除）
        if (isFirstBatch) {
          isFirstBatch = false;
          setAllListings([...allListingsData]);
          setLoading(false);
        }

        if (fetchedData.length < limit) {
          hasMore = false;
        } else {
          offset += limit;
          // バックグラウンドで残りを取得しながら随時更新
          setAllListings([...allListingsData]);
        }
      }

      // キャッシュに保存（5分間有効）
      pageDataCache.set(CACHE_KEYS.PROPERTY_LISTINGS, allListingsData, 5 * 60 * 1000);
      setAllListings(allListingsData);

      console.log('✅ データ取得成功:', { 物件数: allListingsData.length });'''

if old_code in text:
    text = text.replace(old_code, new_code)
    print('✅ fetchAllData関数を修正しました')
else:
    print('❌ 対象コードが見つかりませんでした')
    # デバッグ用：前後の文字列を確認
    idx = text.find('const fetchAllData = async')
    if idx >= 0:
        print(f'fetchAllData found at index {idx}')
        print(repr(text[idx:idx+200]))

with open('frontend/frontend/src/pages/PropertyListingsPage.tsx', 'wb') as f:
    f.write(text.encode('utf-8'))

print('完了')
