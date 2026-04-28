import React, { useState } from 'react';
import { Button } from '@mui/material';
import { VisitPreparationPopup } from './VisitPreparationPopup';

export interface VisitPreparationButtonProps {
  sellerId: string | undefined;
  inquiryUrl: string | null | undefined;
  sellerNumber: string | undefined;
  propertyAddress: string | undefined;
  commentHtml?: string;
}

/**
 * 訪問準備ボタンコンポーネント
 * クリック時に訪問準備ポップアップを開く
 */
export const VisitPreparationButton: React.FC<VisitPreparationButtonProps> = ({
  sellerId,
  inquiryUrl,
  sellerNumber,
  propertyAddress,
  commentHtml,
}) => {
  const [open, setOpen] = useState(false);

  const handleOpen = () => {
    setOpen(true);
  };

  const handleClose = () => {
    setOpen(false);
  };

  return (
    <>
      <Button variant="outlined" size="small" onClick={handleOpen}>
        訪問準備
      </Button>
      <VisitPreparationPopup
        open={open}
        onClose={handleClose}
        sellerId={sellerId}
        inquiryUrl={inquiryUrl}
        sellerNumber={sellerNumber}
        propertyAddress={propertyAddress}
        commentHtml={commentHtml}
      />
    </>
  );
};

export default VisitPreparationButton;
