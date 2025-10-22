import { FiMoon, FiSun, FiMenu } from 'react-icons/fi';
import { useTheme } from '../contexts/ThemeProvider';
import './Header.css';

interface HeaderProps {
  isOpen: boolean;
  onToggleSidebar: () => void;
}

export default function Header({ isOpen, onToggleSidebar }: HeaderProps) {
  const { theme, toggleTheme } = useTheme();

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
        <h1 className="header-title">Ads Management Dashboard</h1>
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
