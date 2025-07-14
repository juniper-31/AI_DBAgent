import boto3
from typing import Optional, List, Dict
import re
from datetime import datetime, timedelta
from sqlalchemy.orm import Session
from backend.models.database import AwsCredentials
from fastapi import HTTPException

class AWSIntegration:
    def __init__(self):
        # The state is now managed in the database, not in the instance.
        pass

    def set_credentials(self, auth_type: str, access_key: Optional[str] = None, secret_key: Optional[str] = None, session_token: Optional[str] = None, region: Optional[str] = None, role_arn: Optional[str] = None, external_id: Optional[str] = None):
        # This method is now deprecated and will not be used.
        # We keep it for now to avoid breaking other parts of the code immediately,
        # but the logic is moving to get_boto3_session.
        pass

    def get_boto3_session(self, db: Session) -> boto3.Session:
        """
        Creates a boto3 session using the active AWS credentials stored in the database.
        """
        active_cred = db.query(AwsCredentials).filter(AwsCredentials.is_active == True).first()

        if not active_cred:
            raise HTTPException(status_code=401, detail="No active AWS credential found. Please configure and activate one.")

        if not active_cred.access_key or not active_cred.secret_key:
            raise HTTPException(status_code=400, detail="The active AWS credential is incomplete (missing access key or secret key).")

        # For now, we only support access key authentication.
        # The logic for assume_role etc. can be re-added here if needed.
        session = boto3.Session(
            aws_access_key_id=active_cred.access_key,
            aws_secret_access_key=active_cred.secret_key,
            aws_session_token=active_cred.session_token,  # This can be None
            region_name=active_cred.region
        )
        return session

    def list_rds_instances(self, db: Session) -> dict:
        session = self.get_boto3_session(db)
        rds = session.client('rds')
        # 인스턴스 정보
        instances = rds.describe_db_instances().get('DBInstances', [])
        # 클러스터 정보 (Aurora 등)
        clusters = []
        try:
            cluster_resp = rds.describe_db_clusters()
            for c in cluster_resp.get('DBClusters', []):
                # 하위 인스턴스 매칭
                instance_ids = c.get('DBClusterMembers', [])
                instance_id_list = [m['DBInstanceIdentifier'] for m in instance_ids]
                child_instances = [inst for inst in instances if inst['DBInstanceIdentifier'] in instance_id_list]
                clusters.append({
                    'DBClusterIdentifier': c.get('DBClusterIdentifier'),
                    'Engine': c.get('Engine'),
                    'Endpoint': c.get('Endpoint'),
                    'ReaderEndpoint': c.get('ReaderEndpoint'),
                    'instances': child_instances
                })
        except Exception as e:
            # Aurora가 없으면 describe_db_clusters에서 오류가 날 수 있음
            pass
        return {'instances': instances, 'clusters': clusters}

    def get_cloudwatch_metrics(self, db: Session, db_identifier: str, metric_name: str, period: int = 60, stat: str = 'Average', minutes: int = 10) -> List[Dict]:
        session = self.get_boto3_session(db)
        cloudwatch = session.client('cloudwatch')
        end_time = datetime.utcnow()
        start_time = end_time - timedelta(minutes=minutes)
        response = cloudwatch.get_metric_statistics(
            Namespace='AWS/RDS',
            MetricName=metric_name,
            Dimensions=[{'Name': 'DBInstanceIdentifier', 'Value': db_identifier}],
            StartTime=start_time,
            EndTime=end_time,
            Period=period,
            Statistics=[stat]
        )
        return response.get('Datapoints', [])

    # CloudWatch Logs 관련 메서드들 추가
    def list_rds_log_groups(self, db: Session, db_identifier: str) -> List[Dict]:
        """RDS 인스턴스 또는 클러스터의 로그 그룹 목록 조회 (CloudWatch)"""
        session = self.get_boto3_session(db)
        logs = session.client('logs')
        
        # 인스턴스/클러스터 패턴 모두 시도
        prefixes = [
            f"/aws/rds/instance/{db_identifier}/",
            f"/aws/rds/cluster/{db_identifier}/"
        ]
        found_groups = []
        try:
            for prefix in prefixes:
                response = logs.describe_log_groups(
                    logGroupNamePrefix=prefix
                )
                found_groups.extend(response.get('logGroups', []))
            return found_groups
        except Exception as e:
            print(f"Error listing log groups: {e}")
            return []

    def list_log_streams(self, db: Session, log_group_name: str, hours: int = 24) -> List[Dict]:
        """로그 그룹의 스트림 목록 조회"""
        session = self.get_boto3_session(db)
        logs = session.client('logs')
        
        # 최근 시간 범위 계산
        end_time = int(datetime.now().timestamp() * 1000)
        start_time = int((datetime.now() - timedelta(hours=hours)).timestamp() * 1000)
        
        try:
            response = logs.describe_log_streams(
                logGroupName=log_group_name,
                orderBy='LastEventTime',
                descending=True,
                maxItems=50
            )
            return response.get('logStreams', [])
        except Exception as e:
            print(f"Error listing log streams: {e}")
            return []

    def get_log_events(self, db: Session, log_group_name: str, log_stream_name: str, hours: int = 24) -> List[Dict]:
        """로그 스트림의 이벤트 조회"""
        session = self.get_boto3_session(db)
        logs = session.client('logs')
        
        # 최근 시간 범위 계산
        end_time = int(datetime.now().timestamp() * 1000)
        start_time = int((datetime.now() - timedelta(hours=hours)).timestamp() * 1000)
        
        try:
            response = logs.get_log_events(
                logGroupName=log_group_name,
                logStreamName=log_stream_name,
                startTime=start_time,
                endTime=end_time,
                startFromHead=False
            )
            return response.get('events', [])
        except Exception as e:
            print(f"Error getting log events: {e}")
            return []

    def parse_slow_query_log(self, log_events: List[Dict]) -> List[Dict]:
        """PostgreSQL 슬로우 쿼리 로그 파싱 (duration만 있는 로그도 포함)"""
        slow_queries = []
        # 기존 패턴 + duration만 있는 로그도 인식
        patterns = [
            # duration + statement
            r'duration: ([\d\.]+) ms\s+statement: (.+?)(?=\n\d{4}-\d{2}-\d{2}|\n$|$)',
            r'(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2} UTC.*?duration: ([\d\.]+) ms.*?statement: (.+?)(?=\n\d{4}-\d{2}-\d{2}|\n$|$))',
            r'duration: ([\d\.]+) ms.*?statement: (.+?)(?=\n\d{4}-\d{2}-\d{2}|\n$|$)',
            # duration만 있는 로그
            r'duration: ([\d\.]+) ms'
        ]
        for event in log_events:
            message = event.get('message', '')
            timestamp = event.get('timestamp', 0)
            matched = False
            for i, pattern in enumerate(patterns):
                matches = re.finditer(pattern, message, re.DOTALL | re.IGNORECASE)
                for match in matches:
                    try:
                        if i < 3:  # statement 있는 패턴
                            if len(match.groups()) == 2:
                                duration = float(match.group(1))
                                query = match.group(2).strip()
                            elif len(match.groups()) == 3:
                                duration = float(match.group(2))
                                query = match.group(3).strip()
                            else:
                                continue
                        else:  # duration만 있는 패턴
                            duration = float(match.group(1))
                            query = '(쿼리문 없음)'
                        if duration >= 1000:  # 1초 이상만 슬로우 쿼리
                            slow_queries.append({
                                'timestamp': timestamp,
                                'duration': duration,
                                'query': query,
                                'duration_seconds': duration / 1000.0,
                                'datetime': datetime.fromtimestamp(timestamp / 1000).strftime('%Y-%m-%d %H:%M:%S') if timestamp else ''
                            })
                        matched = True
                    except (ValueError, IndexError) as e:
                        print(f"Error parsing log entry: {e}")
                        continue
                if matched:
                    break
        slow_queries.sort(key=lambda x: x['duration'], reverse=True)
        return slow_queries

    def analyze_slow_queries(self, slow_queries: List[Dict]) -> Dict:
        """슬로우 쿼리 분석 통계"""
        if not slow_queries:
            return {
                'total_count': 0,
                'avg_duration': 0,
                'max_duration': 0,
                'min_duration': 0,
                'total_duration': 0,
                'duration_distribution': {},
                'top_queries': []
            }
        
        durations = [q['duration'] for q in slow_queries]
        total_duration = sum(durations)
        
        # duration 분포 (1초, 5초, 10초, 30초, 1분, 5분 이상)
        distribution = {
            '1-5s': len([d for d in durations if 1000 <= d < 5000]),
            '5-10s': len([d for d in durations if 5000 <= d < 10000]),
            '10-30s': len([d for d in durations if 10000 <= d < 30000]),
            '30s-1m': len([d for d in durations if 30000 <= d < 60000]),
            '1-5m': len([d for d in durations if 60000 <= d < 300000]),
            '5m+': len([d for d in durations if d >= 300000])
        }
        
        return {
            'total_count': len(slow_queries),
            'avg_duration': total_duration / len(slow_queries),
            'max_duration': max(durations),
            'min_duration': min(durations),
            'total_duration': total_duration,
            'duration_distribution': distribution,
            'top_queries': slow_queries[:10]  # 상위 10개 쿼리
        }

    def list_rds_log_files(self, db: Session, db_identifier: str, pattern: str = 'postgresql.log') -> list:
        """RDS 인스턴스의 로그 파일 목록 조회 (RDS API)"""
        session = self.get_boto3_session(db)
        rds = session.client('rds')
        try:
            response = rds.describe_db_log_files(
                DBInstanceIdentifier=db_identifier,
                FilenameContains=pattern
            )
            return response.get('DescribeDBLogFiles', [])
        except Exception as e:
            print(f"Error listing RDS log files: {e}")
            return []

    def download_rds_log_file(self, db: Session, db_identifier: str, log_file_name: str, max_bytes: int = 1048576) -> str:
        """RDS 인스턴스의 로그 파일 일부 다운로드 (최대 1MB, 필요시 반복 호출)"""

    def get_boto3_session_from_connection(self, conn) -> boto3.Session:
        """PostgreSQL 연결을 통해 AWS 세션 생성 (임시 방법)"""
        try:
            # 데이터베이스에서 활성 AWS 인증 정보 조회
            cur = conn.cursor()
            cur.execute("""
                SELECT access_key, secret_key, session_token, region 
                FROM aws_credentials 
                WHERE is_active = true 
                LIMIT 1
            """)
            result = cur.fetchone()
            
            if not result:
                raise HTTPException(status_code=401, detail="활성 AWS 인증 정보가 없습니다.")
            
            access_key, secret_key, session_token, region = result
            
            if not access_key or not secret_key:
                raise HTTPException(status_code=400, detail="AWS 인증 정보가 불완전합니다.")
            
            session = boto3.Session(
                aws_access_key_id=access_key,
                aws_secret_access_key=secret_key,
                aws_session_token=session_token,
                region_name=region
            )
            return session
            
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"AWS 세션 생성 실패: {str(e)}")
        session = self.get_boto3_session(db)
        rds = session.client('rds')
        marker = '0'
        content = ''
        try:
            while True:
                response = rds.download_db_log_file_portion(
                    DBInstanceIdentifier=db_identifier,
                    LogFileName=log_file_name,
                    Marker=marker,
                    NumberOfLines=1000
                )
                content += response.get('LogFileData', '')
                if not response.get('AdditionalDataPending'):
                    break
                marker = response.get('Marker')
                if len(content) > max_bytes:
                    break
            return content
        except Exception as e:
            print(f"Error downloading RDS log file: {e}")
            return ''

aws_integration = AWSIntegration()
 