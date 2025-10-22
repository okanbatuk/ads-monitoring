import { useState, ReactNode, useCallback, memo } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { useTheme } from '../contexts/ThemeProvider';
import Sidebar from './Sidebar';
import Header from './Header';
import './MainLayout.css';

interface MainLayoutProps {
  children: ReactNode;
}

// Layout wrapper for the dashboard content
const DashboardLayout = ({ children }: { children?: ReactNode }) => {
  return (
    <div className="dashboard-layout">
      {children || <Outlet />}
    </div>
  );
};

const MemoizedSidebar = memo(Sidebar);

const MainLayout = ({ children }: MainLayoutProps) => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { theme } = useTheme();

  const toggleSidebar = useCallback(() => {
    setSidebarOpen(prev => !prev);
  }, []);

  const closeSidebar = useCallback(() => {
    setSidebarOpen(false);
  }, []);

  return (
    <div className={`app ${theme}`}>
      <div className={`sidebar-container ${sidebarOpen ? 'open' : ''}`}>
        <MemoizedSidebar isOpen={sidebarOpen} onClose={closeSidebar} />
      </div>
      
      <div className={`main-content ${sidebarOpen ? 'sidebar-open' : ''}`}>
        <Header isOpen={sidebarOpen} onToggleSidebar={toggleSidebar} />
        <main className="content">
          <DashboardLayout>{children}</DashboardLayout>
        </main>
      </div>
    </div>
  );
};

export default MainLayout;
