import React, { useState, useEffect } from 'react';
import { Box, Collapse, IconButton, Paper, Typography } from '@mui/material';
import { ExpandMore, ExpandLess } from '@mui/icons-material';

interface CollapsibleSectionProps {
  title: string;
  count?: number;
  defaultExpanded?: boolean;
  headerColor?: string;
  children: React.ReactNode;
  /** 外部から展開状態を強制する場合に指定（例: URLハッシュ遷移での自動展開） */
  forceExpanded?: boolean;
}

/**
 * CollapsibleSection - 折りたたみ可能なセクションコンポーネント
 * 
 * デフォルトは折りたたみ状態。
 * ヘッダークリックで展開/折りたたみを切り替え。
 * forceExpanded が true に変わると、外部トリガーで強制的に展開される。
 */
const CollapsibleSection: React.FC<CollapsibleSectionProps> = ({
  title,
  count,
  defaultExpanded = false,
  headerColor,
  children,
  forceExpanded,
}) => {
  const [expanded, setExpanded] = useState(defaultExpanded);

  useEffect(() => {
    if (forceExpanded) {
      setExpanded(true);
    }
  }, [forceExpanded]);

  const handleToggle = () => {
    setExpanded(!expanded);
  };

  return (
    <Paper sx={{ overflow: 'hidden', mb: 0.5 }}>
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          p: 0.75,
          bgcolor: headerColor || 'grey.50',
          cursor: 'pointer',
          '&:hover': {
            filter: 'brightness(0.95)',
          },
        }}
        onClick={handleToggle}
        role="button"
        aria-expanded={expanded}
        aria-label={`${title}セクションを${expanded ? '折りたたむ' : '展開する'}`}
      >
        <Typography variant="h6" sx={{ fontSize: '14px', fontWeight: 600 }}>
          {title}
          {count !== undefined && ` (${count}件)`}
        </Typography>
        <IconButton size="small" aria-label={expanded ? '折りたたむ' : '展開する'}>
          {expanded ? <ExpandLess /> : <ExpandMore />}
        </IconButton>
      </Box>
      <Collapse in={expanded} timeout="auto">
        <Box sx={{ p: 1 }}>
          {children}
        </Box>
      </Collapse>
    </Paper>
  );
};

export default CollapsibleSection;
