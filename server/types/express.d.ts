declare global {
  namespace Express {
    interface User {
      id: number;
      email: string;
      firstName: string;
      lastName: string;
      roles: number[];
      COMPANY_ID: number | null;
      username: string;
      role: string;
      userId?: number; // Add userId alias for compatibility
    }
    
    interface Request {
      user?: User;
      userId?: number;
      companyId?: number;
      userRoleIds?: number[];
    }
  }
}

export {};
