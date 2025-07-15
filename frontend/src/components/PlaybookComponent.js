import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

const PlaybookComponent = ({ selectedDb, databases }) => {
  const navigate = useNavigate();
  const [playbooks, setPlaybooks] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('전체');
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
        setError('플레이북 목록을 가져오는 중 오류가 발생했습니다.');
      }
    } catch (error) {
      console.error('플레이북 목록 가져오기 실패:', error);
      setError('플레이북 목록을 가져오는 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  // 플레이북 실행 (AI 채팅으로 단계별 실행)
  const handleRunPlaybook = async (playbook) => {
    if (!selectedDb) {
      setError('먼저 데이터베이스를 선택해주세요.');
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
      
      setSuccess(`플레이북 "${playbook.name}"을 AI 채팅에서 실행합니다...`);
      
      // AI 채팅 페이지로 리다이렉트
      setTimeout(() => {
        navigate('/chat');
      }, 1500);
      
    } catch (error) {
      setError('플레이북 실행 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  // 카테고리 목록 생성
  const getCategories = () => {
    const categories = ['전체', ...new Set(playbooks.map(p => p.category).filter(Boolean))];
    return categories;
  };

  // 카테고리별 플레이북 필터링
  const getFilteredPlaybooks = () => {
    if (selectedCategory === '전체') {
      return playbooks;
    }
    return playbooks.filter(p => p.category === selectedCategory);
  };

  // 플레이북 확장/축소 토글
  const togglePlaybookExpansion = (index) => {
    setExpandedPlaybook(expandedPlaybook === index ? null : index);
  };

  useEffect(() => {
    fetchPlaybooks();
  }, []);

  const filteredPlaybooks = getFilteredPlaybooks();

  return (
    <div className="page-content">
      <div className="page-header">
        <div className="section-header">
          <h2>📖 플레이북 관리</h2>
          <p>데이터베이스 운영 작업을 자동화된 플레이북으로 효율적으로 수행하세요.</p>
        </div>

        {/* 현재 선택된 DB 표시 */}
        {selectedDb && (
          <div className="current-db-info">
            <span className="db-label">선택된 DB:</span>
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
            <span>⚠️ 플레이북을 실행하려면 먼저 데이터베이스를 선택해주세요.</span>
          </div>
        )}

        {/* 카테고리 필터 */}
        {playbooks.length > 0 && (
          <div className="category-filter">
            <h3>카테고리별 필터</h3>
            <div className="category-buttons">
              {getCategories().map(category => (
                <button
                  key={category}
                  onClick={() => setSelectedCategory(category)}
                  className={`category-btn ${selectedCategory === category ? 'active' : ''}`}
                >
                  {category} ({category === '전체' ? playbooks.length : playbooks.filter(p => p.category === category).length})
                </button>
              ))}
            </div>
          </div>
        )}

        {/* 플레이북 목록 */}
        <div className="playbook-container">
          {loading ? (
            <div className="loading-state">
              <div className="loading-spinner"></div>
              <p>플레이북을 불러오는 중...</p>
            </div>
          ) : filteredPlaybooks.length === 0 ? (
            <div className="empty-state">
              <h3>플레이북이 없습니다</h3>
              <p>{selectedCategory === '전체' ? '사용 가능한 플레이북이 없습니다.' : `"${selectedCategory}" 카테고리에 플레이북이 없습니다.`}</p>
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
                      title={expandedPlaybook === index ? '접기' : '자세히 보기'}
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
                        <h4>📋 실행 단계 ({playbook.steps.length}단계)</h4>
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
                      {loading ? '실행 중...' : '🚀 플레이북 실행'}
                    </button>
                    
                    <div className="playbook-meta">
                      <span className="meta-item">
                        ⏱️ 예상 시간: {playbook.estimatedTime || '2-5분'}
                      </span>
                      <span className="meta-item">
                        📊 단계: {playbook.steps.length}개
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
            <h3>💡 플레이북 사용 가이드</h3>
            <div className="guide-content">
              <div className="guide-steps">
                <div className="guide-step">
                  <span className="step-icon">1️⃣</span>
                  <div>
                    <strong>데이터베이스 선택</strong>
                    <p>상단에서 작업할 데이터베이스를 선택하세요</p>
                  </div>
                </div>
                <div className="guide-step">
                  <span className="step-icon">2️⃣</span>
                  <div>
                    <strong>플레이북 선택</strong>
                    <p>목적에 맞는 플레이북을 카테고리별로 찾아보세요</p>
                  </div>
                </div>
                <div className="guide-step">
                  <span className="step-icon">3️⃣</span>
                  <div>
                    <strong>실행 및 모니터링</strong>
                    <p>플레이북 실행 후 AI 채팅에서 단계별 결과를 확인하세요</p>
                  </div>
                </div>
              </div>
              
              <div className="guide-tips">
                <h4>💡 활용 팁</h4>
                <ul>
                  <li><strong>정기 점검:</strong> 매일/주간 플레이북으로 시스템 상태를 정기적으로 체크하세요</li>
                  <li><strong>성능 최적화:</strong> 슬로우 쿼리나 성능 이슈 발견 시 관련 플레이북을 실행하세요</li>
                  <li><strong>보안 감사:</strong> 개인정보 보호 및 보안 점검을 정기적으로 수행하세요</li>
                  <li><strong>장애 대응:</strong> 긴급 상황 시 응급 대응 플레이북을 활용하세요</li>
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