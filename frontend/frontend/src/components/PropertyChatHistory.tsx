import React, { useEffect, useState } from 'react';
import {
  Box,
  Typography,
  CircularProgress,
  Alert,
  Paper,
  Divider,
} from '@mui/material';
import { propertyListingApi } from '../services/api';

interface ChatHistoryItem {
  id: string;
  property_number: string;
  chat_type: string;
  message: string;
  sender_name: string;
  sent_at: string;
}

interface PropertyChatHistoryProps {
  propertyNumber: string;
  refreshTrigger?: number;
}

const PropertyChatHistory: React.FC<PropertyChatHistoryProps> = ({
  propertyNumber,
  refreshTrigger = 0,
}) => {
  const [history, setHistory] = useState<ChatHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchChatHistory = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await propertyListingApi.getChatHistory(propertyNumber, {
        chat_type: 'office',
        limit: 5,
      });

      setHistory(response.history || []);
    } catch (err: any) {
      console.error('[PropertyChatHistory] Error fetching chat history:', err);
      setError('CHAT送信履歴の取得に失敗しました');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchChatHistory();
  }, [propertyNumber, refreshTrigger]);

  const formatDateTime = (dateString: string): string => {
    const date = new Date(dateString);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${year}/${month}/${day} ${hours}:${minutes}`;
  };

  const truncateMessage = (message: string, maxLength: number = 100): string => {
    if (message.length <= maxLength) {
      return message;
    }
    return message.substring(0, maxLength) + '...';
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', p: 2 }}>
        <CircularProgress size={24} />
      </Box>
    );
  }

  if (error) {
    return (
      <Box sx={{ p: 2 }}>
        <Alert severity="error">{error}</Alert>
      </Box>
    );
  }

  return (
    <Box sx={{ mt: 2 }}>
      <Typography variant="subtitle2" sx={{ fontWeight: 'bold', mb: 1 }}>
        事務へCHAT送信履歴
      </Typography>

      {history.length === 0 ? (
        <Typography variant="body2" color="text.secondary" sx={{ p: 2 }}>
          送信履歴はありません
        </Typography>
      ) : (
        <Box
          sx={{
            maxHeight: '300px',
            overflowY: 'auto',
            border: '1px solid #e0e0e0',
            borderRadius: 1,
          }}
        >
          {history.map((item, index) => (
            <React.Fragment key={item.id}>
              <Paper
                elevation={0}
                sx={{
                  p: 1.5,
                  backgroundColor: index % 2 === 0 ? '#fafafa' : '#ffffff',
                }}
              >
                <Typography variant="caption" color="text.secondary">
                  {formatDateTime(item.sent_at)} | {item.sender_name}
                </Typography>
                <Typography variant="body2" sx={{ mt: 0.5 }}>
                  {truncateMessage(item.message)}
                </Typography>
              </Paper>
              {index < history.length - 1 && <Divider />}
            </React.Fragment>
          ))}
        </Box>
      )}
    </Box>
  );
};


export default PropertyChatHistory;
