// src/components/Sidebar.tsx
import { useLocation, useNavigate } from 'react-router-dom';
import { type TreeNode } from '@/hooks/useAccountTree';
import { FiChevronDown, FiChevronRight, FiLoader } from 'react-icons/fi';
import { useFlatTree } from '@/hooks/useFlatTree';
import "./Sidebar.css";
import { useMemo } from 'react';
import { useAccountTreeContext } from '@/context/AccountTreeContext';

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

const Sidebar = ({ isOpen, onClose }: SidebarProps) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { flatNodes: originalFlatNodes, isNodeLoading, loadChildren, toggleNode } = useFlatTree();
  const { expandedNodes } = useAccountTreeContext();

  // Debug için expandedNodes değişikliklerini izle
  console.log('Sidebar rendered. Current expandedNodes:', Array.from(expandedNodes));

  // flatNodes'u useMemo ile sarmalayarak gereksiz render'ları önle
  const flatNodes = useMemo(() => {
    console.log('Recalculating flatNodes with expandedNodes:', Array.from(expandedNodes));
    return originalFlatNodes;
  }, [originalFlatNodes, expandedNodes]);

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
      <div className="sidebar-header flex items-center gap-2" onClick={() => navigate('/')}>
        <svg xmlns="http://www.w3.org/2000/svg" x="0px" y="0px" width="24" height="24" viewBox="0 0 48 48">
          <polygon fill="#ffc107" points="30.129,15.75 18.871,9.25 5.871,31.25 17.129,37.75"></polygon><path fill="#1e88e5" d="M31.871,37.75c1.795,3.109,5.847,4.144,8.879,2.379c3.103-1.806,4.174-5.77,2.379-8.879l-13-22 c-1.795-3.109-5.835-4.144-8.879-2.379c-3.106,1.801-4.174,5.77-2.379,8.879L31.871,37.75z"></path><circle cx="11.5" cy="34.5" r="6.5" fill="#43a047"></circle>
        </svg>
        <h3>Google Ads</h3></div>
      <div className="sidebar-content">
        {flatNodes.map(({ node, depth }) => (
          <div key={node.id} className={`tree-row flex items-center px-2 py-1 ${expandedNodes.has(node.id) ? 'active' : ''}`} style={{ paddingLeft: `${12 + depth * 16}px` }}>
            {/* Chevron – sadece expand */}
            {node.hasChildren ? (
              <span
                className="cursor-pointer"
                onClick={(e) => {
                  e.stopPropagation();
                  console.log('Chevron clicked for node:', node.id, 'current expanded state:', expandedNodes.has(node.id));
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