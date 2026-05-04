import React from 'react';
import { ScrapedUrlChecker } from '@/components/ScrapedUrlChecker';

/**
 * スクレイピングURL重複チェックページ
 */
export const ScrapedUrlCheckerPage: React.FC = () => {
  const handleCheckComplete = (result: any) => {
    console.log('重複チェック結果:', result);
  };

  return (
    <div className="container mx-auto py-8 px-4">
      <h1 className="text-3xl font-bold mb-6">スクレイピングURL重複チェック</h1>
      <p className="text-gray-600 mb-8">
        スクレイピングしたURLが既に登録されているか確認できます。
        重複している場合は、参照元URLとスクレイピング後のURLも表示されます。
      </p>
      <ScrapedUrlChecker onCheckComplete={handleCheckComplete} />
    </div>
  );
};

export default ScrapedUrlCheckerPage;
