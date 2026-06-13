interface PropertyPrintSheetProps {
  data: any;
  onClose: () => void;
  slug?: string;
}

/**
 * 物件情報印刷シート
 * AI解析なし・データをそのまま使用
 * 印刷ボタンで /property-preview/:slug?print=1 を新タブで開く
 */
export default function PropertyPrintSheet({ data, onClose, slug }: PropertyPrintSheetProps) {
  const isFukuoka = (data?.address || '').includes('福岡');
  const companyName = isFukuoka ? '株式会社くじら不動産' : '株式会社いふう';
  const companyAddress = isFukuoka ? '福岡市中央区舞鶴3-1-10' : '大分市舞鶴町1-3-30 STビル1F';

  const images: string[] = data.images || [];
  const displayImages = images.slice(0, 13);

  const fields = [
    { label: '所在地', value: data.details?.['所在地'] || data.address },
    { label: '価格',   value: data.details?.['価格']   || data.price },
    { label: '間取り', value: data.details?.['間取り'] || data.layout },
    { label: '専有面積', value: data.details?.['専有面積'] || data.area },
    { label: '土地面積', value: data.details?.['土地面積'] || data.land_area },
    { label: '階建/階', value: data.details?.['階建/階'] || data.details?.['階建 / 階'] },
    { label: '築年月', value: data.details?.['築年月'] || data.built_year },
    { label: '駐車場', value: data.details?.['駐車場'] || data.parking },
    { label: '物件種目', value: data.details?.['物件種目'] },
    { label: '引渡時期', value: data.details?.['引渡可能時期'] },
  ].filter(f => f.value);

  const mapsApiKey = (import.meta as any).env?.VITE_GOOGLE_MAPS_API_KEY || '';
  const mapUrl = data.lat && data.lng
    ? `https://maps.googleapis.com/maps/api/staticmap?center=${data.lat},${data.lng}&zoom=15&size=500x300&markers=color:red%7C${data.lat},${data.lng}&key=${mapsApiKey}`
    : null;

  const handlePrint = () => {
    if (slug) {
      window.open(`${window.location.origin}/property-preview/${slug}?print=1`, '_blank');
    }
  };

  return (
    <>
      <style>{`
        #print-root-overlay {
          position: fixed;
          top: 0; left: 0; right: 0; bottom: 0;
          background: #555;
          z-index: 9998;
          overflow-y: auto;
          display: flex;
          align-items: flex-start;
          justify-content: center;
          padding: 60px 20px 40px;
        }
        .print-sheet-preview {
          width: 285mm;
          flex-shrink: 0;
          background: #fff;
          box-shadow: 0 4px 24px rgba(0,0,0,0.4);
        }
      `}</style>

      <div id="print-root-overlay">
        <div style={{ position: 'fixed', top: 16, right: 16, zIndex: 9999, display: 'flex', gap: 8 }}>
          <button onClick={handlePrint} style={{
            padding: '10px 20px', background: '#1976d2', color: '#fff',
            border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: 14
          }}>印刷</button>
          <button onClick={onClose} style={{
            padding: '10px 20px', background: '#888', color: '#fff',
            border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: 14
          }}>閉じる</button>
        </div>

        <div className="print-sheet-preview" style={{
          fontFamily: '"Hiragino Kaku Gothic ProN", Meiryo, sans-serif',
          fontSize: 11, color: '#222', boxSizing: 'border-box',
        }}>
          {/* ヘッダー */}
          <div style={{
            background: '#d32f2f', color: '#fff', padding: '6px 10px',
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          }}>
            <div>
              <div style={{ fontSize: 18, fontWeight: 'bold', lineHeight: 1.3 }}>
                {data.address || '住所情報なし'}
              </div>
              {data.access && <div style={{ fontSize: 11, marginTop: 2, opacity: 0.9 }}>{data.access}</div>}
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 24, fontWeight: 'bold' }}>{data.price || '価格情報なし'}</div>
              <div style={{ fontSize: 11 }}>{companyName}</div>
              <div style={{ fontSize: 10, opacity: 0.9 }}>{companyAddress}</div>
            </div>
          </div>

          {/* メインコンテンツ */}
          <div style={{ display: 'flex', gap: 6, padding: '6px' }}>
            {/* 左：写真 */}
            <div style={{ flex: '0 0 52%' }}>
              <div style={{ fontSize: 10, fontWeight: 'bold', color: '#d32f2f', marginBottom: 4 }}>
                物件写真（{displayImages.length}枚）
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6, alignContent: 'space-between' }}>
                {displayImages.map((img, i) => (
                  <div key={i} style={{ position: 'relative' }}>
                    <img src={img} alt={`写真${i + 1}`} style={{
                      width: '100%', aspectRatio: '4/3', objectFit: 'cover',
                      display: 'block', border: '1px solid #ddd'
                    }} />
                    <div style={{
                      position: 'absolute', bottom: 0, left: 0, right: 0,
                      background: 'rgba(0,0,0,0.55)', color: '#fff',
                      fontSize: 7, textAlign: 'center', lineHeight: '13px'
                    }}>{i + 1}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* 右：情報 + 地図 */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div>
                <div style={{ fontSize: 10, fontWeight: 'bold', color: '#d32f2f', marginBottom: 4 }}>物件情報</div>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 10 }}>
                  <tbody>
                    {fields.map((f, i) => (
                      <tr key={i} style={{ borderBottom: '1px solid #eee' }}>
                        <td style={{ width: 60, padding: '3px 4px', fontWeight: 'bold', color: '#555', whiteSpace: 'nowrap' }}>{f.label}</td>
                        <td style={{ padding: '3px 4px' }}>{f.value}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {mapUrl && (
                <div>
                  <div style={{ fontSize: 10, fontWeight: 'bold', color: '#d32f2f', marginBottom: 4 }}>地図</div>
                  <img src={mapUrl} alt="地図" style={{
                    width: '100%', height: 130, objectFit: 'cover',
                    display: 'block', border: '1px solid #ddd'
                  }} />
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
