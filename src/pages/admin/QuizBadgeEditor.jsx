import { useCallback, useEffect, useRef, useState } from 'react';
import { RefreshCw, Save } from 'lucide-react';
import { GUIDE_CATEGORIES } from '../../data/guides';

const languages = [['it','Italiano'],['en','English'],['bn','বাংলা']];

export default function QuizBadgeEditor({ adminToken, onUnauthorized }) {
  const [items,setItems] = useState([]);
  const [status,setStatus] = useState('loading');
  const [error,setError] = useState('');
  const timer = useRef(null);
  const revision = useRef(0);
  const savedRevision = useRef(0);
  const saving = useRef(false);
  const latestItems = useRef([]);
  const unauthorizedRef = useRef(onUnauthorized);
  unauthorizedRef.current = onUnauthorized;
  const getItems = useCallback(async () => {
    setStatus('loading'); setError('');
    try {
      const response = await fetch('/api/admin/quiz/badges',{headers:{Authorization:`Bearer ${adminToken}`}});
      const data = await response.json().catch(()=>({}));
      if(!response.ok) throw new Error(data.error || `HTTP ${response.status}`);
      const incoming=data.items;
      const complete=Array.isArray(incoming)&&incoming.length===6&&incoming.every((item)=>item&&typeof item.id==='string'&&typeof item.emoji==='string'&&item.emoji&&(typeof item.category==='string'||item.category===null)&&item.title&&languages.every(([code])=>typeof item.title[code]==='string'&&item.title[code].trim()))&&new Set(incoming.map((item)=>item.id)).size===6;
      if(!complete) throw new Error('Il server non ha restituito tutte le definizioni dei sei badge.');
      setItems(incoming); latestItems.current=incoming; revision.current=0; savedRevision.current=0; setStatus('saved');
    } catch(err) { setError(err.message); setStatus('error'); if(String(err.message).includes('401')||String(err.message).toLowerCase().includes('token')) unauthorizedRef.current?.(); }
  },[adminToken]);
  useEffect(()=>{getItems();return()=>window.clearTimeout(timer.current);},[getItems]);
  const persist = useCallback(async () => {
    if(saving.current || savedRevision.current===revision.current) return;
    saving.current=true; setStatus('saving'); setError('');
    try {
      while(savedRevision.current<revision.current) {
        const version=revision.current;
        const payload=latestItems.current.map(({id,category,emoji,title})=>({id,category,emoji,title}));
        const response=await fetch('/api/admin/quiz/badges',{method:'PUT',headers:{'Content-Type':'application/json',Authorization:`Bearer ${adminToken}`},body:JSON.stringify({items:payload})});
        const data=await response.json().catch(()=>({}));
        if(!response.ok) throw new Error(data.error||`HTTP ${response.status}`);
        savedRevision.current=version;
      }
      setStatus('saved');
    } catch(err) { setError(err.message); setStatus('error'); if(String(err.message).includes('401')||String(err.message).toLowerCase().includes('token')) unauthorizedRef.current?.(); }
    finally { saving.current=false; }
  },[adminToken]);
  useEffect(()=>{
    const warnBeforeLeave=(event)=>{
      if(revision.current<=savedRevision.current) return;
      event.preventDefault();
      event.returnValue='';
    };
    window.addEventListener('beforeunload',warnBeforeLeave);
    return ()=>{
      window.removeEventListener('beforeunload',warnBeforeLeave);
      window.clearTimeout(timer.current);
      if(revision.current>savedRevision.current) void persist();
    };
  },[persist]);
  const change=(id,field,value,language) => {
    const next=latestItems.current.map((item)=>item.id!==id?item:language?{...item,title:{...item.title,[language]:value}}:{...item,[field]:value});
    latestItems.current=next; revision.current+=1; setItems(next); setStatus('pending'); setError('');
    window.clearTimeout(timer.current); timer.current=window.setTimeout(persist,650);
  };
  if(status==='loading'&&!items.length) return <div className="quiz-admin-skeleton" aria-label="Caricamento badge"/>;
  return <section className="cms-quiz-badge-editor">
    <div className="cms-quiz-badge-toolbar"><div><h2>Definizione badge</h2><p>Sei badge condivisi in italiano, inglese e bengalese.</p></div>
      <span className={`cms-quiz-badge-status is-${status}`} role={status==='error'?'alert':'status'}>{status==='saving'?'Salvataggio…':status==='pending'?'Modifiche in attesa…':status==='error'?'Errore di salvataggio':status==='loading'?'Caricamento…':'Salvato'}</span>
      {status==='error'&&<button className="quiz-badge-retry" onClick={()=>items.length?persist():getItems()}><RefreshCw size={15}/> Riprova</button>}
      {status==='pending'&&<button className="quiz-badge-retry" onClick={()=>{window.clearTimeout(timer.current);persist();}}><Save size={15}/> Salva ora</button>}
    </div>
    {error&&<p className="cms-quiz-badge-error">{error}</p>}
    <div className="cms-quiz-badge-list">{items.map((item)=>{
      const category=GUIDE_CATEGORIES.find((cat)=>cat.id===item.category);
      const accent=item.id==='champion'?'#c08c35':category?.color||'#58736b';
      return <article className="cms-quiz-badge-row" key={item.id} style={{'--badge-color':accent}}>
        <div className="cms-quiz-badge-preview"><span>{item.emoji}</span><strong>{item.title.it}</strong><small>{item.category?'Categoria · '+item.category:'STEP2CONNECT'}</small></div>
        <div className="cms-quiz-badge-fields"><label>Emoji<input value={item.emoji} maxLength={12} onChange={(e)=>change(item.id,'emoji',e.target.value)} onBlur={()=>{if(revision.current>savedRevision.current){window.clearTimeout(timer.current);persist();}}}/></label>
          {languages.map(([code,label])=><label key={code}>{label}<input value={item.title?.[code]||''} onChange={(e)=>change(item.id,'title',e.target.value,code)} onBlur={()=>{if(revision.current>savedRevision.current){window.clearTimeout(timer.current);persist();}}}/></label>)}
        </div>
      </article>;
    })}</div>
  </section>;
}
