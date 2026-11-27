import { useEffect, useState } from 'react';
import { useLanguage } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';
import { canSeeVisibility } from './sectionAccess';

const FEATURED_GUIDE_ID = 'guida-al-servizio';

export default function useFeaturedGuide() {
  const { lang } = useLanguage();
  const { user } = useAuth();
  const [publishedIds, setPublishedIds] = useState(null);
  const [featuredGuide, setFeaturedGuide] = useState(null);

  useEffect(() => {
    fetch(`/api/content?type=guides&lang=${lang}`)
      .then((response) => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return response.json();
      })
      .then((data) => {
        if (Array.isArray(data)) {
          const ids = new Set(data
            .filter((item) => canSeeVisibility(item.visibility, user))
            .map((item) => item.category)
            .filter(Boolean));
          setPublishedIds(ids);
          setFeaturedGuide(data.find((item) => item.id === FEATURED_GUIDE_ID) || null);
        }
      })
      .catch(() => {
        // Preserve the existing fallback: unavailable content does not hide categories.
      });
  }, [lang, user?.type]);

  return { publishedIds, featuredGuide };
}
