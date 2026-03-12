import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../services/api';

interface RelatedBuyer {
  id: string;
  buyer_number: string;
  name: string | null;
  phone_number: string | null;
  email: string | null;
  property_number: string | null;
  reception_date: string | null;
  relation_type: 'multiple_inquiry' | 'possible_duplicate';
  match_reason: 'phone' | 'email' | 'both';
}

interface RelatedBuyersSectionProps {
  buyerId: string;
}

const RelatedBuyersSection: React.FC<RelatedBuyersSectionProps> = ({ buyerId }) => {
  const [relatedBuyers, setRelatedBuyers] = useState<RelatedBuyer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [errorCode, setErrorCode] = useState<string | null>(null);

  const fetchRelatedBuyers = async () => {
    try {
      setLoading(true);
      setError(null);
      setErrorCode(null);
      
      const response = await api.get(`/api/buyers/${buyerId}/related`);
      setRelatedBuyers(response.data.related_buyers || []);
    } catch (err: any) {
      console.error('Failed to fetch related buyers', err);
      
      // Set empty array to prevent UI breaking
      setRelatedBuyers([]);
      
      // Handle specific error codes
      if (err.response) {
        const status = err.response.status;
        const errorData = err.response.data;
        
        setErrorCode(errorData?.code || `HTTP_${status}`);
        
        if (status === 400) {
          setError('無効な買主IDです。正しいIDを指定してください。');
        } else if (status === 404) {
          setError('買主が見つかりませんでした。');
        } else if (status === 500) {
          setError('サーバーエラーが発生しました。しばらく待ってから再試行してください。');
        } else {
          setError('関連買主の取得に失敗しました。');
        }
      } else if (err.request) {
        setError('ネットワークエラーが発生しました。接続を確認してください。');
        setErrorCode('NETWORK_ERROR');
      } else {
        setError('予期しないエラーが発生しました。');
        setErrorCode('UNKNOWN_ERROR');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRelatedBuyers();
  }, [buyerId]);

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-semibold mb-4">関連買主</h2>
        <div className="flex justify-center items-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-semibold mb-4">関連買主</h2>
        <div className="bg-red-50 border border-red-200 rounded p-4">
          <div className="flex items-start">
            <span className="text-red-600 mr-2">⚠️</span>
            <div className="flex-1">
              <p className="text-red-700 font-medium">{error}</p>
              {errorCode && (
                <p className="text-red-600 text-sm mt-1">エラーコード: {errorCode}</p>
              )}
              <button
                onClick={fetchRelatedBuyers}
                className="mt-3 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition-colors text-sm"
              >
                再試行
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (relatedBuyers.length === 0) {
    return null; // 関連買主がいない場合は表示しない
  }

  const getRelationTypeLabel = (relationType: string) => {
    return relationType === 'multiple_inquiry' ? '複数問合せ' : '重複の可能性';
  };

  const getRelationTypeColor = (relationType: string) => {
    return relationType === 'multiple_inquiry' 
      ? 'bg-blue-100 text-blue-800' 
      : 'bg-yellow-100 text-yellow-800';
  };

  const getMatchReasonText = (matchReason: string) => {
    switch (matchReason) {
      case 'both':
        return '電話番号・メールアドレスが一致';
      case 'phone':
        return '電話番号が一致';
      case 'email':
        return 'メールアドレスが一致';
      default:
        return '';
    }
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return date.toLocaleDateString('ja-JP', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    });
  };

  return (
    <div className="bg-white rounded-lg shadow p-6" id="related-buyers-section">
      <h2 className="text-xl font-semibold mb-4">
        関連買主 ({relatedBuyers.length})
      </h2>
      
      <div className="space-y-4">
        {relatedBuyers.map((buyer) => (
          <div
            key={buyer.buyer_id || buyer.buyer_number || buyer.id}
            className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 transition-colors"
          >
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  {buyer.relation_type === 'possible_duplicate' && (
                    <span className="text-yellow-600">⚠️</span>
                  )}
                  {buyer.relation_type === 'multiple_inquiry' && (
                    <span className="text-blue-600">📋</span>
                  )}
                  {buyer.buyer_number ? (
                    <Link
                      to={`/buyers/${buyer.buyer_number}`}
                      className="text-blue-600 hover:text-blue-800 font-medium"
                    >
                      買主{buyer.buyer_number}
                    </Link>
                  ) : (
                    <span className="text-gray-600 font-medium">
                      買主{buyer.buyer_number || '（番号なし）'}
                    </span>
                  )}
                  <span className="text-gray-600">
                    {buyer.name || '（氏名なし）'}
                  </span>
                </div>

                <div className="text-sm text-gray-600 space-y-1">
                  <div>
                    物件: {buyer.property_number || '-'} 
                    {buyer.reception_date && (
                      <span className="ml-2">
                        ({formatDate(buyer.reception_date)})
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <span
                      className={`inline-block px-2 py-1 rounded text-xs font-medium ${getRelationTypeColor(
                        buyer.relation_type
                      )}`}
                    >
                      {getRelationTypeLabel(buyer.relation_type)}
                    </span>
                    <span className="text-gray-500">
                      {getMatchReasonText(buyer.match_reason)}
                    </span>
                  </div>
                </div>

                {buyer.relation_type === 'possible_duplicate' && (
                  <div className="mt-2 text-sm text-yellow-700 bg-yellow-50 border border-yellow-200 rounded p-2">
                    ※同じ物件への問合せです。スプレッドシートを確認してください
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-4 text-sm text-gray-600 bg-gray-50 rounded p-3">
        <p className="font-medium mb-1">💡 関連買主について</p>
        <ul className="list-disc list-inside space-y-1 text-xs">
          <li>
            <strong>複数問合せ</strong>: 同一人物が異なる物件に問合せしているケース（正常）
          </li>
          <li>
            <strong>重複の可能性</strong>: 同じ物件への重複した問合せ（データ入力ミスの可能性）
          </li>
          <li>
            重複の場合は、手動でスプレッドシートから該当行を削除してください
          </li>
        </ul>
      </div>
    </div>
  );
};

export default RelatedBuyersSection;
