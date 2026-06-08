import React, { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useThemeContext } from "../context/ThemeContext";
import {
  Box,
  Drawer,
  AppBar,
  Toolbar,
  List,
  Typography,
  Divider,
  IconButton,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Avatar,
  Menu,
  MenuItem,
  useMediaQuery,
  useTheme
} from "@mui/material";
import {
  Menu as MenuIcon,
  LayoutDashboard,
  Users,
  FileSpreadsheet,
  LogOut,
  Moon,
  Sun,
  User as UserIcon,
  FileText,
  TrendingUp,
  MapPin,
  History,
  Settings as SettingsIcon
} from "lucide-react";

const DRAWER_WIDTH = 260;

export const DashboardLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, logout, isOwner, isManager, isWorker } = useAuth();
  const { mode, toggleTheme } = useThemeContext();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));
  const [mobileOpen, setMobileOpen] = useState(false);
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const location = useLocation();
  const navigate = useNavigate();

  const handleDrawerToggle = () => {
    setMobileOpen(!mobileOpen);
  };

  const handleMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
  };

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  // Define navigation items based on user role
  const menuItems = [
    { text: "Dashboard", path: "/", icon: <LayoutDashboard size={20} />, visible: true },
    { text: "Clients Management", path: "/clients", icon: <FileSpreadsheet size={20} />, visible: isOwner || isManager },
    { text: "My Assigned Cases", path: "/clients", icon: <FileText size={20} />, visible: isWorker },
    { text: "Employees Directory", path: "/employees", icon: <Users size={20} />, visible: isOwner },
    { text: "Reports & Analytics", path: "/reports", icon: <TrendingUp size={20} />, visible: isOwner || isManager },
    { text: "Field Visits Map", path: "/visits-live", icon: <MapPin size={20} />, visible: isOwner || isManager },
    { text: "Visit History Logs", path: "/visits-history", icon: <History size={20} />, visible: isOwner || isManager },
    { text: "Profile Settings", path: "/settings", icon: <SettingsIcon size={20} />, visible: true },
  ];

  const drawerContent = (
    <Box sx={{ height: "100%", display: "flex", flexDirection: "column", bgcolor: "background.paper" }}>
      {/* Brand Header */}
      <Box sx={{ p: 2.5, display: "flex", alignItems: "center", gap: 1.5 }}>
        <Avatar
          sx={{
            bgcolor: "primary.main",
            width: 40,
            height: 40,
            fontWeight: "bold",
            fontSize: "1.2rem",
            color: "background.paper"
          }}
        >
          SCM
        </Avatar>
        <Box>
          <Typography variant="h6" sx={{ fontWeight: 800, lineHeight: 1.1 }}>
            STAR CREDIT
          </Typography>
          <Typography variant="caption" sx={{ color: "text.secondary", fontWeight: 600 }}>
            MANAGEMENT
          </Typography>
        </Box>
      </Box>
      <Divider />

      {/* Main Nav Links */}
      <List sx={{ px: 1.5, py: 2, flexGrow: 1, display: "flex", flexDirection: "column", gap: 0.5 }}>
        {menuItems
          .filter((item) => item.visible)
          .map((item) => {
            const active = location.pathname === item.path;
            return (
              <ListItem key={item.text} disablePadding>
                <ListItemButton
                  component={Link}
                  to={item.path}
                  onClick={isMobile ? handleDrawerToggle : undefined}
                  sx={{
                    borderRadius: "8px",
                    py: 1.25,
                    px: 2,
                    bgcolor: active ? (mode === "dark" ? "rgba(255, 255, 255, 0.08)" : "rgba(0, 0, 0, 0.04)") : "transparent",
                    color: active ? "text.primary" : "text.secondary",
                    "& .MuiListItemIcon-root": {
                      color: active ? "text.primary" : "text.secondary",
                      minWidth: 40,
                    },
                    "&:hover": {
                      bgcolor: mode === "dark" ? "rgba(255, 255, 255, 0.04)" : "rgba(0, 0, 0, 0.02)",
                      color: "text.primary",
                      "& .MuiListItemIcon-root": {
                        color: "text.primary",
                      },
                    },
                  }}
                >
                  <ListItemIcon>{item.icon}</ListItemIcon>
                  <ListItemText
                    primary={item.text}
                    primaryTypographyProps={{ fontSize: "0.95rem", fontWeight: active ? 700 : 500 }}
                  />
                </ListItemButton>
              </ListItem>
            );
          })}
      </List>

      <Divider sx={{ opacity: 0.5 }} />

      {/* Agency Context and User Quick view */}
      <Box sx={{ p: 2, display: "flex", alignItems: "center", gap: 1.5 }}>
        <Avatar sx={{ bgcolor: "divider", color: "text.primary", width: 36, height: 36 }}>
          <UserIcon size={18} />
        </Avatar>
        <Box sx={{ overflow: "hidden", flexGrow: 1 }}>
          <Typography variant="body2" noWrap sx={{ fontWeight: 700 }}>
            {user?.name}
          </Typography>
          <Typography variant="caption" color="text.secondary" sx={{ textTransform: "capitalize", fontWeight: 600 }}>
            {user?.role.toLowerCase()} • {user?.agency?.name}
          </Typography>
        </Box>
      </Box>
    </Box>
  );

  return (
    <Box sx={{ display: "flex", minHeight: "100vh" }}>
      {/* Top Navbar */}
      <AppBar
        position="fixed"
        elevation={0}
        sx={{
          width: isMobile ? "100%" : `calc(100% - ${DRAWER_WIDTH}px)`,
          ml: isMobile ? 0 : `${DRAWER_WIDTH}px`,
          borderBottom: "1px solid",
          borderColor: "divider",
          bgcolor: mode === "dark" ? "rgba(0, 0, 0, 0.8)" : "rgba(248, 248, 248, 0.8)",
          backdropFilter: "blur(12px)",
          zIndex: (theme) => theme.zIndex.drawer + 1,
        }}
      >
        <Toolbar sx={{ justifyContent: "space-between", px: { xs: 2, sm: 3 } }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            {isMobile && (
              <IconButton color="inherit" aria-label="open drawer" edge="start" onClick={handleDrawerToggle} sx={{ mr: 1 }}>
                <MenuIcon size={22} />
              </IconButton>
            )}
            <Typography variant="h6" noWrap sx={{ fontWeight: 800 }}>
              {menuItems.find((item) => item.path === location.pathname)?.text || "SCM Portal"}
            </Typography>
          </Box>

          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            <IconButton onClick={toggleTheme} color="inherit">
              {mode === "dark" ? <Sun size={20} /> : <Moon size={20} />}
            </IconButton>

            <IconButton onClick={handleMenuOpen} sx={{ p: 0.5 }}>
              <Avatar sx={{ bgcolor: "primary.main", width: 34, height: 34, fontSize: "0.9rem", fontWeight: "bold" }}>
                {user?.name.charAt(0).toUpperCase()}
              </Avatar>
            </IconButton>

            <Menu
              anchorEl={anchorEl}
              open={Boolean(anchorEl)}
              onClose={handleMenuClose}
              transformOrigin={{ horizontal: "right", vertical: "top" }}
              anchorOrigin={{ horizontal: "right", vertical: "bottom" }}
              PaperProps={{
                sx: {
                  width: 200,
                  borderRadius: "12px",
                  mt: 1.5,
                  boxShadow: "0 8px 16px rgba(0, 0, 0, 0.15)",
                },
              }}
            >
              <Box sx={{ px: 2, py: 1.5 }}>
                <Typography variant="body2" sx={{ fontWeight: 700 }}>
                  {user?.name}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {user?.email}
                </Typography>
              </Box>
              <Divider />
              <MenuItem onClick={handleLogout} sx={{ color: "error.main", gap: 1.5, py: 1.25 }}>
                <LogOut size={16} />
                <Typography variant="body2" sx={{ fontWeight: 600 }}>
                  Logout
                </Typography>
              </MenuItem>
            </Menu>
          </Box>
        </Toolbar>
      </AppBar>

      {/* Navigation Drawer */}
      <Box component="nav" sx={{ width: { md: DRAWER_WIDTH }, flexShrink: { md: 0 } }}>
        {isMobile ? (
          <Drawer
            variant="temporary"
            open={mobileOpen}
            onClose={handleDrawerToggle}
            ModalProps={{ keepMounted: true }}
            sx={{
              display: { xs: "block", md: "none" },
              "& .MuiDrawer-paper": { boxSizing: "border-box", width: DRAWER_WIDTH, borderRight: "1px solid", borderColor: "divider" },
            }}
          >
            {drawerContent}
          </Drawer>
        ) : (
          <Drawer
            variant="permanent"
            open
            sx={{
              display: { xs: "none", md: "block" },
              "& .MuiDrawer-paper": { boxSizing: "border-box", width: DRAWER_WIDTH, borderRight: "1px solid", borderColor: "divider" },
            }}
          >
            {drawerContent}
          </Drawer>
        )}
      </Box>

      {/* Main Workspace Frame */}
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          p: { xs: 2.5, sm: 4 },
          width: { md: `calc(100% - ${DRAWER_WIDTH}px)` },
          minHeight: "100vh",
          mt: "64px",
          display: "flex",
          flexDirection: "column"
        }}
      >
        {children}
      </Box>
    </Box>
  );
};
