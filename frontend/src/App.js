// App.js
// 전체 앱 엔트리포인트
import React, { useState, useEffect, useCallback } from 'react';
import { BrowserRouter as Router, Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import ChatComponent from './components/ChatComponent';
import DatabaseManager from './components/DatabaseManager';
import MonitoringComponent from './components/MonitoringComponent';
import SlowQueryComponent from './components/SlowQueryComponent';
import AwsIntegrationComponent from './components/AwsIntegrationComponent';
import AIManager from './components/AIManager'; // OpenAIManager 대신 AIManager 임포트
import PlaybookComponent from './components/PlaybookComponent';
import AwsRdsResource from './components/AwsRdsResource';
import AwsCloudwatchResource from './components/AwsCloudwatchResource';
import { LanguageProvider, useLanguage } from './contexts/LanguageContext';
import { useTranslation } from './utils/translations';
import LanguageToggle from './components/LanguageToggle';

function AppContent() {
  const { language } = useLanguage();
  const { t } = useTranslation(language);
  
  const [databases, setDatabases] = useState([]);
  const [selectedDb, setSelectedDb] = useState('');
  // OpenAI 키 관련 상태는 AIManager에서 관리하므로 여기서는 제거하거나 필요에 따라 변경
  // const [openaiKeys, setOpenaiKeys] = useState([]);
  // const [selectedOpenAIKey, setSelectedOpenAIKey] = useState('');
  const [loading, setLoading] = useState(true);
  const [showAwsSubMenu, setShowAwsSubMenu] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false); // 사이드바 접힘 상태

  // 네비게이션 메뉴 (다국어 지원)
  const menuItems = [
    { id: 'chat', label: `💬 ${t('sidebar.aiChat')}`, icon: '💬', path: '/chat' },
    { id: 'databases', label: `🗄️ ${t('sidebar.dbManagement')}`, icon: '🗄️', path: '/databases' },
    { id: 'ai-manager', label: `🤖 ${t('sidebar.aiTools')}`, icon: '🤖', path: '/ai-manager' },
    { id: 'playbooks', label: `📖 ${t('sidebar.playbooks')}`, icon: '📖', path: '/playbooks' },
    { id: 'monitoring', label: `📊 ${t('sidebar.monitoring')}`, icon: '📊', path: '/monitoring' },
    { id: 'slowquery', label: `🐌 ${t('sidebar.slowQuery')}`, icon: '🐌', path: '/slowquery' },
    { id: 'aws', label: `☁️ ${t('sidebar.awsTools')}`, icon: '☁️', path: '/aws' },
    { id: 'aws-resources', label: `☁️ ${t('sidebar.awsResourceMonitoring')}`, icon: '☁️',
      children: [
        { id: 'aws-rds', label: language === 'ko' ? 'RDS 조회' : 'RDS Query', icon: '🗄️', path: '/aws-rds' },
        { id: 'aws-cloudwatch', label: language === 'ko' ? 'CloudWatch 조회' : 'CloudWatch Query', icon: '📊', path: '/aws-cloudwatch' }
      ]
    }
  ];

  // DB 목록 가져오기
  const fetchDatabases = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/databases');
      if (response.ok) {
        const data = await response.json();
        setDatabases(data.databases || []);
        if (data.databases && data.databases.length > 0 && !selectedDb) {
          setSelectedDb(data.databases[0].name);
        }
      } else {
        console.error('DB 목록 가져오기 실패');
      }
    } catch (error) {
      console.error('DB 목록 요청 오류:', error);
    } finally {
      setLoading(false);
    }
  }, [selectedDb]);

  // OpenAI 키 목록 가져오기 (이제 AIManager에서 관리하므로 필요없거나 변경될 수 있음)
  // const fetchOpenAIKeys = async () => {
  //   try {
  //     const response = await fetch('/api/openai/keys');
  //     if (response.ok) {
  //       const data = await response.json();
  //       setOpenaiKeys(data.keys || []);
  //       setSelectedOpenAIKey(data.selected || '');
  //     }
  //   } catch (error) {
  //     console.error('OpenAI 키 목록 가져오기 실패:', error);
  //   }
  // };

  // DB 변경 처리
  const handleDatabaseChange = () => {
    fetchDatabases();
  };

  // DB 삭제 처리
  const handleDatabaseDelete = (dbName) => {
    setDatabases(prev => prev.filter(db => db.name !== dbName));
    if (selectedDb === dbName) {
      setSelectedDb('');
    }
  };

  // DB 추가 처리
  const handleDatabaseAdd = () => {
    fetchDatabases();
  };

  // OpenAI 키 변경 처리 (이제 AIManager에서 관리하므로 필요없거나 변경될 수 있음)
  // const handleOpenAIKeyChange = () => {
  //   fetchOpenAIKeys();
  // };

  useEffect(() => {
    fetchDatabases();
    // fetchOpenAIKeys(); // 이제 AIManager에서 관리
  }, [fetchDatabases]);

  // 라우터 네비게이션 헬퍼
  function SidebarNav() {
    const navigate = useNavigate();
    const location = useLocation();
    return (
      <nav className={`sidebar-nav${sidebarCollapsed ? ' collapsed' : ''}`}>
        {menuItems.map(item => (
          item.children ? (
            <div key={item.id}>
              <button
                onClick={() => setShowAwsSubMenu(!showAwsSubMenu)}
                className={`nav-item ${location.pathname.startsWith('/aws-') ? 'active' : ''}`}
                title={sidebarCollapsed ? item.label : undefined}
              >
                <span className="nav-icon">{item.icon}</span>
                {!sidebarCollapsed && <span className="nav-label">{item.label}</span>}
              </button>
              {showAwsSubMenu && !sidebarCollapsed && (
                <div className="submenu">
                  {item.children.map(sub => (
                    <button
                      key={sub.id}
                      onClick={() => navigate(sub.path)}
                      className={`nav-item sub ${location.pathname === sub.path ? 'active' : ''}`}
                    >
                      <span className="nav-icon">{sub.icon}</span>
                      <span className="nav-label">{sub.label}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <button
              key={item.id}
              onClick={() => navigate(item.path)}
              className={`nav-item ${location.pathname === item.path ? 'active' : ''}`}
              title={sidebarCollapsed ? item.label : undefined}
            >
              <span className="nav-icon">{item.icon}</span>
              {!sidebarCollapsed && <span className="nav-label">{item.label}</span>}
            </button>
          )
        ))}
      </nav>
    );
  }

  if (loading && databases.length === 0) {
    return (
      <div className="app-loading">
        <div className="loading-spinner"></div>
        <p>{language === 'ko' ? '데이터베이스 정보를 불러오는 중...' : 'Loading database information...'}</p>
      </div>
    );
  }

  return (
    <Router>
      <div className="app wrapper">
        {/* 사이드바 네비게이션 */}
        <div className={`sidebar${sidebarCollapsed ? ' collapsed' : ''}`}>
          <div className="sidebar-header">
            <div className="sidebar-header-row">
              <span className="sidebar-logo">🚀</span>
              {!sidebarCollapsed && <span className="sidebar-title">DB Agent</span>}
              <button
                className="sidebar-toggle-btn"
                onClick={() => setSidebarCollapsed(v => !v)}
                title={sidebarCollapsed ? (language === 'ko' ? '사이드바 펼치기' : 'Expand sidebar') : (language === 'ko' ? '사이드바 접기' : 'Collapse sidebar')}
                aria-label={language === 'ko' ? '사이드바 토글' : 'Toggle sidebar'}
              >
                {sidebarCollapsed ? <span>&#9776;</span> : <span>&#10094;</span>}
              </button>
            </div>
            {!sidebarCollapsed && <div className="sidebar-desc">{language === 'ko' ? 'SRE/DBA용 AI 도구' : 'AI Tools for SRE/DBA'}</div>}
          </div>
          <SidebarNav />
          {/* 언어 전환 버튼을 사이드바 하단에 추가 */}
          <div className="sidebar-footer">
            <LanguageToggle />
          </div>
        </div>
        <div className="main-content">
          <div className="container">
            <Routes>
              <Route path="/chat" element={<ChatComponent selectedDb={selectedDb} databases={databases} onDbChange={setSelectedDb} />} />
              <Route path="/databases" element={<DatabaseManager databases={databases} onDatabaseDelete={handleDatabaseDelete} onDatabaseChange={handleDatabaseChange} />} />
              <Route path="/ai-manager" element={<AIManager />} />
              <Route path="/playbooks" element={<PlaybookComponent selectedDb={selectedDb} databases={databases} />} />
              <Route path="/monitoring" element={<MonitoringComponent selectedDb={selectedDb} databases={databases} onDbChange={setSelectedDb} />} />
              <Route path="/slowquery" element={<SlowQueryComponent selectedDb={selectedDb} databases={databases} />} />
              <Route path="/aws" element={<AwsIntegrationComponent selectedDb={selectedDb} databases={databases} />} />
              <Route path="/aws-rds" element={<AwsRdsResource onDatabaseAdd={handleDatabaseAdd} />} />
              <Route path="/aws-cloudwatch" element={<AwsCloudwatchResource />} />
              <Route path="*" element={<ChatComponent selectedDb={selectedDb} databases={databases} onDbChange={setSelectedDb} />} />
            </Routes>
          </div>
        </div>
      </div>
    </Router>
  );
}

function App() {
  return (
    <LanguageProvider>
      <AppContent />
    </LanguageProvider>
  );
}

export default App;