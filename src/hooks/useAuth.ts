import { useState, useEffect } from 'react';

// Minimal placeholder: Try to read user from localStorage (expand with real logic as needed)
export function useAuth() {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Try to get user from localStorage (assumes user object is stored after login)
    const stored = localStorage.getItem('user');
    if (stored) {
      const parsed = JSON.parse(stored);
      console.log('[useAuth] Loaded user from localStorage:', parsed);
      setUser(parsed);
    } else {
      console.log('[useAuth] No user found in localStorage');
    }
    setLoading(false);
  }, []);

  return { user, loading };
}
