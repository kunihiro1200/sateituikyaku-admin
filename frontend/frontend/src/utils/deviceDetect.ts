/** 売却サポートページのPWA保存導線用、端末・ブラウザ判定ユーティリティ */

export function isIOS(): boolean {
  const ua = window.navigator.userAgent;
  return /iPhone|iPad|iPod/.test(ua) || (ua.includes('Macintosh') && 'ontouchend' in document);
}

export function isAndroid(): boolean {
  return /Android/.test(window.navigator.userAgent);
}

export function isSafari(): boolean {
  const ua = window.navigator.userAgent;
  return /^((?!chrome|android|crios|fxios).)*safari/i.test(ua);
}

export function isStandalone(): boolean {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (window.navigator as any).standalone === true
  );
}
