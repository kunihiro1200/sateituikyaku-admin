import React from 'react';
import { Box, Typography } from '@mui/material';

interface IfuuCampaignSheetProps {
  buyerNumber: string;
  viewingDate: string; // YYYY/MM/DD形式
}

/**
 * いふうの5万円値引き＆1年間の修繕費用5万円負担キャンペーンシート
 * 物件価格1500万円以上の場合のみ表示
 */
const IfuuCampaignSheet: React.FC<IfuuCampaignSheetProps> = ({ buyerNumber, viewingDate }) => {
  // 有効期間：内覧日より1年間
  const vDate = new Date(viewingDate.replace(/\//g, '-'));
  const expiryDate = new Date(vDate);
  expiryDate.setFullYear(expiryDate.getFullYear() + 1);
  const expiryStr = `${expiryDate.getFullYear()}/${String(expiryDate.getMonth() + 1).padStart(2, '0')}/${String(expiryDate.getDate()).padStart(2, '0')}`;

  const cellStyle = {
    border: '1px solid #000',
    padding: '4px 6px',
    fontSize: '8.5pt',
  };
  const thStyle = {
    ...cellStyle,
    fontWeight: 'bold',
    background: '#f9f9f9',
  };

  return (
    <Box sx={{ width: '100%', height: '100%', p: '10mm 12mm', bgcolor: '#fff', fontFamily: '"Noto Sans JP","Hiragino Kaku Gothic ProN","Meiryo",sans-serif', fontSize: '9pt', color: '#000', boxSizing: 'border-box', overflow: 'hidden' }}>
      {/* タイトル */}
      <Typography sx={{ textAlign: 'center', fontSize: '16pt', fontWeight: 'bold', mb: '10px' }}>
        いふうの5万円値引き＆1年間の修繕費用5万円負担キャンペーン！！
      </Typography>

      {/* 条件説明 */}
      <Box sx={{ mb: '4px', fontSize: '9pt', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span>他社の物件のご購入でも可能です！（当社内覧に限ります）</span>
        <Box component="span" sx={{ border: '2px solid #000', borderRadius: '8px', padding: '2px 8px', fontSize: '8pt', fontWeight: 'bold' }}>
          他社物件でもOK！
        </Box>
      </Box>
      <Typography sx={{ mb: '10px', fontSize: '9pt', fontWeight: 'bold' }}>
        物件価格1500万以上の物件のご購入に限ります！！
      </Typography>

      {/* 有効期間 */}
      <Typography sx={{ mb: '10px', fontSize: '9.5pt' }}>
        <Box component="span" sx={{ fontWeight: 'bold', color: '#c00' }}>有効期間：</Box>
        <Box component="span" sx={{ fontWeight: 'bold', color: '#c00' }}>{expiryStr} まで</Box>
      </Typography>

      {/* 物件評価テーブル */}
      <Box component="table" sx={{ width: '100%', borderCollapse: 'collapse', mb: '10px' }}>
        <thead>
          <tr>
            <th style={{ ...thStyle, width: '100px' }}>日付</th>
            <th style={thStyle}>物件名・価格</th>
            <th style={{ ...thStyle, width: '200px' }}>評価</th>
            <th style={thStyle}>コメント</th>
          </tr>
        </thead>
        <tbody>
          {[...Array(5)].map((_, i) => (
            <tr key={i} style={{ height: '42px' }}>
              <td style={{ ...cellStyle, borderBottom: '1px dotted #999' }}></td>
              <td style={{ ...cellStyle, borderBottom: '1px dotted #999', textAlign: 'right' }}>万円</td>
              <td style={{ ...cellStyle, borderBottom: '1px dotted #999', width: '200px' }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '7.5pt' }}>
                  <span>1</span><span>2</span><span>3</span><span>4</span><span>5</span>
                </Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', fontSize: '6.5pt', color: '#666' }}>
                  <span>悪い</span><span>良い</span>
                </Box>
              </td>
              <td style={{ ...cellStyle, borderBottom: '1px dotted #999' }}></td>
            </tr>
          ))}
        </tbody>
      </Box>

      {/* 当社管理番号 */}
      <Typography sx={{ textAlign: 'right', mb: '12px', fontSize: '9pt' }}>
        当社管理番号： <Box component="span" sx={{ fontWeight: 'bold' }}>{buyerNumber}</Box>
      </Typography>

      {/* ローン仮審査の状況 */}
      <Box component="table" sx={{ width: '100%', borderCollapse: 'collapse', mb: '14px' }}>
        <tbody>
          <tr>
            <td style={{ ...cellStyle, fontWeight: 'bold', verticalAlign: 'middle' }} rowSpan={3}>ローン仮審査の状況</td>
            <th style={thStyle}>銀行名</th>
            <th style={thStyle}>融資額</th>
            <th style={thStyle}>日付</th>
            <th style={thStyle}>結果</th>
          </tr>
          <tr>
            <td style={cellStyle}>銀行</td>
            <td style={{ ...cellStyle, textAlign: 'right' }}>万円</td>
            <td style={cellStyle}>/</td>
            <td style={cellStyle}></td>
          </tr>
          <tr>
            <td style={cellStyle}>銀行</td>
            <td style={{ ...cellStyle, textAlign: 'right' }}>万円</td>
            <td style={cellStyle}>/</td>
            <td style={cellStyle}></td>
          </tr>
        </tbody>
      </Box>

      {/* おすすめ銀行の連絡先 */}
      <Box sx={{ border: '2px solid #000', p: '8px 10px', mb: '10px' }}>
        <Typography sx={{ fontWeight: 'bold', mb: '6px', fontSize: '9pt' }}>おすすめ銀行の連絡先（ご参考）</Typography>
        <Box component="table" sx={{ width: '100%', borderCollapse: 'collapse', fontSize: '8pt' }}>
          <tbody>
            <tr><td colSpan={4} style={{ fontWeight: 'bold', padding: '2px 0' }}>【大分銀行】</td><td style={{ textAlign: 'right', fontSize: '7.5pt' }}>＊休日</td></tr>
            <tr><td style={{ padding: '1px 4px' }}>ローンプラザ宗麟館</td><td style={{ padding: '1px 4px' }}>大分市東大道1丁目9番1号3階</td><td style={{ padding: '1px 4px' }}>0120-67-0189</td><td colSpan={2} style={{ padding: '1px 4px' }}>水、祝</td></tr>
            <tr><td style={{ padding: '1px 4px' }}>わさだローンプラザ</td><td style={{ padding: '1px 4px' }}>大分市大字市1157番地</td><td style={{ padding: '1px 4px' }}>0120-56-0189</td><td colSpan={2} style={{ padding: '1px 4px' }}>水、祝</td></tr>
            <tr><td style={{ padding: '1px 4px' }}>鶴崎ローンプラザ</td><td style={{ padding: '1px 4px' }}>大分市南鶴崎3丁目1番12号</td><td style={{ padding: '1px 4px' }}>0120-53-0189</td><td colSpan={2} style={{ padding: '1px 4px' }}>水、祝</td></tr>
            <tr><td colSpan={5} style={{ fontWeight: 'bold', padding: '4px 0 2px' }}>【ろうきん】</td></tr>
            <tr><td style={{ padding: '1px 4px' }}>ローンセンターおおいた</td><td style={{ padding: '1px 4px' }}>大分市寿町1-3（大分支店3F）</td><td style={{ padding: '1px 4px' }}>097-536-6366</td><td colSpan={2} style={{ padding: '1px 4px' }}>水、土、祝</td></tr>
            <tr><td style={{ padding: '1px 4px' }}>鶴崎支店</td><td style={{ padding: '1px 4px' }}>大分市中鶴崎2-3-18</td><td style={{ padding: '1px 4px' }}>097-521-8101</td><td colSpan={2} style={{ padding: '1px 4px' }}>土、日、祝</td></tr>
            <tr><td colSpan={5} style={{ fontWeight: 'bold', padding: '4px 0 2px' }}>【伊予銀行】</td></tr>
            <tr><td style={{ padding: '1px 4px' }}>大分支店</td><td style={{ padding: '1px 4px' }}>大分市府内町3-1-9</td><td style={{ padding: '1px 4px' }}>097-532-6171</td><td colSpan={2} style={{ padding: '1px 4px' }}>土、日、祝</td></tr>
          </tbody>
        </Box>
      </Box>

      {/* 銀行相談前の案内 */}
      <Box sx={{ border: '2px solid #000', p: '8px 10px' }}>
        <Typography sx={{ fontWeight: 'bold', mb: '4px', fontSize: '9pt' }}>銀行へご相談に行く前に・・・</Typography>
        <Typography sx={{ mb: '4px', fontSize: '8.5pt' }}>事前に連絡して、予約をされることをお勧めいたします。</Typography>
        <Typography sx={{ mb: '4px', fontSize: '8.5pt' }}>基本的な準備書類（金融機関によって異なりますので、事前にご確認をお願いいたします）</Typography>
        <Typography sx={{ fontSize: '8.5pt' }}>
          ①身分証明書（運転免許証等）<br />
          ②健康保険証（勤務先名の記載があるもの）<br />
          ③源泉徴収票（直近のもの）
        </Typography>
      </Box>
    </Box>
  );
};

export default IfuuCampaignSheet;
