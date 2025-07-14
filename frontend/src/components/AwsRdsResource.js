import React, { useEffect, useState } from 'react';

const getDefaultPort = (engine) => {
  if (!engine) return 5432;
  if (engine.includes('mysql')) return 3306;
  if (engine.includes('docdb')) return 27017;
  return 5432; // aurora-postgresql 등
};

const AwsRdsResource = ({ onDatabaseAdd }) => {
  const [clusters, setClusters] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [expandedClusters, setExpandedClusters] = useState({});
  const [showModal, setShowModal] = useState(false);
  const [modalCluster, setModalCluster] = useState(null);
  const [modalForm, setModalForm] = useState({ port: '', dbname: '', user: '', password: '', remark: '' });

  useEffect(() => {
    fetchRdsClusters();
  }, []);

  const fetchRdsClusters = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await fetch('/aws/rds-instances', { credentials: 'include' });
      if (response.ok) {
        const data = await response.json();
        setClusters((data.clusters || []).map(c => ({ ...c, instances: c.instances || [] })));
      } else {
        setError('RDS 클러스터 목록을 불러오지 못했습니다.');
      }
    } catch (e) {
      setError('RDS 클러스터 조회 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const toggleCluster = (clusterId) => {
    setExpandedClusters(prev => ({ ...prev, [clusterId]: !prev[clusterId] }));
  };

  // 모달 열기 (클러스터/인스턴스 모두 지원)
  const openRegisterModal = (target, isInstance = false, parentCluster = null) => {
    if (isInstance) {
      setModalCluster({ ...target, isInstance: true, parentCluster });
      setModalForm({
        port: getDefaultPort(target.Engine),
        dbname: 'postgres',
        user: '',
        password: '',
        remark: '',
        cloudwatch_id: target.DBInstanceIdentifier || '', // 인스턴스ID 자동 세팅
      });
    } else {
      setModalCluster({ ...target, isInstance: false });
      setModalForm({
        port: getDefaultPort(target.Engine),
        dbname: 'postgres',
        user: '',
        password: '',
        remark: '',
        cloudwatch_id: target.DBClusterIdentifier || '', // 클러스터ID 자동 세팅
      });
    }
    setShowModal(true);
  };

  // 모달 닫기
  const closeRegisterModal = () => {
    setShowModal(false);
    setModalCluster(null);
    setModalForm({ port: '', dbname: '', user: '', password: '', remark: '' });
  };

  // 모달 입력 변경
  const handleModalInput = (e) => {
    const { name, value } = e.target;
    setModalForm(prev => ({ ...prev, [name]: value }));
  };

  // 등록 핸들러 (클러스터/인스턴스 모두 지원)
  const handleRegisterCluster = async () => {
    if (!modalCluster) return;
    setSuccess('');
    setError('');
    let endpoint = '-';
    let engine = '';
    let name = '';
    let cloudwatch_id = modalForm.cloudwatch_id;
    if (modalCluster.isInstance) {
      endpoint = modalCluster.Endpoint?.Address || '-';
      engine = modalCluster.Engine || '';
      name = modalCluster.DBInstanceIdentifier;
      // cloudwatch_id는 이미 세팅됨
    } else {
      endpoint = modalCluster.ReaderEndpoint || modalCluster.Endpoint || '-';
      engine = modalCluster.Engine || '';
      name = modalCluster.DBClusterIdentifier;
      // cloudwatch_id는 이미 세팅됨
    }
    const port = modalForm.port || getDefaultPort(engine);
    const dbname = modalForm.dbname || 'postgres';
    const user = modalForm.user || '';
    const password = modalForm.password || '';
    const remark = modalForm.remark || '';
    try {
      const formData = new FormData();
      formData.append('name', name);
      formData.append('host', endpoint);
      formData.append('port', port);
      formData.append('user', user);
      formData.append('password', password);
      formData.append('dbname', dbname);
      formData.append('engine', engine);
      formData.append('remark', remark);
      formData.append('cloudwatch_id', cloudwatch_id);
      const response = await fetch('/api/databases', {
        method: 'POST',
        body: formData,
        credentials: 'include'
      });
      if (response.ok) {
        setSuccess('DB로 등록되었습니다!');
        closeRegisterModal();
        if (onDatabaseAdd) onDatabaseAdd();
      } else {
        setError('DB 등록에 실패했습니다.');
      }
    } catch (e) {
      setError('DB 등록 중 오류가 발생했습니다.');
    }
  };

  return (
    <div className="aws-rds-resource">
      <h2>RDS 클러스터 조회</h2>
      <div style={{fontSize:'14px',color:'#888',marginBottom:'8px'}}>※ Aurora 등 클러스터만 표시됩니다. 클러스터는 <b>읽기전용(RO) 엔드포인트</b>로만 등록됩니다.</div>
      {loading && <div>불러오는 중...</div>}
      {error && <div className="alert alert-error">{error}</div>}
      {success && <div className="alert alert-success">{success}</div>}
      <table className="db-table">
        <thead>
          <tr>
            <th>클러스터 이름</th>
            <th>엔진</th>
            <th>RW 호스트</th>
            <th>RO 호스트</th>
            <th>액션</th>
          </tr>
        </thead>
        <tbody>
          {clusters.map(cluster => (
            <React.Fragment key={cluster.DBClusterIdentifier}>
              <tr className="cluster-row" onClick={() => toggleCluster(cluster.DBClusterIdentifier)} style={{ cursor: 'pointer', background: '#f7f8fa' }}>
                <td>
                  <span style={{ marginRight: 8 }}>{expandedClusters[cluster.DBClusterIdentifier] ? '▼' : '▶'}</span>
                  <strong>{cluster.DBClusterIdentifier}</strong>
                </td>
                <td>{cluster.Engine}</td>
                <td>
                  <div style={{fontSize:'13px'}}>
                    <b>{cluster.DBClusterIdentifier}</b><br/>
                    {cluster.Endpoint || '-'}
                  </div>
                </td>
                <td>
                  <div style={{fontSize:'13px'}}>
                    <b>{cluster.DBClusterIdentifier}</b><br/>
                    {cluster.ReaderEndpoint || '-'}
                  </div>
                </td>
                <td>
                  <button onClick={e => { e.stopPropagation(); openRegisterModal(cluster, false); }} className="btn btn-primary btn-sm">DB로 등록</button>
                </td>
              </tr>
              {expandedClusters[cluster.DBClusterIdentifier] && (cluster.instances || []).map(inst => (
                <tr key={inst.DBInstanceIdentifier} className="instance-row">
                  <td style={{ paddingLeft: 32 }}>{inst.DBInstanceIdentifier}</td>
                  <td>{inst.Engine}</td>
                  <td>
                    <div style={{fontSize:'13px'}}>
                      <b>{inst.DBInstanceIdentifier}</b><br/>
                      {inst.Endpoint?.Address || '-'}
                    </div>
                  </td>
                  <td>-</td>
                  <td>
                    <button onClick={e => { e.stopPropagation(); openRegisterModal(inst, true, cluster); }} className="btn btn-outline btn-sm">DB로 등록</button>
                  </td>
                </tr>
              ))}
            </React.Fragment>
          ))}
        </tbody>
      </table>
      {/* 등록 모달 */}
      {showModal && (
        <div className="modal-backdrop">
          <div className="modal-content">
            <h3>{modalCluster?.isInstance ? '인스턴스 DB 등록' : '클러스터 DB 등록'}</h3>
            <div className="form-group">
              <label>포트</label>
              <input name="port" type="number" value={modalForm.port} onChange={handleModalInput} placeholder="포트" />
            </div>
            <div className="form-group">
              <label>DB명</label>
              <input name="dbname" type="text" value={modalForm.dbname} onChange={handleModalInput} placeholder="DB명 (예: postgres)" />
            </div>
            <div className="form-group">
              <label>사용자명</label>
              <input name="user" type="text" value={modalForm.user} onChange={handleModalInput} placeholder="사용자명 (선택)" />
            </div>
            <div className="form-group">
              <label>비밀번호</label>
              <input name="password" type="password" value={modalForm.password} onChange={handleModalInput} placeholder="비밀번호 (선택)" />
            </div>
            <div className="form-group">
              <label>비고(선택)</label>
              <input name="remark" type="text" value={modalForm.remark} onChange={handleModalInput} placeholder="예: AWS 계정/용도/설명 등" />
            </div>
            <div className="form-group">
              <label>AWS RDS 인스턴스ID (CloudWatch용)</label>
              <input
                name="cloudwatch_id"
                type="text"
                value={modalForm.cloudwatch_id}
                onChange={handleModalInput}
                placeholder="예: rds-xxxx, aurora-xxx 등 AWS 인스턴스ID"
                autoComplete="off"
              />
            </div>
            <div className="form-actions">
              <button className="btn btn-primary" onClick={handleRegisterCluster}>등록</button>
              <button className="btn btn-outline" onClick={closeRegisterModal}>취소</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AwsRdsResource; 