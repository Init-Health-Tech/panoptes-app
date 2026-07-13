import { useCallback, useEffect, useState } from 'react';

const STORAGE_KEY = 'panoptes.sidebar.collapsed';

function readCollapsed(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

/** Desktop sidebar collapse preference (persisted). Mobile drawer is separate. */
export function useSidebarCollapse() {
  const [collapsed, setCollapsedState] = useState(false);

  useEffect(() => {
    setCollapsedState(readCollapsed());
  }, []);

  useEffect(() => {
    const width = collapsed ? '4.5rem' : '16rem';
    document.documentElement.style.setProperty('--sidebar-offset', width);
    try {
      localStorage.setItem(STORAGE_KEY, collapsed ? '1' : '0');
    } catch {
      /* ignore */
    }
  }, [collapsed]);

  const setCollapsed = useCallback((value: boolean | ((prev: boolean) => boolean)) => {
    setCollapsedState(value);
  }, []);

  const toggle = useCallback(() => {
    setCollapsedState((prev) => !prev);
  }, []);

  return { collapsed, setCollapsed, toggle };
}
