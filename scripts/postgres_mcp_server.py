#!/usr/bin/env python3
"""
PostgreSQL MCP Server
Docker 환경의 PostgreSQL 데이터베이스와 연동하는 MCP 서버
"""

import asyncio
import json
import os
import sys
from typing import Any, Dict, List, Optional

import psycopg2
from psycopg2.extras import RealDictCursor


class PostgreSQLMCPServer:
    def __init__(self, connection_string: str):
        self.connection_string = connection_string
        self.connection = None
    
    def connect(self):
        """PostgreSQL 데이터베이스에 연결"""
        try:
            self.connection = psycopg2.connect(
                self.connection_string,
                cursor_factory=RealDictCursor
            )
            return True
        except Exception as e:
            print(f"Database connection failed: {e}", file=sys.stderr)
            return False
    
    def list_tables(self) -> List[str]:
        """테이블 목록 조회"""
        if not self.connection:
            return []
        
        try:
            with self.connection.cursor() as cursor:
                cursor.execute("""
                    SELECT table_name 
                    FROM information_schema.tables 
                    WHERE table_schema = 'public'
                    ORDER BY table_name;
                """)
                return [row['table_name'] for row in cursor.fetchall()]
        except Exception as e:
            print(f"Error listing tables: {e}", file=sys.stderr)
            return []
    
    def describe_table(self, table_name: str) -> List[Dict[str, Any]]:
        """테이블 스키마 조회"""
        if not self.connection:
            return []
        
        try:
            with self.connection.cursor() as cursor:
                cursor.execute("""
                    SELECT 
                        column_name,
                        data_type,
                        is_nullable,
                        column_default
                    FROM information_schema.columns 
                    WHERE table_name = %s AND table_schema = 'public'
                    ORDER BY ordinal_position;
                """, (table_name,))
                return [dict(row) for row in cursor.fetchall()]
        except Exception as e:
            print(f"Error describing table {table_name}: {e}", file=sys.stderr)
            return []
    
    def execute_query(self, query: str) -> Dict[str, Any]:
        """SQL 쿼리 실행"""
        if not self.connection:
            return {"error": "No database connection"}
        
        try:
            with self.connection.cursor() as cursor:
                cursor.execute(query)
                
                # SELECT 쿼리인 경우 결과 반환
                if query.strip().upper().startswith('SELECT'):
                    results = cursor.fetchall()
                    return {
                        "success": True,
                        "data": [dict(row) for row in results],
                        "row_count": len(results)
                    }
                else:
                    # INSERT, UPDATE, DELETE 등의 경우
                    self.connection.commit()
                    return {
                        "success": True,
                        "affected_rows": cursor.rowcount
                    }
        except Exception as e:
            self.connection.rollback()
            return {"error": str(e)}
    
    def handle_request(self, method: str, params: Dict[str, Any]) -> Dict[str, Any]:
        """MCP 요청 처리"""
        if method == "list_tables":
            tables = self.list_tables()
            return {"tables": tables}
        
        elif method == "describe_table":
            table_name = params.get("table_name")
            if not table_name:
                return {"error": "table_name parameter required"}
            schema = self.describe_table(table_name)
            return {"schema": schema}
        
        elif method == "query":
            query = params.get("query")
            if not query:
                return {"error": "query parameter required"}
            result = self.execute_query(query)
            return result
        
        else:
            return {"error": f"Unknown method: {method}"}


def main():
    """MCP 서버 메인 함수"""
    connection_string = os.getenv("POSTGRES_CONNECTION_STRING")
    if not connection_string:
        print("POSTGRES_CONNECTION_STRING environment variable required", file=sys.stderr)
        sys.exit(1)
    
    server = PostgreSQLMCPServer(connection_string)
    
    if not server.connect():
        print("Failed to connect to database", file=sys.stderr)
        sys.exit(1)
    
    print("PostgreSQL MCP Server started successfully", file=sys.stderr)
    
    # 간단한 테스트
    if len(sys.argv) > 1 and sys.argv[1] == "--test":
        # 테스트 모드
        print("Testing database connection...")
        tables = server.list_tables()
        print(f"Found tables: {tables}")
        
        if tables:
            for table in tables[:3]:  # 처음 3개 테이블만 테스트
                schema = server.describe_table(table)
                print(f"Table {table} schema: {len(schema)} columns")
        
        # 간단한 쿼리 테스트
        result = server.execute_query("SELECT COUNT(*) as total FROM conversations;")
        print(f"Conversations count: {result}")
    else:
        # 실제 MCP 서버 모드 (여기서는 간단한 JSON RPC 시뮬레이션)
        print("MCP Server ready for requests", file=sys.stderr)


if __name__ == "__main__":
    main()