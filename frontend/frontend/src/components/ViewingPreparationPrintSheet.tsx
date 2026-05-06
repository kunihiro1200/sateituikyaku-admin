import React from 'react';
import { Box, Typography, Divider, Grid } from '@mui/material';

// ============================================================
// 型定義
// ============================================================

interface PropertyDetails {
  property_number?: string;
  atbb_status?: string;
  distribution_date?: string;
  address?: string;
  display_address?: string;
  property_type?: string;
  sales_assignee?: string;
  price?: number;
  listing_price?: number;
  monthly_loan_payment?: number;
  offer_status?: string;
  price_reduction_history?: string;
  sale_reason?: string;
  pre_viewing_notes?: string;
  broker_response?: string;
  viewing_key?: string;
  viewing_parking?: string;
  viewing_notes?: string;
  viewing_available_date?: string;
  seller_name?: string;
  seller_contact?: string;
  seller_email?: string;
  confirmation_status?: string;
  structure?: string;
  floor_plan?: string;
  land_area?: number;
  building_area?: number;
  suumo_url?: string;
  google_map_url?: string;
  storage_location?: string;
  image_url?: string;
  pdf_url?: string;
}

interface BuyerDetails {
  buyer_number?: string;
  name?: string;
  phone_number?: string;
  email?: string;
  company_name?: string;
  broker_inquiry?: string;
  vendor_survey?: string;
  viewing_survey_result?: string;
  viewing_survey_confirmed?: string;
  inquiry_hearing?: string;
  initial_assignee?: string;
  reception_date?: string;
  inquiry_source?: string;
  latest_status?: string;
  project_assignee?: string;
  neighbor_property_email_sent?: string;
  distribution_type?: string;
  pinrich?: string;
  inquiry_email_phone?: string;
  inquiry_email_reply?: string;
  three_calls_confirmed?: string;
  next_call_date?: string;
  owned_home_hearing_inquiry?: string;
  owned_home_hearing_result?: string;
  valuation_required?: string;
  message_to_assignee?: string;
  [key: string]: any;
}

interface ViewingPreparationPrintSheetProps {
  buyer: BuyerDetails;
  property: PropertyDetails;
  printDate?: string;
}

// ============================================================
// ヘルパー関数
// ============================================================

function formatPrice(price?: number | null): string {
  if (!price) return '';
  if (price >= 10000) {
    const oku = Math.floor(price / 10000);
    const man = price % 10000;
    if (man === 0) return `${oku}億円`;
    return `${oku}億${man.toLocaleString()}万円`;
  }
  return `${price.toLocaleString()}万円`;
}

function formatDate(dateStr?: string | null): string {
  if (!dateStr) return '';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}`;
  } catch {
    return dateStr;
  }
}

// HTMLタグを除去してプレーンテキストに変換
function stripHtml(html?: string | null): string {
  if (!html) return '';
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .trim();
}

// ============================================================
// サブコンポーネント: フィールド行（白黒）
// ============================================================

function FieldRow({ label, value }: { label: string; value?: string | null }) {
  if (!value || !String(value).trim()) return null;
  return (
    <Box sx={{ display: 'flex', gap: 0.5, mb: 0.3, alignItems: 'flex-start' }}>
      <Typography sx={{ fontSize: '7pt', color: '#444', minWidth: '68px', flexShrink: 0, lineHeight: 1.3 }}>
        {label}
      </Typography>
      <Typography sx={{ fontSize: '7.5pt', color: '#000', lineHeight: 1.3, wordBreak: 'break-all', flex: 1, whiteSpace: 'pre-wrap' }}>
        {value}
      </Typography>
    </Box>
  );
}

// ============================================================
// メインコンポーネント（白黒）
// ============================================================

const ViewingPreparationPrintSheet = React.forwardRef<HTMLDivElement, ViewingPreparationPrintSheetProps>(
  ({ buyer, property, printDate }, ref) => {
    const today = printDate || formatDate(new Date().toISOString());

    return (
      <Box
        ref={ref}
        sx={{
          width: '210mm',
          minHeight: '297mm',
          p: '8mm 10mm',
          bgcolor: '#fff',
          fontFamily: '"Noto Sans JP", "Hiragino Kaku Gothic ProN", "Meiryo", sans-serif',
          fontSize: '8pt',
          color: '#000',
          boxSizing: 'border-box',
        }}
      >
        {/* ヘッダー（白黒） */}
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1, pb: 0.5, borderBottom: '2px solid #000' }}>
          <Typography sx={{ fontSize: '11pt', fontWeight: 'bold', color: '#000' }}>
            内覧準備資料
          </Typography>
          <Box sx={{ textAlign: 'right' }}>
            <Typography sx={{ fontSize: '7.5pt', color: '#444' }}>
              作成日: {today}
            </Typography>
            {buyer.buyer_number && (
              <Typography sx={{ fontSize: '7.5pt', color: '#444' }}>
                買主番号: {buyer.buyer_number}
              </Typography>
            )}
          </Box>
        </Box>

        {/* 2カラムレイアウト */}
        <Grid container spacing={1} sx={{ flex: 1, overflow: 'hidden' }}>
          {/* 左カラム: 物件詳細カード */}
          <Grid item xs={6}>
            <Box sx={{ pr: 1, borderRight: '1px solid #ccc' }}>
              <Typography sx={{ fontSize: '9pt', fontWeight: 'bold', color: '#000', mb: 0.5, pb: 0.3, borderBottom: '2px solid #000' }}>
                物件詳細カード
              </Typography>

              {/* 物件基本情報 */}
              <Box sx={{ mb: 1 }}>
                <FieldRow label="物件番号" value={property.property_number} />
                <FieldRow label="ステータス" value={property.atbb_status} />
                <FieldRow label="配信日" value={formatDate(property.distribution_date)} />
                <FieldRow label="種別" value={property.property_type} />
                <FieldRow label="担当名" value={property.sales_assignee} />
                <FieldRow label="確済" value={property.confirmation_status} />
                <FieldRow label="構造" value={property.structure} />
                <FieldRow label="間取り" value={property.floor_plan} />
                {property.land_area && <FieldRow label="土地面積" value={`${property.land_area}㎡`} />}
                {property.building_area && <FieldRow label="建物面積" value={`${property.building_area}㎡`} />}
              </Box>

              <Divider sx={{ my: 0.5, borderColor: '#ccc' }} />

              {/* 所在地 */}
              <Box sx={{ mb: 1 }}>
                <FieldRow label="所在地" value={property.address} />
                <FieldRow label="住居表示" value={property.display_address} />
                {property.google_map_url && (
                  <FieldRow label="Google Map" value={property.google_map_url} />
                )}
                {property.suumo_url && (
                  <FieldRow label="Suumo" value={property.suumo_url} />
                )}
              </Box>

              <Divider sx={{ my: 0.5, borderColor: '#ccc' }} />

              {/* 価格情報 */}
              <Box sx={{ mb: 1 }}>
                {(property.price || property.listing_price) && (
                  <FieldRow label="価格" value={formatPrice(property.price || property.listing_price)} />
                )}
                {property.monthly_loan_payment && (
                  <FieldRow label="月々ローン" value={formatPrice(property.monthly_loan_payment)} />
                )}
                <FieldRow label="買付有無" value={property.offer_status} />
                <FieldRow label="値下げ履歴" value={property.price_reduction_history} />
                <FieldRow label="売却理由" value={property.sale_reason} />
              </Box>

              {/* 内覧前伝達事項（白黒：薄いグレー背景） */}
              {property.pre_viewing_notes && (
                <Box sx={{ p: 0.5, bgcolor: '#f5f5f5', border: '1px solid #bbb', borderRadius: 0.5, mb: 1 }}>
                  <Typography sx={{ fontSize: '7pt', fontWeight: 'bold', color: '#333', mb: 0.3 }}>
                    内覧前伝達事項
                  </Typography>
                  <Typography sx={{ fontSize: '7pt', whiteSpace: 'pre-wrap', lineHeight: 1.3 }}>
                    {property.pre_viewing_notes}
                  </Typography>
                </Box>
              )}

              {/* 内覧情報（白黒） */}
              {(property.viewing_key || property.viewing_parking || property.viewing_notes || property.viewing_available_date) && (
                <Box sx={{ p: 0.5, bgcolor: '#f0f0f0', border: '1px solid #bbb', borderRadius: 0.5, mb: 1 }}>
                  <Typography sx={{ fontSize: '7pt', fontWeight: 'bold', color: '#000', mb: 0.3 }}>
                    内覧情報
                  </Typography>
                  <FieldRow label="鍵等" value={property.viewing_key} />
                  <FieldRow label="駐車場" value={property.viewing_parking} />
                  <FieldRow label="伝達事項" value={property.viewing_notes} />
                  <FieldRow label="内覧可能日" value={property.viewing_available_date} />
                </Box>
              )}

              {/* 売主情報（白黒） */}
              {(property.seller_name || property.seller_contact || property.seller_email) && (
                <Box sx={{ p: 0.5, bgcolor: '#f8f8f8', border: '1px solid #bbb', borderRadius: 0.5, mb: 1 }}>
                  <Typography sx={{ fontSize: '7pt', fontWeight: 'bold', color: '#000', mb: 0.3 }}>
                    売主情報
                  </Typography>
                  <FieldRow label="売主名" value={property.seller_name} />
                  <FieldRow label="連絡先" value={property.seller_contact} />
                  <FieldRow label="メール" value={property.seller_email} />
                </Box>
              )}

              {/* 業者対応日（白黒） */}
              {property.broker_response && (
                <Box sx={{ p: 0.5, bgcolor: '#f0f0f0', border: '1px solid #bbb', borderRadius: 0.5, mb: 1 }}>
                  <FieldRow label="業者対応日" value={String(property.broker_response)} />
                </Box>
              )}
            </Box>
          </Grid>

          {/* 右カラム: 問合せ内容 */}
          <Grid item xs={6}>
            <Box sx={{ pl: 1 }}>
              <Typography sx={{ fontSize: '9pt', fontWeight: 'bold', color: '#000', mb: 0.5, pb: 0.3, borderBottom: '2px solid #000' }}>
                問合せ内容
              </Typography>

              {/* 買主基本情報 */}
              <Box sx={{ mb: 1 }}>
                <Typography sx={{ fontSize: '9pt', fontWeight: 'bold', color: '#000', mb: 0.5, borderBottom: '1px solid #ccc', pb: 0.3 }}>
                  基本情報
                </Typography>
                <FieldRow label="氏名・会社名" value={buyer.name} />
                <FieldRow label="電話番号" value={buyer.phone_number} />
                <FieldRow label="メール" value={buyer.email} />
                <FieldRow label="法人名" value={buyer.company_name} />
                <FieldRow label="業者問合せ" value={buyer.broker_inquiry} />
              </Box>

              <Divider sx={{ my: 0.5, borderColor: '#ccc' }} />

              {/* 問合せ情報 */}
              <Box sx={{ mb: 1 }}>
                <Typography sx={{ fontSize: '9pt', fontWeight: 'bold', color: '#000', mb: 0.5, borderBottom: '1px solid #ccc', pb: 0.3 }}>
                  問合せ情報
                </Typography>
                <FieldRow label="受付日" value={formatDate(buyer.reception_date)} />
                <FieldRow label="問合せ元" value={buyer.inquiry_source} />
                <FieldRow label="初動担当" value={buyer.initial_assignee} />
                <FieldRow label="★最新状況" value={buyer.latest_status} />
                <FieldRow label="案件担当" value={buyer.project_assignee} />
                <FieldRow label="次電日" value={formatDate(buyer.next_call_date)} />
              </Box>

              {/* 問合時ヒアリング（白黒） */}
              {buyer.inquiry_hearing && (
                <Box sx={{ p: 0.5, bgcolor: '#f5f5f5', border: '1px solid #bbb', borderRadius: 0.5, mb: 1 }}>
                  <Typography sx={{ fontSize: '7pt', fontWeight: 'bold', color: '#000', mb: 0.3 }}>
                    問合時ヒアリング
                  </Typography>
                  <Typography sx={{ fontSize: '7pt', whiteSpace: 'pre-wrap', lineHeight: 1.3 }}>
                    {stripHtml(buyer.inquiry_hearing)}
                  </Typography>
                </Box>
              )}

              <Divider sx={{ my: 0.5, borderColor: '#ccc' }} />

              {/* 対応状況 */}
              <Box sx={{ mb: 1 }}>
                <Typography sx={{ fontSize: '9pt', fontWeight: 'bold', color: '#000', mb: 0.5, borderBottom: '1px solid #ccc', pb: 0.3 }}>
                  対応状況
                </Typography>
                <FieldRow label="電話対応" value={buyer.inquiry_email_phone} />
                <FieldRow label="メール返信" value={buyer.inquiry_email_reply} />
                <FieldRow label="3回架電確認" value={buyer.three_calls_confirmed} />
                <FieldRow label="近隣物件メール" value={buyer.neighbor_property_email_sent} />
                <FieldRow label="配信メール" value={buyer.distribution_type} />
                <FieldRow label="Pinrich" value={buyer.pinrich} />
              </Box>

              {/* 業者向けアンケート */}
              {buyer.vendor_survey && (
                <Box sx={{ mb: 1 }}>
                  <FieldRow label="業者向けアンケート" value={buyer.vendor_survey} />
                </Box>
              )}

              {/* 内覧アンケート（白黒） */}
              {buyer.viewing_survey_result && (
                <Box sx={{ p: 0.5, bgcolor: '#f5f5f5', border: '1px solid #bbb', borderRadius: 0.5, mb: 1 }}>
                  <Typography sx={{ fontSize: '7pt', fontWeight: 'bold', color: '#000', mb: 0.3 }}>
                    内覧アンケート内容
                  </Typography>
                  <Typography sx={{ fontSize: '7pt', whiteSpace: 'pre-wrap', lineHeight: 1.3 }}>
                    {buyer.viewing_survey_result}
                  </Typography>
                  {buyer.viewing_survey_confirmed && (
                    <Typography sx={{ fontSize: '7pt', color: '#333', mt: 0.3 }}>
                      ✓ {buyer.viewing_survey_confirmed}
                    </Typography>
                  )}
                </Box>
              )}

              {/* 持家ヒアリング */}
              {(buyer.owned_home_hearing_inquiry || buyer.owned_home_hearing_result) && (
                <Box sx={{ mb: 1 }}>
                  <FieldRow label="持家ヒアリング" value={buyer.owned_home_hearing_inquiry} />
                  <FieldRow label="ヒアリング結果" value={buyer.owned_home_hearing_result} />
                </Box>
              )}

              {/* 要査定 */}
              {buyer.valuation_required && (
                <Box sx={{ mb: 1 }}>
                  <FieldRow label="要査定" value={buyer.valuation_required} />
                </Box>
              )}

              {/* 担当への確認事項（白黒） */}
              {buyer.message_to_assignee && (
                <Box sx={{ p: 0.5, bgcolor: '#f0f0f0', border: '1px solid #bbb', borderRadius: 0.5, mb: 1 }}>
                  <Typography sx={{ fontSize: '7pt', fontWeight: 'bold', color: '#000', mb: 0.3 }}>
                    担当への確認事項
                  </Typography>
                  <Typography sx={{ fontSize: '7pt', whiteSpace: 'pre-wrap', lineHeight: 1.3 }}>
                    {stripHtml(buyer.message_to_assignee)}
                  </Typography>
                </Box>
              )}
            </Box>
          </Grid>
        </Grid>

        {/* フッター */}
        <Box sx={{ mt: 0.5, pt: 0.5, borderTop: '1px solid #ccc', display: 'flex', justifyContent: 'space-between' }}>
          <Typography sx={{ fontSize: '7pt', color: '#666' }}>
            内覧準備資料 - 社内管理システム
          </Typography>
          <Typography sx={{ fontSize: '7pt', color: '#666' }}>
            {today}
          </Typography>
        </Box>
      </Box>
    );
  }
);

ViewingPreparationPrintSheet.displayName = 'ViewingPreparationPrintSheet';

export default ViewingPreparationPrintSheet;
