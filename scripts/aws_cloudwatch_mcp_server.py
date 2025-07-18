#!/usr/bin/env python3
"""
AWS CloudWatch Logs MCP Server
RDS/Aurora의 slow log, error log 등을 CloudWatch에서 가져오는 MCP 서버
"""

import boto3
import json
import os
import sys
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Any
import time

class CloudWatchLogsMCPServer:
    def __init__(self):
        self.region = os.getenv('AWS_DEFAULT_REGION', 'ap-northeast-2')
        self.access_key = os.getenv('AWS_ACCESS_KEY_ID')
        self.secret_key = os.getenv('AWS_SECRET_ACCESS_KEY')
        self.session_token = os.getenv('AWS_SESSION_TOKEN')
        
        # AWS 클라이언트 초기화
        self.setup_aws_clients()
    
    def setup_aws_clients(self):
        """AWS 클라이언트 설정"""
        try:
            session_kwargs = {'region_name': self.region}
            
            if self.access_key and self.secret_key:
                session_kwargs.update({
                    'aws_access_key_id': self.access_key,
                    'aws_secret_access_key': self.secret_key
                })
                if self.session_token:
                    session_kwargs['aws_session_token'] = self.session_token
            
            session = boto3.Session(**session_kwargs)
            self.logs_client = session.client('logs')
            self.rds_client = session.client('rds')
            
            print(f"INFO: AWS clients initialized for region {self.region}", file=sys.stderr)
            
        except Exception as e:
            print(f"ERROR: Failed to initialize AWS clients: {e}", file=sys.stderr)
            self.logs_client = None
            self.rds_client = None
    
    def get_rds_log_groups(self, db_instance_id: str) -> List[str]:
        """RDS 인스턴스의 로그 그룹 목록 조회"""
        if not self.logs_client:
            return []
        
        try:
            # RDS 로그 그룹 패턴: /aws/rds/instance/{instance-id}/{log-type}
            log_group_prefix = f"/aws/rds/instance/{db_instance_id}/"
            
            response = self.logs_client.describe_log_groups(
                logGroupNamePrefix=log_group_prefix
            )
            
            log_groups = [lg['logGroupName'] for lg in response.get('logGroups', [])]
            return log_groups
            
        except Exception as e:
            print(f"ERROR: Failed to get log groups for {db_instance_id}: {e}", file=sys.stderr)
            return []
    
    def get_aurora_log_groups(self, cluster_id: str) -> List[str]:
        """Aurora 클러스터의 로그 그룹 목록 조회"""
        if not self.logs_client:
            return []
        
        try:
            # Aurora 로그 그룹 패턴: /aws/rds/cluster/{cluster-id}/{log-type}
            log_group_prefix = f"/aws/rds/cluster/{cluster_id}/"
            
            response = self.logs_client.describe_log_groups(
                logGroupNamePrefix=log_group_prefix
            )
            
            log_groups = [lg['logGroupName'] for lg in response.get('logGroups', [])]
            return log_groups
            
        except Exception as e:
            print(f"ERROR: Failed to get log groups for cluster {cluster_id}: {e}", file=sys.stderr)
            return []
    
    def get_log_events(self, log_group_name: str, hours_back: int = 1, limit: int = 100) -> List[Dict]:
        """CloudWatch 로그 이벤트 조회"""
        if not self.logs_client:
            return []
        
        try:
            # 시간 범위 설정
            end_time = datetime.utcnow()
            start_time = end_time - timedelta(hours=hours_back)
            
            start_timestamp = int(start_time.timestamp() * 1000)
            end_timestamp = int(end_time.timestamp() * 1000)
            
            # 로그 스트림 목록 조회
            streams_response = self.logs_client.describe_log_streams(
                logGroupName=log_group_name,
                orderBy='LastEventTime',
                descending=True,
                limit=10  # 최근 10개 스트림만
            )
            
            all_events = []
            
            for stream in streams_response.get('logStreams', []):
                stream_name = stream['logStreamName']
                
                try:
                    events_response = self.logs_client.get_log_events(
                        logGroupName=log_group_name,
                        logStreamName=stream_name,
                        startTime=start_timestamp,
                        endTime=end_timestamp,
                        limit=limit
                    )
                    
                    for event in events_response.get('events', []):
                        all_events.append({
                            'timestamp': datetime.fromtimestamp(event['timestamp'] / 1000).isoformat(),
                            'message': event['message'],
                            'log_stream': stream_name,
                            'log_group': log_group_name
                        })
                        
                except Exception as stream_error:
                    print(f"WARNING: Failed to get events from stream {stream_name}: {stream_error}", file=sys.stderr)
                    continue
            
            # 시간순 정렬
            all_events.sort(key=lambda x: x['timestamp'], reverse=True)
            return all_events[:limit]
            
        except Exception as e:
            print(f"ERROR: Failed to get log events from {log_group_name}: {e}", file=sys.stderr)
            return []
    
    def get_slow_query_logs(self, db_identifier: str, is_cluster: bool = False, hours_back: int = 1) -> List[Dict]:
        """Slow Query 로그 조회"""
        if is_cluster:
            log_groups = self.get_aurora_log_groups(db_identifier)
        else:
            log_groups = self.get_rds_log_groups(db_identifier)
        
        slow_log_groups = [lg for lg in log_groups if 'slowquery' in lg.lower()]
        
        all_slow_logs = []
        for log_group in slow_log_groups:
            events = self.get_log_events(log_group, hours_back)
            all_slow_logs.extend(events)
        
        return all_slow_logs
    
    def get_error_logs(self, db_identifier: str, is_cluster: bool = False, hours_back: int = 1) -> List[Dict]:
        """Error 로그 조회"""
        if is_cluster:
            log_groups = self.get_aurora_log_groups(db_identifier)
        else:
            log_groups = self.get_rds_log_groups(db_identifier)
        
        error_log_groups = [lg for lg in log_groups if 'error' in lg.lower()]
        
        all_error_logs = []
        for log_group in error_log_groups:
            events = self.get_log_events(log_group, hours_back)
            all_error_logs.extend(events)
        
        return all_error_logs
    
    def search_logs(self, db_identifier: str, query: str, is_cluster: bool = False, hours_back: int = 1) -> List[Dict]:
        """로그에서 특정 키워드 검색"""
        if is_cluster:
            log_groups = self.get_aurora_log_groups(db_identifier)
        else:
            log_groups = self.get_rds_log_groups(db_identifier)
        
        matching_logs = []
        
        for log_group in log_groups:
            events = self.get_log_events(log_group, hours_back, limit=500)
            
            # 키워드 검색
            for event in events:
                if query.lower() in event['message'].lower():
                    event['matched_query'] = query
                    matching_logs.append(event)
        
        return matching_logs
    
    def handle_request(self, method: str, params: Dict[str, Any]) -> Dict[str, Any]:
        """MCP 요청 처리"""
        try:
            if method == "list_log_groups":
                db_identifier = params.get("db_identifier")
                is_cluster = params.get("is_cluster", False)
                
                if not db_identifier:
                    return {"error": "db_identifier parameter required"}
                
                if is_cluster:
                    log_groups = self.get_aurora_log_groups(db_identifier)
                else:
                    log_groups = self.get_rds_log_groups(db_identifier)
                
                return {"log_groups": log_groups}
            
            elif method == "get_slow_logs":
                db_identifier = params.get("db_identifier")
                is_cluster = params.get("is_cluster", False)
                hours_back = params.get("hours_back", 1)
                
                if not db_identifier:
                    return {"error": "db_identifier parameter required"}
                
                logs = self.get_slow_query_logs(db_identifier, is_cluster, hours_back)
                return {"slow_logs": logs, "count": len(logs)}
            
            elif method == "get_error_logs":
                db_identifier = params.get("db_identifier")
                is_cluster = params.get("is_cluster", False)
                hours_back = params.get("hours_back", 1)
                
                if not db_identifier:
                    return {"error": "db_identifier parameter required"}
                
                logs = self.get_error_logs(db_identifier, is_cluster, hours_back)
                return {"error_logs": logs, "count": len(logs)}
            
            elif method == "search_logs":
                db_identifier = params.get("db_identifier")
                query = params.get("query")
                is_cluster = params.get("is_cluster", False)
                hours_back = params.get("hours_back", 1)
                
                if not db_identifier or not query:
                    return {"error": "db_identifier and query parameters required"}
                
                logs = self.search_logs(db_identifier, query, is_cluster, hours_back)
                return {"search_results": logs, "count": len(logs), "query": query}
            
            else:
                return {"error": f"Unknown method: {method}"}
                
        except Exception as e:
            return {"error": f"Request processing failed: {str(e)}"}


def main():
    """CloudWatch Logs MCP 서버 메인 함수"""
    server = CloudWatchLogsMCPServer()
    
    if len(sys.argv) > 1 and sys.argv[1] == "--test":
        # 테스트 모드
        print("Testing AWS CloudWatch Logs MCP Server...")
        
        # 테스트용 RDS 인스턴스 ID (환경변수에서 가져오기)
        test_db_id = os.getenv("TEST_RDS_INSTANCE_ID", "your-rds-instance")
        
        print(f"Testing with RDS instance: {test_db_id}")
        
        # 로그 그룹 목록 테스트
        result = server.handle_request("list_log_groups", {"db_identifier": test_db_id})
        print(f"Log groups: {result}")
        
        # Slow query 로그 테스트
        result = server.handle_request("get_slow_logs", {
            "db_identifier": test_db_id,
            "hours_back": 1
        })
        print(f"Slow logs count: {result.get('count', 0)}")
        
    else:
        print("AWS CloudWatch Logs MCP Server ready for requests", file=sys.stderr)


if __name__ == "__main__":
    main()