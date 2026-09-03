import { BACKEND_URL } from '../services/sellerPortalApi';

/**
 * 売却サポートページ（/portal/:token）専用のPWAセットアップ。
 * 既存システム全体をPWA化する必要はないため、SellerPortalPage内からのみ呼び出す。
 *
 * - manifest: バックエンドが売主ごとに異なる start_url を含む動的manifestを返すため、
 *   <link rel="manifest"> をJSで注入する（静的ファイルでは売主別のstart_urlを持たせられない）
 * - service worker: standalone表示の要件を満たすための最小限のSWを登録する
 */
export function setupPortalPwa(token: string) {
  // 既存のmanifestリンクがあれば入れ替える（他ページに影響しないよう、離脱時に元に戻す想定はせず、
  // このページ限定のセッション内でのみ有効な注入とする）
  let link = document.querySelector<HTMLLinkElement>('link[rel="manifest"][data-seller-portal]');
  if (!link) {
    link = document.createElement('link');
    link.rel = 'manifest';
    link.setAttribute('data-seller-portal', 'true');
    document.head.appendChild(link);
  }
  link.href = `${BACKEND_URL}/api/seller-portal/portal/manifest.json?token=${encodeURIComponent(token)}`;

  // iOS Safari向け：ホーム画面追加時のアプリらしい表示のための設定
  setMetaTag('apple-mobile-web-app-capable', 'yes');
  setMetaTag('apple-mobile-web-app-status-bar-style', 'black-translucent');
  setMetaTag('apple-mobile-web-app-title', '売却サポート');
  setLinkTag('apple-touch-icon', '/ifoo-assets/logo.png');
  setMetaTag('theme-color', '#0B2545');

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw-seller-portal.js', { scope: `/portal/${token}` }).catch(() => {
      // SW登録に失敗しても通常のWebページとして動作を継続する
    });
  }
}

function setMetaTag(name: string, content: string) {
  let tag = document.querySelector<HTMLMetaElement>(`meta[name="${name}"]`);
  if (!tag) {
    tag = document.createElement('meta');
    tag.name = name;
    document.head.appendChild(tag);
  }
  tag.content = content;
}

function setLinkTag(rel: string, href: string) {
  let tag = document.querySelector<HTMLLinkElement>(`link[rel="${rel}"]`);
  if (!tag) {
    tag = document.createElement('link');
    tag.rel = rel;
    document.head.appendChild(tag);
  }
  tag.href = href;
}
