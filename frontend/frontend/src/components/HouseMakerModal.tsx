import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  Box,
  Typography,
  Button,
  CircularProgress,
  IconButton,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import PrintIcon from '@mui/icons-material/Print';
import HomeWorkIcon from '@mui/icons-material/HomeWork';
import api from '../services/api';

interface HouseMakerSection {
  title: string;
  points: string[];
}

interface HouseMakerContent {
  makerName: string;
  tagline: string;
  sections: HouseMakerSection[];
  summary: string;
}

interface HouseMakerModalProps {
  open: boolean;
  onClose: () => void;
  commentHtml: string;
}

// セクションごとのアイコン絵文字
const SECTION_ICONS: Record<string, string> = {
  '構造・耐震性': '🏗️',
  '断熱・省エネ性能': '🌿',
  '設計・デザインの特徴': '✨',
  '品質・アフターサービス': '🛡️',
  '資産価値・売却時のポイント': '💰',
};

const HouseMakerModal: React.FC<HouseMakerModalProps> = ({ open, onClose, commentHtml }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [content, setContent] = useState<HouseMakerContent | null>(null);

  const fetchHouseMakerInfo = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.post('/summarize/house-maker-info', { commentText: commentHtml });
      setContent(res.data.content);
    } catch (e: any) {
      const status = e?.response?.status;
      if (status === 404) {
        setError('コメントにハウスメーカー名が見つかりませんでした。コメントにハウスメーカー名を記入してください。');
      } else if (status === 429) {
        setError('APIの利用制限中です。しばらく待ってから再試行してください。');
      } else {
        setError('情報の取得に失敗しました。再試行してください。');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleOpen = () => {
    if (!content) {
      fetchHouseMakerInfo();
    }
  };

  React.useEffect(() => {
    if (open) {
      handleOpen();
    }
  }, [open]);

  const handlePrint = () => {
    if (!content) return;

    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    // セクションHTMLをデータから直接組み立て（MUIのsxスタイルに依存しない）
    const sectionsHtml = content.sections.map((section) => {
      const icon = SECTION_ICONS[section.title] || '📌';
      const pointsHtml = section.points.map((point) =>
        `<div class="point"><span class="point-dot"></span><span>${point}</span></div>`
      ).join('');
      return `
        <div class="section">
          <div class="section-header">${icon} ${section.title}</div>
          <div class="section-body">${pointsHtml}</div>
        </div>`;
    }).join('');

    printWindow.document.write(`
<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <title>${content.makerName} 特徴・メリット</title>
  <style>
    @page { size: A4 portrait; margin: 12mm 15mm; }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'Hiragino Kaku Gothic ProN', 'Meiryo', 'Yu Gothic', sans-serif;
      font-size: 10pt;
      color: #1a1a2e;
      background: white;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .header {
      background: linear-gradient(135deg, #1a237e 0%, #283593 100%) !important;
      color: white !important;
      padding: 14px 20px 12px;
      border-radius: 6px;
      margin-bottom: 14px;
    }
    .badge {
      display: inline-block;
      background: rgba(255,255,255,0.2);
      border: 1px solid rgba(255,255,255,0.4);
      border-radius: 4px;
      padding: 2px 8px;
      font-size: 7.5pt;
      margin-bottom: 6px;
      color: white;
    }
    .maker-name {
      font-size: 22pt;
      font-weight: 800;
      letter-spacing: 0.02em;
      color: white;
    }
    .tagline {
      font-size: 10pt;
      color: rgba(255,255,255,0.9);
      margin-top: 3px;
    }
    .sections-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 10px;
      margin-bottom: 12px;
    }
    .section {
      border: 1px solid #e0e0e0;
      border-radius: 6px;
      overflow: hidden;
      break-inside: avoid;
    }
    .section-header {
      background: #f0f0f5 !important;
      padding: 7px 10px;
      font-size: 9pt;
      font-weight: 700;
      color: #1a237e !important;
      border-bottom: 1px solid #e0e0e0;
    }
    .section-body {
      padding: 9px 10px;
    }
    .point {
      display: flex;
      align-items: flex-start;
      gap: 7px;
      margin-bottom: 6px;
      font-size: 8.5pt;
      line-height: 1.55;
    }
    .point:last-child { margin-bottom: 0; }
    .point-dot {
      display: inline-block;
      width: 5px;
      height: 5px;
      min-width: 5px;
      background: #1a237e !important;
      border-radius: 50%;
      margin-top: 5px;
    }
    .summary-box {
      background: linear-gradient(135deg, #e8eaf6 0%, #ede7f6 100%) !important;
      border: 1px solid #9fa8da;
      border-radius: 6px;
      padding: 10px 14px;
      text-align: center;
      font-size: 10pt;
      font-weight: 600;
      color: #1a237e !important;
      margin-bottom: 10px;
    }
    .footer {
      text-align: right;
      font-size: 7.5pt;
      color: #9e9e9e;
      border-top: 1px solid #e0e0e0;
      padding-top: 6px;
    }
  </style>
</head>
<body>
  <div class="header">
    <div class="badge">ハウスメーカー資料</div>
    <div class="maker-name">${content.makerName}</div>
    <div class="tagline">${content.tagline}</div>
  </div>
  <div class="sections-grid">
    ${sectionsHtml}
  </div>
  <div class="summary-box">${content.summary}</div>
  <div class="footer">※ この資料はAIが生成した参考情報です</div>
</body>
</html>`);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
      printWindow.close();
    }, 600);
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="md"
      fullWidth
      PaperProps={{ sx: { borderRadius: 2, maxHeight: '90vh' } }}
    >
      {/* ダイアログヘッダー */}
      <Box sx={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        px: 3,
        py: 2,
        borderBottom: '1px solid',
        borderColor: 'divider',
        background: 'linear-gradient(135deg, #1a237e 0%, #283593 100%)',
        color: 'white',
      }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <HomeWorkIcon />
          <Typography variant="h6" fontWeight={700}>
            {content ? `${content.makerName} 特徴・メリット` : 'ハウスメーカー情報'}
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 1 }}>
          {content && (
            <Button
              variant="outlined"
              size="small"
              startIcon={<PrintIcon />}
              onClick={handlePrint}
              sx={{
                color: 'white',
                borderColor: 'rgba(255,255,255,0.6)',
                '&:hover': { borderColor: 'white', background: 'rgba(255,255,255,0.1)' },
              }}
            >
              PDF印刷
            </Button>
          )}
          <IconButton onClick={onClose} size="small" sx={{ color: 'white' }}>
            <CloseIcon />
          </IconButton>
        </Box>
      </Box>

      <DialogContent sx={{ p: 3 }}>
        {/* ローディング */}
        {loading && (
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', py: 6, gap: 2 }}>
            <CircularProgress size={48} />
            <Typography color="text.secondary">
              AIがハウスメーカー情報を生成中...
            </Typography>
          </Box>
        )}

        {/* エラー */}
        {!loading && error && (
          <Box sx={{ textAlign: 'center', py: 4 }}>
            <Typography color="error" gutterBottom>{error}</Typography>
            <Button variant="outlined" onClick={fetchHouseMakerInfo} sx={{ mt: 1 }}>
              再試行
            </Button>
          </Box>
        )}

        {/* コンテンツ */}
        {!loading && !error && content && (
          <Box>
            {/* ヘッダー */}
            <Box className="header" sx={{
              background: 'linear-gradient(135deg, #1a237e 0%, #283593 100%)',
              color: 'white',
              p: 2.5,
              borderRadius: 2,
              mb: 2,
            }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                <Box sx={{
                  display: 'inline-block',
                  background: 'rgba(255,255,255,0.2)',
                  border: '1px solid rgba(255,255,255,0.4)',
                  borderRadius: '4px',
                  px: 1,
                  py: 0.2,
                  fontSize: '0.7rem',
                  color: 'white',
                }}>
                  ハウスメーカー資料
                </Box>
              </Box>
              <Typography variant="h4" fontWeight={800} sx={{ letterSpacing: '0.02em' }}>
                {content.makerName}
              </Typography>
              <Typography variant="body2" sx={{ opacity: 0.9, mt: 0.5 }}>
                {content.tagline}
              </Typography>
            </Box>

            {/* セクション */}
            <Box sx={{
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' },
              gap: 1.5,
              mb: 2,
            }}>
              {content.sections.map((section, idx) => (
                <Box key={idx} sx={{
                  border: '1px solid',
                  borderColor: 'divider',
                  borderRadius: 1.5,
                  overflow: 'hidden',
                }}>
                  <Box sx={{
                    background: '#f5f5f5',
                    px: 1.5,
                    py: 0.8,
                    borderBottom: '1px solid',
                    borderColor: 'divider',
                  }}>
                    <Typography variant="subtitle2" fontWeight={700} color="primary.dark" sx={{ fontSize: '0.82rem' }}>
                      {SECTION_ICONS[section.title] || '📌'} {section.title}
                    </Typography>
                  </Box>
                  <Box sx={{ p: 1.5 }}>
                    {section.points.map((point, pIdx) => (
                      <Box key={pIdx} sx={{ display: 'flex', alignItems: 'flex-start', gap: 1, mb: pIdx < section.points.length - 1 ? 0.8 : 0 }}>
                        <Box sx={{
                          width: 5,
                          height: 5,
                          borderRadius: '50%',
                          background: '#1a237e',
                          mt: '6px',
                          flexShrink: 0,
                        }} />
                        <Typography variant="body2" sx={{ fontSize: '0.8rem', lineHeight: 1.6 }}>
                          {point}
                        </Typography>
                      </Box>
                    ))}
                  </Box>
                </Box>
              ))}
            </Box>

            {/* まとめ */}
            <Box sx={{
              background: 'linear-gradient(135deg, #e8eaf6 0%, #ede7f6 100%)',
              border: '1px solid',
              borderColor: '#9fa8da',
              borderRadius: 1.5,
              p: 1.5,
              textAlign: 'center',
              mb: 1.5,
            }}>
              <Typography variant="body1" fontWeight={600} color="primary.dark">
                {content.summary}
              </Typography>
            </Box>

            {/* フッター */}
            <Box sx={{ textAlign: 'right' }}>
              <Typography variant="caption" color="text.disabled">
                ※ この資料はAIが生成した参考情報です
              </Typography>
            </Box>
          </Box>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default HouseMakerModal;
