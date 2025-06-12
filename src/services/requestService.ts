import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001';

// Helper function to get the authentication token from localStorage
const getAuthToken = () => {
  const token = localStorage.getItem('token');
  return token ? token : '';
};

// Configure axios with authentication headers
const axiosWithAuth = () => {
  const token = getAuthToken();
  return axios.create({
    baseURL: `${API_BASE_URL}/api`,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    }
  });
};

// Define types for database interactions
export interface DbRequest {
  REQUEST_ID?: number;
  REQUEST_NAME: string;
  EXTERNAL_USER?: string;
  SUBMITTED_DATE?: Date;
  REQUESTOR_ID?: number;
  ASSIGNED_ID?: number;
  STATUS?: string;
  CREATE_DATE?: Date;
  UPDATE_DATE?: Date;
  CREATE_USER_ID?: number;
  UPDATE_USER_ID?: number;
  TRACKINGID?: string;
  ABBREVIATION: string;
  COMPANY_ID?: number;
  REQUEST_DESCRIPTION?: string;
}

export interface DbFormInstance {
  FORM_INSTANCE_ID?: number;
  FORM_ID: number;
  ASSIGNED_ID?: number;
  SUBMITTED_DATE?: Date;
  CREATE_USER_ID?: number;
  UPDATE_USER_ID?: number;
  CREATE_DATE?: Date;
  UPDATE_DATE?: Date;
}

// Request service for handling request-related API calls
const requestService = {
  // SQL version for creating a request - uses pure SQL queries
  sqlCreateRequest: async (requestData: {
    name: string;
    abbreviation: string;
    description?: string;
    templateId?: number;
  }): Promise<any> => {
    try {
      console.log('Using SQL endpoint to create request:', requestData);
      const response = await axiosWithAuth().post('/requests/sql-request', requestData);
      return response.data;
    } catch (error) {
      console.error('Error in SQL request creation:', error);
      throw error;
    }
  },
  
  // Simple version for creating a request - uses a very simplified endpoint
  simpleCreateRequest: async (requestData: {
    name: string;
    abbreviation: string;
    description?: string;
  }): Promise<any> => {
    try {
      console.log('Using simple endpoint to create request:', requestData);
      const response = await axiosWithAuth().post('/requests/simple-request', requestData);
      return response.data;
    } catch (error) {
      console.error('Error in simple request creation:', error);
      throw error;
    }
  },
  
  // Debug version for creating a request - uses the simplified debug endpoint
  debugCreateRequest: async (requestData: {
    name: string;
    abbreviation: string;
    description?: string;
    templateId: number;
    companyId?: number;
    userId?: number;
  }): Promise<any> => {
    try {
      console.log('Using debug endpoint to create request:', requestData);
      const response = await axiosWithAuth().post('/debug/requests', requestData);
      return response.data;
    } catch (error) {
      console.error('Error in debug request creation:', error);
      throw error;
    }
  },
  
  // Create a new request
  createRequest: async (requestData: {
    name: string;
    abbreviation: string;
    description?: string;
    templateId: number;
    companyId?: number;
    userId?: number;
  }): Promise<{ request: DbRequest, formInstance: DbFormInstance }> => {
    try {
      const response = await axiosWithAuth().post('/requests', requestData);
      return response.data;
    } catch (error) {
      console.error('Error creating request:', error);
      throw error;
    }
  },

  // Get all requests
  getAllRequests: async (): Promise<DbRequest[]> => {
    try {
      const response = await axiosWithAuth().get('/requests');
      return response.data;
    } catch (error) {
      console.error('Error fetching all requests:', error);
      return [];
    }
  },

  // Get a specific request by ID
  getRequestById: async (requestId: number): Promise<DbRequest> => {
    try {
      const response = await axiosWithAuth().get(`/requests/${requestId}`);
      return response.data;
    } catch (error) {
      console.error(`Error fetching request ${requestId}:`, error);
      throw error;
    }
  },

  // Update a request
  updateRequest: async (requestId: number, requestData: Partial<DbRequest>): Promise<DbRequest> => {
    try {
      const response = await axiosWithAuth().put(`/requests/${requestId}`, requestData);
      return response.data;
    } catch (error) {
      console.error(`Error updating request ${requestId}:`, error);
      throw error;
    }
  },

  // Delete a request
  deleteRequest: async (requestId: number): Promise<void> => {
    try {
      await axiosWithAuth().delete(`/requests/${requestId}`);
    } catch (error) {
      console.error(`Error deleting request ${requestId}:`, error);
      throw error;
    }
  }
};

export default requestService;
