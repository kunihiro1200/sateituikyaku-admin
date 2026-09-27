import { useEffect, useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Typography,
  List,
  ListItem,
  ListItemText,
  Chip,
} from '@mui/material';
import { Campaign as CampaignIcon } from '@mui/icons-material';
import { useAuthStore } from '../store/authStore';
import api from '../services/api';

/** アナウンス対象のメールアドレス（小文字で比較） */
const TARGET_EMAILS = [
  'yurine.kimura@ifoo-oita.com',
  'jyuna.wada@ifoo-oita.com',
  'mariko.kume@ifoo-oita.com',
];

interface PublicationProperty {
  property_number: string;
  property_address: string | null;
  seller_name: string | null;
  property_type: string | null;
  sales_assignee: string | null;
}

const TYPE_LABEL: Record<string, string> = {
  'マ': 'マンション',
  '戸': '戸建て',
  '土': '土地',
  '他': 'その他',
};

function formatType(t: string | null): string {
  if (!t) return '';
  const s = String(t).trim();
  return TYPE_LABEL[s] || s;
}

/**
 * アプリ起動時に、対象3名へ「本日サイト公開物件あり」を知らせるアナウンスダイアログ。
 * - ログイン中ユーザーのメールが対象3名のいずれか
 * - 本日（JST）公開予定の物件がある
 * - その日にまだ表示していない（localStorageで当日1回のみ）
 * 上記をすべて満たすときにダイアログを表示する。物件0件のときは何も出さない。
 */
export default function TodayPublicationAnnouncement() {
  const employee = useAuthStore((s) => s.employee);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState('');
  const [properties, setProperties] = useState<PublicationProperty[]>([]);

  useEffect(() => {
    const email = (employee?.email || '').trim().toLowerCase();
    if (!isAuthenticated || !email) return;
    if (!TARGET_EMAILS.includes(email)) return;

    let cancelled = false;

    (async () => {
      try {
        const res = await api.get('/api/work-tasks/today-publications');
        if (cancelled) return;
        const data = res.data || {};
        const props: PublicationProperty[] = data.properties || [];
        const today: string = data.date || '';
        if (props.length === 0) return;

        // 当日・このユーザーに対して既に表示済みなら出さない
        const seenKey = `todayPubAnnounce:${today}:${email}`;
        if (localStorage.getItem(seenKey) === '1') return;

        setDate(today);
        setProperties(props);
        setOpen(true);
      } catch {
        // 取得失敗時はアナウンスを出さない（起動を妨げない）
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, employee?.email]);

  const handleClose = () => {
    const email = (employee?.email || '').trim().toLowerCase();
    if (date && email) {
      localStorage.setItem(`todayPubAnnounce:${date}:${email}`, '1');
    }
    setOpen(false);
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1, bgcolor: '#e3f2fd', color: '#1565c0' }}>
        <CampaignIcon />
        本日サイト公開物件あり
      </DialogTitle>
      <DialogContent dividers>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
          本日（{date}）公開予定の物件が {properties.length} 件あります。
        </Typography>
        <List dense>
          {properties.map((p) => {
            const typeLabel = formatType(p.property_type);
            const details = [
              p.seller_name ? `売主：${String(p.seller_name).trim()}` : '',
              p.sales_assignee ? `営業担当：${String(p.sales_assignee).trim()}` : '',
            ]
              .filter(Boolean)
              .join(' / ');
            return (
              <ListItem key={p.property_number} divider alignItems="flex-start">
                <ListItemText
                  primary={
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                      <Typography variant="body2" fontWeight="bold">
                        {p.property_number}
                      </Typography>
                      {typeLabel && <Chip size="small" label={typeLabel} />}
                    </Box>
                  }
                  secondary={
                    <>
                      <Typography variant="body2" component="span" sx={{ display: 'block' }}>
                        {p.property_address || '（住所未登録）'}
                      </Typography>
                      {details && (
                        <Typography variant="caption" component="span" color="text.secondary">
                          {details}
                        </Typography>
                      )}
                    </>
                  }
                />
              </ListItem>
            );
          })}
        </List>
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose} variant="contained">
          確認しました
        </Button>
      </DialogActions>
    </Dialog>
  );
}
