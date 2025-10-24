import { useMemo, useEffect } from "react";
import type { TreeNode } from "./useAccountTree";
import { useAccountTreeContext } from "@/context/AccountTreeContext";

export const useFlatTree = () => {
  const { treeNodes, expandedNodes, isNodeLoading, loadChildren, toggleNode } = useAccountTreeContext();

  // Debug için expandedNodes değişikliklerini izle
  useEffect(() => {
    console.log('useFlatTree - expandedNodes changed:', Array.from(expandedNodes));
  }, [expandedNodes]);

  const flatNodes = useMemo(() => {
    console.log('useFlatTree - Recalculating flat nodes');
    const result: { node: TreeNode; depth: number }[] = [];
    
    const walk = (nodes: TreeNode[], depth: number) => {
      for (const n of nodes) {
        const isExpanded = expandedNodes.has(n.id);
        result.push({ 
          node: { ...n, isExpanded }, // isExpanded state'ini node'a ekliyoruz
          depth 
        });
        
        if (isExpanded && n.children) {
          walk(n.children, depth + 1);
        }
      }
    };
    
    walk(treeNodes, 0);
    console.log('useFlatTree - Generated flat nodes:', result);
    return result;
  }, [treeNodes, expandedNodes]);

  return { flatNodes, isNodeLoading, loadChildren, toggleNode };
};