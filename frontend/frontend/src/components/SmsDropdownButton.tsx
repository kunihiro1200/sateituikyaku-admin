import React, { useState } from 'react';
import {
  Button,
  Menu,
  MenuItem,
  ButtonGroup,
  Divider,
  Box,
  Chip,
  Typography,
} from '@mui/material';
import SmsIcon from '@mui/icons-material/Sms';
import ArrowDropDownIcon from '@mui/icons-material/ArrowDropDown';
import api from '../services/api';
import { isLand as isLandType } from '../utils/propertyTypeUtils';

// テンプレート名を正規化して照合する（全角半角・空白の表記揺れを吸収）
function normalizeTemplateName(value: unknown): string {
  return String(value || '').normalize('NFKC').replace(/\s+/g, '').toLowerCase();
}

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
  /** SUUMO URL。買付キャンセル後案内テンプレで使用 */
  suumoUrl?: string;
  /** 次電日（next_call_date）が自動セットされたときに親へ通知（画面の再描画・再取得用） */
  onNextCallDateUpdated?: (nextCallDate: string) => void;
  /**
   * 送信済みSMSテンプレートの照合キー集合（売主リスト通話モードと同じ方式）。
   * `id:<templateId>` または `name:<正規化テンプレート名>` を格納する。
   * 該当するメニュー項目はグレー背景＋「送信済み」バッジで表示する。
   */
  sentTemplateKeys?: Set<string>;
}

const VIEWING_FORM_BASE = 'https://docs.google.com/forms/d/e/1FAIpQLSefXwsYKryraVM4jtnLgcYtboUg3w-lx7tasftVA47E5jXUlQ/viewform?usp=pp_url';
const PUBLIC_SITE_URL = 'https://property-site-frontend-kappa.vercel.app/public/properties';

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

// 今後の物件紹介の参考にするヒアリング項目（戸・マ／持家ヒアリングで共通利用）
const INTRO_HEARING_ITEMS = [
  '・これまでに内覧した物件',
  '・ご予算（物件のみ／リフォーム金額込み）',
  '・駐車場必要台数',
  '・現在のお住まい（持家戸建／持家マンション／賃貸／ほか）',
  '・ご購入（入居）の希望時期',
  '・その他、居住人数、間取り、立地などのご希望条件',
].join('\n');

// 土地用のヒアリング項目（駐車場台数を除く）
const LAND_HEARING_ITEMS = [
  '・これまでに内覧した物件',
  '・ご予算（物件のみ／リフォーム金額込み）',
  '・現在のお住まい（持家戸建／持家マンション／賃貸／ほか）',
  '・ご購入（入居）の希望時期',
  '・その他、居住人数、間取り、立地などのご希望条件',
].join('\n');

// 内覧前の事前確認事項（内覧前ヒアリングで使用）
const PRE_VIEWING_QA_ITEMS = [
  '・ご購入のご希望時期：',
  '・ご希望のご予算：',
  '・ご希望の間取り：',
  '・ご希望の学校区：',
  '・他の不動産の内覧経験（有無）とその状況：',
  '・内覧にお越しいただく人数：',
  '・当日ご来場の車種・色：',
  '・住宅ローン事前審査の状況（未申込／申込中／承認済など）：',
  '・現在のお住まい（持家戸建／持家マンション／賃貸／ほか）：',
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
  suumoUrl,
  onNextCallDateUpdated,
  sentTemplateKeys,
}) => {
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const open = Boolean(anchorEl);

  // 指定テンプレートが送信済みか判定する（templateId または表示名で照合）
  const isTemplateSent = (templateId: string, templateName: string): boolean => {
    if (!sentTemplateKeys || sentTemplateKeys.size === 0) return false;
    return (
      sentTemplateKeys.has(`id:${templateId}`) ||
      sentTemplateKeys.has(`name:${normalizeTemplateName(templateName)}`)
    );
  };

  // SMSメニュー項目を描画する共通コンポーネント。
  // 送信済みなら背景をグレー化し「送信済み」バッジを付ける（売主リスト通話モードと同じ見た目）。
  const renderSmsMenuItem = (
    templateId: string,
    templateName: string,
    options?: { highlight?: boolean },
  ) => {
    const isSent = isTemplateSent(templateId, templateName);
    const highlight = options?.highlight;
    // 薄緑背景（①②③④の返信テンプレート）は送信済みで濃い緑にする
    const backgroundColor = highlight
      ? (isSent ? '#c8e6c9' : '#e8f5e9')
      : (isSent ? '#e0e0e0' : '#ffffff');
    const hoverColor = highlight
      ? (isSent ? '#a5d6a7' : '#c8e6c9')
      : (isSent ? '#d6d6d6' : 'action.hover');

    return (
      <MenuItem
        key={templateId}
        onClick={() => sendSms(templateId, templateName)}
        sx={{
          backgroundColor,
          '&:hover': { backgroundColor: hoverColor },
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, width: '100%' }}>
          <Typography variant="body2" sx={{ flex: 1 }}>
            {templateName}
          </Typography>
          {isSent && (
            <Chip
              label="送信済み"
              size="small"
              sx={{
                height: 20,
                fontSize: '0.68rem',
                fontWeight: 700,
                backgroundColor: '#757575',
                color: '#fff',
              }}
            />
          )}
        </Box>
      </MenuItem>
    );
  };

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
    // SMSの文字数を抑えるため、予約フォームURLには買主番号（entry.267319544）のみを付与する。
    // 住所プリフィル（entry.2056434590）はURLを約90〜100文字長くするため送らない（案A）。
    // フォーム側は買主番号から物件を特定できる。
    const viewingFormUrl = `${VIEWING_FORM_BASE}&entry.267319544=${buyerNumber}`;
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
    const companyShort = hasFI ? '㈱くじら不動産' : '㈱いふう';

    // SUUMO URL セクション（買付キャンセル後の案内で使用）
    const suumoSection = suumoUrl ? `\n${suumoUrl}` : '';

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
      message = `${name}様お世話になっております。${askEmailCompany}です。\n先ほどは${address}についてお問い合わせいただき、誠にありがとうございました。\n今後、ご希望条件に合う新着物件やおすすめ物件がございましたら、メールにてご紹介・配信させていただければと思っております。\n差し支えなければ、こちらのショートメールへご確認いただけるメールアドレスをご返信いただけますと幸いです。\nどうぞよろしくお願いいたします。`;
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
      message = `${name}様\n${companyName}の${staff}です。\n先日は${address}のお問い合わせをいただき、誠にありがとうございました。\nその後の物件探しのご状況について、一度お伺いできればと思いご連絡いたしました。\n\n①内覧希望\n②内覧希望だが日程調整中\n③この物件の内覧はしないが、未公開物件や新着物件の情報が欲しい\n④物件探しはしていない\n\n差し支えなければ、現在のご状況を番号だけでもご返信いただけますと幸いです。\nよろしくお願いいたします。${signature}`;
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
      message = `${name}様\n\nお世話になっております。${hasFI ? 'くじら不動産' : '㈱いふう'}です。\nその後、${address}の内覧のご日程はお決まりになりましたでしょうか？\nお決まりになりましたら、下記フォームよりご予約ください↓↓\n${viewingFormUrl}\n\nご不明な点がございましたら、お気軽にお問い合わせください。\nよろしくお願いいたします。${signature}`;
    } else if (templateId === 'followup_3month_unreachable') {
      // ★3か月後・不通メール（③の追客用）：物件探し状況伺い、次電日さらに3か月後
      message = `${name}様\n\nお世話になっております。${hasFI ? 'くじら不動産' : '㈱いふう'}です。\nその後、物件探しのご状況はいかがでしょうか？\nご希望条件に合った物件が出ましたらメールにてご案内いたしますので、気になる物件がございましたらお気軽にお問い合わせください。\n引き続きどうぞよろしくお願いいたします。${signature}`;
    } else if (templateId === 'house_mansion_no_viewing') {
      // 問合せ返信（戸・マ）内覧案内なし（業者は全てこちら）
      message = `${name}様\n\nこの度はお問い合わせありがとうございます。\n${companyIntro}\n\n所在地：${address}\n上記の物件のお問い合わせ、ありがとうございます。${preViewingSection}\n\nご不明な点等ございましたら、お気軽にお問い合わせください。\nそれでは、引き続きよろしくお願いいたします。${signature}`;
    } else if (templateId === 'offer_cancelled_available') {
      // 買付キャンセル後の案内メール（再度紹介可能）
      message = `${name}様\n\nお世話になっております。\n\n以前お問合せいただきました「${address}」につきまして、他のお客様の申し込みがキャンセルとなり、再度ご紹介できる状況となりましたのでご連絡いたしました。${suumoSection}\n\nご見学希望やお問合せ等ございましたらお気軽にご連絡くださいませ。\n内覧のご予約はこちらから↓↓\n${viewingFormUrl}${hasFI ? '' : `\n★大分市の新築建売専門サイト↓↓\nhttps://sateituikyaku-admin-frontend.vercel.app/tateuri`}\n\n★水曜日は定休日となっておりますのでそれ以外の日程でお願いいたします。${preViewingSection}${signature}`;
    } else if (templateId === 'offer_cancelled_reintro') {
      // 買付キャンセル後の案内メール（再紹介・詳細版）
      message = `${name}様\n\nお世話になっております。\n\n以前お問合せいただきました「${address}」につきまして、他のお客様の申し込みがキャンセルとなり、再度ご紹介できる状況となりましたのでご連絡いたしました。${suumoSection}\n\nご見学希望やお問合せ等ございましたらお気軽にご連絡くださいませ。\n\n内覧ご希望の方はこちらからお願いいたします。\n${viewingFormUrl}${hasFI ? '' : `\n\n★大分市の新築建売専門サイト↓↓\nhttps://sateituikyaku-admin-frontend.vercel.app/tateuri\n★非公開の情報はこちらから検索可能です↓↓\n${PUBLIC_SITE_URL}`}\n\n★水曜日は定休日となっておりますのでそれ以外の日程でお願いいたします。\n\n他にご不明な点等ございましたら、お気軽にお問い合わせください。\nまた、他社物件もご紹介できますので、気になる物件がございましたらお気軽にご連絡ください。${preViewingSection}${signature}`;
    } else if (templateId === 'purchase_campaign') {
      // 購入応援キャンペーン
      const staffName = senderName || '担当';
      message = `${name}様\n\nお世話になっております。${companyShort}の${staffName}です。\n先日は貴重な時間をいただき誠にありがとうございました。\nその後、不動産購入のご状況はいかがでしょうか？\n\n≪キャンペーン対象物件を内覧いただいたお客様限定≫\n《購入応援キャンペーン》\n仲介手数料から10万円をキャッシュバックいたします！\n●条件\n・初めての内覧から1年以内にご成約\n・購入価格が1500万円以上\n\n詳しくはスタッフにお問合せ下さい。\nご不明点や他に気になる物件などございましたら、どうぞお気軽にご連絡くださいませ。${signature}`;
    } else if (templateId === 'house_mansion_hearing') {
      // 問合せ返信（戸・マ）＋ヒアリング
      message = `${name}様\n\nこの度はお問い合わせありがとうございます。\n${companyIntro}\n\n所在地：${address}\n上記の物件のお問い合わせ、ありがとうございます。${preViewingSection}\n\nご不明な点等ございましたら、お気軽にお問い合わせください。\n内覧のご予約はこちらから↓↓\n${viewingFormUrl}\n\nまた、今後ご紹介する物件の参考に、お手すきの際に下記にお答えいただけますと幸いです。\n${INTRO_HEARING_ITEMS}\n\nそれでは、引き続きよろしくお願いいたします。${signature}`;
    } else if (templateId === 'land_hearing') {
      // 問合せ返信（土）＋ヒアリング
      message = `${name}様\n\nこの度はお問い合わせありがとうございます。\n${companyIntro}\n\n所在地：${address}\n上記の物件のお問い合わせ、ありがとうございます。${preViewingSection}\n\n現地確認につきましては、敷地外からはご自由に見ていただいて大丈夫です。\nご不明な点等ございましたら、お気軽にお問い合わせください。\n\nまた、今後ご紹介する物件の参考に、お手すきの際に下記にお答えいただけますと幸いです。\n${LAND_HEARING_ITEMS}\n\nそれでは、引き続きよろしくお願いいたします。${signature}`;
    } else if (templateId === 'buyer_hearing') {
      // 持家ヒアリング（物件問合せなし）
      message = `${name}様\n\nお世話になっております。${companyIntro}\nこの度は当社にお問い合わせ頂き誠にありがとうございました。\n\n今後、周辺エリアで物件をお探しでしたら、メールにて公開前・新着物件をご案内しておりますのでご利用ください。\n他社物件もご紹介できますので、気になる物件がございましたらお気軽にご連絡ください。\n\nまた、今後ご紹介する物件の参考に、お手すきの際に下記にお答えいただけますと幸いです。\n${INTRO_HEARING_ITEMS}\n\nそれでは、引き続きよろしくお願いいたします。${signature}`;
    } else if (templateId === 'pre_viewing_hearing') {
      // 内覧前ヒアリング（事前確認事項）
      message = `${name}様\n\nこのたびはお問い合わせいただき、誠にありがとうございます。\n${companyShort}でございます。\n\n内覧の日程が決まりましたので、ご案内をスムーズに進めるため、下記の項目について事前にお知らせいただけますと幸いです。そのままご記入のうえ、このメールにご返信ください。\n―――――――――――――――――――\n${PRE_VIEWING_QA_ITEMS}\n―――――――――――――――――――\n\nお手数をおかけいたしますが、ご確認のほどよろしくお願いします。\nそれでは当日お会いできるのを楽しみにしております。${signature}`;
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

  // 種別判定（「土」「土地」「land」いずれの表記でも土地と判定する）
  const isLand = isLandType(propertyType);

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
          renderSmsMenuItem('land_no_permission', '資料請求（土）許可不要'),
          renderSmsMenuItem('land_need_permission', '資料請求（土）売主要許可'),
          renderSmsMenuItem('land_hearing', '資料請求（土）＋ヒアリング'),
        ] : [
          renderSmsMenuItem('house_mansion', '資料請求（戸・マ）'),
          renderSmsMenuItem('house_mansion_no_viewing', '資料請求（戸・マ）内覧案内なし'),
          renderSmsMenuItem('house_mansion_hearing', '資料請求（戸・マ）＋ヒアリング'),
        ]}
        {/* 民泊問合せは全種別で表示 */}
        {renderSmsMenuItem('minpaku', '民泊問合せ')}
        {renderSmsMenuItem('buyer_hearing', '持家ヒアリング')}
        {renderSmsMenuItem('ask_email', 'メールアドレス確認')}
        {renderSmsMenuItem('offer_no_viewing', '買付あり内覧NG')}
        {renderSmsMenuItem('offer_ok_viewing', '買付あり内覧OK')}
        {renderSmsMenuItem('offer_cancelled_available', '買付キャンセル後の案内')}
        {renderSmsMenuItem('offer_cancelled_reintro', '買付キャンセル後の案内メール（再紹介）')}
        {renderSmsMenuItem('pre_viewing_hearing', '内覧前ヒアリング')}
        {renderSmsMenuItem('post_viewing_thanks', '内覧後御礼メール')}
        {renderSmsMenuItem('purchase_campaign', '購入応援キャンペーン')}
        {renderSmsMenuItem('no_response', '前回問合せ後反応なし')}
        {renderSmsMenuItem('no_response_offer', '反応なし（買付あり不適合）')}
        {renderSmsMenuItem('pinrich', '物件指定なし（Pinrich）')}
        {renderSmsMenuItem('empty_greeting', '空')}
        <Divider />
        {/* 状況確認SMS（①②③④の番号返信を促す） */}
        {renderSmsMenuItem('status_check', '状況確認SMS（①②③④）')}
        {/* ①②③④の返信テンプレート（薄緑背景・次電日自動セット） */}
        {renderSmsMenuItem('reply_1_viewing', '①内覧希望の返信', { highlight: true })}
        {renderSmsMenuItem('reply_2_scheduling', '②日程調整中の返信（次電日+1ヶ月）', { highlight: true })}
        {renderSmsMenuItem('reply_3_info_only', '③情報希望の返信（次電日+3ヶ月）', { highlight: true })}
        {renderSmsMenuItem('reply_4_not_searching', '④物件探しなしの返信', { highlight: true })}
        <Divider />
        {/* 不通時の追客メール（手動送信・次電日を再セット） */}
        {renderSmsMenuItem('followup_1month_unreachable', '★1ヶ月後不通メール（次電日+1ヶ月）')}
        {renderSmsMenuItem('followup_3month_unreachable', '★3ヶ月後不通メール（次電日+3ヶ月）')}
      </Menu>
    </>
  );
};
