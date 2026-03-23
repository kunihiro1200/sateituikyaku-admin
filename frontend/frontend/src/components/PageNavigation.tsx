import { Box, Button } from '@mui/material';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  People as PeopleIcon,
  ShoppingCart as ShoppingCartIcon,
  Home as HomeIcon,
  Assignment as AssignmentIcon,
  Public as PublicIcon,
  Share as ShareIcon,
} from '@mui/icons-material';

const NAV_COLORS = {
  '/': { main: '#e53935', light: '#ffebee', text: '#e53935' },           // 売主リスト: 赤
  '/buyers': { main: '#43a047', light: '#e8f5e9', text: '#43a047' },     // 買主リスト: 緑
  '/property-listings': { main: '#00acc1', light: '#e0f7fa', text: '#00acc1' }, // 物件リスト: 水色
  '/work-tasks': { main: '#8e24aa', light: '#f3e5f5', text: '#8e24aa' }, // 業務依頼: 紫
  '/shared-items': { main: '#fb8c00', light: '#fff3e0', text: '#fb8c00' }, // 共有: オレンジ
};

export default function PageNavigation() {
  const navigate = useNavigate();
  const location = useLocation();

  const navItems = [
    { path: '/', label: '売主リスト', icon: <HomeIcon /> },
    { path: '/buyers', label: '買主リスト', icon: <PeopleIcon /> },
    { path: '/property-listings', label: '物件リスト', icon: <ShoppingCartIcon /> },
    { path: '/work-tasks', label: '業務依頼', icon: <AssignmentIcon /> },
    { path: '/shared-items', label: '共有', icon: <ShareIcon /> },
  ];

  const handlePublicSiteClick = () => {
    window.open('/public/properties', '_blank');
  };

  return (
    <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
      <Box sx={{ display: 'flex', gap: 0.5, alignItems: 'center' }}>
        {navItems.map((item) => {
          const color = NAV_COLORS[item.path as keyof typeof NAV_COLORS];
          const isActive = item.path === '/'
            ? location.pathname === '/' || location.pathname.startsWith('/sellers')
            : location.pathname.startsWith(item.path);
          return (
            <Button
              key={item.path}
              variant="outlined"
              size="large"
              onClick={() => navigate(item.path)}
              startIcon={item.icon}
              sx={{
                minWidth: 130,
                borderColor: color.main,
                color: isActive ? '#fff' : color.text,
                backgroundColor: isActive ? color.main : color.light,
                '&:hover': {
                  backgroundColor: isActive ? color.main : `${color.main}22`,
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
