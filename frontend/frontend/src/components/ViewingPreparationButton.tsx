import React, { useState } from 'react';
import { Button } from '@mui/material';
import { ViewingPreparationPopup } from './ViewingPreparationPopup';
import type { BuyerDuplicateMatch } from './BuyerDuplicateCard';

export interface ViewingPreparationButtonProps {
  buyerNumber: string | null | undefined;
  propertyNumber: string | null | undefined;
  houseMaker?: string | null | undefined;
  googleMapUrl?: string | null | undefined;
  address?: string | null | undefined;
  buyer?: Record<string, any> | null;
  linkedProperties?: Array<Record<string, any>>;
  otherCompanyProperty?: string | null | undefined;
  /** 買主重複（同一人物の他レコード）。それぞれの内覧日で「何回目」を算出する */
  buyerDuplicates?: BuyerDuplicateMatch[];
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
  otherCompanyProperty,
  buyerDuplicates,
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
        otherCompanyProperty={otherCompanyProperty}
        buyerDuplicates={buyerDuplicates}
      />
    </>
  );
};

export default ViewingPreparationButton;
