#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
CallModePage.tsx のパフォーマンス改善:
1. validateSenderAddress を静的インポートに変更（動的インポート削除）
2. loadAllData の Promise.all から /api/employees を削除し getActiveEmployees() に統一
3. propertyData の追加フェッチを Promise.all に組み込む（直列→並列）
4. fetchActiveInitials useEffect を削除（initializeSenderAddress と重複）
"""

with open('frontend/frontend/src/pages/CallModePage.tsx', 'rb') as f:
    content = f.read()

text = content.decode('utf-8')

# -----------------------------------------------------------------------
# 修正1: validateSenderAddress を静的インポートに追加
# -----------------------------------------------------------------------
old_import = "import { getSenderAddress, saveSenderAddress } from '../utils/senderAddressStorage';"
new_import = "import { getSenderAddress, saveSenderAddress, validateSenderAddress } from '../utils/senderAddressStorage';"
text = text.replace(old_import, new_import, 1)

# -----------------------------------------------------------------------
# 修正2: 動的インポートを削除
# -----------------------------------------------------------------------
old_dynamic = """        // 保存されたアドレスが有効かどうかを検証
        const { validateSenderAddress } = await import('../utils/senderAddressStorage');
        const validatedAddress = validateSenderAddress(savedAddress, validEmails);"""
new_dynamic = """        // 保存されたアドレスが有効かどうかを検証
        const validatedAddress = validateSenderAddress(savedAddress, validEmails);"""
text = text.replace(old_dynamic, new_dynamic, 1)

# -----------------------------------------------------------------------
# 修正3: loadAllData の Promise.all を改善
#   - /api/employees を削除し getActiveEmployees() に統一
#   - propertyData の追加フェッチを並列化
# -----------------------------------------------------------------------
old_load = """      // 並列で全データを取得（AI要約以外）
      const [sellerResponse, activitiesResponse, employeesResponse] = await Promise.all([
        api.get(`/api/sellers/${id}`),
        api.get(`/api/sellers/${id}/activities`),
        api.get('/api/employees'),
      ]);



      // スタッフ一覧を設定
      setEmployees(employeesResponse.data);

      // 売主情報を設定
      const sellerData = sellerResponse.data;
      console.log('=== sellerData詳細 ===');
      console.log('sellerData:', sellerData);
      console.log('sellerData.propertyAddress:', sellerData.propertyAddress); // ← 追加
      console.log('sellerData.property:', sellerData.property);
      console.log('typeof sellerData.property:', typeof sellerData.property);
      console.log('sellerData.property === null:', sellerData.property === null);
      console.log('sellerData.property === undefined:', sellerData.property === undefined);
      
      // 売主データが存在することを確認
      if (!sellerData || !sellerData.id) {
        throw new Error('売主データが取得できませんでした');
      }
      
      setSeller(sellerData);
      setUnreachableStatus(sellerData.unreachableStatus || null);

      // 反響URLを非同期で取得（エラーでも続行）
      api.get(`/api/sellers/${id}/inquiry-url`).then(r => {
        setInquiryUrl(r.data.inquiryUrl || null);
      }).catch(() => {
        setInquiryUrl(null);
      });
      
      // 物件データを設定（sellerDataに含まれていない場合は別途取得）
      let propertyData = sellerData.property || null;
      
      if (!propertyData) {
        console.log('⚠️ 売主レスポンスに物件データが含まれていません。別途取得を試みます...');
        try {
          const propertyResponse = await api.get(`/properties/seller/${id}`);
          if (propertyResponse.data && propertyResponse.data.property) {
            propertyData = propertyResponse.data.property;
            console.log('✅ 物件データを別途取得しました:', propertyData);
          } else {
            console.log('⚠️ 物件データが見つかりませんでした');
          }
        } catch (propError) {
          console.error('❌ 物件データの取得に失敗:', propError);
        }
      }
      
      setProperty(propertyData);"""

new_load = """      // 並列で全データを取得（AI要約以外）
      // /api/employees はキャッシュ付きの getActiveEmployees() に統一
      // propertyData も並列で取得（直列フォールバックを排除）
      const [sellerResponse, activitiesResponse, employeesData, propertyFallbackResponse] = await Promise.all([
        api.get(`/api/sellers/${id}`),
        api.get(`/api/sellers/${id}/activities`),
        getActiveEmployees(),
        api.get(`/properties/seller/${id}`).catch(() => null),
      ]);

      // スタッフ一覧を設定（getActiveEmployees はキャッシュ付き）
      setEmployees(employeesData as any);
      setActiveEmployees(employeesData);

      // 売主情報を設定
      const sellerData = sellerResponse.data;
      
      // 売主データが存在することを確認
      if (!sellerData || !sellerData.id) {
        throw new Error('売主データが取得できませんでした');
      }
      
      setSeller(sellerData);
      setUnreachableStatus(sellerData.unreachableStatus || null);

      // 反響URLを非同期で取得（エラーでも続行）
      api.get(`/api/sellers/${id}/inquiry-url`).then(r => {
        setInquiryUrl(r.data.inquiryUrl || null);
      }).catch(() => {
        setInquiryUrl(null);
      });
      
      // 物件データを設定（sellerData に含まれていれば優先、なければ並列取得済みのデータを使用）
      let propertyData = sellerData.property || null;
      if (!propertyData && propertyFallbackResponse?.data?.property) {
        propertyData = propertyFallbackResponse.data.property;
      }
      
      setProperty(propertyData);"""

text = text.replace(old_load, new_load, 1)

# -----------------------------------------------------------------------
# 修正4: fetchActiveInitials useEffect を削除（initializeSenderAddress と重複）
#   initializeSenderAddress 側で setActiveEmployees を呼ぶようになったため不要
# -----------------------------------------------------------------------
old_initials_effect = """  // スタッフイニシャル一覧を取得
  useEffect(() => {
    const fetchActiveInitials = async () => {
      try {
        const response = await api.get('/api/employees/active-initials');
        setActiveEmployees(response.data.initials || []);
        console.log('✅ Loaded active staff initials:', response.data.initials);
      } catch (error) {
        console.error('Error fetching active staff initials:', error);
      }
    };
    
    fetchActiveInitials();
  }, []);

  // 訪問統計をロード"""
new_initials_effect = """  // 訪問統計をロード"""
text = text.replace(old_initials_effect, new_initials_effect, 1)

# -----------------------------------------------------------------------
# 修正5: initializeSenderAddress の getActiveEmployees 呼び出しを削除
#   loadAllData で既に取得・設定するため重複排除
# -----------------------------------------------------------------------
old_init_sender = """  useEffect(() => {
    const initializeSenderAddress = async () => {
      try {
        // 社員データを取得
        const employeeData = await getActiveEmployees();
        setActiveEmployees(employeeData);
        
        // セッションストレージから送信元アドレスを復元
        const savedAddress = getSenderAddress();
        
        // 有効なメールアドレスのリストを作成
        const validEmails = [
          'tenant@ifoo-oita.com',
          ...employeeData.filter(emp => emp.email).map(emp => emp.email)
        ];
        
        // 保存されたアドレスが有効かどうかを検証
        const validatedAddress = validateSenderAddress(savedAddress, validEmails);
        
        console.log('=== Sender Address Validation ===');
        console.log('Saved address:', savedAddress);
        console.log('Valid emails:', validEmails);
        console.log('Validated address:', validatedAddress);
        console.log('Was reset:', validatedAddress !== savedAddress);
        
        // 検証済みのアドレスを設定
        setSenderAddress(validatedAddress);
        
        // 無効なアドレスだった場合は、デフォルトアドレスを保存
        if (validatedAddress !== savedAddress) {
          saveSenderAddress(validatedAddress);
          console.log('✅ Reset sender address to default:', validatedAddress);
        }
      } catch (error) {
        console.error('Failed to initialize sender address:', error);
      }
    };
    
    initializeSenderAddress();
  }, []);"""

new_init_sender = """  useEffect(() => {
    // 送信元アドレスを初期化（社員データは loadAllData で取得済み）
    const savedAddress = getSenderAddress();
    const validEmails = [
      'tenant@ifoo-oita.com',
      ...activeEmployees.filter(emp => emp.email).map(emp => emp.email)
    ];
    const validatedAddress = validateSenderAddress(savedAddress, validEmails);
    setSenderAddress(validatedAddress);
    if (validatedAddress !== savedAddress) {
      saveSenderAddress(validatedAddress);
    }
  }, [activeEmployees]);"""

text = text.replace(old_init_sender, new_init_sender, 1)

# UTF-8 で書き込み（BOMなし）
with open('frontend/frontend/src/pages/CallModePage.tsx', 'wb') as f:
    f.write(text.encode('utf-8'))

print('Done!')
