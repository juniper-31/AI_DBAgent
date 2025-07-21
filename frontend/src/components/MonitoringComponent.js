// MonitoringComponent.js
// DB별 실시간 모니터링, 차트, 상세 페이지
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { useTranslation } from '../utils/translations';

// CLOUDWATCH_METRICS는 함수 내부로 이동하여 다국어 지원

function MonitoringComponent({ selectedDb, databases, onDbChange }) {
  const { language } = useLanguage();
  const { t } = useTranslation(language);
  
  // 다국어 지원 CloudWatch 메트릭 정의
  const CLOUDWATCH_METRICS = [
    { key: 'connections', name: 'DatabaseConnections', label: t('monitoring.connections'), unit: t('monitoring.unit.count'), color: '#007bff' },
    { key: 'cpu', name: 'CPUUtilization', label: t('monitoring.cpuUsage'), unit: t('monitoring.unit.percent'), color: '#28a745' },
    { key: 'memory', name: 'FreeableMemory', label: t('monitoring.freeMemory'), unit: t('monitoring.unit.gb'), color: '#ffc107' },
    { key: 'storage', name: 'FreeStorageSpace', label: t('monitoring.freeStorage'), unit: t('monitoring.unit.gb'), color: '#6f42c1' },
    { key: 'read_latency', name: 'ReadLatency', label: t('monitoring.readLatency'), unit: t('monitoring.unit.ms'), color: '#dc3545' },
    { key: 'write_latency', name: 'WriteLatency', label: t('monitoring.writeLatency'), unit: t('monitoring.unit.ms'), color: '#fd7e14' },
    { key: 'read_iops', name: 'ReadIOPS', label: t('monitoring.readIops'), unit: '', color: '#17a2b8' },
    { key: 'write_iops', name: 'WriteIOPS', label: t('monitoring.writeIops'), unit: '', color: '#fd7e14' }
  ];
  
  const [metrics, setMetrics] = useState({});
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [timeRange, setTimeRange] = useState('1h');
  const [refreshInterval, setRefreshInterval] = useState(30);
  const [isAutoRefresh, setIsAutoRefresh] = useState(true);
  const intervalRef = useRef(null);
  const [instanceType, setInstanceType] = useState('');

  const timeRanges = [
    { value: '1h', label: language === 'ko' ? '1시간' : '1 Hour' },
    { value: '6h', label: language === 'ko' ? '6시간' : '6 Hours' },
    { value: '24h', label: language === 'ko' ? '24시간' : '24 Hours' },
    { value: '7d', label: language === 'ko' ? '7일' : '7 Days' }
  ];

  const refreshIntervals = [
    { value: 10, label: language === 'ko' ? '10초' : '10s' },
    { value: 30, label: language === 'ko' ? '30초' : '30s' },
    { value: 60, label: language === 'ko' ? '1분' : '1m' },
    { value: 300, label: language === 'ko' ? '5분' : '5m' }
  ];

  // 시간 범위 → hours 변환
  const getHours = (range) => {
    switch (range) {
      case '1h': return 1;
      case '6h': return 6;
      case '24h': return 24;
      case '7d': return 24 * 7;
      default: return 1;
    }
  };

  // CloudWatch 메트릭 데이터 가져오기
  const fetchCloudwatchMetrics = useCallback(async () => {
    if (!selectedDb) return;
    setLoading(true);
    try {
      const dbIdentifier = selectedDb;
      const hours = getHours(timeRange);
      const results = await Promise.all(
        CLOUDWATCH_METRICS.map(async (metric) => {
          const url = `/api/monitoring/cloudwatch/metrics/${dbIdentifier}?metric_name=${metric.name}&hours=${hours}`;
          let errorMsg = null;
          let json = { data: [] };
          let status = 200;
          try {
            const res = await fetch(url);
            status = res.status;
            try {
              json = await res.json();
            } catch (e) {}
            if (!res.ok) {
              errorMsg = (json && json.detail) ? json.detail : `API 오류 (status ${status})`;
            }
          } catch (e) {
            errorMsg = e.message || 'API 요청 실패';
          }
          // 콘솔에 응답(raw) 출력
          console.log(`[CloudWatch][${metric.name}]`, json, errorMsg);
          return { key: metric.key, data: json.data || [], error: errorMsg };
        })
      );
      const newMetrics = {};
      const newErrors = {};
      results.forEach(({ key, data, error }) => {
        newMetrics[key] = data;
        if (error) newErrors[key] = error;
      });
      setMetrics(newMetrics);
      setErrors(newErrors);
    } catch (error) {
      console.error('CloudWatch 메트릭 요청 오류:', error);
    } finally {
      setLoading(false);
    }
  }, [selectedDb, timeRange]);

  // 자동 새로고침
  useEffect(() => {
    if (isAutoRefresh && selectedDb) {
      fetchCloudwatchMetrics();
      intervalRef.current = setInterval(() => {
        fetchCloudwatchMetrics();
      }, refreshInterval * 1000);
      return () => {
        if (intervalRef.current) clearInterval(intervalRef.current);
      };
    } else {
      if (intervalRef.current) clearInterval(intervalRef.current);
    }
  }, [selectedDb, timeRange, refreshInterval, isAutoRefresh, fetchCloudwatchMetrics]);

  // 수동 새로고침
  const handleManualRefresh = () => {
    fetchCloudwatchMetrics();
  };

  // 차트 데이터 포맷팅
  const formatChartData = (data, metricKey) => {
    if (!data || !Array.isArray(data)) return [];
    // 메모리/스토리지는 단위 변환
    if (metricKey === 'memory') {
      return data.map(point => ({ x: new Date(point.timestamp), y: Math.round(point.value / 1024 / 1024) })); // MB
    }
    if (metricKey === 'storage') {
      return data.map(point => ({ x: new Date(point.timestamp), y: Math.round(point.value / 1024 / 1024 / 1024) })); // GB
    }
    return data.map(point => ({ x: new Date(point.timestamp), y: point.value }));
  };

  // 카드/차트 UI 개선 (에러 메시지 표시)
  const renderMetricCard = (title, value, unit = '', color = '#007bff', error = null) => (
    <div className="metric-card improved">
      <div className="metric-header">
        <h4 style={{ color }}>{title}</h4>
      </div>
      <div className="metric-value">
        {value === null || value === undefined || isNaN(value) ? (
          <span className="no-data">{t('common.noData')}</span>
        ) : (
          <span className="value" style={{ color }}>{value}</span>
        )}
        {unit && <span className="unit">{unit}</span>}
      </div>
      {error && <div className="metric-error">{error}</div>}
    </div>
  );

  const renderChart = (title, data, color = '#007bff', unit = '', error = null) => (
    <div className="chart-card improved">
      <h4 style={{ color }}>{title}</h4>
      <div className="chart-container">
        {error ? (
          <div className="no-data metric-error">{error}</div>
        ) : (!data || data.length === 0) ? (
          <div className="no-data">{t('common.noData')}</div>
        ) : (
          <svg width="100%" height="200" viewBox="0 0 400 200">
            {data.length > 1 && (
              <polyline
                fill="none"
                stroke={color}
                strokeWidth="2"
                points={data.map((point, i) =>
                  `${(i / (data.length - 1)) * 400},${200 - (point.y / Math.max(...data.map(p => p.y) || [1])) * 180}`
                ).join(' ')}
              />
            )}
            {data.map((point, i) => (
              <circle
                key={i}
                cx={(i / (data.length - 1)) * 400}
                cy={200 - (point.y / Math.max(...data.map(p => p.y) || [1])) * 180}
                r="3"
                fill={color}
              />
            ))}
          </svg>
        )}
        {unit && <div className="chart-unit">({unit})</div>}
      </div>
    </div>
  );

  // cloudwatch_id 표시용
  const selectedDbObj = databases?.find(db => db.name === selectedDb);
  const cloudwatchId = selectedDbObj?.cloudwatch_id;

  // 인스턴스 타입 정보 불러오기
  useEffect(() => {
    setInstanceType('');
    if (!cloudwatchId) return;
    fetch(`/api/monitoring/cloudwatch/rds-info/${cloudwatchId}`)
      .then(res => res.json())
      .then(data => {
        if (data.status === 'success' && data.instance_info?.instance_class) {
          setInstanceType(data.instance_info.instance_class);
        }
      })
      .catch(() => {});
  }, [cloudwatchId]);

  return (
    <div className="monitoring-component improved">
      {/* 헤더 */}
      <div className="monitoring-header">
        <div className="header-left">
          <h2>{t('monitoring.title')}</h2>
          {selectedDb && (
            <span className="selected-db">
              {t('monitoring.selectedDb')}: {selectedDb}
              {cloudwatchId && (
                <span style={{ fontSize: '13px', color: '#888', marginLeft: 12 }}>
                  (CloudWatch ID: <b>{cloudwatchId}</b>
                  {instanceType && (
                    <span style={{ marginLeft: 8 }}>
                      | {language === 'ko' ? '인스턴스 타입' : 'Instance Type'}: <b>{instanceType}</b>
                    </span>
                  )}
                  )
                </span>
              )}
            </span>
          )}
        </div>
        <div className="header-controls">
          {/* DB 선택 */}
          <select 
            value={selectedDb || ''} 
            onChange={(e) => onDbChange(e.target.value)}
            className="db-select"
          >
            <option value="">{t('monitoring.selectDb')}</option>
            {databases?.map(db => (
              <option key={db.name} value={db.name}>
                {db.name}
              </option>
            ))}
          </select>
          {/* 시간 범위 */}
          <select 
            value={timeRange} 
            onChange={(e) => setTimeRange(e.target.value)}
            className="time-range-select"
          >
            {timeRanges.map(range => (
              <option key={range.value} value={range.value}>
                {range.label}
              </option>
            ))}
          </select>
          {/* 새로고침 간격 */}
          <select 
            value={refreshInterval} 
            onChange={(e) => setRefreshInterval(Number(e.target.value))}
            className="refresh-interval-select"
          >
            {refreshIntervals.map(interval => (
              <option key={interval.value} value={interval.value}>
                {interval.label}
              </option>
            ))}
          </select>
          {/* 자동 새로고침 토글 */}
          <label className="auto-refresh-toggle">
            <input
              type="checkbox"
              checked={isAutoRefresh}
              onChange={(e) => setIsAutoRefresh(e.target.checked)}
            />
            {language === 'ko' ? '자동 새로고침' : 'Auto Refresh'}
          </label>
          {/* 수동 새로고침 */}
          <button 
            onClick={handleManualRefresh}
            disabled={loading || !selectedDb}
            className="btn btn-outline"
          >
            {loading ? (language === 'ko' ? '새로고침 중...' : 'Refreshing...') : (language === 'ko' ? '🔄 새로고침' : '🔄 Refresh')}
          </button>
        </div>
      </div>
      {!selectedDb ? (
        <div className="no-db-selected">
          <p>{t('monitoring.selectDbMessage')}</p>
        </div>
      ) : (
        <div className="monitoring-content">
          {/* 4단 카드+그래프 일체형 그리드 */}
          <div className="metrics-grid improved">
            {CLOUDWATCH_METRICS.map(metric => {
              const data = metrics[metric.key] || [];
              const latest = data.length > 0 ? data[data.length - 1].value : null;
              let displayValue = latest;
              // 모든 지표 소수점 2자리로 표시
              if (latest !== null && latest !== undefined && !isNaN(latest)) {
                if (metric.key === 'memory') displayValue = (latest / 1024 / 1024 / 1024).toFixed(2); // GB
                else displayValue = Number(latest).toFixed(2);
              }
              if (metric.key === 'storage' && latest !== null) displayValue = Math.round(latest); // GB (스토리지는 정수)
              return (
                <div key={metric.key} style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {renderMetricCard(metric.label, displayValue, metric.unit, metric.color, errors[metric.key])}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

export default MonitoringComponent; 