import { useState, useEffect } from 'react';

interface UserProfile {
  USER_ID: number;
  EMAIL: string;
  FIRST_NAME: string;
  LAST_NAME: string;
  FULL_NAME: string;
  COMPANY_ID: number;
  ROLE_NAMES: string;
  roles?: Array<{ id: number; name: string; displayName: string; }>;
  id?: number;
  userId?: number;
  firstName?: string;
  lastName?: string;
  fullName?: string;
  email?: string;
  companyId?: number;
}

// Enhanced useAuth hook with profile switching support
export function useAuth() {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadUserFromStorage();
  }, []);

  const loadUserFromStorage = () => {
    try {
      // Try to get user from localStorage
      const stored = localStorage.getItem('user');
      if (stored) {
        const parsed = JSON.parse(stored);
        console.log('[useAuth] Loaded user from localStorage:', parsed);
        setUser(parsed);
      } else {
        console.log('[useAuth] No user found in localStorage');
        setUser(null);
      }
    } catch (error) {
      console.error('[useAuth] Error loading user from localStorage:', error);
      setUser(null);
    }
    setLoading(false);
  };

  const switchUserProfile = async (newProfile: UserProfile) => {
    try {
      console.log('🔄 [useAuth] Switching to user profile:', newProfile);
      
      // Create a normalized user object that matches the expected format
      const normalizedUser = {
        ...newProfile,
        id: newProfile.USER_ID,
        userId: newProfile.USER_ID,
        firstName: newProfile.FIRST_NAME,
        lastName: newProfile.LAST_NAME,
        fullName: newProfile.FULL_NAME,
        email: newProfile.EMAIL,
        companyId: newProfile.COMPANY_ID,
        // Keep original properties for backward compatibility
        USER_ID: newProfile.USER_ID,
        EMAIL: newProfile.EMAIL,
        FIRST_NAME: newProfile.FIRST_NAME,
        LAST_NAME: newProfile.LAST_NAME,
        FULL_NAME: newProfile.FULL_NAME,
        COMPANY_ID: newProfile.COMPANY_ID,
        ROLE_NAMES: newProfile.ROLE_NAMES,
        roles: newProfile.roles || []
      };
      
      // Update localStorage
      localStorage.setItem('user', JSON.stringify(normalizedUser));
      localStorage.setItem('companyId', newProfile.COMPANY_ID.toString());
      
      // Update state
      setUser(normalizedUser);
      
      console.log('✅ [useAuth] Profile switched successfully');
      
      // Force a page reload to ensure all components update with new user context
      setTimeout(() => {
        window.location.reload();
      }, 100);
      
      return Promise.resolve(normalizedUser);
    } catch (error) {
      console.error('❌ [useAuth] Error switching user profile:', error);
      return Promise.reject(error);
    }
  };

  const switchUserRole = async (newRole: { ROLE_ID: number; ROLE_NAME: string; DISPLAY_NAME: string; DESCRIPTION?: string }) => {
    try {
      console.log('🔄 [useAuth] Switching to user role:', newRole);
      
      if (!user) {
        throw new Error('No user available for role switching');
      }
      
      // Create updated user object with new role
      const updatedUser = {
        ...user,
        roles: [{
          id: newRole.ROLE_ID,
          name: newRole.ROLE_NAME,
          displayName: newRole.DISPLAY_NAME
        }],
        ROLE_NAMES: newRole.DISPLAY_NAME || newRole.ROLE_NAME,
        role: newRole.ROLE_ID.toString()
      };
      
      // Update localStorage
      localStorage.setItem('user', JSON.stringify(updatedUser));
      
      // Update state
      setUser(updatedUser);
      
      console.log('✅ [useAuth] Role switched successfully to:', newRole.DISPLAY_NAME);
      
      // Force a page reload to ensure all components update with new role context
      setTimeout(() => {
        window.location.reload();
      }, 100);
      
      return Promise.resolve(updatedUser);
    } catch (error) {
      console.error('❌ [useAuth] Error switching user role:', error);
      return Promise.reject(error);
    }
  };

  const logout = () => {
    localStorage.removeItem('user');
    localStorage.removeItem('companyId');
    localStorage.removeItem('token');
    setUser(null);
  };

  const updateUser = (updatedUser: Partial<UserProfile>) => {
    if (user) {
      const newUser = { ...user, ...updatedUser };
      setUser(newUser);
      localStorage.setItem('user', JSON.stringify(newUser));
    }
  };

  return { 
    user, 
    loading, 
    switchUserProfile, 
    switchUserRole,
    logout, 
    updateUser,
    refreshUser: loadUserFromStorage
  };
}
