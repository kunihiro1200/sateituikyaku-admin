import { useEffect, useState } from 'react';

interface PropertyPrintSheetProps {
  data: any;
  onClose: () => void;
}

/**
 * 物件情報を横向きA4 1枚にまとめて印刷するコンポーネント
 * 印刷時に画像が消えないようposition:absolute・overflow:hiddenを一切使わないシンプルな実装
 */
export default function PropertyPrintSheet({ data, onClose }: PropertyPrintSheetProps) {
  const [enhancedData, setEnhancedData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // 福岡判定
  const isFukuoka = (data?.address || '').includes('福岡');
  const companyName = isFukuoka ? '株式会社くじら不動産' : '株式会社いふう';
  const companyAddress = isFukuoka ? '福岡市中央区舞鶴3-1-10' : '大分市舞鶴町1-3-30 STビル1F';

  useEffect(() => {
    enhanceDataWithAI();
  }, [data]);

  const enhanceDataWithAI = async () => {
    try {
      setLoading(true);
      const backendUrl = import.meta.env.MODE === 'production'
        ? 'https://sateituikyaku-admin-backend.vercel.app'
        : (import.meta.env.VITE_API_URL || 'http://localhost:3000');

      const response = await fetch(`${backendUrl}/api/ai/enhance-property-data`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ propertyData: data }),
      });

      if (!response.ok) throw new Error('AI解析失敗');
      const result = await response.json();
      setEnhancedData(result.enhanced);
    } catch {
      setEnhancedData(data);
    } finally {
      setLoading(false);
    }
  };

  if (loading || !enhancedData) {
    return (
      <div style={{
        position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
        background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 9999, fontSize: 18
      }}>
        AI解析中...
      </div>
    );
  }

  // 画像リスト（最大13枚）
  const images: string[] = enhancedData.images || data.images || [];
  const displayImages = images.slice(0, 13);

  // 物件情報フィールド
  const fields = [
    { label: '所在地', value: enhancedData.details?.['所在地'] || enhancedData.address },
    { label: '価格',   value: enhancedData.details?.['価格']   || enhancedData.price },
    { label: '間取り', value: enhancedData.details?.['間取り'] || enhancedData.layout },
    { label: '専有面積', value: enhancedData.details?.['専有面積'] || enhancedData.area },
    { label: '土地面積', value: enhancedData.details?.['土地面積'] || enhancedData.land_area },
    { label: '階建/階', value: enhancedData.details?.['階建/階'] || enhancedData.details?.['階建 / 階'] },
    { label: '築年月', value: enhancedData.details?.['築年月'] || enhancedData.built_year },
    { label: '駐車場', value: enhancedData.details?.['駐車場'] || enhancedData.parking },
    { label: '物件種目', value: enhancedData.details?.['物件種目'] },
    { label: '引渡時期', value: enhancedData.details?.['引渡可能時期'] },
  ].filter(f => f.value);

  const mapsApiKey = (import.meta as any).env?.VITE_GOOGLE_MAPS_API_KEY || '';
  const mapUrl = enhancedData.lat && enhancedData.lng
    ? `https://maps.googleapis.com/maps/api/staticmap?center=${enhancedData.lat},${enhancedData.lng}&zoom=15&size=500x300&markers=color:red%7C${enhancedData.lat},${enhancedData.lng}&key=${mapsApiKey}`
    : null;

  // 印刷専用ウィンドウを開いてHTMLを流し込む
  const handlePrint = () => {
    const printWindow = window.open('', '_blank', 'width=1200,height=850');
    if (!printWindow) return;

    const sheetEl = document.getElementById('print-sheet-content');
    if (!sheetEl) return;

    printWindow.document.write(`<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8" />
  <title>物件情報</title>
  <style>
    @page { size: A4 landscape; margin: 6mm; }
    * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; box-sizing: border-box; }
    body { margin: 0; padding: 0; font-family: "Hiragino Kaku Gothic ProN", Meiryo, sans-serif; font-size: 9pt; }
    img { display: block; }
  </style>
</head>
<body>
${sheetEl.innerHTML}
</body>
</html>`);
    printWindow.document.close();
    // 画像読み込み完了後に印刷
    printWindow.onload = () => {
      printWindow.focus();
      printWindow.print();
      printWindow.close();
    };
  };

  return (
    <>
      <style>{`
        #print-root {
          position: fixed;
          top: 0; left: 0; right: 0; bottom: 0;
          background: #555;
          z-index: 9998;
          overflow-y: auto;
          padding: 20px 20px 40px;
        }
        .print-sheet {
          width: 285mm;
          margin: 0 auto;
          background: #fff;
          box-shadow: 0 4px 24px rgba(0,0,0,0.4);
        }
      `}</style>

      <div id="print-root">
        {/* 操作ボタン */}
        <div style={{
          position: 'fixed', top: 16, right: 16, zIndex: 9999,
          display: 'flex', gap: 8
        }}>
          <button onClick={handlePrint} style={{
            padding: '10px 20px', background: '#1976d2', color: '#fff',
            border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: 14
          }}>印刷</button>
          <button onClick={onClose} style={{
            padding: '10px 20px', background: '#888', color: '#fff',
            border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: 14
          }}>閉じる</button>
        </div>

        {/* A4横向きシート */}
        <div id="print-sheet-content" className="print-sheet" style={{
          fontFamily: '"Hiragino Kaku Gothic ProN", Meiryo, sans-serif',
          fontSize: 9,
          color: '#222',
          boxSizing: 'border-box',
        }}>

          {/* ヘッダー */}
          <div style={{
            background: '#d32f2f', color: '#fff',
            padding: '6px 10px',
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          }}>
            <div>
              <div style={{ fontSize: 18, fontWeight: 'bold', lineHeight: 1.3 }}>
                {enhancedData.address || '住所情報なし'}
              </div>
              {enhancedData.access && (
                <div style={{ fontSize: 11, marginTop: 2, opacity: 0.9 }}>
                  {enhancedData.access}
                </div>
              )}
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 24, fontWeight: 'bold' }}>
                {enhancedData.price || '価格情報なし'}
              </div>
              <div style={{ fontSize: 11 }}>{companyName}</div>
              <div style={{ fontSize: 10, opacity: 0.9 }}>{companyAddress}</div>
            </div>
          </div>

          {/* メインコンテンツ（左右2カラム） */}
          <div style={{ display: 'flex', gap: 4, padding: '4px 4px 4px 4px' }}>

            {/* 左カラム：物件写真 */}
            <div style={{ flex: '0 0 52%' }}>
              <div style={{ fontSize: 9, fontWeight: 'bold', color: '#d32f2f', marginBottom: 3 }}>
                物件写真（{displayImages.length}枚）
              </div>
              {/* 写真グリッド：1行4枚 */}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 2 }}>
                {displayImages.map((img, i) => (
                  <div key={i} style={{ width: 'calc(25% - 2px)', position: 'relative' }}>
                    <img
                      src={img}
                      alt={`写真${i + 1}`}
                      style={{
                        width: '100%',
                        height: 72,
                        objectFit: 'cover',
                        display: 'block',
                        border: '1px solid #ddd',
                      }}
                    />
                    <div style={{
                      position: 'absolute', bottom: 0, left: 0, right: 0,
                      background: 'rgba(0,0,0,0.55)', color: '#fff',
                      fontSize: 7, textAlign: 'center', lineHeight: '13px'
                    }}>{i + 1}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* 右カラム：物件情報 + 地図 */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>

              {/* 物件情報テーブル */}
              <div>
                <div style={{ fontSize: 9, fontWeight: 'bold', color: '#d32f2f', marginBottom: 3 }}>
                  物件情報
                </div>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 8 }}>
                  <tbody>
                    {fields.map((f, i) => (
                      <tr key={i} style={{ borderBottom: '1px solid #eee' }}>
                        <td style={{
                          width: 60, padding: '2px 4px',
                          fontWeight: 'bold', color: '#555',
                          whiteSpace: 'nowrap', verticalAlign: 'top'
                        }}>{f.label}</td>
                        <td style={{ padding: '2px 4px', verticalAlign: 'top' }}>{f.value}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* 地図 */}
              {mapUrl && (
                <div>
                  <div style={{ fontSize: 9, fontWeight: 'bold', color: '#d32f2f', marginBottom: 3 }}>
                    地図
                  </div>
                  <img
                    src={mapUrl}
                    alt="地図"
                    style={{ width: '100%', display: 'block', border: '1px solid #ddd' }}
                  />
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
