import React, { useState } from 'react';
import {
  Button,
  Menu,
  MenuItem,
  ButtonGroup,
} from '@mui/material';
import SmsIcon from '@mui/icons-material/Sms';
import ArrowDropDownIcon from '@mui/icons-material/ArrowDropDown';

interface SmsDropdownButtonProps {
  phoneNumber: string;
  buyerName: string;
  buyerNumber: string;
  propertyAddress: string;
  propertyType: string;
}

const VIEWING_FORM_BASE = 'https://docs.google.com/forms/d/e/1FAIpQLSefXwsYKryraVM4jtnLgcYtboUg3w-lx7tasftVA47E5jXUlQ/viewform?usp=pp_url';
const PUBLIC_SITE_URL = 'https://property-site-frontend-kappa.vercel.app/public/properties';

export const SmsDropdownButton: React.FC<SmsDropdownButtonProps> = ({
  phoneNumber,
  buyerName,
  buyerNumber,
  propertyAddress,
  propertyType,
}) => {
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const open = Boolean(anchorEl);

  const handleOpen = (e: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(e.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  const sendSms = (templateId: string) => {
    handleClose();
    const name = buyerName || 'お客様';
    const address = propertyAddress;
    const viewingFormUrl = `${VIEWING_FORM_BASE}&entry.267319544=${buyerNumber}&entry.2056434590=${encodeURIComponent(address)}`;
    let message = '';

    if (templateId === 'land_no_permission') {
      message = `${name}様\n\nこの度はお問い合わせありがとうございます。\n株式会社いふうと申します。\n\n所在地：${address}\n上記の物件のお問い合わせ、ありがとうございます。\n現地確認につきましては、敷地外からはご自由に見ていただいて大丈夫です。\n所在地：${address}\n★非公開の物件はこちらから↓↓\n${PUBLIC_SITE_URL}\nご不明な点等ございましたら、お気軽にお問い合わせください。\n\nまた、他社物件もご紹介できますので、気になる物件がございましたらお気軽にご連絡ください。\n\n株式会社 いふう\nTEL：097-533-2022`;
    } else if (templateId === 'minpaku') {
      message = `${name}様\n\nこの度はお問い合わせありがとうございます。\n株式会社いふうと申します。\n\n所在地：${address}\n上記の物件のお問い合わせ、ありがとうございます。\n民泊につきましては、民泊新法（営業180日以内）であればどの用途地域でも民泊が可能です。保健所に届け出をする際に「近隣住民に説明したか」が必須の項目になりますので、反対が出た場合は難しい可能性もあります。\nご不明な点等ございましたら、東部保健所（0977-67-2511）へお問い合わせください。\n\nまた、ご内覧希望の場合は、こちらからご予約お願いいたします↓↓\n${viewingFormUrl}\n\n★お急ぎで内覧をご希望の方は、直接お電話にてお申込みも承っております！\nお気軽にお問い合わせください。\n\nまた、他社物件もご紹介できますので、気になる物件がございましたらお気軽にご連絡ください。\n\n株式会社 いふう\nTEL：097-533-2022`;
    } else if (templateId === 'land_need_permission') {
      message = `${name}様\n\nこの度はお問い合わせありがとうございます。\n株式会社いふうと申します。\n\n所在地：${address}\n上記の物件のお問い合わせ、ありがとうございます。\n現地確認につきましては、当社で売主様へ許可を取った後に、敷地外からはご自由に見ていただくことになります。\nそこで、現地に行かれる日程が決まりましたら下記より日程をご予約いただければと思います\n\n所在地：${address}\n\n${viewingFormUrl}\n\n★非公開の物件はこちらから↓↓\n${PUBLIC_SITE_URL}\nご不明な点等ございましたら、お気軽にお問い合わせください。\n\nまた、他社物件もご紹介できますので、気になる物件がございましたらお気軽にご連絡くださいませ。\n\n株式会社 いふう\nTEL：097-533-2022`;
    } else if (templateId === 'offer_no_viewing') {
      message = `${name}様\n\nこの度はお問い合わせありがとうございます。\n株式会社いふうと申します。\n\n所在地：${address}\n\n大変申し訳ございませんが、こちらの物件は他のお客様より只今申込みをいただいております。\n万が一契約まで至らなかった場合、ご連絡さしあげるという形でよろしいでしょうか？\n\n他に気になる物件がございましたら、他社の物件でもご紹介可能ですので、お気軽にお問い合わせくださいませ。\n★非公開の物件はこちらから↓↓\n${PUBLIC_SITE_URL}\n\n株式会社 いふう\nTEL：097-533-2022`;
    } else if (templateId === 'offer_ok_viewing') {
      message = `${name}様\n\nこの度はお問い合わせありがとうございます。\n株式会社いふうと申します。\n\n所在地：${address}\n\n大変申し訳ございませんが、こちらの物件は他のお客様より只今申込みをいただいております。\nその方が契約に至らない場合もございますので、随時、内覧は可能です。（申込みを頂いた場合は２番手以降となります）\n上記をご承知の上、内覧をご希望される場合は、下記ご入力後返信いただくか、お電話で直接受け付けます。\n内覧のご予約はこちらから↓↓\n${viewingFormUrl}\n\n★非公開の物件はこちらから↓↓\n${PUBLIC_SITE_URL}\n\n周辺エリアで物件をお探しでしたら、メールにて公開前・新着物件をご案内しておりますのでご利用ください。\nまた、他社物件もご紹介できますので、気になる物件がございましたらお気軽にご連絡ください。\n\n株式会社 いふう\nTEL：097-533-2022`;
    } else if (templateId === 'no_response') {
      message = `${name}様\n\n先日は${address}のお問い合わせを頂き誠にありがとうございました。\nその後物件探しのご状況はいかがでしょうか？\nまだ物件をお探しであれば是非いふうにてお手伝い出来ればと存じますのでお気軽にお申し付け下さい。\n以前お問合せ頂いた物件に関しまして、ご内覧希望日時を記載してご返信頂きましたら直ぐにご確認可能でございます。\n是非一度ご案内させて頂ければ幸いです\n\n内覧のご予約はこちらから↓↓\n${viewingFormUrl}\n\n既に当社で別の物件を内覧予定、済でしたら申し訳ございません、本メールは無視してください。\n気になる物件がございましたら他社様の物件もご内覧可能です。\n★非公開の物件はこちらから↓↓\n${PUBLIC_SITE_URL}\n引き続き宜しくお願い致します。\n\n株式会社 いふう\nTEL：097-533-2022`;
    } else if (templateId === 'no_response_offer') {
      message = `${name}様\n\n先日は${address}のお問い合わせを頂き誠にありがとうございました。\n物件案内がご要望に添えず、大変申し訳ございませんでした。\nその後物件探しのご状況はいかがでしょうか？\nまだ物件をお探しであれば是非いふうにてお手伝い出来ればと存じますのでお気軽にお申し付け下さい。\n\n他に気になる物件がございましたら他社様の物件もご内覧可能です。\n★非公開の物件はこちらから↓↓\n${PUBLIC_SITE_URL}\n引き続き宜しくお願い致します。\n\n株式会社 いふう\nTEL：097-533-2022`;
    } else if (templateId === 'pinrich') {
      message = `${name}様\n先日は、ご登録いただきましてありがとうございました！その後物件探しのご状況はいかがでしょうか？\nまだ物件をお探しであれば是非いふうにてお手伝い出来ればと存じますのでお気軽にお申し付け下さい。\n\n他に気になる物件がございましたら他社様の物件もご内覧可能です。\n★非公開の物件はこちらから↓↓\n${PUBLIC_SITE_URL}\n引き続き宜しくお願い致します。\n\n株式会社 いふう\nTEL：097-533-2022`;
    } else if (templateId === 'house_mansion') {
      message = `${name}様\n\nこの度はお問い合わせありがとうございます。\n株式会社いふうと申します。\n\n所在地：${address}\n上記の物件のお問い合わせ、ありがとうございます。\nご不明な点等ございましたら、お気軽にお問い合わせください。\n\nまた、ご内覧希望の場合は、こちらからご予約お願いいたします↓↓\n${viewingFormUrl}\n\n★非公開の物件はこちらから↓↓\n${PUBLIC_SITE_URL}\nお気軽にお問い合わせください。\n\nまた、他社物件もご紹介できますので、気になる物件がございましたらお気軽にご連絡ください。\n\n株式会社 いふう\nTEL：097-533-2022`;
    }

    if (message) {
      const smsLink = `sms:${phoneNumber}?body=${encodeURIComponent(message)}`;
      window.location.href = smsLink;
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
            backgroundColor: '#90a4ae',
            color: '#fff',
            '&:hover': {
              backgroundColor: '#78909c',
            },
          },
          '& .MuiButtonGroup-grouped': {
            borderColor: '#78909c !important',
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
          <MenuItem key="land_no_permission" onClick={() => sendSms('land_no_permission')}>資料請求（土）許可不要</MenuItem>,
          <MenuItem key="minpaku" onClick={() => sendSms('minpaku')}>民泊問合せ</MenuItem>,
          <MenuItem key="land_need_permission" onClick={() => sendSms('land_need_permission')}>資料請求（土）売主要許可</MenuItem>,
        ] : [
          <MenuItem key="house_mansion" onClick={() => sendSms('house_mansion')}>資料請求（戸・マ）</MenuItem>,
        ]}
        <MenuItem onClick={() => sendSms('offer_no_viewing')}>買付あり内覧NG</MenuItem>
        <MenuItem onClick={() => sendSms('offer_ok_viewing')}>買付あり内覧OK</MenuItem>
        <MenuItem onClick={() => sendSms('no_response')}>前回問合せ後反応なし</MenuItem>
        <MenuItem onClick={() => sendSms('no_response_offer')}>反応なし（買付あり不適合）</MenuItem>
        <MenuItem onClick={() => sendSms('pinrich')}>物件指定なし（Pinrich）</MenuItem>
      </Menu>
    </>
  );
};
