import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, ArrowRight, BadgeCheck, ChevronRight, RefreshCw, Trophy } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';
import { GUIDE_CATEGORIES } from '../data/guides';
import { canSeeVisibility } from '../lib/sectionAccess';
import { quizApi, quizStars } from '../lib/quizApi';

export default function QuizPage() {
  const { t, lang } = useLanguage();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [items, setItems] = useState([]);
  const [progress, setProgress] = useState({});
  const [badges, setBadges] = useState({});
  const [category, setCategory] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const sequence = useRef(0);

  const load = () => {
    const request = ++sequence.current;
    setLoading(true); setError('');
    Promise.all([quizApi(`/api/quiz?lang=${lang}`), quizApi('/api/quiz/progress')])
      .then(([catalog, saved]) => {
        if (request !== sequence.current) return;
        const visible = (catalog.items || []).filter((item) => canSeeVisibility(item.visibility, user));
        setItems(visible);
        setProgress(catalog.quizResults || saved.quizResults || {});
        setBadges(catalog.badges || {});
      })
      .catch((err) => { if (request === sequence.current) setError(err.message || t('quizLoadError')); })
      .finally(() => { if (request === sequence.current) setLoading(false); });
  };
  useEffect(() => { load(); return () => { sequence.current++; }; }, [lang, user]);

  const grouped = useMemo(() => GUIDE_CATEGORIES
    .map((cat) => ({ ...cat, quizzes: items.filter((quiz) => quiz.category === cat.id) }))
    .filter((cat) => cat.quizzes.length > 0), [items]);
  const selected = grouped.find((entry) => entry.id === category);

  if (loading) return <main className="page-content quiz-page"><div className="quiz-hero"><span className="quiz-hero-mark">Q</span><h1>{t('quizTitle')}</h1><p>{t('quizDesc')}</p></div><div className="quiz-catalog-skeleton"><i/><i/><i/></div></main>;
  if (error) return <main className="page-content quiz-page"><div className="quiz-hero"><span className="quiz-hero-mark">Q</span><h1>{t('quizTitle')}</h1><p>{t('quizDesc')}</p></div><div className="quiz-empty"><p>{error}</p><button className="quiz-button" onClick={load}><RefreshCw size={17}/>{t('quizRetry')}</button></div></main>;

  return <main className="page-content quiz-page">
    <header className="quiz-hero">
      {category && <button className="quiz-hero-back" onClick={() => setCategory(null)}><ArrowLeft size={18}/>{t('quizAllCategories')}</button>}
      <span className="quiz-hero-mark" aria-hidden="true">Q</span>
      <div className="quiz-hero-copy"><p className="quiz-eyebrow">{t('quizPractice')}</p><h1>{category ? t(`guideCat_${category}`) : t('quizTitle')}</h1><p>{category ? t('quizPickChallenge') : t('quizDesc')}</p></div>
      <span className="quiz-hero-spark" aria-hidden="true">✦</span>
    </header>
    {items.length === 0 ? <section className="quiz-empty">
      <span className="quiz-empty-icon"><Trophy size={26}/></span><h2>{t('quizEmptyTitle')}</h2><p>{t('quizEmptyDesc')}</p>
    </section> : selected ? <section className="quiz-list-section">
      <div className="quiz-list-heading"><div><p className="quiz-eyebrow">{t('quizCategory')}</p><h2>{t(`guideCat_${category}`)}</h2></div><span>{selected.quizzes.length} {t('quizCount')}</span></div>
      {selected.quizzes.map((quiz) => {
        const score = progress[quiz.id];
        return <button className="quiz-list-card" key={quiz.id} onClick={() => navigate(`/quiz/${encodeURIComponent(quiz.id)}`)}>
          <span className="quiz-list-symbol">{selected.emoji || '✦'}</span>
          <span className="quiz-list-info"><strong>{quiz.title}</strong><small>{quiz.questions?.length || 0} {t('quizQuestions')} · {t('quizMinute')}</small></span>
          <span className="quiz-card-status">{score?.passedAt && <BadgeCheck size={19}/>}<span className="quiz-mini-stars">{[1,2,3].map((s) => <i key={s} className={s <= quizStars(score?.bestScore, quiz.questions?.length) ? 'earned' : ''}>★</i>)}</span></span>
          <ChevronRight size={19} className="quiz-chevron"/>
        </button>;
      })}
    </section> : <section className="quiz-category-grid">
      <div className="quiz-section-intro"><span>{t('quizChooseTopic')}</span><strong>{grouped.length} {t('quizTopics')}</strong></div>
      {grouped.map((cat) => {
        const complete = cat.quizzes.filter((quiz) => progress[quiz.id]?.passedAt).length;
        const unlocked = Boolean(badges[cat.id]) || (cat.quizzes.length > 0 && complete === cat.quizzes.length);
        const Icon = cat.icon;
        return <button key={cat.id} className="quiz-category-card" onClick={() => setCategory(cat.id)} style={{ '--category-color': cat.color }}>
          <span className="quiz-category-icon"><Icon size={23}/></span>
          <span className="quiz-category-content"><strong>{t(`guideCat_${cat.id}`)}</strong><small>{complete} {t('quizOf')} {cat.quizzes.length} {t('quizPassedPlural')}</small><span className="quiz-category-progress"><i style={{ width: `${cat.quizzes.length ? complete / cat.quizzes.length * 100 : 0}%` }}/></span></span>
          <span className={`quiz-expert ${unlocked ? 'unlocked' : ''}`} aria-label={`${t('quizExpert')} ${t(`guideCat_${cat.id}`)}`}><Trophy size={14}/><span>{t('quizExpert')}<small>{unlocked ? t('quizUnlocked') : t('quizLocked')}</small></span></span>
          <ArrowRight size={18} className="quiz-chevron"/>
        </button>;
      })}
    </section>}
  </main>;
}
