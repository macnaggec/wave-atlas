import { useCallback, useState } from 'react';
import { Button, Group, Input, PasswordInput, Stack, TextInput } from '@mantine/core';
import { signUp } from 'shared/lib/auth';

interface RegisterFormProps {
  onSuccess?: () => void;
}

export function RegisterForm({ onSuccess }: RegisterFormProps) {
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = useCallback(async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setIsPending(true);
    const fd = new FormData(e.currentTarget);
    const password = String(fd.get('password'));
    const confirm = String(fd.get('confirmPassword'));

    if (password !== confirm) {
      setError("Passwords don't match");
      setIsPending(false);
      return;
    }

    const result = await signUp.email({
      email: String(fd.get('email')),
      password,
      name: String(fd.get('name')),
    }).catch((err: unknown) => ({ error: { message: String(err) } }));

    if ('error' in result && result.error) {
      setError(result.error.message ?? 'Registration failed');
      setIsPending(false);
      return;
    }

    onSuccess?.();
  }, [onSuccess]);

  return (
    <form onSubmit={handleSubmit}>
      <Stack>
        <TextInput name="name" label="Name" placeholder="Your name" required minLength={2} />
        <TextInput name="email" type="email" label="Email" placeholder="hello@waveatlas.com" required />
        <PasswordInput name="password" label="Password" placeholder="Your password" required minLength={6} />
        <PasswordInput name="confirmPassword" label="Confirm password" placeholder="Confirm your password" required minLength={6} />
        {error && <Input.Error>{error}</Input.Error>}
        <Group justify="flex-end" mt="md">
          <Button type="submit" radius="xl" loading={isPending}>Register</Button>
        </Group>
      </Stack>
    </form>
  );
}
