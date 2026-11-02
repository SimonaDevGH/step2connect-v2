import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { LockKeyhole, X } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';
import { GUIDE_CATEGORIES } from '../data/guides';
import { quizApi } from '../lib/quizApi';
import './quiz-badges.css';

const text = {
  it: { title: 'I miei badge', intro: 'Hai conquistato', of: 'badge su', date: 'Conquistato il', passed: 'quiz superati', go: 'Vai ai quiz', champion: 'Conquista tutti gli altri badge', championEarned: 'Complimenti! Hai conquistato tutti i badge di categoria e il titolo di Campione Step2Connect.', earned: 'Hai superato tutti i quiz di', close: 'Chiudi', quizTab: 'Quiz', section: 'Sezione quiz', retry: 'Riprova', loadError: 'Non è stato possibile caricare i badge.' },
  en: { title: 'My badges', intro: 'You have earned', of: 'badges out of', date: 'Earned on', passed: 'quizzes passed', go: 'Go to quizzes', champion: 'Earn all the other badges', championEarned: 'Congratulations! You earned every category badge and the Step2Connect Champion title.', earned: 'You passed every quiz in', close: 'Close', quizTab: 'Quizzes', section: 'Quiz section', retry: 'Retry', loadError: 'Badges could not be loaded.' },
  bn: { title: 'আমার ব্যাজ', intro: 'আপনি অর্জন করেছেন', of: 'টির মধ্যে ব্যাজ', date: 'অর্জনের তারিখ', passed: 'টি কুইজ পাস', go: 'কুইজে যান', champion: 'অন্য সব ব্যাজ অর্জন করুন', championEarned: 'অভিনন্দন! আপনি সব বিভাগের ব্যাজ এবং Step2Connect চ্যাম্পিয়ন খেতাব অর্জন করেছেন।', earned: 'আপনি এই বিভাগের সব কুইজ পাস করেছেন:', close: 'বন্ধ করুন', quizTab: 'কুইজ', section: 'কুইজ বিভাগ', retry: 'আবার চেষ্টা করুন', loadError: 'ব্যাজ লোড করা যায়নি।' },
};

export default function QuizBadgesPage() {
  const { lang, t } = useLanguage();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState(null);
  const [dataScope, setDataScope] = useState('');
  const requestSequence = useRef(0);
  const openerRef = useRef(null);
  const modalRef = useRef(null);
  const closeButtonRef = useRef(null);
  const scope = `${user?.phone || user?.email || user?.sub || 'guest'}:${lang}`;
  const copy = text[lang] || text.it;
  const tabs = <nav className="quiz-page-tabs" aria-label={copy.section}>
    <button onClick={() => navigate('/quiz')}>{copy.quizTab}</button>
    <button className="active" aria-current="page">{copy.title}</button>
  </nav>;
  const load = useCallback(() => {
    const request = ++requestSequence.current;
    setError('');
    setData(null);
    setDataScope('');
    setSelected(null);
    quizApi(`/api/quiz/badges?lang=${lang}`).then((res) => {
      if (request !== requestSequence.current) return;
      const items = res?.items;
      const complete = Array.isArray(items) && items.length === 6
        && items.every((item) => item && typeof item.id === 'string' && typeof item.emoji === 'string'
          && item.emoji && (typeof item.category === 'string' || item.category === null)
          && item.title && ['it', 'en', 'bn'].every((key) => typeof item.title[key] === 'string' && item.title[key].trim())
          && typeof item.unlocked === 'boolean' && typeof item.passed === 'number'
          && Number.isFinite(item.passed) && typeof item.total === 'number' && Number.isFinite(item.total)
          && (item.unlockedAt === null || (typeof item.unlockedAt === 'string' && !Number.isNaN(Date.parse(item.unlockedAt)))))
        && new Set(items.map((item) => item.id)).size === 6;
      if (!complete || typeof res.earned !== 'number' || !Number.isFinite(res.earned)
        || typeof res.total !== 'number' || !Number.isFinite(res.total)) {
        setError(copy.loadError);
        return;
      }
      setData(res);
      setDataScope(scope);
    }).catch((e) => {
      if (request === requestSequence.current) setError(e.message || copy.loadError);
    });
  }, [lang, scope, copy.loadError]);
  useEffect(() => {
    setData(null);
    setDataScope('');
    setSelected(null);
    setError('');
    load();
    return () => { requestSequence.current += 1; };
  }, [load]);
  useEffect(() => {
    if (!selected) return undefined;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const frame = window.requestAnimationFrame(() => closeButtonRef.current?.focus());
    const key = (event) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        setSelected(null);
        window.requestAnimationFrame(() => openerRef.current?.focus());
      }
      if (event.key === 'Tab' && modalRef.current) {
        const focusables = modalRef.current.querySelectorAll('button:not([disabled]), [href], input:not([disabled]), [tabindex]:not([tabindex="-1"])');
        if (!focusables.length) return;
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
      }
    };
    window.addEventListener('keydown', key);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener('keydown', key);
      document.body.style.overflow = previousOverflow;
      openerRef.current?.focus();
    };
  }, [selected]);
  const currentData = dataScope === scope ? data : null;
  const items = currentData?.items || [];
  const earned = Number(currentData?.earned || 0);
  const total = Number(currentData?.total || 0);
  if (!currentData && !error) return <main className="page-content quiz-page">{tabs}<div className="quiz-badges-skeleton"><i/><i/><i/><i/></div></main>;
  if (error) return <main className="page-content quiz-page">{tabs}<section className="quiz-badges-error"><p>{error}</p><button className="quiz-button" onClick={load}>↻ {copy.retry}</button></section></main>;
  return <main className="page-content quiz-page quiz-badges-page">
    {tabs}
    <header className="quiz-badges-heading"><p className="quiz-eyebrow">STEP2CONNECT</p><h1>{copy.title}</h1><p>{copy.intro} <strong>{earned}</strong> {copy.of} {total}</p><div className="quiz-badges-progress"><i style={{ width: `${Math.min(100, earned / (total || 1) * 100)}%` }}/></div></header>
    <section className="quiz-badges-grid" aria-label={copy.title}>
      {items.map((badge) => {
        const category = GUIDE_CATEGORIES.find((cat) => cat.id === badge.category);
        const unlocked = Boolean(badge.unlocked);
        const color = badge.id === 'champion' ? '#c08c35' : category?.color || '#75828a';
        const title = badge.title?.[lang] || badge.title.it;
        return <article key={badge.id} className={`quiz-badge-card ${unlocked ? 'is-unlocked' : 'is-locked'}`} style={{ '--badge-color': color }}>
          <button type="button" className="quiz-badge-open" disabled={!unlocked} onClick={(event) => { openerRef.current = event.currentTarget; setSelected(badge); }} aria-label={unlocked ? `${title}, ${copy.date}` : title}>
            <span className="quiz-badge-medallion"><span className="quiz-badge-emoji">{badge.emoji}</span>{!unlocked && <LockKeyhole className="quiz-badge-lock" size={17}/>}</span>
            <span className="quiz-badge-title">{title}</span>
            <span className="quiz-badge-category">{badge.category ? (lang === 'it' ? 'Categoria · ' : lang === 'bn' ? 'বিভাগ · ' : 'Category · ') + (category ? t(`guideCat_${badge.category}`) : badge.category) : 'STEP2CONNECT'}</span>
          </button>
          {unlocked ? <p className="quiz-badge-date">{copy.date} {badge.unlockedAt ? new Intl.DateTimeFormat(lang === 'bn' ? 'bn-BD' : lang === 'en' ? 'en-GB' : 'it-IT', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date(badge.unlockedAt)) : '—'}</p> :
            <div className="quiz-badge-locked-info">{badge.id === 'champion' ? <p>{copy.champion}</p> : <><p>{badge.passed || 0} {lang === 'it' ? 'di' : lang === 'bn' ? '/' : 'of'} {badge.total || 0} {copy.passed}</p><div className="quiz-badge-mini-progress"><i style={{ width: `${badge.total ? Math.min(100, (badge.passed || 0) / badge.total * 100) : 0}%` }}/></div><button onClick={() => navigate(`/quiz?category=${encodeURIComponent(badge.category)}`)}>{copy.go}<span aria-hidden="true"> →</span></button></>}</div>}
        </article>;
      })}
    </section>
    {selected && <div className="quiz-badge-modal-backdrop" role="presentation" onMouseDown={(e) => { if (e.target === e.currentTarget) setSelected(null); }}>
      <section ref={modalRef} className="quiz-badge-modal" role="dialog" aria-modal="true" aria-labelledby="quiz-badge-modal-title">
        <button ref={closeButtonRef} className="quiz-badge-modal-close" aria-label={copy.close} onClick={() => setSelected(null)}><X size={20}/></button><span className="quiz-badge-modal-emoji">{selected.emoji}</span>
        <p className="quiz-eyebrow">{lang === 'it' ? 'BADGE CONQUISTATO' : lang === 'bn' ? 'অর্জিত ব্যাজ' : 'BADGE EARNED'}</p>
        <h2 id="quiz-badge-modal-title">{selected.title?.[lang] || selected.title?.it || selected.id}</h2>
        <p>{selected.category ? `${copy.earned} ${t(`guideCat_${selected.category}`)}` : copy.championEarned}</p>
        <button className="quiz-badge-modal-action" onClick={() => setSelected(null)}>{copy.close}</button>
      </section>
    </div>}
  </main>;
}
