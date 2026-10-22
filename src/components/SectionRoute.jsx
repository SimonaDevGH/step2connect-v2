import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useSections } from '../context/SectionsContext';
import { canSeeSection } from '../lib/sectionAccess';

export default function SectionRoute({ section, children }) {
  const { user, profileReady } = useAuth();
  const { sections, sectionsReady } = useSections();
  if (!profileReady || !sectionsReady) return null;
  return canSeeSection(section, user, sections)
    ? children : <Navigate to="/home" replace />;
}
