from fastapi import APIRouter, Request, Form, HTTPException, Body, Depends
from fastapi.responses import JSONResponse
from typing import Dict, Any, List
import json
import boto3
from datetime import datetime, timedelta
from backend.integrations.aws import aws_integration
from backend.models.database import SessionLocal, AwsCredentials
from sqlalchemy.orm import Session

router = APIRouter()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

@router.post('/aws/auth/test')
async def test_aws_credentials(payload: dict = Body(...)):
    try:
        auth_type = payload.get('authType', 'access_key')
        
        if auth_type == 'iam_role':
            # IAM Role 방식 테스트
            session = boto3.Session(region_name=payload.get('region'))
        else:
            # Access Key 방식 테스트
            session = boto3.Session(
                aws_access_key_id=payload.get('accessKey'),
                aws_secret_access_key=payload.get('secretKey'),
                aws_session_token=payload.get('sessionToken'),
                region_name=payload.get('region')
            )
        
        sts = session.client('sts')
        identity = sts.get_caller_identity()
        return {"success": True, "identity": identity}
    except Exception as e:
        return {"success": False, "message": str(e)}

@router.get('/aws/rds-instances')
async def list_rds_instances(db: Session = Depends(get_db)):
    try:
        result = aws_integration.list_rds_instances(db)
        return result  # {'instances': [...], 'clusters': [...]}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get('/aws/rds-metrics')
async def get_rds_metrics(db_identifier: str, metric_name: str, period: int = 60, stat: str = 'Average', minutes: int = 10, db: Session = Depends(get_db)):
    try:
        datapoints = aws_integration.get_cloudwatch_metrics(db, db_identifier, metric_name, period, stat, minutes)
        return {"datapoints": datapoints}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# CloudWatch Logs 관련 API 엔드포인트들 추가
@router.get('/aws/rds-log-groups')
async def list_rds_log_groups(db_identifier: str, db: Session = Depends(get_db)):
    """RDS 인스턴스의 로그 그룹 목록 조회"""
    try:
        log_groups = aws_integration.list_rds_log_groups(db, db_identifier)
        return {"log_groups": log_groups}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get('/aws/log-streams')
async def list_log_streams(log_group_name: str, hours: int = 24, db: Session = Depends(get_db)):
    """로그 그룹의 스트림 목록 조회"""
    try:
        streams = aws_integration.list_log_streams(db, log_group_name, hours)
        return {"streams": streams}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get('/aws/log-events')
async def get_log_events(log_group_name: str, log_stream_name: str, hours: int = 24, db: Session = Depends(get_db)):
    """로그 스트림의 이벤트 조회"""
    try:
        events = aws_integration.get_log_events(db, log_group_name, log_stream_name, hours)
        return {"events": events}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get('/aws/slow-queries')
async def analyze_slow_queries(db_identifier: str, hours: int = 24, db: Session = Depends(get_db)):
    """RDS 인스턴스의 슬로우 쿼리 분석"""
    try:
        # 1. 로그 그룹 조회
        log_groups = aws_integration.list_rds_log_groups(db, db_identifier)
        
        all_slow_queries = []
        
        for log_group in log_groups:
            log_group_name = log_group['logGroupName']
            
            # 2. 로그 스트림 조회
            streams = aws_integration.list_log_streams(db, log_group_name, hours)
            
            for stream in streams:
                stream_name = stream['logStreamName']
                
                # 3. 로그 이벤트 조회
                events = aws_integration.get_log_events(db, log_group_name, stream_name, hours)
                
                # 4. 슬로우 쿼리 파싱
                slow_queries = aws_integration.parse_slow_query_log(events)
                all_slow_queries.extend(slow_queries)
        
        # 5. 전체 분석
        analysis = aws_integration.analyze_slow_queries(all_slow_queries)
        
        return {
            "db_identifier": db_identifier,
            "hours": hours,
            "slow_queries": all_slow_queries,
            "analysis": analysis,
            "log_groups_count": len(log_groups)
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get('/aws/slow-queries/summary')
async def get_slow_queries_summary(db_identifier: str, hours: int = 24, db: Session = Depends(get_db)):
    """슬로우 쿼리 요약 정보만 조회 (빠른 조회용)"""
    try:
        # 간단한 요약만 반환
        log_groups = aws_integration.list_rds_log_groups(db, db_identifier)
        
        total_events = 0
        total_slow_queries = 0
        
        for log_group in log_groups[:3]:  # 최근 3개 로그 그룹만
            log_group_name = log_group['logGroupName']
            streams = aws_integration.list_log_streams(db, log_group_name, hours)
            
            for stream in streams[:5]:  # 최근 5개 스트림만
                stream_name = stream['logStreamName']
                events = aws_integration.get_log_events(db, log_group_name, stream_name, hours)
                total_events += len(events)
                
                slow_queries = aws_integration.parse_slow_query_log(events)
                total_slow_queries += len(slow_queries)
        
        return {
            "db_identifier": db_identifier,
            "hours": hours,
            "total_events": total_events,
            "total_slow_queries": total_slow_queries,
            "log_groups_count": len(log_groups)
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get('/aws/rds-log-files')
async def list_rds_log_files(db_identifier: str, pattern: str = 'postgresql.log', db: Session = Depends(get_db)):
    """RDS 인스턴스의 로그 파일 목록 조회 (RDS API)"""
    try:
        files = aws_integration.list_rds_log_files(db, db_identifier, pattern)
        return {"log_files": files}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get('/aws/rds-log-file-content')
async def get_rds_log_file_content(db_identifier: str, log_file_name: str, max_bytes: int = 1048576, db: Session = Depends(get_db)):
    """RDS 인스턴스의 로그 파일 일부 다운로드 (RDS API)"""
    try:
        content = aws_integration.download_rds_log_file(db, db_identifier, log_file_name, max_bytes)
        return {"content": content}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get('/aws/rds-log-file-slow-queries')
async def analyze_rds_log_file_slow_queries(db_identifier: str, log_file_name: str, max_bytes: int = 1048576, db: Session = Depends(get_db)):
    """RDS 인스턴스의 로그 파일에서 슬로우 쿼리 분석 (RDS API)"""
    try:
        content = aws_integration.download_rds_log_file(db, db_identifier, log_file_name, max_bytes)
        # 로그 파일을 이벤트 리스트처럼 분할 (줄 단위)
        log_events = [{"message": line, "timestamp": 0} for line in content.splitlines() if line.strip()]
        slow_queries = aws_integration.parse_slow_query_log(log_events)
        analysis = aws_integration.analyze_slow_queries(slow_queries)
        return {
            "db_identifier": db_identifier,
            "log_file_name": log_file_name,
            "slow_queries": slow_queries,
            "analysis": analysis,
            "log_length": len(content)
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get('/aws/credentials')
async def list_aws_credentials(db: Session = Depends(get_db)):
    creds = db.query(AwsCredentials).all()
    return [
        {
            'id': c.id,
            'name': c.name,
            'auth_type': c.auth_type,
            'access_key': c.access_key if c.auth_type == 'access_key' else None,
            'region': c.region,
            'is_active': c.is_active,
            'created_at': str(c.created_at),
            'updated_at': str(c.updated_at)
        } for c in creds
    ]

@router.post('/aws/credentials')
async def add_aws_credentials(payload: dict = Body(...), db: Session = Depends(get_db)):
    # is_active가 true면 기존 것들 모두 false로
    if payload.get('is_active'):
        db.query(AwsCredentials).update({AwsCredentials.is_active: False})
    
    auth_type = payload.get('auth_type', 'access_key')
    
    # IAM Role 방식일 때는 access_key, secret_key를 null로 설정
    if auth_type == 'iam_role':
        cred = AwsCredentials(
            name=payload.get('name'),
            auth_type=auth_type,
            access_key=None,
            secret_key=None,
            session_token=payload.get('session_token'),
            region=payload.get('region'),
            is_active=payload.get('is_active', False)
        )
    else:
        # Access Key 방식
        cred = AwsCredentials(
            name=payload.get('name'),
            auth_type=auth_type,
            access_key=payload.get('access_key'),
            secret_key=payload.get('secret_key'),
            session_token=payload.get('session_token'),
            region=payload.get('region'),
            is_active=payload.get('is_active', False)
        )
    
    db.add(cred)
    db.commit()
    db.refresh(cred)
    return {'success': True, 'id': cred.id}

@router.delete('/aws/credentials/{cred_id}')
async def delete_aws_credentials(cred_id: int, db: Session = Depends(get_db)):
    cred = db.query(AwsCredentials).filter(AwsCredentials.id == cred_id).first()
    if not cred:
        raise HTTPException(status_code=404, detail='Not found')
    db.delete(cred)
    db.commit()
    return {'success': True}

@router.post('/aws/credentials/{cred_id}/activate')
async def activate_aws_credentials(cred_id: int, db: Session = Depends(get_db)):
    db.query(AwsCredentials).update({AwsCredentials.is_active: False})
    cred = db.query(AwsCredentials).filter(AwsCredentials.id == cred_id).first()
    if not cred:
        raise HTTPException(status_code=404, detail='Not found')
    cred.is_active = True
    db.commit()
    return {'success': True} 