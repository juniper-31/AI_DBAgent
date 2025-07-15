"""
데이터베이스 서비스 - 데이터베이스 연결 및 쿼리 관리
"""
import psycopg2
import mysql.connector
from typing import Dict, List, Tuple, Optional, Any
from backend.database import get_registered_databases, execute_sql


class DatabaseService:
    """데이터베이스 연결 및 쿼리 서비스"""
    
    def __init__(self):
        self.connections = {}
    
    def get_database_info(self, db_name: str) -> Optional[Dict[str, Any]]:
        """데이터베이스 정보 조회"""
        databases = get_registered_databases()
        return next((db for db in databases if db["name"] == db_name), None)
    
    def test_connection(self, db_info: Dict[str, Any]) -> Tuple[bool, Optional[str]]:
        """데이터베이스 연결 테스트"""
        try:
            if db_info.get("type", "postgresql") == "postgresql":
                conn = psycopg2.connect(
                    host=db_info["host"],
                    port=int(db_info.get("port", 5432)),
                    user=db_info["user"],
                    password=db_info["password"],
                    dbname=db_info["dbname"],
                    connect_timeout=5
                )
            else:  # MySQL
                conn = mysql.connector.connect(
                    host=db_info["host"],
                    port=int(db_info.get("port", 3306)),
                    user=db_info["user"],
                    password=db_info["password"],
                    database=db_info["dbname"],
                    connection_timeout=5
                )
            
            conn.close()
            return True, None
        except Exception as e:
            return False, str(e)
    
    def execute_query(self, db_name: str, query: str) -> Tuple[List[str], List[Tuple], Optional[str]]:
        """쿼리 실행"""
        db_info = self.get_database_info(db_name)
        if not db_info:
            return [], [], f"데이터베이스 '{db_name}'을 찾을 수 없습니다."
        
        try:
            headers, data = execute_sql(query, db_info)
            return headers, data, None
        except Exception as e:
            return [], [], str(e)
    
    def get_database_schema(self, db_name: str) -> Optional[str]:
        """데이터베이스 스키마 정보 조회"""
        db_info = self.get_database_info(db_name)
        if not db_info:
            return None
        
        try:
            from backend.database import get_table_schemas
            return get_table_schemas(db_info)
        except Exception as e:
            print(f"스키마 조회 실패: {e}")
            return None
    
    def get_slow_queries(self, db_name: str, limit: int = 10) -> Tuple[List[str], List[Tuple], Optional[str]]:
        """슬로우 쿼리 조회"""
        db_info = self.get_database_info(db_name)
        if not db_info:
            return [], [], f"데이터베이스 '{db_name}'을 찾을 수 없습니다."
        
        if db_info.get("type", "postgresql") == "postgresql":
            query = """
                SELECT query, calls, total_time, mean_time, rows, max_time, min_time
                FROM pg_stat_statements
                WHERE query NOT LIKE 'EXPLAIN%'
                ORDER BY total_time DESC
                LIMIT %s
            """
        else:  # MySQL
            query = """
                SELECT SQL_TEXT, COUNT_STAR, SUM_TIMER_WAIT/1000000000000 as total_time_s, 
                       SUM_ERRORS, SUM_ROWS_AFFECTED
                FROM performance_schema.events_statements_summary_by_digest
                ORDER BY total_time_s DESC
                LIMIT %s
            """
        
        try:
            headers, data = execute_sql(query, db_info)
            return headers, data, None
        except Exception as e:
            return [], [], str(e)
    
    def get_database_stats(self, db_name: str) -> Dict[str, Any]:
        """데이터베이스 통계 정보 조회"""
        db_info = self.get_database_info(db_name)
        if not db_info:
            return {}
        
        stats = {}
        try:
            if db_info.get("type", "postgresql") == "postgresql":
                # PostgreSQL 통계
                queries = [
                    ("connections", "SELECT count(*) FROM pg_stat_activity"),
                    ("active_connections", "SELECT count(*) FROM pg_stat_activity WHERE state = 'active'"),
                    ("database_size", "SELECT pg_size_pretty(pg_database_size(current_database()))"),
                    ("version", "SELECT version()"),
                ]
            else:  # MySQL
                queries = [
                    ("connections", "SELECT count(*) FROM information_schema.processlist"),
                    ("active_connections", "SELECT count(*) FROM information_schema.processlist WHERE command != 'Sleep'"),
                    ("version", "SELECT version()"),
                ]
            
            for stat_name, query in queries:
                try:
                    headers, data = execute_sql(query, db_info)
                    if data and data[0]:
                        stats[stat_name] = data[0][0]
                except Exception as e:
                    stats[stat_name] = f"Error: {e}"
        
        except Exception as e:
            stats["error"] = str(e)
        
        return stats


# 전역 인스턴스
database_service = DatabaseService()