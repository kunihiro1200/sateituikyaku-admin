import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import TateuriPage from './TateuriPage';
import FukuokaTateuriPage from './FukuokaTateuriPage';

/**
 * ドメインに応じて適切な建売専門サイトを表示
 * - oita-tateuri.com → 大分の物件一覧
 * - fukuoka-tateuri.com → 福岡の物件一覧
 * - localhost または sateituikyaku-admin-frontend.vercel.app → 大分の物件一覧（デフォルト）
 */
function TateuriRootPage() {
  const hostname = window.location.hostname;

  // ドメインに応じて適切なページを表示
  if (hostname.includes('fukuoka-tateuri.com')) {
    return <FukuokaTateuriPage />;
  }

  // デフォルトは大分（oita-tateuri.com、localhost、または sateituikyaku-admin-frontend.vercel.app）
  return <TateuriPage />;
}

export default TateuriRootPage;
