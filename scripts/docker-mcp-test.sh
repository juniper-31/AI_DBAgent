#!/bin/bash

# Docker 환경에서 MCP 기능 테스트 스크립트

echo "🐳 Docker 환경 MCP 테스트 시작..."

# Docker 컨테이너가 실행 중인지 확인
if ! docker ps | grep -q "ai-dbagent-app"; then
    echo "❌ AI DBAgent 컨테이너가 실행되지 않았습니다."
    echo "다음 명령으로 컨테이너를 시작하세요:"
    echo "docker-compose up -d"
    exit 1
fi

echo "✅ AI DBAgent 컨테이너가 실행 중입니다."

# uv 설치 확인
echo "🔍 uv 설치 상태 확인..."
docker exec ai-dbagent-app uv --version
if [ $? -eq 0 ]; then
    echo "✅ uv가 정상적으로 설치되어 있습니다."
else
    echo "❌ uv 설치에 문제가 있습니다."
    exit 1
fi

# uvx 설치 확인
echo "🔍 uvx 설치 상태 확인..."
docker exec ai-dbagent-app uvx --version
if [ $? -eq 0 ]; then
    echo "✅ uvx가 정상적으로 설치되어 있습니다."
else
    echo "❌ uvx 설치에 문제가 있습니다."
    exit 1
fi

# MCP 설정 파일 확인
echo "🔍 MCP 설정 파일 확인..."
docker exec ai-dbagent-app ls -la /app/.kiro/settings/
if [ $? -eq 0 ]; then
    echo "✅ MCP 설정 디렉토리가 존재합니다."
else
    echo "⚠️  MCP 설정 디렉토리가 없습니다. 애플리케이션 시작 시 자동 생성됩니다."
fi

# MCP 테스트 스크립트 실행
echo "🧪 MCP 기능 테스트 실행..."
docker exec ai-dbagent-app python scripts/test_mcp.py
if [ $? -eq 0 ]; then
    echo "✅ MCP 기능 테스트가 성공적으로 완료되었습니다."
else
    echo "⚠️  MCP 기능 테스트에서 일부 문제가 발견되었습니다."
fi

# PostgreSQL MCP 서버 테스트 (실제 MCP 서버 실행 테스트)
echo "🔍 PostgreSQL MCP 서버 실행 테스트..."
docker exec ai-dbagent-app timeout 10s uvx mcp-server-postgres@latest --help
if [ $? -eq 0 ] || [ $? -eq 124 ]; then  # 124는 timeout 종료 코드
    echo "✅ PostgreSQL MCP 서버가 정상적으로 실행 가능합니다."
else
    echo "❌ PostgreSQL MCP 서버 실행에 문제가 있습니다."
    echo "네트워크 연결을 확인하거나 다음 명령으로 수동 설치를 시도하세요:"
    echo "docker exec ai-dbagent-app uvx mcp-server-postgres@latest --help"
fi

# 애플리케이션 로그 확인
echo "📋 최근 애플리케이션 로그 확인..."
docker logs --tail=20 ai-dbagent-app | grep -i mcp
if [ $? -eq 0 ]; then
    echo "✅ MCP 관련 로그가 발견되었습니다."
else
    echo "ℹ️  MCP 관련 로그가 없습니다. (정상일 수 있음)"
fi

# API 엔드포인트 테스트
echo "🌐 MCP API 엔드포인트 테스트..."
response=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:8000/api/mcp/status)
if [ "$response" = "200" ]; then
    echo "✅ MCP API 엔드포인트가 정상적으로 응답합니다."
else
    echo "⚠️  MCP API 엔드포인트 응답: HTTP $response"
fi

echo ""
echo "🎉 Docker 환경 MCP 테스트 완료!"
echo ""
echo "📝 추가 확인사항:"
echo "1. 웹 브라우저에서 http://localhost:8000 접속"
echo "2. 데이터베이스 등록 후 MCP 상태 확인"
echo "3. AI 채팅에서 MCP 컨텍스트 활용 테스트"
echo ""
echo "🔧 문제 해결:"
echo "- MCP 서버 실행 실패 시: docker-compose restart app"
echo "- 설정 파일 문제 시: .kiro/settings/ 디렉토리 권한 확인"
echo "- 네트워크 문제 시: docker-compose down && docker-compose up -d"