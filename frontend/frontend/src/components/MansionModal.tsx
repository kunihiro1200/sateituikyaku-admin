import React from 'react';
import { Dialog, DialogContent, Box, Typography, IconButton } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import ApartmentIcon from '@mui/icons-material/Apartment';

interface MansionSection { title: string; points: string[]; }
interface MansionContent { brandName: string; developer: string; tagline: string; sections: MansionSection[]; summary: string; }
interface MansionModalProps { open: boolean; onClose: () => void; address: string; }

const SECTION_ICONS: Record<string, string> = {
  'ブランド・デベロッパー': '🏢',
  '構造・耐震性': '🏗️',
  '設備・仕様の特徴': '✨',
  '管理・アフターサービス': '🛡️',
  '資産価値・売却時のポイント': '💰',
};

