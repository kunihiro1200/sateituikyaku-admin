import { Dialog, DialogTitle, DialogContent, IconButton } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import SellerPortalAdminSection from './SellerPortalAdminSection';

/**
 * 通話モードページの「資料生成」メニューから開く、売却サポートページの管理モーダル。
 * 内容は SellerPortalAdminSection（URL発行・アクセス状況・入力内容・チャット）そのまま。
 */
export default function SellerPortalAdminModal({
  open,
  onClose,
  sellerId,
  sellerNumber,
}: {
  open: boolean;
  onClose: () => void;
  sellerId: string;
  sellerNumber: string;
}) {
  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="md">
      <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        売却サポートページ
        <IconButton onClick={onClose} size="small">
          <CloseIcon />
        </IconButton>
      </DialogTitle>
      <DialogContent>
        <SellerPortalAdminSection sellerId={sellerId} sellerNumber={sellerNumber} />
      </DialogContent>
    </Dialog>
  );
}
