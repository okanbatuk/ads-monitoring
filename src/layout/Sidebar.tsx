// src/components/Sidebar.tsx
import { useLocation, useNavigate } from 'react-router-dom';
import { type TreeNode } from '@/hooks/useAccountTree';
import { FiChevronDown, FiChevronRight, FiLoader } from 'react-icons/fi';
import { useFlatTree } from '@/hooks/useFlatTree';
import "./Sidebar.css";
import { useMemo, useRef } from 'react';
import { useAccountTreeContext } from '@/context/AccountTreeContext';
import { useTheme } from '@/contexts/ThemeProvider';
import { useState, useEffect } from 'react';
import { ChevronDown, ChevronRight, Search, X } from 'lucide-react';

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

const Sidebar = ({ isOpen, onClose }: SidebarProps) => {
  const location = useLocation();
  const navigate = useNavigate();
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const searchInputRef = useRef<HTMLInputElement>(null);
  const searchContainerRef = useRef<HTMLDivElement>(null);
  const { expandedNodes } = useAccountTreeContext();
  const showSearchButton = expandedNodes.size > 0;

  // Handle click outside to close search
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (isSearchOpen && searchContainerRef.current && !searchContainerRef.current.contains(event.target as Node)) {
        handleCloseSearch();
      }
    }

    // Handle Escape key
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape' && isSearchOpen) {
        handleCloseSearch();
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isSearchOpen]);

  const handleSearchClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsSearchOpen(true);
    // Focus the input after a small delay to ensure it's visible
    setTimeout(() => {
      searchInputRef.current?.focus();
    }, 100);
  };

  const handleCloseSearch = () => {
    setIsSearchOpen(false);
    setSearchQuery('');
  };

  const { flatNodes: originalFlatNodes, isNodeLoading, loadChildren, toggleNode } = useFlatTree();
  const { theme } = useTheme();

  const flatNodes = useMemo(() => {
    if (!searchQuery.trim()) {
      return originalFlatNodes;
    }
    
    const query = searchQuery.toLowerCase().trim();
    return originalFlatNodes.filter(({ node }) => 
      node.name.toLowerCase().includes(query) ||
      (node.path && node.path.toLowerCase().includes(query))
    );
  }, [originalFlatNodes, expandedNodes, searchQuery]);

  const handleRowClick = (node: TreeNode, isChevron: boolean) => {
    if (isChevron) {
      toggleNode(node.id);
    } else if (node.path) {
      navigate(node.path);
    }
  };

  // Focus search input when search is opened
  useEffect(() => {
    if (isSearchOpen && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [isSearchOpen]);

  // Close search when sidebar is closed
  useEffect(() => {
    if (!isOpen) {
      setIsSearchOpen(false);
      setSearchQuery('');
    }
  }, [isOpen]);

  if (!isOpen) return null;

  // Determine if the current route is active
  const isActive = (path: string | undefined) => {
    if (!path) return false;
    return location.pathname === path || location.pathname.startsWith(`${path}/`);
  };

  const handleContainerClick = (e: React.MouseEvent) => {
    // Only close if clicking directly on the sidebar container, not its children
    const target = e.target as HTMLElement;
    if (e.target === e.currentTarget && !target.closest('.search-button')) {
      onClose();
    }
  };

  return (
    <div 
      className={`sidebar ${theme === 'dark' ? 'dark' : ''}`}
      onClick={handleContainerClick}
    >
      <div className="sidebar-header">
        {/* Logo */}
        <div className={`logo-container ${isSearchOpen ? 'opacity-0 -translate-x-4' : ''}`}>
          <span 
            className='flex items-center gap-2 cursor-pointer'
            onClick={() => navigate('/')}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="24"
              height="24"
              viewBox="0 0 48 48"
              className="flex-shrink-0"
            >
              <polygon fill="#ffc107" points="30.129,15.75 18.871,9.25 5.871,31.25 17.129,37.75" />
              <path fill="#1e88e5" d="M31.871,37.75c1.795,3.109,5.847,4.144,8.879,2.379c3.103-1.806,4.174-5.77,2.379-8.879l-13-22c-1.795-3.109-5.835-4.144-8.879-2.379c-3.106,1.801-4.174,5.77-2.379,8.879L31.871,37.75z" />
              <circle cx="11.5" cy="34.5" r="6.5" fill="#43a047" />
            </svg>
            <h3>Google Ads</h3>
          </span>
        </div>
        
        {/* Search Input */}
        <div 
          ref={searchContainerRef}
          className={`search-container ${isSearchOpen ? 'visible' : ''}`}
        >
          <div className="relative w-full">
            <Search className="search-input-icon" />
            <input
              ref={searchInputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search..."
              className="search-input w-full"
            />
            <button 
              onClick={handleCloseSearch}
              className="close-search"
              aria-label="Close search"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
        
        {/* Search Button */}
        {showSearchButton && (
          <button 
            onClick={handleSearchClick}
            className={`search-button ${isSearchOpen ? 'hidden' : ''}`}
            aria-label="Search"
          >
            <Search className="h-4 w-4" />
          </button>
        )}
      </div>
      <div className="sidebar-content">
        {flatNodes.map(({ node, depth }) => {
          const isNodeActive = isActive(node.path);
          return (
            <div
              key={node.id}
              className={`tree-row flex items-center px-2 py-1 ${isNodeActive ? 'active' : ''}`}
              style={{ paddingLeft: `${12 + depth * 16}px` }}
            >
              {/* Chevron - only for expandable nodes */}
              {node.hasChildren ? (
                <span
                  className="cursor-pointer text-current"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleRowClick(node, true);
                  }}
                >
                  {expandedNodes.has(node.id) ? (
                    <FiChevronDown key={`${node.id}-down`} size={16} />
                  ) : (
                    <FiChevronRight key={`${node.id}-right`} size={16} />
                  )}
                </span>
              ) : (
                <span className='w-4' />
              )}

              {/* Node name - click to navigate */}
              <span
                className="node-name flex-1 truncate font-semibold"
                onClick={(e) => {
                  e.stopPropagation();
                  handleRowClick(node, false);
                }}
              >
                {node.name}
              </span>

              {/* Loading spinner or child count */}
              {isNodeLoading(node.id) ? (
                <FiLoader className="animate-spin ml-2" size={14} />
              ) : node.hasChildren && node.children?.length !== 0 && expandedNodes.has(node.id) ? (
                <span className='total-badge'>{node.children?.length}</span>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default Sidebar;
