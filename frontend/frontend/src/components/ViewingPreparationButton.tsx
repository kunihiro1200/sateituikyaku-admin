import React, { useState } from 'react';
import { Button } from '@mui/material';
import { ViewingPreparationPopup } from './ViewingPreparationPopup';

export interface ViewingPreparationButtonProps {
  buyerNumber: string | null | undefined;
  propertyNumber: string | null | undefined;
  houseMaker?: string | null | undefined;
  googleMapUrl?: string | null | undefined;
  address?: string | null | undefined;
  buyer?: Record<string, any> | null;
  linkedProperties?: Array<Record<string, any>>;
}

/**
 * 内覧準備ボタンコンポーネント
 * クリック時に内覧準備ポップアップを開く
 */
export const ViewingPreparationButton: React.FC<ViewingPreparationButtonProps> = ({
  buyerNumber,
  propertyNumber,
  houseMaker,
  googleMapUrl,
  address,
  buyer,
  linkedProperties,
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
        内覧準備
      </Button>
      <ViewingPreparationPopup
        open={open}
        onClose={handleClose}
        buyerNumber={buyerNumber}
        propertyNumber={propertyNumber}
        houseMaker={houseMaker}
        googleMapUrl={googleMapUrl}
        address={address}
        buyer={buyer}
        linkedProperties={linkedProperties}
      />
    </>
  );
};

export default ViewingPreparationButton;
