import { createContext, useContext, useState } from 'react';
import it from '../i18n/it.js';
import en from '../i18n/en.js';
import bn from '../i18n/bn.js';

const translations = { it, en, bn };

const LanguageContext = createContext(null);

export function LanguageProvider({ children }) {
  const [lang, setLang] = useState(() => {
    return localStorage.getItem('s2c_lang') || 'it';
  });

  const t = (key) => translations[lang]?.[key] ?? translations.it[key] ?? key;

  const changeLang = (newLang) => {
    localStorage.setItem('s2c_lang', newLang);
    setLang(newLang);
  };

  return (
    <LanguageContext.Provider value={{ lang, changeLang, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  return useContext(LanguageContext);
}
