import React, { useState, useEffect } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { useTranslation } from '../utils/translations';

const MCPStatus = () => {
  const { language } = useLanguage();
  const { t } = useTranslation(language);
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
      console.error('MCP status fetch failed:', error);
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
        alert(t('mcpStatus.syncCompleted'));
        fetchMCPStatus(); // 상태 새로고침
      } else {
        alert(`${t('mcpStatus.syncFailed')}: ${data.message || t('mcpStatus.unknownError')}`);
      }
    } catch (error) {
      alert(`${t('mcpStatus.syncFailed')}: ${error.message}`);
    } finally {
      setSyncing(false);
    }
  };

  useEffect(() => {
    fetchMCPStatus();
  }, []);

  if (loading) {
    return <div className="mcp-status loading">{t('mcpStatus.loading')}</div>;
  }

  if (!mcpData) {
    return <div className="mcp-status error">{t('mcpStatus.loadError')}</div>;
  }

  const { context, recommendations } = mcpData;
  const dbSummary = context.databases.summary;
  const aiModel = context.ai_model;
  const mcpTools = context.mcp_tools;

  return (
    <div className="mcp-status">
      <div className="mcp-header">
        <h3>🔗 {t('mcpStatus.title')}</h3>
        <button 
          onClick={handleSync} 
          disabled={syncing}
          className="sync-button"
        >
          {syncing ? t('mcpStatus.syncing') : `🔄 ${t('mcpStatus.sync')}`}
        </button>
      </div>

      <div className="mcp-summary">
        <div className="summary-item">
          <span className="label">{t('mcpStatus.registeredDatabases')}:</span>
          <span className="value">{dbSummary.total_registered}{language === 'ko' ? '개' : ''}</span>
        </div>
        <div className="summary-item">
          <span className="label">{t('mcpStatus.mcpIntegration')}:</span>
          <span className="value">{dbSummary.mcp_enabled}{language === 'ko' ? '개' : ''}</span>
        </div>
        <div className="summary-item">
          <span className="label">{t('mcpStatus.syncStatus')}:</span>
          <span className={`value ${dbSummary.sync_status}`}>
            {dbSummary.sync_status === 'synced' ? `✅ ${t('mcpStatus.synced')}` : `⚠️ ${t('mcpStatus.notSynced')}`}
          </span>
        </div>
      </div>

      <div className="mcp-details">
        <div className="detail-section">
          <h4>📊 {t('mcpStatus.databaseList')}</h4>
          {context.databases.registered_databases.length > 0 ? (
            <ul className="database-list">
              {context.databases.registered_databases.map((db, index) => (
                <li key={index} className="database-item">
                  <span className="db-name">{db.name}</span>
                  <span className="db-info">{db.host}:{db.port}/{db.dbname}</span>
                  <span className={`mcp-status ${db.mcp_enabled ? 'enabled' : 'disabled'}`}>
                    {db.mcp_enabled ? `🟢 ${t('mcpStatus.mcpEnabled')}` : `🔴 ${t('mcpStatus.mcpDisabled')}`}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="no-data">{t('mcpStatus.noDatabases')}</p>
          )}
        </div>

        <div className="detail-section">
          <h4>🤖 {t('mcpStatus.aiModelStatus')}</h4>
          {aiModel.status === 'model_selected' ? (
            <div className="ai-model-info">
              <span className="model-type">{aiModel.model.type}</span>
              <span className="model-name">{aiModel.model.name}</span>
              <span className="api-key-status">
                {aiModel.model.has_api_key ? `🔑 ${t('mcpStatus.apiKeySet')}` : `❌ ${t('mcpStatus.noApiKey')}`}
              </span>
            </div>
          ) : (
            <p className="no-model">{t('mcpStatus.noModelSelected')}</p>
          )}
        </div>

        <div className="detail-section">
          <h4>🛠️ {t('mcpStatus.mcpTools')}</h4>
          {mcpTools.available_tools.length > 0 ? (
            <div className="tools-summary">
              <p>{t('mcpStatus.totalTools').replace('{count}', mcpTools.available_tools.length)}</p>
              <p>{t('mcpStatus.databaseTools').replace('{count}', mcpTools.database_tools.length)}</p>
              <p>{t('mcpStatus.generalTools').replace('{count}', mcpTools.general_tools.length)}</p>
            </div>
          ) : (
            <p className="no-tools">{t('mcpStatus.noTools')}</p>
          )}
        </div>
      </div>

      {recommendations.length > 0 && (
        <div className="mcp-recommendations">
          <h4>💡 {t('mcpStatus.recommendations')}</h4>
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