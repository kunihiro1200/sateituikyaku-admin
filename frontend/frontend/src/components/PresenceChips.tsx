import { Box } from '@mui/material';
import { GenericPresenceRecord, GenericPresenceState } from '../store/createPresenceStore';

const STALE_THRESHOLD_MS = 30 * 60 * 1000; // 30分

interface PresenceChipsProps {
  presenceState: GenericPresenceState;
  itemKey: string | null | undefined;
  /** アクティブなユーザーがいない場合の表示（デフォルト: null=何も表示しない） */
  emptyPlaceholder?: React.ReactNode;
  /** アバターサイズ（px） */
  size?: number;
}

/**
 * 「誰が今この項目を開いているか」を示すアバターチップ群。
 * 売主リスト・買主リストと同じ見た目（頭文字を赤丸で表示）。
 */
export default function PresenceChips({
  presenceState,
  itemKey,
  emptyPlaceholder = null,
  size = 24,
}: PresenceChipsProps) {
  if (!itemKey) return <>{emptyPlaceholder}</>;

  const active: GenericPresenceRecord[] = (presenceState[itemKey] || []).filter(
    (r) => Date.now() - new Date(r.entered_at).getTime() < STALE_THRESHOLD_MS
  );

  if (active.length === 0) return <>{emptyPlaceholder}</>;

  return (
    <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
      {active.map((r, i) => {
        const initial = r.user_name ? r.user_name.charAt(0) : '?';
        return (
          <Box
            key={i}
            sx={{
              width: size,
              height: size,
              borderRadius: '50%',
              bgcolor: 'error.main',
              color: 'white',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '0.65rem',
              fontWeight: 'bold',
              flexShrink: 0,
            }}
            title={`${r.user_name}が作業中`}
          >
            {initial}
          </Box>
        );
      })}
    </Box>
  );
}
