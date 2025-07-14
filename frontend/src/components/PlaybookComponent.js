import React, { useState, useEffect } from 'react';

const PlaybookComponent = ({ selectedDb, databases }) => {
  const [playbooks, setPlaybooks] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

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

  // 플레이북 실행
  const handleRunPlaybook = async (playbookName) => {
    if (!selectedDb) {
      setError('먼저 데이터베이스를 선택해주세요.');
      return;
    }

    setLoading(true);
    try {
      const formData = new FormData();
      formData.append('playbook_name', playbookName);
      formData.append('db_name', selectedDb);

      const response = await fetch('/playbooks/run', {
        method: 'POST',
        body: formData
      });

      if (response.ok) {
        setSuccess(`플레이북 "${playbookName}"이 성공적으로 실행되었습니다. AI 채팅에서 결과를 확인하세요.`);
        setError('');
        
        // AI 채팅 페이지로 리다이렉트
        setTimeout(() => {
          window.location.href = '/nl2sql';
        }, 2000);
      } else {
        setError('플레이북 실행에 실패했습니다.');
      }
    } catch (error) {
      setError('플레이북 실행 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPlaybooks();
  }, []);

  return (
    <div className="playbook-component">
      <div className="section-header">
        <h2>📖 플레이북</h2>
        <p>자주 사용하는 데이터베이스 작업을 자동화된 플레이북으로 실행하세요.</p>
      </div>

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

      {/* 플레이북 목록 */}
      <div className="playbook-grid">
        {loading ? (
          <div className="loading-state">
            <div className="loading-spinner"></div>
            <p>플레이북을 불러오는 중...</p>
          </div>
        ) : playbooks.length === 0 ? (
          <div className="empty-state">
            <p>사용 가능한 플레이북이 없습니다.</p>
            <p>플레이북을 추가하려면 playbooks.json 파일을 확인하세요.</p>
          </div>
        ) : (
          playbooks.map((playbook, index) => (
            <div key={index} className="playbook-card">
              <div className="playbook-header">
                <h3>{playbook.name}</h3>
                <span className="playbook-category">{playbook.category}</span>
              </div>
              
              <div className="playbook-description">
                <p>{playbook.description}</p>
              </div>
              
              <div className="playbook-steps">
                <h4>실행 단계:</h4>
                <ol>
                  {playbook.steps.map((step, stepIndex) => (
                    <li key={stepIndex}>
                      <strong>{step.title}</strong>
                      <p>{step.prompt}</p>
                    </li>
                  ))}
                </ol>
              </div>
              
              <div className="playbook-actions">
                <button
                  onClick={() => handleRunPlaybook(playbook.name)}
                  className="btn btn-primary"
                  disabled={loading || !selectedDb}
                >
                  {loading ? '실행 중...' : '플레이북 실행'}
                </button>
                
                <div className="playbook-info">
                  <span>예상 시간: {playbook.estimatedTime || '1-2분'}</span>
                  <span>난이도: {playbook.difficulty || '보통'}</span>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* 사용법 안내 */}
      <div className="card">
        <h3>📖 플레이북 사용법</h3>
        <div className="usage-guide">
          <ol>
            <li>데이터베이스를 선택하세요</li>
            <li>실행할 플레이북을 선택하세요</li>
            <li>"플레이북 실행" 버튼을 클릭하세요</li>
            <li>AI가 자동으로 단계별 작업을 수행합니다</li>
            <li>결과는 AI 채팅에서 확인할 수 있습니다</li>
          </ol>
        </div>
      </div>
    </div>
  );
};

export default PlaybookComponent; 