import React, { useState } from 'react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertCircle, CheckCircle, Loader2 } from 'lucide-react';

interface DuplicateCheckResult {
  isDuplicate: boolean;
  existingRecord?: {
    id: string;
    url: string;
    referenceUrl?: string; // 参照元URL
    scrapedResultUrl?: string; // スクレイピング後のURL
    propertyNumber?: string;
    sourceSite: string;
    scrapedAt: string;
    postedToDb: boolean;
    postedAt?: string;
  };
  message: string;
}

interface ScrapedUrlCheckerProps {
  onCheckComplete?: (result: DuplicateCheckResult) => void;
}

export const ScrapedUrlChecker: React.FC<ScrapedUrlCheckerProps> = ({
  onCheckComplete,
}) => {
  const [url, setUrl] = useState('');
  const [propertyNumber, setPropertyNumber] = useState('');
  const [checkResult, setCheckResult] = useState<DuplicateCheckResult | null>(
    null
  );
  const [isChecking, setIsChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCheckByUrl = async () => {
    if (!url.trim()) {
      setError('URLを入力してください');
      return;
    }

    setIsChecking(true);
    setError(null);
    setCheckResult(null);

    try {
      const response = await fetch(
        `${import.meta.env.VITE_API_URL}/api/scraped-urls/check-duplicate`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ url: url.trim() }),
        }
      );

      const result = await response.json();

      if (result.success) {
        setCheckResult(result.data);
        onCheckComplete?.(result.data);
      } else {
        setError(result.error || '重複チェックに失敗しました');
      }
    } catch (err) {
      console.error('Error checking duplicate:', err);
      setError('重複チェック中にエラーが発生しました');
    } finally {
      setIsChecking(false);
    }
  };

  const handleCheckByPropertyNumber = async () => {
    if (!propertyNumber.trim()) {
      setError('物件番号を入力してください');
      return;
    }

    setIsChecking(true);
    setError(null);
    setCheckResult(null);

    try {
      const response = await fetch(
        `${import.meta.env.VITE_API_URL}/api/scraped-urls/check-duplicate-by-property-number`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            propertyNumber: propertyNumber.trim(),
            sourceSite: 'athome',
          }),
        }
      );

      const result = await response.json();

      if (result.success) {
        setCheckResult(result.data);
        onCheckComplete?.(result.data);
      } else {
        setError(result.error || '重複チェックに失敗しました');
      }
    } catch (err) {
      console.error('Error checking duplicate:', err);
      setError('重複チェック中にエラーが発生しました');
    } finally {
      setIsChecking(false);
    }
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>スクレイピングURL重複チェック</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* URLでチェック */}
        <div className="space-y-2">
          <label className="text-sm font-medium">URLで重複チェック</label>
          <div className="flex gap-2">
            <Input
              type="text"
              placeholder="https://www.athome.co.jp/..."
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              onKeyPress={(e) => {
                if (e.key === 'Enter') {
                  handleCheckByUrl();
                }
              }}
            />
            <Button
              onClick={handleCheckByUrl}
              disabled={isChecking || !url.trim()}
            >
              {isChecking ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  チェック中...
                </>
              ) : (
                'チェック'
              )}
            </Button>
          </div>
        </div>

        {/* 物件番号でチェック */}
        <div className="space-y-2">
          <label className="text-sm font-medium">
            物件番号で重複チェック（athome）
          </label>
          <div className="flex gap-2">
            <Input
              type="text"
              placeholder="6990582043"
              value={propertyNumber}
              onChange={(e) => setPropertyNumber(e.target.value)}
              onKeyPress={(e) => {
                if (e.key === 'Enter') {
                  handleCheckByPropertyNumber();
                }
              }}
            />
            <Button
              onClick={handleCheckByPropertyNumber}
              disabled={isChecking || !propertyNumber.trim()}
            >
              {isChecking ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  チェック中...
                </>
              ) : (
                'チェック'
              )}
            </Button>
          </div>
        </div>

        {/* エラー表示 */}
        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>エラー</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* チェック結果表示 */}
        {checkResult && (
          <Alert
            variant={checkResult.isDuplicate ? 'destructive' : 'default'}
            className={
              checkResult.isDuplicate
                ? 'border-orange-500 bg-orange-50'
                : 'border-green-500 bg-green-50'
            }
          >
            {checkResult.isDuplicate ? (
              <AlertCircle className="h-4 w-4 text-orange-600" />
            ) : (
              <CheckCircle className="h-4 w-4 text-green-600" />
            )}
            <AlertTitle>
              {checkResult.isDuplicate ? '⚠️ 重複の可能性' : '✅ 新規物件'}
            </AlertTitle>
            <AlertDescription className="whitespace-pre-line">
              {checkResult.message}
              {checkResult.existingRecord && (
                <div className="mt-2 text-sm space-y-1">
                  <div>
                    <strong>元のURL:</strong>{' '}
                    <a
                      href={checkResult.existingRecord.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:underline"
                    >
                      {checkResult.existingRecord.url}
                    </a>
                  </div>
                  {checkResult.existingRecord.referenceUrl && (
                    <div>
                      <strong>参照元URL:</strong>{' '}
                      <a
                        href={checkResult.existingRecord.referenceUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:underline"
                      >
                        {checkResult.existingRecord.referenceUrl}
                      </a>
                    </div>
                  )}
                  {checkResult.existingRecord.scrapedResultUrl && (
                    <div>
                      <strong>スクレイピング後のURL:</strong>{' '}
                      <a
                        href={checkResult.existingRecord.scrapedResultUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:underline"
                      >
                        {checkResult.existingRecord.scrapedResultUrl}
                      </a>
                    </div>
                  )}
                  {checkResult.existingRecord.propertyNumber && (
                    <div>
                      <strong>物件番号:</strong>{' '}
                      {checkResult.existingRecord.propertyNumber}
                    </div>
                  )}
                  <div>
                    <strong>スクレイピング元:</strong>{' '}
                    {checkResult.existingRecord.sourceSite}
                  </div>
                  <div>
                    <strong>掲載状態:</strong>{' '}
                    {checkResult.existingRecord.postedToDb
                      ? '掲載済み'
                      : '未掲載'}
                  </div>
                </div>
              )}
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
};
