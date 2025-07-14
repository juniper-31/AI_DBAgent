// DatabaseManager.js
// DB 연결 관리, 폼, 리스트, 인라인 수정 등
import React, { useState, useEffect } from 'react';

function DatabaseManager({ databases, onDatabaseChange, onDatabaseDelete, onDatabaseAdd }) {
  const [showForm, setShowForm] = useState(false);
  const [editingDb, setEditingDb] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    host: '',
    port: '',
    database: '',
    username: '',
    password: '',
    remark: '', // 비고 필드 추가
    cloudwatch_id: '', // AWS RDS 인스턴스ID 필드 추가
  });
  const [errors, setErrors] = useState({});

  // 연결 상태 관리 (localStorage 연동)
  const [connectionStatus, setConnectionStatus] = useState(() => {
    try {
      const saved = localStorage.getItem('db-connection-status');
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

  // connectionStatus가 바뀔 때마다 localStorage에 저장
  useEffect(() => {
    localStorage.setItem('db-connection-status', JSON.stringify(connectionStatus));
  }, [connectionStatus]);

  // 1분마다 자동 연결 상태 갱신
  useEffect(() => {
    let timer;
    const pollConnections = async () => {
      if (databases && databases.length > 0) {
        for (const db of databases) {
          try {
            const response = await fetch('/api/databases/test', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(db),
              credentials: 'include'
            });
            const result = await response.json();
            setConnectionStatus(prev => ({
              ...prev,
              [db.name]: result.success ? 'success' : 'fail'
            }));
          } catch {
            setConnectionStatus(prev => ({
              ...prev,
              [db.name]: 'fail'
            }));
          }
        }
      }
      timer = setTimeout(pollConnections, 60000); // 1분마다 반복
    };
    pollConnections();
    return () => clearTimeout(timer);
  }, [databases]);

  const [showBrowseForm, setShowBrowseForm] = useState(false);
  const [browseFormData, setBrowseFormData] = useState({
    host: '',
    port: '',
    username: '',
    password: '',
  });
  const [browsedDatabases, setBrowsedDatabases] = useState([]);
  const [browseError, setBrowseError] = useState('');

  // 폼 초기화
  const resetForm = () => {
    setFormData({
      name: '',
      host: '',
      port: '',
      database: '',
      username: '',
      password: '',
      remark: '', // 비고 초기화
      cloudwatch_id: '',
    });
    setErrors({});
    setEditingDb(null);
  };

  // 폼 표시/숨김 토글
  const toggleForm = () => {
    if (showForm) {
      resetForm();
    }
    setShowForm(!showForm);
    setShowBrowseForm(false); // Hide browse form when toggling add/edit form
  };

  // DB Browse 폼 표시/숨김 토글
  const toggleBrowseForm = () => {
    setShowBrowseForm(!showBrowseForm);
    setShowForm(false); // Hide add/edit form when toggling browse form
    setBrowsedDatabases([]); // Clear browsed results
    setBrowseError('');
    setBrowseFormData({
      host: formData.host || '',
      port: formData.port || '',
      username: formData.username || '',
      password: formData.password || '',
    });
  };

  // 편집 모드 시작
  const startEdit = (db) => {
    setFormData({
      name: db.name,
      host: db.host,
      port: db.port || '',
      database: db.dbname || '', // Use dbname from backend
      username: db.user || '',   // Use user from backend
      password: db.password,
      remark: db.remark || '', // 비고
      cloudwatch_id: db.cloudwatch_id || '',
    });
    setEditingDb(db);
    setShowForm(true);
    setShowBrowseForm(false); // Hide browse form
    setErrors({});
  };

  // 입력 필드 변경 처리
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    
    // 에러 클리어
    if (errors[name]) {
      setErrors(prev => ({
        ...prev,
        [name]: ''
      }));
    }
  };

  // DB Browse 폼 입력 필드 변경 처리
  const handleBrowseInputChange = (e) => {
    const { name, value } = e.target;
    setBrowseFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  // 조회된 DB 선택
  const handleSelectBrowsedDb = (dbName) => {
    setFormData(prev => ({
      ...prev,
      database: dbName
    }));
    setShowBrowseForm(false);
    setShowForm(true);
  };

  // 폼 유효성 검사
  const validateForm = () => {
    const newErrors = {};
    
    if (!formData.name.trim()) {
      newErrors.name = 'DB 이름을 입력하세요';
    }
    
    if (!formData.host.trim()) {
      newErrors.host = '호스트를 입력하세요';
    }
    
    if (!formData.database.trim()) {
      newErrors.database = '데이터베이스명을 입력하세요';
    }
    
    if (!formData.username.trim()) {
      newErrors.username = '사용자명을 입력하세요';
    }
    
    if (!formData.password.trim()) {
      newErrors.password = '비밀번호를 입력하세요';
    }

    // 포트 번호 검증
    if (formData.port && (isNaN(formData.port) || formData.port < 1 || formData.port > 65535)) {
      newErrors.port = '유효한 포트 번호를 입력하세요 (1-65535)';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // DB 목록 조회 처리
  const handleBrowseDatabases = async (e) => {
    e.preventDefault();
    setBrowseError('');
    setBrowsedDatabases([]);

    if (!browseFormData.host.trim() || !browseFormData.username.trim() || !browseFormData.password.trim()) {
      setBrowseError('호스트, 사용자명, 비밀번호는 필수입니다.');
      return;
    }

    try {
      const formDataToSend = new FormData();
      formDataToSend.append('host', browseFormData.host);
      formDataToSend.append('port', browseFormData.port || 5432);
      formDataToSend.append('user', browseFormData.username);
      formDataToSend.append('password', browseFormData.password);

      const response = await fetch('/api/databases/browse', {
        method: 'POST',
        body: formDataToSend,
      });

      const result = await response.json();
      if (result.status === 'success') {
        setBrowsedDatabases(result.databases);
      } else {
        setBrowseError(result.message || '데이터베이스 목록 조회에 실패했습니다.');
      }
    } catch (error) {
      setBrowseError('데이터베이스 목록 조회 중 오류가 발생했습니다.');
      console.error('Browse DBs error:', error);
    }
  };

  // 폼 제출 처리
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    try {
      const formDataToSend = new FormData();
      formDataToSend.append('name', formData.name);
      formDataToSend.append('host', formData.host);
      formDataToSend.append('port', formData.port);
      formDataToSend.append('user', formData.username);
      formDataToSend.append('password', formData.password);
      formDataToSend.append('dbname', formData.database);
      formDataToSend.append('remark', formData.remark || ''); // 비고 추가
      formDataToSend.append('cloudwatch_id', formData.cloudwatch_id); // 추가
      
      const response = await fetch('/api/databases', {
        method: 'POST',
        body: formDataToSend
      });

      if (response.ok) {
        const result = await response.json();
        if (result.status === 'success') {
          onDatabaseChange(); // 부모 컴포넌트에 변경 알림
          resetForm();
          setShowForm(false);
        } else {
          setErrors({ general: '저장에 실패했습니다.' });
        }
      } else {
        throw new Error('요청 실패');
      }
    } catch (error) {
      setErrors({ general: '연결 오류가 발생했습니다.' });
    }
  };

  // DB 삭제 처리
  const handleDelete = async (dbName) => {
    if (!window.confirm(`정말로 "${dbName}" 데이터베이스 연결을 삭제하시겠습니까?`)) {
      return;
    }

    try {
      const response = await fetch(`/api/databases/${dbName}`, {
        method: 'DELETE'
      });

      if (response.ok) {
        const result = await response.json();
        if (result.status === 'success') {
          onDatabaseDelete(dbName);
        } else {
          alert('삭제에 실패했습니다.');
        }
      } else {
        throw new Error('요청 실패');
      }
    } catch (error) {
      alert('삭제 중 오류가 발생했습니다.');
    }
  };

  // 연결 테스트
  const testConnection = async (db) => {
    try {
      setConnectionStatus(prev => ({ ...prev, [db.name]: 'loading' }));
      const response = await fetch('/api/databases/test', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(db),
        credentials: 'include'
      });
      const result = await response.json();
      if (result.success) {
        setConnectionStatus(prev => ({ ...prev, [db.name]: 'success' }));
        alert('연결 테스트 성공!');
      } else {
        setConnectionStatus(prev => ({ ...prev, [db.name]: 'fail' }));
        alert(`연결 테스트 실패: ${result.message}`);
      }
    } catch (error) {
      setConnectionStatus(prev => ({ ...prev, [db.name]: 'fail' }));
      alert('연결 테스트 중 오류가 발생했습니다.');
    }
  };

  return (
    <div className="database-manager">
      {/* 헤더 */}
      <div className="manager-header">
        <h2>데이터베이스 연결 관리</h2>
        <button 
          onClick={toggleForm} 
          className={`btn ${showForm ? 'btn-secondary' : 'btn-primary'}`}
        >
          {showForm ? '취소' : '새 DB 추가'}
        </button>
        <button 
          onClick={toggleBrowseForm} 
          className={`btn ${showBrowseForm ? 'btn-secondary' : 'btn-info'}`}
        >
          {showBrowseForm ? '취소' : 'DB 목록 조회'}
        </button>
      </div>

      {/* DB 추가/편집 폼 */}
      {showForm && (
        <div className="form-container">
          <form onSubmit={handleSubmit} className="db-form">
            <h3>{editingDb ? 'DB 연결 수정' : '새 DB 연결 추가'}</h3>
            
            {errors.general && (
              <div className="error-message">{errors.general}</div>
            )}

            <div className="form-row">
              <div className="form-group">
                <label htmlFor="name">DB 이름 *</label>
                <input
                  type="text"
                  id="name"
                  name="name"
                  value={formData.name}
                  onChange={handleInputChange}
                  placeholder="예: production_db"
                  className={errors.name ? 'error' : ''}
                />
                {errors.name && <span className="error-text">{errors.name}</span>}
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label htmlFor="host">호스트 *</label>
                <input
                  type="text"
                  id="host"
                  name="host"
                  value={formData.host}
                  onChange={handleInputChange}
                  placeholder="예: localhost 또는 192.168.1.100"
                  className={errors.host ? 'error' : ''}
                />
                {errors.host && <span className="error-text">{errors.host}</span>}
              </div>
              
              <div className="form-group">
                <label htmlFor="port">포트</label>
                <input
                  type="number"
                  id="port"
                  name="port"
                  value={formData.port}
                  onChange={handleInputChange}
                  placeholder="기본값 사용"
                  className={errors.port ? 'error' : ''}
                />
                {errors.port && <span className="error-text">{errors.port}</span>}
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label htmlFor="database">데이터베이스명 *</label>
                <input
                  type="text"
                  id="database"
                  name="database"
                  value={formData.database}
                  onChange={handleInputChange}
                  placeholder="예: myapp_production"
                  className={errors.database ? 'error' : ''}
                />
                {errors.database && <span className="error-text">{errors.database}</span>}
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label htmlFor="username">사용자명 *</label>
                <input
                  type="text"
                  id="username"
                  name="username"
                  value={formData.username}
                  onChange={handleInputChange}
                  placeholder="예: dbuser"
                  className={errors.username ? 'error' : ''}
                />
                {errors.username && <span className="error-text">{errors.username}</span>}
              </div>
              
              <div className="form-group">
                <label htmlFor="password">비밀번호 *</label>
                <input
                  type="password"
                  id="password"
                  name="password"
                  value={formData.password}
                  onChange={handleInputChange}
                  placeholder="비밀번호 입력"
                  className={errors.password ? 'error' : ''}
                />
                {errors.password && <span className="error-text">{errors.password}</span>}
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label htmlFor="remark">비고(선택)</label>
                <input
                  type="text"
                  id="remark"
                  name="remark"
                  value={formData.remark}
                  onChange={handleInputChange}
                  placeholder="예: AWS 계정/용도/설명 등"
                />
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="cloudwatch_id">AWS RDS 인스턴스ID (CloudWatch용)</label>
              <input
                type="text"
                id="cloudwatch_id"
                name="cloudwatch_id"
                value={formData.cloudwatch_id}
                onChange={handleInputChange}
                placeholder="예: rds-xxxx, aurora-xxx 등 AWS 인스턴스ID"
                autoComplete="off"
              />
              {errors.cloudwatch_id && <div className="form-error">{errors.cloudwatch_id}</div>}
            </div>

            <div className="form-actions">
              <button type="submit" className="btn btn-primary">
                {editingDb ? '수정' : '추가'}
              </button>
              <button type="button" onClick={toggleForm} className="btn btn-secondary">
                취소
              </button>
            </div>
          </form>
        </div>
      )}

      {/* DB 목록 조회 폼 */}
      {showBrowseForm && (
        <div className="form-container">
          <form onSubmit={handleBrowseDatabases} className="db-form">
            <h3>DB 인스턴스에서 목록 조회</h3>
            {browseError && (
              <div className="error-message">{browseError}</div>
            )}
            <div className="form-row">
              <div className="form-group">
                <label htmlFor="browse-host">호스트 *</label>
                <input
                  type="text"
                  id="browse-host"
                  name="host"
                  value={browseFormData.host}
                  onChange={handleBrowseInputChange}
                  placeholder="예: localhost 또는 RDS 엔드포인트"
                  required
                />
              </div>
              <div className="form-group">
                <label htmlFor="browse-port">포트</label>
                <input
                  type="number"
                  id="browse-port"
                  name="port"
                  value={browseFormData.port}
                  onChange={handleBrowseInputChange}
                  placeholder="기본값 5432"
                />
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label htmlFor="browse-username">사용자명 *</label>
                <input
                  type="text"
                  id="browse-username"
                  name="username"
                  value={browseFormData.username}
                  onChange={handleBrowseInputChange}
                  placeholder="예: postgres"
                  required
                />
              </div>
              <div className="form-group">
                <label htmlFor="browse-password">비밀번호 *</label>
                <input
                  type="password"
                  id="browse-password"
                  name="password"
                  value={browseFormData.password}
                  onChange={handleBrowseInputChange}
                  placeholder="비밀번호 입력"
                  required
                />
              </div>
            </div>
            <div className="form-actions">
              <button type="submit" className="btn btn-info">
                DB 목록 조회
              </button>
              <button type="button" onClick={toggleBrowseForm} className="btn btn-secondary">
                취소
              </button>
            </div>
          </form>

          {browsedDatabases.length > 0 && (
            <div className="browsed-databases-list">
              <h4>조회된 데이터베이스 ({browsedDatabases.length}개)</h4>
              <ul>
                {browsedDatabases.map((dbName, index) => (
                  <li key={index}>
                    {dbName}
                    <button 
                      onClick={() => handleSelectBrowsedDb(dbName)}
                      className="btn btn-sm btn-outline"
                    >
                      선택
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* DB 목록 */}
      <div className="database-list">
        {databases && databases.length > 0 ? (
          <table className="db-table">
            <thead>
              <tr>
                <th>이름</th>
                <th>호스트</th>
                <th>포트</th>
                <th>DB명</th>
                <th>사용자</th>
                <th>비고</th>
                <th>Connection</th>
                <th>액션</th>
              </tr>
            </thead>
            <tbody>
              {databases.map(db => (
                <tr key={db.name}>
                  <td>{db.name}</td>
                  <td>{db.host}</td>
                  <td>{db.port || '기본값'}</td>
                  <td>{db.dbname || '모든 DB'}</td>
                  <td>{db.user}</td>
                  <td>{db.remark || ''}</td>
                  <td>
                    <span className={`conn-indicator ${connectionStatus[db.name]}`}></span>
                    {connectionStatus[db.name] === 'loading' && <span style={{marginLeft:4}}>⏳</span>}
                  </td>
                  <td>
                    <button 
                      onClick={() => testConnection(db)}
                      className="btn btn-sm btn-outline"
                      title="연결 테스트"
                    >
                      🔗 테스트
                    </button>
                    <button 
                      onClick={() => startEdit(db)}
                      className="btn btn-sm btn-outline"
                      title="수정"
                    >
                      ✏️ 수정
                    </button>
                    <button 
                      onClick={() => handleDelete(db.name)}
                      className="btn btn-sm btn-danger"
                      title="삭제"
                    >
                      🗑️ 삭제
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="empty-state">
            <p>등록된 데이터베이스 연결이 없습니다.</p>
            <p>새 DB 연결을 추가해보세요!</p>
          </div>
        )}
      </div>
    </div>
  );
}

export default DatabaseManager; 