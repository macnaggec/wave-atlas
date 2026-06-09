import { useCallback, useMemo, useState } from 'react';
import { Modal } from '@mantine/core';
import { AuthModalContext } from 'entities/Identity';
import { AuthPage } from './ui/AuthPage';

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
        overlayProps={{ backgroundOpacity: 0.45, blur: 4 }}
        styles={{ content: { borderRadius: 16, overflow: 'hidden' } }}
        zIndex={400}
      >
        <AuthPage onSuccess={close} />
      </Modal>
    </AuthModalContext.Provider>
  );
}

export { useAuthModal } from 'entities/Identity';
