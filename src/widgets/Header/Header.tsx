'use client';

import { Suspense } from 'react';
import type { ReactNode } from 'react';
import { Group } from '@mantine/core';
import SpotSearch from 'features/SpotSearch/SpotSearch';
import { UploadIndicatorAffix } from 'features/Upload';
import type { Spot } from 'entities/Spot/types';
import { UserControl } from './UserControl';
import { CartControl } from './CartControl';
import classes from './Header.module.css';

interface HeaderProps {
  onSpotSelect: (spot: Spot) => void;
  searchEmptyAction?: (search: string) => ReactNode;
}

/**
 * Header — floating overlay header above the globe.
 *
 * Composes search (left) and user controls (right)
 * within a semantic <header> landmark.
 */
export function Header({ onSpotSelect, searchEmptyAction }: HeaderProps) {
  return (
    <header className={classes.root}>
      <div className={classes.searchBar}>
        <SpotSearch
          onSpotSelect={onSpotSelect}
          emptyAction={searchEmptyAction}
        />
      </div>
      <Group gap="sm" wrap="nowrap" align="center" className={classes.controls}>
        <Suspense>
          <UploadIndicatorAffix />
        </Suspense>
        <CartControl />
        <UserControl />
      </Group>
    </header>
  );
}
