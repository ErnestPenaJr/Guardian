import axios from 'axios';

export interface User {
  id: number;
  firstName: string;
  lastName: string;
  email: string;
  createdAt: string;
  status: string;
  roles: {
    id: number;
    name: string;
    displayName: string;
  }[];
  companyId: number | null;
}

const userService = {
  /**
   * Get all users for the current company
   * Note: This endpoint requires admin or JAFAR role permissions
   */
  getUsers: async (): Promise<User[]> => {
    try {
      // Get the JWT token from localStorage
      const token = localStorage.getItem('token');
      
      if (!token) {
        console.warn('No authentication token found');
        return [];
      }
      
      const response = await axios.get('/api/users', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      return response.data.data || [];
    } catch (error) {
      console.error('Error fetching users:', error);
      return [];
    }
  },
  
  /**
   * Get the current user's information
   */
  getCurrentUser: async (): Promise<User | null> => {
    try {
      const token = localStorage.getItem('token');
      
      if (!token) {
        console.warn('No authentication token found');
        return null;
      }
      
      const response = await axios.get('/api/me', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      return response.data;
    } catch (error) {
      console.error('Error fetching current user:', error);
      return null;
    }
  }
};

export default userService;
