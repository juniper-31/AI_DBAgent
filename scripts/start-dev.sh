#!/bin/bash
# 개발 서버 시작 스크립트

echo "🚀 AI DBAgent 개발 서버를 시작합니다..."

# 환경 변수 확인
if [ ! -f .env ]; then
    echo "❌ .env 파일이 없습니다. scripts/dev-setup.sh를 먼저 실행하세요."
    exit 1
fi

# PostgreSQL 컨테이너 상태 확인
if ! docker ps | grep -q "ai-dbagent-postgres-dev"; then
    echo "🐘 PostgreSQL 컨테이너 시작 중..."
    docker-compose -f docker-compose.dev.yml up -d postgres
    echo "⏳ PostgreSQL 준비 대기 중..."
    sleep 5
else
    echo "✅ PostgreSQL 이미 실행 중"
fi

# 백엔드 서버 시작
echo "📡 백엔드 서버 시작 중..."
uvicorn main:app --reload --host 0.0.0.0 --port 8000 &
BACKEND_PID=$!

# 프론트엔드 서버 시작
echo "🌐 프론트엔드 서버 시작 중..."
cd frontend
npm start &
FRONTEND_PID=$!

echo "✅ 서버가 시작되었습니다!"
echo "   백엔드: http://localhost:8000"
echo "   프론트엔드: http://localhost:3000"
echo "   PostgreSQL: localhost:5432"
echo ""
echo "서버를 중지하려면 Ctrl+C를 누르세요."

# 종료 시그널 처리
trap 'echo "🛑 서버를 중지합니다..."; kill $BACKEND_PID $FRONTEND_PID; exit' INT

# 대기
wait