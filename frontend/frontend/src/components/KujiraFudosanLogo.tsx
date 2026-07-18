import React from 'react';
import './PublicPropertyLogo.css'; // 既存のCSSを流用

const KujiraFudosanLogo: React.FC = () => {
  const handleClick = () => {
    // くじら不動産のURLに変更する場合はここを更新
    window.open('https://ifoo-oita.com/', '_blank', 'noopener,noreferrer');
  };

  return (
    <div
      className="public-property-logo"
      onClick={handleClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          handleClick();
        }
      }}
      aria-label="株式会社くじら不動産のウェブサイトを開く"
    >
      <img
        src="/kujira-fudosan-logo.png"
        alt="㈱いふう（株式会社くじら不動産）"
        className="logo-image kujira-logo-image"
      />
    </div>
  );
};

export default KujiraFudosanLogo;
