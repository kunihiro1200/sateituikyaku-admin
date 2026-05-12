import React, { useState } from 'react';
import { Button } from '@mui/material';
import PrintIcon from '@mui/icons-material/Print';
import { generateSellerBrochureHtml } from '../utils/sellerBrochureGenerator';

/**
 * 売主向けパンフレット印刷ボタン
 * 
 * 「株式会社くじら不動産」の不動産売却案内パンフレットを印刷します。
 */
export function SellerBrochurePrintButton() {
  const [printing, setPrinting] = useState(false);

  const handlePrint = () => {
    setPrinting(true);

    try {
      // HTMLを生成
      const html = generateSellerBrochureHtml();

      // 新しいウィンドウを開いてHTMLを書き込む
      const printWindow = window.open('', '_blank');
      if (!printWindow) {
        alert('ポップアップがブロックされました。ポップアップを許可してください。');
        setPrinting(false);
        return;
      }

      printWindow.document.write(html);
      printWindow.document.close();

      // 画像などのリソースが読み込まれるまで待機
      printWindow.onload = () => {
        setTimeout(() => {
          printWindow.print();
          setPrinting(false);
        }, 500);
      };

      // 念のため、onloadが発火しない場合のフォールバック
      setTimeout(() => {
        if (printing) {
          printWindow.print();
          setPrinting(false);
        }
      }, 2000);
    } catch (error) {
      console.error('印刷エラー:', error);
      alert('印刷に失敗しました。');
      setPrinting(false);
    }
  };

  return (
    <Button
      variant="outlined"
      startIcon={<PrintIcon />}
      onClick={handlePrint}
      disabled={printing}
      sx={{
        borderColor: '#f5c518',
        color: '#f5c518',
        '&:hover': {
          borderColor: '#d4a817',
          backgroundColor: 'rgba(245, 197, 24, 0.04)',
        },
      }}
    >
      {printing ? '印刷中...' : 'パンフレット印刷'}
    </Button>
  );
}
