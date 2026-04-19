import { useCallback, useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { Button, Group, Input, PasswordInput, Stack, TextInput } from '@mantine/core';
import { signIn } from 'shared/lib/auth';

interface LoginFormProps {
  onSuccess?: () => void;
}

export function LoginForm({ onSuccess }: LoginFormProps) {
  const navigate = useNavigate();
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = useCallback(async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setIsPending(true);
    const fd = new FormData(e.currentTarget);

    const result = await signIn.email({
      email: String(fd.get('email')),
      password: String(fd.get('password')),
    }).catch((err: unknown) => ({ error: { message: String(err) } }));

    if ('error' in result && result.error) {
      setError(result.error.message ?? 'Authentication failed');
      setIsPending(false);
      return;
    }

    if (onSuccess) {
      onSuccess();
    } else {
      navigate({ to: '/' });
    }
  }, [navigate, onSuccess]);

  return (
    <form onSubmit={handleSubmit}>
      <Stack>
        <TextInput name="email" type="email" label="Email" placeholder="hello@waveatlas.com" required autoComplete="email" />
        <PasswordInput name="password" label="Password" placeholder="Your password" required minLength={6} autoComplete="current-password" />
        {error && <Input.Error>{error}</Input.Error>}
        <Group justify="flex-end" mt="md">
          <Button type="submit" radius="xl" loading={isPending}>Login</Button>
        </Group>
      </Stack>
    </form>
  );
}
