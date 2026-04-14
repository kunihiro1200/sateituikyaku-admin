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
  propertyType?: string;
  brokerInquiry?: string;
  latestViewingDate?: string;
}

/**
 * 物件種別に応じてテンプレートをフィルタリングする
 * テンプレート名の括弧（全角・半角）内の文字列で判定する
 */
export function filterTemplatesByPropertyType(
  templates: EmailTemplate[],
  propertyType?: string
): EmailTemplate[] {
  if (!propertyType) return templates;

  // 括弧内の文字列を抽出する
  function extractBracketContent(name: string): string[] {
    const fullWidth = name.match(/（[^）]*）/g) || [];
    const halfWidth = name.match(/\([^)]*\)/g) || [];
    return [...fullWidth, ...halfWidth].map(m => m.slice(1, -1));
  }

  return templates.filter(template => {
    const bracketContents = extractBracketContent(template.name);
    if (bracketContents.length === 0) return true; // 括弧なし → 常に表示

    const allContent = bracketContents.join('');

    // 戸建て（「戸」を含む種別: 戸, 戸建て, 戸建 など）
    if (propertyType.includes('戸')) {
      return !allContent.includes('土');
    }
    // 土地（「土」を含む種別: 土, 土地 など）
    if (propertyType.includes('土')) {
      return !allContent.includes('戸') && !allContent.includes('マ');
    }
    // マンション（「マ」を含む種別: マ, マンション など）
    if (propertyType.includes('マ')) {
      return !allContent.includes('土');
    }

    return true; // 上記以外の種別 → 全表示
  });
}

/**
 * 業者問合せ・内覧日などの条件に応じてテンプレートをフィルタリングする
 */
export function filterTemplatesByConditions(
  templates: EmailTemplate[],
  brokerInquiry?: string,
  latestViewingDate?: string
): EmailTemplate[] {
  const now = new Date();
  const jstOffset = 9 * 60 * 60000;
  const today = new Date(now.getTime() + (now.getTimezoneOffset() * 60000) + jstOffset);
  today.setHours(0, 0, 0, 0);

  let viewingDate: Date | null = null;
  if (latestViewingDate) {
    const parts = latestViewingDate.includes('/')
      ? latestViewingDate.split('/')
      : latestViewingDate.split('-');
    if (parts.length === 3) {
      viewingDate = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
      viewingDate.setHours(0, 0, 0, 0);
    }
  }

  const isBrokerInquiry = brokerInquiry === '業者問合せ';

  return templates.filter(template => {
    const name = template.name;

    if (isBrokerInquiry) {
      return name === '業者（内覧確定）' || name === '民泊問合せ' || name === '空';
    }

    if (name === '業者（内覧確定）') return false;

    if (name === '☆内覧前日通知メール') {
      if (!viewingDate) return false;
      const twoDaysBefore = new Date(viewingDate);
      twoDaysBefore.setDate(viewingDate.getDate() - 2);
      twoDaysBefore.setHours(0, 0, 0, 0);
      return today.getTime() >= twoDaysBefore.getTime();
    }

    return true;
  });
}

/**
 * テンプレート選択モーダル
 * テンプレートをクリックすると即座にメール編集画面へ遷移する
 */
export default function TemplateSelectionModal({
  open,
  onSelect,
  onCancel,
  propertyType,
  brokerInquiry,
  latestViewingDate,
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

  // 物件種別・業者問合せ・内覧日でフィルタリング
  const filteredByType = filterTemplatesByPropertyType(templates, propertyType);
  const filteredTemplates = filterTemplatesByConditions(filteredByType, brokerInquiry, latestViewingDate);

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

        {!loading && !error && filteredTemplates.length === 0 && (
          <Alert severity="info">
            利用可能なテンプレートがありません
          </Alert>
        )}

        {!loading && !error && filteredTemplates.length > 0 && (
          <>
            <Typography variant="caption" color="text.secondary" sx={{ mb: 1, display: 'block' }}>
              テンプレートをクリックするとメール編集画面が開きます
            </Typography>
            <List disablePadding>
              {filteredTemplates.map((template, index) => (
                <ListItem key={template.id} disablePadding divider={index < filteredTemplates.length - 1}>
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
