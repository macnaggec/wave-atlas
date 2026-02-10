/**
 * Provider HOC Types
 *
 * Shared type definitions for provider Higher-Order Components
 */

import { ComponentType, ReactNode } from 'react';

/**
 * Generic HOC type that accepts a component and returns a wrapped component
 * Preserves props typing through generics
 */
export type ProviderHOC = <P extends object>(
  Component: ComponentType<P>
) => ComponentType<P>;

/**
 * Base props for components that accept children
 */
export interface PropsWithChildren {
  children: ReactNode;
}
