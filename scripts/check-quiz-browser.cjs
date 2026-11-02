// Optional browser integration checks. All API requests use isolated fixtures.
const assert = require('node:assert/strict');
const ExcelJS = require('exceljs');
const { chromiumSession } = require('./lib/chromium-session.cjs');
const origin = `https://${process.env.REPLIT_DEV_DOMAIN}`;
const sessions = [], results = {};
const ids = ['permit-renewal', 'emergency', 'find-home', 'school-enrollment', 'public-transport'];
const categories = ['documents', 'health', 'homeBills', 'school', 'cityLife'];
let role = 'admin', exported = false, imported = false, saved = false;
const paragraphs = '<p>Primo paragrafo.</p><ul><li>Secondo paragrafo.</li></ul><p>Terzo paragrafo.</p><h3>Quarto paragrafo.</h3><p>Quinto paragrafo evidenziato.</p><p>Sesto paragrafo.</p>';
(async () => {
  const book = new ExcelJS.Workbook();
  await book.xlsx.readFile(process.argv[2] || 'attached_assets/0_S2C_quiz_IT_EN_BN_V2_1793635899600.xlsx');
  const sheet = book.getWorksheet('Quiz 3 lingue');
  const records = ids.map((id, index) => {
    const rows = []; sheet.eachRow((r, i) => { if (i > 1 && r.getCell(2).text === id) rows.push(r); });
    return {
      id: `quiz-${id}`, type: 'quiz', guideId: id, category: categories[index],
      title: rows[0].getCell(3).text, guideUrl: `/guides/${categories[index]}/${id}`,
      contentId: rows[0].getCell(1).text, sortOrder: index, visibility: 'internal', passThreshold: 3,
      questions: rows.map((r) => ({ qid: r.getCell(4).text, answer: r.getCell(5).text === 'Vero', anchor: r.getCell(6).text })),
      translations: Object.fromEntries(['it', 'en', 'bn'].map((lang, i) => [lang, {
        title: rows[0].getCell(3).text, questions: rows.map((r) => ({
          qid: r.getCell(4).text, statement: r.getCell(7 + i).text, explanation: r.getCell(10 + i).text,
          audioUrl: '', explanationAudioUrl: '',
        })),
      }])),
      guideParagraphs: [1,2,3,4,5,6].map((n) => ({ anchor: `p${n}`, text: `${n} paragrafo` })),
    };
  });
  const localized = (q, lang) => ({ ...q, questions: q.questions.map((v) => ({ ...v, ...q.translations[lang || 'it'].questions.find((x) => x.qid === v.qid) })) });
  const catalog = (lang) => records.filter((q) => role === 'admin' || q.visibility === 'published').map((q) => localized(q, lang));
  const create = async () => {
    const b = await chromiumSession(); sessions.push(b);
    b.events['Runtime.exceptionThrown'] = ({ exceptionDetails: e }) => b.failures.push(e.exception?.description || e.text);
    b.events['Fetch.requestPaused'] = async ({ requestId, request }) => {
      const url = new URL(request.url), path = url.pathname, lang = url.searchParams.get('lang') || 'it';
      const body = request.postData?.startsWith('{') ? JSON.parse(request.postData) : null;
      let data = {}, code = 200, mime = 'application/json';
      if (path === '/api/users/preview-admin/session') data = { type: role, phone: '+390000000001', firstName: 'Fixture' };
      else if (path === '/api/sections') data = { sections: Object.fromEntries(['quiz','guides','notifications','news','offices','library','privacy','translator','analyze-document'].map((key) => [key,{status:'published'}])) };
      else if (path === '/api/quiz/progress') data = { quizResults: results };
      else if (path === '/api/quiz') data = { items: catalog(lang), quizResults: results, badges: {} };
      else if (/^\/api\/quiz\/[^/]+\/result$/.test(path)) {
        const q = records.find((q) => path.split('/')[3] === q.id);
        const firstAnswers = Object.fromEntries(q.questions.map((v) => [v.qid, body.answers[v.qid] === v.answer]));
        const score = Object.values(firstAnswers).filter(Boolean).length;
        const old = results[q.id], passed = score >= 3;
        results[q.id] = { firstAnswers: old?.firstAnswers || firstAnswers, firstScore: old?.firstScore ?? score, bestScore: Math.max(old?.bestScore || 0, score), attempts: (old?.attempts || 0) + 1, passedAt: old?.passedAt || (passed ? 'fixture-date' : ''), lastAt: 'fixture-date' };
        data = { score, stars: score === 4 ? 3 : score === 3 ? 2 : score === 2 ? 1 : 0, passed, badgeUnlocked: passed && !old?.passedAt, saved: true, quizResults: results, progress: results[q.id] };
      } else if (path.startsWith('/api/quiz/')) {
        const q = catalog(lang).find((q) => q.id === path.split('/')[3]);
        if (q) data = { quiz: q }; else { code = 404; data = { error: 'Not found' }; }
      } else if (path === '/api/admin/content') data = url.searchParams.get('type') === 'quiz' ? records : records.map((q) => ({id:q.guideId,title:q.title,category:q.category,url:q.guideUrl}));
      else if (path === '/api/admin/quiz/import/preview') data = { canConfirm: true, errors: [], warnings: [], quizzes: records.map((q) => ({ id:q.id,action:'update',errors:[],warnings:[],record:q })) };
      else if (path === '/api/admin/quiz/import/confirm') { assert.equal(body.quizzes.length,5); imported = true; data = {ok:true,count:5}; }
      else if (path === '/api/admin/quiz/export') { exported=true; mime='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'; data=await book.xlsx.writeBuffer(); }
      else if (/^\/api\/admin\/quiz\/[^/]+\/stats$/.test(path)) data={people:1,passRate:100,questions:records[0].questions.map((q,i)=>({...q,correctRate:i===1?0:100,guideUrl:records[0].guideUrl}))};
      else if (path.startsWith('/api/admin/content/quiz/')) {
        const q=records.find(q=>path.split('/')[5]===q.id);
        if(request.method==='PUT') {saved=true;data={ok:true};} else data=q;
      } else if (/^\/api\/content\/guides\//.test(path)) data={id:path.split('/').pop(),title:'Guida reale di prova',body:paragraphs,visibility:'published',category:'documents'};
      else if (/^\/api\/admin\/content\/guides\//.test(path)) data={it:{body:paragraphs}};
      else if (path.startsWith('/api/notifications')) data={items:[],unread:0};
      else { data=null;code=404; }
      await b.cdp('Fetch.fulfillRequest',{requestId,responseCode:code,responseHeaders:[{name:'Content-Type',value:mime}],body:(Buffer.isBuffer(data)?data:Buffer.from(JSON.stringify(data))).toString('base64')});
    };
    await b.cdp('Runtime.enable'); await b.cdp('Page.enable'); await b.cdp('Fetch.enable',{patterns:[{urlPattern:'*/api/*'}]});
    const token=`e30.${Buffer.from(JSON.stringify({email:'fixture@example.invalid',exp:Math.floor(Date.now()/1000)+3600})).toString('base64url')}.fixture`;
    await b.cdp('Page.addScriptToEvaluateOnNewDocument',{source:`localStorage.setItem('s2c_preview_session','fixture');localStorage.setItem('adminToken',${JSON.stringify(token)});if(!localStorage.getItem('s2c_lang'))localStorage.setItem('s2c_lang','it');`});
    b.visit=(path)=>b.cdp('Page.navigate',{url:origin+path});
    b.click=(text)=>b.evaluate(`(()=>{const b=[...document.querySelectorAll('button')].find(b=>b.textContent.trim()===${JSON.stringify(text)});if(!b)throw Error('Button not found: '+${JSON.stringify(text)});b.click()})()`);
    return b;
  };
  try {
    const b=await create();
    await b.cdp('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});
    await b.visit('/quiz'); await b.wait(`document.querySelectorAll('.quiz-category-card').length===5`);
    assert.ok(await b.evaluate(`document.documentElement.scrollWidth<=391`));
    await b.screenshot('s2c-quiz-categories.png');
    await b.evaluate(`document.querySelector('.quiz-category-card').click()`);
    await b.wait(`document.querySelectorAll('.quiz-list-card').length===1`);
    await b.evaluate(`document.querySelector('.quiz-list-card').click()`);
    await b.wait(`!!document.querySelector('.quiz-answer-row')`);
    for(let i=0;i<4;i++){
      const answer=i===1?!records[0].questions[i].answer:records[0].questions[i].answer;
      await b.evaluate(`document.querySelector('.quiz-answer.${answer?'true':'false'}').click()`);
      await b.wait(`!!document.querySelector('.quiz-feedback')`);
      if(i===1){
        await b.click('Leggi nella guida');
        await b.wait(`location.hash==='#p5'&&!!document.querySelector('#p5.guide-anchor-highlight')`);
        assert.equal(await b.evaluate(`document.querySelector('#p5').textContent`),'Quinto paragrafo evidenziato.');
        await b.screenshot('s2c-quiz-guide-anchor.png');
        await b.click('Torna al quiz');
        await b.wait(`document.querySelector('.quiz-question-meta')?.textContent.includes('2 di 4')&&!!document.querySelector('.quiz-feedback')`);
      }
      await b.evaluate(`document.querySelector('.quiz-continue').click()`);
      await b.wait(i<3?`!!document.querySelector('.quiz-answer-row')`:`!!document.querySelector('.quiz-result-card')`);
    }
    assert.equal(results[records[0].id].bestScore,3);
    assert.equal(await b.evaluate(`document.querySelectorAll('.quiz-result-card .quiz-stars .earned').length`),2);
    await b.screenshot('s2c-quiz-result.png');
    await b.click('Rifai'); await b.wait(`!!document.querySelector('.quiz-answer-row')`);
    for(let i=0;i<4;i++){
      await b.evaluate(`document.querySelector('.quiz-answer.${records[0].questions[i].answer?'true':'false'}').click()`);
      await b.wait(`!!document.querySelector('.quiz-feedback')`);
      await b.evaluate(`document.querySelector('.quiz-continue').click()`);
      await b.wait(i<3?`!!document.querySelector('.quiz-answer-row')`:`!!document.querySelector('.quiz-result-card')`);
    }
    assert.equal(results[records[0].id].attempts,2);
    assert.equal(results[records[0].id].firstAnswers.q2,false);
    assert.equal(results[records[0].id].bestScore,4);
    const second=await create();await second.visit('/quiz');
    await second.wait(`document.querySelectorAll('.quiz-category-card').length===5`);
    assert.ok(await second.evaluate(`document.querySelector('.quiz-category-card').textContent.includes('1 di 1')`));
    await b.evaluate(`localStorage.setItem('s2c_lang','bn')`);await b.visit(`/quiz/${records[0].id}`);
    await b.wait(`!!document.querySelector('.quiz-question-card')`);
    assert.equal(await b.evaluate(`document.querySelector('.quiz-question-card p').textContent`),records[0].translations.bn.questions[0].statement);
    await b.screenshot('s2c-quiz-bn.png');
    // A standard Cognito session cannot be simulated with a preview token.
    // This supported non-admin role shares the same exclusion for internal content;
    // standard authorization is tested against the real routes in quiz.test.cjs.
    role='fincantieri_users';await second.visit('/quiz');await second.wait(`!!document.querySelector('.quiz-empty')`);
    assert.equal(await second.evaluate(`document.querySelectorAll('.quiz-category-card').length`),0);
    await second.visit('/guides/documents/permit-renewal');await second.wait(`!!document.querySelector('.guide-cms-body')`);
    assert.equal(await second.evaluate(`!!document.querySelector('.guide-quiz-card')`),false);
    role='admin';await b.evaluate(`localStorage.setItem('s2c_lang','it')`);await b.visit('/admin/content/quiz');
    await b.wait(`!!document.querySelector('button[title="Modifica"]')`);
    await b.evaluate(`(()=>{const b=[...document.querySelectorAll('button')].find(b=>b.getAttribute('title')==='Modifica'||b.textContent.trim()==='Modifica');if(!b)throw Error('Missing edit');b.click()})()`);
    await b.wait(`document.querySelectorAll('.quiz-question-editor').length===4`);
    assert.ok(await b.evaluate(`[...document.querySelectorAll('select option')].some(o=>o.value==='p5')`));
    await b.click('Statistiche');await b.wait(`document.querySelectorAll('.quiz-stat-question').length===4`);
    assert.equal(await b.evaluate(`document.querySelectorAll('.quiz-stat-question.low').length`),1);
    await b.screenshot('s2c-quiz-stats.png');
    await b.click('Modifica');await b.click('Salva bozza');await b.wait(`document.body.textContent.includes('Bozza salvata')`);assert.ok(saved);
    await b.evaluate(`document.querySelector('.quiz-admin-close').click()`);await b.wait(`!!document.querySelector('.quiz-import-toolbar')`);
    const root=await b.cdp('DOM.getDocument');const input=await b.cdp('DOM.querySelector',{nodeId:root.root.nodeId,selector:'.quiz-import-toolbar input[type=file]'});
    await b.cdp('DOM.setFileInputFiles',{nodeId:input.nodeId,files:[require('node:path').resolve(process.argv[2]||'attached_assets/0_S2C_quiz_IT_EN_BN_V2_1793635899600.xlsx')]});
    await b.wait(`document.body.textContent.includes('Anteprima import')`);await b.click('Anteprima import');await b.wait(`!!document.querySelector('.quiz-confirm-import')`);
    await b.click('Conferma import');await b.wait(`document.body.textContent.includes('5 quiz importati')`);assert.ok(imported);
    await b.click('Esporta Excel');await b.wait(`!document.querySelector('.quiz-export-btn').disabled`);assert.ok(exported);
    for(const s of sessions)assert.deepEqual(s.failures,[]);
    console.log('QUIZ_BROWSER_PASS: 5 categories, 2 attempts, server result display, p5 highlight/return/resume, second browser progress, BN, hidden internal quizzes/guide card for non-admin, CMS editor/stats/import/export, mobile');
  } finally {await Promise.all(sessions.map(s=>s.close().catch(e=>console.error('Browser cleanup:',e.message))));}
})().catch(err=>{console.error(err);process.exitCode=1});
