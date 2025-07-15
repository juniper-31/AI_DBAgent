#!/bin/bash
# PostgreSQL만 빠르게 시작하는 스크립트

echo "🐘 PostgreSQL 개발 DB 시작..."

# 기존 컨테이너 확인 및 정리
if docker ps -a | grep -q "ai-dbagent-postgres-dev"; then
    echo "🔄 기존 PostgreSQL 컨테이너 정리 중..."
    docker stop ai-dbagent-postgres-dev 2>/dev/null
    docker rm ai-dbagent-postgres-dev 2>/dev/null
fi

# PostgreSQL 컨테이너 시작 (가장 빠른 방법)
echo "🚀 PostgreSQL 컨테이너 시작 중..."
docker run -d \
  --name ai-dbagent-postgres-dev \
  -e POSTGRES_DB=dbagent \
  -e POSTGRES_USER=dbagentuser \
  -e POSTGRES_PASSWORD=supersecret \
  -p 5432:5432 \
  postgres:15-alpine

echo "⏳ PostgreSQL 준비 대기 중..."
sleep 3

# 연결 테스트
echo "🔍 연결 테스트 중..."
for i in {1..10}; do
    if docker exec ai-dbagent-postgres-dev pg_isready -U dbagentuser -d dbagent >/dev/null 2>&1; then
        echo "✅ PostgreSQL 준비 완료!"
        echo "   연결 정보:"
        echo "   - Host: localhost"
        echo "   - Port: 5432"
        echo "   - Database: dbagent"
        echo "   - User: dbagentuser"
        echo "   - Password: supersecret"
        echo ""
        echo "이제 애플리케이션을 시작할 수 있습니다:"
        echo "   uvicorn main:app --reload"
        exit 0
    fi
    echo "   대기 중... ($i/10)"
    sleep 2
done

echo "❌ PostgreSQL 시작에 실패했습니다."
docker logs ai-dbagent-postgres-dev
exit 1