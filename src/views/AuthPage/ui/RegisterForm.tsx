'use client';

import { useActionState, useEffect } from 'react';
import {
  Input,
  PasswordInput,
  Stack,
  TextInput,
  Button,
  Group
} from '@mantine/core';
import { registerAction } from '../actions/register';
import type { AuthActionState } from '../types';

interface RegisterFormProps {
  onSuccess?: () => void;
  disabled?: boolean;
}

const initialState: AuthActionState = {
  success: false,
  error: undefined,
};

export function RegisterForm({
  onSuccess,
  disabled = false
}: RegisterFormProps) {
  const [
    state,
    formAction,
    isPending
  ] = useActionState(registerAction, initialState);

  useEffect(() => {
    if (state.success) {
      onSuccess?.();
    }
  }, [state.success, onSuccess]);

  const isDisabled = disabled || isPending;

  return (
    <form action={formAction}>
      <Stack>
        <TextInput
          name="name"
          radius="md"
          label="Name"
          placeholder="Your name"
          disabled={isDisabled}
          required
          minLength={2}
        />

        <TextInput
          name="email"
          type="email"
          radius="md"
          label="Email"
          placeholder="hello@waveatlas.com"
          disabled={isDisabled}
          required
        />

        <PasswordInput
          name="password"
          label="Password"
          placeholder="Your password"
          radius="md"
          disabled={isDisabled}
          required
          minLength={6}
        />

        <PasswordInput
          name="confirmPassword"
          label="Confirm password"
          placeholder="Confirm your password"
          radius="md"
          disabled={isDisabled}
          required
          minLength={6}
        />

        {state.error && <Input.Error>{state.error}</Input.Error>}

        <Group justify="flex-end" mt="md">
          <Button
            type="submit"
            radius="xl"
            loading={isPending}
            disabled={isDisabled}
          >
            Register
          </Button>
        </Group>
      </Stack>
    </form>
  );
}
