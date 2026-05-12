import React, { useState } from 'react';
import { Button, CircularProgress } from '@mui/material';
import PrintIcon from '@mui/icons-material/Print';
import { generateSellerBrochureHtml } from '../utils/sellerBrochureGenerator';

/**
 * 売主向けパンフレット印刷ボタン
 * 内覧準備資料２と同じiframe方式で印刷します
 */
export function SellerBrochurePrintButton() {
  const [printing, setPrinting] = useState(false);

  const handlePrint = () => {
    setPrinting(true);

    const html = generateSellerBrochureHtml();

    // iframe方式（内覧準備資料２と同じ方式）
    const iframe = document.createElement('iframe');
    iframe.style.cssText = 'position:fixed;top:-9999px;left:-9999px;width:1px;height:1px;border:none;';
    document.body.appendChild(iframe);

    const doc = iframe.contentDocument || iframe.contentWindow?.document;
    if (!doc) {
      setPrinting(false);
      document.body.removeChild(iframe);
      return;
    }

    doc.open();
    doc.write(html);
    doc.close();

    const cleanup = () => {
      setTimeout(() => {
        try { document.body.removeChild(iframe); } catch (_) { /* ignore */ }
        setPrinting(false);
      }, 1000);
    };

    const doPrint = () => {
      try {
        iframe.contentWindow?.focus();
        iframe.contentWindow?.print();
      } catch (_) { /* ignore */ }
      cleanup();
    };

    if (iframe.contentDocument?.readyState === 'complete') {
      setTimeout(doPrint, 1200);
    } else {
      iframe.onload = () => setTimeout(doPrint, 1200);
      setTimeout(doPrint, 5000); // フォールバック（画像読み込み待ち）
    }
  };

  return (
    <Button
      variant="outlined"
      startIcon={printing ? <CircularProgress size={14} color="inherit" /> : <PrintIcon />}
      onClick={handlePrint}
      disabled={printing}
      sx={{
        borderColor: '#f5c518',
        color: '#b8860b',
        '&:hover': {
          borderColor: '#b8860b',
          backgroundColor: '#fffde7',
        },
      }}
    >
      {printing ? '印刷中...' : 'パンフレット印刷'}
    </Button>
  );
}
