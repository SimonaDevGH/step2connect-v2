import { useNavigate } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';

export default function PrivacyPage() {
  const { t } = useLanguage();
  const navigate = useNavigate();

  return (
    <div className="page-content privacy-page">
      <div className="page-hero" style={{ background: 'var(--navy)' }}>
        <button className="back-btn" onClick={() => navigate(-1)}>
          <ChevronLeft size={24} /> {t('menu')}
        </button>
        <h2 className="page-hero-title">{t('privacyTitle')}</h2>
      </div>

      <div className="privacy-body">

        <h2 className="prv-h1">INFORMATIVA PRIVACY</h2>

        <p>Gentile utente,</p>
        <p>di seguito troverai tutti i dettagli sul trattamento dei tuoi dati personali sul sito web <strong>https://step2connect.it</strong> (di seguito "Sito").</p>
        <p>Si tratta dell'informativa resa ai sensi dell'art. 13 del Reg. UE 679/2016 a coloro che interagiscono con i nostri servizi web.</p>
        <p>L'informativa è resa solo per il Sito indicato e non anche per altri siti web eventualmente consultati dall'utente tramite link o contenuti provenienti da altri indirizzi.</p>

        <h3 className="prv-h2">IL TITOLARE DEL TRATTAMENTO</h3>
        <p>Contitolari del trattamento sono:</p>
        <ul className="prv-list">
          <li><strong>B4Tech S.r.l.</strong> con sede legale in Via Mecenate 76/36, Milano, email <a href="mailto:privacy@befor.it">privacy@befor.it</a></li>
          <li><strong>ELIS Innovation Hub s.r.l.</strong>, Società a Socio Unico soggetta a Direzione e Coordinamento di Consel – Consorzio ELIS per la formazione professionale superiore s.c.a r.l., Sede Legale: Via Sandro Sandri, 81 – 00159 Roma (C.F. e P.Iva 15952371001), raggiungibile all'indirizzo e-mail <a href="mailto:privacy@elis.org">privacy@elis.org</a></li>
        </ul>

        <h3 className="prv-h2">IL DPO</h3>
        <p>Il Data Protection Officer ("DPO") nominato dal Titolare B4Tech S.r.l. ai sensi degli artt. 37 e ss. GDPR è l'Avv. Valerio Nicosia. È possibile contattare il DPO inviando una e-mail all'indirizzo: <a href="mailto:privacy@studionicosia.com">privacy@studionicosia.com</a>.</p>

        <h3 className="prv-h2">FINALITÀ DEL TRATTAMENTO</h3>
        <p>Il trattamento è finalizzato alla corretta gestione del Sito e delle sue interazioni con gli utenti, nonché alla corretta e completa gestione delle richieste inoltrate dagli utenti.</p>
        <p>Trattiamo inoltre i dati per l'adempimento di obblighi legali cui sono soggetti i Titolari nonché, previo consenso, per l'invio di comunicazioni informative/newsletter.</p>

        <h3 className="prv-h2">TIPI DI DATI TRATTATI</h3>

        <h4 className="prv-h3">Dati di navigazione</h4>
        <p>I sistemi informatici e le procedure software preposte al funzionamento di questo Sito acquisiscono, nel corso del loro normale esercizio, alcuni dati personali la cui trasmissione è implicita nell'uso dei protocolli di comunicazione di Internet. Si tratta di informazioni che non sono raccolte per essere associate a interessati identificati, ma che per loro stessa natura potrebbero, attraverso elaborazioni ed associazioni con dati detenuti da terzi, permettere di identificare gli utenti. In questa categoria di dati rientrano gli indirizzi IP o i nomi a dominio dei computer utilizzati dagli utenti che si connettono al sito, gli indirizzi in notazione URI delle risorse richieste, l'orario della richiesta, il metodo utilizzato nel sottoporre la richiesta al server, la dimensione del file ottenuto in risposta, il codice numerico indicante lo stato della risposta data dal server ed altri parametri relativi al sistema operativo e all'ambiente informatico dell'utente.</p>

        <h4 className="prv-h3">Dati forniti volontariamente dall'utente</h4>
        <p>L'invio facoltativo, esplicito e volontario di posta elettronica agli indirizzi indicati su questo Sito e/o utilizzando i moduli di contatto sullo stesso presenti comporta la successiva acquisizione dell'indirizzo del mittente, necessario per rispondere alle richieste, nonché degli eventuali altri dati personali inseriti nella missiva.</p>

        <h4 className="prv-h3">Area riservata</h4>
        <p>La registrazione in area riservata comporta il trattamento dei dati di registrazione (i dati obbligatori sono solamente quelli contrassegnati con apposito asterisco), nonché dei dati di cui ai protocolli di comunicazione (es. indirizzi IP, nomi a dominio dei computer, indirizzi URI delle risorse richieste, orario della richiesta, metodo utilizzato, dimensione del file, codice di risposta del server ed altri parametri relativi al sistema operativo dell'utente).</p>

        <h4 className="prv-h3">Dati di interazione chatbot</h4>
        <p>Sul Sito è presente un software che, simulando il comportamento umano, è in grado di dialogare con un utente in linguaggio naturale, rispondendo ad eventuali richieste per via testuale.</p>
        <p>Il chatbot è finalizzato a erogare un servizio di assistenza accessorio ed opzionale, a discrezione dell'interessato.</p>
        <p>Le conversazioni con il chatbot potranno essere visionate da un incaricato al fine di verificare il corretto funzionamento del software.</p>
        <p>Il chatbot è erogato attraverso la piattaforma <strong>Liveperson</strong> (<a href="https://www.liveperson.com/policies/gdpr-data-privacy" target="_blank" rel="noreferrer">informativa privacy</a>) e tramite la piattaforma <strong>ChatGPT di OpenAI</strong> (<a href="https://openai.com/policies/privacy-policy/" target="_blank" rel="noreferrer">informativa privacy</a>).</p>

        <h4 className="prv-h3">Ulteriori dati</h4>
        <p>Nell'interagire con il Sito o sue aree specifiche potrebbero esserti sottoposte informative connesse con i servizi richiesti.</p>

        <h3 className="prv-h2">COOKIE POLICY</h3>
        <p>Puoi modificare le tue preferenze sui cookie in qualsiasi momento. Diversi browser forniscono metodi diversi per bloccare ed eliminare i cookie. Di seguito i link alle istruzioni dei principali browser:</p>
        <ul className="prv-list">
          <li><a href="https://support.google.com/accounts/answer/32050" target="_blank" rel="noreferrer">Chrome</a></li>
          <li><a href="https://support.apple.com/en-in/guide/safari/sfri11471/mac" target="_blank" rel="noreferrer">Safari</a></li>
          <li><a href="https://support.mozilla.org/en-US/kb/clear-cookies-and-site-data-firefox" target="_blank" rel="noreferrer">Firefox</a></li>
          <li><a href="https://support.microsoft.com/en-us/topic/how-to-delete-cookie-files-in-internet-explorer-bca9446f-d873-78de-77ba-d42645fa52fc" target="_blank" rel="noreferrer">Internet Explorer</a></li>
        </ul>

        <h3 className="prv-h2">CONFERIMENTO DEI DATI</h3>
        <p>A parte quanto specificato per i dati di navigazione, l'utente è libero o meno di fornire i dati personali. Il loro mancato conferimento può comportare l'impossibilità di ottenere quanto richiesto.</p>

        <h3 className="prv-h2">MODALITÀ DEL TRATTAMENTO</h3>
        <p>Il trattamento può essere svolto con o senza l'ausilio di strumenti elettronici. Il trattamento è svolto dai Titolari e/o dagli incaricati dallo stesso espressamente autorizzati e/o dai soggetti nominati responsabili esterni del trattamento.</p>
        <p>Il Titolare non ricorre a processi decisionali automatizzati, compresa la profilazione, che comportino effetti giuridici o assimilabili.</p>

        <h3 className="prv-h2">LUOGO DI TRATTAMENTO DEI DATI</h3>
        <p>I trattamenti connessi ai servizi web di questo Sito hanno luogo presso la server farm scelta dai Contitolari all'interno dell'Unione Europea e sono curati solo da personale tecnico dell'ufficio incaricato del trattamento. Nessun dato personale derivante dal servizio web viene diffuso.</p>

        <h3 className="prv-h2">DURATA DEL TRATTAMENTO</h3>
        <p>I Contitolari tratteranno i dati personali per il tempo necessario e sufficiente per adempiere alle finalità di cui sopra e comunque per non oltre 2 anni dall'acquisizione del dato ai fini del trattamento e/o dalla cancellazione del profilo per l'utente registrato e/o dall'inattività del profilo per l'utente registrato per oltre 2 anni.</p>
        <p>Con riferimento all'invio di comunicazioni informative e/o commerciali è sempre possibile, per il destinatario, porre fine al trattamento inviando una email a <a href="mailto:privacy@befor.it">privacy@befor.it</a>.</p>

        <h3 className="prv-h2">COMUNICAZIONE DEI DATI</h3>
        <p>I dati personali possono venire a conoscenza degli incaricati e responsabili del trattamento e possono essere comunicati per le finalità di cui alla presente informativa ad altre società del gruppo Be For, a collaboratori esterni, subappaltatori e, in genere, a tutti quei soggetti pubblici e privati cui la comunicazione sia necessaria per il corretto adempimento delle finalità indicate. I dati personali non sono soggetti a diffusione.</p>
        <p>I dati aggregati (anonimi) relativi alla fruizione del presente Sito potranno essere trasmessi ai partner del progetto, quali Fincantieri e Sofia per la Famiglia.</p>

        <h3 className="prv-h2">DIRITTI DELL'INTERESSATO</h3>
        <p>Ai sensi degli art. 15–22 G.D.P.R., l'interessato ha diritto di chiedere al titolare del trattamento l'accesso ai suoi dati personali ovvero la rettifica ovvero la cancellazione degli stessi o la limitazione del trattamento, ovvero ha diritto di opporsi al loro trattamento, oltre al diritto di richiedere la portabilità dei dati stessi.</p>
        <p>La richiesta può essere fatta a mezzo email (<a href="mailto:privacy@befor.it">privacy@befor.it</a>) o mezzo raccomandata con oggetto: "richiesta di accesso ai dati da parte dell'interessato", specificando il diritto che si vuole esercitare (cancellazione, rettifica, portabilità, oblio), unitamente ad un valido indirizzo e-mail al quale recapitare il riscontro. Il titolare procederà a soddisfare la richiesta entro 30 giorni dalla data di ricevimento.</p>
        <p>Qualora ritenga opportuno far valere i suoi diritti, l'interessato ha facoltà di proporre reclamo al Garante privacy nazionale, con sede in Palazzo Monte Citorio 121, Roma (<a href="http://www.garanteprivacy.it" target="_blank" rel="noreferrer">www.garanteprivacy.it</a>).</p>

        {/* ── Condizioni Generali ─────────────────────────────────────── */}
        <h2 className="prv-h1" style={{ marginTop: 32 }}>Condizioni Generali di Contratto (CGC)</h2>

        <h3 className="prv-h2">Articolo 1 – Premessa</h3>
        <p>1.1 Le presenti Condizioni Generali di Contratto (di seguito, "CGC") regolano l'accesso e l'utilizzo del sito web <strong>www.step2connect.it</strong> (di seguito, "Sito"), gestito da B4Tech S.r.l., con sede legale in Via Mecenate 76/36, Milano, e-mail: <a href="mailto:privacy@befor.it">privacy@befor.it</a>.</p>
        <p>1.2 Accedendo al Sito, l'utente accetta integralmente le presenti CGC. In caso di mancata accettazione, l'utente è invitato a non utilizzare il Sito e i relativi servizi.</p>

        <h3 className="prv-h2">Articolo 2 – Oggetto del contratto</h3>
        <p>2.1 Il Sito offre informazioni, servizi e contenuti volti a facilitare le interazioni tra utenti e organizzazioni, nel rispetto delle finalità stabilite.</p>
        <p>2.2 I servizi del Sito possono includere sezioni riservate (area registrazione), contenuti interattivi (ad esempio chatbot) e la raccolta di dati personali per scopi specifici.</p>

        <h3 className="prv-h2">Articolo 3 – Trattamento dei dati personali</h3>
        <p>3.1 Il trattamento dei dati personali degli utenti avviene nel rispetto del Regolamento UE 679/2016 (GDPR).</p>
        <p>3.2 I Contitolari del trattamento dei dati personali sono:</p>
        <ul className="prv-list">
          <li>B4Tech S.r.l., Via Mecenate 76/36, Milano – <a href="mailto:privacy@befor.it">privacy@befor.it</a></li>
          <li>ELIS Innovation Hub, Via Sandro Sandri, 81 – 00159 Roma – <a href="mailto:privacy@elis.org">privacy@elis.org</a></li>
        </ul>
        <p>3.3 Il trattamento dei dati personali è finalizzato alla gestione delle richieste inoltrate dagli utenti, alla gestione dell'area riservata e, previo consenso, all'invio di comunicazioni informative o newsletter.</p>
        <p>3.4 Per maggiori informazioni sul trattamento dei dati, l'utente è invitato a consultare l'Informativa Privacy disponibile sul Sito.</p>

        <h3 className="prv-h2">Articolo 4 – Obblighi dell'utente</h3>
        <p>4.1 L'utente si impegna a utilizzare il Sito nel rispetto delle presenti CGC e della normativa applicabile.</p>
        <p>4.2 È vietato utilizzare il Sito per fini illeciti, incluso:</p>
        <ul className="prv-list">
          <li>La diffusione di contenuti non autorizzati o offensivi.</li>
          <li>L'uso di sistemi o software per compromettere il funzionamento del Sito.</li>
        </ul>
        <p>4.3 Qualsiasi dato personale fornito dall'utente deve essere accurato e aggiornato.</p>

        <h3 className="prv-h2">Articolo 5 – Esclusione di responsabilità</h3>
        <p><strong>5.1 Accuratezza delle informazioni</strong><br />Le informazioni e i contenuti presenti sul Sito sono forniti "così come sono" e potrebbero contenere inesattezze, errori o omissioni. B4Tech non garantisce l'accuratezza, la completezza o l'idoneità di tali informazioni per specifici scopi.</p>
        <p><strong>5.2 Uso dei contenuti</strong><br />L'utente utilizza il Sito a proprio esclusivo rischio. B4Tech declina ogni responsabilità per danni diretti, indiretti o consequenziali derivanti dall'uso o dall'affidamento sui contenuti del Sito.</p>

        <h3 className="prv-h2">Articolo 6 – Clausola di manleva</h3>
        <p>6.1 L'utente accetta di manlevare e tenere indenne B4Tech, i suoi amministratori, dipendenti e collaboratori da qualsiasi danno, responsabilità o costo derivante da:</p>
        <ul className="prv-list">
          <li>L'uso improprio del Sito.</li>
          <li>La violazione delle presenti CGC.</li>
          <li>L'affidamento su informazioni errate o incomplete presenti sul Sito.</li>
        </ul>

        <h3 className="prv-h2">Articolo 7 – Protezione dei dati personali</h3>
        <p>7.1 I dati personali sono trattati con strumenti manuali o elettronici esclusivamente per le finalità indicate nell'informativa privacy.</p>
        <p>7.2 I dati non saranno oggetto di diffusione e saranno trattati solo all'interno dello Spazio Economico Europeo.</p>
        <p>7.3 L'utente ha diritto di accedere ai propri dati personali, richiederne la rettifica o la cancellazione, e opporsi al loro trattamento, inviando una richiesta via e-mail a: <a href="mailto:privacy@befor.it">privacy@befor.it</a>.</p>

        <h3 className="prv-h2">Articolo 8 – Limitazioni per servizi esterni</h3>
        <p>8.1 Il Sito potrebbe integrare servizi esterni, come chatbot, per l'assistenza agli utenti. Le conversazioni potrebbero essere visionate da personale autorizzato per finalità di controllo e miglioramento del servizio.</p>
        <p>8.2 I dati relativi alle conversazioni sono gestiti dai fornitori di servizi (Liveperson e OpenAI) conformemente alle rispettive politiche sulla privacy.</p>

        <h3 className="prv-h2">Articolo 9 – Modifiche al sito e alle CGC</h3>
        <p>9.1 B4Tech si riserva il diritto di modificare in qualsiasi momento i contenuti, le funzionalità e le presenti CGC. Le modifiche saranno efficaci dalla pubblicazione sul Sito.</p>

        <h3 className="prv-h2">Articolo 10 – Legge applicabile e foro competente</h3>
        <p>10.1 Le presenti CGC sono regolate dalla legge italiana.</p>
        <p>10.2 Per qualsiasi controversia sarà competente in via esclusiva il Foro di Milano.</p>

        <h3 className="prv-h2">Articolo 11 – Contatti</h3>
        <p>Per ulteriori informazioni o richieste:</p>
        <ul className="prv-list">
          <li>Email: <a href="mailto:privacy@befor.it">privacy@befor.it</a></li>
          <li>Indirizzo: Via Mecenate 76/36, Milano</li>
        </ul>

        <p className="prv-updated">Ultimo aggiornamento: 14/12/2024</p>
      </div>
    </div>
  );
}
