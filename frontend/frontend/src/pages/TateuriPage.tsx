import { useEffect, useState, useCallback, useRef } from 'react';
import { Helmet } from 'react-helmet-async';
import { GoogleMap, InfoWindow } from '@react-google-maps/api';
import { useGoogleMaps } from '../contexts/GoogleMapsContext';
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

const containerStyle = {
  width: '100%',
  height: '100%',
};

// 大分市の中心座標
const defaultCenter = {
  lat: 33.2382,
  lng: 131.6126,
};

export default function TateuriPage() {
  const [properties, setProperties] = useState<TateuriProperty[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedProperty, setSelectedProperty] = useState<TateuriProperty | null>(null);
  const [infoWindowPos, setInfoWindowPos] = useState<{ lat: number; lng: number } | null>(null);
  const [map, setMap] = useState<google.maps.Map | null>(null);
  const markersRef = useRef<google.maps.Marker[]>([]);

  const { isLoaded, loadError } = useGoogleMaps();

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

  const onLoad = useCallback((mapInstance: google.maps.Map) => {
    setMap(mapInstance);
  }, []);

  const onUnmount = useCallback(() => {
    markersRef.current.forEach(m => m.setMap(null));
    markersRef.current = [];
    setMap(null);
  }, []);

  // 地図とデータが揃ったらマーカーを作成
  useEffect(() => {
    if (!map || !isLoaded || properties.length === 0) return;

    // 既存マーカーをクリア
    markersRef.current.forEach(m => m.setMap(null));
    markersRef.current = [];

    const validProps = properties.filter(p => {
      if (!p.lat || !p.lng) return false;
      // 大分県の範囲内かチェック（海上・範囲外の座標を除外）
      const inOita = p.lat >= 32.5 && p.lat <= 34.0 && p.lng >= 130.5 && p.lng <= 132.5;
      if (!inOita) {
        console.warn(`[TateuriPage] 座標が大分県範囲外のためスキップ: ${p.address} (${p.lat}, ${p.lng})`);
      }
      return inOita;
    });
    if (validProps.length === 0) return;

    const bounds = new window.google.maps.LatLngBounds();

    // 座標ごとにグループ化（同じ座標の物件を円形に配置）
    const coordinateGroups = new Map<string, TateuriProperty[]>();
    validProps.forEach(p => {
      const key = `${p.lat!.toFixed(6)},${p.lng!.toFixed(6)}`;
      const group = coordinateGroups.get(key) || [];
      group.push(p);
      coordinateGroups.set(key, group);
    });

    coordinateGroups.forEach((group, coordKey) => {
      const [latStr, lngStr] = coordKey.split(',');
      const baseLat = parseFloat(latStr);
      const baseLng = parseFloat(lngStr);

      group.forEach((property, index) => {
        let adjustedLat = baseLat;
        let adjustedLng = baseLng;

        if (group.length > 1) {
          // 複数物件が同じ座標の場合、円形に配置（約50m間隔）
          const angle = (index * 360 / group.length) * (Math.PI / 180);
          const offset = 0.0005;
          adjustedLat += offset * Math.cos(angle);
          adjustedLng += offset * Math.sin(angle);
        }

        bounds.extend({ lat: adjustedLat, lng: adjustedLng });

        const marker = new window.google.maps.Marker({
          position: { lat: adjustedLat, lng: adjustedLng },
          map,
          title: property.title || property.address || '',
          icon: {
            path: window.google.maps.SymbolPath.CIRCLE,
            fillColor: '#e84040',
            fillOpacity: 1,
            strokeColor: '#fff',
            strokeWeight: 2,
            scale: 11,
          },
          zIndex: window.google.maps.Marker.MAX_ZINDEX + index,
        });

        marker.addListener('click', () => {
          setSelectedProperty(property);
          setInfoWindowPos({ lat: adjustedLat, lng: adjustedLng });
        });

        markersRef.current.push(marker);
      });
    });

    // 全物件が収まるようにズーム調整（複数件の場合）
    if (validProps.length > 1) {
      map.fitBounds(bounds, 80);
    } else {
      map.setCenter({ lat: validProps[0].lat!, lng: validProps[0].lng! });
      map.setZoom(15);
    }
  }, [map, isLoaded, properties]);

  const handleOpen = (slug: string) => {
    window.open(`/property-preview/${slug}`, '_blank');
  };

  // タイトルから不要テキストを除去
  const cleanTitle = (title: string | null) =>
    (title || '')
      .replace(/\[\d+\].+$/, '')        // [番号]以降を除去
      .replace(/支払額シミュレーション.*$/, '') // 「支払額シミュレーション」以降を除去
      .trim();

  // 価格から不要テキストを除去（「支払額シミュレーション借入可能額シミュレーション」等）
  const cleanPrice = (price: string | null) =>
    (price || '')
      .replace(/支払額シミュレーション.*$/, '')
      .replace(/借入可能額シミュレーション.*$/, '')
      .trim();

  return (
    <div style={{ fontFamily: "'Hiragino Sans', 'Meiryo', sans-serif", height: '100vh', display: 'flex', flexDirection: 'column', background: '#f5f5f5' }}>

      {/* SEOメタタグ */}
      <Helmet>
        <title>大分の建売専門サイト｜新築一戸建て物件情報｜株式会社いふう</title>
        <meta name="description" content={`大分県の建売住宅専門サイト。現在${properties.length}件の新築建売物件を掲載中。大分市・別府市・由布市など大分県内の物件情報を地図付きでご紹介。株式会社いふう（097-533-2022）`} />
        <meta name="keywords" content="大分 建売,大分市 建売住宅,大分 新築一戸建て,大分 不動産,建売住宅 大分県,大分市 新築,別府 建売,由布市 建売,大分 住宅購入" />
        <link rel="canonical" href="https://oita-tateuri.com/tateuri" />
        <meta property="og:title" content="大分の建売専門サイト｜新築一戸建て物件情報｜株式会社いふう" />
        <meta property="og:description" content={`大分県の建売住宅専門サイト。現在${properties.length}件の新築建売物件を掲載中。地図付きで物件情報をご紹介します。`} />
        <meta property="og:url" content="https://oita-tateuri.com/tateuri" />
        <meta property="og:type" content="website" />
        <script type="application/ld+json">{JSON.stringify({
          "@context": "https://schema.org",
          "@type": "ItemList",
          "name": "大分県の建売住宅一覧",
          "description": "大分県内の新築建売住宅物件一覧",
          "numberOfItems": properties.length,
          "itemListElement": properties.slice(0, 10).map((p, i) => ({
            "@type": "ListItem",
            "position": i + 1,
            "item": {
              "@type": "House",
              "name": cleanTitle(p.title) || p.address || "建売住宅",
              "description": `${p.address || ""}${p.layout ? ` ${p.layout}` : ""}${p.area ? ` ${p.area}` : ""}`,
              "url": `https://oita-tateuri.com/property-preview/${p.slug}`,
              ...(p.price ? { "offers": { "@type": "Offer", "price": p.price, "priceCurrency": "JPY" } } : {}),
              ...(p.address ? { "address": { "@type": "PostalAddress", "streetAddress": p.address, "addressRegion": "大分県", "addressCountry": "JP" } } : {}),
            }
          }))
        })}</script>
      </Helmet>

      {/* ヘッダー */}
      <header style={{ background: '#FFC107', color: '#333', padding: '14px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 'bold', margin: 0 }}>🏠 大分の建売専門サイト</h1>
          <p style={{ fontSize: 12, margin: '2px 0 0', opacity: 0.75 }}>株式会社いふう｜大分市舞鶴町1-3-30 STビル１F　<a href="tel:0975332022" style={{ color: 'inherit', textDecoration: 'none' }}>097-533-2022</a>　大分県知事（3）第3183号</p>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <span style={{ fontSize: 13, opacity: 0.75 }}>掲載中: {properties.length}件</span>
        </div>
      </header>

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
                  background: selectedProperty?.slug === p.slug ? '#f0f7f0' : 'white',
                  borderLeft: selectedProperty?.slug === p.slug ? '4px solid #FFC107' : '4px solid transparent',
                  transition: 'background 0.15s',
                }}
                onMouseEnter={e => { if (selectedProperty?.slug !== p.slug) e.currentTarget.style.background = '#f9f9f9'; }}
                onMouseLeave={e => { if (selectedProperty?.slug !== p.slug) e.currentTarget.style.background = 'white'; }}
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
                    {p.price && <div style={{ fontSize: 15, fontWeight: 'bold', color: '#e84040', marginTop: 2 }}>{cleanPrice(p.price)}</div>}
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
          {loadError ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#999' }}>
              地図の読み込みに失敗しました
            </div>
          ) : !isLoaded ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#999' }}>
              地図を読み込み中...
            </div>
          ) : (
            <>
              <GoogleMap
                mapContainerStyle={containerStyle}
                center={defaultCenter}
                zoom={12}
                onLoad={onLoad}
                onUnmount={onUnmount}
                options={{
                  zoomControl: true,
                  streetViewControl: false,
                  mapTypeControl: false,
                  fullscreenControl: true,
                }}
              >
                {/* ピンクリック時の物件概要ポップアップ */}
                {selectedProperty && infoWindowPos && (
                  <InfoWindow
                    position={infoWindowPos}
                    onCloseClick={() => {
                      setSelectedProperty(null);
                      setInfoWindowPos(null);
                    }}
                  >
                    <div style={{ maxWidth: 240, fontFamily: "'Hiragino Sans', 'Meiryo', sans-serif" }}>
                      {/* サムネイル */}
                      {selectedProperty.images?.[0] && (
                        <img
                          src={selectedProperty.images[0]}
                          alt=""
                          style={{ width: '100%', height: 80, objectFit: 'cover', borderRadius: 4, marginBottom: 8 }}
                        />
                      )}
                      {/* タイトル */}
                      <div style={{ fontSize: 13, fontWeight: 'bold', color: '#333', marginBottom: 4 }}>
                        {cleanTitle(selectedProperty.title) || selectedProperty.address || '物件情報'}
                      </div>
                      {/* 価格 */}
                      {selectedProperty.price && (
                        <div style={{ fontSize: 16, fontWeight: 'bold', color: '#e84040', marginBottom: 4 }}>
                          {cleanPrice(selectedProperty.price)}
                        </div>
                      )}
                      {/* 住所 */}
                      {selectedProperty.address && (
                        <div style={{ fontSize: 11, color: '#666', marginBottom: 4 }}>
                          {selectedProperty.address}
                        </div>
                      )}
                      {/* 間取り・面積 */}
                      <div style={{ display: 'flex', gap: 6, marginBottom: 10, flexWrap: 'wrap' }}>
                        {selectedProperty.layout && (
                          <span style={{ fontSize: 11, background: '#f0f0f0', padding: '2px 6px', borderRadius: 3 }}>
                            {selectedProperty.layout}
                          </span>
                        )}
                        {selectedProperty.area && (
                          <span style={{ fontSize: 11, background: '#f0f0f0', padding: '2px 6px', borderRadius: 3 }}>
                            {selectedProperty.area}
                          </span>
                        )}
                      </div>
                      {/* 詳細ボタン */}
                      <button
                        onClick={() => handleOpen(selectedProperty.slug)}
                        style={{
                          width: '100%',
                          padding: '8px 0',
                          background: '#FFC107',
                          color: '#333',
                          border: 'none',
                          borderRadius: 4,
                          fontSize: 13,
                          fontWeight: 'bold',
                          cursor: 'pointer',
                        }}
                      >
                        詳細を見る
                      </button>
                    </div>
                  </InfoWindow>
                )}
              </GoogleMap>

              {/* 物件数バッジ */}
              <div style={{
                position: 'absolute',
                top: 10,
                right: 10,
                background: 'white',
                borderRadius: 8,
                padding: '8px 12px',
                boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
                fontSize: 12,
                color: '#333',
                pointerEvents: 'none',
              }}>
                📍 {properties.filter(p => p.lat && p.lng).length}件の物件を表示中
              </div>
            </>
          )}
        </div>
      </div>

      {/* フッター（SEO・クローラー向けテキスト情報） */}
      <footer style={{ background: '#333', color: '#ccc', padding: '12px 24px', fontSize: 11, flexShrink: 0, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
        <div>
          <strong style={{ color: '#fff' }}>株式会社いふう</strong>
          　大分市舞鶴町1-3-30 STビル１F
          　<a href="tel:0975332022" style={{ color: '#FFC107', textDecoration: 'none' }}>097-533-2022</a>
          　大分県知事（3）第3183号
        </div>
        <div style={{ color: '#888' }}>
          大分県の建売住宅・新築一戸建て専門サイト
          　© {new Date().getFullYear()} 株式会社いふう
        </div>
      </footer>
    </div>
  );
}
