"""
MCP 관리 서비스
데이터베이스 등록 시 자동으로 MCP 서버 설정을 업데이트합니다.
"""
import json
import os
import time
import subprocess
from typing import Dict, List, Optional
from backend.database import get_registered_databases

class MCPManager:
    def __init__(self):
        # MCP 설정 파일 경로를 환경변수로 설정 가능하게 함
        self.mcp_config_path = self.get_mcp_config_path()
        self.timeout = int(os.getenv("MCP_SERVER_TIMEOUT", "30"))
        self.max_retries = int(os.getenv("MCP_MAX_RETRIES", "3"))
        self.ensure_mcp_config_exists()
    
    def get_mcp_config_path(self) -> str:
        """MCP 설정 파일 경로 결정 (우선순위별로)"""
        # 1. 환경변수로 직접 지정
        if os.getenv("MCP_CONFIG_PATH"):
            return os.getenv("MCP_CONFIG_PATH")
        
        # 2. 프로젝트 루트의 config 폴더
        if os.path.exists("config"):
            return "config/mcp.json"
        
        # 3. Kiro IDE 사용자용 (기본값)
        if os.path.exists(".kiro") or os.getenv("KIRO_IDE"):
            return ".kiro/settings/mcp.json"
        
        # 4. 일반적인 설정 폴더들
        possible_paths = [
            "mcp/mcp.json",
            "settings/mcp.json", 
            ".config/mcp.json",
            "mcp.json"  # 프로젝트 루트
        ]
        
        for path in possible_paths:
            if os.path.exists(os.path.dirname(path)) or path == "mcp.json":
                return path
        
        # 5. 기본값 (프로젝트 루트)
        return "mcp.json"
    
    def ensure_mcp_config_exists(self):
        """MCP 설정 파일이 없으면 기본 설정으로 생성"""
        if not os.path.exists(self.mcp_config_path):
            os.makedirs(os.path.dirname(self.mcp_config_path), exist_ok=True)
            default_config = {
                "mcpServers": {
                    "postgres": {
                        "command": "uvx",
                        "args": ["mcp-server-postgres@latest"],
                        "env": {},
                        "disabled": False,
                        "autoApprove": [
                            "query",
                            "list_tables",
                            "describe_table",
                            "get_schema"
                        ]
                    }
                }
            }
            self.save_mcp_config(default_config)
    
    def load_mcp_config(self) -> Dict:
        """MCP 설정 파일 로드"""
        try:
            with open(self.mcp_config_path, 'r', encoding='utf-8') as f:
                return json.load(f)
        except (FileNotFoundError, json.JSONDecodeError):
            return {"mcpServers": {}}
    
    def save_mcp_config(self, config: Dict):
        """MCP 설정 파일 저장"""
        os.makedirs(os.path.dirname(self.mcp_config_path), exist_ok=True)
        with open(self.mcp_config_path, 'w', encoding='utf-8') as f:
            json.dump(config, f, indent=2, ensure_ascii=False)
    
    def generate_connection_string(self, db_info: Dict) -> str:
        """데이터베이스 정보로부터 연결 문자열 생성"""
        host = db_info.get('host', 'localhost')
        port = db_info.get('port', 5432)
        user = db_info.get('user', db_info.get('username', ''))
        password = db_info.get('password', '')
        dbname = db_info.get('dbname', '')
        
        return f"postgresql://{user}:{password}@{host}:{port}/{dbname}"
    
    def add_database_to_mcp(self, db_name: str, db_info: Dict):
        """데이터베이스를 MCP 서버에 추가"""
        config = self.load_mcp_config()
        
        # 데이터베이스별 MCP 서버 설정 생성
        server_name = f"postgres_{db_name}"
        connection_string = self.generate_connection_string(db_info)
        
        config["mcpServers"][server_name] = {
            "command": "uvx",
            "args": ["mcp-server-postgres@latest"],
            "env": {
                "POSTGRES_CONNECTION_STRING": connection_string
            },
            "disabled": False,
            "autoApprove": [
                "query",
                "list_tables",
                "describe_table",
                "get_schema"
            ]
        }
        
        # AWS RDS/Aurora인 경우 CloudWatch 로그 서버도 추가
        cloudwatch_id = db_info.get('cloudwatch_id')
        if cloudwatch_id and self.is_aws_rds_host(db_info.get('host', '')):
            self.add_cloudwatch_logs_server(db_name, cloudwatch_id, config)
        
        self.save_mcp_config(config)
        print(f"INFO: Added database '{db_name}' to MCP configuration")
    
    def remove_database_from_mcp(self, db_name: str):
        """데이터베이스를 MCP 서버에서 제거"""
        config = self.load_mcp_config()
        server_name = f"postgres_{db_name}"
        
        if server_name in config["mcpServers"]:
            del config["mcpServers"][server_name]
            self.save_mcp_config(config)
            print(f"INFO: Removed database '{db_name}' from MCP configuration")
    
    def sync_all_databases(self):
        """등록된 모든 데이터베이스를 MCP와 동기화"""
        databases = get_registered_databases()
        config = self.load_mcp_config()
        
        # 기존 데이터베이스 MCP 서버들 제거 (postgres_로 시작하는 것들)
        servers_to_remove = [name for name in config["mcpServers"].keys() 
                           if name.startswith("postgres_")]
        for server_name in servers_to_remove:
            del config["mcpServers"][server_name]
        
        # 현재 등록된 데이터베이스들을 MCP에 추가
        for db in databases:
            db_name = db['name']
            db_info = {
                'host': db['host'],
                'port': db['port'],
                'user': db['user'],
                'password': db['password'],
                'dbname': db['dbname']
            }
            
            server_name = f"postgres_{db_name}"
            connection_string = self.generate_connection_string(db_info)
            
            config["mcpServers"][server_name] = {
                "command": "uvx",
                "args": ["mcp-server-postgres@latest"],
                "env": {
                    "POSTGRES_CONNECTION_STRING": connection_string
                },
                "disabled": False,
                "autoApprove": [
                    "query",
                    "list_tables",
                    "describe_table",
                    "get_schema"
                ]
            }
        
        self.save_mcp_config(config)
        print(f"INFO: Synced {len(databases)} databases with MCP configuration")
    
    def get_mcp_databases(self) -> List[str]:
        """MCP에 등록된 데이터베이스 목록 반환"""
        config = self.load_mcp_config()
        return [name.replace("postgres_", "") for name in config["mcpServers"].keys() 
                if name.startswith("postgres_")]
    
    def is_database_in_mcp(self, db_name: str) -> bool:
        """데이터베이스가 MCP에 등록되어 있는지 확인"""
        return db_name in self.get_mcp_databases()
    
    def test_mcp_server_connection(self, server_name: str, connection_string: str) -> bool:
        """MCP 서버 연결 테스트 (타임아웃과 재시도 적용)"""
        for attempt in range(self.max_retries):
            try:
                print(f"INFO: Testing MCP server '{server_name}' connection (attempt {attempt + 1}/{self.max_retries})")
                
                # PostgreSQL 연결 테스트
                import psycopg2
                conn = psycopg2.connect(connection_string, connect_timeout=self.timeout)
                conn.close()
                
                print(f"INFO: MCP server '{server_name}' connection successful")
                return True
                
            except Exception as e:
                print(f"WARNING: MCP server '{server_name}' connection failed (attempt {attempt + 1}): {e}")
                if attempt < self.max_retries - 1:
                    time.sleep(2)  # 재시도 전 2초 대기
                
        print(f"ERROR: MCP server '{server_name}' connection failed after {self.max_retries} attempts")
        return False
    
    def add_database_to_mcp_with_validation(self, db_name: str, db_info: Dict) -> bool:
        """데이터베이스를 MCP에 추가하고 연결 검증"""
        connection_string = self.generate_connection_string(db_info)
        server_name = f"postgres_{db_name}"
        
        # 연결 테스트
        if not self.test_mcp_server_connection(server_name, connection_string):
            print(f"ERROR: Failed to validate connection for database '{db_name}'. Not adding to MCP.")
            return False
        
        # 연결이 성공하면 MCP에 추가
        self.add_database_to_mcp(db_name, db_info)
        return True
    
    def get_mcp_server_status(self) -> Dict[str, Dict]:
        """모든 MCP 서버의 상태 확인"""
        config = self.load_mcp_config()
        status = {}
        
        for server_name, server_config in config["mcpServers"].items():
            if server_name.startswith("postgres_"):
                connection_string = server_config["env"].get("POSTGRES_CONNECTION_STRING", "")
                if connection_string:
                    is_connected = self.test_mcp_server_connection(server_name, connection_string)
                    status[server_name] = {
                        "connected": is_connected,
                        "connection_string": connection_string,
                        "disabled": server_config.get("disabled", False),
                        "timeout": self.timeout,
                        "max_retries": self.max_retries
                    }
        
        return status
    
    def is_aws_rds_host(self, host: str) -> bool:
        """호스트가 AWS RDS/Aurora인지 확인"""
        aws_rds_patterns = [
            '.rds.amazonaws.com',
            '.cluster-',
            '.aurora.',
            'rds.ap-northeast-2.amazonaws.com',
            'rds.us-east-1.amazonaws.com',
            'rds.us-west-2.amazonaws.com'
        ]
        return any(pattern in host.lower() for pattern in aws_rds_patterns)
    
    def add_cloudwatch_logs_server(self, db_name: str, cloudwatch_id: str, config: Dict):
        """CloudWatch 로그 서버를 MCP 설정에 추가"""
        logs_server_name = f"cloudwatch_logs_{db_name}"
        
        config["mcpServers"][logs_server_name] = {
            "command": "python3",
            "args": ["scripts/aws_cloudwatch_mcp_server.py"],
            "env": {
                "AWS_DEFAULT_REGION": os.getenv("AWS_DEFAULT_REGION", "ap-northeast-2"),
                "AWS_ACCESS_KEY_ID": os.getenv("AWS_ACCESS_KEY_ID", ""),
                "AWS_SECRET_ACCESS_KEY": os.getenv("AWS_SECRET_ACCESS_KEY", ""),
                "AWS_SESSION_TOKEN": os.getenv("AWS_SESSION_TOKEN", ""),
                "RDS_INSTANCE_ID": cloudwatch_id
            },
            "disabled": False,
            "autoApprove": [
                "list_log_groups",
                "get_slow_logs",
                "get_error_logs",
                "search_logs"
            ]
        }
        
        print(f"INFO: Added CloudWatch logs server for database '{db_name}' (RDS ID: {cloudwatch_id})")
    
    def remove_cloudwatch_logs_server(self, db_name: str, config: Dict):
        """CloudWatch 로그 서버를 MCP 설정에서 제거"""
        logs_server_name = f"cloudwatch_logs_{db_name}"
        
        if logs_server_name in config["mcpServers"]:
            del config["mcpServers"][logs_server_name]
            print(f"INFO: Removed CloudWatch logs server for database '{db_name}'")

# 전역 MCP 매니저 인스턴스
mcp_manager = MCPManager()