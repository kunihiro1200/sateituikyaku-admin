import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { GoogleMap } from '@react-google-maps/api';
import api from '../services/api';
import PropertyPrintSheet from '../components/PropertyPrintSheet';
import { useGoogleMaps } from '../contexts/GoogleMapsContext';

interface PreviewData {
  slug: string;
  source_url: string;
  title: string | null;
  price: string | null;
  address: string | null;
  access: string | null;
  layout: string | null;
  area: string | null;
  floor: string | null;
  built_year: string | null;
  parking: string | null;
  features: string | null;
  remarks: string | null;
  images: string[];
  lat: number | null;
  lng: number | null;
  details: Record<string, string>;
  appeal_comment?: string | null;
  provider_name?: string | null;
  provider_phone?: string | null;
  provider_hours?: string | null;
  show_images?: boolean;
  show_price?: boolean;
  show_address?: boolean;
  show_access?: boolean;
  show_layout?: boolean;
  show_area?: boolean;
  show_floor?: boolean;
  show_built_year?: boolean;
  show_parking?: boolean;
  show_features?: boolean;
  show_map?: boolean;
  points?: string[];
  image_categories?: Record<string, string[]>;
}

// ── お問い合わせフォーム ──────────────────────────────
function PreviewInquiryForm({ title, address, slug, sourceUrl }: { title: string; address: string; slug: string; sourceUrl: string }) {
  const [form, setForm] = useState({ name: '', email: '', phone: '', message: '' });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [sending, setSending] = useState(false);
  const [success, setSuccess] = useState(false);
  const [serverError, setServerError] = useState('');

  const validate = () => {
    const e: Record<string, string> = {};
    if (!form.name.trim()) e.name = 'お名前を入力してください';
    if (!form.email.trim()) e.email = 'メールアドレスを入力してください';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) e.email = '正しいメールアドレスを入力してください';
    if (!form.phone.trim()) e.phone = '電話番号を入力してください';
    if (!form.message.trim()) e.message = 'お問い合わせ内容を入力してください';
    return e;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length > 0) { setErrors(errs); return; }
    setSending(true);
    setServerError('');
    try {
      // 公開物件サイトと同じAPIエンドポイントを使用
      const backendUrl = import.meta.env.MODE === 'production'
        ? 'https://sateituikyaku-admin-backend.vercel.app'
        : (import.meta.env.VITE_API_URL || 'http://localhost:3000');
      const res = await fetch(`${backendUrl}/api/public/inquiries`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          propertyId: slug, // slugを物件IDとして送信
          propertyAddress: address, // 物件住所
          sourceUrl: sourceUrl, // 元のURL
          previewUrl: window.location.href, // プレビューURL
          name: form.name,
          email: form.email,
          phone: form.phone,
          message: form.message,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || '送信に失敗しました');
      setSuccess(true);
      setForm({ name: '', email: '', phone: '', message: '' });
    } catch (err: any) {
      setServerError(err.message || 'エラーが発生しました。しばらくしてから再度お試しください。');
    } finally {
      setSending(false);
    }
  };

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '12px 14px', fontSize: 15,
    border: '1px solid #ddd', borderRadius: 6, boxSizing: 'border-box',
    fontFamily: 'inherit', outline: 'none',
  };
  const errStyle: React.CSSProperties = { color: '#e84040', fontSize: 12, marginTop: 4 };

  if (success) return (
    <div style={{ background: 'white', borderRadius: 10, padding: 32, textAlign: 'center', boxShadow: '0 1px 4px rgba(0,0,0,0.08)', marginBottom: 16 }}>
      <div style={{ fontSize: 40, marginBottom: 12 }}>✅</div>
      <div style={{ fontSize: 17, fontWeight: 'bold', marginBottom: 8 }}>お問い合わせを受け付けました</div>
      <div style={{ fontSize: 14, color: '#666' }}>担当者より折り返しご連絡いたします。</div>
    </div>
  );

  return (
    <div style={{ background: 'white', borderRadius: 10, padding: 24, boxShadow: '0 1px 4px rgba(0,0,0,0.08)', marginBottom: 16 }}>
      <h2 style={{ fontSize: 16, fontWeight: 'bold', marginBottom: 6 }}>この物件についてお問い合わせ</h2>
      {address && <p style={{ fontSize: 13, color: '#666', marginBottom: 20 }}>{address}</p>}

      {serverError && (
        <div style={{ background: '#fff0f0', border: '1px solid #e84040', borderRadius: 6, padding: '10px 14px', marginBottom: 16, fontSize: 14, color: '#e84040' }}>
          {serverError}
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <input style={inputStyle} placeholder="お名前 *" value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))} disabled={sending} />
            {errors.name && <div style={errStyle}>{errors.name}</div>}
          </div>
          <div>
            <input style={inputStyle} type="email" placeholder="メールアドレス *" value={form.email}
              onChange={e => setForm(f => ({ ...f, email: e.target.value }))} disabled={sending} />
            {errors.email && <div style={errStyle}>{errors.email}</div>}
          </div>
          <div>
            <input style={inputStyle} type="tel" placeholder="電話番号 *" value={form.phone}
              onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} disabled={sending} />
            {errors.phone && <div style={errStyle}>{errors.phone}</div>}
          </div>
          <div>
            <textarea style={{ ...inputStyle, minHeight: 120, resize: 'vertical' }}
              placeholder="お問い合わせ内容 *" value={form.message}
              onChange={e => setForm(f => ({ ...f, message: e.target.value }))} disabled={sending} />
            {errors.message && <div style={errStyle}>{errors.message}</div>}
          </div>
          <button type="submit" disabled={sending}
            style={{ padding: '14px', fontSize: 16, fontWeight: 'bold', background: '#FFC107', color: '#000', border: '1px solid #000', borderRadius: 6, cursor: sending ? 'not-allowed' : 'pointer', opacity: sending ? 0.7 : 1 }}>
            {sending ? '送信中...' : 'お問い合わせを送信'}
          </button>
        </div>
      </form>

      {/* 電話ボタン */}
      <div style={{ marginTop: 20, paddingTop: 20, borderTop: '1px solid #eee', textAlign: 'center' }}>
        <p style={{ fontSize: 13, color: '#666', marginBottom: 10 }}>お急ぎの方はお電話でもお問い合わせいただけます</p>
        <a href="tel:0975332022"
          style={{ display: 'block', padding: '12px', fontSize: 18, fontWeight: 'bold', color: '#4CAF50', border: '2px solid #4CAF50', borderRadius: 6, textDecoration: 'none', textAlign: 'center' }}>
          📞 097-533-2022
        </a>
        <p style={{ fontSize: 12, color: '#999', marginTop: 8 }}>10：00〜17：30（定休日：水曜日）</p>
      </div>
    </div>
  );
}

// ── メインページ ──────────────────────────────────────
export default function PropertyPreviewPage() {
  const { slug } = useParams<{ slug: string }>();
  const [data, setData] = useState<PreviewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [imgIndex, setImgIndex] = useState(0);
  const [showProvider, setShowProvider] = useState(false);
  const [imageTab, setImageTab] = useState<'all' | 'layout' | 'exterior'>('all');
  const [showPrintSheet, setShowPrintSheet] = useState(false);

  useEffect(() => {
    if (!slug) return;
    api.get(`/api/property-preview/${slug}`)
      .then(res => setData(res.data))
      .catch(err => {
        if (err.response?.status === 404) setError('物件情報が見つかりません');
        else if (err.response?.status === 410) setError('この物件情報は期限切れです');
        else setError('読み込みに失敗しました');
      })
      .finally(() => setLoading(false));
  }, [slug]);

  const { isLoaded: mapsLoaded } = useGoogleMaps();
  const [mapInstance, setMapInstance] = useState<google.maps.Map | null>(null);

  const onMapLoad = useCallback((map: google.maps.Map) => {
    setMapInstance(map);
  }, []);

  // 地図とデータが揃ったらマーカーを配置
  useEffect(() => {
    if (!mapInstance || !mapsLoaded || !data?.lat || !data?.lng) return;
    const marker = new window.google.maps.Marker({
      position: { lat: data.lat, lng: data.lng },
      map: mapInstance,
      icon: {
        path: window.google.maps.SymbolPath.CIRCLE,
        fillColor: '#e84040',
        fillOpacity: 1,
        strokeColor: '#fff',
        strokeWeight: 2,
        scale: 11,
      },
    });
    return () => marker.setMap(null);
  }, [mapInstance, mapsLoaded, data?.lat, data?.lng]);

  if (loading) return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', fontFamily: 'sans-serif' }}>
      <p style={{ color: '#999' }}>読み込み中...</p>
    </div>
  );

  if (error || !data) return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', fontFamily: 'sans-serif' }}>
      <p style={{ color: '#c00' }}>{error || '物件情報が見つかりません'}</p>
    </div>
  );

  const images = data.images || [];

  // 画像インデックスから決定論的にスタイルを生成（別の人が撮った写真風）
  const getImageStyleByIndex = (index: number): React.CSSProperties => {
    const variants = [
      // 0: 右寄り・少し上・-2度・1.08倍（var-c）
      { objectPosition: '70% 45%', transform: 'rotate(-2deg) scale(1.08)', transformOrigin: 'center' },
      // 1: 左寄り・下気味・+1.5度・1.08倍
      { objectPosition: '30% 55%', transform: 'rotate(1.5deg) scale(1.08)', transformOrigin: 'center' },
      // 2: 上から引き気味・+2.5度・1.1倍
      { objectPosition: '50% 30%', transform: 'rotate(2.5deg) scale(1.10)', transformOrigin: 'center' },
      // 3: 右寄り・ほぼ正面・+1度・1.06倍
      { objectPosition: '65% 50%', transform: 'rotate(1deg) scale(1.06)', transformOrigin: 'center' },
      // 4: 下から寄り気味・-1.5度・1.12倍
      { objectPosition: '40% 70%', transform: 'rotate(-1.5deg) scale(1.12)', transformOrigin: 'center' },
      // 5: 左上・-2.5度・1.09倍
      { objectPosition: '25% 35%', transform: 'rotate(-2.5deg) scale(1.09)', transformOrigin: 'center' },
    ];
    return variants[index % variants.length] as React.CSSProperties;
  };
  // タイトルから [物件番号]以降の不要テキストを除去
  const cleanTitle = (data.title || '').replace(/\[\d+\].+$/, '').trim();
  // 価格から「支払額シミュレーション」以降の不要テキストを除去
  const cleanPrice = (price: string | null | undefined) =>
    (price || '').replace(/支払額シミュレーション.*$/, '').trim();
  const showImages    = data.show_images    !== false;
  const showPrice     = data.show_price     !== false;
  const showAddress   = data.show_address   !== false;
  const showAccess    = data.show_access    !== false;
  const showLayout    = data.show_layout    !== false;
  const showArea      = data.show_area      !== false;
  const showFloor     = data.show_floor     !== false;
  const showBuiltYear = data.show_built_year !== false;
  const showParking   = data.show_parking   !== false;
  const showFeatures  = data.show_features  !== false;
  const showMap       = data.show_map       !== false;

  const detailRows = [
    showPrice     && data.price     && { label: '価格',     value: cleanPrice(data.price) },
    showAddress   && data.address   && { label: '所在地',   value: data.address },
    showAccess    && data.access    && { label: '交通',     value: data.access },
    showLayout    && data.layout    && { label: '間取り',   value: data.layout },
    showArea      && data.area      && { label: '専有面積', value: data.area },
    showFloor     && data.floor     && { label: '階建/階',  value: data.floor },
    showBuiltYear && data.built_year && { label: '築年月',  value: data.built_year },
    showParking   && data.parking   && { label: '駐車場',   value: data.parking },
    showFeatures  && data.features  && { label: '設備',     value: data.features },
    data.details?.['販売スケジュール'] && { label: '販売スケジュール', value: data.details['販売スケジュール'] },
    data.details?.['造成完成時期'] && { label: '造成完成時期', value: data.details['造成完成時期'] },
    data.details?.['引渡可能時期'] && { label: '引渡可能時期', value: data.details['引渡可能時期'] },
    data.details?.['完成時期'] && { label: '完成時期', value: data.details['完成時期'] },
    data.details?.['モデルハウス情報'] && { label: 'モデルハウス情報', value: data.details['モデルハウス情報'] },
  ].filter(Boolean) as { label: string; value: string }[];

  return (
    <div style={{ fontFamily: "'Hiragino Sans', 'Meiryo', sans-serif", background: '#f5f5f5', minHeight: '100vh' }}>
      {/* ヘッダー */}
      <div style={{ background: '#e84040', color: 'white', padding: '20px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 'bold', margin: 0 }}>{cleanTitle || '物件情報'}</h1>
          {showPrice && data.price && (
            <div style={{ fontSize: 28, fontWeight: 'bold', marginTop: 6 }}>{cleanPrice(data.price)}</div>
          )}
          {(showAddress || showAccess) && (
            <div style={{ fontSize: 13, opacity: 0.85, marginTop: 4 }}>
              {showAddress && data.address}{showAddress && showAccess && data.access ? ' ／ ' : ''}{showAccess && data.access}
            </div>
          )}
        </div>
        {/* 右端の署名 */}
        <div style={{ textAlign: 'right', opacity: 0.95, flexShrink: 0 }}>
          <div style={{ fontSize: 15, fontWeight: 'bold' }}>株式会社いふう</div>
          <div style={{ fontSize: 11, marginTop: 2, opacity: 0.85 }}>大分市舞鶴町1-3-30 STビル１F</div>
        </div>
      </div>

      <div style={{ maxWidth: 900, margin: '0 auto', padding: '20px 16px' }}>

        {/* 画像スライダー */}
        {showImages && images.length > 0 && (
          <div style={{ background: 'white', borderRadius: 10, padding: 20, marginBottom: 16, boxShadow: '0 1px 4px rgba(0,0,0,0.08)' }}>
            <h2 style={{ fontSize: 15, fontWeight: 'bold', borderLeft: '4px solid #e84040', paddingLeft: 10, marginBottom: 14 }}>
              物件写真（{images.length}枚）
            </h2>
            <div style={{ position: 'relative', background: '#111', borderRadius: 8, overflow: 'hidden', marginBottom: 10, aspectRatio: '4/3', userSelect: 'none' }}>
              <img src={images[imgIndex]} alt="物件写真" style={{ width: '100%', height: '100%', objectFit: 'cover', pointerEvents: 'none', display: 'block', ...getImageStyleByIndex(imgIndex) }} />
              {/* 当社帯オーバーレイ */}
              <img src="/company-obi.png" alt="" style={{ position: 'absolute', bottom: 0, left: 0, width: '100%', height: 'auto', pointerEvents: 'none', zIndex: 3 }} />
              {/* 左右クリックエリア（矢印ボタンの後ろに配置） */}
              <div style={{ position: 'absolute', inset: 0, display: 'flex', zIndex: 1 }}>
                <div style={{ width: '50%', cursor: 'w-resize' }} onClick={() => setImgIndex(i => (i - 1 + images.length) % images.length)} />
                <div style={{ width: '50%', cursor: 'e-resize' }} onClick={() => setImgIndex(i => (i + 1) % images.length)} />
              </div>
              {/* 矢印ボタン（クリックエリアより前面・位置固定） */}
              <button onClick={() => setImgIndex(i => (i - 1 + images.length) % images.length)}
                style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', background: 'rgba(255,255,255,0.85)', border: 'none', borderRadius: 4, width: 40, height: 56, fontSize: 22, cursor: 'pointer', zIndex: 4, flexShrink: 0 }}>‹</button>
              <button onClick={() => setImgIndex(i => (i + 1) % images.length)}
                style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', background: 'rgba(255,255,255,0.85)', border: 'none', borderRadius: 4, width: 40, height: 56, fontSize: 22, cursor: 'pointer', zIndex: 4, flexShrink: 0 }}>›</button>
              <span style={{ position: 'absolute', top: 10, left: 12, background: 'rgba(0,0,0,0.55)', color: 'white', fontSize: 13, padding: '3px 10px', borderRadius: 20, zIndex: 4 }}>
                {imgIndex + 1} / {images.length}
              </span>
            </div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {images.map((url, i) => (
                <div key={i} onClick={() => setImgIndex(i)} style={{
                  width: 72, height: 54, borderRadius: 4, overflow: 'hidden', position: 'relative', cursor: 'pointer', flexShrink: 0,
                  border: i === imgIndex ? '2px solid #e84040' : '2px solid transparent',
                  opacity: i === imgIndex ? 1 : 0.65,
                }}>
                  <img src={url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block', ...getImageStyleByIndex(i) }} />
                  <img src="/company-obi.png" alt="" style={{ position: 'absolute', bottom: 0, left: 0, width: '100%', height: 'auto', pointerEvents: 'none' }} />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* おすすめコメント */}
        {data.appeal_comment && (
          <div style={{ background: 'white', borderRadius: 10, padding: 20, marginBottom: 16, boxShadow: '0 1px 4px rgba(0,0,0,0.08)' }}>
            <h2 style={{ fontSize: 15, fontWeight: 'bold', borderLeft: '4px solid #e84040', paddingLeft: 10, marginBottom: 14 }}>
              ★ おすすめコメント
            </h2>
            <p style={{ fontSize: 14, lineHeight: 1.8, color: '#333', whiteSpace: 'pre-wrap' }}>
              {data.appeal_comment}
            </p>
          </div>
        )}

        {/* ポイント（設備・仕様・構造） */}
        {data.points && data.points.length > 0 && (
          <div style={{ background: 'white', borderRadius: 10, padding: 20, marginBottom: 16, boxShadow: '0 1px 4px rgba(0,0,0,0.08)' }}>
            <h2 style={{ fontSize: 15, fontWeight: 'bold', borderLeft: '4px solid #e84040', paddingLeft: 10, marginBottom: 14 }}>
              👍 ポイント
            </h2>
            <div style={{ fontSize: 14, lineHeight: 1.8, color: '#333' }}>
              {data.points.map((point, i) => (
                <div key={i} style={{ marginBottom: 12 }}>
                  <div style={{ fontWeight: 'bold', marginBottom: 4 }}>{point}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 地図 */}
        {showMap && (data.lat || data.address) && (
          <div style={{ background: 'white', borderRadius: 10, padding: 20, marginBottom: 16, boxShadow: '0 1px 4px rgba(0,0,0,0.08)' }}>
            <h2 style={{ fontSize: 15, fontWeight: 'bold', borderLeft: '4px solid #e84040', paddingLeft: 10, marginBottom: 10 }}>地図</h2>
            {data.address && <p style={{ fontSize: 13, color: '#666', marginBottom: 10 }}>{data.address}周辺</p>}
            <div style={{ borderRadius: 8, overflow: 'hidden', border: '1px solid #e0e0e0', height: 380 }}>
              {mapsLoaded && data.lat && data.lng ? (
                <GoogleMap
                  mapContainerStyle={{ width: '100%', height: '100%' }}
                  center={{ lat: data.lat, lng: data.lng }}
                  zoom={17}
                  onLoad={onMapLoad}
                  options={{ zoomControl: true, streetViewControl: false, mapTypeControl: false, fullscreenControl: true }}
                />
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#999', fontSize: 14 }}>
                  地図を読み込み中...
                </div>
              )}
            </div>
          </div>
        )}

        {/* 物件概要 */}
        {detailRows.length > 0 && (
          <div style={{ background: 'white', borderRadius: 10, padding: 20, marginBottom: 16, boxShadow: '0 1px 4px rgba(0,0,0,0.08)' }}>
            <h2 style={{ fontSize: 15, fontWeight: 'bold', borderLeft: '4px solid #e84040', paddingLeft: 10, marginBottom: 14 }}>物件概要</h2>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
              <tbody>
                {detailRows.map(row => (
                  <tr key={row.label} style={{ borderBottom: '1px solid #f0f0f0' }}>
                    <th style={{ width: 120, padding: '10px 12px', background: '#fafafa', color: '#666', fontWeight: 'normal', textAlign: 'left', whiteSpace: 'nowrap', verticalAlign: 'top' }}>{row.label}</th>
                    <td style={{ padding: '10px 12px', lineHeight: 1.6 }}>{row.value}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* 署名 + 印刷ボタン（目立たない小さな丸ボタン） */}
        <div style={{ background: 'white', borderRadius: 10, padding: 24, textAlign: 'center', boxShadow: '0 1px 4px rgba(0,0,0,0.08)', marginBottom: 16, position: 'relative' }}>
          <div style={{ fontSize: 17, fontWeight: 'bold', marginBottom: 4 }}>株式会社いふう</div>
          <div style={{ fontSize: 13, color: '#666', marginBottom: 2 }}>大分市舞鶴町1-3-30 STビル１F</div>
          {/* 印刷ボタン（目立たない小さな丸ボタン・右下隅） */}
          <button
            onClick={() => setShowPrintSheet(true)}
            title="印刷"
            style={{
              position: 'absolute', bottom: 10, right: 12,
              width: 28, height: 28, borderRadius: '50%',
              background: '#e0e0e0', border: 'none',
              cursor: 'pointer', fontSize: 14,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              opacity: 0.5,
              transition: 'opacity 0.2s',
            }}
            onMouseEnter={e => (e.currentTarget.style.opacity = '1')}
            onMouseLeave={e => (e.currentTarget.style.opacity = '0.5')}
          >
            🖨
          </button>
          {/* 提供元情報ボタン（極めて目立たない・左下隅） */}
          <button
            onClick={() => setShowProvider(v => !v)}
            title=""
            style={{
              position: 'absolute', bottom: 10, left: 12,
              width: 18, height: 18, borderRadius: '50%',
              background: '#e8e8e8', border: 'none',
              cursor: 'pointer', fontSize: 9,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              opacity: 0.3,
              transition: 'opacity 0.2s',
              color: '#999',
            }}
            onMouseEnter={e => (e.currentTarget.style.opacity = '0.7')}
            onMouseLeave={e => (e.currentTarget.style.opacity = '0.3')}
          >
            ℹ
          </button>
          {/* 提供元情報ポップアップ */}
          {showProvider && (
            <div style={{
              position: 'absolute', bottom: 36, left: 12,
              background: 'white', border: '1px solid #ddd',
              borderRadius: 8, padding: '12px 16px',
              boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
              textAlign: 'left', zIndex: 10, minWidth: 220,
            }}>
              <div style={{ fontSize: 11, color: '#999', marginBottom: 6 }}>提供元情報</div>
              {(data.provider_name || data.details?.['お問合せ先']) && (
                <div style={{ fontSize: 13, fontWeight: 'bold', color: '#333', marginBottom: 4 }}>
                  {data.provider_name || data.details?.['お問合せ先']}
                </div>
              )}
              {(data.provider_phone || data.details?.['電話番号']) && (
                <div style={{ fontSize: 13, color: '#555', marginBottom: 4 }}>
                  📞 {data.provider_phone || data.details?.['電話番号']}
                </div>
              )}
              {(data.provider_hours || data.details?.['営業時間']) && (
                <div style={{ fontSize: 12, color: '#777' }}>
                  🕐 {data.provider_hours || data.details?.['営業時間']}
                </div>
              )}
              {!data.provider_name && !data.details?.['お問合せ先'] && (
                <div style={{ fontSize: 12, color: '#999' }}>情報がありません</div>
              )}
              <button
                onClick={() => setShowProvider(false)}
                style={{ marginTop: 8, fontSize: 11, color: '#999', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
              >
                閉じる
              </button>
            </div>
          )}
        </div>

        {/* お問い合わせフォーム */}
        <PreviewInquiryForm title={data.title || ''} address={data.address || ''} slug={slug || ''} sourceUrl={data.source_url || ''} />

      </div>

      {/* 印刷シート（モーダル表示） */}
      {showPrintSheet && data && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 10000 }}>
          <PropertyPrintSheet 
            data={data} 
            onClose={() => setShowPrintSheet(false)} 
          />
        </div>
      )}

      {/* 印刷用スタイル */}
      <style>{`
        @media print {
          /* 印刷時に不要な要素を非表示 */
          button, .no-print { display: none !important; }
          /* 背景色を印刷 */
          * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          body { background: white !important; }
          /* ページ余白 */
          @page { margin: 15mm; }
          /* 改ページ制御 */
          iframe { height: 300px !important; }
        }
      `}</style>
    </div>
  );
}
