import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import api from '../services/api';

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
}

// ── お問い合わせフォーム ──────────────────────────────
function PreviewInquiryForm({ title, address }: { title: string; address: string }) {
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
    else if (form.message.length < 10) e.message = '10文字以上入力してください';
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

  const mapQuery = data.lat && data.lng
    ? `${data.lat},${data.lng}`
    : encodeURIComponent(data.address || data.title || '');
  const mapSrc = `https://maps.google.com/maps?q=${mapQuery}&z=17&output=embed&hl=ja`;

  const detailRows = [
    showPrice     && data.price     && { label: '価格',     value: data.price },
    showAddress   && data.address   && { label: '所在地',   value: data.address },
    showAccess    && data.access    && { label: '交通',     value: data.access },
    showLayout    && data.layout    && { label: '間取り',   value: data.layout },
    showArea      && data.area      && { label: '専有面積', value: data.area },
    showFloor     && data.floor     && { label: '階建/階',  value: data.floor },
    showBuiltYear && data.built_year && { label: '築年月',  value: data.built_year },
    showParking   && data.parking   && { label: '駐車場',   value: data.parking },
    showFeatures  && data.features  && { label: '設備',     value: data.features },
  ].filter(Boolean) as { label: string; value: string }[];

  return (
    <div style={{ fontFamily: "'Hiragino Sans', 'Meiryo', sans-serif", background: '#f5f5f5', minHeight: '100vh' }}>
      {/* ヘッダー */}
      <div style={{ background: '#e84040', color: 'white', padding: '20px 24px' }}>
        <h1 style={{ fontSize: 20, fontWeight: 'bold', margin: 0 }}>{data.title || '物件情報'}</h1>
        {showPrice && data.price && (
          <div style={{ fontSize: 28, fontWeight: 'bold', marginTop: 6 }}>{data.price}</div>
        )}
        {(showAddress || showAccess) && (
          <div style={{ fontSize: 13, opacity: 0.85, marginTop: 4 }}>
            {showAddress && data.address}{showAddress && showAccess && data.access ? ' ／ ' : ''}{showAccess && data.access}
          </div>
        )}
      </div>

      <div style={{ maxWidth: 900, margin: '0 auto', padding: '20px 16px' }}>

        {/* 画像スライダー */}
        {showImages && images.length > 0 && (
          <div style={{ background: 'white', borderRadius: 10, padding: 20, marginBottom: 16, boxShadow: '0 1px 4px rgba(0,0,0,0.08)' }}>
            <h2 style={{ fontSize: 15, fontWeight: 'bold', borderLeft: '4px solid #e84040', paddingLeft: 10, marginBottom: 14 }}>
              物件写真（{images.length}枚）
            </h2>
            <div style={{ position: 'relative', background: '#111', borderRadius: 8, overflow: 'hidden', marginBottom: 10, aspectRatio: '4/3', display: 'flex', alignItems: 'center', justifyContent: 'center', userSelect: 'none' }}>
              <img src={images[imgIndex]} alt="物件写真" style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', pointerEvents: 'none' }} />
              <div style={{ position: 'absolute', inset: 0, display: 'flex' }}>
                <div style={{ width: '50%', cursor: 'w-resize' }} onClick={() => setImgIndex(i => (i - 1 + images.length) % images.length)} />
                <div style={{ width: '50%', cursor: 'e-resize' }} onClick={() => setImgIndex(i => (i + 1) % images.length)} />
              </div>
              <button onClick={() => setImgIndex(i => (i - 1 + images.length) % images.length)}
                style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', background: 'rgba(255,255,255,0.85)', border: 'none', borderRadius: 4, width: 40, height: 56, fontSize: 22, cursor: 'pointer' }}>‹</button>
              <button onClick={() => setImgIndex(i => (i + 1) % images.length)}
                style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', background: 'rgba(255,255,255,0.85)', border: 'none', borderRadius: 4, width: 40, height: 56, fontSize: 22, cursor: 'pointer' }}>›</button>
              <span style={{ position: 'absolute', top: 10, left: 12, background: 'rgba(0,0,0,0.55)', color: 'white', fontSize: 13, padding: '3px 10px', borderRadius: 20 }}>
                {imgIndex + 1} / {images.length}
              </span>
            </div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {images.map((url, i) => (
                <img key={i} src={url} alt="" onClick={() => setImgIndex(i)}
                  style={{ width: 72, height: 54, objectFit: 'cover', borderRadius: 4, cursor: 'pointer', border: i === imgIndex ? '2px solid #e84040' : '2px solid transparent', opacity: i === imgIndex ? 1 : 0.65 }} />
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

        {/* 地図 */}
        {showMap && (data.lat || data.address) && (
          <div style={{ background: 'white', borderRadius: 10, padding: 20, marginBottom: 16, boxShadow: '0 1px 4px rgba(0,0,0,0.08)' }}>
            <h2 style={{ fontSize: 15, fontWeight: 'bold', borderLeft: '4px solid #e84040', paddingLeft: 10, marginBottom: 10 }}>地図</h2>
            {data.address && <p style={{ fontSize: 13, color: '#666', marginBottom: 10 }}>{data.address}周辺</p>}
            <div style={{ borderRadius: 8, overflow: 'hidden', border: '1px solid #e0e0e0' }}>
              <iframe src={mapSrc} width="100%" height="380" style={{ border: 'none', display: 'block' }} allowFullScreen loading="lazy" />
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
          <div style={{ fontSize: 17, fontWeight: 'bold', marginBottom: 6 }}>株式会社いふう</div>
          <div style={{ fontSize: 22, fontWeight: 'bold', color: '#e84040' }}>
            <a href="tel:0975332022" style={{ color: 'inherit', textDecoration: 'none' }}>097-533-2022</a>
          </div>
          {/* 印刷ボタン（目立たない小さな丸ボタン・右下隅） */}
          <button
            onClick={() => window.print()}
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
        </div>

        {/* お問い合わせフォーム */}
        <PreviewInquiryForm title={data.title || ''} address={data.address || ''} />

      </div>

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
