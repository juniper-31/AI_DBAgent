// SlowQueryComponent.js
// CloudWatch/RDS 슬로우 쿼리 분석, 시각화
import React, { useState, useEffect, useCallback } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { useTranslation } from '../utils/translations';

function SlowQueryComponent({ selectedDb, databases, onDbChange }) {
  const { language } = useLanguage();
  const { t } = useTranslation(language);
  
  const [slowQueries, setSlowQueries] = useState([]);
  const [loading, setLoading] = useState(false);
  const [filters, setFilters] = useState({
    timeRange: '24h',
    minDuration: 1, // 초 단위
    limit: 50,
    sortBy: 'duration', // duration, count, avg_duration
    sortOrder: 'desc'
  });
  const [selectedQuery, setSelectedQuery] = useState(null);
  const [queryDetails, setQueryDetails] = useState(null);
  const [showDetails, setShowDetails] = useState(false);

  const timeRanges = [
    { value: '1h', label: t('slowQuery.timeRanges.1h') },
    { value: '6h', label: t('slowQuery.timeRanges.6h') },
    { value: '24h', label: t('slowQuery.timeRanges.24h') },
    { value: '7d', label: t('slowQuery.timeRanges.7d') },
    { value: '30d', label: t('slowQuery.timeRanges.30d') }
  ];

  const sortOptions = [
    { value: 'duration', label: t('slowQuery.sortOptions.duration') },
    { value: 'count', label: t('slowQuery.sortOptions.count') },
    { value: 'avg_duration', label: t('slowQuery.sortOptions.avg_duration') },
    { value: 'rows_examined', label: t('slowQuery.sortOptions.rows_examined') },
    { value: 'rows_sent', label: t('slowQuery.sortOptions.rows_sent') }
  ];

  // 슬로우 쿼리 데이터 가져오기
  const fetchSlowQueries = useCallback(async () => {
    if (!selectedDb) return;

    setLoading(true);
    try {
      const params = new URLSearchParams({
        db_name: selectedDb,
        ...filters
      });

      const response = await fetch(`/slowquery/list?${params}`);
      if (response.ok) {
        const data = await response.json();
        setSlowQueries(data.queries || []);
      } else {
        console.error('슬로우 쿼리 데이터 가져오기 실패');
      }
    } catch (error) {
      console.error('슬로우 쿼리 요청 오류:', error);
    } finally {
      setLoading(false);
    }
  }, [selectedDb, filters]);

  // 쿼리 상세 정보 가져오기
  const fetchQueryDetails = async (queryId) => {
    try {
      const response = await fetch(`/slowquery/details?db_name=${selectedDb}&query_id=${queryId}`);
      if (response.ok) {
        const data = await response.json();
        setQueryDetails(data);
        setShowDetails(true);
      }
    } catch (error) {
      console.error('쿼리 상세 정보 요청 오류:', error);
    }
  };

  // 필터 변경 처리
  const handleFilterChange = (key, value) => {
    setFilters(prev => ({
      ...prev,
      [key]: value
    }));
  };

  // 쿼리 선택 처리
  const handleQuerySelect = (query) => {
    setSelectedQuery(query);
    fetchQueryDetails(query.id);
  };

  

  // SQL 포맷팅
  const formatSQL = (sql) => {
    if (!sql) return '';
    
    // 기본적인 SQL 포맷팅
    return sql
      .replace(/\b(SELECT|FROM|WHERE|AND|OR|ORDER BY|GROUP BY|HAVING|LIMIT|JOIN|LEFT|RIGHT|INNER|OUTER)\b/gi, '\n$1')
      .replace(/\b(INSERT|UPDATE|DELETE|CREATE|ALTER|DROP|INDEX|TABLE|DATABASE)\b/gi, '\n$1')
      .trim();
  };

  // 시간 포맷팅
  const formatDuration = (seconds) => {
    if (seconds < 1) {
      return `${(seconds * 1000).toFixed(2)}ms`;
    } else if (seconds < 60) {
      return `${seconds.toFixed(2)}s`;
    } else {
      const minutes = Math.floor(seconds / 60);
      const remainingSeconds = seconds % 60;
      return `${minutes}m ${remainingSeconds.toFixed(2)}s`;
    }
  };

  // 데이터 포맷팅
  const formatNumber = (num) => {
    if (num >= 1000000) {
      return `${(num / 1000000).toFixed(1)}M`;
    } else if (num >= 1000) {
      return `${(num / 1000).toFixed(1)}K`;
    }
    return num.toLocaleString();
  };

  // 필터 적용 시 데이터 다시 가져오기
  useEffect(() => {
    fetchSlowQueries();
  }, [selectedDb, filters, fetchSlowQueries]);

  // 쿼리 분석 및 최적화 제안
  const analyzeQuery = (query) => {
    const suggestions = [];
    
    // 기본적인 분석
    if (query.rows_examined > query.rows_sent * 10) {
      suggestions.push(t('slowQuery.suggestions.addIndex'));
    }
    
    if (query.sql?.toLowerCase().includes('select *')) {
      suggestions.push(language === 'ko' ? 'SELECT * 대신 필요한 컬럼만 선택하는 것을 고려해보세요.' : 'Consider selecting only necessary columns instead of SELECT *.');
    }
    
    if (query.sql?.toLowerCase().includes('like %')) {
      suggestions.push(language === 'ko' ? 'LIKE 패턴이 %로 시작하면 인덱스를 사용할 수 없습니다. 다른 검색 방법을 고려해보세요.' : 'LIKE patterns starting with % cannot use indexes. Consider other search methods.');
    }
    
    if (query.count > 100) {
      suggestions.push(t('slowQuery.suggestions.frequentQuery'));
    }
    
    return suggestions;
  };

  return (
    <div className="slow-query-component">
      {/* 헤더 */}
      <div className="component-header">
        <div className="header-left">
          <h2>{t('slowQuery.title')}</h2>
          {selectedDb && (
            <span className="selected-db">{t('slowQuery.selectedDb')}: {selectedDb}</span>
          )}
        </div>
        
        <div className="header-controls">
          {/* DB 선택 */}
          <select 
            value={selectedDb || ''} 
            onChange={(e) => onDbChange(e.target.value)}
            className="db-select"
          >
            <option value="">{t('slowQuery.selectDb')}</option>
            {databases?.map(db => (
              <option key={db.name} value={db.name}>
                {db.name}
              </option>
            ))}
          </select>

          {/* 시간 범위 */}
          <select 
            value={filters.timeRange} 
            onChange={(e) => handleFilterChange('timeRange', e.target.value)}
            className="time-range-select"
          >
            {timeRanges.map(range => (
              <option key={range.value} value={range.value}>
                {range.label}
              </option>
            ))}
          </select>

          {/* 최소 실행 시간 */}
          <input
            type="number"
            value={filters.minDuration}
            onChange={(e) => handleFilterChange('minDuration', Number(e.target.value))}
            placeholder={t('slowQuery.minDuration')}
            className="min-duration-input"
            min="0"
            step="0.1"
          />

          {/* 정렬 기준 */}
          <select 
            value={filters.sortBy} 
            onChange={(e) => handleFilterChange('sortBy', e.target.value)}
            className="sort-select"
          >
            {sortOptions.map(option => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>

          {/* 정렬 순서 */}
          <button 
            onClick={() => handleFilterChange('sortOrder', filters.sortOrder === 'desc' ? 'asc' : 'desc')}
            className="sort-order-btn"
          >
            {filters.sortOrder === 'desc' ? '↓' : '↑'}
          </button>

          {/* 새로고침 */}
          <button 
            onClick={fetchSlowQueries}
            disabled={loading || !selectedDb}
            className="btn btn-outline"
          >
            {loading ? t('common.loading') : (language === 'ko' ? '🔄 새로고침' : '🔄 Refresh')}
          </button>
        </div>
      </div>

      {!selectedDb ? (
        <div className="no-db-selected">
          <p>{t('slowQuery.selectDbMessage')}</p>
        </div>
      ) : (
        <div className="slow-query-content">
          {/* 슬로우 쿼리 목록 */}
          <div className="query-list">
            <h3>{t('slowQuery.queryList').replace('{count}', slowQueries.length)}</h3>
            
            {loading ? (
              <div className="loading">{t('slowQuery.loading')}</div>
            ) : slowQueries.length > 0 ? (
              <div className="query-table-container">
                <table className="query-table">
                  <thead>
                    <tr>
                      <th>{t('slowQuery.executionTime')}</th>
                      <th>{t('slowQuery.executionCount')}</th>
                      <th>{t('slowQuery.avgTime')}</th>
                      <th>{t('slowQuery.rowsExamined')}</th>
                      <th>{t('slowQuery.rowsSent')}</th>
                      <th>{language === 'ko' ? 'SQL 미리보기' : 'SQL Preview'}</th>
                      <th>{language === 'ko' ? '작업' : 'Actions'}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {slowQueries.map((query, index) => (
                      <tr 
                        key={index} 
                        className={selectedQuery?.id === query.id ? 'selected' : ''}
                        onClick={() => handleQuerySelect(query)}
                      >
                        <td className="duration-cell">
                          <span className="duration-value">{formatDuration(query.duration)}</span>
                          {query.duration > 10 && <span className="warning-badge">⚠️</span>}
                        </td>
                        <td>{formatNumber(query.count)}</td>
                        <td>{formatDuration(query.avg_duration)}</td>
                        <td>{formatNumber(query.rows_examined)}</td>
                        <td>{formatNumber(query.rows_sent)}</td>
                        <td className="sql-preview">
                          <code>{query.sql?.substring(0, 100)}...</code>
                        </td>
                        <td>
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              handleQuerySelect(query);
                            }}
                            className="btn btn-sm btn-outline"
                          >
                            {language === 'ko' ? '상세보기' : 'Details'}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="no-queries">
                <p>{t('slowQuery.noQueries')}</p>
                <p>{t('slowQuery.adjustFilters')}</p>
              </div>
            )}
          </div>

          {/* 쿼리 상세 정보 */}
          {showDetails && selectedQuery && (
            <div className="query-details">
              <div className="details-header">
                <h3>{t('slowQuery.queryDetails')}</h3>
                <button 
                  onClick={() => setShowDetails(false)}
                  className="close-btn"
                >
                  ✕
                </button>
              </div>

              <div className="details-content">
                {/* 기본 정보 */}
                <div className="detail-section">
                  <h4>{language === 'ko' ? '기본 정보' : 'Basic Information'}</h4>
                  <div className="info-grid">
                    <div className="info-item">
                      <label>{language === 'ko' ? '최대 실행 시간:' : 'Max Execution Time:'}</label>
                      <span>{formatDuration(selectedQuery.duration)}</span>
                    </div>
                    <div className="info-item">
                      <label>{language === 'ko' ? '평균 실행 시간:' : 'Average Execution Time:'}</label>
                      <span>{formatDuration(selectedQuery.avg_duration)}</span>
                    </div>
                    <div className="info-item">
                      <label>{language === 'ko' ? '실행 횟수:' : 'Execution Count:'}</label>
                      <span>{formatNumber(selectedQuery.count)}</span>
                    </div>
                    <div className="info-item">
                      <label>{language === 'ko' ? '검사된 행 수:' : 'Rows Examined:'}</label>
                      <span>{formatNumber(selectedQuery.rows_examined)}</span>
                    </div>
                    <div className="info-item">
                      <label>{language === 'ko' ? '반환된 행 수:' : 'Rows Sent:'}</label>
                      <span>{formatNumber(selectedQuery.rows_sent)}</span>
                    </div>
                    <div className="info-item">
                      <label>{language === 'ko' ? '효율성:' : 'Efficiency:'}</label>
                      <span className={`efficiency ${selectedQuery.rows_examined > selectedQuery.rows_sent * 10 ? 'poor' : 'good'}`}>
                        {((selectedQuery.rows_sent / selectedQuery.rows_examined) * 100).toFixed(1)}%
                      </span>
                    </div>
                  </div>
                </div>

                {/* SQL 쿼리 */}
                <div className="detail-section">
                  <h4>SQL 쿼리</h4>
                  <div className="sql-container">
                    <pre><code>{formatSQL(selectedQuery.sql)}</code></pre>
                    <button 
                      onClick={() => navigator.clipboard.writeText(selectedQuery.sql)}
                      className="copy-btn"
                    >
                      {t('chat.copy')}
                    </button>
                  </div>
                </div>

                {/* 최적화 제안 */}
                <div className="detail-section">
                  <h4>{language === 'ko' ? '최적화 제안' : 'Optimization Suggestions'}</h4>
                  <div className="suggestions">
                    {analyzeQuery(selectedQuery).map((suggestion, index) => (
                      <div key={index} className="suggestion-item">
                        <span className="suggestion-icon">💡</span>
                        <span>{suggestion}</span>
                      </div>
                    ))}
                    {analyzeQuery(selectedQuery).length === 0 && (
                      <p className="no-suggestions">{language === 'ko' ? '현재 쿼리에 대한 특별한 최적화 제안이 없습니다.' : 'No specific optimization suggestions for this query.'}</p>
                    )}
                  </div>
                </div>

                {/* 실행 계획 (있는 경우) */}
                {queryDetails?.execution_plan && (
                  <div className="detail-section">
                    <h4>{language === 'ko' ? '실행 계획' : 'Execution Plan'}</h4>
                    <div className="execution-plan">
                      <pre><code>{JSON.stringify(queryDetails.execution_plan, null, 2)}</code></pre>
                    </div>
                  </div>
                )}

                {/* 시간별 실행 통계 */}
                {queryDetails?.time_stats && (
                  <div className="detail-section">
                    <h4>{language === 'ko' ? '시간별 실행 통계' : 'Hourly Execution Statistics'}</h4>
                    <div className="time-stats">
                      <table className="stats-table">
                        <thead>
                          <tr>
                            <th>{language === 'ko' ? '시간대' : 'Hour'}</th>
                            <th>{language === 'ko' ? '실행 횟수' : 'Count'}</th>
                            <th>{language === 'ko' ? '평균 시간' : 'Avg Time'}</th>
                            <th>{language === 'ko' ? '최대 시간' : 'Max Time'}</th>
                          </tr>
                        </thead>
                        <tbody>
                          {queryDetails.time_stats.map((stat, index) => (
                            <tr key={index}>
                              <td>{stat.hour}:00</td>
                              <td>{stat.count}</td>
                              <td>{formatDuration(stat.avg_duration)}</td>
                              <td>{formatDuration(stat.max_duration)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default SlowQueryComponent; 