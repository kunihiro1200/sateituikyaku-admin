import React, { useState, useEffect, useRef } from 'react';
import { Box, Typography, CircularProgress, IconButton, Tooltip, Chip } from '@mui/material';
import RefreshIcon from '@mui/icons-material/Refresh';
import api from '../services/api';
import { ButtonState } from '../hooks/useCallModeQuickButtonState';

interface QuickButtonDef {
  id: string;
  label: string;
}

interface CommentHighlightsPanelProps {
  commentHtml: string;
  quickButtonIds?: QuickButtonDef[];
  getButtonState?: (id: string) => ButtonState | null;
}

/**
 * 保存済みコメントをAIで解析し、クイックボタン関連項目を箇条書きで表示するパネル。
 * あわせて、まだコメントに言及されていないクイックボタン項目を「ヒアリング未」として表示する。
 */
const CommentHighlightsPanel: React.FC<CommentHighlightsPanelProps> = ({
  commentHtml,
  quickButtonIds = [],
  getButtonState,
}) => {
  const [highlights, setHighlights] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const prevCommentRef = useRef<string>('');

  const fetchHighlights = async (html: string) => {
    const plain = html.replace(/<[^>]+>/g, '').trim();
    if (!plain) {
      setHighlights([]);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const res = await api.post('/summarize/comment-highlights', { commentText: html });
      setHighlights(res.data.highlights || []);
    } catch (e: any) {
      console.error('[CommentHighlightsPanel] fetch error:', e);
      const status = e?.response?.status;
      if (status === 429) {
        setError('APIの利用制限中です。しばらく待ってから🔄で再取得してください');
      } else {
        setError('取得に失敗しました');
      }
    } finally {
      setLoading(false);
    }
  };

  // 保存済みコメントが変わったら自動取得
  useEffect(() => {
    if (commentHtml === prevCommentRef.current) return;
    prevCommentRef.current = commentHtml;
    fetchHighlights(commentHtml);
  }, [commentHtml]);

  // ヒアリング未のボタンを計算
  // - クイックボタンが押されていない（pending/persistedでない）
  // - かつAIまとめにそのラベルが含まれていない
  const unhearingButtons = quickButtonIds.filter((btn) => {
    const state = getButtonState ? getButtonState(btn.id) : null;
    if (state === 'pending' || state === 'persisted') return false;
    // AIまとめにラベルが含まれているか確認
    const mentionedInHighlights = highlights.some((h) =>
      h.includes(btn.label)
    );
    return !mentionedInHighlights;
  });

  const plain = commentHtml.replace(/<[^>]+>/g, '').trim();
  const hasContent = plain || highlights.length > 0 || loading;

  // コメントが空でヒアリング未もなければ非表示
  if (!hasContent && unhearingButtons.length === 0) return null;

  return (
    <Box sx={{ mb: 2 }}>
      {/* AIコメントまとめ（コメントがある場合のみ表示） */}
      {hasContent && (
        <Box sx={{ mb: 1.5, p: 1.5, bgcolor: '#f3e5f5', borderRadius: 1, border: '1px solid #ce93d8' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 0.5 }}>
            <Typography variant="subtitle2" sx={{ color: '#6a1b9a', fontWeight: 'bold' }}>
              📌 AIコメントまとめ
            </Typography>
            <Tooltip title="再取得">
              <span>
                <IconButton
                  size="small"
                  onClick={() => fetchHighlights(commentHtml)}
                  disabled={loading}
                  sx={{ color: '#6a1b9a' }}
                >
                  <RefreshIcon fontSize="small" />
                </IconButton>
              </span>
            </Tooltip>
          </Box>

          {loading && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <CircularProgress size={14} sx={{ color: '#6a1b9a' }} />
              <Typography variant="caption" color="text.secondary">解析中...</Typography>
            </Box>
          )}

          {error && !loading && (
            <Typography variant="caption" color="error">{error}</Typography>
          )}

          {!loading && !error && highlights.length === 0 && plain && (
            <Typography variant="caption" color="text.secondary">関連項目なし</Typography>
          )}

          {!loading && highlights.length > 0 && (
            <Box component="ul" sx={{ m: 0, pl: 2.5 }}>
              {highlights.map((item, idx) => (
                <Box component="li" key={idx} sx={{ fontSize: '0.85rem', color: '#4a148c', mb: 0.25 }}>
                  {item}
                </Box>
              ))}
            </Box>
          )}
        </Box>
      )}

      {/* ヒアリング未フィールド */}
      {unhearingButtons.length > 0 && (
        <Box sx={{ p: 1.5, bgcolor: '#fff8e1', borderRadius: 1, border: '1px solid #ffcc02' }}>
          <Typography variant="subtitle2" sx={{ color: '#e65100', fontWeight: 'bold', mb: 0.75 }}>
            ⚠️ ヒアリング未です！ヒアリングしてください！
          </Typography>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75 }}>
            {unhearingButtons.map((btn) => (
              <Chip
                key={btn.id}
                label={btn.label}
                size="small"
                sx={{
                  bgcolor: '#ffe0b2',
                  color: '#bf360c',
                  fontWeight: 'bold',
                  fontSize: '0.75rem',
                }}
              />
            ))}
          </Box>
        </Box>
      )}
    </Box>
  );
};

export default CommentHighlightsPanel;
