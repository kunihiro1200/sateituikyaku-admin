import { Box, Typography, Grid } from '@mui/material';
import { useEffect, useState } from 'react';

interface PropertyPrintSheetProps {
  data: any;
  onClose: () => void;
}

/**
 * 物件情報を横向きA4 1枚にまとめて印刷するコンポーネント
 * OpenAI/Claude AIで解析したデータを見やすくレイアウト
 */
export default function PropertyPrintSheet({ data, onClose }: PropertyPrintSheetProps) {
  const [enhancedData, setEnhancedData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // AI解析を実行
    enhanceDataWithAI();
  }, [data]);

  const enhanceDataWithAI = async () => {
    try {
      setLoading(true);
      
      // バックエンドのAI解析エンドポイントを呼び出し
      const backendUrl = import.meta.env.MODE === 'production'
        ? 'https://sateituikyaku-admin-backend.vercel.app'
        : (import.meta.env.VITE_API_URL || 'http://localhost:3000');
      
      const response = await fetch(`${backendUrl}/api/ai/enhance-property-data`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ propertyData: data }),
      });

      if (!response.ok) {
        throw new Error('AI解析に失敗しました');
      }

      const result = await response.json();
      setEnhancedData(result.enhanced);
    } catch (error) {
      console.error('AI解析エラー:', error);
      // エラー時は元のデータを使用
      setEnhancedData(data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // 印刷ダイアログを自動的に開く
    if (!loading && enhancedData) {
      setTimeout(() => {
        window.print();
      }, 500);
    }
  }, [loading, enhancedData]);

  if (loading || !enhancedData) {
    return (
      <Box sx={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        height: '100vh',
        backgroundColor: '#fff'
      }}>
        <Typography>AI解析中...</Typography>
      </Box>
    );
  }

  // 主要な画像を取得（間取り図、外観、内観）
  const floorPlanImage = enhancedData.images?.find((img: string) => 
    img.includes('間取') || enhancedData.image_categories?.['区画・間取り']?.includes(img)
  ) || enhancedData.image_categories?.['区画・間取り']?.[0];

  const exteriorImage = enhancedData.images?.find((img: string) => 
    img.includes('外観')
  ) || enhancedData.image_categories?.['外観・室内']?.[0];

  const interiorImages = enhancedData.image_categories?.['外観・室内']?.slice(1, 4) || 
    enhancedData.images?.slice(0, 3) || [];

  return (
    <>
      <style>{`
        @media print {
          @page {
            size: A4 landscape;
            margin: 5mm;
          }
          html, body {
            margin: 0 !important;
            padding: 0 !important;
            width: 297mm !important;
            height: 210mm !important;
            overflow: hidden !important;
          }
          .no-print {
            display: none !important;
          }
          * {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
            page-break-inside: avoid !important;
            page-break-after: avoid !important;
            page-break-before: avoid !important;
          }
          .print-sheet {
            width: 287mm !important;
            height: 200mm !important;
            margin: 0 !important;
            padding: 5mm !important;
            box-shadow: none !important;
            overflow: hidden !important;
            position: absolute !important;
            top: 0 !important;
            left: 0 !important;
          }
          img {
            max-height: 100% !important;
            page-break-inside: avoid !important;
          }
        }
        @media screen {
          body {
            background: #666;
            margin: 0;
            padding: 20px;
          }
          .print-sheet {
            width: 297mm;
            height: 210mm;
            margin: 0 auto;
            box-shadow: 0 0 20px rgba(0,0,0,0.3);
          }
        }
      `}</style>

      {/* 閉じるボタン（画面表示時のみ） */}
      <Box className="no-print" sx={{ 
        position: 'fixed', 
        top: 20, 
        right: 20, 
        zIndex: 9999,
        display: 'flex',
        gap: 2
      }}>
        <button
          onClick={() => window.print()}
          style={{
            padding: '10px 20px',
            backgroundColor: '#666',
            color: '#fff',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
            fontSize: '14px'
          }}
        >
          印刷
        </button>
        <button
          onClick={onClose}
          style={{
            padding: '10px 20px',
            backgroundColor: '#999',
            color: '#fff',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
            fontSize: '14px'
          }}
        >
          閉じる
        </button>
      </Box>

      {/* A4横向き1枚のレイアウト */}
      <Box className="print-sheet" sx={{ 
        width: '297mm',
        height: '210mm',
        maxWidth: '297mm',
        maxHeight: '210mm',
        backgroundColor: '#fff',
        padding: '5mm',
        boxSizing: 'border-box',
        fontFamily: '"Hiragino Kaku Gothic ProN", "Meiryo", sans-serif',
        overflow: 'hidden',
        position: 'relative',
        display: 'flex',
        flexDirection: 'column'
      }}>
        {/* ヘッダー（赤背景） */}
        <Box sx={{ 
          backgroundColor: '#d32f2f',
          color: '#fff',
          padding: '4px 10px',
          marginBottom: '4px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          minHeight: '50px',
          flexShrink: 0
        }}>
          <Box>
            <Typography variant="h5" sx={{ fontWeight: 'bold', fontSize: '20px' }}>
              {enhancedData.address || '住所情報なし'}
            </Typography>
            <Typography variant="body2" sx={{ fontSize: '14px' }}>
              {enhancedData.access || ''}
            </Typography>
          </Box>
          <Box sx={{ textAlign: 'right' }}>
            <Typography variant="h4" sx={{ fontWeight: 'bold', fontSize: '28px' }}>
              {enhancedData.price || '価格情報なし'}
            </Typography>
            <Typography variant="body2" sx={{ fontSize: '12px' }}>
              株式会社いふう
            </Typography>
            <Typography variant="body2" sx={{ fontSize: '11px' }}>
              大分県舞鶴町1-3-30 STビル1F
            </Typography>
          </Box>
        </Box>

        {/* メインコンテンツ */}
        <Grid container spacing={0.5} sx={{ flex: 1, overflow: 'hidden', minHeight: 0 }}>
          {/* 左側：物件写真（最大9枚に削減） */}
          <Grid item xs={6} sx={{ height: '100%', overflow: 'hidden' }}>
            <Box sx={{ 
              border: '1px solid #ddd',
              padding: '4px',
              height: '100%',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
              boxSizing: 'border-box'
            }}>
              <Typography variant="subtitle2" sx={{ 
                fontWeight: 'bold', 
                marginBottom: '2px',
                color: '#d32f2f',
                fontSize: '10px',
                flexShrink: 0
              }}>
                物件写真
              </Typography>
              
              {/* 間取り図（大きめ） */}
              {floorPlanImage && (
                <Box sx={{ marginBottom: '2px', flexShrink: 0 }}>
                  <img 
                    src={floorPlanImage} 
                    alt="間取り図" 
                    style={{ 
                      width: '100%', 
                      height: 'auto',
                      maxHeight: '70px',
                      objectFit: 'contain',
                      border: '1px solid #eee',
                      display: 'block'
                    }} 
                  />
                </Box>
              )}

              {/* その他の写真（グリッド表示・最大8枚に削減） */}
              <Grid container spacing={0.2} sx={{ flex: 1, overflow: 'hidden', minHeight: 0 }}>
                {interiorImages.slice(0, 8).map((img: string, index: number) => (
                  <Grid item xs={4} key={index}>
                    <Box sx={{ 
                      position: 'relative',
                      paddingTop: '75%',
                      overflow: 'hidden',
                      border: '1px solid #eee'
                    }}>
                      <img 
                        src={img} 
                        alt={`物件画像${index + 2}`}
                        style={{ 
                          position: 'absolute',
                          top: 0,
                          left: 0,
                          width: '100%',
                          height: '100%',
                          objectFit: 'cover'
                        }} 
                      />
                      <Typography variant="caption" sx={{ 
                        position: 'absolute',
                        bottom: 0,
                        left: 0,
                        right: 0,
                        backgroundColor: 'rgba(0,0,0,0.6)',
                        color: '#fff',
                        textAlign: 'center',
                        fontSize: '9px',
                        padding: '2px'
                      }}>
                        {index + 2}/13
                      </Typography>
                    </Box>
                  </Grid>
                ))}
              </Grid>
            </Box>
          </Grid>

          {/* 右側：物件詳細情報 */}
          <Grid item xs={6} sx={{ height: '100%', overflow: 'hidden' }}>
            <Box sx={{ 
              display: 'flex',
              flexDirection: 'column',
              height: '100%',
              gap: 0.5,
              overflow: 'hidden'
            }}>
              {/* 物件情報 */}
              <Box sx={{ 
                border: '1px solid #ddd',
                padding: '4px',
                flex: '0 0 auto',
                maxHeight: '50%',
                overflow: 'hidden'
              }}>
                <Typography variant="subtitle2" sx={{ 
                  fontWeight: 'bold', 
                  marginBottom: '2px',
                  color: '#d32f2f',
                  fontSize: '10px'
                }}>
                  物件情報
                </Typography>
                <Grid container spacing={0.2} sx={{ fontSize: '9px' }}>
                  {[
                    { label: '所在地', value: enhancedData.details?.['所在地'] || enhancedData.address },
                    { label: '交通', value: enhancedData.details?.['交通'] || enhancedData.access },
                    { label: '価格', value: enhancedData.details?.['価格'] || enhancedData.price },
                    { label: '物件種目', value: enhancedData.details?.['物件種目'] },
                    { label: '間取り', value: enhancedData.details?.['間取り'] || enhancedData.layout },
                    { label: '専有面積', value: enhancedData.details?.['専有面積'] || enhancedData.area },
                    { label: '階建/階', value: enhancedData.details?.['階建/階'] || enhancedData.details?.['階建 / 階'] || enhancedData.floor },
                    { label: '築年月', value: enhancedData.details?.['築年月'] || enhancedData.built_year },
                    { label: '駐車場', value: enhancedData.details?.['駐車場'] || enhancedData.parking },
                    { label: '土地権利', value: enhancedData.details?.['土地権利'] },
                    { label: '引渡可能時期', value: enhancedData.details?.['引渡可能時期'] },
                  ].filter(item => item.value).map((item, index) => (
                    <Grid item xs={12} key={index}>
                      <Box sx={{ display: 'flex', borderBottom: '1px solid #f0f0f0', padding: '0.5px 0' }}>
                        <Typography sx={{ 
                          width: '70px', 
                          fontWeight: 'bold',
                          fontSize: '8px',
                          color: '#666',
                          flexShrink: 0
                        }}>
                          {item.label}
                        </Typography>
                        <Typography sx={{ 
                          flex: 1,
                          fontSize: '8px',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap'
                        }}>
                          {item.value}
                        </Typography>
                      </Box>
                    </Grid>
                  ))}
                </Grid>
              </Box>

              {/* 地図 */}
              {enhancedData.lat && enhancedData.lng && (
                <Box sx={{ 
                  border: '1px solid #ddd',
                  flex: 1,
                  overflow: 'hidden',
                  position: 'relative',
                  minHeight: 0,
                  maxHeight: '50%'
                }}>
                  <img 
                    src={`https://maps.googleapis.com/maps/api/staticmap?center=${enhancedData.lat},${enhancedData.lng}&zoom=15&size=600x400&markers=color:red%7C${enhancedData.lat},${enhancedData.lng}&key=${import.meta.env.VITE_GOOGLE_MAPS_API_KEY}`}
                    alt="地図"
                    style={{ 
                      width: '100%',
                      height: '100%',
                      objectFit: 'cover'
                    }}
                  />
                  <Typography variant="caption" sx={{ 
                    position: 'absolute',
                    top: 4,
                    left: 4,
                    backgroundColor: 'rgba(255,255,255,0.9)',
                    padding: '2px 6px',
                    borderRadius: '2px',
                    fontSize: '10px',
                    fontWeight: 'bold'
                  }}>
                    地図
                  </Typography>
                </Box>
              )}
            </Box>
          </Grid>
        </Grid>
      </Box>
    </>
  );
}
