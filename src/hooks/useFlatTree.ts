import { useAccountTree } from "./useAccountTree";
import { useMemo } from "react";
import type { TreeNode } from "./useAccountTree";

export const useFlatTree = () => {
  const { treeNodes, expandedNodes, isNodeLoading, loadChildren, toggleNode } = useAccountTree();

  const flatNodes = useMemo(() => {
    const result: { node: TreeNode; depth: number }[] = [];
    const walk = (nodes: TreeNode[], depth: number) => {
      for (const n of nodes) {
        result.push({ node: n, depth });
        if (expandedNodes.has(n.id) && n.children) {
          walk(n.children, depth + 1);
        }
      }
    };
    walk(treeNodes, 0);
    return result;
  }, [treeNodes, expandedNodes]);

  return { flatNodes, isNodeLoading, loadChildren, toggleNode };
};