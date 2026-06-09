import { createContext, useContext } from 'react';

export interface AuthModalContextValue {
  open: () => void;
  close: () => void;
}

export const AuthModalContext = createContext<
  AuthModalContextValue | null
>(null);

export function useAuthModal(): AuthModalContextValue {
  const ctx = useContext(AuthModalContext);
  if (!ctx) throw new Error('useAuthModal must be used within AuthModalProvider');

  return ctx;
}
