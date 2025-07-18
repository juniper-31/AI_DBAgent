#!/usr/bin/env python3
"""
MCP 연동 테스트 스크립트
Docker 환경에서 MCP 서버들이 제대로 작동하는지 확인합니다.
"""

import asyncio
import json
import subprocess
import sys
from pathlib import Path

async def test_mcp_server(server_name, server_config):
    """개별 MCP 서버 테스트"""
    print(f"\n🔍 Testing MCP server: {server_name}")
    print(f"Command: {server_config['command']} {' '.join(server_config['args'])}")
    
    try:
        # MCP 서버 프로세스 시작
        cmd = [server_config['command']] + server_config['args']
        env = server_config.get('env', {})
        
        # 환경변수 설정
        import os
        test_env = os.environ.copy()
        test_env.update(env)
        
        print(f"Environment: {env}")
        
        # 간단한 연결 테스트 (타임아웃 설정)
        proc = await asyncio.create_subprocess_exec(
            *cmd,
            env=test_env,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE
        )
        
        # 5초 후 프로세스 종료
        try:
            stdout, stderr = await asyncio.wait_for(proc.communicate(), timeout=5.0)
            print(f"✅ {server_name}: Process started successfully")
            if stdout:
                print(f"STDOUT: {stdout.decode()[:200]}...")
            if stderr:
                print(f"STDERR: {stderr.decode()[:200]}...")
        except asyncio.TimeoutError:
            print(f"✅ {server_name}: Process is running (timeout reached, which is expected)")
            proc.terminate()
            await proc.wait()
        
    except Exception as e:
        print(f"❌ {server_name}: Error - {str(e)}")

async def test_database_connections():
    """데이터베이스 연결 테스트"""
    print("\n🔍 Testing database connections...")
    
    # PostgreSQL 연결 테스트
    try:
        result = subprocess.run([
            "docker", "exec", "ai-dbagent-postgres", 
            "psql", "-U", "dbagentuser", "-d", "dbagent", 
            "-c", "SELECT version();"
        ], capture_output=True, text=True, timeout=10)
        
        if result.returncode == 0:
            print("✅ PostgreSQL: Connection successful")
            print(f"Version info: {result.stdout.split('|')[0].strip()}")
        else:
            print(f"❌ PostgreSQL: Connection failed - {result.stderr}")
    except Exception as e:
        print(f"❌ PostgreSQL: Error - {str(e)}")

def check_uv_installation():
    """uv/uvx 설치 확인"""
    print("\n🔍 Checking uv/uvx installation...")
    
    try:
        result = subprocess.run(["uvx", "--version"], capture_output=True, text=True)
        if result.returncode == 0:
            print(f"✅ uvx is installed: {result.stdout.strip()}")
            return True
        else:
            print("❌ uvx is not installed or not working")
            return False
    except FileNotFoundError:
        print("❌ uvx command not found")
        return False

async def main():
    print("🚀 MCP Integration Test")
    print("=" * 50)
    
    # uv/uvx 설치 확인
    if not check_uv_installation():
        print("\n💡 To install uv/uvx:")
        print("curl -LsSf https://astral.sh/uv/install.sh | sh")
        return
    
    # 데이터베이스 연결 테스트
    await test_database_connections()
    
    # MCP 설정 파일 읽기
    mcp_config_path = Path(".kiro/settings/mcp.json")
    if not mcp_config_path.exists():
        print(f"❌ MCP config file not found: {mcp_config_path}")
        return
    
    with open(mcp_config_path) as f:
        config = json.load(f)
    
    # 각 MCP 서버 테스트
    for server_name, server_config in config.get("mcpServers", {}).items():
        if not server_config.get("disabled", False):
            await test_mcp_server(server_name, server_config)
        else:
            print(f"⏭️  Skipping disabled server: {server_name}")
    
    print("\n✨ MCP test completed!")

if __name__ == "__main__":
    asyncio.run(main())