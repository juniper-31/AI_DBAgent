import React, { useState, useEffect } from 'react';

const MCPStatus = () => {
  const [mcpData, setMcpData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);

  const fetchMCPStatus = async () => {
    try {
      const response = await fetch('/api/mcp/context');
      const data = await response.json();
      if (data.status === 'success') {
        setMcpData(data);
      }
    } catch (error) {
      console.error('MCP 상태 조회 실패:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSync = async () => {
    setSyncing(true);
    try {
      const response = await fetch('/api/mcp/sync', { method: 'POST' });
      const data = await response.json();
      if (data.status === 'success') {
        alert('동기화가 완료되었습니다!');
        fetchMCPStatus(); // 상태 새로고침
      } else {
        alert(`동기화 실패: ${data.message || '알 수 없는 오류'}`);
      }
    } catch (error) {
      alert(`동기화 실패: ${error.message}`);
    } finally {
      setSyncing(false);
    }
  };

  useEffect(() => {
    fetchMCPStatus();
  }, []);

  if (loading) {
    return <div className="mcp-status loading">MCP 상태 로딩 중...</div>;
  }

  if (!mcpData) {
    return <div className="mcp-status error">MCP 상태를 불러올 수 없습니다.</div>;
  }

  const { context, recommendations } = mcpData;
  const dbSummary = context.databases.summary;
  const aiModel = context.ai_model;
  const mcpTools = context.mcp_tools;

  return (
    <div className="mcp-status">
      <div className="mcp-header">
        <h3>🔗 MCP 통합 상태</h3>
        <button 
          onClick={handleSync} 
          disabled={syncing}
          className="sync-button"
        >
          {syncing ? '동기화 중...' : '🔄 동기화'}
        </button>
      </div>

      <div className="mcp-summary">
        <div className="summary-item">
          <span className="label">등록된 데이터베이스:</span>
          <span className="value">{dbSummary.total_registered}개</span>
        </div>
        <div className="summary-item">
          <span className="label">MCP 연동:</span>
          <span className="value">{dbSummary.mcp_enabled}개</span>
        </div>
        <div className="summary-item">
          <span className="label">동기화 상태:</span>
          <span className={`value ${dbSummary.sync_status}`}>
            {dbSummary.sync_status === 'synced' ? '✅ 동기화됨' : '⚠️ 비동기화'}
          </span>
        </div>
      </div>

      <div className="mcp-details">
        <div className="detail-section">
          <h4>📊 데이터베이스 목록</h4>
          {context.databases.registered_databases.length > 0 ? (
            <ul className="database-list">
              {context.databases.registered_databases.map((db, index) => (
                <li key={index} className="database-item">
                  <span className="db-name">{db.name}</span>
                  <span className="db-info">{db.host}:{db.port}/{db.dbname}</span>
                  <span className={`mcp-status ${db.mcp_enabled ? 'enabled' : 'disabled'}`}>
                    {db.mcp_enabled ? '🟢 MCP 연동' : '🔴 MCP 미연동'}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="no-data">등록된 데이터베이스가 없습니다.</p>
          )}
        </div>

        <div className="detail-section">
          <h4>🤖 AI 모델 상태</h4>
          {aiModel.status === 'model_selected' ? (
            <div className="ai-model-info">
              <span className="model-type">{aiModel.model.type}</span>
              <span className="model-name">{aiModel.model.name}</span>
              <span className="api-key-status">
                {aiModel.model.has_api_key ? '🔑 API 키 설정됨' : '❌ API 키 없음'}
              </span>
            </div>
          ) : (
            <p className="no-model">AI 모델이 선택되지 않았습니다.</p>
          )}
        </div>

        <div className="detail-section">
          <h4>🛠️ MCP 도구</h4>
          {mcpTools.available_tools.length > 0 ? (
            <div className="tools-summary">
              <p>총 {mcpTools.available_tools.length}개 도구 사용 가능</p>
              <p>데이터베이스 도구: {mcpTools.database_tools.length}개</p>
              <p>일반 도구: {mcpTools.general_tools.length}개</p>
            </div>
          ) : (
            <p className="no-tools">사용 가능한 MCP 도구가 없습니다.</p>
          )}
        </div>
      </div>

      {recommendations.length > 0 && (
        <div className="mcp-recommendations">
          <h4>💡 추천사항</h4>
          <ul>
            {recommendations.map((rec, index) => (
              <li key={index}>{rec}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

export default MCPStatus;