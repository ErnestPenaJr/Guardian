import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';

interface RequestContextType {
  refreshRequests: () => void;
  refreshTrigger: number;
  refreshAssignments: () => void;
  refreshAssignmentsTrigger: number;
}

const RequestContext = createContext<RequestContextType | undefined>(undefined);

export const RequestProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [refreshAssignmentsTrigger, setRefreshAssignmentsTrigger] = useState(0);

  const refreshRequests = useCallback(() => {
    setRefreshTrigger(prev => prev + 1);
  }, []);

  const refreshAssignments = useCallback(() => {
    setRefreshAssignmentsTrigger(prev => prev + 1);
  }, []);

  return (
    <RequestContext.Provider value={{
      refreshRequests,
      refreshTrigger,
      refreshAssignments,
      refreshAssignmentsTrigger,
    }}>
      {children}
    </RequestContext.Provider>
  );
};

export const useRequestContext = () => {
  const context = useContext(RequestContext);
  if (context === undefined) {
    throw new Error('useRequestContext must be used within a RequestProvider');
  }
  return context;
};
