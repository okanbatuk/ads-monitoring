// src/components/Sidebar.tsx
import { useLocation, useNavigate } from 'react-router-dom';
import { useAccountTree, type TreeNode } from '@/hooks/useAccountTree';
import { FiChevronDown, FiChevronRight, FiLoader } from 'react-icons/fi';
import { useFlatTree } from '@/hooks/useFlatTree';
import "./Sidebar.css"

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

const Sidebar = ({ isOpen, onClose }: SidebarProps) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { flatNodes, isNodeLoading, loadChildren, toggleNode } = useFlatTree();
  const { expandedNodes } = useAccountTree();

  const handleRowClick = (node: TreeNode, isChevron: boolean) => {
    if (isChevron) {
      toggleNode(node.id);
    } else if (node.path) {
      navigate(node.path);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="sidebar">
      <div className="sidebar-header" onClick={() => navigate('/')}><h3>Google Ads</h3></div>
      <div className="sidebar-content">
        {flatNodes.map(({ node, depth }) => (
          <div key={node.id} className={`tree-row flex items-center px-2 py-1 ${expandedNodes.has(node.id) ? 'active' : ''}`} style={{ paddingLeft: `${12 + depth * 16}px` }}>
            {/* Chevron – sadece expand */}
            {node.hasChildren ? <span
              className="cursor-pointer"
              onClick={(e) => { e.stopPropagation(); handleRowClick(node, true); }}
            >
              {expandedNodes.has(node.id) ? <FiChevronDown key={node.id + '-down'} size={16} /> : <FiChevronRight key={node.id + '-right'} size={16} />}
            </span> : <span className='mr-1'></span>}

            {/* Node name – sadece navigate */}
            <span
              className="node-name flex-1 truncate cursor-pointer"
              onClick={(e) => { e.stopPropagation(); handleRowClick(node, false); }}
            >
              {node.name}
            </span>

            {isNodeLoading(node.id) ? <FiLoader className="animate-spin ml-2" size={14} /> : node.hasChildren && node.children?.length !== 0 && <span className='total-badge'>{node.children?.length}</span>}
          </div>
        ))}
      </div>
    </div>
  );
};

export default Sidebar;