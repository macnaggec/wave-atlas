'use client';

import { Anchor, Divider, Group, Text } from '@mantine/core';
import { upperFirst, useToggle } from '@mantine/hooks';
import { useCallback } from 'react';
import { AuthType } from './types';
import { LoginForm, RegisterForm, SocialAuth } from './ui';

export function AuthPage() {
  const [authType, toggleAuthType] = useToggle<AuthType>([
    AuthType.LOGIN,
    AuthType.REGISTER,
  ]);

  const handleRegistrationSuccess = useCallback(() => {
    // Switch to login form after successful registration
    toggleAuthType(AuthType.LOGIN);
  }, [toggleAuthType]);

  const isLogin = authType === AuthType.LOGIN;
  const isRegister = authType === AuthType.REGISTER;

  return (
    <>
      <Text size="lg" fw={500} mb="md" ta="center">
        Welcome to Wave Atlas. {upperFirst(authType)} with:
      </Text>

      <SocialAuth />

      <Divider
        label="Or continue with email"
        labelPosition="center"
        my="lg"
      />

      {isLogin && <LoginForm />}
      {isRegister && <RegisterForm onSuccess={handleRegistrationSuccess} />}

      <Group justify="space-between" mt="xl">
        <Text size="sm" c="dimmed">
          {isRegister && 'Already have an account?'}
          {isLogin && "Don't have an account?"}
        </Text>

        <Anchor
          component="button"
          type="button"
          c="dimmed"
          size="xs"
          onClick={() => toggleAuthType()}
        >
          {isRegister && upperFirst(AuthType.LOGIN)}
          {isLogin && upperFirst(AuthType.REGISTER)}
        </Anchor>
      </Group>
    </>
  );
}

export default AuthPage;
