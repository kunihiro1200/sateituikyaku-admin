import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, Box, Typography, Button, IconButton, CircularProgress } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import PrintIcon from '@mui/icons-material/Print';
import HomeWorkIcon from '@mui/icons-material/HomeWork';
import api from '../services/api';

interface HouseMakerSection { title: string; points: string[]; }
interface HouseMakerContent { makerName: string; tagline: string; sections: HouseMakerSection[]; summary: string; buyerSummary: string; }
// mode: 'seller' = 通話モード（売主向け）, 'buyer' = 物件詳細（買主向け）
interface HouseMakerModalProps { open: boolean; onClose: () => void; commentHtml: string; mode?: 'seller' | 'buyer'; }

const SECTION_ICONS: Record<string, string> = {
  '構造・耐震性': '🏗️',
  '断熱・省エネ性能': '🌿',
  'このメーカーならではの強み': '✨',
  '品質・保証・アフターサービス': '🛡️',
  '資産価値・売却時のポイント': '💰',
};

const DATA: Record<string, HouseMakerContent> = {
  '一条工務店': {
    makerName: '一条工務店', tagline: '業界最高水準の高気密・高断熱住宅',
    sections: [
      { title: '構造・耐震性', points: ['耐震等級3（最高等級）を全棟標準取得', '「ツインモノコック構造」で床・壁・天井が一体となり地震に強い箱型構造を実現', '全棟で構造計算を実施し地盤調査も標準対応'] },
      { title: '断熱・省エネ性能', points: ['UA値0.25以下（業界最高水準）を標準仕様で達成', 'EPS断熱材（発泡スチロール系）を壁・床・天井に分厚く充填し外気の影響を最小化', '全館床暖房（ヒートポンプ式）を標準装備し光熱費を大幅削減', '「ハニカムシェード」付きトリプルガラス樹脂窓を全窓に標準採用'] },
      { title: 'このメーカーならではの強み', points: ['自社工場で建材を一貫生産し品質のばらつきをゼロに近づける「製販一体」体制', '太陽光パネルを自社製造し大容量搭載（平均10kW超）を低コストで実現', '「さらぽか空調」（デシカント換気＋床冷暖房）で夏も冬も快適な全館空調を実現', '外壁タイル（ハイドロテクトタイル）を標準採用しメンテナンスコストを大幅削減'] },
      { title: '品質・保証・アフターサービス', points: ['初期保証10年＋有償メンテナンスで最長30年保証', '定期点検（2年・5年・10年・15年・20年）で長期にわたり住まいをサポート', '自社施工管理により下請けへの丸投げなし、品質を直接管理'] },
      { title: '資産価値・売却時のポイント', points: ['高断熱・高気密の性能が数値で証明できるため買主への説明がしやすい', '太陽光パネル・床暖房などの設備が充実し光熱費の安さが売却時の強みになる', '外壁タイルは劣化しにくく築年数が経っても外観の美しさを維持しやすい', '一条ブランドは中古市場でも認知度が高く買主から安心感を得やすい'] },
    ],
    summary: '光熱費の安さと高い性能が、売却時の大きなアピールポイントになります',
    buyerSummary: '一条工務店の中古住宅は、業界最高水準の断熱・気密性能と太陽光発電が揃った「買って得する家」です。光熱費が大幅に安く、快適性も新築同等水準を維持しています。',
  },
  '積水ハウス': {
    makerName: '積水ハウス', tagline: '累計建築戸数No.1の信頼と技術力',
    sections: [
      { title: '構造・耐震性', points: ['「シーカス構法」（制震ダンパーで地震エネルギーを熱に変換する独自技術）を採用', '耐震等級3（最高等級）を標準取得し繰り返しの地震にも強い制震性能を実現', '累計建築戸数240万戸以上（2023年時点）の実績が信頼の証'] },
      { title: '断熱・省エネ性能', points: ['「グリーンファーストゼロ」（ZEH基準を超える省エネ住宅）を標準展開', 'UA値0.6以下（高断熱性能）を標準仕様で達成', 'Low-E複層ガラス（高性能断熱窓）を全窓に標準装備'] },
      { title: 'このメーカーならではの強み', points: ['エコ・ファースト企業として環境配慮型住宅を業界をリードして推進', '「シャーウッド構法」（木造住宅の新工法）で自然素材の温もりと高耐久を両立', 'スマートハウス技術（IoTを活用した住宅設備）で快適な生活を提供', '邸別自由設計により一棟ごとに構造計算を実施'] },
      { title: '品質・保証・アフターサービス', points: ['30年保証システム（初期保証20年＋10年延長）を提供', '定期点検（1年目・2年目・5年目・10年目）で安心サポート', '24時間365日対応のアフターサービス窓口を設置'] },
      { title: '資産価値・売却時のポイント', points: ['積水ハウスのブランド力が中古市場での高評価を実現', '建物の耐久性とデザイン性が価格維持率の高さを証明', 'エコ住宅としての価値が次世代へのアピールポイント'] },
    ],
    summary: '240万戸超の実績と制震技術が、安心感として売却時に直結します',
    buyerSummary: '積水ハウスの中古住宅は、国内最多の建築実績と独自の制震技術「シーカス構法」を持つ信頼のブランド。30年保証体制と高いデザイン性が、中古でも価値を保ち続けます。',
  },
  'ダイワハウス': {
    makerName: 'ダイワハウス', tagline: '鉄骨の強さと工場品質で災害に強い家',
    sections: [
      { title: '構造・耐震性', points: ['「xevo（ジーヴォ）シリーズ」の独自鉄骨構造で地震エネルギーを効率よく吸収・分散', '耐震等級3（最高等級）を標準取得', '工場で高精度に部材を生産するため施工品質のばらつきが少ない'] },
      { title: '断熱・省エネ性能', points: ['「DXウォール」（高性能断熱パネル）で外壁の断熱性能を強化', 'ZEH（ネット・ゼロ・エネルギー・ハウス）対応住宅を標準展開', '太陽光発電システムとHEMS（住宅エネルギー管理システム）を組み合わせた省エネ設計'] },
      { title: 'このメーカーならではの強み', points: ['鉄骨ならではの大空間・大開口設計が可能で間取りの自由度が高い', '施工スピードが速く工期が短いため仮住まい期間を最小化', '賃貸・商業施設・医療施設など多様な建築実績を持つ総合建設力', '「skye（スカイエ）」シリーズで3〜4階建て都市型住宅にも対応'] },
      { title: '品質・保証・アフターサービス', points: ['初期保証30年（鉄骨構造躯体・防水）を標準提供', '「ダイワハウスの家」専用アプリで点検・修繕履歴を一元管理', '全国のサービス拠点から迅速に対応するアフターサービス体制'] },
      { title: '資産価値・売却時のポイント', points: ['鉄骨構造は木造より法定耐用年数が長く（34年）資産価値の減少が緩やか', '大空間・大開口の間取りは買主にとって魅力的なリノベーション素地になる', 'ダイワハウスブランドは中古市場での認知度が高く売却しやすい'] },
    ],
    summary: '鉄骨の耐久性と30年保証が、中古市場での高い評価につながります',
    buyerSummary: 'ダイワハウスの中古住宅は、鉄骨構造の高い耐久性と30年保証が魅力。木造より法定耐用年数が長く、大空間・大開口の間取りはリノベーションの自由度も高い資産価値の高い物件です。',
  },
  'パナソニックホームズ': {
    makerName: 'パナソニックホームズ', tagline: '制震鉄骨と先進空調で快適・安心な住まい',
    sections: [
      { title: '構造・耐震性', points: ['「HS構法」（制震鉄骨構造）で地震の揺れを最大50%低減する制震性能を実現', '重量鉄骨「NS構法」では4〜5階建ての大空間設計にも対応', '耐震等級3（最高等級）を標準取得'] },
      { title: '断熱・省エネ性能', points: ['「エアロハス」（全館空調システム）で家全体を均一な温度に保ちヒートショックを防止', 'ZEH（ネット・ゼロ・エネルギー・ハウス）対応を標準展開', 'パナソニック製の高効率太陽光パネル・蓄電池との連携で光熱費を大幅削減'] },
      { title: 'このメーカーならではの強み', points: ['パナソニックグループの電気設備・スマートホーム技術を住宅に直接統合', '「カサート」シリーズで鉄骨ならではの大開口・大空間の間取りを実現', '外壁「キラテック」（光触媒タイル）で雨が汚れを洗い流す自浄作用を実現', 'HEMSとAIで電力使用を最適化し電気代を自動でコントロール'] },
      { title: '品質・保証・アフターサービス', points: ['初期保証35年（構造躯体・防水）を業界最長水準で提供', 'パナソニックグループのネットワークで全国どこでも迅速なアフター対応', '定期点検（1年・2年・5年・10年・15年・20年・25年・30年）で長期サポート'] },
      { title: '資産価値・売却時のポイント', points: ['35年保証は業界最長水準で買主への安心感として直接アピールできる', '光触媒タイル外壁は築年数が経っても外観が美しく第一印象が良い', 'スマートホーム設備が充実しており次世代の買主層に響くアピールポイントになる'] },
    ],
    summary: '35年保証と全館空調が、買主にとって魅力的な付加価値になります',
    buyerSummary: 'パナソニックホームズの中古住宅は、業界最長水準の35年保証と全館空調「エアロハス」が標準装備。スマートホーム技術と光触媒タイル外壁で、快適性・省エネ性・美観を長期間維持します。',
  },
  'ユニバーサルホーム': {
    makerName: 'ユニバーサルホーム', tagline: '地熱床システムで一年中快適・省エネな家',
    sections: [
      { title: '構造・耐震性', points: ['「高強度ベタ基礎」で建物全体を面で支え不同沈下（地盤の不均一な沈み）を防止', '耐震等級2以上を標準取得（オプションで等級3対応）', '2×4（ツーバイフォー）工法ベースで壁・床・天井が一体となる強固な構造'] },
      { title: '断熱・省エネ性能', points: ['「地熱床システム」（地下の安定した温度を活用して床下から冷暖房）で年間光熱費を大幅削減', '床下空間を密閉し地熱（年間約15〜17℃で安定）を直接利用する独自技術', '外壁・屋根に高性能断熱材を採用し冷暖房効率を最大化'] },
      { title: 'このメーカーならではの強み', points: ['地熱床システムは他のハウスメーカーにはない唯一無二の省エネ技術', 'フランチャイズ展開により地域密着の工務店が施工するため地元対応が迅速', '手頃な価格帯でありながら高い省エネ性能を実現するコストパフォーマンスの高さ'] },
      { title: '品質・保証・アフターサービス', points: ['初期保証10年（瑕疵担保責任）＋独自の延長保証制度', '加盟店による地域密着のアフターサービスで迅速な対応が可能', '定期点検制度で建物の状態を継続的にチェック'] },
      { title: '資産価値・売却時のポイント', points: ['地熱床システムによる光熱費の安さは買主にとって毎月のランニングコスト削減として直接訴求できる', '省エネ性能の高さはZEH補助金・省エネ住宅ローン優遇の対象になりやすい', '手頃な価格帯の物件として幅広い買主層にアプローチしやすい'] },
    ],
    summary: '地熱床システムによる光熱費の安さが、買主への最大のアピールポイントです',
    buyerSummary: 'ユニバーサルホームの中古住宅は、他社にない「地熱床システム」で一年中快適な室温を維持しながら光熱費を大幅に節約できる省エネ住宅。毎月のランニングコストの安さが大きな魅力です。',
  },
  'ミサワホーム': {
    makerName: 'ミサワホーム', tagline: '「蔵」のある暮らしと高い耐震性を両立',
    sections: [
      { title: '構造・耐震性', points: ['「木質パネル接着工法」（パネルを接着剤で一体化する独自工法）で高い剛性を実現', '耐震等級3（最高等級）を標準取得', '阪神・淡路大震災でも全壊・半壊ゼロという実績（ミサワホーム調べ）'] },
      { title: '断熱・省エネ性能', points: ['高性能断熱パネルを壁・床・天井に採用しUA値0.6以下を標準達成', 'ZEH（ネット・ゼロ・エネルギー・ハウス）対応住宅を標準展開', '太陽光発電システムと蓄電池の組み合わせで自給自足型の省エネ住宅を実現'] },
      { title: 'このメーカーならではの強み', points: ['「蔵（くら）」（天井高1.4m以下の大容量収納スペース）で床面積を増やさずに収納力を大幅アップ', '「スキップフロア」設計で空間を立体的に活用し開放感と収納を両立', 'グッドデザイン賞受賞多数のデザイン力で外観・内装ともに高い評価'] },
      { title: '品質・保証・アフターサービス', points: ['初期保証10年＋有償メンテナンスで最長30年保証', '「MISAWA SMART ORDER」システムで部材の品質を工場で一元管理', '定期点検（2年・5年・10年・15年・20年）で長期サポート'] },
      { title: '資産価値・売却時のポイント', points: ['「蔵」は固定資産税の対象外（高さ1.4m以下）のため実質的な床面積以上の収納価値がある', 'デザイン性の高さが中古市場での差別化ポイントになり買主の目を引きやすい', '木質パネル工法の高い耐久性が築年数が経っても建物の価値を維持する'] },
    ],
    summary: '「蔵」の収納力とデザイン性が、他の中古物件との差別化になります',
    buyerSummary: 'ミサワホームの中古住宅は、固定資産税がかからない大容量収納「蔵」と受賞歴多数のデザイン性が特徴。木質パネル工法の高い耐久性で、築年数が経っても建物の価値が維持されます。',
  },
  '谷川建設': {
    makerName: '谷川建設', tagline: '国産檜100%使用の本物の木の家',
    sections: [
      { title: '構造・耐震性', points: ['国産檜（ひのき）を構造材に100%使用し強度・耐久性・防虫性に優れた骨格を実現', '「金物工法」（専用金物で柱・梁を緊結）で在来工法より高い接合強度を確保', '耐震等級3（最高等級）を標準取得'] },
      { title: '断熱・省エネ性能', points: ['「セルロースファイバー断熱材」（新聞紙を再利用した自然素材断熱材）を採用し高い断熱性と調湿性を実現', '木の家ならではの蓄熱性で冷暖房の効きが良く光熱費を削減', '自然素材の調湿効果で結露を防ぎカビ・ダニの発生を抑制'] },
      { title: 'このメーカーならではの強み', points: ['国産檜の産地・品質を自社で管理し偽装のない本物の木材を使用', '木の香り・温もり・調湿効果など自然素材ならではの居住環境を提供', '職人による手刻み加工（機械ではなく職人が木材を加工）で精度の高い施工を実現'] },
      { title: '品質・保証・アフターサービス', points: ['初期保証10年＋独自の延長保証制度', '地域密着の施工体制でアフターサービスの対応が迅速', '定期点検で木材の状態・シロアリ被害などを継続的にチェック'] },
      { title: '資産価値・売却時のポイント', points: ['国産檜は年月が経つほど強度が増す特性があり築年数が経っても構造の信頼性が高い', '自然素材・無垢材の家は健康志向の買主層に強くアピールできる', '木の家の温もり・香りは内覧時に買主の印象に強く残り成約につながりやすい'] },
    ],
    summary: '国産檜の本物の木の家は、内覧時に買主の心をつかむ強みがあります',
    buyerSummary: '谷川建設の中古住宅は、国産檜100%使用の本物の木の家。檜は年月とともに強度が増す特性があり、木の香り・温もり・調湿効果が内覧時に体感できる、他にはない魅力を持つ物件です。',
  },
  '住友林業': {
    makerName: '住友林業', tagline: '300年の森林経営が生んだ最高品質の木の家',
    sections: [
      { title: '構造・耐震性', points: ['「ビッグフレーム構法（BF構法）」（一般的な柱の約5倍の断面積を持つ大断面集成柱を使用）で高い耐震性を実現', '耐震等級3（最高等級）を標準取得', '「マルチバランス構法」で木造でありながら大開口・大空間の間取りを実現'] },
      { title: '断熱・省エネ性能', points: ['UA値0.6以下（高断熱仕様）を標準達成', 'ZEH（ネット・ゼロ・エネルギー・ハウス）対応住宅を標準展開', '「スマートエコス」（高性能断熱材＋高性能窓）で冷暖房効率を最大化'] },
      { title: 'このメーカーならではの強み', points: ['住友林業グループが自社で山林を所有・管理し木材の産地・品質を完全にトレーサブル', '「ウッドタイル」「無垢フローリング」など上質な木材内装を標準採用', 'インテリアコーディネーターが全棟に対応しデザイン性の高い空間を実現', '「BF構法」により木造でも最大7mの大スパン（柱なし大空間）が可能'] },
      { title: '品質・保証・アフターサービス', points: ['初期保証30年（構造躯体・防水）を標準提供', '「住友林業ホームサービス」による売却・賃貸・リフォームまで一貫サポート', '定期点検（1年・2年・5年・10年・15年・20年・25年・30年）で長期サポート'] },
      { title: '資産価値・売却時のポイント', points: ['住友林業ブランドは高級木造住宅の代名詞として中古市場での評価が高い', '無垢材・木質内装は経年変化で味わいが増し築年数が経っても魅力が落ちにくい', '住友林業ホームサービスが売却をサポートするためスムーズな取引が期待できる'] },
    ],
    summary: '住友林業ブランドと無垢材の上質感が、中古市場での高評価を生みます',
    buyerSummary: '住友林業の中古住宅は、高級木造住宅の代名詞として中古市場でも高い評価を受けるブランド物件。無垢材・木質内装は経年で味わいが増し、30年保証と充実したアフターサービスが安心感を支えます。',
  },
  'GIJ株式会社': {
    makerName: 'GIJ株式会社（エシカルハウス）', tagline: '大分発・価格・性能・デザインを三立する注文住宅',
    sections: [
      { title: '構造・耐震性', points: ['大分県内の地盤・気候に精通した地元密着の設計・施工体制で安心の品質を確保', '大分県知事登録設計事務所（第18V－24247号）として構造設計を自社で一貫管理', '注文住宅の設計・施工を一体で行うため施工品質のばらつきを最小化'] },
      { title: '断熱・省エネ性能', points: ['「エシカルハウス（Ethical House）」ブランドで省エネ設計と自然エネルギー活用を標準志向', '大分の温暖な気候に最適化した断熱仕様で年間を通じた快適性と光熱費削減を実現', 'ZEH（ネット・ゼロ・エネルギー・ハウス）対応設計にも対応可能'] },
      { title: 'このメーカーならではの強み', points: ['「エシカル（倫理的・持続可能）」をコンセプトに価格・性能・デザインのバランスを重視した住まいを提案', '注文住宅・不動産売買・仲介・賃貸管理・リフォームまで住まいに関するワンストップサービスを提供', '相続相談・任意売却・税金・法律相談など不動産に関する幅広い専門サポートが可能', '大分市中心部（大分駅徒歩約14分）に拠点を置く地域密着企業で迅速な対応が強み'] },
      { title: '品質・保証・アフターサービス', points: ['宅地建物取引業：大分県知事（3）第3146号取得の信頼ある不動産事業者', '設計事務所登録により設計から施工・アフターまで一貫した責任体制を確立', 'リフォーム相談にも対応しており建築後の住まいの維持・改善をトータルサポート'] },
      { title: '資産価値・売却時のポイント', points: ['地元大分の不動産市場に精通した仲介力で売却時のスムーズな取引が期待できる', '省エネ・自然エネルギー活用設計は光熱費の安さとして買主へのアピールポイントになる', '注文住宅ならではのオーダーメイド設計が他の中古物件との差別化につながる'] },
    ],
    summary: '地元大分の信頼ある工務店ブランド「エシカルハウス」の家は、省エネ性能と地域密着サポートが強みです',
    buyerSummary: 'GIJ株式会社「エシカルハウス」の中古住宅は、大分県内の地盤・気候に精通した地元工務店が手がけた省エネ設計の注文住宅。売却後も同社の不動産・リフォームサポートが利用できる安心感があります。',
  },
  '積水ハイム': {
    makerName: '積水ハイム', tagline: '工場生産のユニット工法で高品質・短工期を実現',
    sections: [
      { title: '構造・耐震性', points: ['「ユニット工法」（鉄骨または木質のボックスユニットを工場で完成させ現場で組み立てる独自工法）で高い精度と強度を実現', '耐震等級3（最高等級）を標準取得', '工場生産率約85%（業界最高水準）により現場での施工誤差をほぼゼロに抑制'] },
      { title: '断熱・省エネ性能', points: ['「スマートパワーステーション」シリーズでZEH（ネット・ゼロ・エネルギー・ハウス）を標準展開', '太陽光発電＋蓄電池＋HEMS（住宅エネルギー管理システム）を標準搭載', '高性能断熱材と樹脂サッシ窓の組み合わせでUA値0.6以下を達成'] },
      { title: 'このメーカーならではの強み', points: ['工場生産率85%により天候・職人の技量に左右されない均一な品質を保証', '「ユニット工法」により工期が約45日（在来工法の約半分）と短く仮住まい費用を削減', '鉄骨・木質どちらのユニットも選択可能で多様なライフスタイルに対応', '積水化学グループの素材技術を活かした高耐久・高機能な建材を採用'] },
      { title: '品質・保証・アフターサービス', points: ['初期保証30年（構造躯体・防水）を標準提供', '「積水ハイムオーナーズデスク」で24時間365日のアフターサービスに対応', '定期点検（1年・2年・5年・10年・15年・20年・25年・30年）で長期サポート'] },
      { title: '資産価値・売却時のポイント', points: ['工場生産による均一な品質が中古市場での信頼性を高める', '積水ハイムブランドは中古市場での認知度が高く買主から安心感を得やすい', '太陽光発電・蓄電池の標準搭載が光熱費の安さとして買主へのアピールポイントになる'] },
    ],
    summary: '工場生産の均一品質と30年保証が、中古市場での安心感につながります',
    buyerSummary: '積水ハイムの中古住宅は、工場生産率85%という業界最高水準の品質管理で建てられた信頼のブランド物件。太陽光発電・蓄電池が標準搭載で光熱費が安く、30年保証体制が中古でも安心感を提供します。',
  },
};

// 略称・通称 → データキーのマッピング
const ALIASES: [RegExp, string][] = [
  [/一条/,                              '一条工務店'],
  [/積水ハウス|セキスイハウス/,          '積水ハウス'],
  [/積水ハイム|セキスイハイム/,          '積水ハイム'],
  [/ダイワ|大和ハウス/,                  'ダイワハウス'],
  [/パナソニック|パナホーム/,            'パナソニックホームズ'],
  [/ユニバーサル/,                       'ユニバーサルホーム'],
  [/ミサワ/,                             'ミサワホーム'],
  [/谷川/,                               '谷川建設'],
  [/住友林業|すみりん/,                  '住友林業'],
  [/ヘーベル|へーベル/,                  'ヘーベルハウス'],
  [/トヨタホーム|トヨタ/,               'トヨタホーム'],
  [/三井ホーム|三井/,                    '三井ホーム'],
  [/旭化成|ヘーベルハウス/,             'ヘーベルハウス'],
  [/タマホーム|タマ/,                    'タマホーム'],
  [/GIJ|エシカルハウス|デザインハウス大分東/, 'GIJ株式会社'],
];

function detectMaker(text: string): HouseMakerContent | null {
  const plain = text.replace(/<[^>]+>/g, '');
  // まず完全一致で検索
  for (const [key, data] of Object.entries(DATA)) {
    if (plain.includes(key)) return data;
  }
  // 次に略称・通称で検索
  for (const [pattern, key] of ALIASES) {
    if (pattern.test(plain)) return DATA[key] ?? null;
  }
  return null;
}

const HouseMakerModal: React.FC<HouseMakerModalProps> = ({ open, onClose, commentHtml, mode = 'seller' }) => {
  const staticContent = open ? detectMaker(commentHtml) : null;
  const [aiContent, setAiContent] = useState<HouseMakerContent | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

  // DATAにない場合はAI APIで動的生成
  useEffect(() => {
    if (!open) {
      setAiContent(null);
      setAiError(null);
      return;
    }
    if (staticContent) return; // 静的データがあればAI不要

    setAiLoading(true);
    setAiError(null);
    setAiContent(null);

    api.post('/summarize/house-maker-info', { commentText: commentHtml })
      .then((res) => {
        const c = res.data?.content;
        if (c && c.makerName) {
          // buyerSummaryがない場合はsummaryで代用
          if (!c.buyerSummary) c.buyerSummary = c.summary || '';
          setAiContent(c as HouseMakerContent);
        } else {
          setAiError('ハウスメーカー情報が見つかりませんでした。');
        }
      })
      .catch((err) => {
        const msg = err?.response?.data?.error || 'ハウスメーカー情報の取得に失敗しました。';
        setAiError(msg);
      })
      .finally(() => setAiLoading(false));
  }, [open, commentHtml, staticContent]);

  const content = staticContent ?? aiContent;
  const isBuyer = mode === 'buyer';
  const displaySummary = content ? (isBuyer ? (content.buyerSummary || content.summary) : content.summary) : '';

  const handlePrint = () => {
    if (!content) return;
    const win = window.open('', '_blank');
    if (!win) return;
    const sectionsHtml = content.sections.map((s) => {
      const icon = SECTION_ICONS[s.title] || '📌';
      const pts = s.points.map((p) => `<div class="point"><span class="dot"></span><span>${p}</span></div>`).join('');
      return `<div class="section"><div class="sh">${icon} ${s.title}</div><div class="sb">${pts}</div></div>`;
    }).join('');
    win.document.write(`<!DOCTYPE html><html lang="ja"><head><meta charset="UTF-8"><title>${content.makerName}</title><style>
@page{size:A4 portrait;margin:12mm 15mm}*{box-sizing:border-box;margin:0;padding:0}
body{font-family:'Hiragino Kaku Gothic ProN','Meiryo','Yu Gothic',sans-serif;font-size:10pt;color:#1a1a2e;-webkit-print-color-adjust:exact;print-color-adjust:exact}
.header{background:linear-gradient(135deg,#1a237e,#283593)!important;color:#fff!important;padding:14px 20px 12px;border-radius:6px;margin-bottom:14px}
.badge{display:inline-block;background:rgba(255,255,255,.2);border:1px solid rgba(255,255,255,.4);border-radius:4px;padding:2px 8px;font-size:7.5pt;margin-bottom:6px;color:#fff}
.mn{font-size:22pt;font-weight:800;color:#fff}.tl{font-size:10pt;color:rgba(255,255,255,.9);margin-top:3px}
.grid{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:12px}
.section{border:1px solid #e0e0e0;border-radius:6px;overflow:hidden;break-inside:avoid}
.sh{background:#f0f0f5!important;padding:7px 10px;font-size:9pt;font-weight:700;color:#1a237e!important;border-bottom:1px solid #e0e0e0}
.sb{padding:9px 10px}.point{display:flex;align-items:flex-start;gap:7px;margin-bottom:6px;font-size:8.5pt;line-height:1.55}
.point:last-child{margin-bottom:0}.dot{display:inline-block;width:5px;height:5px;min-width:5px;background:#1a237e!important;border-radius:50%;margin-top:5px}
.sum{background:linear-gradient(135deg,#e8eaf6,#ede7f6)!important;border:1px solid #9fa8da;border-radius:6px;padding:10px 14px;text-align:center;font-size:10pt;font-weight:600;color:#1a237e!important}
</style></head><body>
<div class="header"><div class="badge">ハウスメーカー資料</div><div class="mn">${content.makerName}</div><div class="tl">${content.tagline}</div></div>
<div class="grid">${sectionsHtml}</div>
<div class="sum">${displaySummary}</div>
</body></html>`);
    win.document.close();
    win.focus();
    setTimeout(() => { win.print(); win.close(); }, 600);
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth transitionDuration={0} PaperProps={{ sx: { borderRadius: 2, maxHeight: '90vh' } }}>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', px: 3, py: 2, background: 'linear-gradient(135deg, #1a237e 0%, #283593 100%)', color: 'white' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <HomeWorkIcon />
          <Typography variant="h6" fontWeight={700}>{content ? `${content.makerName} 特徴・メリット` : 'ハウスメーカー情報'}</Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 1 }}>
          {content && (
            <Button variant="outlined" size="small" startIcon={<PrintIcon />} onClick={handlePrint}
              sx={{ color: 'white', borderColor: 'rgba(255,255,255,0.6)', '&:hover': { borderColor: 'white', background: 'rgba(255,255,255,0.1)' } }}>
              PDF印刷
            </Button>
          )}
          <IconButton onClick={onClose} size="small" sx={{ color: 'white' }}><CloseIcon /></IconButton>
        </Box>
      </Box>

      <DialogContent sx={{ p: 3 }}>
        {aiLoading && (
          <Box sx={{ textAlign: 'center', py: 6 }}>
            <CircularProgress size={40} sx={{ mb: 2 }} />
            <Typography color="text.secondary">AIがハウスメーカー情報を生成中です...</Typography>
          </Box>
        )}
        {!aiLoading && aiError && !content && (
          <Box sx={{ textAlign: 'center', py: 4 }}>
            <Typography color="text.secondary">{aiError}</Typography>
          </Box>
        )}
        {!aiLoading && !content && !aiError && (
          <Box sx={{ textAlign: 'center', py: 4 }}>
            <Typography color="text.secondary">ハウスメーカー情報が見つかりませんでした。</Typography>
          </Box>
        )}
        {content && (
          <Box>
            <Box sx={{ background: 'linear-gradient(135deg, #1a237e 0%, #283593 100%)', color: 'white', p: 2.5, borderRadius: 2, mb: 2 }}>
              <Box sx={{ display: 'inline-block', background: 'rgba(255,255,255,0.2)', border: '1px solid rgba(255,255,255,0.4)', borderRadius: '4px', px: 1, py: 0.2, fontSize: '0.7rem', mb: 0.5 }}>
                ハウスメーカー資料
              </Box>
              <Typography variant="h4" fontWeight={800} sx={{ letterSpacing: '0.02em' }}>{content.makerName}</Typography>
              <Typography variant="body2" sx={{ opacity: 0.9, mt: 0.5 }}>{content.tagline}</Typography>
            </Box>
            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 1.5, mb: 2 }}>
              {content.sections.map((section, idx) => (
                <Box key={idx} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 1.5, overflow: 'hidden' }}>
                  <Box sx={{ background: '#f5f5f5', px: 1.5, py: 0.8, borderBottom: '1px solid', borderColor: 'divider' }}>
                    <Typography variant="subtitle2" fontWeight={700} color="primary.dark" sx={{ fontSize: '0.82rem' }}>
                      {SECTION_ICONS[section.title] || '📌'} {section.title}
                    </Typography>
                  </Box>
                  <Box sx={{ p: 1.5 }}>
                    {section.points.map((point, pIdx) => (
                      <Box key={pIdx} sx={{ display: 'flex', alignItems: 'flex-start', gap: 1, mb: pIdx < section.points.length - 1 ? 0.8 : 0 }}>
                        <Box sx={{ width: 5, height: 5, borderRadius: '50%', background: '#1a237e', mt: '6px', flexShrink: 0 }} />
                        <Typography variant="body2" sx={{ fontSize: '0.8rem', lineHeight: 1.6 }}>{point}</Typography>
                      </Box>
                    ))}
                  </Box>
                </Box>
              ))}
            </Box>
            <Box sx={{ background: 'linear-gradient(135deg, #e8eaf6 0%, #ede7f6 100%)', border: '1px solid', borderColor: '#9fa8da', borderRadius: 1.5, p: 1.5, textAlign: 'center' }}>
              <Typography variant="body1" fontWeight={600} color="primary.dark">{displaySummary}</Typography>
            </Box>
          </Box>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default HouseMakerModal;
