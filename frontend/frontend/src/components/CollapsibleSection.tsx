import React, { useState } from 'react';
import { Box, Collapse, IconButton, Paper, Typography } from '@mui/material';
import { ExpandMore, ExpandLess } from '@mui/icons-material';

interface CollapsibleSectionProps {
  title: string;
  count?: number;
  defaultExpanded?: boolean;
  headerColor?: string;
  children: React.ReactNode;
}

/**
 * CollapsibleSection - 折りたたみ可能なセクションコンポーネント
 * 
 * デフォルトは折りたたみ状態。
 * ヘッダークリックで展開/折りたたみを切り替え。
 */
const CollapsibleSection: React.FC<CollapsibleSectionProps> = ({
  title,
  count,
  defaultExpanded = false,
  headerColor,
  children,
}) => {
  const [expanded, setExpanded] = useState(defaultExpanded);

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
