import { FiMoon, FiSun, FiMenu } from 'react-icons/fi';
import { useTheme } from '../contexts/ThemeProvider';
import './Header.css';
import { useNavigate } from 'react-router-dom';

interface HeaderProps {
  isOpen: boolean;
  onToggleSidebar: () => void;
}

export default function Header({ isOpen, onToggleSidebar }: HeaderProps) {
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();

  return (
    <header className="header">
      <div className='flex items-center gap-2'>
        <button
          className="menu-button"
          onClick={onToggleSidebar}
          aria-label={isOpen ? 'Close menu' : 'Open menu'}
        >
          <FiMenu size={24} />
        </button>
        <div style={{ cursor: 'pointer' }} onClick={() => navigate('/')}>

          <h1 className="header-title">Ads Management Dashboard</h1>
        </div>
      </div>

      {/* <button
        className="theme-toggle"
        onClick={toggleTheme}
        aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
      >
        {theme === 'dark' ? <FiSun size={20} /> : <FiMoon size={20} />}
      </button> */}
    </header>
  );
}
