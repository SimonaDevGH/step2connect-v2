import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { useLanguage } from './LanguageContext';
import {
  DEFAULT_SITE_IMAGES,
  SITE_IMAGES_ID,
  normalizeSiteImages,
} from '../lib/siteImages';

const SiteImagesContext = createContext(DEFAULT_SITE_IMAGES);

export function SiteImagesProvider({ children }) {
  const { lang } = useLanguage();
  const [imagesByLanguage, setImagesByLanguage] = useState({});

  useEffect(() => {
    const controller = new AbortController();

    fetch(`/api/content?type=site&lang=${lang}`, {
      signal: controller.signal,
    })
      .then((response) => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return response.json();
      })
      .then((data) => {
        const record = Array.isArray(data)
          ? data.find((item) => item?.id === SITE_IMAGES_ID)
          : null;
        setImagesByLanguage((current) => ({
          ...current,
          [lang]: normalizeSiteImages(record?.assets),
        }));
      })
      .catch((error) => {
        if (error.name === 'AbortError') return;
        setImagesByLanguage((current) => ({
          ...current,
          [lang]: DEFAULT_SITE_IMAGES,
        }));
      });

    return () => controller.abort();
  }, [lang]);

  // Non mostrare mai per errore gli asset della lingua precedente: finché la
  // nuova versione non è pronta vengono usati i fallback locali.
  const images = useMemo(
    () => imagesByLanguage[lang] || DEFAULT_SITE_IMAGES,
    [imagesByLanguage, lang],
  );

  return (
    <SiteImagesContext.Provider value={images}>
      {children}
    </SiteImagesContext.Provider>
  );
}

export function useSiteImages() {
  return useContext(SiteImagesContext);
}