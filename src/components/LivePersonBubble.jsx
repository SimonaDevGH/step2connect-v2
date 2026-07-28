// ─── INTEGRATION POINT ────────────────────────────────────────────────────────
// This component is the LivePerson chat bubble placeholder.
// To integrate LivePerson:
//   1. Load the LivePerson monitoring tag in index.html (lpTag script)
//   2. Replace the mock UI below with lpTag.newPage() / lpTag.section() calls
//   3. The bubble div with id="lpChat" will be controlled by LivePerson SDK
// ─────────────────────────────────────────────────────────────────────────────

import { useState } from 'react';
import { X, MessageCircle, Send } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';

export default function LivePersonBubble({ open, onClose }) {
  const { t } = useLanguage();
  const [messages, setMessages] = useState([
    { from: 'bot', text: t('botDesc') }
  ]);
  const [input, setInput] = useState('');

  const send = () => {
    if (!input.trim()) return;
    setMessages((prev) => [
      ...prev,
      { from: 'user', text: input },
      { from: 'bot', text: '🤖 ' + t('botNote') }
    ]);
    setInput('');
  };

  if (!open) return null;

  return (
    <div className="lp-bubble-panel" id="lpChat">
      <div className="lp-header">
        <MessageCircle size={18} />
        <span>{t('botTitle')}</span>
        <button className="icon-btn" onClick={onClose}><X size={18} /></button>
      </div>
      <div className="lp-messages">
        {messages.map((m, i) => (
          <div key={i} className={`lp-msg lp-msg-${m.from}`}>{m.text}</div>
        ))}
      </div>
      <div className="lp-input-row">
        <input
          className="lp-input"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && send()}
          placeholder={t('botPlaceholder')}
        />
        <button className="lp-send" onClick={send}>
          <Send size={18} />
        </button>
      </div>
    </div>
  );
}
