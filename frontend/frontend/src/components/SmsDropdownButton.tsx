import React, { useState } from 'react';
import {
  Button,
  Menu,
  MenuItem,
  ButtonGroup,
  Divider,
} from '@mui/material';
import SmsIcon from '@mui/icons-material/Sms';
import ArrowDropDownIcon from '@mui/icons-material/ArrowDropDown';
import api from '../services/api';

interface SmsDropdownButtonProps {
  phoneNumber: string;
  buyerName: string;
  buyerNumber: string;
  propertyAddress: string;
  propertyType: string;
  propertyNumber?: string; // 問合せ物件番号（FI判定用）
  senderName?: string;
  onSmsSent?: () => void;
  preViewingNotes?: string;
  /** 次電日（next_call_date）が自動セットされたときに親へ通知（画面の再描画・再取得用） */
  onNextCallDateUpdated?: (nextCallDate: string) => void;
}

const VIEWING_FORM_BASE = 'https://docs.google.com/forms/d/e/1FAIpQLSefXwsYKryraVM4jtnLgcYtboUg3w-lx7tasftVA47E5jXUlQ/viewform?usp=pp_url';
const PUBLIC_SITE_URL = 'https://property-site-frontend-kappa.vercel.app/public/properties';

// ①②③④の返信テンプレートのメニュー項目スタイル（薄緑背景で識別しやすくする）
const REPLY_ITEM_SX = {
  backgroundColor: '#e8f5e9',
  '&:hover': { backgroundColor: '#c8e6c9' },
} as const;

// メール配信の希望条件を入力してもらうフォーム（③④で使用）
// TODO: 実際の配信希望条件フォームURLが用意でき次第、差し替える
const EMAIL_PREF_FORM_URL = 'https://docs.google.com/forms/d/e/REPLACE_WITH_EMAIL_PREF_FORM/viewform';

// 内覧希望者へのヒアリング項目（①内覧希望／②日程調整中の予約案内で共通利用）
const VIEWING_HEARING_ITEMS = [
  '・ご希望日時（候補を3つほど挙げてください）',
  '・内覧に来られる人数（大人○名・子供○名）',
  '・内覧は初めてでいらっしゃいますか',
  '・いつ頃までのお引っ越しをご希望ですか',
  '・ご購入はローン・自己資金のどちらをお考えですか',
  '・ローンの場合、仮審査を受けられたことはございますか',
].join('\n');

/**
 * 現在日時から指定した「月数後」の日付を YYYY-MM-DD 形式で返す
 * 次電日（next_call_date）の自動セットに使用する
 */
const addMonthsISO = (months: number): string => {
  const d = new Date();
  d.setMonth(d.getMonth() + months);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

export const SmsDropdownButton: React.FC<SmsDropdownButtonProps> = ({
  phoneNumber,
  buyerName,
  buyerNumber,
  propertyAddress,
  propertyType,
  propertyNumber,
  senderName,
  onSmsSent,
  preViewingNotes,
  onNextCallDateUpdated,
}) => {
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const open = Boolean(anchorEl);

  const handleOpen = (e: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(e.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  const sendSms = (templateId: string, templateName: string) => {
    handleClose();
    const name = buyerName || 'お客様';
    const address = propertyAddress;
    const viewingFormUrl = `${VIEWING_FORM_BASE}&entry.267319544=${buyerNumber}&entry.2056434590=${encodeURIComponent(address)}`;
    const preViewingSection = preViewingNotes
      ? `\n\n${preViewingNotes}`
      : '';
    // 問合せ物件番号に「FI」が含まれる場合は建売専門サイトリンクを非表示にし、署名を福岡用に切り替え
    const hasFI = propertyNumber ? propertyNumber.toUpperCase().includes('FI') : false;

    // FI判定による会社名・署名
    const companyIntro = hasFI ? '株式会社くじら不動産と申します。' : '株式会社いふうと申します。';
    const signature = hasFI
      ? `\n\n株式会社くじら不動産（株式会社いふう）\n〒810-0073福岡市中央区舞鶴3-1-10\nオフィスニューガイアセレス赤坂門No.19 -201\nTEL:092-401-5331\nFAX:092-401-5332\nHP:https://kujira-fudosan.com/`
      : `\n\n株式会社 いふう\nTEL：097-533-2022`;
    const noResponseCompany = hasFI ? 'くじら不動産' : 'いふう';

    let message = '';

    if (templateId === 'land_no_permission') {
      message = `${name}様\n\nこの度はお問い合わせありがとうございます。\n${companyIntro}\n\n所在地：${address}\n上記の物件のお問い合わせ、ありがとうございます。\n現地確認につきましては、敷地外からはご自由に見ていただいて大丈夫です。\n所在地：${address}${hasFI ? '' : `\n★大分市の新築建売専門サイト↓↓\nhttps://sateituikyaku-admin-frontend.vercel.app/tateuri\n★非公開の物件はこちらから↓↓\n${PUBLIC_SITE_URL}\nお気軽にお問い合わせください。`}\n${hasFI ? 'ご不明な点等ございましたら、お気軽にお問い合わせください。' : ''}${preViewingSection}\n\nまた、他社物件もご紹介できますので、気になる物件がございましたらお気軽にご連絡ください。${signature}`;
    } else if (templateId === 'minpaku') {
      message = `${name}様\n\nこの度はお問い合わせありがとうございます。\n${companyIntro}\n\n所在地：${address}\n上記の物件のお問い合わせ、ありがとうございます。\n民泊につきましては、民泊新法（営業180日以内）であればどの用途地域でも民泊が可能です。保健所に届け出をする際に「近隣住民に説明したか」が必須の項目になりますので、反対が出た場合は難しい可能性もあります。\nご不明な点等ございましたら、東部保健所（0977-67-2511）へお問い合わせください。${preViewingSection}\n\nまた、ご内覧希望の場合は、こちらからご予約お願いいたします↓↓\n${viewingFormUrl}\n\n★お急ぎで内覧をご希望の方は、直接お電話にてお申込みも承っております！\nお気軽にお問い合わせください。\n\nまた、他社物件もご紹介できますので、気になる物件がございましたらお気軽にご連絡ください。${signature}`;
    } else if (templateId === 'land_need_permission') {
      message = `${name}様\n\nこの度はお問い合わせありがとうございます。\n${companyIntro}\n\n所在地：${address}\n上記の物件のお問い合わせ、ありがとうございます。\n現地確認につきましては、当社で売主様へ許可を取った後に、敷地外からはご自由に見ていただくことになります。\nそこで、現地に行かれる日程が決まりましたら下記より日程をご予約いただければと思います\n\n所在地：${address}\n\n${viewingFormUrl}${hasFI ? '' : `\n\n★大分市の新築建売専門サイト↓↓\nhttps://sateituikyaku-admin-frontend.vercel.app/tateuri\n★非公開の物件はこちらから↓↓\n${PUBLIC_SITE_URL}\nお気軽にお問い合わせください。`}\n${hasFI ? 'ご不明な点等ございましたら、お気軽にお問い合わせください。' : ''}${preViewingSection}\n\nまた、他社物件もご紹介できますので、気になる物件がございましたらお気軽にご連絡くださいませ。${signature}`;
    } else if (templateId === 'offer_no_viewing') {
      message = `${name}様\n\nこの度はお問い合わせありがとうございます。\n${companyIntro}\n\n所在地：${address}\n\n大変申し訳ございませんが、こちらの物件は他のお客様より只今申込みをいただいております。\n万が一契約まで至らなかった場合、ご連絡さしあげるという形でよろしいでしょうか？\n\n他に気になる物件がございましたら、他社の物件でもご紹介可能ですので、お気軽にお問い合わせくださいませ。${hasFI ? '' : `\n★大分市の新築建売専門サイト↓↓\nhttps://sateituikyaku-admin-frontend.vercel.app/tateuri\n★非公開の物件はこちらから↓↓\n${PUBLIC_SITE_URL}`}${preViewingSection}${signature}`;
    } else if (templateId === 'offer_ok_viewing') {
      message = `${name}様\n\nこの度はお問い合わせありがとうございます。\n${companyIntro}\n\n所在地：${address}\n\n大変申し訳ございませんが、こちらの物件は他のお客様より只今申込みをいただいております。\nその方が契約に至らない場合もございますので、随時、内覧は可能です。（申込みを頂いた場合は２番手以降となります）\n上記をご承知の上、内覧をご希望される場合は、下記ご入力後返信いただくか、お電話で直接受け付けます。\n内覧のご予約はこちらから↓↓\n${viewingFormUrl}${hasFI ? '' : `\n\n★大分市の新築建売専門サイト↓↓\nhttps://sateituikyaku-admin-frontend.vercel.app/tateuri\n★非公開の物件はこちらから↓↓\n${PUBLIC_SITE_URL}`}\n\n周辺エリアで物件をお探しでしたら、メールにて公開前・新着物件をご案内しておりますのでご利用ください。\nまた、他社物件もご紹介できますので、気になる物件がございましたらお気軽にご連絡ください。${preViewingSection}${signature}`;
    } else if (templateId === 'no_response') {
      message = `${name}様\n\n先日は${address}のお問い合わせを頂き誠にありがとうございました。\nその後物件探しのご状況はいかがでしょうか？\nまだ物件をお探しであれば是非${noResponseCompany}にてお手伝い出来ればと存じますのでお気軽にお申し付け下さい。\n以前お問合せ頂いた物件に関しまして、ご内覧希望日時を記載してご返信頂きましたら直ぐにご確認可能でございます。\n是非一度ご案内させて頂ければ幸いです\n\n内覧のご予約はこちらから↓↓\n${viewingFormUrl}\n\n既に当社で別の物件を内覧予定、済でしたら申し訳ございません、本メールは無視してください。\n気になる物件がございましたら他社様の物件もご内覧可能です。${hasFI ? '' : `\n★大分市の新築建売専門サイト↓↓\nhttps://sateituikyaku-admin-frontend.vercel.app/tateuri\n★非公開の物件はこちらから↓↓\n${PUBLIC_SITE_URL}`}\n引き続き宜しくお願い致します。${preViewingSection}${signature}`;
    } else if (templateId === 'no_response_offer') {
      message = `${name}様\n\n先日は${address}のお問い合わせを頂き誠にありがとうございました。\n物件案内がご要望に添えず、大変申し訳ございませんでした。\nその後物件探しのご状況はいかがでしょうか？\nまだ物件をお探しであれば是非${noResponseCompany}にてお手伝い出来ればと存じますのでお気軽にお申し付け下さい。\n\n他に気になる物件がございましたら他社様の物件もご内覧可能です。${hasFI ? '' : `\n★大分市の新築建売専門サイト↓↓\nhttps://sateituikyaku-admin-frontend.vercel.app/tateuri\n★非公開の物件はこちらから↓↓\n${PUBLIC_SITE_URL}`}\n引き続き宜しくお願い致します。${preViewingSection}${signature}`;
    } else if (templateId === 'pinrich') {
      message = `${name}様\n先日は、ご登録いただきましてありがとうございました！その後物件探しのご状況はいかがでしょうか？\nまだ物件をお探しであれば是非${noResponseCompany}にてお手伝い出来ればと存じますのでお気軽にお申し付け下さい。\n\n他に気になる物件がございましたら他社様の物件もご内覧可能です。${hasFI ? '' : `\n★大分市の新築建売専門サイト↓↓\nhttps://sateituikyaku-admin-frontend.vercel.app/tateuri\n★非公開の物件はこちらから↓↓\n${PUBLIC_SITE_URL}`}\n引き続き宜しくお願い致します。${preViewingSection}${signature}`;
    } else if (templateId === 'house_mansion') {
      message = `${name}様\n\nこの度はお問い合わせありがとうございます。\n${companyIntro}\n\n所在地：${address}\n上記の物件のお問い合わせ、ありがとうございます。\nご不明な点等ございましたら、お気軽にお問い合わせください。${preViewingSection}\n\nまた、ご内覧希望の場合は、こちらからご予約お願いいたします↓↓\n${viewingFormUrl}${hasFI ? '' : `\n\n★大分市の新築建売専門サイト↓↓\nhttps://sateituikyaku-admin-frontend.vercel.app/tateuri\n★非公開の物件はこちらから↓↓\n${PUBLIC_SITE_URL}\nお気軽にお問い合わせください。`}\n\nまた、他社物件もご紹介できますので、気になる物件がございましたらお気軽にご連絡ください。${signature}`;
    } else if (templateId === 'ask_email') {
      const askEmailCompany = hasFI ? 'くじら不動産' : '不動産会社いふう';
      message = `${name}様お世話になっております。${askEmailCompany}です。\n先ほどは物件についてお問い合わせいただき、誠にありがとうございました。\n今後、ご希望条件に合う新着物件やおすすめ物件がございましたら、メールにてご紹介・配信させていただければと思っております。\n差し支えなければ、こちらのショートメールへご確認いただけるメールアドレスをご返信いただけますと幸いです。\nどうぞよろしくお願いいたします。`;
    } else if (templateId === 'empty_greeting') {
      const emptyCompany = hasFI ? '株式会社くじら不動産' : '株式会社いふう';
      const senderDisplay = senderName || '●●';
      message = `${name}様\nお世話になっております。${emptyCompany}の${senderDisplay}です。\n今後ともどうぞよろしくお願いいたします。`;
    } else if (templateId === 'post_viewing_thanks') {
      message = `${name}様\n\nお世話になっております。㈱いふうです。\n本日は、貴重な時間を割いていただき、誠にありがとうございました。\n弊社としましては、${name}様の不動産の購入のお手伝いをスタッフ一同で精一杯努めてまいりたいと思っております。\nご内覧いただいた中でご不明点などございましたらお気軽にお申し付けください。\nまた、いただいているメールアドレス宛に公開前物件等の配信をいたします。\n他社様の掲載物件もご紹介できますので気になる物件がございましたらお声がけいただけますと幸いです。\nリフォーム、補助金制度などについてもご相談も承っております。\n今後ともどうぞよろしくお願い致します。\n\n★大分市の新築建売専門サイト↓↓\nhttps://sateituikyaku-admin-frontend.vercel.app/tateuri\n★非公開の情報はこちらから検索可能です↓↓\n${PUBLIC_SITE_URL}${signature}`;
    } else if (templateId === 'status_check') {
      // 状況確認SMS：①②③④で番号返信を促す
      const companyName = hasFI ? 'くじら不動産' : '㈱いふう';
      const staff = senderName || '担当';
      message = `${name}様\n${companyName}の${staff}です。\n先日は物件のお問い合わせをいただき、誠にありがとうございました。\nその後の物件探しのご状況について、一度お伺いできればと思いご連絡いたしました。\n\n①内覧希望\n②内覧希望だが日程調整中\n③この物件の内覧はしないが、未公開物件や新着物件の情報が欲しい\n④物件探しはしていない\n\n差し支えなければ、現在のご状況を番号だけでもご返信いただけますと幸いです。\nよろしくお願いいたします。${signature}`;
    } else if (templateId === 'reply_1_viewing') {
      // ①内覧希望の返信：お礼＋ヒアリング
      message = `${name}様\n\nご返信ありがとうございます。承知いたしました。\n内覧のご予約をお取りしますので、下記についてお答えいただけますでしょうか？\n\n${VIEWING_HEARING_ITEMS}\n\nご返信をお待ちしております。よろしくお願いいたします。${signature}`;
    } else if (templateId === 'reply_2_scheduling') {
      // ②内覧希望だが日程調整中：お礼＋予約フォーム（ヒアリング内容も明記）＋次電日1か月後
      message = `${name}様\n\nご返信ありがとうございます。承知いたしました。\n内覧がお決まりになりましたら、下記のフォームよりご予約ください↓↓\n${viewingFormUrl}\n\nご予約の際は、あわせて下記についてもお知らせいただけますと幸いです。\n${VIEWING_HEARING_ITEMS}\n\n日程がお決まりでない場合も、決まり次第いつでもご連絡ください。改めてこちらからもご状況をお伺いいたします。\nよろしくお願いいたします。${signature}`;
    } else if (templateId === 'reply_3_info_only') {
      // ③情報だけ欲しい：お礼＋メール配信希望条件フォーム＋次電日3か月後
      message = `${name}様\n\nご返信ありがとうございます。承知いたしました。\n今後、ご希望条件に合った未公開物件や新着物件をメールにてご案内いたします。\n下記フォームよりご希望条件をご入力ください↓↓\n${EMAIL_PREF_FORM_URL}\n\n配信メールの中で気になる物件がございましたら、お気軽にお問い合わせください。\nよろしくお願いいたします。${signature}`;
    } else if (templateId === 'reply_4_not_searching') {
      // ④物件探ししていない：お礼＋メール配信フォーム（追客不要）
      message = `${name}様\n\nご返信ありがとうございます。承知いたしました。\n今後、物件をお探しの際は、お気軽にお問い合わせください。\nまた、ご希望であれば未公開物件や新着物件をメールにてご案内いたします。ご希望の場合は下記フォームよりご登録ください↓↓\n${EMAIL_PREF_FORM_URL}\n\n今後ともどうぞよろしくお願いいたします。${signature}`;
    } else if (templateId === 'followup_1month_unreachable') {
      // ★1か月後・不通メール（②の追客用）：日程確認＋予約フォーム、次電日さらに1か月後
      message = `${name}様\n\nお世話になっております。${hasFI ? 'くじら不動産' : '㈱いふう'}です。\nその後、内覧のご日程はお決まりになりましたでしょうか？\nお決まりになりましたら、下記フォームよりご予約ください↓↓\n${viewingFormUrl}\n\nご不明な点がございましたら、お気軽にお問い合わせください。\nよろしくお願いいたします。${signature}`;
    } else if (templateId === 'followup_3month_unreachable') {
      // ★3か月後・不通メール（③の追客用）：物件探し状況伺い、次電日さらに3か月後
      message = `${name}様\n\nお世話になっております。${hasFI ? 'くじら不動産' : '㈱いふう'}です。\nその後、物件探しのご状況はいかがでしょうか？\nご希望条件に合った物件が出ましたらメールにてご案内いたしますので、気になる物件がございましたらお気軽にお問い合わせください。\n引き続きどうぞよろしくお願いいたします。${signature}`;
    }

    // 返信テンプレートに応じて次電日（next_call_date）を自動セットする
    // ②内覧希望だが日程調整中 → 1か月後 / ③情報だけ欲しい → 3か月後
    // ★1か月後不通 → さらに1か月後 / ★3か月後不通 → さらに3か月後
    const nextCallMonthsMap: Record<string, number> = {
      reply_2_scheduling: 1,
      reply_3_info_only: 3,
      followup_1month_unreachable: 1,
      followup_3month_unreachable: 3,
    };
    const monthsToAdd = nextCallMonthsMap[templateId];
    if (monthsToAdd) {
      const nextCallDate = addMonthsISO(monthsToAdd);
      api.put(`/api/buyers/${buyerNumber}`, { next_call_date: nextCallDate })
        .then(() => {
          onNextCallDateUpdated?.(nextCallDate);
        })
        .catch((err: any) => console.warn('次電日の自動セットに失敗:', err));
    }

    if (message) {
      const smsLink = `sms:${phoneNumber}?body=${encodeURIComponent(message)}`;
      // SMS履歴を記録してからSMSアプリを開く（記録失敗時もSMSアプリは開く）
      api.post(`/api/buyers/${buyerNumber}/sms-history`, {
        templateId,
        templateName,
        phoneNumber,
        senderName: senderName || '',
      })
        .then(() => {
          // 記録成功後に親へ通知（履歴再取得のため）
          onSmsSent?.();
        })
        .catch((err: any) => console.warn('SMS履歴記録失敗:', err))
        .finally(() => {
          // window.open でSMSアプリを開く（ページ離脱しない）
          window.open(smsLink, '_self');
        });
    }
  };

  const isLand = propertyType === '土';

  return (
    <>
      <ButtonGroup
        variant="contained"
        size="small"
        sx={{
          '& .MuiButton-root': {
            backgroundColor: '#2e7d32',
            color: '#fff',
            '&:hover': {
              backgroundColor: '#1b5e20',
            },
          },
          '& .MuiButtonGroup-grouped': {
            borderColor: '#1b5e20 !important',
          },
        }}
      >
        <Button
          startIcon={<SmsIcon />}
          onClick={handleOpen}
          sx={{ whiteSpace: 'nowrap', fontWeight: 'bold' }}
        >
          SMS送信
        </Button>
        <Button
          size="small"
          onClick={handleOpen}
          sx={{ px: 0.5, minWidth: 'unset' }}
        >
          <ArrowDropDownIcon />
        </Button>
      </ButtonGroup>

      <Menu
        anchorEl={anchorEl}
        open={open}
        onClose={handleClose}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
        transformOrigin={{ vertical: 'top', horizontal: 'left' }}
      >
        {isLand ? [
          <MenuItem key="land_no_permission" onClick={() => sendSms('land_no_permission', '資料請求（土）許可不要')}>資料請求（土）許可不要</MenuItem>,
          <MenuItem key="minpaku" onClick={() => sendSms('minpaku', '民泊問合せ')}>民泊問合せ</MenuItem>,
          <MenuItem key="land_need_permission" onClick={() => sendSms('land_need_permission', '資料請求（土）売主要許可')}>資料請求（土）売主要許可</MenuItem>,
        ] : [
          <MenuItem key="house_mansion" onClick={() => sendSms('house_mansion', '資料請求（戸・マ）')}>資料請求（戸・マ）</MenuItem>,
        ]}
        <MenuItem onClick={() => sendSms('ask_email', 'メールアドレス確認')}>メールアドレス確認</MenuItem>
        <MenuItem onClick={() => sendSms('offer_no_viewing', '買付あり内覧NG')}>買付あり内覧NG</MenuItem>
        <MenuItem onClick={() => sendSms('offer_ok_viewing', '買付あり内覧OK')}>買付あり内覧OK</MenuItem>
        <MenuItem onClick={() => sendSms('post_viewing_thanks', '内覧後御礼メール')}>内覧後御礼メール</MenuItem>
        <MenuItem onClick={() => sendSms('no_response', '前回問合せ後反応なし')}>前回問合せ後反応なし</MenuItem>
        <MenuItem onClick={() => sendSms('no_response_offer', '反応なし（買付あり不適合）')}>反応なし（買付あり不適合）</MenuItem>
        <MenuItem onClick={() => sendSms('pinrich', '物件指定なし（Pinrich）')}>物件指定なし（Pinrich）</MenuItem>
        <MenuItem onClick={() => sendSms('empty_greeting', '空')}>空</MenuItem>
        <Divider />
        {/* 状況確認SMS（①②③④の番号返信を促す） */}
        <MenuItem onClick={() => sendSms('status_check', '状況確認SMS（①②③④）')}>状況確認SMS（①②③④）</MenuItem>
        {/* ①②③④の返信テンプレート（薄緑背景・次電日自動セット） */}
        <MenuItem sx={REPLY_ITEM_SX} onClick={() => sendSms('reply_1_viewing', '①内覧希望の返信')}>①内覧希望の返信</MenuItem>
        <MenuItem sx={REPLY_ITEM_SX} onClick={() => sendSms('reply_2_scheduling', '②日程調整中の返信（次電日+1ヶ月）')}>②日程調整中の返信（次電日+1ヶ月）</MenuItem>
        <MenuItem sx={REPLY_ITEM_SX} onClick={() => sendSms('reply_3_info_only', '③情報希望の返信（次電日+3ヶ月）')}>③情報希望の返信（次電日+3ヶ月）</MenuItem>
        <MenuItem sx={REPLY_ITEM_SX} onClick={() => sendSms('reply_4_not_searching', '④物件探しなしの返信')}>④物件探しなしの返信</MenuItem>
        <Divider />
        {/* 不通時の追客メール（手動送信・次電日を再セット） */}
        <MenuItem onClick={() => sendSms('followup_1month_unreachable', '★1ヶ月後不通メール（次電日+1ヶ月）')}>★1ヶ月後不通メール（次電日+1ヶ月）</MenuItem>
        <MenuItem onClick={() => sendSms('followup_3month_unreachable', '★3ヶ月後不通メール（次電日+3ヶ月）')}>★3ヶ月後不通メール（次電日+3ヶ月）</MenuItem>
      </Menu>
    </>
  );
};
