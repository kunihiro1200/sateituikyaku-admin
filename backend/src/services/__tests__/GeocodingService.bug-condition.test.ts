/**
 * バグ条件探索テスト - FIプレフィックス売主の住所に「大分県」が誤付加される
 *
 * **Feature: seller-callmode-fi17-position-bug, Property 1: Bug Condition**
 * **Validates: Requirements 1.1**
 *
 * ⚠️ CRITICAL: このテストは未修正コードで FAIL することが期待される（バグの存在を確認）
 * DO NOT attempt to fix the test or the code when it fails.
 * GOAL: バグが存在することを示す反例（counterexample）を見つける
 *
 * バグの根本原因:
 * GeocodingService.geocodeAddress() は sellerPrefix を受け取らず、
 * 住所に「大分県」が含まれていない場合は無条件に「大分県」を先頭に付加する。
 * FIプレフィックスの売主（福岡支店）の住所は福岡県内のため「大分県」を含まない
 * → 誤って「大分県」が付加され、大分県内の誤った座標が返される。
 *
 * Bug Condition:
 *   input.sellerPrefix NOT IN ['AA']
 *   AND NOT input.address.includes('大分県')
 *   AND geocodeAddress() ADDS '大分県' to input.address
 *
 * Expected Behavior（修正後）:
 *   FIプレフィックスの場合、「大分県」を付加せず元の住所のままジオコーディングを実行する
 */

import axios from 'axios';

// axios をモック化（実際のGoogle Maps APIを呼び出さない）
jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

// テスト対象のサービスをインポート
import { GeocodingService } from '../GeocodingService';

// テスト用のダミー座標（福岡市中央区天神付近）
const FUKUOKA_TENJIN_COORDS = {
  lat: 33.5904,
  lng: 130.4017,
};

// テスト用のダミー座標（北九州市小倉北区付近）
const KITAKYUSHU_KOKURA_COORDS = {
  lat: 33.8834,
  lng: 130.8752,
};

/**
 * Google Geocoding API のモックレスポンスを生成する
 */
function createMockGeocodingResponse(lat: number, lng: number, formattedAddress: string) {
  return {
    data: {
      status: 'OK',
      results: [
        {
          geometry: {
            location: { lat, lng },
          },
          formatted_address: formattedAddress,
        },
      ],
    },
  };
}

describe('Property 1: Bug Condition - FIプレフィックス売主の住所に「大分県」が誤付加される', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // GOOGLE_MAPS_API_KEY を設定（GeocodingService のコンストラクタが必要とする）
    process.env.GOOGLE_MAPS_API_KEY = 'test-api-key';
  });

  afterEach(() => {
    delete process.env.GOOGLE_MAPS_API_KEY;
  });

  /**
   * テスト1: FI17売主の福岡市住所に「大分県」が付加されないことを確認
   *
   * ⚠️ 未修正コードでは「大分県福岡市中央区天神1-1-1」としてAPIが呼ばれるため FAIL する
   * ✅ 修正後は「福岡市中央区天神1-1-1」のままAPIが呼ばれるため PASS する
   *
   * **Validates: Requirements 1.1**
   */
  it('テスト1: geocodeAddress("福岡市中央区天神1-1-1") が「大分県」を付加せずAPIを呼ぶ（未修正コードでは FAIL）', async () => {
    const address = '福岡市中央区天神1-1-1';

    // axios.get が成功レスポンスを返すようにモック
    mockedAxios.get.mockResolvedValue(
      createMockGeocodingResponse(
        FUKUOKA_TENJIN_COORDS.lat,
        FUKUOKA_TENJIN_COORDS.lng,
        '日本、〒810-0001 福岡県福岡市中央区天神1丁目1−1'
      )
    );

    const service = new GeocodingService();
    // FIプレフィックスを渡してジオコーディング（修正後の正しい呼び出し方）
    await service.geocodeAddress(address, 'FI');

    // axios.get が呼ばれたことを確認
    expect(mockedAxios.get).toHaveBeenCalled();

    const calledParams = mockedAxios.get.mock.calls[0][1]?.params;
    const calledAddress = calledParams?.address;

    console.log('axios.get に渡されたaddress:', calledAddress);
    console.log('期待値（大分県なし）:', address);

    // ✅ 修正後に PASS するアサーション
    expect(calledAddress).toBe(address);
    expect(calledAddress).not.toContain('大分県');
  });

  /**
   * テスト2: FI17売主の北九州市住所に「大分県」が付加されないことを確認
   *
   * ⚠️ 未修正コードでは「大分県北九州市小倉北区魚町1-1-1」としてAPIが呼ばれるため FAIL する
   * ✅ 修正後は「北九州市小倉北区魚町1-1-1」のままAPIが呼ばれるため PASS する
   *
   * **Validates: Requirements 1.1**
   */
  it('テスト2: geocodeAddress("北九州市小倉北区魚町1-1-1") が「大分県」を付加せずAPIを呼ぶ（未修正コードでは FAIL）', async () => {
    const address = '北九州市小倉北区魚町1-1-1';

    mockedAxios.get.mockResolvedValue(
      createMockGeocodingResponse(
        KITAKYUSHU_KOKURA_COORDS.lat,
        KITAKYUSHU_KOKURA_COORDS.lng,
        '日本、〒803-0812 福岡県北九州市小倉北区魚町1丁目1−1'
      )
    );

    const service = new GeocodingService();
    // FIプレフィックスを渡してジオコーディング（修正後の正しい呼び出し方）
    await service.geocodeAddress(address, 'FI');

    expect(mockedAxios.get).toHaveBeenCalled();

    const calledParams = mockedAxios.get.mock.calls[0][1]?.params;
    const calledAddress = calledParams?.address;

    console.log('axios.get に渡されたaddress:', calledAddress);
    console.log('期待値（大分県なし）:', address);

    // ✅ 修正後に PASS するアサーション
    expect(calledAddress).toBe(address);
    expect(calledAddress).not.toContain('大分県');
  });

  /**
   * テスト3: バグの存在を「逆から」証明する
   * 未修正コードでは「大分県」が付加されることを確認する（PASS する）
   * 修正後はこのテストが FAIL する（「大分県」が付加されなくなるため）
   *
   * このテストは修正後にスキップする。
   *
   * **Validates: Requirements 1.1**
   */
  it.skip('テスト3（バグ証明・修正後はスキップ）: 未修正コードでは「大分県」が付加されることを確認', async () => {
    const address = '福岡市中央区天神1-1-1';

    mockedAxios.get.mockResolvedValue(
      createMockGeocodingResponse(
        FUKUOKA_TENJIN_COORDS.lat,
        FUKUOKA_TENJIN_COORDS.lng,
        '日本、〒810-0001 福岡県福岡市中央区天神1丁目1−1'
      )
    );

    const service = new GeocodingService();
    await service.geocodeAddress(address);

    const calledParams = mockedAxios.get.mock.calls[0][1]?.params;
    const calledAddress = calledParams?.address;

    console.log('バグ確認: 「大分県」が付加されているか?', calledAddress?.startsWith('大分県'));
    console.log('実際に渡されたaddress:', calledAddress);

    // バグの存在を証明: 未修正コードでは「大分県」が付加される
    // このアサーションは未修正コードで PASS する（バグの存在を確認）
    // 修正後は FAIL する（「大分県」が付加されなくなるため）
    expect(calledAddress).toBe(`大分県${address}`);
  });

  /**
   * テスト4: 「大分県」を含む住所は重複付加されないことを確認（修正前後ともに正常）
   *
   * これはバグ条件に該当しない（住所に既に「大分県」が含まれている）ため、
   * 修正前後ともに PASS する。
   *
   * **Validates: Requirements 1.1**
   */
  it('テスト4: 「大分県」を含む住所は重複付加されない（修正前後ともに PASS）', async () => {
    const address = '大分県大分市府内町1-1-1';

    mockedAxios.get.mockResolvedValue(
      createMockGeocodingResponse(
        33.2382,
        131.6126,
        '日本、〒870-0021 大分県大分市府内町1丁目1−1'
      )
    );

    const service = new GeocodingService();
    await service.geocodeAddress(address);

    const calledParams = mockedAxios.get.mock.calls[0][1]?.params;
    const calledAddress = calledParams?.address;

    console.log('axios.get に渡されたaddress:', calledAddress);

    // 「大分県」が重複付加されていないことを確認
    expect(calledAddress).toBe(address);
    expect(calledAddress).not.toBe(`大分県${address}`);
  });
});
