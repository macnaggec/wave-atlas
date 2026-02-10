export interface LoginFormData {
  email: string;
  password: string;
}

export interface RegisterFormData {
  name: string;
  email: string;
  password: string;
  confirmPassword: string;
}

export interface AuthActionState {
  success: boolean;
  error?: string;
}

export enum AuthType {
  LOGIN = 'login',
  REGISTER = 'register',
}
