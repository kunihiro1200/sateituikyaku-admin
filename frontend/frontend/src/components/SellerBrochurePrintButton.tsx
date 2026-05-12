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

  const handlePrint = async () => {
    setPrinting(true);

    try {
      // 画像を読み込んでbase64に変換
      const imagePath = '/ifoo-assets/brochure/page1-bg.png';
      const response = await fetch(imagePath);
      const blob = await response.blob();
      
      // BlobをBase64に変換
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64data = reader.result as string;
        
        // HTMLを生成（base64画像を使用）
        const html = generateSellerBrochureHtml(base64data);

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
      };
      
      reader.readAsDataURL(blob);
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
