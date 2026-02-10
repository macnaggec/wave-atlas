"use client";

import React from 'react';
import { MantineProvider, DEFAULT_THEME } from '@mantine/core';
import { Notifications } from '@mantine/notifications';
import type { ProviderHOC } from '../types';

/**
 * Mantine UI Provider HOC
 * Wraps components with Mantine theme and notifications
 */
export const withMantine: ProviderHOC = (Component) => {
  return function WithMantineProvider(props) {
    return (
      <MantineProvider theme={DEFAULT_THEME}>
        <Notifications
          position="top-right"
          zIndex={1000}
          limit={5}
          autoClose={5000}
        />
        <Component {...props} />
      </MantineProvider>
    );
  };
};
