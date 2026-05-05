import { useState } from 'react';
import { Box, Button, Drawer, IconButton, List, ListItem, ListItemButton, ListItemIcon, ListItemText, useMediaQuery, useTheme } from '@mui/material';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  People as PeopleIcon,
  ShoppingCart as ShoppingCartIcon,
  Home as HomeIcon,
  Assignment as AssignmentIcon,
  Public as PublicIcon,
  Share as ShareIcon,
  Menu as MenuIcon,
} from '@mui/icons-material';

const NAV_COLORS = {
  '/': { main: '#e53935', light: '#ffebee', text: '#e53935' },           // 売主リスト: 赤
  '/buyers': { main: '#43a047', light: '#e8f5e9', text: '#43a047' },     // 買主リスト: 緑
  '/property-listings': { main: '#00acc1', light: '#e0f7fa', text: '#00acc1' }, // 物件リスト: 水色
  '/work-tasks': { main: '#8e24aa', light: '#f3e5f5', text: '#8e24aa' }, // 業務依頼: 紫
  '/shared-items': { main: '#fb8c00', light: '#fff3e0', text: '#fb8c00' }, // 共有: オレンジ
};

interface PageNavigationProps {
  onNavigate?: (url: string) => void;
}

export default function PageNavigation({ onNavigate }: PageNavigationProps = {}) {
  const navigate = useNavigate();
  const location = useLocation();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const [drawerOpen, setDrawerOpen] = useState(false);

  const handleNav = (path: string) => {
    if (onNavigate) {
      onNavigate(path);
    } else {
      navigate(path);
    }
    setDrawerOpen(false);
  };

  const navItems = [
    { path: '/', label: '売主リスト', icon: <HomeIcon /> },
    { path: '/buyers', label: '買主リスト', icon: <PeopleIcon /> },
    { path: '/property-listings', label: '物件リスト', icon: <ShoppingCartIcon /> },
    { path: '/work-tasks', label: '業務依頼', icon: <AssignmentIcon /> },
    { path: '/shared-items', label: '共有', icon: <ShareIcon /> },
  ];

  const handlePublicSiteClick = () => {
    window.open('https://property-site-frontend-kappa.vercel.app/public/properties', '_blank', 'noopener,noreferrer');
    setDrawerOpen(false);
  };

  const isActive = (path: string) =>
    path === '/'
      ? location.pathname === '/' || location.pathname.startsWith('/sellers')
      : location.pathname.startsWith(path);

  // モバイル: ハンバーガーアイコン + Drawer
  if (isMobile) {
    return (
      <>
        <IconButton
          onClick={() => setDrawerOpen(true)}
          aria-label="メニューを開く"
          sx={{ minHeight: 44, minWidth: 44 }}
        >
          <MenuIcon />
        </IconButton>
        <Drawer
          anchor="left"
          open={drawerOpen}
          onClose={() => setDrawerOpen(false)}
        >
          <List sx={{ width: 240, pt: 1 }}>
            {navItems.map((item) => {
              const color = NAV_COLORS[item.path as keyof typeof NAV_COLORS];
              const active = isActive(item.path);
              return (
                <ListItem key={item.path} disablePadding>
                  <ListItemButton
                    onClick={() => handleNav(item.path)}
                    sx={{
                      minHeight: 44,
                      backgroundColor: active ? color.main : color.light,
                      color: active ? '#fff' : color.text,
                      '&:hover': {
                        backgroundColor: active ? color.main : `${color.main}22`,
                      },
                      mb: 0.5,
                    }}
                  >
                    <ListItemIcon sx={{ color: 'inherit', minWidth: 36 }}>
                      {item.icon}
                    </ListItemIcon>
                    <ListItemText primary={item.label} />
                  </ListItemButton>
                </ListItem>
              );
            })}
            <ListItem disablePadding>
              <ListItemButton
                onClick={handlePublicSiteClick}
                sx={{ minHeight: 44 }}
              >
                <ListItemIcon sx={{ minWidth: 36 }}>
                  <PublicIcon />
                </ListItemIcon>
                <ListItemText primary="公開物件サイト" />
              </ListItemButton>
            </ListItem>
          </List>
        </Drawer>
      </>
    );
  }

  // デスクトップ: 既存の横並びボタン群
  return (
    <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
      <Box sx={{ display: 'flex', gap: 0.5, alignItems: 'center' }}>
        {navItems.map((item) => {
          const color = NAV_COLORS[item.path as keyof typeof NAV_COLORS];
          const active = isActive(item.path);
          return (
            <Button
              key={item.path}
              variant="outlined"
              size="large"
              onClick={() => handleNav(item.path)}
              startIcon={item.icon}
              sx={{
                minWidth: 130,
                borderColor: color.main,
                color: active ? '#fff' : color.text,
                backgroundColor: active ? color.main : color.light,
                '&:hover': {
                  backgroundColor: active ? color.main : `${color.main}22`,
                  borderColor: color.main,
                },
              }}
            >
              {item.label}
            </Button>
          );
        })}
      </Box>
      <Button
        variant="outlined"
        color="secondary"
        startIcon={<PublicIcon />}
        onClick={handlePublicSiteClick}
        sx={{ minWidth: 150 }}
      >
        公開物件サイト
      </Button>
    </Box>
  );
}
