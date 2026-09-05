import { useEffect, useState } from 'react';
import { Box, Button, Typography, Grid, Chip, TextField, IconButton, CircularProgress, Alert, Divider, Paper } from '@mui/material';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import SendIcon from '@mui/icons-material/Send';
import api from '../services/api';

/**
 * 売却サポートページ（査定依頼者向け専用ページ）のスタッフ管理セクション。
 * SellerDetailPage.tsx の既存 CollapsibleSection パターンに合わせて使う想定。
 *
 * 表示内容：
 * - 専用URL発行状況・最終アクセス日時・アクセス回数
 * - ユーザーが入力した希望価格・希望売却時期
 * - チャット未読件数、返信欄
 */
export default function SellerPortalAdminSection({ sellerId, sellerNumber }: { sellerId: string; sellerNumber: string }) {
  const [status, setStatus] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [issuing, setIssuing] = useState(false);
  const [issuedUrl, setIssuedUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [conversations, setConversations] = useState<any[]>([]);
  const [replyDrafts, setReplyDrafts] = useState<Record<string, string>>({});
  const [sendingConvId, setSendingConvId] = useState<string | null>(null);
  const [confirmingSettlement, setConfirmingSettlement] = useState(false);
  const [confirmingBuyout, setConfirmingBuyout] = useState(false);

  const loadStatus = async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const res = await api.get(`/api/seller-portal/admin/${sellerId}/status`);
      setStatus(res.data);
      const msgRes = await api.get(`/api/seller-portal/admin/${sellerId}/messages`);
      setConversations(msgRes.data.conversations || []);
    } catch (err: any) {
      // 🚨 以前はここでエラーを握っており、「本当に未発行」なのか「取得に失敗しただけ」なのかを
      // 画面上で区別できなかった。取得失敗時に「未発行」と誤認して再発行してしまうと、
      // 既にSMS/メールで送信済みの有効なURLを誤って無効化してしまう危険があるため、
      // エラー時は明示的にエラー表示し、statusはnullのままにする（「発行」ボタンは出さない）。
      console.error('[SellerPortalAdminSection] 状況の取得に失敗しました:', err);
      setLoadError(
        err?.response?.data?.error || err?.message || '取得に失敗しました。時間を置いて再読み込みしてください。'
      );
      setStatus(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStatus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sellerId]);

  const handleIssueToken = async () => {
    // 既に発行済みのURLがある場合、再発行すると古いURL（売主がホーム画面に保存済みの可能性がある）が
    // 無効になるため、誤操作防止の確認ダイアログを出す。
    if (status?.activeUrl) {
      const confirmed = window.confirm(
        '再発行すると、現在売主様に送っている専用URLが無効になります。\n' +
        '売主様が既にURLを保存・利用中の場合、開けなくなります。\n\n' +
        '本当に再発行しますか？'
      );
      if (!confirmed) return;
    }

    setIssuing(true);
    try {
      const res = await api.post(`/api/seller-portal/admin/${sellerId}/issue-token`, { sellerNumber });
      const url = `${window.location.origin}/portal/${res.data.token}`;
      setIssuedUrl(url);
      await loadStatus();
    } finally {
      setIssuing(false);
    }
  };

  const handleCopy = () => {
    const url = issuedUrl || status?.activeUrl;
    if (!url) return;
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  /**
   * 「いつまでに売りたいですか？」の入力をスタッフが確認したことを記録する。
   * サイドバーカテゴリー「売却サポート：売却希望時期」から、この売主を除外するために必要。
   * （確認しないと、いつまでもこのカテゴリーに表示され続ける）
   */
  const handleConfirmSettlement = async () => {
    setConfirmingSettlement(true);
    try {
      await api.post(`/api/seller-portal/admin/${sellerId}/confirm-settlement`, { sellerNumber });
      await loadStatus();
    } finally {
      setConfirmingSettlement(false);
    }
  };

  /**
   * 「買取依頼」ボタンの押下をスタッフが確認したことを記録する。
   * サイドバーカテゴリー「売却サポート：対応要」から、この売主を除外するために必要。
   */
  const handleConfirmBuyout = async () => {
    setConfirmingBuyout(true);
    try {
      await api.post(`/api/seller-portal/admin/${sellerId}/confirm-buyout`, { sellerNumber });
      await loadStatus();
    } finally {
      setConfirmingBuyout(false);
    }
  };

  const handleReply = async (conversationId: string) => {
    const content = replyDrafts[conversationId];
    if (!content?.trim()) return;
    setSendingConvId(conversationId);
    try {
      await api.post(`/api/seller-portal/admin/${sellerId}/messages`, {
        conversationId,
        content,
        sellerNumber,
      });
      setReplyDrafts((prev) => ({ ...prev, [conversationId]: '' }));
      await loadStatus();
    } finally {
      setSendingConvId(null);
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 2 }}>
        <CircularProgress size={24} />
      </Box>
    );
  }

  if (loadError) {
    return (
      <Box>
        <Alert severity="error" sx={{ mb: 2 }}>
          {loadError}
        </Alert>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          発行状況を正しく確認できないため、安全のため「発行」ボタンは表示していません。
          既にSMS・メールでURLを送信済みの場合、状況が確認できないまま発行すると、
          その有効なURLを誤って無効化する恐れがあるためです。再読み込みをお試しください。
        </Typography>
        <Button variant="outlined" onClick={loadStatus}>再読み込み</Button>
      </Box>
    );
  }

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2, flexWrap: 'wrap' }}>
        <Button variant="contained" onClick={handleIssueToken} disabled={issuing}>
          {issuing ? '発行中...' : status?.tokenStatus ? '専用URLを再発行' : '専用URLを発行'}
        </Button>
        {status?.unreadCount > 0 && (
          <Chip label={`未読 ${status.unreadCount}件`} color="error" size="small" />
        )}
      </Box>

      {/* 専用URLは常時表示する（issuedUrlは発行直後の一時表示、activeUrlはDBに保存済みの現在有効なURL） */}
      {(issuedUrl || status?.activeUrl) && (
        <Alert severity="success" sx={{ mb: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
            <Typography
              component="a"
              href={issuedUrl || status.activeUrl}
              target="_blank"
              rel="noopener noreferrer"
              variant="body2"
              sx={{ wordBreak: 'break-all', color: 'primary.main', textDecoration: 'underline' }}
            >
              {issuedUrl || status.activeUrl}
            </Typography>
            <IconButton size="small" onClick={handleCopy}>
              <ContentCopyIcon fontSize="small" />
            </IconButton>
            {copied && <Typography variant="caption">コピーしました</Typography>}
          </Box>
          <Typography variant="caption" color="text.secondary">
            このURLをSMSまたはメールで売主様にお送りください。再発行すると古いURLは無効になります。
          </Typography>
        </Alert>
      )}

      {status?.tokenStatus && (
        <Grid container spacing={2} sx={{ mb: 2 }}>
          <Grid item xs={6} sm={3}>
            <Typography variant="caption" color="text.secondary">発行日時</Typography>
            <Typography variant="body2">{new Date(status.tokenStatus.issued_at).toLocaleString('ja-JP')}</Typography>
          </Grid>
          <Grid item xs={6} sm={3}>
            <Typography variant="caption" color="text.secondary">最終アクセス</Typography>
            <Typography variant="body2">
              {status.tokenStatus.last_accessed_at ? new Date(status.tokenStatus.last_accessed_at).toLocaleString('ja-JP') : '未アクセス'}
            </Typography>
          </Grid>
          <Grid item xs={6} sm={3}>
            <Typography variant="caption" color="text.secondary">アクセス回数</Typography>
            <Typography variant="body2">{status.tokenStatus.access_count}回</Typography>
          </Grid>
        </Grid>
      )}

      {status?.preferences && (
        <Grid container spacing={2} sx={{ mb: 2 }}>
          <Grid item xs={6} sm={4}>
            <Typography variant="caption" color="text.secondary">売りたい価格</Typography>
            <Typography variant="body2">
              {status.preferences.desired_sale_price ? `${Math.round(status.preferences.desired_sale_price / 10000).toLocaleString()}万円` : '未入力'}
            </Typography>
          </Grid>
          <Grid item xs={6} sm={4}>
            <Typography variant="caption" color="text.secondary">相場価格</Typography>
            <Typography variant="body2">
              {status.preferences.minimum_sale_price ? `${Math.round(status.preferences.minimum_sale_price / 10000).toLocaleString()}万円` : '未入力'}
            </Typography>
          </Grid>
          <Grid item xs={12} sm={4}>
            <Typography variant="caption" color="text.secondary">売却希望時期</Typography>
            <Typography variant="body2">
              {status.preferences.desired_settlement_year_month
                ? new Date(status.preferences.desired_settlement_year_month).toLocaleDateString('ja-JP', { year: 'numeric', month: 'long' })
                : '未入力'}
            </Typography>
            {/* 「いつまでに売りたいですか？」が入力済み・未確認の場合のみボタンを表示する。
                確認するとサイドバーカテゴリー「売却サポート：売却希望時期」からこの売主が消える。 */}
            {status.preferences.desired_settlement_year_month && (
              status.preferences.staff_confirmed_settlement_at ? (
                <Chip label="確認済み" size="small" color="success" sx={{ mt: 0.5 }} />
              ) : (
                <Button
                  size="small"
                  variant="outlined"
                  color="primary"
                  onClick={handleConfirmSettlement}
                  disabled={confirmingSettlement}
                  sx={{ mt: 0.5 }}
                >
                  {confirmingSettlement ? '処理中...' : '確認済みにする'}
                </Button>
              )
            )}
          </Grid>
          <Grid item xs={6} sm={4}>
            <Typography variant="caption" color="text.secondary">ざっくり手残り閲覧</Typography>
            <Typography variant="body2">{status.preferences.viewed_rough_proceeds_at ? '閲覧済み' : '未閲覧'}</Typography>
          </Grid>
          <Grid item xs={6} sm={4}>
            <Typography variant="caption" color="text.secondary">詳細手残り計算</Typography>
            <Typography variant="body2">{status.preferences.detailed_proceeds_completed ? '実施済み' : '未実施'}</Typography>
          </Grid>
          {status.preferences.buyout_requested_at && (
            <Grid item xs={12} sm={4}>
              <Typography variant="caption" color="text.secondary">買取依頼</Typography>
              <Typography variant="body2">依頼あり（{new Date(status.preferences.buyout_requested_at).toLocaleDateString('ja-JP')}）</Typography>
              {/* 確認するとサイドバーカテゴリー「売却サポート：対応要」からこの売主が消える（未読メッセージが無い場合） */}
              {status.preferences.staff_confirmed_buyout_at ? (
                <Chip label="確認済み" size="small" color="success" sx={{ mt: 0.5 }} />
              ) : (
                <Button
                  size="small"
                  variant="outlined"
                  color="primary"
                  onClick={handleConfirmBuyout}
                  disabled={confirmingBuyout}
                  sx={{ mt: 0.5 }}
                >
                  {confirmingBuyout ? '処理中...' : '確認済みにする'}
                </Button>
              )}
            </Grid>
          )}
        </Grid>
      )}

      <Divider sx={{ my: 2 }} />

      <Typography variant="subtitle2" fontWeight="bold" sx={{ mb: 1 }}>
        チャット相談
      </Typography>

      {conversations.length === 0 && (
        <Typography variant="body2" color="text.secondary">
          まだ相談はありません。
        </Typography>
      )}

      {conversations.map((conv) => (
        <Paper key={conv.id} variant="outlined" sx={{ p: 1.5, mb: 1.5 }}>
          <Typography variant="caption" color="text.secondary">
            {CONTEXT_LABELS[conv.context_tag] ?? conv.context_tag}
          </Typography>

          {/* 相談元のセクション内容を返信欄の上に表示する。売主がどの情報を見ながら質問したのか分かるようにするため */}
          <SectionReferenceBox contextTag={conv.context_tag} status={status} />

          <Box sx={{ maxHeight: 200, overflowY: 'auto', my: 1 }}>
            {conv.messages.map((m: any) => (
              <Box key={m.id} sx={{ mb: 0.5, textAlign: m.sender_type === 'seller' ? 'left' : 'right' }}>
                <Typography
                  variant="body2"
                  sx={{
                    display: 'inline-block',
                    px: 1,
                    py: 0.5,
                    borderRadius: 1,
                    bgcolor: m.sender_type === 'seller' ? '#f0f4f8' : '#0B2545',
                    color: m.sender_type === 'seller' ? 'text.primary' : 'white',
                  }}
                >
                  {m.content}
                </Typography>
                {!m.read_at && m.sender_type === 'seller' && (
                  <Chip label="未読" size="small" color="error" sx={{ ml: 1, height: 18 }} />
                )}
              </Box>
            ))}
          </Box>
          <Box sx={{ display: 'flex', gap: 1 }}>
            <TextField
              fullWidth
              size="small"
              placeholder="返信を入力"
              value={replyDrafts[conv.id] ?? ''}
              onChange={(e) => setReplyDrafts((prev) => ({ ...prev, [conv.id]: e.target.value }))}
            />
            <IconButton
              color="primary"
              onClick={() => handleReply(conv.id)}
              disabled={sendingConvId === conv.id || !replyDrafts[conv.id]?.trim()}
            >
              <SendIcon />
            </IconButton>
          </Box>
        </Paper>
      ))}
    </Box>
  );
}

const CONTEXT_LABELS: Record<string, string> = {
  general: 'その他のご相談',
  valuation: '査定額についての相談',
  valuation_breakdown: '査定の理由についての相談',
  net_proceeds: '手残りについての相談',
  schedule: '売却スケジュールについての相談',
};

function ValuationMiniItem({ label, amount }: { label: string; amount: number }) {
  return (
    <Box>
      <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
        {label}
      </Typography>
      <Typography variant="body2" fontWeight="bold">
        {Math.round(amount / 10000).toLocaleString()}万円
      </Typography>
    </Box>
  );
}

const fmtMan = (yen: number) => `${Math.round(yen / 10000).toLocaleString()}万円`;

/**
 * 相談元（査定額/査定根拠/手残り/スケジュール）ごとに、そのセクションの内容を返信欄の上に表示する。
 * スタッフが売主と同じ情報を見ながら返信できるようにする（「その他のご相談」は対象外）。
 */
function SectionReferenceBox({ contextTag, status }: { contextTag: string; status: any }) {
  if (!status) return null;

  if (contextTag === 'valuation' && status.valuation) {
    return (
      <ReferenceBox title="現在の査定額">
        <ValuationMiniItem label="チャレンジ価格" amount={status.valuation.maximumPrice} />
        <ValuationMiniItem label="成約想定価格" amount={status.valuation.midPrice} />
        <ValuationMiniItem label="早期売却重視価格" amount={status.valuation.minimumPrice} />
      </ReferenceBox>
    );
  }

  if (contextTag === 'valuation_breakdown' && status.valuationBreakdown) {
    const b = status.valuationBreakdown;
    return (
      <ReferenceBox title="査定額の計算根拠（売主様に表示中の内容）">
        {b.hasBreakdown ? (
          <>
            <ValuationMiniItem label="固定資産税路線価" amount={b.fixedAssetTaxRoadPriceUsed ?? 0} />
            <ValuationMiniItem label="土地価格" amount={b.landPrice ?? 0} />
            {b.buildingPrice > 0 && <ValuationMiniItem label="建物価格" amount={b.buildingPrice} />}
            <ValuationMiniItem label="早期売却重視価格" amount={b.minimumPrice ?? 0} />
          </>
        ) : b.unitPricePerSqm ? (
          <ValuationMiniItem label="査定㎡単価" amount={b.unitPricePerSqm} />
        ) : (
          <Typography variant="caption" color="text.secondary">
            計算根拠データがなく、総額のみ表示している状態です。
          </Typography>
        )}
      </ReferenceBox>
    );
  }

  if (contextTag === 'net_proceeds' && status.roughProceeds?.length > 0) {
    // 売主が見ているのと同じ「ざっくり手残り」の代表値（最高額・最低額）を表示する
    const rows = status.roughProceeds;
    const highest = rows[0];
    const lowest = rows[rows.length - 1];
    return (
      <ReferenceBox title="ざっくり手残り（売主様に表示中の内容）">
        <Box>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
            {fmtMan(highest.priceYen)}で売却した場合
          </Typography>
          <Typography variant="body2" fontWeight="bold">
            手残り {fmtMan(highest.netProceeds)}
          </Typography>
        </Box>
        {lowest.priceYen !== highest.priceYen && (
          <Box>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
              {fmtMan(lowest.priceYen)}で売却した場合
            </Typography>
            <Typography variant="body2" fontWeight="bold">
              手残り {fmtMan(lowest.netProceeds)}
            </Typography>
          </Box>
        )}
      </ReferenceBox>
    );
  }

  if (contextTag === 'schedule' && status.schedule?.hasSettlementDate) {
    const s = status.schedule;
    return (
      <ReferenceBox title="売却スケジュール（売主様に表示中の内容）">
        <Box>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
            決済・引き渡し希望
          </Typography>
          <Typography variant="body2" fontWeight="bold">
            {s.settlementYear}年{s.settlementMonth}月
          </Typography>
        </Box>
        <Box>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
            逆算した販売開始
          </Typography>
          <Typography variant="body2" fontWeight="bold">
            {s.startYear}年{s.startMonth}月
          </Typography>
        </Box>
        {s.isCompressed && (
          <Typography variant="caption" color="warning.main">
            ※期間が短いため買取をご案内済み
          </Typography>
        )}
      </ReferenceBox>
    );
  }

  return null;
}

function ReferenceBox({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Box sx={{ p: 1, mt: 1, mb: 1, bgcolor: '#f0f4f8', borderRadius: 1 }}>
      <Typography variant="caption" color="text.secondary" fontWeight="bold" sx={{ display: 'block', mb: 0.5 }}>
        {title}
      </Typography>
      <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>{children}</Box>
    </Box>
  );
}
