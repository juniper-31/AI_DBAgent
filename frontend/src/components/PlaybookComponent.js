import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '../contexts/LanguageContext';
import { useTranslation } from '../utils/translations';

const PlaybookComponent = ({ selectedDb, databases }) => {
  const navigate = useNavigate();
  const { language } = useLanguage();
  const { t } = useTranslation(language);
  const [playbooks, setPlaybooks] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [selectedCategory, setSelectedCategory] = useState(() => language === 'ko' ? '전체' : 'All');
  const [expandedPlaybook, setExpandedPlaybook] = useState(null);

  // 플레이북 목록 가져오기
  const fetchPlaybooks = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/playbooks');
      if (response.ok) {
        const playbooksData = await response.json();
        setPlaybooks(playbooksData);
      } else {
        console.error('플레이북 목록 가져오기 실패');
        setError(t('playbook.fetchError'));
      }
    } catch (error) {
      console.error('플레이북 목록 가져오기 실패:', error);
      setError(t('playbook.fetchError'));
    } finally {
      setLoading(false);
    }
  };

  // 플레이북 실행 (AI 채팅으로 단계별 실행)
  const handleRunPlaybook = async (playbook) => {
    if (!selectedDb) {
      setError(t('playbook.selectDbFirst'));
      return;
    }

    setLoading(true);
    setError('');
    
    try {
      // AI 채팅 페이지로 이동하면서 플레이북 정보 전달
      const playbookData = {
        name: playbook.name,
        description: playbook.description,
        category: playbook.category,
        steps: playbook.steps,
        selectedDb: selectedDb
      };
      
      // 세션 스토리지에 플레이북 정보 저장
      sessionStorage.setItem('runningPlaybook', JSON.stringify(playbookData));
      
      setSuccess(t('playbook.playbookRunning').replace('{name}', playbook.name));
      
      // AI 채팅 페이지로 리다이렉트
      setTimeout(() => {
        navigate('/chat');
      }, 1500);
      
    } catch (error) {
      setError(t('playbook.playbookError'));
    } finally {
      setLoading(false);
    }
  };

  // 카테고리 목록 생성
  const getCategories = () => {
    const allText = language === 'ko' ? '전체' : 'All';
    const categories = [allText, ...new Set(playbooks.map(p => p.category).filter(Boolean))];
    return categories;
  };

  // 카테고리별 플레이북 필터링
  const getFilteredPlaybooks = () => {
    const allText = language === 'ko' ? '전체' : 'All';
    if (selectedCategory === allText) {
      return playbooks;
    }
    return playbooks.filter(p => p.category === selectedCategory);
  };

  // 플레이북 확장/축소 토글
  const togglePlaybookExpansion = (index) => {
    setExpandedPlaybook(expandedPlaybook === index ? null : index);
  };

  // 카테고리 표시명 가져오기
  const getDisplayCategoryName = (category) => {
    const allText = language === 'ko' ? '전체' : 'All';
    if (category === allText) {
      return category;
    }
    
    // 번역 시도
    const translationKey = `playbook.categories.${category}`;
    const translated = t(translationKey);
    
    // 번역이 실패했으면 (키가 그대로 반환되면) 원본 카테고리명 사용
    if (translated === translationKey) {
      return category;
    }
    
    return translated;
  };

  useEffect(() => {
    fetchPlaybooks();
  }, []);

  // 언어 변경 시 selectedCategory 동기화
  useEffect(() => {
    const allText = language === 'ko' ? '전체' : 'All';
    if (selectedCategory === '전체' || selectedCategory === 'All') {
      setSelectedCategory(allText);
    }
  }, [language]);

  const filteredPlaybooks = getFilteredPlaybooks();

  return (
    <div className="page-content">
      <div className="page-header">
        <div className="section-header">
          <h2>📖 {t('playbook.title')}</h2>
          <p>{t('playbook.description')}</p>
        </div>

        {/* 현재 선택된 DB 표시 */}
        {selectedDb && (
          <div className="current-db-info">
            <span className="db-label">{t('playbook.selectedDb')}:</span>
            <span className="db-name">{selectedDb}</span>
          </div>
        )}
      </div>

      <div className="page-body">
        {/* 상태 메시지 */}
        {error && (
          <div className="alert alert-error">
            <span>⚠️ {error}</span>
            <button onClick={() => setError('')} className="close-btn">✕</button>
          </div>
        )}
        
        {success && (
          <div className="alert alert-success">
            <span>✅ {success}</span>
            <button onClick={() => setSuccess('')} className="close-btn">✕</button>
          </div>
        )}

        {/* DB 선택 안내 */}
        {!selectedDb && (
          <div className="alert alert-warning">
            <span>{t('playbook.selectDbWarning')}</span>
          </div>
        )}

        {/* 카테고리 필터 */}
        {playbooks.length > 0 && (
          <div className="category-filter">
            <h3>{t('common.filterByCategory')}</h3>
            <div className="category-buttons">
              {getCategories().map(category => {
                const allText = language === 'ko' ? '전체' : 'All';
                const count = category === allText ? playbooks.length : playbooks.filter(p => p.category === category).length;
                return (
                  <button
                    key={category}
                    onClick={() => setSelectedCategory(category)}
                    className={`category-btn ${selectedCategory === category ? 'active' : ''}`}
                  >
                    {getDisplayCategoryName(category)} ({count})
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* 플레이북 목록 */}
        <div className="playbook-container">
          {loading ? (
            <div className="loading-state">
              <div className="loading-spinner"></div>
              <p>{t('playbook.loading')}</p>
            </div>
          ) : filteredPlaybooks.length === 0 ? (
            <div className="empty-state">
              <h3>{t('playbook.noPlaybooks')}</h3>
              <p>{selectedCategory === (language === 'ko' ? '전체' : 'All') ? t('playbook.noAvailablePlaybooks') : t('playbook.noCategoryPlaybooks').replace('{category}', selectedCategory)}</p>
            </div>
          ) : (
            <div className="playbook-grid">
              {filteredPlaybooks.map((playbook, index) => (
                <div key={index} className="playbook-card">
                  <div className="playbook-header">
                    <div className="playbook-title-section">
                      <h3>{playbook.name}</h3>
                      {playbook.category && (
                        <span className={`playbook-category category-${playbook.category.replace(/\s+/g, '-').toLowerCase()}`}>
                          {playbook.category}
                        </span>
                      )}
                    </div>
                    <button
                      onClick={() => togglePlaybookExpansion(index)}
                      className="expand-btn"
                      title={expandedPlaybook === index ? (language === 'ko' ? '접기' : 'Collapse') : (language === 'ko' ? '자세히 보기' : 'Expand')}
                    >
                      {expandedPlaybook === index ? '▲' : '▼'}
                    </button>
                  </div>
                  
                  <div className="playbook-description">
                    <p>{playbook.description}</p>
                  </div>
                  
                  {expandedPlaybook === index && (
                    <div className="playbook-details">
                      <div className="playbook-steps">
                        <h4>📋 {t('playbook.executionSteps').replace('{count}', playbook.steps.length)}</h4>
                        <div className="steps-list">
                          {playbook.steps.map((step, stepIndex) => (
                            <div key={stepIndex} className="step-item">
                              <div className="step-number">{stepIndex + 1}</div>
                              <div className="step-content">
                                <div className="step-title">{step.title}</div>
                                <div className="step-prompt">{step.prompt}</div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                  
                  <div className="playbook-actions">
                    <button
                      onClick={() => handleRunPlaybook(playbook)}
                      className="btn btn-primary playbook-run-btn"
                      disabled={loading || !selectedDb}
                    >
                      {loading ? t('playbook.running') : t('playbook.runPlaybook')}
                    </button>
                    
                    <div className="playbook-meta">
                      <span className="meta-item">
                        ⏱️ {t('playbook.estimatedTime')}: {playbook.estimatedTime || (language === 'ko' ? '2-5분' : '2-5 min')}
                      </span>
                      <span className="meta-item">
                        📊 {t('playbook.steps').replace('{count}', playbook.steps.length)}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 사용법 안내 */}
        <div className="usage-guide-section">
          <div className="card">
            <h3>{t('playbook.usageGuide')}</h3>
            <div className="guide-content">
              <div className="guide-steps">
                <div className="guide-step">
                  <span className="step-icon">1️⃣</span>
                  <div>
                    <strong>{t('playbook.selectDatabase')}</strong>
                    <p>{t('playbook.selectDatabaseDesc')}</p>
                  </div>
                </div>
                <div className="guide-step">
                  <span className="step-icon">2️⃣</span>
                  <div>
                    <strong>{t('playbook.selectPlaybook')}</strong>
                    <p>{t('playbook.selectPlaybookDesc')}</p>
                  </div>
                </div>
                <div className="guide-step">
                  <span className="step-icon">3️⃣</span>
                  <div>
                    <strong>{t('playbook.executeAndMonitor')}</strong>
                    <p>{t('playbook.executeAndMonitorDesc')}</p>
                  </div>
                </div>
              </div>
              
              <div className="guide-tips">
                <h4>💡 {t('common.tips')}</h4>
                <ul>
                  {language === 'ko' ? (
                    <>
                      <li><strong>정기 점검:</strong> 매일/주간 플레이북으로 시스템 상태를 정기적으로 체크하세요</li>
                      <li><strong>성능 최적화:</strong> 슬로우 쿼리나 성능 이슈 발견 시 관련 플레이북을 실행하세요</li>
                      <li><strong>보안 감사:</strong> 개인정보 보호 및 보안 점검을 정기적으로 수행하세요</li>
                      <li><strong>장애 대응:</strong> 긴급 상황 시 응급 대응 플레이북을 활용하세요</li>
                    </>
                  ) : (
                    <>
                      <li><strong>Regular Checks:</strong> Use daily/weekly playbooks to regularly check system status</li>
                      <li><strong>Performance Optimization:</strong> Run related playbooks when slow queries or performance issues are found</li>
                      <li><strong>Security Audit:</strong> Regularly perform privacy protection and security checks</li>
                      <li><strong>Incident Response:</strong> Use emergency response playbooks in urgent situations</li>
                    </>
                  )}
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PlaybookComponent; 