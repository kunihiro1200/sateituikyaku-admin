#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
BuyersPage.tsx: sidebarLoaded後はAPIコールせずallBuyersWithStatusRefを使う
"""

with open('frontend/frontend/src/pages/BuyersPage.tsx', 'rb') as f:
    raw = f.read()

text = raw.decode('utf-8').replace('\r\n', '\n')

# fetchBuyers の中身を全面的に置き換える
# 「ステータスフィルタなし」の場合もサイドバーデータを使うように変更
old_fetch_body = """    const fetchBuyers = async () => {
      try {
        setLoading(true);

        // ステータスフィルタ選択中 かつ サイドバーデータ読み込み済みの場合はフロント側でフィルタリング
        if (selectedCalculatedStatus !== null && sidebarLoaded && allBuyersWithStatusRef.current.length > 0) {
          let filtered = allBuyersWithStatusRef.current.filter(
            b => b.calculated_status === selectedCalculatedStatus
          );

          // 検索フィルタ
          if (debouncedSearch) {
            const s = normalizeSearch(debouncedSearch).toLowerCase();
            const isBuyerNumber = /^\\d{4,5}$/.test(s);
            filtered = filtered.filter(b => {
              if (isBuyerNumber) return (b.buyer_number || '') === s;
              return (
                (b.buyer_number || '').toLowerCase().includes(s) ||
                (b.name || '').toLowerCase().includes(s) ||
                (b.phone_number || '').toLowerCase().includes(s) ||
                (b.property_number || '').toLowerCase().includes(s)
              );
            });
          }

          // ソート（受付日降順）
          filtered.sort((a, b) => {
            if (!a.reception_date && !b.reception_date) return 0;
            if (!a.reception_date) return 1;
            if (!b.reception_date) return -1;
            return b.reception_date.localeCompare(a.reception_date);
          });

          const totalCount = filtered.length;
          const offset = page * rowsPerPage;
          const paged = filtered.slice(offset, offset + rowsPerPage);

          if (!cancelled) {
            setBuyers(paged as any[]);
            setTotal(totalCount);
            setLoading(false);
          }
          return;
        }

        // 通常取得（ステータスフィルタなし）
        const params: any = {
          page: page + 1,
          limit: rowsPerPage,
          sortBy: 'reception_date',
          sortOrder: 'desc',
        };
        if (debouncedSearch) params.search = normalizeSearch(debouncedSearch);

        const res = await api.get('/api/buyers', { params });
        if (!cancelled) {
          setBuyers(res.data.data || []);
          setTotal(res.data.total || 0);
        }
      } catch (error) {
        if (!cancelled) {
          console.error('Failed to fetch buyers:', error);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };"""

new_fetch_body = """    const fetchBuyers = async () => {
      try {
        setLoading(true);

        // サイドバーデータ読み込み済みの場合はフロント側でフィルタリング（APIコール不要）
        if (sidebarLoaded && allBuyersWithStatusRef.current.length > 0) {
          let filtered = selectedCalculatedStatus !== null
            ? allBuyersWithStatusRef.current.filter(b => b.calculated_status === selectedCalculatedStatus)
            : [...allBuyersWithStatusRef.current];

          // 検索フィルタ
          if (debouncedSearch) {
            const s = normalizeSearch(debouncedSearch).toLowerCase();
            const isBuyerNumber = /^\\d{4,5}$/.test(s);
            filtered = filtered.filter(b => {
              if (isBuyerNumber) return (b.buyer_number || '') === s;
              return (
                (b.buyer_number || '').toLowerCase().includes(s) ||
                (b.name || '').toLowerCase().includes(s) ||
                (b.phone_number || '').toLowerCase().includes(s) ||
                (b.property_number || '').toLowerCase().includes(s)
              );
            });
          }

          // ソート（受付日降順）
          filtered.sort((a, b) => {
            if (!a.reception_date && !b.reception_date) return 0;
            if (!a.reception_date) return 1;
            if (!b.reception_date) return -1;
            return b.reception_date.localeCompare(a.reception_date);
          });

          const totalCount = filtered.length;
          const offset = page * rowsPerPage;
          const paged = filtered.slice(offset, offset + rowsPerPage);

          if (!cancelled) {
            setBuyers(paged as any[]);
            setTotal(totalCount);
            setLoading(false);
          }
          return;
        }

        // サイドバー未ロード時のみAPIから取得（初回表示用）
        const params: any = {
          page: page + 1,
          limit: rowsPerPage,
          sortBy: 'reception_date',
          sortOrder: 'desc',
        };
        if (debouncedSearch) params.search = normalizeSearch(debouncedSearch);

        const res = await api.get('/api/buyers', { params });
        if (!cancelled) {
          setBuyers(res.data.data || []);
          setTotal(res.data.total || 0);
        }
      } catch (error) {
        if (!cancelled) {
          console.error('Failed to fetch buyers:', error);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };"""

if old_fetch_body in text:
    text = text.replace(old_fetch_body, new_fetch_body)
    print("✅ fetchBuyers を修正しました（サイドバーデータ優先）")
else:
    print("❌ 対象ブロックが見つかりませんでした")
    # デバッグ用に一部を確認
    idx = text.find("const fetchBuyers = async")
    if idx >= 0:
        print(f"fetchBuyers は {idx} 文字目に存在します")
        print(repr(text[idx:idx+100]))

with open('frontend/frontend/src/pages/BuyersPage.tsx', 'wb') as f:
    f.write(text.encode('utf-8'))

print("✅ BuyersPage.tsx を保存しました")
