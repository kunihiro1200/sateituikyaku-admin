import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  Typography,
  Box,
  CircularProgress,
  Alert,
  Chip,
} from '@mui/material';
import EmailIcon from '@mui/icons-material/Email';
import { EmailTemplate } from '../types/emailTemplate';
import api from '../services/api';

interface TemplateSelectionModalProps {
  open: boolean;
  onSelect: (template: EmailTemplate) => void;
  onCancel: () => void;
}

/**
 * テンプレート選択モーダル
 * テンプレートをクリックすると即座にメール編集画面へ遷移する
 */
export default function TemplateSelectionModal({
  open,
  onSelect,
  onCancel
}: TemplateSelectionModalProps) {
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      fetchTemplates();
    } else {
      setError(null);
    }
  }, [open]);

  const fetchTemplates = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await api.get('/api/email-templates');
      setTemplates(response.data);
    } catch (err: any) {
      console.error('Failed to fetch templates:', err);
      setError('テンプレートの読み込みに失敗しました');
    } finally {
      setLoading(false);
    }
  };

  // テンプレートをクリックしたら即座にメール編集画面へ
  const handleTemplateClick = (template: EmailTemplate) => {
    onSelect(template);
  };

  return (
    <Dialog
      open={open}
      onClose={onCancel}
      maxWidth="sm"
      fullWidth
    >
      <DialogTitle sx={{ pb: 1 }}>
        メールテンプレートを選択
      </DialogTitle>

      <DialogContent sx={{ pt: 1 }}>
        {loading && (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
            <CircularProgress />
          </Box>
        )}

        {error && (
          <Alert
            severity="error"
            sx={{ mb: 2 }}
            action={
              <Button color="inherit" size="small" onClick={fetchTemplates}>
                再試行
              </Button>
            }
          >
            {error}
          </Alert>
        )}

        {!loading && !error && templates.length === 0 && (
          <Alert severity="info">
            利用可能なテンプレートがありません
          </Alert>
        )}

        {!loading && !error && templates.length > 0 && (
          <>
            <Typography variant="caption" color="text.secondary" sx={{ mb: 1, display: 'block' }}>
              テンプレートをクリックするとメール編集画面が開きます
            </Typography>
            <List disablePadding>
              {templates.map((template, index) => (
                <ListItem key={template.id} disablePadding divider={index < templates.length - 1}>
                  <ListItemButton
                    onClick={() => handleTemplateClick(template)}
                    sx={{
                      py: 1.5,
                      px: 2,
                      '&:hover': {
                        backgroundColor: 'primary.50',
                        '& .template-icon': { opacity: 1 },
                      },
                    }}
                  >
                    <ListItemText
                      primary={
                        <Typography variant="body1" fontWeight={500}>
                          {template.name}
                        </Typography>
                      }
                    />
                    <Chip
                      icon={<EmailIcon sx={{ fontSize: '14px !important' }} />}
                      label="使用"
                      size="small"
                      color="primary"
                      variant="outlined"
                      className="template-icon"
                      sx={{ opacity: 0, transition: 'opacity 0.15s', ml: 1, flexShrink: 0 }}
                    />
                  </ListItemButton>
                </ListItem>
              ))}
            </List>
          </>
        )}
      </DialogContent>

      <DialogActions>
        <Button onClick={onCancel}>
          キャンセル
        </Button>
      </DialogActions>
    </Dialog>
  );
}
