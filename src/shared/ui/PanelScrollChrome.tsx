import { createContext, useContext, type ReactNode } from 'react';
import styles from './PanelScrollChrome.module.css';

const PanelScrollChromeContext = createContext<ReactNode>(null);
const PanelScrollChromeStateContext = createContext({ hidden: false });

export const PanelScrollChromeProvider = PanelScrollChromeContext.Provider;
export const PanelScrollChromeStateProvider = PanelScrollChromeStateContext.Provider;

export function usePanelScrollChromeState() {
  return useContext(PanelScrollChromeStateContext);
}

/** Renders route-owned panel chrome inside the element that owns scrolling. */
export function PanelScrollChrome() {
  const chrome = useContext(PanelScrollChromeContext);
  const { hidden } = usePanelScrollChromeState();
  if (!chrome) return null;

  return (
    <div
      className={styles.chrome}
      data-panel-scroll-chrome
      data-hidden={hidden || undefined}
    >
      {chrome}
    </div>
  );
}
