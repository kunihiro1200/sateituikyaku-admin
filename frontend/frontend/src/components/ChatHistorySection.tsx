import { useState } from 'react';
import {
  Box,
  Typography,
  Paper,
  Chip,
  Button,
  CircularProgress,
} from '@mui/material';
import { ChatHistoryItem } from '../types/chatHistory';
import { format } from 'date-fns';

interface ChatHistorySectionProps {
  chatHistory: ChatHistoryItem[];
  loading: boolean;
}

export default function ChatHistorySection({ chatHistory, loading }: ChatHistorySectionProps) {
  const [expandedHistoryId, setExpandedHistoryId] = useState<string | null>(null);

  // 送信日時をフォーマット（YYYY/MM/DD HH:mm）
  const formatDateTime = (dateString: string): string => {
    try {
      return format(new Date(dateString), 'yyyy/MM/dd HH:mm');
    } catch {
      return dateString;
    }
  };

  // メッセージを最初の3行まで切り詰める
  const truncateMessage = (message: string, maxLines: number = 3): string => {
    const lines = message.split('\n');
    if (lines.length <= maxLines) {
      return message;
    }
    return lines.slice(0, maxLines).join('\n') + '...';
  };

  // 「続きを読む」ボタンを表示するか判定
  const shouldShowReadMore = (message: string): boolean => {
    return message.split('\n').length > 3;
  };

  // 履歴の展開/折りたたみ
  const handleToggleHistoryExpand = (historyId: string) => {
    setExpandedHistoryId(expandedHistoryId === historyId ? null : historyId);
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', p: 2 }}>
        <CircularProgress size={24} />
      </Box>
    );
  }

  return (
    <Box sx={{ mt: 2 }}>
      <Typography variant="h6" sx={{ mb: 1 }}>
        CHAT送信履歴
      </Typography>
      <Box sx={{ maxHeight: 400, overflowY: 'auto' }}>
        {chatHistory.length === 0 ? (
          <Typography variant="body2" color="text.secondary">
            送信履歴はありません
          </Typography>
        ) : (
          chatHistory.map((item) => (
            <Paper key={item.id} sx={{ p: 2, mb: 1 }} elevation={1}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                <Typography variant="caption" color="text.secondary">
                  {formatDateTime(item.sent_at)}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {item.sender_name}
                </Typography>
              </Box>
              <Chip
                label={item.chat_type === 'office' ? '事務' : '担当'}
                size="small"
                color={item.chat_type === 'office' ? 'primary' : 'secondary'}
                sx={{ mb: 1 }}
              />
              <Typography
                variant="body2"
                sx={{
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                }}
              >
                {expandedHistoryId === item.id
                  ? item.message
                  : truncateMessage(item.message, 3)}
              </Typography>
              {shouldShowReadMore(item.message) && (
                <Button
                  size="small"
                  onClick={() => handleToggleHistoryExpand(item.id)}
                  sx={{ mt: 1 }}
                >
                  {expandedHistoryId === item.id ? '閉じる' : '続きを読む'}
                </Button>
              )}
            </Paper>
          ))
        )}
      </Box>
    </Box>
  );
}
