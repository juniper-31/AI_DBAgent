// DatabaseManager.js
// DB 연결 관리, 폼, 리스트, 인라인 수정 등
import React, { useState, useEffect } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { useTranslation } from '../utils/translations';

function DatabaseManager({ databases, onDatabaseChange, onDatabaseDelete, onDatabaseAdd }) {
  const { language } = useLanguage();
  const { t } = useTranslation(language);
  
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
      name: dbName, // DB 이름도 자동으로 설정
      host: browseFormData.host,
      port: browseFormData.port,
      database: dbName,
      username: browseFormData.username,
      password: browseFormData.password,
      remark: '', // 비고는 비워둠
      cloudwatch_id: '', // CloudWatch ID는 비워둠
    }));
    setShowBrowseForm(false);
    setShowForm(true);
  };

  // 폼 유효성 검사
  const validateForm = () => {
    const newErrors = {};
    
    if (!formData.name.trim()) {
      newErrors.name = t('dbManagement.errors.nameRequired');
    }
    
    if (!formData.host.trim()) {
      newErrors.host = t('dbManagement.errors.hostRequired');
    }
    
    if (!formData.database.trim()) {
      newErrors.database = t('dbManagement.errors.databaseRequired');
    }
    
    if (!formData.username.trim()) {
      newErrors.username = t('dbManagement.errors.usernameRequired');
    }
    
    if (!formData.password.trim()) {
      newErrors.password = t('dbManagement.errors.passwordRequired');
    }

    // 포트 번호 검증
    if (formData.port && (isNaN(formData.port) || formData.port < 1 || formData.port > 65535)) {
      newErrors.port = t('dbManagement.errors.invalidPort');
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
      setBrowseError(t('dbManagement.errors.browseRequired'));
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
        setBrowseError(result.message || t('dbManagement.errors.browseFailed'));
      }
    } catch (error) {
      setBrowseError(t('dbManagement.errors.browseError'));
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
      formDataToSend.append('port', formData.port || ''); // 빈 문자열도 허용
      formDataToSend.append('user', formData.username);
      formDataToSend.append('password', formData.password);
      formDataToSend.append('dbname', formData.database);
      formDataToSend.append('remark', formData.remark || ''); // 비고 추가
      formDataToSend.append('cloudwatch_id', formData.cloudwatch_id || ''); // 추가
      
      console.log('Submitting database form:', {
        name: formData.name,
        host: formData.host,
        port: formData.port,
        user: formData.username,
        database: formData.database
      });
      
      const response = await fetch('/api/databases', {
        method: 'POST',
        body: formDataToSend
      });

      console.log('Response status:', response.status);
      
      if (response.ok) {
        const result = await response.json();
        console.log('Response result:', result);
        
        if (result.status === 'success') {
          onDatabaseChange(); // 부모 컴포넌트에 변경 알림
          resetForm();
          setShowForm(false);
          alert(t('dbManagement.success.added'));
        } else {
          setErrors({ general: result.message || t('dbManagement.errors.saveFailed') });
        }
      } else {
        const errorText = await response.text();
        console.error('HTTP Error:', response.status, errorText);
        setErrors({ general: `${t('dbManagement.errors.connectionError')} (${response.status}): ${errorText}` });
      }
    } catch (error) {
      console.error('Submit error:', error);
      setErrors({ general: `${t('dbManagement.errors.connectionError')}: ${error.message}` });
    }
  };

  // DB 삭제 처리
  const handleDelete = async (dbName) => {
    if (!window.confirm(t('dbManagement.success.deleteConfirm').replace('{name}', dbName))) {
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
          alert(t('dbManagement.errors.deleteFailed'));
        }
      } else {
        throw new Error('요청 실패');
      }
    } catch (error) {
      alert(t('dbManagement.errors.deleteError'));
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
        alert(t('dbManagement.success.testSuccess'));
      } else {
        setConnectionStatus(prev => ({ ...prev, [db.name]: 'fail' }));
        alert(`${t('dbManagement.errors.testFailed')}: ${result.message}`);
      }
    } catch (error) {
      setConnectionStatus(prev => ({ ...prev, [db.name]: 'fail' }));
      alert(t('dbManagement.errors.connectionError'));
    }
  };

  return (
    <div className="page-content">
      {/* 헤더 */}
      <div className="page-header">
        <div className="manager-header">
          <h2>{t('dbManagement.title')}</h2>
          <div className="button-group">
            <button 
              onClick={toggleForm} 
              className={`btn ${showForm ? 'btn-secondary' : 'btn-primary'}`}
            >
              {showForm ? t('dbManagement.cancel') : t('dbManagement.addNewDb')}
            </button>
            <button 
              onClick={toggleBrowseForm} 
              className={`btn ${showBrowseForm ? 'btn-secondary' : 'btn-info'}`}
            >
              {showBrowseForm ? t('dbManagement.cancel') : t('dbManagement.browseDb')}
            </button>
          </div>
        </div>
      </div>

      <div className="page-body">

      {/* DB 추가/편집 폼 */}
      {showForm && (
        <div className="form-container">
          <form onSubmit={handleSubmit} className="db-form">
            <h3>{editingDb ? t('dbManagement.editDbConnection') : t('dbManagement.addDbConnection')}</h3>
            
            {errors.general && (
              <div className="error-message">{errors.general}</div>
            )}

            <div className="form-row">
              <div className="form-group">
                <label htmlFor="name">{t('dbManagement.dbName')} *</label>
                <input
                  type="text"
                  id="name"
                  name="name"
                  value={formData.name}
                  onChange={handleInputChange}
                  placeholder={t('dbManagement.placeholders.dbName')}
                  className={errors.name ? 'error' : ''}
                />
                {errors.name && <span className="error-text">{errors.name}</span>}
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label htmlFor="host">{t('dbManagement.host')} *</label>
                <input
                  type="text"
                  id="host"
                  name="host"
                  value={formData.host}
                  onChange={handleInputChange}
                  placeholder={t('dbManagement.placeholders.host')}
                  className={errors.host ? 'error' : ''}
                />
                {errors.host && <span className="error-text">{errors.host}</span>}
              </div>
              
              <div className="form-group">
                <label htmlFor="port">{t('dbManagement.port')}</label>
                <input
                  type="number"
                  id="port"
                  name="port"
                  value={formData.port}
                  onChange={handleInputChange}
                  placeholder={t('dbManagement.placeholders.port')}
                  className={errors.port ? 'error' : ''}
                />
                {errors.port && <span className="error-text">{errors.port}</span>}
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label htmlFor="database">{t('dbManagement.database')} *</label>
                <input
                  type="text"
                  id="database"
                  name="database"
                  value={formData.database}
                  onChange={handleInputChange}
                  placeholder={t('dbManagement.placeholders.database')}
                  className={errors.database ? 'error' : ''}
                />
                {errors.database && <span className="error-text">{errors.database}</span>}
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label htmlFor="username">{t('dbManagement.username')} *</label>
                <input
                  type="text"
                  id="username"
                  name="username"
                  value={formData.username}
                  onChange={handleInputChange}
                  placeholder={t('dbManagement.placeholders.username')}
                  className={errors.username ? 'error' : ''}
                />
                {errors.username && <span className="error-text">{errors.username}</span>}
              </div>
              
              <div className="form-group">
                <label htmlFor="password">{t('dbManagement.password')} *</label>
                <input
                  type="password"
                  id="password"
                  name="password"
                  value={formData.password}
                  onChange={handleInputChange}
                  placeholder={t('dbManagement.placeholders.password')}
                  className={errors.password ? 'error' : ''}
                />
                {errors.password && <span className="error-text">{errors.password}</span>}
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label htmlFor="remark">{t('dbManagement.remark')}</label>
                <input
                  type="text"
                  id="remark"
                  name="remark"
                  value={formData.remark}
                  onChange={handleInputChange}
                  placeholder={t('dbManagement.placeholders.remark')}
                />
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="cloudwatch_id">{t('dbManagement.cloudwatchId')}</label>
              <input
                type="text"
                id="cloudwatch_id"
                name="cloudwatch_id"
                value={formData.cloudwatch_id}
                onChange={handleInputChange}
                placeholder={t('dbManagement.placeholders.cloudwatchId')}
                autoComplete="off"
              />
              {errors.cloudwatch_id && <div className="form-error">{errors.cloudwatch_id}</div>}
            </div>

            <div className="form-actions">
              <button type="submit" className="btn btn-primary">
                {editingDb ? t('dbManagement.edit') : t('dbManagement.add')}
              </button>
              <button type="button" onClick={toggleForm} className="btn btn-secondary">
                {t('dbManagement.cancel')}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* DB 목록 조회 폼 */}
      {showBrowseForm && (
        <div className="form-container">
          <form onSubmit={handleBrowseDatabases} className="db-form">
            <h3>{t('dbManagement.browseTitle')}</h3>
            {browseError && (
              <div className="error-message">{browseError}</div>
            )}
            <div className="form-row">
              <div className="form-group">
                <label htmlFor="browse-host">{t('dbManagement.host')} *</label>
                <input
                  type="text"
                  id="browse-host"
                  name="host"
                  value={browseFormData.host}
                  onChange={handleBrowseInputChange}
                  placeholder={t('dbManagement.placeholders.browseHost')}
                  required
                />
              </div>
              <div className="form-group">
                <label htmlFor="browse-port">{t('dbManagement.port')}</label>
                <input
                  type="number"
                  id="browse-port"
                  name="port"
                  value={browseFormData.port}
                  onChange={handleBrowseInputChange}
                  placeholder={t('dbManagement.placeholders.browsePort')}
                />
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label htmlFor="browse-username">{t('dbManagement.username')} *</label>
                <input
                  type="text"
                  id="browse-username"
                  name="username"
                  value={browseFormData.username}
                  onChange={handleBrowseInputChange}
                  placeholder={t('dbManagement.placeholders.browseUsername')}
                  required
                />
              </div>
              <div className="form-group">
                <label htmlFor="browse-password">{t('dbManagement.password')} *</label>
                <input
                  type="password"
                  id="browse-password"
                  name="password"
                  value={browseFormData.password}
                  onChange={handleBrowseInputChange}
                  placeholder={t('dbManagement.placeholders.password')}
                  required
                />
              </div>
            </div>
            <div className="form-actions">
              <button type="submit" className="btn btn-info">
                {t('dbManagement.browseDb')}
              </button>
              <button type="button" onClick={toggleBrowseForm} className="btn btn-secondary">
                {t('dbManagement.cancel')}
              </button>
            </div>
          </form>

          {browsedDatabases.length > 0 && (
            <div className="browsed-databases-list">
              <h4>{t('dbManagement.browsedDatabases')} ({browsedDatabases.length}개)</h4>
              <ul>
                {browsedDatabases.map((dbName, index) => (
                  <li key={index}>
                    {dbName}
                    <button 
                      onClick={() => handleSelectBrowsedDb(dbName)}
                      className="btn btn-sm btn-outline"
                    >
                      {t('dbManagement.select')}
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
                <th>{t('dbManagement.dbName')}</th>
                <th>{t('dbManagement.host')}</th>
                <th>{t('dbManagement.port')}</th>
                <th>{t('dbManagement.database')}</th>
                <th>{t('dbManagement.username')}</th>
                <th>{t('dbManagement.remark')}</th>
                <th>{t('dbManagement.connection')}</th>
                <th>{t('dbManagement.actions')}</th>
              </tr>
            </thead>
            <tbody>
              {databases.map(db => (
                <tr key={db.name}>
                  <td>{db.name}</td>
                  <td>{db.host}</td>
                  <td>{db.port || t('common.defaultValue')}</td>
                  <td>{db.dbname || 'All DBs'}</td>
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
                      title={t('dbManagement.test')}
                    >
                      🔗 {t('dbManagement.test')}
                    </button>
                    <button 
                      onClick={() => startEdit(db)}
                      className="btn btn-sm btn-outline"
                      title={t('dbManagement.edit')}
                    >
                      ✏️ {t('dbManagement.edit')}
                    </button>
                    <button 
                      onClick={() => handleDelete(db.name)}
                      className="btn btn-sm btn-danger"
                      title={t('dbManagement.delete')}
                    >
                      🗑️ {t('dbManagement.delete')}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="empty-state">
            <p>{t('dbManagement.noConnections')}</p>
            <p>{t('dbManagement.addNewConnection')}</p>
          </div>
        )}
      </div>
      </div>
    </div>
  );
}

export default DatabaseManager; 