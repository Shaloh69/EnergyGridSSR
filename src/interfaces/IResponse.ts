export interface ApiResponse<T = any> {
  success: boolean;
  message: string;
  data?: T;
  error?: string;
  errors?: Record<string, string[]>;
}

export interface ErrorResponse {
  success: false;
  message: string;
  error: string;
  stack?: string;
}

export interface SuccessResponse<T = any> {
  success: true;
  message: string;
  data: T;
}
