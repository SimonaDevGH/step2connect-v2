import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { DEFAULT_SECTIONS } from '../lib/sectionAccess';

const SectionsContext = createContext(null);

export function SectionsProvider({ children }) {
  const [sections, setSections] = useState(DEFAULT_SECTIONS);
  const [sectionsReady, setSectionsReady] = useState(false);
  const reloadSections = useCallback(async () => {
    try {
      const response = await fetch('/api/sections', { cache: 'no-store' });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      if (!data.sections || Object.keys(DEFAULT_SECTIONS).some((key) =>
        !['internal', 'preview', 'published'].includes(data.sections[key]?.status)
      )) throw new Error('Invalid section configuration');
      setSections(data.sections);
    } catch {
      setSections(DEFAULT_SECTIONS);
    } finally {
      setSectionsReady(true);
    }
  }, []);

  useEffect(() => { reloadSections(); }, [reloadSections]);

  return (
    <SectionsContext.Provider value={{ sections, sectionsReady, reloadSections }}>
      {children}
    </SectionsContext.Provider>
  );
}

export function useSections() {
  return useContext(SectionsContext);
}
