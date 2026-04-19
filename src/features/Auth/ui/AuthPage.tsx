import { Anchor, Divider, Group, Text } from '@mantine/core';
import { upperFirst, useToggle } from '@mantine/hooks';
import { useCallback } from 'react';
import { LoginForm } from './LoginForm';
import { RegisterForm } from './RegisterForm';

type AuthType = 'login' | 'register';

interface AuthPageProps {
  onSuccess?: () => void;
}

export function AuthPage({ onSuccess }: AuthPageProps) {
  const [authType, toggleAuthType] = useToggle<AuthType>(['login', 'register']);

  const handleRegistrationSuccess = useCallback(() => {
    toggleAuthType('login');
  }, [toggleAuthType]);

  return (
    <>
      <Text size="lg" fw={500} mb="md" ta="center">
        Welcome to Wave Atlas. {upperFirst(authType)} with:
      </Text>

      <Divider label="Continue with email" labelPosition="center" my="lg" />

      {authType === 'login' && <LoginForm onSuccess={onSuccess} />}
      {authType === 'register' && <RegisterForm onSuccess={handleRegistrationSuccess} />}

      <Group justify="space-between" mt="xl">
        <Text size="sm" c="dimmed">
          {authType === 'register' ? 'Already have an account?' : "Don't have an account?"}
        </Text>
        <Anchor component="button" type="button" c="dimmed" size="xs" onClick={() => toggleAuthType()}>
          {authType === 'register' ? 'Login' : 'Register'}
        </Anchor>
      </Group>
    </>
  );
}
