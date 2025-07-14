// AwsIntegrationComponent.js
// AWS 인증, RDS/CloudWatch 연동, 상태 표시
import React, { useState, useEffect, useCallback } from 'react';

function AwsIntegrationComponent({ selectedDb, databases }) {
  const [credentialsList, setCredentialsList] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [authType, setAuthType] = useState('accessKey');
  const [accessKey, setAccessKey] = useState('');
  const [secretKey, setSecretKey] = useState('');
  const [sessionToken, setSessionToken] = useState('');
  const [ssoStartUrl, setSsoStartUrl] = useState('');
  const [ssoRegion, setSsoRegion] = useState('ap-northeast-2');
  const [ssoAccountId, setSsoAccountId] = useState('');
  const [ssoRoleName, setSsoRoleName] = useState('');
  const [awsRegion, setAwsRegion] = useState('ap-northeast-2');
  const [cloudwatchNamespace, setCloudwatchNamespace] = useState('AWS/RDS');
  const [isConnected, setIsConnected] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState('disconnected');
  const [rdsInstances, setRdsInstances] = useState([]);
  const [cloudwatchMetrics, setCloudwatchMetrics] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showConfigForm, setShowConfigForm] = useState(false); // 설정 폼 토글
  // 인증 정보 추가 폼 토글
  const [showAddForm, setShowAddForm] = useState(false);
  // 신규 추가용 상태
  const [newAccessKey, setNewAccessKey] = useState('');
  const [newSecretKey, setNewSecretKey] = useState('');
  const [newAwsRegion, setNewAwsRegion] = useState('ap-northeast-2');

  const awsRegions = [
    { value: 'us-east-1', label: 'US East (N. Virginia)' },
    { value: 'us-east-2', label: 'US East (Ohio)' },
    { value: 'us-west-1', label: 'US West (N. California)' },
    { value: 'us-west-2', label: 'US West (Oregon)' },
    { value: 'ap-northeast-1', label: 'Asia Pacific (Tokyo)' },
    { value: 'ap-northeast-2', label: 'Asia Pacific (Seoul)' },
    { value: 'ap-southeast-1', label: 'Asia Pacific (Singapore)' },
    { value: 'ap-southeast-2', label: 'Asia Pacific (Sydney)' },
    { value: 'eu-west-1', label: 'Europe (Ireland)' },
    { value: 'eu-central-1', label: 'Europe (Frankfurt)' }
  ];

  // 인증 방식 옵션
  const authTypes = [
    { value: 'accessKey', label: 'Access Key' },
    { value: 'iamRole', label: 'IAM Role (EC2/ECS/EKS)' },
    { value: 'sso', label: 'AWS SSO' }
  ];

  // 리스트 불러오기
  const loadCredentials = async () => {
    const res = await fetch('/aws/credentials');
    if (res.ok) {
      const list = await res.json();
      setCredentialsList(list);
      const active = list.find(c => c.is_active);
      if (active) {
        setSelectedId(active.id);
        setAccessKey(active.access_key);
        setSecretKey('********');
        setSessionToken('');
        setAwsRegion(active.region || 'ap-northeast-2');
        setConnectionStatus('connected');
        setIsConnected(true);
      } else {
        setSelectedId(null);
        setConnectionStatus('disconnected');
        setIsConnected(false);
      }
    }
  };

  useEffect(() => {
    loadCredentials();
  }, []);

  // RDS 인스턴스 목록 가져오기
  const fetchRdsInstances = useCallback(async () => {
    if (!isConnected) return;

    setLoading(true);
    try {
      const response = await fetch('/aws/rds-instances');
      if (response.ok) {
        const data = await response.json();
        setRdsInstances(data.instances || []);
      } else {
        console.error('RDS 인스턴스 목록 가져오기 실패');
      }
    } catch (error) {
      console.error('RDS 인스턴스 요청 오류:', error);
    } finally {
      setLoading(false);
    }
  }, [isConnected]);

  // 연결 성공 시 RDS 인스턴스 자동 조회
  useEffect(() => {
    if (isConnected) {
      fetchRdsInstances();
    }
  }, [isConnected, fetchRdsInstances]);

  // 등록
  const handleSave = async () => {
    setError(''); setSuccess(''); setLoading(true);
    const payload = {
      name: accessKey.slice(0, 8) + '...',
      access_key: accessKey,
      secret_key: secretKey,
      session_token: sessionToken,
      region: awsRegion,
      is_active: true
    };
    const res = await fetch('/aws/credentials', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (res.ok) {
      setSuccess('설정이 저장되었습니다!');
      await loadCredentials();
    } else {
      setError('저장 실패');
    }
    setLoading(false);
  };

  // 연결 테스트
  const handleTest = async () => {
    setLoading(true); setError(''); setSuccess('');
    const cred = credentialsList.find(c => c.id === selectedId);
    if (!cred) { setError('선택된 인증정보가 없습니다.'); setLoading(false); return; }
    const payload = {
      accessKey: cred.access_key,
      secretKey: secretKey === '********' ? '' : secretKey,
      sessionToken: sessionToken,
      awsRegion: cred.region
    };
    const res = await fetch('/aws/auth/test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (data.success) {
      setSuccess('연결 성공!');
      setConnectionStatus('connected');
      setIsConnected(true);
    } else {
      setError('연결 실패: ' + (data.message || '오류'));
      setConnectionStatus('disconnected');
      setIsConnected(false);
    }
    setLoading(false);
  };

  // CloudWatch 메트릭 가져오기
  const fetchCloudWatchMetrics = async () => {
    if (!isConnected || !awsRegion) return;

    setLoading(true);
    try {
      const params = new URLSearchParams({
        region: awsRegion,
        namespace: cloudwatchNamespace
      });

      const response = await fetch(`/aws/cloudwatch/metrics?${params}`);
      if (response.ok) {
        const data = await response.json();
        setCloudwatchMetrics(data.metrics || {});
      } else {
        console.error('CloudWatch 메트릭 가져오기 실패');
      }
    } catch (error) {
      console.error('CloudWatch 메트릭 요청 오류:', error);
    } finally {
      setLoading(false);
    }
  };

  // 입력 필드 변경 처리
  const handleInputChange = (key, value) => {
    if (key === 'accessKey') setAccessKey(value);
    else if (key === 'secretKey') setSecretKey(value);
    else if (key === 'sessionToken') setSessionToken(value);
    else if (key === 'ssoStartUrl') setSsoStartUrl(value);
    else if (key === 'ssoRegion') setSsoRegion(value);
    else if (key === 'ssoAccountId') setSsoAccountId(value);
    else if (key === 'ssoRoleName') setSsoRoleName(value);
    else if (key === 'awsRegion') setAwsRegion(value);
    else if (key === 'cloudwatchNamespace') setCloudwatchNamespace(value);
  };

  // RDS 인스턴스 선택
  const handleRdsInstanceSelect = (instanceId) => {
    handleInputChange('rds_instance_id', instanceId);
  };

  // 인증 정보 추가
  const handleAddCredential = async () => {
    setError(''); setSuccess(''); setLoading(true);
    const payload = {
      name: newAccessKey.slice(0, 8) + '...',
      access_key: newAccessKey,
      secret_key: newSecretKey,
      region: newAwsRegion,
      is_active: false
    };
    const res = await fetch('/aws/credentials', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (res.ok) {
      setSuccess('인증 정보가 추가되었습니다!');
      setNewAccessKey(''); setNewSecretKey(''); setNewAwsRegion('ap-northeast-2');
      setShowAddForm(false);
      await loadCredentials();
    } else {
      setError('추가 실패');
    }
    setLoading(false);
  };

  // 인증 정보 삭제
  const handleDeleteCredential = async (id) => {
    setError(''); setSuccess(''); setLoading(true);
    const res = await fetch(`/aws/credentials/${id}`, { method: 'DELETE' });
    if (res.ok) {
      setSuccess('삭제되었습니다.');
      await loadCredentials();
    } else {
      setError('삭제 실패');
    }
    setLoading(false);
  };

  // 기본 인증 정보로 설정
  const handleSetActive = async (id) => {
    setError(''); setSuccess(''); setLoading(true);
    const res = await fetch(`/aws/credentials/${id}/activate`, { method: 'POST' });
    if (res.ok) {
      setSuccess('기본 인증 정보로 설정되었습니다.');
      await loadCredentials();
    } else {
      setError('설정 실패');
    }
    setLoading(false);
  };

  // 인증 정보 수정(간단히 Access Key/Secret Key/Region만)
  // ... (추후 필요시 구현) ...

  // 연결 상태에 따른 색상
  const getStatusColor = (status) => {
    switch (status) {
      case 'connected':
        return '#28a745';
      case 'connecting':
        return '#ffc107';
      case 'error':
        return '#dc3545';
      default:
        return '#6c757d';
    }
  };

  // 메트릭 카드 렌더링
  const renderMetricCard = (title, value, unit = '', status = null) => (
    <div className="metric-card">
      <div className="metric-header">
        <h4>{title}</h4>
        {status && (
          <span 
            className="status-badge"
            style={{ backgroundColor: getStatusColor(status) }}
          >
            {status}
          </span>
        )}
      </div>
      <div className="metric-value">
        <span className="value">{value}</span>
        {unit && <span className="unit">{unit}</span>}
      </div>
    </div>
  );

  return (
    <div className="aws-integration-flex-row">
      <div className="aws-credentials-list">
        {/* 인증 정보 리스트 (Access Key만 여러 개) */}
        <div className="credentials-header-row">
          <h3>Access Key 인증 정보</h3>
          <button className="btn btn-outline add-cred-btn" onClick={() => setShowAddForm(v => !v)}>
            {showAddForm ? '− 추가 닫기' : '+ 인증 추가'}
          </button>
        </div>
        {credentialsList.length === 0 && (
          <div className="no-credentials">등록된 인증 정보가 없습니다.</div>
        )}
        {credentialsList.map(cred => cred.type !== 'iamRole' && cred.type !== 'sso' && (
          <div key={cred.id} className={`credential-card${cred.is_active ? ' active' : ''}`}>
            <div className="cred-row">
              <span className="cred-label">Access Key</span>
              <span className="cred-value">{cred.access_key.substring(0, 4)}...{cred.access_key.slice(-4)}</span>
            </div>
            <div className="cred-row">
              <span className="cred-label">Region</span>
              <span className="cred-value">{cred.region}</span>
            </div>
            <div className="cred-actions">
              {!cred.is_active && (
                <button className="btn btn-outline btn-sm" onClick={() => handleSetActive(cred.id)}>기본 사용</button>
              )}
              {cred.is_active && <span className="active-badge">기본</span>}
              <button className="btn btn-outline btn-sm" onClick={() => handleDeleteCredential(cred.id)}>삭제</button>
            </div>
          </div>
        ))}
        {/* 추가 폼 */}
        {showAddForm && (
          <div className="credential-add-form">
            {credentialsList.length === 0 ? (
              <>
                <div className="form-group">
                  <label>인증 방식</label>
                  <select value={authType} onChange={e => setAuthType(e.target.value)} className="form-control wide-input">
                    <option value="accessKey">Access Key</option>
                    <option value="iamRole">IAM Role (EC2/ECS/EKS)</option>
                    <option value="sso">AWS SSO</option>
                  </select>
                </div>
                {authType === 'accessKey' && (
                  <>
                    <div className="form-group">
                      <label>Access Key *</label>
                      <input type="text" value={newAccessKey} onChange={e => setNewAccessKey(e.target.value)} className="form-control wide-input" />
                    </div>
                    <div className="form-group">
                      <label>Secret Key *</label>
                      <input type="password" value={newSecretKey} onChange={e => setNewSecretKey(e.target.value)} className="form-control wide-input" />
                    </div>
                    <div className="form-group">
                      <label>Token (옵션)</label>
                      <input type="text" value={sessionToken} onChange={e => setSessionToken(e.target.value)} className="form-control wide-input" />
                    </div>
                    <div className="form-group">
                      <label>리전</label>
                      <select value={newAwsRegion} onChange={e => setNewAwsRegion(e.target.value)} className="form-control wide-input">
                        {awsRegions.map(region => (
                          <option key={region.value} value={region.value}>{region.label}</option>
                        ))}
                      </select>
                    </div>
                  </>
                )}
                {authType === 'iamRole' && (
                  <div className="form-group">
                    <label>IAM Role 기반 인증</label>
                    <div style={{ color: '#888', fontSize: '14px' }}>
                      EC2/ECS/EKS 인스턴스에 할당된 IAM Role을 자동으로 사용합니다.<br />
                      별도의 키 입력 없이 진행하세요.
                    </div>
                  </div>
                )}
                {authType === 'sso' && (
                  <>
                    <div className="form-group">
                      <label>SSO Token *</label>
                      <input type="text" value={sessionToken} onChange={e => setSessionToken(e.target.value)} className="form-control wide-input" />
                    </div>
                    <div className="form-group">
                      <label>리전</label>
                      <select value={newAwsRegion} onChange={e => setNewAwsRegion(e.target.value)} className="form-control wide-input">
                        {awsRegions.map(region => (
                          <option key={region.value} value={region.value}>{region.label}</option>
                        ))}
                      </select>
                    </div>
                  </>
                )}
              </>
            ) : (
              <>
                <div className="form-group">
                  <label>Access Key *</label>
                  <input type="text" value={newAccessKey} onChange={e => setNewAccessKey(e.target.value)} className="form-control wide-input" />
                </div>
                <div className="form-group">
                  <label>Secret Key *</label>
                  <input type="password" value={newSecretKey} onChange={e => setNewSecretKey(e.target.value)} className="form-control wide-input" />
                </div>
                <div className="form-group">
                  <label>Token (옵션)</label>
                  <input type="text" value={sessionToken} onChange={e => setSessionToken(e.target.value)} className="form-control wide-input" />
                </div>
                <div className="form-group">
                  <label>리전</label>
                  <select value={newAwsRegion} onChange={e => setNewAwsRegion(e.target.value)} className="form-control wide-input">
                    {awsRegions.map(region => (
                      <option key={region.value} value={region.value}>{region.label}</option>
                    ))}
                  </select>
                </div>
              </>
            )}
            <div className="form-actions">
              <button className="btn btn-primary" onClick={handleAddCredential} disabled={loading || !newAccessKey || !newSecretKey}>추가</button>
              <button className="btn btn-outline" onClick={() => setShowAddForm(false)}>취소</button>
            </div>
          </div>
        )}
      </div>
      <div className="aws-summary-col">
        <div className="aws-summary-card">
          <div className="summary-row">
            <div className="summary-label">연결 상태</div>
            <div className="summary-value">
              <span className="status-indicator" style={{ backgroundColor: getStatusColor(connectionStatus) }}></span>
              <span className="status-text">
                {connectionStatus === 'connected' && '연결됨'}
                {connectionStatus === 'connecting' && '연결 중...'}
                {connectionStatus === 'error' && '연결 오류'}
                {connectionStatus === 'disconnected' && '연결 안됨'}
              </span>
            </div>
          </div>
          <div className="summary-row">
            <div className="summary-label">Access Key</div>
            <div className="summary-value">{accessKey ? accessKey.substring(0, 4) + '...' + accessKey.slice(-4) : '-'}</div>
          </div>
          <div className="summary-row">
            <div className="summary-label">AWS 리전</div>
            <div className="summary-value">{awsRegion || '-'}</div>
          </div>
          <button className="btn btn-outline summary-toggle-btn" onClick={() => setShowConfigForm(v => !v)}>
            {showConfigForm ? '− 설정 닫기' : '+ 설정 변경'}
          </button>
        </div>

        {/* 설정 폼 (토글) */}
        {showConfigForm && (
          <div className="aws-config-section">
            <h3>AWS 인증 설정</h3>
            {error && (<div className="error-message">{error}</div>)}
            {success && (<div className="success-message">✅ {success}</div>)}
            <div className="form-group">
              <label htmlFor="auth-type">인증 방식</label>
              <select
                id="auth-type"
                value={authType}
                onChange={(e) => setAuthType(e.target.value)}
                className="form-control wide-input"
              >
                {authTypes.map(type => (
                  <option key={type.value} value={type.value}>{type.label}</option>
                ))}
              </select>
            </div>
            {authType === 'accessKey' && (
              <>
                <div className="form-group">
                  <label htmlFor="access-key">Access Key *</label>
                  <input
                    type="text"
                    id="access-key"
                    value={accessKey}
                    onChange={e => setAccessKey(e.target.value)}
                    placeholder="AKIA..."
                    className="form-control wide-input"
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="secret-key">Secret Key *</label>
                  <input
                    type="password"
                    id="secret-key"
                    value={secretKey}
                    onChange={e => setSecretKey(e.target.value)}
                    placeholder="••••••••••••••••••••••••••••••••"
                    className="form-control wide-input"
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="session-token">Session Token (옵션)</label>
                  <input
                    type="text"
                    id="session-token"
                    value={sessionToken}
                    onChange={e => setSessionToken(e.target.value)}
                    placeholder="세션 토큰 (필요시)"
                    className="form-control wide-input"
                  />
                </div>
              </>
            )}
            {authType === 'iamRole' && (
              <div className="form-group">
                <label>IAM Role 기반 인증</label>
                <div style={{ color: '#888', fontSize: '14px' }}>
                  EC2/ECS/EKS 인스턴스에 할당된 IAM Role을 자동으로 사용합니다.<br />
                  별도의 키 입력 없이 진행하세요.
                </div>
              </div>
            )}
            {authType === 'sso' && (
              <div className="config-form">
                <div className="form-row">
                  <div className="form-group">
                    <label htmlFor="sso-start-url">SSO Start URL *</label>
                    <input
                      type="text"
                      id="sso-start-url"
                      value={ssoStartUrl}
                      onChange={(e) => handleInputChange('sso-start-url', e.target.value)}
                      placeholder="https://your-sso-portal.awsapps.com/start"
                      className="form-control wide-input"
                    />
                  </div>
                  <div className="form-group">
                    <label htmlFor="sso-region">SSO Region *</label>
                    <input
                      type="text"
                      id="sso-region"
                      value={ssoRegion}
                      onChange={(e) => handleInputChange('sso-region', e.target.value)}
                      placeholder="ap-northeast-2"
                      className="form-control wide-input"
                    />
                  </div>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label htmlFor="sso-account-id">SSO Account ID *</label>
                    <input
                      type="text"
                      id="sso-account-id"
                      value={ssoAccountId}
                      onChange={(e) => handleInputChange('sso-account-id', e.target.value)}
                      placeholder="123456789012"
                      className="form-control wide-input"
                    />
                  </div>
                  <div className="form-group">
                    <label htmlFor="sso-role-name">SSO Role Name *</label>
                    <input
                      type="text"
                      id="sso-role-name"
                      value={ssoRoleName}
                      onChange={(e) => handleInputChange('sso-role-name', e.target.value)}
                      placeholder="AWSAdministratorAccess"
                      className="form-control wide-input"
                    />
                  </div>
                </div>
              </div>
            )}
            <div className="form-row">
              <div className="form-group">
                <label htmlFor="aws-region">AWS 리전</label>
                <select
                  id="aws-region"
                  value={awsRegion}
                  onChange={(e) => setAwsRegion(e.target.value)}
                  className="form-control wide-input"
                >
                  {awsRegions.map(region => (
                    <option key={region.value} value={region.value}>
                      {region.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="form-actions">
              <button 
                onClick={handleTest}
                disabled={loading || !selectedId}
                className="btn btn-outline"
              >
                {loading ? '테스트 중...' : '🔗 연결 테스트'}
              </button>
              <button 
                onClick={handleSave}
                disabled={loading}
                className="btn btn-primary"
              >
                {loading ? '저장 중...' : '💾 설정 저장'}
              </button>
            </div>
          </div>
        )}
        {/* 보안 주의사항 */}
        <div className="security-notice">
          <span role="img" aria-label="lock">🔒</span> <b>보안 주의사항</b>
          <ul>
            <li>AWS 자격 증명은 안전하게 암호화되어 저장됩니다.</li>
            <li>최소·취소 위쳔에 따라 필요한 권한만 부여하세요.</li>
          </ul>
        </div>
      </div>
    </div>
  );
}

// 메트릭 단위 반환
const getMetricUnit = (metricName) => {
  const units = {
    cpu_utilization: '%',
    freeable_memory: 'MB',
    database_connections: '개',
    read_iops: 'IOPS',
    write_iops: 'IOPS',
    network_receive_throughput: 'MB/s',
    network_transmit_throughput: 'MB/s'
  };
  return units[metricName] || '';
};

// 메트릭 상태 색상 반환
const getMetricStatusColor = (metricName, value) => {
  if (metricName === 'cpu_utilization' && value > 80) return '#ffc107';
  if (metricName === 'freeable_memory' && value < 1000) return '#ffc107';
  if (metricName === 'database_connections' && value > 100) return '#ffc107';
  return '#28a745';
};

// 메트릭 상태 반환
const getMetricStatus = (metricName, value) => {
  if (metricName === 'cpu_utilization' && value > 80) return 'warning';
  if (metricName === 'freeable_memory' && value < 1000) return 'warning';
  if (metricName === 'database_connections' && value > 100) return 'warning';
  return 'ok';
};

export default AwsIntegrationComponent; 