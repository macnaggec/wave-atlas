'use client';

import { Group, Tooltip } from '@mantine/core';
import { GoogleButton } from './GoogleButton';
import { FacebookButton } from './FacebookButton';

// TODO: Enable when OAuth providers are configured
const SOCIAL_AUTH_ENABLED = false;

interface SocialAuthProps {
  disabled?: boolean;
}

export function SocialAuth({ disabled = false }: SocialAuthProps) {
  const isDisabled = disabled || !SOCIAL_AUTH_ENABLED;

  const handleGoogleAuth = () => {
    // TODO: Implement with signIn('google') when configured
  };

  const handleFacebookAuth = () => {
    // TODO: Implement with signIn('facebook') when configured
  };

  const buttons = (
    <Group grow mb="md" mt="md">
      <GoogleButton
        radius="xl"
        disabled={isDisabled}
        onClick={handleGoogleAuth}
      >
        Google
      </GoogleButton>

      <FacebookButton
        radius="xl"
        disabled={isDisabled}
        onClick={handleFacebookAuth}
      >
        Facebook
      </FacebookButton>
    </Group>
  );

  if (!SOCIAL_AUTH_ENABLED) {
    return (
      <Tooltip label="Coming soon" position="bottom">
        {buttons}
      </Tooltip>
    );
  }

  return buttons;
}
