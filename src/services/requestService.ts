import api from '../utils/api';

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
      const response = await api.post('/api/requests/sql-request', requestData);
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
      const response = await api.post('/api/requests/simple-request', requestData);
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
      const response = await api.post('/api/debug/requests', requestData);
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
      const response = await api.post('/api/requests', requestData);
      return response.data;
    } catch (error) {
      console.error('Error creating request:', error);
      throw error;
    }
  },

  // Get all requests
  getAllRequests: async (): Promise<DbRequest[]> => {
    try {
      const response = await api.get('/api/requests');
      return response.data;
    } catch (error) {
      console.error('Error fetching all requests:', error);
      return [];
    }
  },

  // Get a specific request by ID
  getRequestById: async (requestId: number): Promise<DbRequest> => {
    try {
      const response = await api.get(`/api/requests/${requestId}`);
      return response.data;
    } catch (error) {
      console.error(`Error fetching request ${requestId}:`, error);
      throw error;
    }
  },

  // Update a request
  updateRequest: async (requestId: number, requestData: Partial<DbRequest>): Promise<DbRequest> => {
    try {
      const response = await api.put(`/api/requests/${requestId}`, requestData);
      return response.data;
    } catch (error) {
      console.error(`Error updating request ${requestId}:`, error);
      throw error;
    }
  },

  // Delete a request
  deleteRequest: async (requestId: number): Promise<void> => {
    try {
      await api.delete(`/api/requests/${requestId}`);
    } catch (error) {
      console.error(`Error deleting request ${requestId}:`, error);
      throw error;
    }
  },

  // Request fulfillment methods
  
  // Get assigned requests for current user
  getAssignedRequests: async (params?: { status?: string }): Promise<DbRequest[]> => {
    try {
      const queryParams = new URLSearchParams();
      if (params?.status) {
        queryParams.append('status', params.status);
      }
      
      const response = await api.get(`/api/requests/assigned/me?${queryParams}`);
      return response.data;
    } catch (error) {
      console.error('Error fetching assigned requests:', error);
      throw error;
    }
  },

  // Start working on a request (change status from P to A)
  startRequest: async (requestId: number): Promise<void> => {
    try {
      await api.post(`/api/requests/${requestId}/start`);
    } catch (error) {
      console.error(`Error starting request ${requestId}:`, error);
      throw error;
    }
  },

  // Complete a request (change status from A to D)
  completeRequest: async (requestId: number, data: { completionNotes?: string }): Promise<void> => {
    try {
      await api.post(`/api/requests/${requestId}/complete`, data);
    } catch (error) {
      console.error(`Error completing request ${requestId}:`, error);
      throw error;
    }
  },

  // Cancel a request (change status to X)
  cancelRequest: async (requestId: number, data: { cancellationReason?: string }): Promise<void> => {
    try {
      await api.post(`/api/requests/${requestId}/cancel`, data);
    } catch (error) {
      console.error(`Error cancelling request ${requestId}:`, error);
      throw error;
    }
  },

  // Update progress on a request
  updateProgress: async (requestId: number, data: { progressNotes: string }): Promise<void> => {
    try {
      await api.put(`/api/requests/${requestId}/progress`, data);
    } catch (error) {
      console.error(`Error updating progress for request ${requestId}:`, error);
      throw error;
    }
  },

  // Assign a request to a user
  assignRequest: async (requestId: number, userId: number): Promise<void> => {
    try {
      await api.post(`/api/requests/${requestId}/assign`, { userId });
    } catch (error) {
      console.error(`Error assigning request ${requestId}:`, error);
      throw error;
    }
  }
};

export default requestService;
