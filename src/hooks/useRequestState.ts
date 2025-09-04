import { useState, useCallback, useRef } from 'react';

interface RequestStateHook {
  refreshTrigger: number;
  triggerRefresh: () => void;
  subscribeToRefresh: (callback: () => void) => () => void;
}

// Global state management for request data synchronization
let globalRefreshTrigger = 0;
const refreshCallbacks = new Set<() => void>();

// Custom hook for managing global request state synchronization
export const useRequestState = (): RequestStateHook => {
  const [refreshTrigger, setRefreshTrigger] = useState(globalRefreshTrigger);
  const callbackRef = useRef<(() => void) | null>(null);

  // Function to trigger global refresh across all components
  const triggerRefresh = useCallback(() => {
    globalRefreshTrigger += 1;
    
    // Update all subscribed components
    refreshCallbacks.forEach(callback => {
      try {
        callback();
      } catch (error) {
        console.error('Error in refresh callback:', error);
      }
    });
  }, []);

  // Subscribe to global refresh events
  const subscribeToRefresh = useCallback((callback: () => void) => {
    callbackRef.current = callback;
    refreshCallbacks.add(callback);
    
    // Update local refresh trigger to match global state
    setRefreshTrigger(globalRefreshTrigger);
    
    // Return unsubscribe function
    return () => {
      if (callbackRef.current) {
        refreshCallbacks.delete(callbackRef.current);
        callbackRef.current = null;
      }
    };
  }, []);

  return {
    refreshTrigger,
    triggerRefresh,
    subscribeToRefresh
  };
};

// Export singleton instance for direct access
export const requestStateManager = {
  triggerRefresh: () => {
    globalRefreshTrigger += 1;
    refreshCallbacks.forEach(callback => {
      try {
        callback();
      } catch (error) {
        console.error('Error in refresh callback:', error);
      }
    });
  }
};