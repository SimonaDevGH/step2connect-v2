import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';

// ─── MOCK DATA ────────────────────────────────────────────────────────────────
// Replace with real quiz API or CMS
// ─────────────────────────────────────────────────────────────────────────────
const QUESTIONS = [
  {
    q: { it: 'Cosa devi fare entro 8 giorni dall\'arrivo in un nuovo comune?', en: 'What must you do within 8 days of arriving in a new municipality?', bn: 'নতুন কমিউনে আসার ৮ দিনের মধ্যে কী করতে হবে?' },
    options: {
      it: ['Registrarsi all\'anagrafe', 'Aprire un conto in banca', 'Comprare un\'auto', 'Iscriversi al sindicato'],
      en: ['Register at the registry office', 'Open a bank account', 'Buy a car', 'Join a union'],
      bn: ['রেজিস্ট্রি অফিসে নিবন্ধন করুন', 'ব্যাংক অ্যাকাউন্ট খুলুন', 'গাড়ি কিনুন', 'ইউনিয়নে যোগ দিন'],
    },
    answer: 0,
  },
  {
    q: { it: 'Quanto dura di solito il primo permesso di soggiorno per lavoro?', en: 'How long does the first work residence permit usually last?', bn: 'প্রথম কাজের বাসস্থান পারমিট সাধারণত কতদিন থাকে?' },
    options: {
      it: ['1 anno', '2 anni', '5 anni', '6 mesi'],
      en: ['1 year', '2 years', '5 years', '6 months'],
      bn: ['১ বছর', '২ বছর', '৫ বছর', '৬ মাস'],
    },
    answer: 1,
  },
  {
    q: { it: 'Qual è il numero unico di emergenza in Italia?', en: 'What is the single emergency number in Italy?', bn: 'ইতালিতে একক জরুরি নম্বর কী?' },
    options: {
      it: ['999', '118', '112', '113'],
      en: ['999', '118', '112', '113'],
      bn: ['৯৯৯', '১১৮', '১১২', '১১৩'],
    },
    answer: 2,
  },
  {
    q: { it: 'Il codice fiscale è composto da quanti caratteri?', en: 'How many characters is the codice fiscale?', bn: 'কোডিচে ফিসকালে কতটি অক্ষর আছে?' },
    options: {
      it: ['10', '14', '16', '20'],
      en: ['10', '14', '16', '20'],
      bn: ['১০', '১৪', '১৬', '২০'],
    },
    answer: 2,
  },
];

export default function QuizPage() {
  const { t, lang } = useLanguage();
  const navigate = useNavigate();
  const [started, setStarted] = useState(false);
  const [current, setCurrent] = useState(0);
  const [selected, setSelected] = useState(null);
  const [score, setScore] = useState(0);
  const [finished, setFinished] = useState(false);

  const q = QUESTIONS[current];

  const handleAnswer = (idx) => {
    if (selected !== null) return;
    setSelected(idx);
    if (idx === q.answer) setScore((s) => s + 1);
  };

  const handleNext = () => {
    if (current < QUESTIONS.length - 1) {
      setCurrent((c) => c + 1);
      setSelected(null);
    } else {
      setFinished(true);
    }
  };

  const reset = () => { setCurrent(0); setSelected(null); setScore(0); setFinished(false); setStarted(false); };

  return (
    <div className="page-content">
      <div className="page-hero" style={{ background: '#E9C46A' }}>
        <button className="back-btn dark" onClick={() => navigate('/home')}>
          <ChevronLeft size={24} /> Home
        </button>
        <div className="page-hero-icon">🧠</div>
        <h2 className="page-hero-title dark">{t('quizTitle')}</h2>
        <p className="page-hero-sub dark">{t('quizDesc')}</p>
      </div>

      <div className="quiz-body">
        {!started && !finished && (
          <div className="quiz-start">
            <p>📝 {QUESTIONS.length} domande</p>
            <button className="btn-primary" onClick={() => setStarted(true)}>{t('start')}</button>
          </div>
        )}

        {started && !finished && (
          <>
            <div className="quiz-progress">
              <div className="quiz-progress-bar" style={{ width: `${((current + 1) / QUESTIONS.length) * 100}%` }} />
            </div>
            <p className="quiz-counter">{current + 1} / {QUESTIONS.length}</p>
            <p className="quiz-question">{q.q[lang] || q.q.it}</p>
            <div className="quiz-options">
              {(q.options[lang] || q.options.it).map((opt, idx) => {
                let cls = 'quiz-option';
                if (selected !== null) {
                  if (idx === q.answer) cls += ' correct';
                  else if (idx === selected) cls += ' wrong';
                }
                return (
                  <button key={idx} className={cls} onClick={() => handleAnswer(idx)}>
                    {opt}
                  </button>
                );
              })}
            </div>
            {selected !== null && (
              <div className="quiz-feedback">
                <p className={selected === q.answer ? 'text-correct' : 'text-wrong'}>
                  {selected === q.answer ? `✅ ${t('correct')}` : `❌ ${t('wrong')}`}
                </p>
                <button className="btn-primary" onClick={handleNext}>
                  {current < QUESTIONS.length - 1 ? t('next') : t('finish')}
                </button>
              </div>
            )}
          </>
        )}

        {finished && (
          <div className="quiz-result">
            <p className="quiz-score-label">{t('score')}</p>
            <p className="quiz-score">{score} / {QUESTIONS.length}</p>
            {score === QUESTIONS.length ? <p>🎉 Perfetto!</p> : score >= QUESTIONS.length / 2 ? <p>👍 Bravo!</p> : <p>📚 Studia ancora un po\'!</p>}
            <button className="btn-primary" onClick={reset}>{t('retry')}</button>
          </div>
        )}
      </div>
    </div>
  );
}
