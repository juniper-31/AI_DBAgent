import React from 'react';
import { useLanguage } from '../contexts/LanguageContext';

const LanguageToggle = () => {
  const { language, toggleLanguage } = useLanguage();

  return (
    <div className="language-toggle">
      <button 
        onClick={toggleLanguage}
        className="language-btn"
        title={language === 'ko' ? 'Switch to English' : '한국어로 전환'}
      >
        <span className="language-flag">
          {language === 'ko' ? '🇺🇸' : '🇰🇷'}
        </span>
        <span className="language-text">
          {language === 'ko' ? 'EN' : '한국어'}
        </span>
      </button>
    </div>
  );
};

export default LanguageToggle;