import React, { useState } from 'react';
import { Box, ToggleButton, ToggleButtonGroup, Typography, CircularProgress, Alert } from '@mui/material';
import api from '../services/api';

interface MatchContactStatusPanelProps {
  entityType: 'seller' | 'buyer';
  entityId: string;
  initialStatus?: string | null;
}

const OPTIONS = ['連絡済み', '連絡不要', '連絡未'] as const;

/**
 * マッチング通知（サイドバー）に対する連絡状況を記録するパネル。
 * 「連絡済み」「連絡不要」を選ぶとサイドバーの通知カウントから除外されるが、
 * 記録自体はこのパネル（つうわモードページ・買主詳細ページ）から常に確認できる。
 */
const MatchContactStatusPanel: React.FC<MatchContactStatusPanelProps> = ({ entityType, entityId, initialStatus }) => {
  const [status, setStatus] = useState<string | null>(initialStatus ?? null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const basePath = entityType === 'seller' ? `/api/sellers/${entityId}` : `/api/buyers/${entityId}`;

  const handleChange = async (_: React.MouseEvent<HTMLElement>, newValue: string | null) => {
    setSaving(true);
    setError(null);
    try {
      await api.put(`${basePath}/match-contact-status`, { matchContactStatus: newValue });
      setStatus(newValue);
    } catch (e: any) {
      setError(e?.response?.data?.error?.message || e?.response?.data?.error || '保存に失敗しました');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Box>
      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
        マッチング通知への対応状況を記録します（「連絡済み」「連絡不要」を選ぶとサイドバーの通知から消えます）。
      </Typography>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <ToggleButtonGroup
          value={status}
          exclusive
          size="small"
          onChange={handleChange}
          disabled={saving}
        >
          {OPTIONS.map((opt) => (
            <ToggleButton key={opt} value={opt}>
              {opt}
            </ToggleButton>
          ))}
        </ToggleButtonGroup>
        {saving && <CircularProgress size={16} />}
      </Box>
      {error && <Alert severity="error" sx={{ mt: 1 }}>{error}</Alert>}
    </Box>
  );
};

export default MatchContactStatusPanel;
