import { useMemo, useState } from 'react';
import { TreeNode, useAccountTree } from './useAccountTree';

export const useLevelBasedTree = () => {
  const { treeNodes, isNodeLoading, loadChildren, toggleNode } = useAccountTree();
  const [activePath, setActivePath] = useState<string[]>([]); // [mccId, subId, campaignId]

  const flatNodes = useMemo(() => {
    const result: { node: TreeNode; depth: number }[] = [];
    const walk = (nodes: TreeNode[], depth: number, path: string[]) => {
      for (const n of nodes) {
        const currentPath = [...path, n.id];
        // Sadece aktif path’e kadar aç
        const isOnActivePath = activePath.slice(0, depth + 1).join('-') === currentPath.join('-');
        result.push({ node: n, depth });

        if (isOnActivePath && n.children) {
          walk(n.children, depth + 1, currentPath);
        }
      }
    };
    walk(treeNodes, 0, []);
    return result;
  }, [treeNodes, activePath]);

  const setActiveLevel = (newPath: string[]) => {
    setActivePath(newPath);
  };

  return { flatNodes, isNodeLoading, loadChildren, toggleNode, setActiveLevel, activePath };
};