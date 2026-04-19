import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { Modal } from '@mantine/core';
import { AuthPage } from './ui/AuthPage';

interface AuthModalContextValue {
  open: () => void;
  close: () => void;
}

const AuthModalContext = createContext<AuthModalContextValue | null>(null);

export function AuthModalProvider({ children }: { children: React.ReactNode }) {
  const [opened, setOpened] = useState(false);

  const open = useCallback(() => setOpened(true), []);
  const close = useCallback(() => setOpened(false), []);

  const value = useMemo(() => ({ open, close }), [open, close]);

  return (
    <AuthModalContext.Provider value={value}>
      {children}
      <Modal
        opened={opened}
        onClose={close}
        centered
        size="sm"
        title="Sign in to Wave Atlas"
        zIndex={400}
      >
        <AuthPage onSuccess={close} />
      </Modal>
    </AuthModalContext.Provider>
  );
}

export function useAuthModal(): AuthModalContextValue {
  const ctx = useContext(AuthModalContext);
  if (!ctx) throw new Error('useAuthModal must be used within AuthModalProvider');
  return ctx;
}
