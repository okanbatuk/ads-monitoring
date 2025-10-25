import React, { createContext, useContext, ReactNode } from 'react';
import { useAccountTree, type UseAccountTreeReturn } from '../hooks/useAccountTree';

const AccountTreeContext = createContext<UseAccountTreeReturn | undefined>(undefined);

export const AccountTreeProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const accountTree = useAccountTree();
  return (
    <AccountTreeContext.Provider value={accountTree}>
      {children}
    </AccountTreeContext.Provider>
  );
};

export const useAccountTreeContext = () => {
  const context = useContext(AccountTreeContext);
  if (context === undefined) {
    throw new Error('useAccountTreeContext must be used within an AccountTreeProvider');
  }
  return context;
};
