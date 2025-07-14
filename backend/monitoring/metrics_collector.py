import psycopg2
import psycopg2.extras
from datetime import datetime, timedelta
from typing import Dict, Any, Optional, List
import time
import threading
import logging
from ..models.database import DatabaseConnection, DatabaseMetrics, MonitoringConfig

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class MetricsCollector:
    def __init__(self):
        self.monitoring_configs: Dict[str, MonitoringConfig] = {}
        self.metrics_history: Dict[str, List[DatabaseMetrics]] = {}
        self.db_connections: Dict[str, DatabaseConnection] = {}  # DB 연결 정보 저장
        self.is_running = False
        self.monitoring_thread = None
        self.use_cloudwatch: Dict[str, bool] = {}  # DB별 CloudWatch 사용 여부
        
    def add_database(self, db_connection: DatabaseConnection, config: MonitoringConfig, use_cloudwatch: bool = False):
        """모니터링할 데이터베이스 추가 (CloudWatch 옵션 포함)"""
        self.monitoring_configs[db_connection.name] = config
        self.metrics_history[db_connection.name] = []
        self.db_connections[db_connection.name] = db_connection
        self.use_cloudwatch[db_connection.name] = use_cloudwatch
        logger.info(f"Added database {db_connection.name} for monitoring (cloudwatch={use_cloudwatch})")
        
    def remove_database(self, db_name: str):
        """모니터링에서 데이터베이스 제거"""
        if db_name in self.monitoring_configs:
            del self.monitoring_configs[db_name]
        if db_name in self.metrics_history:
            del self.metrics_history[db_name]
        if db_name in self.db_connections:
            del self.db_connections[db_name]
        if db_name in self.use_cloudwatch:
            del self.use_cloudwatch[db_name]
        logger.info(f"Removed database {db_name} from monitoring")
        
    def collect_metrics(self, db_connection: DatabaseConnection) -> Optional[DatabaseMetrics]:
        """단일 데이터베이스의 메트릭 수집 (직접 연결 방식)"""
        try:
            conn = psycopg2.connect(
                host=db_connection.host,
                user=db_connection.user,
                password=db_connection.password,
                dbname=db_connection.dbname,
                port=db_connection.port
            )
            
            metrics = DatabaseMetrics(
                db_name=db_connection.name,
                timestamp=datetime.now()
            )
            
            with conn.cursor(cursor_factory=psycopg2.extras.DictCursor) as cursor:
                # 기본 정보 수집
                cursor.execute("SELECT version()")
                version_result = cursor.fetchone()
                if version_result:
                    metrics.version = version_result[0]
                
                # 연결 수 정보
                cursor.execute("""
                    SELECT 
                        count(*) as total_connections,
                        count(*) FILTER (WHERE state = 'active') as active_connections
                    FROM pg_stat_activity
                """)
                conn_result = cursor.fetchone()
                if conn_result:
                    metrics.total_connections = conn_result['total_connections']
                    metrics.active_connections = conn_result['active_connections']
                
                # 쿼리 통계 (pg_stat_statements 확장 필요)
                try:
                    cursor.execute("""
                        SELECT 
                            sum(calls) as total_calls,
                            sum(total_time) as total_time
                        FROM pg_stat_statements
                    """)
                    query_result = cursor.fetchone()
                    if query_result and query_result['total_calls']:
                        # 간단한 QPS 계산 (실제로는 더 정교한 계산 필요)
                        metrics.queries_per_second = query_result['total_calls'] / 60.0
                except:
                    logger.warning(f"pg_stat_statements not available for {db_connection.name}")
                
                # 슬로우 쿼리 수
                try:
                    cursor.execute("""
                        SELECT count(*) as slow_count
                        FROM pg_stat_statements 
                        WHERE mean_time > 1000
                    """)
                    slow_result = cursor.fetchone()
                    if slow_result:
                        metrics.slow_queries_count = slow_result['slow_count']
                except:
                    pass
                
                # 업타임
                cursor.execute("SELECT extract(epoch from now() - pg_postmaster_start_time()) as uptime")
                uptime_result = cursor.fetchone()
                if uptime_result:
                    metrics.uptime = int(uptime_result['uptime'])
                
                # 디스크 사용량 (간단한 버전)
                cursor.execute("""
                    SELECT pg_database_size(current_database()) as db_size
                """)
                size_result = cursor.fetchone()
                if size_result:
                    # MB 단위로 변환
                    metrics.disk_usage = size_result['db_size'] / (1024 * 1024)
            
            conn.close()
            return metrics
            
        except Exception as e:
            logger.error(f"Error collecting metrics for {db_connection.name}: {e}")
            return None
    
    def collect_metrics_cloudwatch(self, db_connection: DatabaseConnection) -> Optional[DatabaseMetrics]:
        """CloudWatch에서 메트릭 수집 (Stub, 실제 구현 필요)"""
        # TODO: boto3 등으로 CloudWatch에서 메트릭 수집 구현
        logger.info(f"CloudWatch metrics collection for {db_connection.name} (not implemented)")
        return None
    
    def start_monitoring(self):
        """모니터링 시작"""
        if self.is_running:
            return
            
        self.is_running = True
        self.monitoring_thread = threading.Thread(target=self._monitoring_loop, daemon=True)
        self.monitoring_thread.start()
        logger.info("Database monitoring started")
        
    def stop_monitoring(self):
        """모니터링 중지"""
        self.is_running = False
        if self.monitoring_thread:
            self.monitoring_thread.join()
        logger.info("Database monitoring stopped")
        
    def _monitoring_loop(self):
        """모니터링 루프"""
        while self.is_running:
            try:
                for db_name, config in self.monitoring_configs.items():
                    if not config.is_enabled:
                        continue
                    
                    db_connection = self.db_connections.get(db_name)
                    if not db_connection:
                        logger.warning(f"No db_connection info for {db_name}")
                        continue
                    
                    # CloudWatch 사용 여부에 따라 분기
                    if self.use_cloudwatch.get(db_name):
                        metrics = self.collect_metrics_cloudwatch(db_connection)
                    else:
                        metrics = self.collect_metrics(db_connection)
                    
                    if metrics:
                        self.metrics_history[db_name].append(metrics)
                        # 히스토리 크기 제한 (최근 1000개만 유지)
                        if len(self.metrics_history[db_name]) > 1000:
                            self.metrics_history[db_name] = self.metrics_history[db_name][-1000:]
                        logger.info(f"Collected metrics for {db_name}: {metrics.active_connections} active connections")
                
                # 설정된 간격만큼 대기
                time.sleep(60)  # 기본 1분 간격
                
            except Exception as e:
                logger.error(f"Error in monitoring loop: {e}")
                time.sleep(10)  # 에러 시 10초 대기
    
    def get_latest_metrics(self, db_name: str) -> Optional[DatabaseMetrics]:
        """최신 메트릭 반환"""
        if db_name in self.metrics_history and self.metrics_history[db_name]:
            return self.metrics_history[db_name][-1]
        return None
    
    def get_metrics_history(self, db_name: str, hours: int = 24) -> List[DatabaseMetrics]:
        """지정된 시간 범위의 메트릭 히스토리 반환"""
        if db_name not in self.metrics_history:
            return []
            
        cutoff_time = datetime.now() - timedelta(hours=hours)
        return [
            metric for metric in self.metrics_history[db_name]
            if metric.timestamp >= cutoff_time
        ]

# 전역 인스턴스
metrics_collector = MetricsCollector() 