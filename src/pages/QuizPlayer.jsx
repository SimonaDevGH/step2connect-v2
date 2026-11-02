import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, ArrowRight, BookOpen, Check, Headphones, RotateCcw, Volume2 } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';
import { quizApi } from '../lib/quizApi';

function answerKey(user, lang, id) {
  return `s2c_quiz:${user?.phone || user?.email || user?.sub || 'guest'}:${lang}:${id}`;
}

export default function QuizPlayer() {
  const { id } = useParams();
  const { lang, t } = useLanguage();
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [quiz, setQuiz] = useState(null);
  const [catalog, setCatalog] = useState([]);
  const [progress, setProgress] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState({});
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);
  const [confetti, setConfetti] = useState(false);
  const scope = answerKey(user, lang, id);
  const [loadedScope, setLoadedScope] = useState('');
  const scopeRef = useRef(scope);
  scopeRef.current = scope;

  useEffect(() => {
    let active = true;
    setLoading(true); setError(''); setResult(null);
    Promise.all([quizApi(`/api/quiz/${encodeURIComponent(id)}?lang=${lang}`), quizApi('/api/quiz/progress'), quizApi(`/api/quiz?lang=${lang}`)])
      .then(([record, saved, all]) => {
        if (!active) return;
        setQuiz(record.quiz);
        setCatalog(all.items || []);
        setProgress(saved.quizResults || {});
        const snapshot = sessionStorage.getItem(scope);
        if (snapshot) {
          try {
            const restored = JSON.parse(snapshot);
            if (restored.version !== JSON.stringify(record.quiz.questions)) throw new Error('Quiz aggiornato');
            setIndex(Math.min(Math.max(0, restored.index || 0), record.quiz.questions.length - 1));
            setAnswers(restored.answers || {});
          } catch { sessionStorage.removeItem(scope); setIndex(0); setAnswers({}); }
        } else { setIndex(0); setAnswers({}); }
        setLoadedScope(scope);
      })
      .catch((err) => { if (active) setError(err.message); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [id, lang, scope]);

  useEffect(() => {
    if (quiz && loadedScope === scope && !result) sessionStorage.setItem(scope, JSON.stringify({ index, answers, version: JSON.stringify(quiz.questions) }));
  }, [quiz, result, index, answers, loadedScope, scope]);

  const questions = quiz?.questions || [];
  const question = questions[index];
  const chosen = answers[question?.qid];
  const isCorrect = chosen === question?.answer;
  const nextQuiz = useMemo(() => {
    if (!quiz) return null;
    const same = catalog.filter((entry) => entry.category === quiz.category);
    const position = same.findIndex((entry) => entry.id === id);
    return [...same.slice(position + 1), ...same.slice(0, position)]
      .find((entry) => !progress[entry.id]?.passedAt) || null;
  }, [quiz, catalog, progress, id, location.state]);

  const choose = (value) => {
    if (chosen !== undefined || busy) return;
    const nextAnswers = { ...answers, [question.qid]: value };
    setAnswers(nextAnswers);
    if (value === question.answer) {
      setConfetti(true);
      window.setTimeout(() => setConfetti(false), 900);
    } else if (navigator.vibrate) navigator.vibrate(70);
  };

  const advance = async () => {
    if (index < questions.length - 1) { setIndex((n) => n + 1); return; }
    setBusy(true);
    try {
      const saved = await quizApi(`/api/quiz/${encodeURIComponent(id)}/result?lang=${lang}`, {
        method: 'POST', body: JSON.stringify({ answers }),
      });
      if (scopeRef.current !== scope) return;
      setResult(saved);
      setProgress(saved.quizResults || progress);
      sessionStorage.removeItem(answerKey(user, lang, id));
    } catch (err) { setError(err.message); }
    finally { setBusy(false); }
  };

  if (loading) return <div className="page-content quiz-page"><div className="quiz-skeleton"><i/><i/><i/></div></div>;
  if (error) return <div className="page-content quiz-page"><div className="quiz-error" role="alert"><p>{error}</p><button className="quiz-button" onClick={() => window.location.reload()}>{t('quizRetry')}</button><button className="quiz-text-button" onClick={() => navigate('/quiz')}>{t('quizBack')}</button></div></div>;
  if (!quiz || !question) return null;

  const readGuide = () => {
    const target = `${quiz.guideUrl || `/guides/${quiz.category}/${quiz.guideId}`}#${question.anchor || ''}`;
    navigate(target, { state: { fromQuiz: true, quizId: id, returnPath: `/quiz/${id}` } });
  };

  return <main className="page-content quiz-page">
    <header className="quiz-player-head">
      <button className="quiz-back" onClick={() => navigate('/quiz')} aria-label={t('quizBack')}><ArrowLeft size={20}/><span>{t('quizBack')}</span></button>
      <span className="quiz-head-title">{quiz.title}</span>
    </header>
    {!result ? <>
      <div className="quiz-segments" aria-label={`${index + 1} / ${questions.length}`}>
        {questions.map((item, i) => <span key={item.qid} className={answers[item.qid] === undefined ? 'todo' : answers[item.qid] === item.answer ? 'right' : 'miss'} />)}
      </div>
      <div className="quiz-question-meta"><span>{t('quizQuestion')} {index + 1} {t('quizOf')} {questions.length}</span><span>{t(`guideCat_${quiz.category}`)}</span></div>
      <article className="quiz-question-card">
        <p>{question.statement}</p>
        {question.audioUrl && <button className="quiz-audio" aria-label={t('quizListen')} onClick={() => document.getElementById('quiz-statement-audio')?.play()}><Volume2 size={20}/>{t('quizListen')}</button>}
        {question.audioUrl && <audio id="quiz-statement-audio" src={question.audioUrl} />}
      </article>
      {chosen === undefined ? <div className="quiz-answer-row">
        <button className="quiz-answer true" onClick={() => choose(true)}><span aria-hidden="true">👍</span><b>{t('quizTrue')}</b></button>
        <button className="quiz-answer false" onClick={() => choose(false)}><span aria-hidden="true">👎</span><b>{t('quizFalse')}</b></button>
      </div> : <section className={`quiz-feedback ${isCorrect ? 'is-right' : 'is-wrong'}`} aria-live="polite">
        {confetti && <div className="quiz-confetti" aria-hidden="true"><i/><i/><i/><i/><i/><i/><i/></div>}
        <strong>{isCorrect ? t('quizRight') : `${t('quizAlmost')} ${question.answer ? t('quizIsTrue') : t('quizIsFalse')}`}</strong>
        <p>{question.explanation}</p>
        {question.explanationAudioUrl && <button className="quiz-audio" onClick={() => document.getElementById('quiz-explanation-audio')?.play()}><Headphones size={18}/>{t('quizListen')}</button>}
        {question.explanationAudioUrl && <audio id="quiz-explanation-audio" src={question.explanationAudioUrl}/>}
        <button className="quiz-guide-link" onClick={readGuide}><BookOpen size={17}/>{t('quizReadGuide')}</button>
        <button className="quiz-continue" onClick={advance} disabled={busy}>{busy ? t('quizSaving') : index === questions.length - 1 ? t('quizFinish') : t('quizNext')}<ArrowRight size={19}/></button>
      </section>}
      <div className="quiz-footnote"><Check size={15}/>{t('quizLearningNote')}</div>
    </> : <section className="quiz-result-card">
      <span className="quiz-result-icon">{result.passed ? '✦' : '↗'}</span>
      <p className="quiz-result-kicker">{result.passed ? t('quizPassed') : t('quizKeepGoing')}</p>
      <div className="quiz-stars" aria-label={`${result.stars} ${t('quizStars')}`}>{[1,2,3].map((star) => <span key={star} className={star <= result.stars ? 'earned' : ''}>★</span>)}</div>
      <h1>{result.score} <small>/ {questions.length}</small></h1>
      <p>{t('quizScoreLabel')}</p>
      {result.badgeUnlocked && <div className="quiz-badge-unlock">✦ {t('quizBadgeUnlocked')}</div>}
      {result.saved === false && <p role="status">{t('quizNotSaved')}</p>}
      <button className="quiz-continue" disabled={!nextQuiz} onClick={() => navigate(`/quiz/${nextQuiz.id}`, { replace: true })}>{t('quizNextQuiz')}<ArrowRight size={19}/></button>
      <button className="quiz-retry" onClick={() => { sessionStorage.removeItem(answerKey(user, lang, id)); setIndex(0); setAnswers({}); setResult(null); }}><RotateCcw size={17}/>{t('quizRedo')}</button>
    </section>}
  </main>;
}
