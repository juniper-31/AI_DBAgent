// index.js
// React 앱 진입점
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './styles.css';

// React 18 방식으로 루트 생성
const root = ReactDOM.createRoot(document.getElementById('root'));

// 앱 렌더링
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

// 개발 모드에서 핫 리로드 설정
if (process.env.NODE_ENV === 'development' && module.hot) {
  module.hot.accept();
} 