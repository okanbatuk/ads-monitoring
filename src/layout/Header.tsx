import { FiMoon, FiSun, FiMenu, FiX } from 'react-icons/fi';
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
      <div className='flex items-center gap-4'>
        <button
          className="menu-button"
          onClick={onToggleSidebar}
          aria-label={isOpen ? 'Close menu' : 'Open menu'}
        >
          {isOpen ? <FiX size={24} /> : <FiMenu size={24} />}
        </button>
        <div style={{ cursor: 'pointer' }} onClick={() => navigate('/')}>

          <h1 className="header-title">Ads Management Dashboard</h1>
        </div>
      </div>

      <button
        className="p-2 theme-toggle rounded-full hover:bg-opacity-20 hover:bg-gray-600 dark:hover:bg-gray-400 dark:hover:bg-opacity-20 transition-colors duration-200"
        onClick={toggleTheme}
        aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
      >
        {theme === 'dark' ? (
          <FiSun className="w-5 h-5 text-yellow-300" />
        ) : (
          <FiMoon className="w-5 h-5 text-white-700" />
        )}
      </button>
    </header>
  );
}
