import { replacePlaceholders } from '../smsTemplateGenerators';
import { Seller } from '../../types';

describe('replacePlaceholders', () => {
  describe('売主番号に「FI」が含まれる場合（福岡支店）', () => {
    it('<<当社住所>>を福岡支店の住所に置き換える', () => {
      const seller: Partial<Seller> = { sellerNumber: 'FI12345' };
      const message = '<<当社住所>>です。';
      const result = replacePlaceholders(message, seller as Seller);
      expect(result).toBe('福岡市中央区舞鶴３丁目１－１０です。');
    });

    it('<<売買実績ｖ>>を空文字列に置き換える（全角v）', () => {
      const seller: Partial<Seller> = { sellerNumber: 'FI12345' };
      const message = '<<売買実績ｖ>>';
      const result = replacePlaceholders(message, seller as Seller);
      expect(result).toBe('');
    });

    it('<<売買実績v>>を空文字列に置き換える（半角v）', () => {
      const seller: Partial<Seller> = { sellerNumber: 'FI12345' };
      const message = '<<売買実績v>>';
      const result = replacePlaceholders(message, seller as Seller);
      expect(result).toBe('');
    });

    it('大文字・小文字を区別しない（fi）', () => {
      const seller: Partial<Seller> = { sellerNumber: 'fi12345' };
      const message = '<<当社住所>>です。';
      const result = replacePlaceholders(message, seller as Seller);
      expect(result).toBe('福岡市中央区舞鶴３丁目１－１０です。');
    });

    it('大文字・小文字を区別しない（Fi）', () => {
      const seller: Partial<Seller> = { sellerNumber: 'Fi12345' };
      const message = '<<当社住所>>です。';
      const result = replacePlaceholders(message, seller as Seller);
      expect(result).toBe('福岡市中央区舞鶴３丁目１－１０です。');
    });

    it('大文字・小文字を区別しない（fI）', () => {
      const seller: Partial<Seller> = { sellerNumber: 'fI12345' };
      const message = '<<当社住所>>です。';
      const result = replacePlaceholders(message, seller as Seller);
      expect(result).toBe('福岡市中央区舞鶴３丁目１－１０です。');
    });

    it('複数のプレースホルダーを同時に置き換える', () => {
      const seller: Partial<Seller> = { sellerNumber: 'FI12345' };
      const message = '<<当社住所>>です。<<売買実績ｖ>>';
      const result = replacePlaceholders(message, seller as Seller);
      expect(result).toBe('福岡市中央区舞鶴３丁目１－１０です。');
    });
  });

  describe('売主番号に「FI」が含まれない場合（大分本社）', () => {
    it('<<当社住所>>を大分本社の住所に置き換える', () => {
      const seller: Partial<Seller> = { sellerNumber: 'AA13501' };
      const message = '<<当社住所>>です。';
      const result = replacePlaceholders(message, seller as Seller);
      expect(result).toBe('大分市舞鶴町1-3-30STビル１Fです。');
    });

    it('<<売買実績ｖ>>を売買実績URLに置き換える（全角v）', () => {
      const seller: Partial<Seller> = { sellerNumber: 'AA13501' };
      const message = '<<売買実績ｖ>>';
      const result = replacePlaceholders(message, seller as Seller);
      expect(result).toBe('売買実績はこちら：https://property-site-frontend-kappa.vercel.app/public/properties?view=map');
    });

    it('<<売買実績v>>を売買実績URLに置き換える（半角v）', () => {
      const seller: Partial<Seller> = { sellerNumber: 'AA13501' };
      const message = '<<売買実績v>>';
      const result = replacePlaceholders(message, seller as Seller);
      expect(result).toBe('売買実績はこちら：https://property-site-frontend-kappa.vercel.app/public/properties?view=map');
    });

    it('複数のプレースホルダーを同時に置き換える', () => {
      const seller: Partial<Seller> = { sellerNumber: 'AA13501' };
      const message = '<<当社住所>>です。<<売買実績ｖ>>';
      const result = replacePlaceholders(message, seller as Seller);
      expect(result).toBe('大分市舞鶴町1-3-30STビル１Fです。売買実績はこちら：https://property-site-frontend-kappa.vercel.app/public/properties?view=map');
    });
  });

  describe('エラーハンドリング（デフォルト値）', () => {
    it('売主番号がnullの場合、デフォルト値（大分本社）を使用', () => {
      const seller: Partial<Seller> = { sellerNumber: null as any };
      const message = '<<当社住所>>です。<<売買実績ｖ>>';
      const result = replacePlaceholders(message, seller as Seller);
      expect(result).toBe('大分市舞鶴町1-3-30STビル１Fです。売買実績はこちら：https://property-site-frontend-kappa.vercel.app/public/properties?view=map');
    });

    it('売主番号がundefinedの場合、デフォルト値（大分本社）を使用', () => {
      const seller: Partial<Seller> = { sellerNumber: undefined };
      const message = '<<当社住所>>です。<<売買実績ｖ>>';
      const result = replacePlaceholders(message, seller as Seller);
      expect(result).toBe('大分市舞鶴町1-3-30STビル１Fです。売買実績はこちら：https://property-site-frontend-kappa.vercel.app/public/properties?view=map');
    });

    it('売主番号が空文字列の場合、デフォルト値（大分本社）を使用', () => {
      const seller: Partial<Seller> = { sellerNumber: '' };
      const message = '<<当社住所>>です。<<売買実績ｖ>>';
      const result = replacePlaceholders(message, seller as Seller);
      expect(result).toBe('大分市舞鶴町1-3-30STビル１Fです。売買実績はこちら：https://property-site-frontend-kappa.vercel.app/public/properties?view=map');
    });

    it('売主番号が空白文字列の場合、デフォルト値（大分本社）を使用', () => {
      const seller: Partial<Seller> = { sellerNumber: '   ' };
      const message = '<<当社住所>>です。<<売買実績ｖ>>';
      const result = replacePlaceholders(message, seller as Seller);
      expect(result).toBe('大分市舞鶴町1-3-30STビル１Fです。売買実績はこちら：https://property-site-frontend-kappa.vercel.app/public/properties?view=map');
    });

    it('売主オブジェクトがnullの場合、デフォルト値（大分本社）を使用', () => {
      const message = '<<当社住所>>です。<<売買実績ｖ>>';
      const result = replacePlaceholders(message, null as any);
      expect(result).toBe('大分市舞鶴町1-3-30STビル１Fです。売買実績はこちら：https://property-site-frontend-kappa.vercel.app/public/properties?view=map');
    });
  });

  describe('[改行]プレースホルダーの保持', () => {
    it('[改行]プレースホルダーがそのまま保持される', () => {
      const seller: Partial<Seller> = { sellerNumber: 'AA13501' };
      const message = '<<当社住所>>です。[改行]よろしくお願いします。';
      const result = replacePlaceholders(message, seller as Seller);
      expect(result).toBe('大分市舞鶴町1-3-30STビル１Fです。[改行]よろしくお願いします。');
    });

    it('複数の[改行]プレースホルダーがそのまま保持される', () => {
      const seller: Partial<Seller> = { sellerNumber: 'AA13501' };
      const message = '<<当社住所>>です。[改行][改行]よろしくお願いします。';
      const result = replacePlaceholders(message, seller as Seller);
      expect(result).toBe('大分市舞鶴町1-3-30STビル１Fです。[改行][改行]よろしくお願いします。');
    });
  });

  describe('未知のプレースホルダー', () => {
    it('未知のプレースホルダーがそのまま残る', () => {
      const seller: Partial<Seller> = { sellerNumber: 'AA13501' };
      const message = '<<当社住所>>です。<<未知のプレースホルダー>>';
      const result = replacePlaceholders(message, seller as Seller);
      expect(result).toBe('大分市舞鶴町1-3-30STビル１Fです。<<未知のプレースホルダー>>');
    });
  });

  describe('プレースホルダーが含まれないメッセージ', () => {
    it('プレースホルダーが含まれない場合、メッセージが変更されない', () => {
      const seller: Partial<Seller> = { sellerNumber: 'AA13501' };
      const message = 'こんにちは。よろしくお願いします。';
      const result = replacePlaceholders(message, seller as Seller);
      expect(result).toBe('こんにちは。よろしくお願いします。');
    });
  });

  describe('同じプレースホルダーが複数回出現する場合', () => {
    it('全ての<<当社住所>>が置き換えられる', () => {
      const seller: Partial<Seller> = { sellerNumber: 'AA13501' };
      const message = '<<当社住所>>です。<<当社住所>>までお越しください。';
      const result = replacePlaceholders(message, seller as Seller);
      expect(result).toBe('大分市舞鶴町1-3-30STビル１Fです。大分市舞鶴町1-3-30STビル１Fまでお越しください。');
    });

    it('全ての<<売買実績ｖ>>が置き換えられる', () => {
      const seller: Partial<Seller> = { sellerNumber: 'AA13501' };
      const message = '<<売買実績ｖ>>をご覧ください。<<売買実績ｖ>>';
      const result = replacePlaceholders(message, seller as Seller);
      expect(result).toBe('売買実績はこちら：https://property-site-frontend-kappa.vercel.app/public/properties?view=mapをご覧ください。売買実績はこちら：https://property-site-frontend-kappa.vercel.app/public/properties?view=map');
    });
  });

  describe('FI番号による「大分市舞鶴町にございます」文言変換', () => {
    it('FI番号の場合、「大分市舞鶴町にございます」が「福岡市中央区舞鶴にございます」に変換される', () => {
      const seller: Partial<Seller> = { sellerNumber: 'FI12345' };
      const message = 'お世話になっております。大分市舞鶴町にございます不動産会社のいふうです。';
      const result = replacePlaceholders(message, seller as Seller);
      expect(result).toBe('お世話になっております。福岡市中央区舞鶴にございます不動産会社のいふうです。');
    });

    it('大文字・小文字を区別しない（fi）', () => {
      const seller: Partial<Seller> = { sellerNumber: 'fi12345' };
      const message = '大分市舞鶴町にございます不動産会社のいふうです。';
      const result = replacePlaceholders(message, seller as Seller);
      expect(result).toBe('福岡市中央区舞鶴にございます不動産会社のいふうです。');
    });

    it('大文字・小文字を区別しない（Fi）', () => {
      const seller: Partial<Seller> = { sellerNumber: 'Fi12345' };
      const message = '大分市舞鶴町にございます不動産会社のいふうです。';
      const result = replacePlaceholders(message, seller as Seller);
      expect(result).toBe('福岡市中央区舞鶴にございます不動産会社のいふうです。');
    });

    it('大文字・小文字を区別しない（fI）', () => {
      const seller: Partial<Seller> = { sellerNumber: 'fI12345' };
      const message = '大分市舞鶴町にございます不動産会社のいふうです。';
      const result = replacePlaceholders(message, seller as Seller);
      expect(result).toBe('福岡市中央区舞鶴にございます不動産会社のいふうです。');
    });

    it('複数箇所が全て変換される', () => {
      const seller: Partial<Seller> = { sellerNumber: 'FI12345' };
      const message = '大分市舞鶴町にございます会社です。[改行]大分市舞鶴町にございます不動産会社のいふうです。';
      const result = replacePlaceholders(message, seller as Seller);
      expect(result).toBe('福岡市中央区舞鶴にございます会社です。[改行]福岡市中央区舞鶴にございます不動産会社のいふうです。');
    });

    it('非FI番号の場合、「大分市舞鶴町にございます」は変換されない', () => {
      const seller: Partial<Seller> = { sellerNumber: 'AA13501' };
      const message = '大分市舞鶴町にございます不動産会社のいふうです。';
      const result = replacePlaceholders(message, seller as Seller);
      expect(result).toBe('大分市舞鶴町にございます不動産会社のいふうです。');
    });

    it('売主番号がnullの場合、「大分市舞鶴町にございます」は変換されない', () => {
      const seller: Partial<Seller> = { sellerNumber: null as any };
      const message = '大分市舞鶴町にございます不動産会社のいふうです。';
      const result = replacePlaceholders(message, seller as Seller);
      expect(result).toBe('大分市舞鶴町にございます不動産会社のいふうです。');
    });

    it('売主番号がundefinedの場合、「大分市舞鶴町にございます」は変換されない', () => {
      const seller: Partial<Seller> = { sellerNumber: undefined };
      const message = '大分市舞鶴町にございます不動産会社のいふうです。';
      const result = replacePlaceholders(message, seller as Seller);
      expect(result).toBe('大分市舞鶴町にございます不動産会社のいふうです。');
    });

    it('売主番号が空文字列の場合、「大分市舞鶴町にございます」は変換されない', () => {
      const seller: Partial<Seller> = { sellerNumber: '' };
      const message = '大分市舞鶴町にございます不動産会社のいふうです。';
      const result = replacePlaceholders(message, seller as Seller);
      expect(result).toBe('大分市舞鶴町にございます不動産会社のいふうです。');
    });

    it('「大分市舞鶴町1丁目3-30」などの住所表記は変換されない', () => {
      const seller: Partial<Seller> = { sellerNumber: 'FI12345' };
      const message = '大分市舞鶴町1丁目3-30にある物件です。';
      const result = replacePlaceholders(message, seller as Seller);
      expect(result).toBe('大分市舞鶴町1丁目3-30にある物件です。');
    });

    it('「大分市舞鶴町1-3-30」の住所表記は変換されない', () => {
      const seller: Partial<Seller> = { sellerNumber: 'FI12345' };
      const message = '大分市舞鶴町1-3-30 STビル１Fです。';
      const result = replacePlaceholders(message, seller as Seller);
      expect(result).toBe('大分市舞鶴町1-3-30 STビル１Fです。');
    });

    it('<<当社住所>>置換と文言変換が同時に正しく動作する', () => {
      const seller: Partial<Seller> = { sellerNumber: 'FI12345' };
      const message = '大分市舞鶴町にございます不動産会社のいふうです。[改行]<<当社住所>>までお越しください。';
      const result = replacePlaceholders(message, seller as Seller);
      expect(result).toBe('福岡市中央区舞鶴にございます不動産会社のいふうです。[改行]福岡市中央区舞鶴３丁目１－１０までお越しください。');
    });
  });
});
