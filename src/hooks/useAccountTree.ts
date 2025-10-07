import { useCallback, useState, useEffect } from 'react';
import type {
  AccountDto,
  CampaignDto,
  AdGroupDto,
  GetSubAccountsResponse,
  GetMccAccountsResponse
} from '../types/api.types';
import {
  useMccAccounts,
  useSubAccounts,
  useAccountCampaigns,
  useCampaignAdGroups,
  fetchApi
} from '../services/api';

export interface TreeNode {
  id: string;
  type: 'mcc' | 'account' | 'campaign' | 'adGroup';
  name: string;
  status?: string;
  children?: TreeNode[];
  parentId: string | null; // null for root nodes (MCC accounts)
  isExpanded?: boolean;
  isLoading?: boolean;
  hasChildren?: boolean;
  isMcc?: boolean; // true if this is an MCC account (parentId === null)
  path: string;
}

// Helper function to transform account data to tree node
const accountToTreeNode = (
  account: AccountDto,
  parentId: string | null,
  isMcc: boolean,
  expandedNodes: Set<string>
): TreeNode => {
  // For MCC accounts: /mcc/{accountId}
  // For sub-accounts: /mcc/{mccId}/sub/{subAccountId}
  const path = isMcc
    ? `/mcc/${account.id}`
    : `/mcc/${parentId?.replace('account-', '')}/sub/${account.id}`;

  return {
    id: `account-${account.id}`,
    type: isMcc ? 'mcc' : 'account',
    name: account.name,
    status: account.status,
    parentId,
    isMcc,
    path,
    hasChildren: true, // Always true since we want to show the expand icon
    isExpanded: expandedNodes.has(`account-${account.id}`),
    children: []
  };
};

interface UseAccountTreeReturn {
  treeNodes: TreeNode[];
  isNodeLoading: (nodeId: string) => boolean;
  loadChildren: (node: TreeNode, onComplete?: (children: TreeNode[]) => void) => Promise<void>;
  toggleNode: (nodeId: string) => Promise<void>;
  expandedNodes: Set<string>;
  setExpandedNodes: React.Dispatch<React.SetStateAction<Set<string>>>;
  isLoading: boolean;
}

export const useAccountTree = (): UseAccountTreeReturn => {
  const [treeNodes, setTreeNodes] = useState<TreeNode[]>([]);
  const [loadingNodes, setLoadingNodes] = useState<Set<string>>(new Set());
  const [isInitialized, setIsInitialized] = useState(false);

  // Helper function to update a node in the tree
  const updateNode = useCallback((nodes: TreeNode[], id: string, updates: Partial<TreeNode>): TreeNode[] => {
    return nodes.map(node => {
      if (node.id === id) {
        return { ...node, ...updates };
      }
      if (node.children) {
        return {
          ...node,
          children: updateNode(node.children, id, updates)
        };
      }
      return node;
    });
  }, []);

  // Helper function to find a node in the tree by ID
  const findNode = useCallback((nodes: TreeNode[], id: string): TreeNode | null => {
    for (const node of nodes) {
      if (node.id === id) return node;
      if (node.children) {
        const found = findNode(node.children, id);
        if (found) return found;
      }
    }
    return null;
  }, []);

  // Use the useMccAccounts hook at the top level
  const { data: mccResponse, isLoading: isLoadingMcc } = useMccAccounts();
  const [subAccountsMap, setSubAccountsMap] = useState<Record<string, AccountDto[]>>({});
  const [loadingSubAccounts, setLoadingSubAccounts] = useState<Record<string, boolean>>({});
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());

  const fetchSubAccounts = useCallback(async (accountId: string) => {
    try {
      setLoadingSubAccounts(prev => ({ ...prev, [accountId]: true }));
      const response = await fetchApi<GetSubAccountsResponse>(`/accounts/${accountId}/accounts`);
      const subAccounts = response?.data?.subAccounts || [];

      setSubAccountsMap(prev => ({
        ...prev,
        [accountId]: subAccounts
      }));

      return subAccounts;
    } catch (error) {
      console.error('Error fetching sub-accounts:', error);
      return [];
    } finally {
      setLoadingSubAccounts(prev => ({ ...prev, [accountId]: false }));
    }
  }, []);

  // Fetch accounts (MCC or sub-accounts)
  const fetchAccounts = useCallback(async (parentId: string | null): Promise<TreeNode[]> => {
    try {
      // If it's a root level request, return the MCC accounts
      if (parentId === null) {
        const accounts = mccResponse?.data?.accounts || [];
        return accounts.map(account =>
          accountToTreeNode(account, null, true, expandedNodes)
        );
      }

      // For sub-accounts, use the cached data or fetch if needed
      const mccId = parentId.replace('account-', '');
      let subAccounts = subAccountsMap[mccId];

      if (subAccounts === undefined && !loadingSubAccounts[mccId]) {
        // Fetch sub-accounts from /accounts/{mccId}/accounts
        const response = await fetchApi<GetSubAccountsResponse>(`/accounts/${mccId}/accounts`);
        subAccounts = response?.data?.subAccounts || [];

        // Update cache
        setSubAccountsMap(prev => ({
          ...prev,
          [mccId]: subAccounts
        }));
      } else if (subAccounts === undefined) {
        return [];
      }

      return subAccounts.map(account =>
        accountToTreeNode(account, parentId, false, expandedNodes)
      );
    } catch (error) {
      console.error('Error fetching accounts:', error);
      return [];
    }
  }, []);

  // Fetch campaigns for an account
  const fetchAccountCampaigns = useCallback(async (accountId: string): Promise<TreeNode[]> => {
    try {
      const response = await fetchApi<{ data: { campaigns: CampaignDto[] } }>(`/accounts/${accountId}/campaigns`);
      const campaigns = response?.data?.campaigns || [];

      return campaigns.map((campaign: CampaignDto) => ({
        id: `campaign-${campaign.id}`,
        type: 'campaign' as const,
        name: campaign.name,
        status: campaign.status,
        parentId: `account-${accountId}`,
        path: `/accounts/${accountId}/campaigns/${campaign.id}`,
        hasChildren: true,
        isExpanded: false,
        children: []
      }));
    } catch (error) {
      console.error('Error in fetchAccountCampaigns:', {
        accountId,
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      });
      return [];
    } finally {
      console.groupEnd();
    }
  }, []);

  // Fetch ad groups for a campaign
  const fetchCampaignAdGroups = useCallback(async (campaignId: string): Promise<TreeNode[]> => {
    try {
      const response = await fetchApi<{ data: { adGroups: AdGroupDto[] } }>(`/campaigns/${campaignId}/adgroups`);
      const adGroups = response?.data?.adGroups || [];

      return adGroups.map((adGroup: AdGroupDto) => ({
        id: `adgroup-${adGroup.id}`,
        type: 'adGroup' as const,
        name: adGroup.name,
        status: adGroup.status,
        parentId: `campaign-${campaignId}`,
        path: `/campaigns/${campaignId}/adgroups/${adGroup.id}`,
        hasChildren: false,
        isExpanded: false
      }));
    } catch (error) {
      console.error('Error fetching ad groups:', error);
      return [];
    }
  }, []);

  // Load children for a node
  const loadChildren = useCallback(async (node: TreeNode, onComplete?: (children: TreeNode[]) => void) => {
    if (!node.hasChildren) {
      return;
    }

    // Set loading state
    setLoadingNodes(prev => {
      const newSet = new Set(prev);
      newSet.add(node.id);
      return newSet;
    });

    try {
      let newChildren: TreeNode[] = [];

      if (node.isMcc || (node.type === 'mcc' && !node.parentId)) {
        // For MCC accounts, fetch sub-accounts
        const mccId = node.id.startsWith('account-') ? node.id.replace('account-', '') : node.id;
        newChildren = await fetchAccounts(mccId);
      } else if (node.type === 'account') {
        // For sub-accounts, fetch campaigns
        const accountId = node.id.startsWith('account-') ? node.id.replace('account-', '') : node.id;
        try {
          newChildren = await fetchAccountCampaigns(accountId);
        } catch (error) {
          throw error;
        }
      } else if (node.type === 'campaign') {
        // For campaigns, fetch ad groups
        const campaignId = node.id.replace('campaign-', '');
        newChildren = await fetchCampaignAdGroups(campaignId);
      }

      // Update the node with its children
      setTreeNodes((prev: TreeNode[]) => {
        const updateNodeWithChildren = (nodes: TreeNode[]): TreeNode[] =>
          nodes.map(n => {
            if (n.id === node.id) {
              return {
                ...n,
                children: newChildren,
                isLoading: false,
                isExpanded: true,
                hasChildren: newChildren.length > 0
              };
            }
            if (n.children) {
              return {
                ...n,
                children: updateNodeWithChildren(n.children)
              };
            }
            return n;
          });

        return updateNodeWithChildren(prev);
      });

      // Update expanded nodes set
      setExpandedNodes((prev: Set<string>) => {
        const s = new Set(prev);
        s.add(node.id);
        return s;
      });

      if (onComplete) {
        onComplete(newChildren);
      }
    } catch (error) {
      // Update node to show error state
      setTreeNodes((prev: TreeNode[]) =>
        updateNode(prev, node.id, {
          isLoading: false,
          hasChildren: false
        })
      );
    } finally {
      // Clear loading state
      setLoadingNodes((prev: Set<string>) => {
        const newSet = new Set(prev);
        newSet.delete(node.id);
        return newSet;
      });
    }
  }, [fetchAccounts, fetchAccountCampaigns, fetchCampaignAdGroups, expandedNodes]);

  // Toggle node expansion and load children 
  const toggleNode = useCallback(
    async (nodeId: string) => {
      // Don't reinitialize if we already have nodes
      if (!nodeId || treeNodes.length === 0) return;

      const node = findNode(treeNodes, nodeId);
      if (!node) return;

      // Toggle expanded state
      const isExpanded = expandedNodes.has(nodeId);
      const newExpandedNodes = new Set(expandedNodes);

      if (isExpanded) {
        newExpandedNodes.delete(nodeId);
      } else {
        newExpandedNodes.add(nodeId);
      }

      setExpandedNodes(() => (newExpandedNodes));

      // If expanding and node has children to load, load them
      if (!isExpanded) {
        // Always try to load children if it's an account node, even if it has children
        // This ensures we have the latest data
        if (node.type === 'account' || node.type === 'mcc') {
          try {
            await loadChildren(node);
          } catch (error) {
            // Error is handled in loadChildren
          }
        } else if (node.hasChildren && (!node.children || node.children.length === 0)) {
          await loadChildren(node);
        }
      }
    },
    [treeNodes, findNode, loadChildren]
  );

  // Initialize tree with MCC accounts when the component mounts
  useEffect(() => {
    const initializeTree = async () => {
      if (mccResponse?.data?.accounts && treeNodes.length === 0) {
        const accounts = mccResponse.data.accounts.map(account =>
          accountToTreeNode(account, null, true, new Set())
        );
        setTreeNodes(accounts);
      }
    };

    initializeTree();
  }, [mccResponse]);

  // Return the tree nodes and necessary functions
  return {
    treeNodes,
    isNodeLoading: (nodeId: string) => loadingNodes.has(nodeId),
    loadChildren,
    toggleNode,
    expandedNodes,
    setExpandedNodes,
    isLoading: isLoadingMcc || treeNodes.length === 0
  };
};
