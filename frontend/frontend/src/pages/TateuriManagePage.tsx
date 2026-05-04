import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';

interface TateuriProperty {
  slug: string;
  title: string | null;
  price: string | null;
  address: string | null;
  images: string[];
  source_url: string;
  created_at: string;
}

export default function TateuriManagePage() {
  const navigate = useNavigate();
  const [properties, setProperties] = useState<TateuriProperty[]>([]);
  const [loading, setLoading] = useState(true);

  // 追加フォーム
  const [addUrl, setAddUrl] = useState('');
  const [adding, setAdding] = useState(false);
  const [addResult, setAddResult] = useState<{ success: boolean; message: string } | null>(null);

  // 削除フォーム
  const [deleteUrl, setDeleteUrl] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [deleteResult, setDeleteResult] = useState<{ success: boolean; message: string } | null>(null);

  const fetchProperties = useCallback(async () => {
    try {
      const res = await api.get('/api/tateuri');
      setProperties(res.data);
    } catch (err) {
      console.error('Failed to fetch:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProperties();
  }, [fetchProperties]);

  const handleAdd = async () => {
    if (!addUrl.trim()) return;
    setAdding(true);
    setAddResult(null);
    try {
      const scrapeApiUrl = import.meta.env.VITE_SCRAPE_API_URL || 'http://localhost:8765';
      const res = await fetch(`${scrapeApiUrl}/scrape`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: addUrl.trim(), is_tateuri: true }),
      });
      if (!res.ok) throw new Error(`スクレイピングサーバーエラー: ${res.status}`);
      const result = await res.json();
      if (!result.success) throw new Error(result.error || '取得失敗');
      setAddResult({ success: true, message: `「${result.data.title?.replace(/\[\d+\].+$/, '').trim() || result.data.address}」を追加しました` });
      setAddUrl('');
      await fetchProperties();
    } catch (err: any) {
      setAddResult({ success: false, message: err.message });
    } finally {
      setAdding(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteUrl.trim()) return;
    setDeleting(true);
    setDeleteResult(null);
    try {
      const res = await api.post('/api/tateuri/delete', { source_url: deleteUrl.trim() });
      const deleted = res.data.deleted || [];
      setDeleteResult({ success: true, message: `${deleted.length}件を削除しました` });
      setDeleteUrl('');
      await fetchProperties();
    } catch (err: any) {
      const msg = err.response?.data?.error || err.message;
      setDeleteResult({ success: false, message: msg });
    } finally {
      setDeleting(false);
    }
  };

  const cleanTitle = (title: string | null) =>
    (title || '').replace(/\[\d+\].+$/, '').trim();

  const sectionStyle: React.CSSProperties = {
    background: 'white', borderRadius: 10, padding: 24,
    marginBottom: 20, boxShadow: '0 1px 4px rgba(0,0,0,0.08)',
  };
  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '10px 14px', fontSize: 14,
    border: '1px solid #ddd', borderRadius: 6, boxSizing: 'border-box',
  };

  return (
    <div style={{ fontFamily: "'Hiragino Sans', 'Meiryo', sans-serif", background: '#f5f5f5', minHeight: '100vh' }}>

      {/* ヘッダー */}
      <div style={{ background: '#2c5f2e', color: 'white', padding: '14px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <h1 style={{ fontSize: 18, fontWeight: 'bold', margin: 0 }}>🏠 建売専門HP 管理画面</h1>
        <button onClick={() => navigate('/tateuri')}
          style={{ background: 'rgba(255,255,255,0.2)', border: '1px solid rgba(255,255,255,0.5)', color: 'white', padding: '6px 14px', borderRadius: 6, cursor: 'pointer', fontSize: 13 }}>
          ← 公開サイトを見る
        </button>
      </div>

      <div style={{ maxWidth: 800, margin: '0 auto', padding: '24px 16px' }}>

        {/* 物件追加 */}
        <div style={sectionStyle}>
          <h2 style={{ fontSize: 16, fontWeight: 'bold', marginBottom: 16, color: '#2c5f2e' }}>＋ 物件を追加</h2>
          <p style={{ fontSize: 13, color: '#666', marginBottom: 12 }}>
            athomeなどの物件URLを入力してください。スクレイピングして自動で情報を取得します。
          </p>
          <div style={{ display: 'flex', gap: 10 }}>
            <input
              style={{ ...inputStyle, flex: 1 }}
              placeholder="https://www.athome.co.jp/kodate/..."
              value={addUrl}
              onChange={e => setAddUrl(e.target.value)}
              disabled={adding}
            />
            <button
              onClick={handleAdd}
              disabled={adding || !addUrl.trim()}
              style={{ background: '#2c5f2e', color: 'white', border: 'none', padding: '10px 20px', borderRadius: 6, cursor: adding ? 'not-allowed' : 'pointer', fontSize: 14, whiteSpace: 'nowrap', opacity: adding ? 0.7 : 1 }}
            >
              {adding ? '取得中...' : '追加'}
            </button>
          </div>
          {addResult && (
            <div style={{ marginTop: 10, padding: '8px 12px', borderRadius: 6, fontSize: 13, background: addResult.success ? '#f0f7f0' : '#fff0f0', color: addResult.success ? '#2c5f2e' : '#e84040', border: `1px solid ${addResult.success ? '#c3e6c3' : '#f5c6c6'}` }}>
              {addResult.success ? '✅ ' : '❌ '}{addResult.message}
            </div>
          )}
        </div>

        {/* 物件削除 */}
        <div style={sectionStyle}>
          <h2 style={{ fontSize: 16, fontWeight: 'bold', marginBottom: 16, color: '#c0392b' }}>🗑 物件を削除（売却済み等）</h2>
          <p style={{ fontSize: 13, color: '#666', marginBottom: 12 }}>
            削除したい物件のURLを入力してください。<br />
            <span style={{ color: '#888' }}>
              ・元のathome等のURL（例: https://www.athome.co.jp/kodate/...）<br />
              ・プレビューURL（例: https://sateituikyaku-admin-frontend.vercel.app/property-preview/abc123）<br />
              どちらでも削除できます。
            </span>
          </p>
          <div style={{ display: 'flex', gap: 10 }}>
            <input
              style={{ ...inputStyle, flex: 1 }}
              placeholder="https://www.athome.co.jp/kodate/..."
              value={deleteUrl}
              onChange={e => setDeleteUrl(e.target.value)}
              disabled={deleting}
            />
            <button
              onClick={handleDelete}
              disabled={deleting || !deleteUrl.trim()}
              style={{ background: '#c0392b', color: 'white', border: 'none', padding: '10px 20px', borderRadius: 6, cursor: deleting ? 'not-allowed' : 'pointer', fontSize: 14, whiteSpace: 'nowrap', opacity: deleting ? 0.7 : 1 }}
            >
              {deleting ? '削除中...' : '削除'}
            </button>
          </div>
          {deleteResult && (
            <div style={{ marginTop: 10, padding: '8px 12px', borderRadius: 6, fontSize: 13, background: deleteResult.success ? '#f0f7f0' : '#fff0f0', color: deleteResult.success ? '#2c5f2e' : '#e84040', border: `1px solid ${deleteResult.success ? '#c3e6c3' : '#f5c6c6'}` }}>
              {deleteResult.success ? '✅ ' : '❌ '}{deleteResult.message}
            </div>
          )}
        </div>

        {/* 掲載中物件一覧 */}
        <div style={sectionStyle}>
          <h2 style={{ fontSize: 16, fontWeight: 'bold', marginBottom: 16 }}>掲載中の物件（{properties.length}件）</h2>
          {loading ? (
            <p style={{ color: '#999', textAlign: 'center' }}>読み込み中...</p>
          ) : properties.length === 0 ? (
            <p style={{ color: '#999', textAlign: 'center' }}>掲載中の物件はありません</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {properties.map(p => (
                <div key={p.slug} style={{ display: 'flex', gap: 12, alignItems: 'center', padding: '10px 12px', background: '#fafafa', borderRadius: 8, border: '1px solid #eee' }}>
                  {p.images?.[0] && (
                    <img src={p.images[0]} alt="" style={{ width: 80, height: 60, objectFit: 'cover', borderRadius: 4, flexShrink: 0 }} />
                  )}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 'bold', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {cleanTitle(p.title) || p.address || '物件情報'}
                    </div>
                    {p.price && <div style={{ fontSize: 14, color: '#e84040', fontWeight: 'bold' }}>{p.price}</div>}
                    {p.address && <div style={{ fontSize: 12, color: '#666' }}>{p.address}</div>}
                    <div style={{ fontSize: 11, color: '#999', marginTop: 2 }}>
                      追加日: {new Date(p.created_at).toLocaleDateString('ja-JP')}
                    </div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flexShrink: 0 }}>
                    <button
                      onClick={() => window.open(`/property-preview/${p.slug}`, '_blank')}
                      style={{ background: '#2c5f2e', color: 'white', border: 'none', padding: '5px 12px', borderRadius: 4, cursor: 'pointer', fontSize: 12 }}
                    >
                      確認
                    </button>
                    <button
                      onClick={() => { setDeleteUrl(p.source_url); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                      style={{ background: '#fff', color: '#c0392b', border: '1px solid #c0392b', padding: '5px 12px', borderRadius: 4, cursor: 'pointer', fontSize: 12 }}
                    >
                      削除
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
