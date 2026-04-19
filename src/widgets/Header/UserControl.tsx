import { Avatar, Button, Menu } from '@mantine/core';
import { signOut } from 'shared/lib/auth';
import { useNavigate } from '@tanstack/react-router';
import { useCallback } from 'react';
import { useUser } from 'shared/hooks/useUser';
import { useAuthModal } from 'features/Auth/AuthModalProvider';
import classes from './Header.module.css';

/**
 * UserControl — auth-aware top-right slot.
 *
 * Renders a user avatar menu when authenticated,
 * or a Sign in button for unauthenticated visitors.
 */
export function UserControl() {
  const { user, isAuthenticated, isLoading } = useUser();
  const navigate = useNavigate();
  const { open: openAuthModal } = useAuthModal();

  const handleSignIn = useCallback(() => openAuthModal(), [openAuthModal]);
  const handleSignOut = useCallback(() => void signOut(), []);
  const handleOpenGallery = useCallback(() => void navigate({ to: '/me' }), [navigate]);
  const handleOpenAccount = useCallback(() => navigate({ to: '/account' }), [navigate]);

  if (isLoading) return null;

  if (!isAuthenticated) {
    return (
      <Button
        variant="default"
        size="sm"
        onClick={handleSignIn}
      >
        Sign in
      </Button>
    );
  }

  const initials = (user?.name ?? user?.email ?? '?').slice(0, 2).toUpperCase();

  return (
    <Menu position="bottom-end" withArrow>
      <Menu.Target>
        <Avatar
          src={user?.image}
          alt={user?.name ?? 'User'}
          variant="outline"
          color="blue"
          radius="xl"
          size={34}
          className={classes.avatar}
        >
          {initials}
        </Avatar>
      </Menu.Target>
      <Menu.Dropdown>
        <Menu.Item onClick={handleOpenGallery}>My Collection</Menu.Item>
        <Menu.Item onClick={handleOpenAccount}>Account Settings</Menu.Item>
        <Menu.Divider />
        <Menu.Item color="red" onClick={handleSignOut}>
          Sign out
        </Menu.Item>
      </Menu.Dropdown>
    </Menu>
  );
}
