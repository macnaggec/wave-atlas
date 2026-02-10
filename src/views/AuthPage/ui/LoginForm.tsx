'use client';

import { useCallback, useMemo, useState } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Input, PasswordInput, Stack, TextInput, Button, Group } from '@mantine/core';

interface LoginFormProps {
  onSuccess?: () => void;
  disabled?: boolean;
}

export function LoginForm({
  onSuccess,
  disabled = false
}: LoginFormProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const redirectTo = useMemo(
    () => searchParams.get('callbackUrl') || searchParams.get('redirectTo') || '/',
    [searchParams]
  );

  const isDisabled = disabled || isPending;

  const handleSubmit = useCallback(async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setIsPending(true);

    const formData = new FormData(event.currentTarget);
    const email = String(formData.get('email') || '');
    const password = String(formData.get('password') || '');

    try {
      const result = await signIn('credentials', {
        email,
        password,
        redirect: false,
        callbackUrl: redirectTo,
      });

      if (result?.error) {
        setError(result.error === 'CredentialsSignin' ? 'Invalid email or password' : 'Authentication failed');
        return;
      }

      onSuccess?.();

      // For redirects with query params or intercept routes, use hard navigation
      // to avoid Next.js 15 parallel routes/intercepting issues
      if (redirectTo.includes('?') || redirectTo.match(/^\/[a-f0-9-]{36}/i)) {
        window.location.href = redirectTo;
      } else {
        router.replace(redirectTo);
        router.refresh();
      }
    } catch {
      setError('Unable to sign in. Please try again.');
    } finally {
      setIsPending(false);
    }
  }, [onSuccess, redirectTo, router]);

  return (
    <form onSubmit={handleSubmit}>
      <Stack>
        <TextInput
          name="email"
          type="email"
          radius="md"
          label="Email"
          placeholder="hello@waveatlas.com"
          disabled={isDisabled}
          required
          autoComplete="email"
        />

        <PasswordInput
          name="password"
          label="Password"
          placeholder="Your password"
          radius="md"
          disabled={isDisabled}
          required
          minLength={6}
          autoComplete="current-password"
        />

        {error && <Input.Error>{error}</Input.Error>}

        <Group justify="flex-end" mt="md">
          <Button type="submit" radius="xl" loading={isPending} disabled={isDisabled}>
            Login
          </Button>
        </Group>
      </Stack>
    </form>
  );
}
