import React, { useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { Box, Button, TextField, Typography, Paper, Grid } from '@mui/material';
import PrintIcon from '@mui/icons-material/Print';
import EditIcon from '@mui/icons-material/Edit';

interface ScheduleData {
  sellerName: string;
  propertyAddress: string;
  listingMonth: string;    // 売出月（数字のみ 例: "7"）
  listingYear: string;     // 売出年 例: "2026"
  listingPrice: string;    // 売出価格（万円）例: "2,590"
  minPrice: string;        // 最低価格（万円）例: "2,390"
  contractMonth: string;   // 売買契約月（数字のみ）
  contractYear: string;
  settlementMonth: string; // 決済月（数字のみ）
  settlementYear: string;
}

// 月から中間月を計算
const midMonth = (y1: number, m1: number, y2: number, m2: number): { year: number; month: number } => {
  const total1 = y1 * 12 + m1;
  const total2 = y2 * 12 + m2;
  const mid = Math.round((total1 + total2) / 2);
  return { year: Math.floor((mid - 1) / 12), month: ((mid - 1) % 12) + 1 };
};

// 価格から中間見直し価格を計算
const calcReview = (startStr: string, minStr: string) => {
  const start = parseInt(startStr.replace(/,/g, ''), 10);
  const min = parseInt(minStr.replace(/,/g, ''), 10);
  if (isNaN(start) || isNaN(min)) return { r1: '', r2a: '', r2b: '' };
  const r1 = Math.round((start * 2 + min) / 3 / 10) * 10;
  const r2a = Math.round((r1 * 2 + min) / 3 / 10) * 10;
  const r2b = Math.round((r1 + min * 2) / 3 / 10) * 10;
  return {
    r1: r1.toLocaleString(),
    r2a: r2a.toLocaleString(),
    r2b: r2b.toLocaleString(),
  };
};

// CSS文字列（ChatGPTのstyle.cssをそのまま埋め込み）
const CSS = `
@page{size:A4 portrait;margin:0;}
:root{--blue:#12418d;--blue2:#2d6fc8;--green:#2f9c3d;--orange:#f28717;--red:#ea4335;--navy:#143567;--text:#1f2937;--light-blue:#eaf2fd;--light-green:#edf8ee;--light-orange:#fff3e8;--light-red:#fff0ef;--cream:#fff7e8;--border-blue:#2b70ca;}
*{box-sizing:border-box;}
html,body{margin:0;padding:0;background:#e9ecef;font-family:"Yu Gothic","Hiragino Kaku Gothic ProN","Meiryo",sans-serif;color:var(--text);}
body{display:flex;justify-content:center;align-items:flex-start;padding:8mm 0;}
.page{width:210mm;min-height:297mm;background:#fff;padding:6mm 6mm 5mm;overflow:hidden;}
.header-top{display:grid;grid-template-columns:34mm 1fr 42mm;align-items:start;gap:4mm;}
.title{margin:0;text-align:center;font-size:17mm;line-height:1.05;color:var(--navy);font-weight:900;letter-spacing:0.5mm;}
.corner-illust{height:36mm;}
.corner-illust svg{width:100%;height:100%;display:block;}
.right-logo-wrap{display:flex;justify-content:flex-end;align-items:flex-start;}
.logo-area{display:flex;flex-direction:column;align-items:center;gap:1mm;}
.kujira-logo{width:35mm;height:26mm;}
.logo-text{font-size:3.1mm;color:#4f2a23;font-weight:800;letter-spacing:0.1mm;}
.info-box{margin:3mm auto 4mm;border:0.8mm solid var(--blue);border-radius:5mm;padding:3mm 5mm;width:calc(100% - 42mm);}
.info-row{display:grid;grid-template-columns:6mm 26mm 1fr;align-items:center;gap:2mm;}
.info-icon svg{width:5mm;height:5mm;display:block;}
.info-label,.info-value{font-size:4.4mm;font-weight:800;color:#1b2f57;}
.info-divider{border-top:0.5mm dotted #6f8ab7;margin:2mm 0;}
.content{display:grid;grid-template-columns:28mm 1fr 50mm;gap:4mm;}
.timeline-col{position:relative;padding-top:2mm;}
.timeline-line{position:absolute;top:8mm;left:24mm;width:1.2mm;height:calc(100% - 15mm);background:var(--blue);border-radius:999px;}
.timeline-line::after{content:"";position:absolute;bottom:-2mm;left:-2.1mm;width:0;height:0;border-left:2.7mm solid transparent;border-right:2.7mm solid transparent;border-top:5mm solid var(--blue);}
.timeline-item{position:relative;width:100%;min-height:47mm;border:0.35mm solid #d7dce5;border-radius:4mm;margin-bottom:5mm;padding:3mm 2mm;text-align:center;background:#fff;}
.timeline-item.bottom{margin-top:8mm;}
.timeline-item .year{font-size:4.1mm;font-weight:800;line-height:1.1;}
.timeline-item .month{font-size:9mm;font-weight:900;line-height:1.1;margin-top:1mm;}
.timeline-item .calendar{width:15mm;height:15mm;margin:3mm auto 0;}
.timeline-item .calendar svg{width:100%;height:100%;}
.timeline-item .dot{position:absolute;right:-6.5mm;top:10mm;width:6mm;height:6mm;border-radius:50%;}
.timeline-item.blue .year,.timeline-item.blue .month{color:var(--blue);}
.timeline-item.blue .dot{background:var(--blue);}
.timeline-item.green .year,.timeline-item.green .month{color:var(--green);}
.timeline-item.green .dot{background:var(--green);}
.timeline-item.orange .year,.timeline-item.orange .month{color:var(--orange);}
.timeline-item.orange .dot{background:var(--orange);}
.timeline-item.red .year,.timeline-item.red .month{color:var(--red);}
.timeline-item.red .dot{background:var(--red);}
.main-col{display:flex;flex-direction:column;gap:4mm;}
.step{border-radius:4mm;border:0.7mm solid;padding:3.2mm 4mm;background:#fff;}
.blue-box{border-color:var(--blue2);}
.green-box{border-color:#6cb56f;}
.orange-box{border-color:#f1a349;}
.red-box{border-color:var(--red);}
.step-head{display:flex;align-items:center;justify-content:space-between;gap:3mm;margin-bottom:2mm;}
.step-head.single{justify-content:flex-start;}
.badge{background:var(--blue);color:#fff;border-radius:2mm;padding:1.6mm 3mm;font-size:6.6mm;font-weight:900;line-height:1;}
.badge.green{background:var(--green);}
.badge.orange{background:var(--orange);}
.price{color:var(--navy);font-size:7.2mm;font-weight:900;white-space:nowrap;}
.price .num{font-size:9.5mm;margin-right:1mm;}
.step-inner.three-col{display:grid;grid-template-columns:1.1fr 1fr;gap:4mm;align-items:center;}
.step-inner.two-col{display:grid;grid-template-columns:1.1fr 0.9fr;gap:4mm;align-items:center;}
.bullet-list{margin:0;padding:0 0 0 4.5mm;font-size:4.2mm;font-weight:700;line-height:1.55;}
.bullet-list li{margin:0.8mm 0;}
.bullet-list li::marker{color:var(--blue2);}
.green-box .bullet-list li::marker{color:var(--green);}
.orange-box .bullet-list li::marker{color:var(--orange);}
.red-bullets li::marker{color:var(--red);}
.icon-row,.small-illust-area,.settlement-icons{display:flex;align-items:center;justify-content:center;gap:3mm;flex-wrap:nowrap;}
.icon-svg{width:18mm;height:14mm;}
.icon-svg.wide{width:24mm;}
.icon-svg.large{width:24mm;height:18mm;}
.people-svg,.couple-svg{width:22mm;height:18mm;}
.middle-row{display:grid;grid-template-columns:1fr 34mm;gap:3mm;align-items:stretch;}
.price-note{position:relative;border-radius:4mm;padding:3mm 2.5mm 6mm;text-align:center;border:0.6mm solid;background:#fff;}
.green-note{background:var(--light-green);border-color:#7bc07b;}
.orange-note{background:var(--light-orange);border-color:#f0b166;}
.note-title{font-size:3.8mm;font-weight:800;margin-bottom:2mm;color:#6b5d2f;}
.note-price{font-size:7.3mm;font-weight:900;color:#2c8e37;}
.note-price span{font-size:4.5mm;margin-left:0.5mm;}
.note-sub{font-size:3.6mm;font-weight:700;line-height:1.4;margin-top:1mm;}
.stack-price{font-size:7mm;font-weight:900;color:#d56e10;line-height:1.2;}
.stack-price span{font-size:4.4mm;margin-left:0.5mm;}
.down-arrow{position:absolute;left:50%;bottom:-7mm;transform:translateX(-50%);width:0;height:0;}
.green-arrow{border-left:5mm solid transparent;border-right:5mm solid transparent;border-top:7mm solid #94ce71;}
.orange-arrow{border-left:5mm solid transparent;border-right:5mm solid transparent;border-top:7mm solid #f0a84a;}
.contract-box{display:grid;grid-template-columns:38mm 1fr 29mm;gap:3mm;align-items:center;padding:3mm;background:#fff;}
.min-box{border:0.55mm solid var(--red);border-radius:3mm;overflow:hidden;background:#fff;}
.min-title{background:var(--red);color:#fff;text-align:center;font-size:5.6mm;font-weight:900;padding:1.6mm 0;}
.min-price{color:var(--red);font-size:9mm;font-weight:900;text-align:center;padding:3mm 1mm 4mm;line-height:1;}
.min-price span{font-size:4.6mm;margin-left:0.5mm;}
.contract-title{color:var(--red);font-size:9.4mm;font-weight:900;margin-bottom:1mm;}
.handshake-svg{width:100%;height:auto;}
.moving-band{display:grid;grid-template-columns:16mm 1fr 20mm;align-items:center;gap:3mm;background:#fff8e5;border:0.5mm dashed #e3b348;border-radius:4mm;padding:3mm 3mm;margin-top:-1mm;}
.moving-boxes,.moving-truck{width:100%;height:auto;}
.moving-main{font-size:5.4mm;font-weight:900;color:#52371a;line-height:1.2;}
.moving-sub{font-size:3.9mm;font-weight:700;margin-top:1mm;}
.settlement-box .step-head{margin-bottom:2mm;}
.settlement-inner{display:grid;grid-template-columns:1fr 1.2fr;gap:3mm;align-items:center;}
.side-col{display:flex;flex-direction:column;gap:4mm;}
.side-main-box{border:0.55mm solid #e9b452;border-radius:4mm;background:#fffdf8;padding:4mm 3mm 3mm;text-align:center;}
.crown-line{display:flex;justify-content:center;margin-bottom:1mm;}
.crown-svg{width:16mm;height:8mm;}
.side-heading{font-size:5.2mm;font-weight:900;color:#1a376c;line-height:1.35;}
.side-heading .accent{color:#f26722;font-size:8.6mm;line-height:1.05;}
.service-btn{display:flex;align-items:center;justify-content:center;gap:2mm;border-radius:3mm;padding:2.3mm 2mm;margin-top:3mm;font-size:6.2mm;font-weight:900;}
.green-btn{background:#e3f0cf;color:#2c7a33;}
.blue-btn{background:#d9ebfa;color:#245f9a;}
.orange-btn{background:#ffedcf;color:#e07b13;}
.btn-icon svg{width:9mm;height:6.5mm;}
.side-copy{margin-top:3mm;color:#1a376c;font-size:5.6mm;font-weight:900;line-height:1.35;}
.side-copy .accent{color:#f26722;}
.side-copy .big{font-size:8.6mm;line-height:1.05;}
.agent-illust{margin-top:2mm;}
.agent-illust svg{width:38mm;height:auto;}
.point-box{border:0.55mm solid #7eb0e9;border-radius:4mm;overflow:hidden;background:#fff;}
.point-head{background:#2c73c8;color:#fff;text-align:center;font-size:5.2mm;font-weight:900;padding:2mm 0;}
.point-text{padding:3mm;font-size:4.2mm;line-height:1.55;font-weight:800;color:#17315b;}
.orange-text{color:#f26722;}
.footer-note{margin-top:4mm;background:#eaf4ff;border-radius:4mm;padding:3mm 4mm;display:grid;grid-template-columns:12mm 1fr 12mm;align-items:center;gap:3mm;}
.footer-icon svg,.footer-person svg{width:100%;height:auto;}
.footer-text{color:#173c77;font-size:4.8mm;font-weight:900;line-height:1.45;}
@media print{html,body{background:#fff;margin:0;padding:0;}body{display:block;}.page{width:210mm;height:297mm;margin:0;padding:6mm 6mm 5mm;page-break-after:avoid;overflow:hidden;}.no-print{display:none!important;}}
`;

// HTMLテンプレート生成関数
const buildHTML = (d: ScheduleData): string => {
  const { r1, r2a, r2b } = calcReview(d.listingPrice, d.minPrice);

  // 中間月計算
  const ly = parseInt(d.listingYear, 10);
  const lm = parseInt(d.listingMonth, 10);
  const cy = parseInt(d.contractYear, 10);
  const cm = parseInt(d.contractMonth, 10);
  const mid1 = (!isNaN(ly) && !isNaN(lm) && !isNaN(cy) && !isNaN(cm))
    ? midMonth(ly, lm, cy, cm) : null;
  const mid2 = mid1 ? midMonth(mid1.year, mid1.month, cy, cm) : null;

  const m1year = mid1?.year ?? ly;
  const m1month = mid1?.month ?? (lm + 1 > 12 ? lm + 1 - 12 : lm + 1);
  const m2year = mid2?.year ?? cy;
  const m2month = mid2?.month ?? cm;

  const calSvgBlue = `<svg viewBox="0 0 72 72"><rect x="8" y="16" width="56" height="46" rx="6" fill="#fff" stroke="#1b4ea1" stroke-width="4"/><rect x="8" y="16" width="56" height="12" rx="6" fill="#1b4ea1"/><line x1="22" y1="8" x2="22" y2="20" stroke="#1b4ea1" stroke-width="4"/><line x1="50" y1="8" x2="50" y2="20" stroke="#1b4ea1" stroke-width="4"/><g stroke="#cfd8e6"><line x1="18" y1="36" x2="54" y2="36"/><line x1="18" y1="46" x2="54" y2="46"/><line x1="18" y1="56" x2="54" y2="56"/></g></svg>`;
  const calSvgGreen = `<svg viewBox="0 0 72 72"><rect x="8" y="16" width="56" height="46" rx="6" fill="#fff" stroke="#2e9e3e" stroke-width="4"/><rect x="8" y="16" width="56" height="12" rx="6" fill="#2e9e3e"/><line x1="22" y1="8" x2="22" y2="20" stroke="#2e9e3e" stroke-width="4"/><line x1="50" y1="8" x2="50" y2="20" stroke="#2e9e3e" stroke-width="4"/><g stroke="#cfe8d3"><line x1="18" y1="36" x2="54" y2="36"/><line x1="18" y1="46" x2="54" y2="46"/><line x1="18" y1="56" x2="54" y2="56"/></g></svg>`;
  const calSvgOrange = `<svg viewBox="0 0 72 72"><rect x="8" y="16" width="56" height="46" rx="6" fill="#fff" stroke="#f28717" stroke-width="4"/><rect x="8" y="16" width="56" height="12" rx="6" fill="#f28717"/><line x1="22" y1="8" x2="22" y2="20" stroke="#f28717" stroke-width="4"/><line x1="50" y1="8" x2="50" y2="20" stroke="#f28717" stroke-width="4"/><g stroke="#f5dfc4"><line x1="18" y1="36" x2="54" y2="36"/><line x1="18" y1="46" x2="54" y2="46"/><line x1="18" y1="56" x2="54" y2="56"/></g></svg>`;
  const calSvgRed = `<svg viewBox="0 0 72 72"><rect x="8" y="16" width="56" height="46" rx="6" fill="#fff" stroke="#ea4335" stroke-width="4"/><rect x="8" y="16" width="56" height="12" rx="6" fill="#ea4335"/><line x1="22" y1="8" x2="22" y2="20" stroke="#ea4335" stroke-width="4"/><line x1="50" y1="8" x2="50" y2="20" stroke="#ea4335" stroke-width="4"/><g stroke="#f3d4d2"><line x1="18" y1="36" x2="54" y2="36"/><line x1="18" y1="46" x2="54" y2="46"/><line x1="18" y1="56" x2="54" y2="56"/></g></svg>`;

  return `<!DOCTYPE html>
<html lang="ja"><head><meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1.0"/>
<title>不動産 売却スケジュール</title>
<style>${CSS}</style>
</head><body>
<div class="page">
<header class="header">
<div class="header-top">
<div class="corner-illust left-building">
<svg viewBox="0 0 120 140" aria-hidden="true"><rect x="28" y="20" width="52" height="92" rx="3" fill="#f5e7cf" stroke="#8a6b3b" stroke-width="2"/><rect x="55" y="10" width="42" height="102" rx="3" fill="#f3e3c7" stroke="#8a6b3b" stroke-width="2"/><g fill="#8fc16b"><circle cx="18" cy="98" r="11"/><circle cx="26" cy="88" r="9"/><circle cx="102" cy="101" r="11"/><circle cx="110" cy="90" r="9"/></g><g fill="#8db7e8" stroke="#6f8dae"><rect x="35" y="28" width="10" height="12"/><rect x="50" y="28" width="10" height="12"/><rect x="65" y="28" width="10" height="12"/><rect x="35" y="46" width="10" height="12"/><rect x="50" y="46" width="10" height="12"/><rect x="65" y="46" width="10" height="12"/><rect x="62" y="24" width="10" height="12"/><rect x="77" y="24" width="10" height="12"/><rect x="62" y="42" width="10" height="12"/><rect x="77" y="42" width="10" height="12"/><rect x="62" y="60" width="10" height="12"/><rect x="77" y="60" width="10" height="12"/><rect x="62" y="78" width="10" height="12"/><rect x="77" y="78" width="10" height="12"/></g><rect x="41" y="89" width="10" height="23" fill="#caa471" stroke="#8a6b3b"/></svg>
</div>
<h1 class="title">不動産 売却スケジュール</h1>
<div class="corner-illust right-logo-wrap">
<div class="logo-area">
<img src="/kujira-fudosan-logo.png" class="kujira-logo" alt="くじら不動産"/>
<div class="logo-text">KUJIRA REAL ESTATE</div>
</div>
</div>
</div>
<div class="info-box">
<div class="info-row">
<div class="info-icon"><svg viewBox="0 0 24 24"><path d="M12 22s7-7.2 7-12a7 7 0 1 0-14 0c0 4.8 7 12 7 12z" fill="#133c87"/><circle cx="12" cy="10" r="2.6" fill="#fff"/></svg></div>
<div class="info-label">物件所在地：</div>
<div class="info-value">${d.propertyAddress || '─'}</div>
</div>
<div class="info-divider"></div>
<div class="info-row">
<div class="info-icon"><svg viewBox="0 0 24 24"><circle cx="12" cy="7" r="4" fill="#133c87"/><path d="M4 21c0-4.2 3.6-7 8-7s8 2.8 8 7" fill="#133c87"/></svg></div>
<div class="info-label">売主様：</div>
<div class="info-value">${d.sellerName ? d.sellerName + ' 様' : '─'}</div>
</div>
</div>
</header>`;
};

// HTML本体（main〜footer）生成関数
const buildHTMLBody = (d: ScheduleData): string => {
  const { r1, r2a, r2b } = calcReview(d.listingPrice, d.minPrice);
  const ly = parseInt(d.listingYear, 10);
  const lm = parseInt(d.listingMonth, 10);
  const cy = parseInt(d.contractYear, 10);
  const cm = parseInt(d.contractMonth, 10);
  const mid1 = (!isNaN(ly) && !isNaN(lm) && !isNaN(cy) && !isNaN(cm))
    ? midMonth(ly, lm, cy, cm) : { year: ly, month: lm + 1 > 12 ? 1 : lm + 1 };
  const mid2 = midMonth(mid1.year, mid1.month, cy, cm);

  const calBlue = `<svg viewBox="0 0 72 72"><rect x="8" y="16" width="56" height="46" rx="6" fill="#fff" stroke="#1b4ea1" stroke-width="4"/><rect x="8" y="16" width="56" height="12" rx="6" fill="#1b4ea1"/><line x1="22" y1="8" x2="22" y2="20" stroke="#1b4ea1" stroke-width="4"/><line x1="50" y1="8" x2="50" y2="20" stroke="#1b4ea1" stroke-width="4"/><g stroke="#cfd8e6"><line x1="18" y1="36" x2="54" y2="36"/><line x1="18" y1="46" x2="54" y2="46"/><line x1="18" y1="56" x2="54" y2="56"/></g></svg>`;
  const calGreen = `<svg viewBox="0 0 72 72"><rect x="8" y="16" width="56" height="46" rx="6" fill="#fff" stroke="#2e9e3e" stroke-width="4"/><rect x="8" y="16" width="56" height="12" rx="6" fill="#2e9e3e"/><line x1="22" y1="8" x2="22" y2="20" stroke="#2e9e3e" stroke-width="4"/><line x1="50" y1="8" x2="50" y2="20" stroke="#2e9e3e" stroke-width="4"/><g stroke="#cfe8d3"><line x1="18" y1="36" x2="54" y2="36"/><line x1="18" y1="46" x2="54" y2="46"/><line x1="18" y1="56" x2="54" y2="56"/></g></svg>`;
  const calOrange = `<svg viewBox="0 0 72 72"><rect x="8" y="16" width="56" height="46" rx="6" fill="#fff" stroke="#f28717" stroke-width="4"/><rect x="8" y="16" width="56" height="12" rx="6" fill="#f28717"/><line x1="22" y1="8" x2="22" y2="20" stroke="#f28717" stroke-width="4"/><line x1="50" y1="8" x2="50" y2="20" stroke="#f28717" stroke-width="4"/><g stroke="#f5dfc4"><line x1="18" y1="36" x2="54" y2="36"/><line x1="18" y1="46" x2="54" y2="46"/><line x1="18" y1="56" x2="54" y2="56"/></g></svg>`;
  const calRed = `<svg viewBox="0 0 72 72"><rect x="8" y="16" width="56" height="46" rx="6" fill="#fff" stroke="#ea4335" stroke-width="4"/><rect x="8" y="16" width="56" height="12" rx="6" fill="#ea4335"/><line x1="22" y1="8" x2="22" y2="20" stroke="#ea4335" stroke-width="4"/><line x1="50" y1="8" x2="50" y2="20" stroke="#ea4335" stroke-width="4"/><g stroke="#f3d4d2"><line x1="18" y1="36" x2="54" y2="36"/><line x1="18" y1="46" x2="54" y2="46"/><line x1="18" y1="56" x2="54" y2="56"/></g></svg>`;

  return `
<main class="content">
<section class="timeline-col">
<div class="timeline-line"></div>
<div class="timeline-item blue">
  <div class="year">${d.listingYear}年</div>
  <div class="month">${d.listingMonth}月</div>
  <div class="calendar">${calBlue}</div>
  <div class="dot"></div>
</div>
<div class="timeline-item green">
  <div class="year">${mid1.year}年</div>
  <div class="month">${mid1.month}月</div>
  <div class="calendar">${calGreen}</div>
  <div class="dot"></div>
</div>
<div class="timeline-item orange">
  <div class="year">${mid2.year}年</div>
  <div class="month">${mid2.month}月</div>
  <div class="calendar">${calOrange}</div>
  <div class="dot"></div>
</div>
<div class="timeline-item red">
  <div class="year">${d.contractYear}年</div>
  <div class="month">${d.contractMonth}月</div>
  <div class="calendar">${calRed}</div>
  <div class="dot"></div>
</div>
<div class="timeline-item blue bottom">
  <div class="year">${d.settlementYear}年</div>
  <div class="month">${d.settlementMonth}月</div>
  <div class="calendar">${calBlue}</div>
  <div class="dot"></div>
</div>
</section>
<section class="main-col">
<div class="step blue-box">
  <div class="step-head">
    <span class="badge">売出開始</span>
    <span class="price"><span class="num">${d.listingPrice}</span>万円</span>
  </div>
  <div class="step-inner three-col">
    <ul class="bullet-list"><li>販売スタート</li><li>写真撮影・広告作成</li><li>ポータルサイト掲載</li><li>販売活動開始</li></ul>
    <div class="icon-row">
      <svg class="icon-svg" viewBox="0 0 80 60"><rect x="16" y="18" width="48" height="32" rx="5" fill="#444"/><rect x="24" y="12" width="12" height="8" rx="2" fill="#666"/><circle cx="40" cy="34" r="12" fill="#91b4d8"/><circle cx="40" cy="34" r="7" fill="#2c3e50"/></svg>
      <svg class="icon-svg wide" viewBox="0 0 100 60"><rect x="18" y="8" width="52" height="34" rx="3" fill="#7faad8" stroke="#597ca0"/><rect x="22" y="12" width="44" height="26" fill="#f6f8fb"/><rect x="42" y="18" width="10" height="10" fill="#f0d29c" stroke="#8b6e45"/><polygon points="47,14 39,20 55,20" fill="#4b83c5"/><rect x="12" y="44" width="64" height="6" rx="3" fill="#707780"/></svg>
      <svg class="icon-svg" viewBox="0 0 70 60"><polygon points="12,28 42,16 42,42 12,30" fill="#2c78c4"/><rect x="6" y="25" width="10" height="8" rx="2" fill="#1f5f9e"/><rect x="16" y="32" width="8" height="12" transform="rotate(-20 20 38)" fill="#1f5f9e"/><line x1="49" y1="18" x2="58" y2="12" stroke="#f6a21a" stroke-width="3"/><line x1="51" y1="29" x2="63" y2="29" stroke="#f6a21a" stroke-width="3"/></svg>
    </div>
  </div>
</div>
<div class="middle-row">
  <div class="step green-box">
    <div class="step-head single"><span class="badge green">反響確認・販売強化</span></div>
    <div class="step-inner two-col">
      <ul class="bullet-list"><li>お問い合わせ状況を確認</li><li>広告の見直し</li><li>ご案内対応</li><li>市場動向を見ながら価格を調整</li></ul>
      <div class="small-illust-area">
        <svg class="icon-svg large" viewBox="0 0 140 90"><circle cx="36" cy="34" r="20" fill="#f4f4f4" stroke="#888" stroke-width="4"/><line x1="50" y1="48" x2="65" y2="63" stroke="#777" stroke-width="6" stroke-linecap="round"/><rect x="74" y="18" width="44" height="34" rx="4" fill="#fff" stroke="#9aa8b8"/><line x1="80" y1="44" x2="110" y2="44" stroke="#ccd6e1"/><polyline points="82,40 90,34 98,38 108,22" fill="none" stroke="#6ca0e1" stroke-width="3"/></svg>
        <svg class="people-svg" viewBox="0 0 130 90"><circle cx="40" cy="24" r="10" fill="#f3caa8"/><path d="M28 52c0-12 8-20 12-20s12 8 12 20" fill="#c4a07c"/><circle cx="86" cy="22" r="10" fill="#f3caa8"/><path d="M72 54c0-12 9-22 14-22s14 10 14 22" fill="#708ec1"/></svg>
      </div>
    </div>
  </div>
  <div class="price-note green-note">
    <div class="note-title">価格見直し（例）</div>
    <div class="note-price">${r1}<span>万円前後</span></div>
    <div class="note-sub">（段階的な見直しです）</div>
    <div class="down-arrow green-arrow"></div>
  </div>
</div>
<div class="middle-row">
  <div class="step orange-box">
    <div class="step-head single"><span class="badge orange">さらに販売促進・再調整</span></div>
    <div class="step-inner two-col">
      <ul class="bullet-list"><li>反響状況を再分析</li><li>訴求ポイントの見直し</li><li>ご案内・交渉を継続</li></ul>
      <div class="small-illust-area">
        <svg class="icon-svg large" viewBox="0 0 130 90"><rect x="26" y="16" width="36" height="48" rx="4" fill="#fff" stroke="#8e8e8e" stroke-width="3"/><rect x="36" y="10" width="16" height="10" rx="3" fill="#b9b9b9"/><line x1="36" y1="30" x2="54" y2="30" stroke="#5d9be0" stroke-width="3"/><line x1="36" y1="40" x2="54" y2="40" stroke="#5d9be0" stroke-width="3"/><line x1="36" y1="50" x2="54" y2="50" stroke="#5d9be0" stroke-width="3"/><circle cx="92" cy="26" r="10" fill="#f3caa8"/><path d="M80 58c0-14 8-22 12-22s12 8 12 22" fill="#708ec1"/></svg>
      </div>
    </div>
  </div>
  <div class="price-note orange-note">
    <div class="note-title">段階的に価格調整（例）</div>
    <div class="stack-price"><div>${r2a}<span>万円</span> →</div><div>${r2b}<span>万円</span></div></div>
    <div class="note-sub">反響を見ながら<br>少しずつ調整</div>
    <div class="down-arrow orange-arrow"></div>
  </div>
</div>
<div class="step red-box contract-box">
  <div class="contract-left">
    <div class="min-box">
      <div class="min-title">最低ライン</div>
      <div class="min-price">${d.minPrice}<span>万円</span></div>
    </div>
  </div>
  <div class="contract-center">
    <div class="contract-title">売買契約</div>
    <ul class="bullet-list red-bullets"><li>最終価格でご成約を目指します</li><li>条件調整・契約手続き</li></ul>
  </div>
  <div class="contract-right">
    <svg class="handshake-svg" viewBox="0 0 150 90"><path d="M20 28l25 12 16 18-15 14-22-21-15-5z" fill="#555"/><path d="M130 28l-25 12-16 18 15 14 22-21 15-5z" fill="#555"/><path d="M44 40l18 18c5 5 11 5 16 0l6-6c4-4 10-4 14 0l10 10" fill="none" stroke="#d8a17a" stroke-width="10" stroke-linecap="round"/><path d="M60 52l9 9" stroke="#b07058" stroke-width="2"/><path d="M71 52l9 9" stroke="#b07058" stroke-width="2"/><path d="M82 52l9 9" stroke="#b07058" stroke-width="2"/><line x1="80" y1="10" x2="86" y2="2" stroke="#ea4335" stroke-width="3"/><line x1="95" y1="14" x2="104" y2="8" stroke="#ea4335" stroke-width="3"/></svg>
  </div>
</div>
<div class="moving-band">
  <div class="moving-left"><svg viewBox="0 0 70 50" class="moving-boxes"><rect x="8" y="18" width="18" height="14" fill="#d4a15f" stroke="#a67636"/><rect x="23" y="12" width="20" height="18" fill="#d7a768" stroke="#a67636"/><rect x="40" y="18" width="18" height="14" fill="#ddb37a" stroke="#a67636"/></svg></div>
  <div class="moving-text"><div class="moving-main">契約後〜決済までの間にお引っ越しを完了</div><div class="moving-sub">余裕をもって新生活の準備を進めましょう！</div></div>
  <div class="moving-right"><svg viewBox="0 0 100 50" class="moving-truck"><rect x="12" y="20" width="48" height="18" rx="2" fill="#98bce8" stroke="#5b84b5"/><rect x="60" y="24" width="18" height="14" rx="2" fill="#dde6f1" stroke="#7f8a97"/><circle cx="28" cy="40" r="5" fill="#555"/><circle cx="67" cy="40" r="5" fill="#555"/></svg></div>
</div>
<div class="step blue-box settlement-box">
  <div class="step-head single"><span class="badge">決済・物件引き渡し</span></div>
  <div class="settlement-inner">
    <ul class="bullet-list"><li>残代金受領</li><li>鍵の引き渡し</li><li>売却完了</li></ul>
    <div class="settlement-icons">
      <svg class="icon-svg large" viewBox="0 0 120 90"><rect x="20" y="12" width="40" height="56" rx="3" fill="#fff" stroke="#a0a9b5"/><line x1="28" y1="28" x2="52" y2="28" stroke="#d1d8df"/><line x1="28" y1="38" x2="52" y2="38" stroke="#d1d8df"/><line x1="28" y1="48" x2="52" y2="48" stroke="#d1d8df"/><circle cx="52" cy="58" r="5" fill="#fff" stroke="#e4453a" stroke-width="3"/><line x1="74" y1="64" x2="96" y2="40" stroke="#d69232" stroke-width="6" stroke-linecap="round"/><circle cx="74" cy="64" r="4" fill="#666"/></svg>
      <svg class="icon-svg large" viewBox="0 0 120 90"><circle cx="28" cy="40" r="14" fill="none" stroke="#6d6d6d" stroke-width="6"/><rect x="40" y="36" width="32" height="8" rx="4" fill="#8d8d8d"/><rect x="72" y="33" width="14" height="14" fill="#efc365" stroke="#a67a22"/><polygon points="79,24 68,33 90,33" fill="#d3953c"/></svg>
      <svg class="couple-svg" viewBox="0 0 130 100"><circle cx="40" cy="24" r="12" fill="#f3caa8"/><path d="M24 68c0-19 10-30 16-30s16 11 16 30" fill="#8db7e8"/><circle cx="88" cy="24" r="12" fill="#f3caa8"/><path d="M72 68c0-19 10-30 16-30s16 11 16 30" fill="#f3d35f"/></svg>
    </div>
  </div>
</div>
</section>
<aside class="side-col">
<div class="side-main-box">
  <div class="crown-line"><svg viewBox="0 0 80 40" class="crown-svg"><path d="M10 28h60l-4-18-14 10-12-14-12 14-14-10z" fill="#f0b90b" stroke="#d39500" stroke-width="2"/><circle cx="16" cy="8" r="3" fill="#f0b90b"/><circle cx="40" cy="4" r="3" fill="#f0b90b"/><circle cx="64" cy="8" r="3" fill="#f0b90b"/></svg></div>
  <div class="side-heading"><div>くじら不動産が</div><div class="accent">市場反応</div><div>をみながら、</div></div>
  <div class="service-btn green-btn"><span class="btn-icon"><svg viewBox="0 0 40 30"><polygon points="6,15 22,8 22,22 6,15" fill="#3b9b52"/><rect x="2" y="12" width="6" height="6" rx="2" fill="#2f8043"/></svg></span><span>広告</span></div>
  <div class="service-btn blue-btn"><span class="btn-icon"><svg viewBox="0 0 40 30"><circle cx="13" cy="11" r="5" fill="#4b90cf"/><circle cx="25" cy="11" r="5" fill="#4b90cf"/><path d="M5 24c1-5 5-8 8-8s7 3 8 8" fill="#4b90cf"/><path d="M17 24c1-5 5-8 8-8s7 3 8 8" fill="#4b90cf"/></svg></span><span>ご案内</span></div>
  <div class="service-btn orange-btn"><span class="btn-icon"><svg viewBox="0 0 40 30"><circle cx="15" cy="13" r="8" fill="none" stroke="#d08b15" stroke-width="3"/><line x1="21" y1="19" x2="29" y2="27" stroke="#d08b15" stroke-width="3"/></svg></span><span>価格見直し</span></div>
  <div class="side-copy"><div>を行い、</div><div class="accent big">段階的に</div><div>売却を進める</div><div>スケジュールです</div></div>
  <div class="agent-illust"><svg viewBox="0 0 150 180"><circle cx="74" cy="40" r="22" fill="#f3caa8"/><path d="M52 104c0-30 12-48 22-48s22 18 22 48" fill="#6f8fc2"/><path d="M52 104h44l10 52H42z" fill="#6f8fc2"/><polygon points="74,62 66,78 82,78" fill="#fff"/><rect x="71" y="78" width="6" height="16" fill="#234d86"/><rect x="94" y="104" width="24" height="34" rx="2" fill="#4b4b4b"/><rect x="36" y="92" width="8" height="38" rx="4" fill="#f3caa8"/><circle cx="40" cy="86" r="7" fill="#f3caa8"/><line x1="40" y1="80" x2="40" y2="58" stroke="#f3caa8" stroke-width="6" stroke-linecap="round"/></svg></div>
</div>
<div class="point-box">
  <div class="point-head">ポイント</div>
  <div class="point-text">価格を一度に下げるのではなく、<br>市場の反応を確認しながら、<br><span class="orange-text">段階的に調整</span>することで、<br>適正な価格での成約を<br>目指します。<br><br>売主様と二人三脚で、<br>納得のいく売却を<br>サポートします！</div>
</div>
</aside>
</main>
<footer class="footer-note">
<div class="footer-icon"><svg viewBox="0 0 60 60"><circle cx="30" cy="30" r="28" fill="#0e4997"/><rect x="27" y="14" width="6" height="24" rx="3" fill="#fff"/><circle cx="30" cy="46" r="4" fill="#fff"/></svg></div>
<div class="footer-text">市場状況や反響状況により、スケジュール・価格は柔軟に見直していきます。<br>定期的にご報告し、最善の売却を目指しますのでご安心ください。</div>
<div class="footer-person"><svg viewBox="0 0 80 70"><circle cx="40" cy="18" r="12" fill="#f3caa8"/><path d="M24 58c0-18 10-28 16-28s16 10 16 28" fill="#b6bcc7"/></svg></div>
</footer>
</div></body></html>`;
};

// ────────────────────────────────────────────────
// メインページ
// ────────────────────────────────────────────────
const SalesSchedulePage: React.FC = () => {
  const [searchParams] = useSearchParams();

  const [form, setForm] = useState<ScheduleData>({
    sellerName:      searchParams.get('name')    || '',
    propertyAddress: searchParams.get('address') || '',
    listingYear:     '2026',
    listingMonth:    '',
    listingPrice:    '',
    minPrice:        '',
    contractYear:    '2026',
    contractMonth:   '',
    settlementYear:  '2026',
    settlementMonth: '',
  });
  const [showPreview, setShowPreview] = useState(false);

  const set = (k: keyof ScheduleData) =>
    (e: React.ChangeEvent<HTMLInputElement>) => setForm(p => ({ ...p, [k]: e.target.value }));

  const valid = form.listingMonth && form.listingPrice && form.minPrice
    && form.contractMonth && form.settlementMonth;

  const handlePreview = () => {
    // 別タブでHTMLを開く
    const html = buildHTML(form) + buildHTMLBody(form);
    const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    window.open(url, '_blank');
  };

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: '#f5f5f5', p: 3 }}>
      <Typography variant="h5" fontWeight="bold" color="#12418d" sx={{ mb: 3 }}>
        🏡 売却スケジュール表 作成
      </Typography>
      <Paper sx={{ p: 3, maxWidth: 560 }}>
        <Typography variant="subtitle1" fontWeight="bold" sx={{ mb: 2 }}>
          必要情報を入力してください
        </Typography>
        <Grid container spacing={2}>
          <Grid item xs={12}>
            <TextField label="売主様のお名前" placeholder="例：石嵜 絢香"
              value={form.sellerName} onChange={set('sellerName')}
              fullWidth size="small" helperText="任意。「様」は自動付与されます" />
          </Grid>
          <Grid item xs={12}>
            <TextField label="物件所在地"
              placeholder="例：福岡県福岡市西区上山門1丁目3-17 東峰マンション上山門101"
              value={form.propertyAddress} onChange={set('propertyAddress')}
              fullWidth size="small" />
          </Grid>
          <Grid item xs={4}>
            <TextField label="売出年 *" placeholder="2026"
              value={form.listingYear} onChange={set('listingYear')}
              fullWidth size="small" required type="number" />
          </Grid>
          <Grid item xs={4}>
            <TextField label="売出月 *" placeholder="7（数字のみ）"
              value={form.listingMonth} onChange={set('listingMonth')}
              fullWidth size="small" required type="number" helperText="例：7" />
          </Grid>
          <Grid item xs={4}>
            <TextField label="売出価格（万円） *" placeholder="2,590"
              value={form.listingPrice} onChange={set('listingPrice')}
              fullWidth size="small" required helperText="例：2,590" />
          </Grid>
          <Grid item xs={12}>
            <TextField label="最低価格（万円） *" placeholder="2,390"
              value={form.minPrice} onChange={set('minPrice')}
              fullWidth size="small" required helperText="売買契約時の最低ライン。例：2,390" />
          </Grid>
          <Grid item xs={4}>
            <TextField label="売買契約年 *" placeholder="2026"
              value={form.contractYear} onChange={set('contractYear')}
              fullWidth size="small" required type="number" />
          </Grid>
          <Grid item xs={4}>
            <TextField label="売買契約月 *" placeholder="10"
              value={form.contractMonth} onChange={set('contractMonth')}
              fullWidth size="small" required type="number" helperText="例：10" />
          </Grid>
          <Grid item xs={4}>
            <TextField label="決済月 *" placeholder="12"
              value={form.settlementMonth} onChange={set('settlementMonth')}
              fullWidth size="small" required type="number" helperText="例：12" />
          </Grid>
          <Grid item xs={4}>
            <TextField label="決済年 *" placeholder="2026"
              value={form.settlementYear} onChange={set('settlementYear')}
              fullWidth size="small" required type="number" />
          </Grid>
        </Grid>
        <Box sx={{ mt: 3 }}>
          <Button variant="contained" size="large" disabled={!valid}
            onClick={handlePreview}
            startIcon={<PrintIcon />}
            sx={{ bgcolor: '#12418d', '&:hover': { bgcolor: '#0a2d6b' } }}>
            スケジュール表を別タブで開く（印刷・PDF保存）
          </Button>
        </Box>
        <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
          ※ 別タブで開いたページで Ctrl+P（Mac: ⌘+P）→「PDFに保存」を選択してください
        </Typography>
      </Paper>
    </Box>
  );
};

export default SalesSchedulePage;
