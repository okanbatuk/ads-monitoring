import { useMemo, useEffect } from "react";
import type { TreeNode } from "./useAccountTree";
import { useAccountTreeContext } from "@/context/AccountTreeContext";

export const useFlatTree = () => {
  const { treeNodes, expandedNodes, isNodeLoading, loadChildren, toggleNode } =
    useAccountTreeContext();

  const flatNodes = useMemo(() => {
    const result: { node: TreeNode; depth: number }[] = [];

    const walk = (nodes: TreeNode[], depth: number) => {
      for (const n of nodes) {
        const isExpanded = expandedNodes.has(n.id);
        result.push({
          node: { ...n, isExpanded },
          depth,
        });

        if (isExpanded && n.children) {
          walk(n.children, depth + 1);
        }
      }
    };

    walk(treeNodes, 0);
    return result;
  }, [treeNodes, expandedNodes]);

  return { flatNodes, isNodeLoading, loadChildren, toggleNode };
};
