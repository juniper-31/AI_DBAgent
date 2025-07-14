from fastapi import APIRouter, Request, HTTPException, Form, Depends
from fastapi.responses import HTMLResponse
from fastapi.templating import Jinja2Templates
from typing import Dict, Any, List
import json
from datetime import datetime, timedelta
import psycopg2
import mysql.connector
from sqlalchemy import create_engine, text, MetaData, inspect
from sqlalchemy.orm import Session

from backend.monitoring.metrics_collector import metrics_collector
from backend.models.database import DatabaseMetrics, MonitoringConfig, DatabaseConnection
from backend.database import get_registered_databases # Import the new function
from backend.integrations.aws import AWSIntegration

router = APIRouter()
templates = Jinja2Templates(directory="templates")

@router.get("/monitoring", response_class=HTMLResponse)
async def monitoring_dashboard(request: Request):
    """모니터링 대시보드"""
    databases = get_registered_databases() # Use the new function
    selected_db_name = request.session.get("selected_db_name")
    
    # 각 DB의 최신 메트릭 수집
    db_metrics = {}
    for db in databases:
        latest_metrics = metrics_collector.get_latest_metrics(db["name"])
        if latest_metrics:
            db_metrics[db["name"]] = latest_metrics
    
    return templates.TemplateResponse("monitoring.html", {
        "request": request,
        "databases": databases,
        "selected_db_name": selected_db_name,
        "db_metrics": db_metrics
    })

@router.get("/monitoring/{db_name}", response_class=HTMLResponse)
async def database_monitoring(request: Request, db_name: str):
    """특정 데이터베이스의 상세 모니터링"""
    databases = get_registered_databases() # Use the new function
    selected_db = next((db for db in databases if db["name"] == db_name), None)
    
    if not selected_db:
        raise HTTPException(status_code=404, detail="Database not found")
    
    # 최신 메트릭
    latest_metrics = metrics_collector.get_latest_metrics(db_name)
    
    # 24시간 히스토리
    history_metrics = metrics_collector.get_metrics_history(db_name, hours=24)
    
    # 차트 데이터 준비
    chart_data = {
        "timestamps": [],
        "active_connections": [],
        "total_connections": [],
        "queries_per_second": [],
        "slow_queries_count": [],
        "disk_usage": []
    }
    
    for metric in history_metrics:
        chart_data["timestamps"].append(metric.timestamp.strftime("%H:%M"))
        chart_data["active_connections"].append(metric.active_connections or 0)
        chart_data["total_connections"].append(metric.total_connections or 0)
        chart_data["queries_per_second"].append(metric.queries_per_second or 0)
        chart_data["slow_queries_count"].append(metric.slow_queries_count or 0)
        chart_data["disk_usage"].append(metric.disk_usage or 0)
    
    return templates.TemplateResponse("database_monitoring.html", {
        "request": request,
        "database": selected_db,
        "latest_metrics": latest_metrics,
        "chart_data": json.dumps(chart_data),
        "history_metrics": history_metrics[-50:]  # 최근 50개만 표시
    })

@router.post("/monitoring/start/{db_name}")
async def start_monitoring(request: Request, db_name: str, use_cloudwatch: bool = Form(False)):
    """특정 데이터베이스 모니터링 시작 (CloudWatch 옵션 지원)"""
    databases = get_registered_databases() # Use the new function
    selected_db = next((db for db in databases if db["name"] == db_name), None)
    
    if not selected_db:
        raise HTTPException(status_code=404, detail="Database not found")
    
    # 모니터링 설정 생성
    config = MonitoringConfig(db_name=db_name)
    
    # 메트릭 수집기에 추가
    db_connection = DatabaseConnection(
        name=selected_db["name"],
        host=selected_db["host"],
        port=int(selected_db["port"]),
        user=selected_db["user"],
        password=selected_db["password"],
        dbname=selected_db["dbname"]
    )
    
    metrics_collector.add_database(db_connection, config, use_cloudwatch=use_cloudwatch)
    
    # 모니터링 시작
    metrics_collector.start_monitoring()
    
    return {"status": "success", "message": f"Started monitoring for {db_name} (cloudwatch={use_cloudwatch})"}

@router.post("/monitoring/stop/{db_name}")
async def stop_monitoring(request: Request, db_name: str):
    """특정 데이터베이스 모니터링 중지"""
    metrics_collector.remove_database(db_name)
    return {"status": "success", "message": f"Stopped monitoring for {db_name}"}

@router.get("/api/metrics/{db_name}")
async def get_metrics_api(db_name: str, hours: int = 24):
    """API로 메트릭 데이터 반환 (JSON)"""
    history_metrics = metrics_collector.get_metrics_history(db_name, hours=hours)
    
    # Pydantic 모델을 dict로 변환
    metrics_data = []
    for metric in history_metrics:
        metric_dict = {
            "timestamp": metric.timestamp.isoformat(),
            "active_connections": metric.active_connections,
            "total_connections": metric.total_connections,
            "queries_per_second": metric.queries_per_second,
            "slow_queries_count": metric.slow_queries_count,
            "disk_usage": metric.disk_usage,
            "uptime": metric.uptime,
            "version": metric.version
        }
        metrics_data.append(metric_dict)
    
    return {
        "db_name": db_name,
        "metrics": metrics_data,
        "count": len(metrics_data)
    }

@router.get("/api/metrics/{db_name}/latest")
async def get_latest_metrics_api(db_name: str):
    """최신 메트릭 데이터 반환 (JSON)"""
    latest_metrics = metrics_collector.get_latest_metrics(db_name)
    
    if not latest_metrics:
        raise HTTPException(status_code=404, detail="No metrics found")
    
    return {
        "db_name": db_name,
        "timestamp": latest_metrics.timestamp.isoformat(),
        "active_connections": latest_metrics.active_connections,
        "total_connections": latest_metrics.total_connections,
        "queries_per_second": latest_metrics.queries_per_second,
        "slow_queries_count": latest_metrics.slow_queries_count,
        "disk_usage": latest_metrics.disk_usage,
        "uptime": latest_metrics.uptime,
        "version": latest_metrics.version
    }

@router.get("/api/schema/{db_name}")
async def get_database_schema(db_name: str):
    """데이터베이스 스키마 정보 반환 (JSON)"""
    databases = get_registered_databases()
    selected_db = next((db for db in databases if db["name"] == db_name), None)
    
    if not selected_db:
        raise HTTPException(status_code=404, detail="Database not found")
    
    try:
        # 데이터베이스 연결
        if selected_db["type"] == "postgresql":
            conn = psycopg2.connect(
                host=selected_db["host"],
                port=int(selected_db["port"]),
                user=selected_db["user"],
                password=selected_db["password"],
                database=selected_db["dbname"]
            )
            schema_info = get_postgresql_schema(conn)
        elif selected_db["type"] == "mysql":
            conn = mysql.connector.connect(
                host=selected_db["host"],
                port=int(selected_db["port"]),
                user=selected_db["user"],
                password=selected_db["password"],
                database=selected_db["dbname"]
            )
            schema_info = get_mysql_schema(conn)
        else:
            raise HTTPException(status_code=400, detail="Unsupported database type")
        
        conn.close()
        
        return {
            "status": "success",
            "db_name": db_name,
            "schema": schema_info
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get schema: {str(e)}")

@router.get("/api/query-history/{db_name}")
async def get_query_history(db_name: str, limit: int = 20):
    """DB 쿼리 히스토리/성능 정보 조회 (최신/느린/자주 실행된 쿼리 등)"""
    databases = get_registered_databases()
    selected_db = next((db for db in databases if db["name"] == db_name), None)
    if not selected_db:
        raise HTTPException(status_code=404, detail="Database not found")
    try:
        if selected_db["type"] == "postgresql":
            import psycopg2
            conn = psycopg2.connect(
                host=selected_db["host"],
                port=int(selected_db["port"]),
                user=selected_db["user"],
                password=selected_db["password"],
                database=selected_db["dbname"]
            )
            cur = conn.cursor()
            cur.execute("""
                SELECT query, calls, total_time, mean_time, rows, max_time, min_time
                  FROM pg_stat_statements
                 WHERE query NOT LIKE 'EXPLAIN%'
                 ORDER BY total_time DESC
                 LIMIT %s
            """, (limit,))
            rows = cur.fetchall() or []
            columns = [desc[0] for desc in cur.description] if cur.description else []
            data = [list(row) for row in rows]
            cur.close()
            conn.close()
            return {"status": "success", "db_type": "postgresql", "headers": columns, "data": data}
        elif selected_db["type"] == "mysql":
            import mysql.connector
            conn = mysql.connector.connect(
                host=selected_db["host"],
                port=int(selected_db["port"]),
                user=selected_db["user"],
                password=selected_db["password"],
                database=selected_db["dbname"]
            )
            cur = conn.cursor()
            cur.execute("""
                SELECT SQL_TEXT, COUNT_STAR, SUM_TIMER_WAIT/1000000000000 as total_time_s, SUM_ERRORS, SUM_ROWS_AFFECTED
                  FROM performance_schema.events_statements_summary_by_digest
                 ORDER BY total_time_s DESC
                 LIMIT %s
            """, (limit,))
            rows = cur.fetchall() or []
            columns = [desc[0] for desc in cur.description] if cur.description else []
            data = [list(row) for row in rows]
            cur.close()
            conn.close()
            return {"status": "success", "db_type": "mysql", "headers": columns, "data": data}
        else:
            raise HTTPException(status_code=400, detail="Unsupported database type")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get query history: {str(e)}")

@router.get("/api/query-insights/{db_name}")
async def get_query_insights(db_name: str, limit: int = 20):
    """CloudWatch 로그 + DB 자체 뷰 기반 쿼리 분석 통합 API (둘 중 하나만 있어도 동작)"""
    databases = get_registered_databases()
    selected_db = next((db for db in databases if db["name"] == db_name), None)
    if not selected_db:
        raise HTTPException(status_code=404, detail="Database not found")
    result = {"cloudwatch": None, "dbview": None, "source": []}

    # 1. CloudWatch 로그 기반 분석 시도
    try:
        import boto3
        import os
        log_group = selected_db.get("cloudwatch_log_group") or os.environ.get("CLOUDWATCH_LOG_GROUP")
        if log_group:
            client = boto3.client('logs')
            # 최근 duration: 로그만 필터링 (PostgreSQL 예시)
            response = client.filter_log_events(
                logGroupName=log_group,
                filterPattern='duration:',
                limit=limit
            )
            events = response.get('events', [])
            # duration: 123.45 ms  statement: SELECT ...
            import re
            rows = []
            for e in events:
                m = re.search(r'duration: ([0-9.]+) ms\s+statement: (.*)', e['message'])
                if m:
                    rows.append([float(m.group(1)), m.group(2)])
            if rows:
                result["cloudwatch"] = {
                    "headers": ["duration_ms", "query"],
                    "data": rows
                }
                result["source"].append("cloudwatch")
    except Exception as e:
        # CloudWatch 실패해도 무시
        pass

    # 2. DB 자체 뷰 기반 분석 시도 (기존 쿼리 히스토리 로직 활용)
    try:
        dbview = None
        if selected_db["type"] == "postgresql":
            import psycopg2
            conn = psycopg2.connect(
                host=selected_db["host"],
                port=int(selected_db["port"]),
                user=selected_db["user"],
                password=selected_db["password"],
                database=selected_db["dbname"]
            )
            cur = conn.cursor()
            cur.execute("""
                SELECT query, calls, total_time, mean_time, rows, max_time, min_time
                  FROM pg_stat_statements
                 WHERE query NOT LIKE 'EXPLAIN%'
                 ORDER BY total_time DESC
                 LIMIT %s
            """, (limit,))
            rows = cur.fetchall() or []
            columns = [desc[0] for desc in cur.description] if cur.description else []
            data = [list(row) for row in rows]
            cur.close()
            conn.close()
            if data:
                dbview = {"headers": columns, "data": data}
        elif selected_db["type"] == "mysql":
            import mysql.connector
            conn = mysql.connector.connect(
                host=selected_db["host"],
                port=int(selected_db["port"]),
                user=selected_db["user"],
                password=selected_db["password"],
                database=selected_db["dbname"]
            )
            cur = conn.cursor()
            cur.execute("""
                SELECT SQL_TEXT, COUNT_STAR, SUM_TIMER_WAIT/1000000000000 as total_time_s, SUM_ERRORS, SUM_ROWS_AFFECTED
                  FROM performance_schema.events_statements_summary_by_digest
                 ORDER BY total_time_s DESC
                 LIMIT %s
            """, (limit,))
            rows = cur.fetchall() or []
            columns = [desc[0] for desc in cur.description] if cur.description else []
            data = [list(row) for row in rows]
            cur.close()
            conn.close()
            if data:
                dbview = {"headers": columns, "data": data}
        if dbview:
            result["dbview"] = dbview
            result["source"].append("dbview")
    except Exception as e:
        # DB 뷰 실패해도 무시
        pass

    if not result["cloudwatch"] and not result["dbview"]:
        raise HTTPException(status_code=404, detail="No query insights available (CloudWatch/DBview 모두 실패)")
    return result

def get_postgresql_schema(conn):
    """PostgreSQL 스키마 정보 추출"""
    cursor = conn.cursor()
    schema_info = {
        "tables": [],
        "relationships": []
    }
    
    try:
        # 테이블 목록 조회
        cursor.execute("""
            SELECT 
                t.table_name,
                t.table_type,
                obj_description(c.oid) as table_comment
            FROM information_schema.tables t
            JOIN pg_class c ON c.relname = t.table_name
            WHERE t.table_schema = 'public'
            AND t.table_type = 'BASE TABLE'
            ORDER BY t.table_name
        """)
        
        tables = cursor.fetchall()
        
        for table in tables:
            table_name = table[0]
            table_comment = table[2] or ""
            
            # 컬럼 정보 조회
            cursor.execute("""
                SELECT 
                    c.column_name,
                    c.data_type,
                    c.is_nullable,
                    c.column_default,
                    c.character_maximum_length,
                    c.numeric_precision,
                    c.numeric_scale,
                    col_description(a.attrelid, a.attnum) as column_comment
                FROM information_schema.columns c
                JOIN pg_attribute a ON a.attname = c.column_name
                JOIN pg_class pc ON pc.oid = a.attrelid
                WHERE c.table_name = %s
                AND c.table_schema = 'public'
                ORDER BY c.ordinal_position
            """, (table_name,))
            
            columns = []
            for col in cursor.fetchall():
                column_info = {
                    "name": col[0],
                    "type": col[1],
                    "nullable": col[2] == "YES",
                    "default": col[3],
                    "max_length": col[4],
                    "precision": col[5],
                    "scale": col[6],
                    "comment": col[7] or ""
                }
                columns.append(column_info)
            
            # 인덱스 정보 조회
            cursor.execute("""
                SELECT 
                    i.relname as index_name,
                    array_to_string(array_agg(a.attname), ', ') as column_names,
                    ix.indisunique as is_unique,
                    ix.indisprimary as is_primary
                FROM pg_class t
                JOIN pg_index ix ON t.oid = ix.indrelid
                JOIN pg_class i ON ix.indexrelid = i.oid
                JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = ANY(ix.indkey)
                WHERE t.relname = %s
                GROUP BY i.relname, ix.indisunique, ix.indisprimary
                ORDER BY i.relname
            """, (table_name,))
            
            indexes = []
            for idx in cursor.fetchall():
                index_info = {
                    "name": idx[0],
                    "columns": idx[1].split(", "),
                    "unique": idx[2],
                    "primary": idx[3]
                }
                indexes.append(index_info)
            
            table_info = {
                "name": table_name,
                "comment": table_comment,
                "columns": columns,
                "indexes": indexes
            }
            schema_info["tables"].append(table_info)
        
        # 외래키 관계 조회
        cursor.execute("""
            SELECT 
                tc.table_name,
                kcu.column_name,
                ccu.table_name AS foreign_table_name,
                ccu.column_name AS foreign_column_name,
                tc.constraint_name
            FROM information_schema.table_constraints AS tc
            JOIN information_schema.key_column_usage AS kcu
                ON tc.constraint_name = kcu.constraint_name
                AND tc.table_schema = kcu.table_schema
            JOIN information_schema.constraint_column_usage AS ccu
                ON ccu.constraint_name = tc.constraint_name
                AND ccu.table_schema = tc.table_schema
            WHERE tc.constraint_type = 'FOREIGN KEY'
            AND tc.table_schema = 'public'
        """)
        
        relationships = cursor.fetchall()
        for rel in relationships:
            relationship_info = {
                "table": rel[0],
                "column": rel[1],
                "foreign_table": rel[2],
                "foreign_column": rel[3],
                "constraint_name": rel[4]
            }
            schema_info["relationships"].append(relationship_info)
        
    finally:
        cursor.close()
    
    return schema_info

def get_mysql_schema(conn):
    """MySQL 스키마 정보 추출"""
    cursor = conn.cursor()
    schema_info = {
        "tables": [],
        "relationships": []
    }
    
    try:
        # 테이블 목록 조회
        cursor.execute("""
            SELECT 
                TABLE_NAME,
                TABLE_COMMENT
            FROM information_schema.TABLES 
            WHERE TABLE_SCHEMA = DATABASE()
            AND TABLE_TYPE = 'BASE TABLE'
            ORDER BY TABLE_NAME
        """)
        
        tables = cursor.fetchall()
        
        for table in tables:
            table_name = table[0]
            table_comment = table[1] or ""
            
            # 컬럼 정보 조회
            cursor.execute("""
                SELECT 
                    COLUMN_NAME,
                    DATA_TYPE,
                    IS_NULLABLE,
                    COLUMN_DEFAULT,
                    CHARACTER_MAXIMUM_LENGTH,
                    NUMERIC_PRECISION,
                    NUMERIC_SCALE,
                    COLUMN_COMMENT
                FROM information_schema.COLUMNS
                WHERE TABLE_SCHEMA = DATABASE()
                AND TABLE_NAME = %s
                ORDER BY ORDINAL_POSITION
            """, (table_name,))
            
            columns = []
            for col in cursor.fetchall():
                column_info = {
                    "name": col[0],
                    "type": col[1],
                    "nullable": col[2] == "YES",
                    "default": col[3],
                    "max_length": col[4],
                    "precision": col[5],
                    "scale": col[6],
                    "comment": col[7] or ""
                }
                columns.append(column_info)
            
            # 인덱스 정보 조회
            cursor.execute("""
                SELECT 
                    INDEX_NAME,
                    GROUP_CONCAT(COLUMN_NAME ORDER BY SEQ_IN_INDEX) as column_names,
                    NON_UNIQUE,
                    INDEX_TYPE
                FROM information_schema.STATISTICS
                WHERE TABLE_SCHEMA = DATABASE()
                AND TABLE_NAME = %s
                GROUP BY INDEX_NAME, NON_UNIQUE, INDEX_TYPE
                ORDER BY INDEX_NAME
            """, (table_name,))
            
            indexes = []
            for idx in cursor.fetchall():
                index_info = {
                    "name": idx[0],
                    "columns": idx[1].split(","),
                    "unique": idx[2] == 0,
                    "type": idx[3]
                }
                indexes.append(index_info)
            
            table_info = {
                "name": table_name,
                "comment": table_comment,
                "columns": columns,
                "indexes": indexes
            }
            schema_info["tables"].append(table_info)
        
        # 외래키 관계 조회
        cursor.execute("""
            SELECT 
                TABLE_NAME,
                COLUMN_NAME,
                REFERENCED_TABLE_NAME,
                REFERENCED_COLUMN_NAME,
                CONSTRAINT_NAME
            FROM information_schema.KEY_COLUMN_USAGE
            WHERE TABLE_SCHEMA = DATABASE()
            AND REFERENCED_TABLE_NAME IS NOT NULL
        """)
        
        relationships = cursor.fetchall()
        for rel in relationships:
            relationship_info = {
                "table": rel[0],
                "column": rel[1],
                "foreign_table": rel[2],
                "foreign_column": rel[3],
                "constraint_name": rel[4]
            }
            schema_info["relationships"].append(relationship_info)
        
    finally:
        cursor.close()
    
    return schema_info

# ================= CloudWatch 기반 모니터링 API =================
from fastapi import HTTPException

@router.get("/api/monitoring/cloudwatch/metrics/{db_identifier}")
async def get_cloudwatch_metrics(
    db_identifier: str, 
    metric_name: str = "DatabaseConnections",
    period: int = 300,  # 5분
    stat: str = "Average",
    hours: int = 24
):
    """CloudWatch에서 RDS 메트릭 데이터 조회 (인스턴스/클러스터 자동 판별)"""
    try:
        aws_integration = AWSIntegration()
        import psycopg2
        from backend.config import DB_HOST, DB_PORT, DB_USER, DB_PASSWORD, DB_NAME
        conn = psycopg2.connect(
            host=DB_HOST,
            port=DB_PORT,
            user=DB_USER,
            password=DB_PASSWORD,
            dbname=DB_NAME
        )
        session = aws_integration.get_boto3_session_from_connection(conn)
        cloudwatch = session.client('cloudwatch')
        from datetime import datetime, timedelta
        end_time = datetime.utcnow()
        start_time = end_time - timedelta(hours=hours)
        # 클러스터/인스턴스 자동 판별
        if any(x in db_identifier.lower() for x in ["cluster", "aurora"]):
            dimension_name = "DBClusterIdentifier"
        else:
            dimension_name = "DBInstanceIdentifier"
        response = cloudwatch.get_metric_statistics(
            Namespace='AWS/RDS',
            MetricName=metric_name,
            Dimensions=[{'Name': dimension_name, 'Value': db_identifier}],
            StartTime=start_time,
            EndTime=end_time,
            Period=period,
            Statistics=[stat]
        )
        datapoints = response.get('Datapoints', [])
        formatted_data = []
        for point in datapoints:
            formatted_data.append({
                'timestamp': point['Timestamp'].isoformat(),
                'value': point[stat],
                'unit': point.get('Unit', 'Count')
            })
        formatted_data.sort(key=lambda x: x['timestamp'])
        return {
            "status": "success",
            "db_identifier": db_identifier,
            "metric_name": metric_name,
            "period": period,
            "stat": stat,
            "hours": hours,
            "data": formatted_data,
            "count": len(formatted_data)
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"CloudWatch 메트릭 조회 실패: {str(e)}")

@router.get("/api/monitoring/cloudwatch/rds-info/{db_identifier}")
async def get_rds_instance_info(db_identifier: str):
    """RDS 인스턴스 정보 조회 (최대 커넥션 수 등)"""
    try:
        aws_integration = AWSIntegration()
        import psycopg2
        from backend.config import DB_HOST, DB_PORT, DB_USER, DB_PASSWORD, DB_NAME
        conn = psycopg2.connect(
            host=DB_HOST,
            port=DB_PORT,
            user=DB_USER,
            password=DB_PASSWORD,
            dbname=DB_NAME
        )
        session = aws_integration.get_boto3_session_from_connection(conn)
        rds = session.client('rds')
        response = rds.describe_db_instances(DBInstanceIdentifier=db_identifier)
        instance = response['DBInstances'][0]
        instance_type = instance['DBInstanceClass']
        max_connections = get_max_connections_by_instance_type(instance_type)
        parameter_group = instance.get('DBParameterGroups', [{}])[0].get('DBParameterGroupName')
        if parameter_group:
            try:
                param_response = rds.describe_db_parameters(
                    DBParameterGroupName=parameter_group,
                    Source='user'
                )
                for param in param_response['Parameters']:
                    if param['ParameterName'] == 'max_connections':
                        max_connections = int(param['ParameterValue'])
                        break
            except:
                pass
        return {
            "status": "success",
            "db_identifier": db_identifier,
            "instance_info": {
                "instance_class": instance_type,
                "engine": instance['Engine'],
                "engine_version": instance['EngineVersion'],
                "endpoint": instance['Endpoint']['Address'],
                "port": instance['Endpoint']['Port'],
                "status": instance['DBInstanceStatus'],
                "storage_type": instance['StorageType'],
                "allocated_storage": instance['AllocatedStorage'],
                "max_connections": max_connections,
                "availability_zone": instance['AvailabilityZone'],
                "multi_az": instance.get('MultiAZ', False)
            }
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"RDS 정보 조회 실패: {str(e)}")

@router.get("/api/monitoring/cloudwatch/available-metrics")
async def get_available_cloudwatch_metrics():
    """사용 가능한 CloudWatch 메트릭 목록"""
    return {
        "status": "success",
        "metrics": [
            {"name": "DatabaseConnections", "description": "활성 데이터베이스 연결 수", "unit": "Count", "namespace": "AWS/RDS"},
            {"name": "CPUUtilization", "description": "CPU 사용률", "unit": "Percent", "namespace": "AWS/RDS"},
            {"name": "FreeableMemory", "description": "사용 가능한 메모리", "unit": "Bytes", "namespace": "AWS/RDS"},
            {"name": "FreeStorageSpace", "description": "사용 가능한 스토리지 공간", "unit": "Bytes", "namespace": "AWS/RDS"},
            {"name": "ReadIOPS", "description": "읽기 IOPS", "unit": "Count/Second", "namespace": "AWS/RDS"},
            {"name": "WriteIOPS", "description": "쓰기 IOPS", "unit": "Count/Second", "namespace": "AWS/RDS"},
            {"name": "ReadLatency", "description": "읽기 지연시간", "unit": "Seconds", "namespace": "AWS/RDS"},
            {"name": "WriteLatency", "description": "쓰기 지연시간", "unit": "Seconds", "namespace": "AWS/RDS"},
            {"name": "NetworkReceiveThroughput", "description": "네트워크 수신 처리량", "unit": "Bytes/Second", "namespace": "AWS/RDS"},
            {"name": "NetworkTransmitThroughput", "description": "네트워크 송신 처리량", "unit": "Bytes/Second", "namespace": "AWS/RDS"}
        ]
    }

def get_max_connections_by_instance_type(instance_type: str) -> int:
    """인스턴스 타입별 최대 커넥션 수 반환 (표준값)"""
    max_connections_map = {
        'db.t3.micro': 66,
        'db.t3.small': 150,
        'db.t3.medium': 150,
        'db.t3.large': 150,
        'db.r5.large': 150,
        'db.r5.xlarge': 150,
        'db.r5.2xlarge': 150,
        'db.r5.4xlarge': 150,
        'db.r5.8xlarge': 150,
        'db.r5.12xlarge': 150,
        'db.r5.16xlarge': 150,
        'db.r5.24xlarge': 150,
        'db.m5.large': 150,
        'db.m5.xlarge': 150,
        'db.m5.2xlarge': 150,
        'db.m5.4xlarge': 150,
        'db.m5.8xlarge': 150,
        'db.m5.12xlarge': 150,
        'db.m5.16xlarge': 150,
        'db.m5.24xlarge': 150,
        'db.m6g.large': 150,
        'db.m6g.xlarge': 150,
        'db.m6g.2xlarge': 150,
        'db.m6g.4xlarge': 150,
        'db.m6g.8xlarge': 150,
        'db.m6g.12xlarge': 150,
        'db.m6g.16xlarge': 150
    }
    return max_connections_map.get(instance_type, 150)  # 기본값 150