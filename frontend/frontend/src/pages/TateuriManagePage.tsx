import { useEffect, useState, useCallback } from 'react';
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
  const [properties, setProperties] = useState<TateuriProperty[]>([]);
  const [loading, setLoading] = useState(true);
  const [region, setRegion] = useState<'oita' | 'fukuoka'>('oita');
  const [lastAddedSlug, setLastAddedSlug] = useState<string | null>(null);

  // 追加フォーム（通常）
  const [addUrl, setAddUrl] = useState('');
  const [adding, setAdding] = useState(false);
  const [addResult, setAddResult] = useState<{ success: boolean; message: string } | null>(null);

  // 画像加工用URL追加フォーム
  const [processedUrl, setProcessedUrl] = useState('');
  const [addingProcessed, setAddingProcessed] = useState(false);
  const [processedResult, setProcessedResult] = useState<{ success: boolean; message: string } | null>(null);

  // 削除フォーム
  const [deleteUrl, setDeleteUrl] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [deleteResult, setDeleteResult] = useState<{ success: boolean; message: string } | null>(null);

  const fetchProperties = useCallback(async (r?: 'oita' | 'fukuoka') => {
    try {
      const targetRegion = r || region;
      const res = await api.get(`/api/tateuri?region=${targetRegion}`);
      // 追加日の新しい順に並び替え
      const sorted = [...(res.data || [])].sort(
        (a: TateuriProperty, b: TateuriProperty) =>
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
      setProperties(sorted);
    } catch (err) {
      console.error('Failed to fetch:', err);
    } finally {
      setLoading(false);
    }
  }, [region]);

  useEffect(() => {
    fetchProperties();
  }, [fetchProperties]);

  const handleAdd = async () => {
    if (!addUrl.trim()) return;
    setAdding(true);
    setAddResult(null);
    try {
      // URL重複チェック（同じURLが既に登録済みか）
      const dupCheck = await api.post('/api/tateuri/check-duplicate', { source_url: addUrl.trim(), region });
      if (dupCheck.data.isDuplicate) {
        const existing = dupCheck.data.existing;
        const existingTitle = existing.title || existing.address || '物件';
        const existingDate = new Date(existing.created_at).toLocaleDateString('ja-JP');
        const source = existing.source ? `（${existing.source}で登録済み）` : '';
        setAddResult({
          success: false,
          message: `「${existingTitle}」は既に登録済みです${source}（登録日: ${existingDate}）`,
        });
        return;
      }

      // スクレイピングして追加（加工なし）
      const res = await api.post('/api/tateuri/scrape', { url: addUrl.trim(), region, processImages: false });
      if (!res.data.success) throw new Error(res.data.error || '取得失敗');
      const addedTitle = res.data?.data?.title?.replace(/\[\d+\].+$/, '').trim() || res.data?.data?.address || '物件';
      const addedSlug = res.data?.slug || null;

      setAddResult({ success: true, message: `「${addedTitle}」を追加しました` });
      setLastAddedSlug(addedSlug);
      setAddUrl('');
      await fetchProperties();
    } catch (err: any) {
      setAddResult({ success: false, message: err.message });
    } finally {
      setAdding(false);
    }
  };

  const handleAddProcessed = async () => {
    if (!processedUrl.trim()) return;
    setAddingProcessed(true);
    setProcessedResult(null);
    try {
      // URL重複チェック
      const dupCheck = await api.post('/api/tateuri/check-duplicate', { source_url: processedUrl.trim(), region });
      if (dupCheck.data.isDuplicate) {
        const existing = dupCheck.data.existing;
        const existingTitle = existing.title || existing.address || '物件';
        const existingDate = new Date(existing.created_at).toLocaleDateString('ja-JP');
        const source = existing.source ? `（${existing.source}で登録済み）` : '';
        setProcessedResult({
          success: false,
          message: `「${existingTitle}」は既に登録済みです${source}（登録日: ${existingDate}）`,
        });
        return;
      }

      // スクレイピングして追加（画像加工あり）
      const res = await api.post('/api/tateuri/scrape', { url: processedUrl.trim(), region, processImages: true });
      if (!res.data.success) throw new Error(res.data.error || '取得失敗');
      const addedTitle = res.data?.data?.title?.replace(/\[\d+\].+$/, '').trim() || res.data?.data?.address || '物件';
      const addedSlug = res.data?.slug || null;

      setProcessedResult({ success: true, message: `「${addedTitle}」を追加しました（画像加工済み）` });
      setLastAddedSlug(addedSlug);
      setProcessedUrl('');
      await fetchProperties();
    } catch (err: any) {
      setProcessedResult({ success: false, message: err.message });
    } finally {
      setAddingProcessed(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteUrl || !deleteUrl.trim()) return;
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

  const handleDeleteBySlug = async (slug: string, title: string | null) => {
    if (!window.confirm(`「${cleanTitle(title) || '物件'}」を削除しますか？`)) return;
    setDeleting(true);
    setDeleteResult(null);
    try {
      const res = await api.post('/api/tateuri/delete', { source_url: `/property-preview/${slug}` });
      const deleted = res.data.deleted || [];
      setDeleteResult({ success: true, message: `削除しました（${deleted.length}件）` });
      if (lastAddedSlug === slug) setLastAddedSlug(null);
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

  // regionが変わったら再取得
  const handleRegionChange = (r: 'oita' | 'fukuoka') => {
    setRegion(r);
    setLastAddedSlug(null);
    setLoading(true);
    fetchProperties(r);
  };

  // 表示用リスト：最後に追加した物件を先頭に
  const displayProperties = lastAddedSlug
    ? [
        ...properties.filter(p => p.slug === lastAddedSlug),
        ...properties.filter(p => p.slug !== lastAddedSlug),
      ]
    : properties;

  return (
    <div style={{ fontFamily: "'Hiragino Sans', 'Meiryo', sans-serif", background: '#f5f5f5', minHeight: '100vh' }}>

      {/* ヘッダー */}
      <div style={{ background: '#FFC107', color: '#333', padding: '14px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <h1 style={{ fontSize: 18, fontWeight: 'bold', margin: 0 }}>🏠 建売専門HP 管理画面</h1>
        <button onClick={() => window.open('/tateuri', '_blank')}
          style={{ background: 'rgba(0,0,0,0.1)', border: '1px solid rgba(0,0,0,0.2)', color: '#333', padding: '6px 14px', borderRadius: 6, cursor: 'pointer', fontSize: 13 }}>
          🔗 公開サイトを見る
        </button>
      </div>

      <div style={{ maxWidth: 800, margin: '0 auto', padding: '24px 16px' }}>

        {/* regionタブ */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
          <button
            onClick={() => handleRegionChange('oita')}
            style={{
              padding: '8px 24px', borderRadius: 6, border: 'none', cursor: 'pointer', fontSize: 14, fontWeight: 'bold',
              background: region === 'oita' ? '#FFC107' : '#e0e0e0',
              color: region === 'oita' ? '#333' : '#666',
            }}
          >
            🏠 大分（/tateuri）
          </button>
          <button
            onClick={() => handleRegionChange('fukuoka')}
            style={{
              padding: '8px 24px', borderRadius: 6, border: 'none', cursor: 'pointer', fontSize: 14, fontWeight: 'bold',
              background: region === 'fukuoka' ? '#4CAF50' : '#e0e0e0',
              color: region === 'fukuoka' ? 'white' : '#666',
            }}
          >
            🏠 福岡（/fukuoka-tateuri）
          </button>
        </div>

        {/* 物件追加（通常：加工なし） */}
        <div style={sectionStyle}>
          <h2 style={{ fontSize: 16, fontWeight: 'bold', marginBottom: 16, color: '#b8860b' }}>＋ 物件を追加（画像加工なし）</h2>
          <p style={{ fontSize: 13, color: '#666', marginBottom: 12 }}>
            {region === 'oita' ? 'athome' : 'SUUMO'}などの物件URLを入力してください。スクレイピングして自動で情報を取得します。<br />
            <strong style={{ color: '#e84040' }}>※ 画像は元のまま（角度・拡大・帯なし）</strong>
          </p>
          <div style={{ display: 'flex', gap: 10 }}>
            <input
              style={{ ...inputStyle, flex: 1 }}
              placeholder={region === 'oita' ? 'https://www.athome.co.jp/kodate/...' : 'https://suumo.jp/ikkodate/...'}
              value={addUrl}
              onChange={e => setAddUrl(e.target.value)}
              disabled={adding}
            />
            <button
              onClick={handleAdd}
              disabled={adding || !addUrl.trim()}
              style={{ background: '#FFC107', color: '#333', border: 'none', padding: '10px 20px', borderRadius: 6, cursor: adding ? 'not-allowed' : 'pointer', fontSize: 14, whiteSpace: 'nowrap', opacity: adding ? 0.7 : 1, fontWeight: 'bold' }}
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

        {/* 物件追加（画像加工あり） */}
        <div style={sectionStyle}>
          <h2 style={{ fontSize: 16, fontWeight: 'bold', marginBottom: 16, color: '#4CAF50' }}>✨ 物件を追加（画像加工あり）</h2>
          <p style={{ fontSize: 13, color: '#666', marginBottom: 12 }}>
            {region === 'oita' ? 'athome' : 'SUUMO'}などの物件URLを入力してください。スクレイピングして自動で情報を取得します。<br />
            <strong style={{ color: '#4CAF50' }}>※ 画像に角度・拡大・帯を適用します（別の人が撮った写真風）</strong>
          </p>
          <div style={{ display: 'flex', gap: 10 }}>
            <input
              style={{ ...inputStyle, flex: 1 }}
              placeholder={region === 'oita' ? 'https://www.athome.co.jp/kodate/...' : 'https://suumo.jp/ikkodate/...'}
              value={processedUrl}
              onChange={e => setProcessedUrl(e.target.value)}
              disabled={addingProcessed}
            />
            <button
              onClick={handleAddProcessed}
              disabled={addingProcessed || !processedUrl.trim()}
              style={{ background: '#4CAF50', color: 'white', border: 'none', padding: '10px 20px', borderRadius: 6, cursor: addingProcessed ? 'not-allowed' : 'pointer', fontSize: 14, whiteSpace: 'nowrap', opacity: addingProcessed ? 0.7 : 1, fontWeight: 'bold' }}
            >
              {addingProcessed ? '取得中...' : '追加'}
            </button>
          </div>
          {processedResult && (
            <div style={{ marginTop: 10, padding: '8px 12px', borderRadius: 6, fontSize: 13, background: processedResult.success ? '#f0f7f0' : '#fff0f0', color: processedResult.success ? '#2c5f2e' : '#e84040', border: `1px solid ${processedResult.success ? '#c3e6c3' : '#f5c6c6'}` }}>
              {processedResult.success ? '✅ ' : '❌ '}{processedResult.message}
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
          <h2 style={{ fontSize: 16, fontWeight: 'bold', marginBottom: 16 }}>
            掲載中の物件（{properties.length}件）
            {lastAddedSlug && <span style={{ fontSize: 12, color: '#2c5f2e', marginLeft: 10, fontWeight: 'normal' }}>✅ 追加した物件を先頭に表示中</span>}
          </h2>
          {loading ? (
            <p style={{ color: '#999', textAlign: 'center' }}>読み込み中...</p>
          ) : properties.length === 0 ? (
            <p style={{ color: '#999', textAlign: 'center' }}>掲載中の物件はありません</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {displayProperties.map(p => (
                <div key={p.slug} style={{
                  display: 'flex', gap: 12, alignItems: 'center', padding: '10px 12px',
                  background: p.slug === lastAddedSlug ? '#f0f7f0' : '#fafafa',
                  borderRadius: 8,
                  border: p.slug === lastAddedSlug ? '2px solid #4CAF50' : '1px solid #eee',
                }}>
                  {p.images?.[0] && (
                    <img src={p.images[0]} alt="" style={{ width: 80, height: 60, objectFit: 'cover', borderRadius: 4, flexShrink: 0 }} />
                  )}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 'bold', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {p.slug === lastAddedSlug && <span style={{ fontSize: 11, background: '#4CAF50', color: 'white', padding: '1px 6px', borderRadius: 3, marginRight: 6 }}>NEW</span>}
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
                      style={{ background: '#FFC107', color: '#333', border: 'none', padding: '5px 12px', borderRadius: 4, cursor: 'pointer', fontSize: 12, fontWeight: 'bold' }}
                    >
                      確認
                    </button>
                    <button
                      onClick={() => handleDeleteBySlug(p.slug, p.title)}
                      disabled={deleting}
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
