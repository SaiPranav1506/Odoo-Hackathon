declare global {
  namespace Express {
    interface Request {
      userId?: number;
      role?: 'EMPLOYEE' | 'HR';
    }
  }
}

export {};