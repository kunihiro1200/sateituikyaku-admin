import React, { useState, useRef } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import {
  Box,
  Button,
  TextField,
  Typography,
  Paper,
  Grid,
  Divider,
} from '@mui/material';
import PrintIcon from '@mui/icons-material/Print';
import EditIcon from '@mui/icons-material/Edit';

interface ScheduleData {
  sellerName: string;
  propertyAddress: string;
  startMonth: string;       // 売出月 例: "2026年7月"
  startPrice: string;       // 売出価格 例: "2590"（万円）
  minPrice: string;         // 最低価格（最低ライン）例: "2390"
  contractMonth: string;    // 売買契約月 例: "2026年10月"
  settlementMonth: string;  // 決済（物件引き渡し）月 例: "2026年12月"
}

/** 価格を万円表示に変換（"2590" → "2,590万円"） */
const formatPrice = (val: string) => {
  const n = parseInt(val.replace(/,/g, ''), 10);
  if (isNaN(n)) return val + '万円';
  return n.toLocaleString() + '万円';
};

/** 月から数値を取り出す（"2026年7月" → 7） */
const getMonth = (val: string) => {
  const m = val.match(/(\d+)月/);
  return m ? parseInt(m[1]) : null;
};

/** 価格見直し例（段階的に下げる中間価格を計算） */
const getMidPrice1 = (start: number, min: number) => {
  // 1段階目：startから(start-min)/2くらい
  return Math.round((start + min) / 2 / 10) * 10;
};

const getMidPrice2 = (start: number, min: number) => {
  const mid = getMidPrice1(start, min);
  return Math.round((mid + min) / 2 / 10) * 10;
};

// ==============================
// 印刷用スケジュールカード
// ==============================
const ScheduleCard: React.FC<{ data: ScheduleData }> = ({ data }) => {
  const startPriceNum = parseInt(data.startPrice.replace(/,/g, ''), 10);
  const minPriceNum = parseInt(data.minPrice.replace(/,/g, ''), 10);

  const startMonth = getMonth(data.startMonth);
  const contractMonth = getMonth(data.contractMonth);
  const settlementMonth = getMonth(data.settlementMonth);

  // 中間月を計算（売出〜契約の間）
  const getMidMonth = (m1: number | null, m2: number | null) => {
    if (!m1 || !m2) return null;
    let diff = m2 - m1;
    if (diff <= 0) diff += 12;
    const mid = m1 + Math.floor(diff / 2);
    return mid > 12 ? mid - 12 : mid;
  };

  const year = data.startMonth.match(/(\d{4})年/)?.[1] || '2026';

  const month2 = getMidMonth(startMonth, contractMonth);
  const month3 = month2 && contractMonth ? getMidMonth(month2, contractMonth) : null;

  const mid1Price = !isNaN(startPriceNum) && !isNaN(minPriceNum)
    ? getMidPrice1(startPriceNum, minPriceNum) : null;
  const mid2Price = !isNaN(startPriceNum) && !isNaN(minPriceNum)
    ? getMidPrice2(startPriceNum, minPriceNum) : null;
  const mid2Price2 = mid2Price && !isNaN(minPriceNum)
    ? Math.round((mid2Price + minPriceNum) / 2 / 10) * 10 : null;

  const timelineItems = [
    {
      year,
      month: startMonth ? `${startMonth}月` : '─月',
      title: '売出開始',
      titleColor: '#1a6fb5',
      price: formatPrice(data.startPrice),
      priceColor: '#1a6fb5',
      bullets: ['販売スタート', '写真撮影・広告作成', 'ポータルサイト掲載', '販売活動開始'],
      icon: '📷',
    },
    {
      year,
      month: month2 ? `${month2}月` : '─月',
      title: '反響確認・販売強化',
      titleColor: '#e67e00',
      price: mid1Price ? `${mid1Price.toLocaleString()}万円前後` : null,
      priceNote: '（段階的な見直しです）',
      priceColor: '#e67e00',
      bullets: ['お問い合わせ状況を確認', '広告の見直し', 'ご案内対応', '市場動向を見ながら価格を調整'],
      icon: '🔍',
    },
    {
      year,
      month: month3 ? `${month3}月` : '─月',
      title: 'さらに販売促進・再調整',
      titleColor: '#e67e00',
      price: mid2Price && mid2Price2
        ? `${mid2Price.toLocaleString()}万円 → ${mid2Price2.toLocaleString()}万円`
        : null,
      priceNote: '反響を見ながら少しずつ調整',
      priceColor: '#e67e00',
      bullets: ['反響状況を再分析', '訴求ポイントの見直し', 'ご案内・交渉を継続'],
      icon: '📋',
    },
    {
      year,
      month: contractMonth ? `${contractMonth}月` : '─月',
      title: '売買契約',
      titleColor: '#c0392b',
      minPrice: formatPrice(data.minPrice),
      bullets: ['最終価格でご成約を目指します', '条件調整・契約手続き'],
      icon: '🤝',
      isContract: true,
    },
    {
      year,
      month: settlementMonth ? `${settlementMonth}月` : '─月',
      title: '決済・物件引き渡し',
      titleColor: '#1a6fb5',
      bullets: ['残代金受領', '鍵の引き渡し', '売却完了'],
      icon: '🔑',
    },
  ];

  return (
    <Box
      id="schedule-print-area"
      sx={{
        width: '210mm',
        minHeight: '297mm',
        bgcolor: '#fafff8',
        fontFamily: '"Noto Sans JP", "Hiragino Kaku Gothic ProN", sans-serif',
        p: '8mm',
        boxSizing: 'border-box',
        position: 'relative',
        border: '1px solid #eee',
      }}
    >
      {/* ヘッダー */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
        <Box sx={{ flex: 1 }}>
          <Typography sx={{ fontSize: '2rem', fontWeight: 'bold', color: '#1a3c6e', lineHeight: 1.2 }}>
            不動産 売却スケジュール
          </Typography>
          <Box sx={{ mt: 1.5, display: 'flex', flexDirection: 'column', gap: 0.5 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Typography sx={{ fontSize: '0.75rem', color: '#555' }}>📍</Typography>
              <Typography sx={{ fontSize: '0.82rem', color: '#333', fontWeight: 500 }}>
                物件所在地：{data.propertyAddress || '─'}
              </Typography>
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Typography sx={{ fontSize: '0.75rem', color: '#555' }}>👤</Typography>
              <Typography sx={{ fontSize: '0.82rem', color: '#333', fontWeight: 500 }}>
                売主様：{data.sellerName ? `${data.sellerName} 様` : '─'}
              </Typography>
            </Box>
          </Box>
        </Box>
        {/* ロゴエリア（くじら不動産） */}
        <Box sx={{
          width: 80,
          height: 80,
          border: '2px solid #1a3c6e',
          borderRadius: '50%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexDirection: 'column',
          bgcolor: '#f0f4ff',
          ml: 2,
          flexShrink: 0,
        }}>
          <Typography sx={{ fontSize: '1.5rem' }}>🐋</Typography>
          <Typography sx={{ fontSize: '0.55rem', fontWeight: 'bold', color: '#1a3c6e', textAlign: 'center', lineHeight: 1.2 }}>
            KUJIRA<br />REAL ESTATE
          </Typography>
        </Box>
      </Box>

      <Box sx={{ display: 'flex', gap: 1.5 }}>
        {/* 左：タイムライン */}
        <Box sx={{ flex: 1 }}>
          {timelineItems.map((item, i) => (
            <Box key={i} sx={{ display: 'flex', gap: 1, mb: 1.2 }}>
              {/* 月ラベル */}
              <Box sx={{
                width: 52,
                flexShrink: 0,
                textAlign: 'center',
              }}>
                <Typography sx={{ fontSize: '0.65rem', color: '#555', fontWeight: 600 }}>{item.year}年</Typography>
                <Box sx={{
                  bgcolor: item.isContract ? '#c0392b' : '#1a3c6e',
                  color: '#fff',
                  borderRadius: '4px',
                  px: 0.5,
                  py: 0.3,
                  mt: 0.2,
                }}>
                  <Typography sx={{ fontSize: '0.9rem', fontWeight: 'bold', lineHeight: 1 }}>{item.month}</Typography>
                </Box>
                {/* カレンダーアイコン */}
                <Typography sx={{ fontSize: '1.2rem', mt: 0.2 }}>📅</Typography>
              </Box>

              {/* 縦ライン */}
              <Box sx={{
                width: 3,
                bgcolor: item.isContract ? '#c0392b' : '#1a3c6e',
                borderRadius: 2,
                minHeight: '100%',
                alignSelf: 'stretch',
                flexShrink: 0,
              }} />

              {/* カード本体 */}
              <Box sx={{
                flex: 1,
                border: `2px solid ${item.isContract ? '#c0392b' : item.titleColor}`,
                borderRadius: '8px',
                p: 1,
                bgcolor: '#fff',
                boxShadow: '0 1px 4px rgba(0,0,0,0.08)',
              }}>
                {item.isContract ? (
                  // 売買契約カード（最低ライン表示あり）
                  <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                    <Box>
                      <Box sx={{
                        bgcolor: '#c0392b',
                        color: '#fff',
                        px: 1,
                        py: 0.3,
                        borderRadius: '4px',
                        display: 'inline-block',
                        mb: 0.5,
                      }}>
                        <Typography sx={{ fontSize: '0.65rem', fontWeight: 'bold' }}>最低ライン</Typography>
                        <Typography sx={{ fontSize: '1.1rem', fontWeight: 'bold' }}>{item.minPrice}</Typography>
                      </Box>
                    </Box>
                    <Box sx={{ flex: 1 }}>
                      <Typography sx={{ fontSize: '0.85rem', fontWeight: 'bold', color: item.titleColor }}>
                        {item.title}
                      </Typography>
                      {item.bullets?.map((b, j) => (
                        <Typography key={j} sx={{ fontSize: '0.7rem', color: '#444', lineHeight: 1.4 }}>
                          • {b}
                        </Typography>
                      ))}
                    </Box>
                    <Typography sx={{ fontSize: '1.8rem' }}>{item.icon}</Typography>
                  </Box>
                ) : (
                  <>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <Box sx={{ flex: 1 }}>
                        <Box sx={{
                          bgcolor: item.titleColor,
                          color: '#fff',
                          px: 1,
                          py: 0.2,
                          borderRadius: '4px',
                          display: 'inline-block',
                          mb: 0.5,
                        }}>
                          <Typography sx={{ fontSize: '0.8rem', fontWeight: 'bold' }}>{item.title}</Typography>
                        </Box>
                        {item.price && (
                          <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 0.5, mb: 0.3 }}>
                            <Typography sx={{ fontSize: '1.2rem', fontWeight: 'bold', color: item.priceColor }}>
                              {item.price}
                            </Typography>
                            {item.priceNote && (
                              <Typography sx={{ fontSize: '0.65rem', color: '#888' }}>{item.priceNote}</Typography>
                            )}
                          </Box>
                        )}
                        {item.bullets?.map((b, j) => (
                          <Typography key={j} sx={{ fontSize: '0.7rem', color: '#444', lineHeight: 1.4 }}>
                            • {b}
                          </Typography>
                        ))}
                      </Box>
                      <Typography sx={{ fontSize: '1.8rem', ml: 1 }}>{item.icon}</Typography>
                    </Box>
                  </>
                )}
              </Box>
            </Box>
          ))}

          {/* 引っ越し帯 */}
          <Box sx={{
            bgcolor: '#fff9e6',
            border: '1px solid #f0a500',
            borderRadius: '8px',
            p: 1,
            mb: 1.2,
            display: 'flex',
            alignItems: 'center',
            gap: 1,
          }}>
            <Typography sx={{ fontSize: '1.5rem' }}>🚚</Typography>
            <Box>
              <Typography sx={{ fontSize: '0.75rem', fontWeight: 'bold', color: '#e67e00' }}>
                契約後〜決済までの間にお引っ越しを完了
              </Typography>
              <Typography sx={{ fontSize: '0.65rem', color: '#666' }}>
                余裕をもって新生活の準備を進めましょう！
              </Typography>
            </Box>
          </Box>
        </Box>

        {/* 右：説明パネル */}
        <Box sx={{ width: 140, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 1 }}>
          {/* くじら不動産の市場反応パネル */}
          <Box sx={{
            border: '2px solid #1a6fb5',
            borderRadius: '8px',
            p: 1,
            bgcolor: '#f0f6ff',
            textAlign: 'center',
          }}>
            <Typography sx={{ fontSize: '0.7rem', fontWeight: 'bold', color: '#1a3c6e', mb: 0.5 }}>
              くじら不動産が
            </Typography>
            <Typography sx={{ fontSize: '1rem', fontWeight: 'bold', color: '#c0392b' }}>
              市場反応を
            </Typography>
            <Typography sx={{ fontSize: '0.7rem', fontWeight: 'bold', color: '#1a3c6e', mb: 1 }}>
              みながら、
            </Typography>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
              {[
                { icon: '📢', label: '広告' },
                { icon: '👥', label: 'ご案内' },
                { icon: '🔍', label: '価格見直し' },
              ].map((r) => (
                <Box key={r.label} sx={{
                  bgcolor: '#fff',
                  border: '1px solid #1a6fb5',
                  borderRadius: '6px',
                  p: 0.5,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 0.5,
                }}>
                  <Typography sx={{ fontSize: '0.9rem' }}>{r.icon}</Typography>
                  <Typography sx={{ fontSize: '0.7rem', fontWeight: 'bold', color: '#1a3c6e' }}>{r.label}</Typography>
                </Box>
              ))}
            </Box>
            <Typography sx={{ fontSize: '0.65rem', mt: 1, color: '#333' }}>
              を行い、
            </Typography>
            <Typography sx={{ fontSize: '0.9rem', fontWeight: 'bold', color: '#c0392b' }}>
              段階的に
            </Typography>
            <Typography sx={{ fontSize: '0.65rem', color: '#333' }}>
              売却を進める<br />スケジュールです
            </Typography>
          </Box>

          {/* ポイント枠 */}
          <Box sx={{
            border: '2px solid #e67e00',
            borderRadius: '8px',
            p: 1,
            bgcolor: '#fffaf0',
          }}>
            <Typography sx={{ fontSize: '0.72rem', fontWeight: 'bold', color: '#e67e00', mb: 0.5 }}>
              💡 ポイント
            </Typography>
            <Typography sx={{ fontSize: '0.65rem', color: '#444', lineHeight: 1.5 }}>
              価格を一度に下げるのではなく、市場の反応を確認しながら
              <Box component="span" sx={{ color: '#c0392b', fontWeight: 'bold' }}>段階的に調整</Box>
              することで、適正な価格での成約を目指します。
            </Typography>
            <Divider sx={{ my: 0.8 }} />
            <Typography sx={{ fontSize: '0.65rem', color: '#444', lineHeight: 1.5 }}>
              売主様と二人三脚で、納得のいく売却をサポートします！
            </Typography>
          </Box>
        </Box>
      </Box>

      {/* フッター注意書き */}
      <Box sx={{
        mt: 1,
        bgcolor: '#fff9e6',
        border: '1px solid #f0a500',
        borderRadius: '6px',
        p: 1,
        display: 'flex',
        alignItems: 'flex-start',
        gap: 1,
      }}>
        <Typography sx={{ fontSize: '1rem', flexShrink: 0 }}>⚠️</Typography>
        <Typography sx={{ fontSize: '0.68rem', color: '#555', lineHeight: 1.5 }}>
          市場状況や反響状況により、スケジュール・価格は柔軟に見直していきます。
          定期的にご報告し、最善の売却を目指しますのでご安心ください。
        </Typography>
      </Box>
    </Box>
  );
};

// ==============================
// メインページ
// ==============================
const SalesSchedulePage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();

  const [formData, setFormData] = useState<ScheduleData>({
    sellerName: searchParams.get('name') || '',
    propertyAddress: searchParams.get('address') || '',
    startMonth: '',
    startPrice: '',
    minPrice: '',
    contractMonth: '',
    settlementMonth: '',
  });

  const [showPreview, setShowPreview] = useState(false);
  const printRef = useRef<HTMLDivElement>(null);

  const handleChange = (field: keyof ScheduleData) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData((prev) => ({ ...prev, [field]: e.target.value }));
  };

  const isFormValid = () => {
    return (
      formData.startMonth.trim() &&
      formData.startPrice.trim() &&
      formData.minPrice.trim() &&
      formData.contractMonth.trim() &&
      formData.settlementMonth.trim()
    );
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: '#f5f5f5' }}>
      {/* 印刷時は入力フォームを非表示 */}
      <Box className="no-print" sx={{ p: 3 }}>
        <Typography variant="h5" fontWeight="bold" sx={{ mb: 3, color: '#1a3c6e' }}>
          🏡 売却スケジュール作成
        </Typography>

        {!showPreview ? (
          <Paper sx={{ p: 3, maxWidth: 600 }}>
            <Typography variant="h6" sx={{ mb: 2 }}>必要情報を入力してください</Typography>

            <Grid container spacing={2}>
              <Grid item xs={12}>
                <TextField
                  label="売主様のお名前"
                  placeholder="例：石嵜 絢香"
                  value={formData.sellerName}
                  onChange={handleChange('sellerName')}
                  fullWidth
                  size="small"
                  helperText="（任意）「様」は自動で付きます"
                />
              </Grid>
              <Grid item xs={12}>
                <TextField
                  label="物件所在地"
                  placeholder="例：福岡県福岡市西区上山門1丁目3-17 東峰マンション上山門101"
                  value={formData.propertyAddress}
                  onChange={handleChange('propertyAddress')}
                  fullWidth
                  size="small"
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  label="売出月 *"
                  placeholder="例：2026年7月"
                  value={formData.startMonth}
                  onChange={handleChange('startMonth')}
                  fullWidth
                  size="small"
                  required
                  helperText="「2026年7月」のように入力"
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  label="売出価格（万円） *"
                  placeholder="例：2590"
                  value={formData.startPrice}
                  onChange={handleChange('startPrice')}
                  fullWidth
                  size="small"
                  required
                  helperText="数字のみ（万円単位）"
                  type="number"
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  label="最低価格（万円） *"
                  placeholder="例：2390"
                  value={formData.minPrice}
                  onChange={handleChange('minPrice')}
                  fullWidth
                  size="small"
                  required
                  helperText="売買契約時の最低ライン"
                  type="number"
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  label="売買契約月 *"
                  placeholder="例：2026年10月"
                  value={formData.contractMonth}
                  onChange={handleChange('contractMonth')}
                  fullWidth
                  size="small"
                  required
                  helperText="「2026年10月」のように入力"
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  label="決済（物件引き渡し）月 *"
                  placeholder="例：2026年12月"
                  value={formData.settlementMonth}
                  onChange={handleChange('settlementMonth')}
                  fullWidth
                  size="small"
                  required
                  helperText="「2026年12月」のように入力"
                />
              </Grid>
            </Grid>

            <Box sx={{ mt: 3 }}>
              <Button
                variant="contained"
                size="large"
                onClick={() => setShowPreview(true)}
                disabled={!isFormValid()}
                sx={{ bgcolor: '#1a3c6e', '&:hover': { bgcolor: '#0d2244' } }}
              >
                スケジュール表を作成する
              </Button>
            </Box>
          </Paper>
        ) : (
          <Box>
            <Box sx={{ display: 'flex', gap: 2, mb: 2, flexWrap: 'wrap' }}>
              <Button
                variant="outlined"
                startIcon={<EditIcon />}
                onClick={() => setShowPreview(false)}
              >
                内容を修正する
              </Button>
              <Button
                variant="contained"
                startIcon={<PrintIcon />}
                onClick={handlePrint}
                sx={{ bgcolor: '#1a3c6e', '&:hover': { bgcolor: '#0d2244' } }}
              >
                印刷 / PDF保存
              </Button>
            </Box>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              ※ 印刷時はA4縦・余白なしで設定するときれいに出力されます
            </Typography>
          </Box>
        )}
      </Box>

      {/* スケジュール表プレビュー（入力後に表示） */}
      {showPreview && (
        <Box ref={printRef} sx={{ display: 'flex', justifyContent: 'center', pb: 4 }}>
          <ScheduleCard data={formData} />
        </Box>
      )}

      {/* 印刷スタイル */}
      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { margin: 0; padding: 0; }
          #schedule-print-area {
            width: 210mm !important;
            min-height: 297mm !important;
            border: none !important;
            box-shadow: none !important;
          }
        }
      `}</style>
    </Box>
  );
};

export default SalesSchedulePage;
