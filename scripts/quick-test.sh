#!/bin/bash
# 초고속 테스트용 스크립트 - DB 없이 백엔드만 빠르게 테스트

echo "⚡ 초고속 테스트 모드 시작..."

# 환경 변수 설정 (DB 연결 없이)
export DB_HOST=localhost
export DB_PORT=5432
export DB_USER=test
export DB_PASSWORD=test
export DB_NAME=test

# 백엔드만 시작 (DB 연결 실패해도 일부 API는 동작)
echo "📡 백엔드 API 서버 시작 중..."
uvicorn main:app --reload --host 0.0.0.0 --port 8000 &
BACKEND_PID=$!

echo "✅ 백엔드 서버 시작됨!"
echo "   API 문서: http://localhost:8000/docs"
echo "   헬스체크: http://localhost:8000/health"
echo ""
echo "주의: DB 연결이 없어 일부 기능만 테스트 가능합니다."
echo "전체 기능 테스트는 ./scripts/start-dev.sh를 사용하세요."
echo ""
echo "서버를 중지하려면 Ctrl+C를 누르세요."

# 종료 시그널 처리
trap 'echo "🛑 서버를 중지합니다..."; kill $BACKEND_PID; exit' INT

# 대기
wait