import { useEffect, useState, useCallback } from 'react';
import api from '../services/api';

interface TateuriProperty {
  slug: string;
  title: string | null;
  price: string | null;
  address: string | null;
  access: string | null;
  layout: string | null;
  area: string | null;
  images: string[];
  lat: number | null;
  lng: number | null;
  created_at: string;
}

export default function TateuriPage() {
  const [properties, setProperties] = useState<TateuriProperty[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<string | null>(null);

  const fetchProperties = useCallback(async () => {
    try {
      const res = await api.get('/api/tateuri');
      setProperties(res.data);
    } catch (err) {
      console.error('Failed to fetch tateuri properties:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProperties();
  }, [fetchProperties]);

  // Google Maps埋め込みURL（複数ピン対応）
  const buildMapSrc = () => {
    const validProps = properties.filter(p => p.lat && p.lng);
    if (validProps.length === 0) {
      return 'https://maps.google.com/maps?q=大分市&z=13&output=embed&hl=ja';
    }
    // 選択中の物件があればその物件を中心に
    const center = selected
      ? validProps.find(p => p.slug === selected) || validProps[0]
      : validProps[0];
    return `https://maps.google.com/maps?q=${center.lat},${center.lng}&z=15&output=embed&hl=ja`;
  };

  const handleSelect = (slug: string) => {
    setSelected(slug);
  };

  const handleOpen = (slug: string) => {
    window.open(`/property-preview/${slug}`, '_blank');
  };

  const cleanTitle = (title: string | null) =>
    (title || '').replace(/\[\d+\].+$/, '').trim();

  return (
    <div style={{ fontFamily: "'Hiragino Sans', 'Meiryo', sans-serif", height: '100vh', display: 'flex', flexDirection: 'column', background: '#f5f5f5' }}>

      {/* ヘッダー */}
      <div style={{ background: '#2c5f2e', color: 'white', padding: '14px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 'bold', margin: 0 }}>🏠 大分の建売専門サイト</h1>
          <p style={{ fontSize: 12, margin: '2px 0 0', opacity: 0.8 }}>株式会社いふう｜大分市舞鶴町1-3-30 STビル１F　097-533-2022</p>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <span style={{ fontSize: 13, opacity: 0.8 }}>掲載中: {properties.length}件</span>
        </div>
      </div>

      {/* メインコンテンツ */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>

        {/* 左: 物件リスト */}
        <div style={{ width: 340, flexShrink: 0, overflowY: 'auto', background: 'white', borderRight: '1px solid #e0e0e0' }}>
          {loading ? (
            <div style={{ padding: 24, textAlign: 'center', color: '#999' }}>読み込み中...</div>
          ) : properties.length === 0 ? (
            <div style={{ padding: 24, textAlign: 'center', color: '#999' }}>
              <p>現在掲載中の物件はありません</p>
            </div>
          ) : (
            properties.map(p => (
              <div
                key={p.slug}
                onClick={() => handleOpen(p.slug)}
                style={{
                  padding: '12px 14px',
                  borderBottom: '1px solid #f0f0f0',
                  cursor: 'pointer',
                  background: selected === p.slug ? '#f0f7f0' : 'white',
                  borderLeft: selected === p.slug ? '4px solid #2c5f2e' : '4px solid transparent',
                  transition: 'background 0.15s',
                }}
                onMouseEnter={e => { if (selected !== p.slug) e.currentTarget.style.background = '#f9f9f9'; }}
                onMouseLeave={e => { if (selected !== p.slug) e.currentTarget.style.background = 'white'; }}
              >
                <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                  {/* サムネイル */}
                  {p.images?.[0] && (
                    <img src={p.images[0]} alt="" style={{ width: 72, height: 54, objectFit: 'cover', borderRadius: 4, flexShrink: 0 }} />
                  )}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 'bold', color: '#333', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {cleanTitle(p.title) || p.address || '物件情報'}
                    </div>
                    {p.price && <div style={{ fontSize: 15, fontWeight: 'bold', color: '#e84040', marginTop: 2 }}>{p.price}</div>}
                    {p.address && <div style={{ fontSize: 11, color: '#666', marginTop: 2 }}>{p.address}</div>}
                    <div style={{ display: 'flex', gap: 6, marginTop: 4, flexWrap: 'wrap' }}>
                      {p.layout && <span style={{ fontSize: 11, background: '#f0f0f0', padding: '1px 6px', borderRadius: 3 }}>{p.layout}</span>}
                      {p.area && <span style={{ fontSize: 11, background: '#f0f0f0', padding: '1px 6px', borderRadius: 3 }}>{p.area}</span>}
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* 右: 地図 */}
        <div style={{ flex: 1, position: 'relative' }}>
          {properties.length > 0 ? (
            <>
              <iframe
                key={selected || 'default'}
                src={buildMapSrc()}
                width="100%"
                height="100%"
                style={{ border: 'none', display: 'block' }}
                allowFullScreen
                loading="lazy"
              />
              {/* 地図上の物件ピン一覧（クリック可能なオーバーレイ） */}
              <div style={{ position: 'absolute', top: 10, right: 10, background: 'white', borderRadius: 8, padding: '8px 12px', boxShadow: '0 2px 8px rgba(0,0,0,0.2)', fontSize: 12, color: '#333' }}>
                📍 {properties.filter(p => p.lat && p.lng).length}件の物件を表示中
              </div>
            </>
          ) : (
            <iframe
              src="https://maps.google.com/maps?q=大分市&z=13&output=embed&hl=ja"
              width="100%"
              height="100%"
              style={{ border: 'none', display: 'block' }}
              allowFullScreen
              loading="lazy"
            />
          )}
        </div>
      </div>
    </div>
  );
}
