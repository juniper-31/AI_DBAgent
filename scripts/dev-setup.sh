#!/bin/bash
# 개발 환경 설정 스크립트

echo "🚀 AI DBAgent 개발 환경 설정을 시작합니다..."

# Python 가상환경 생성 및 활성화
echo "📦 Python 가상환경 설정 중..."
python3 -m venv venv
source venv/bin/activate

# Python 의존성 설치
echo "📦 Python 패키지 설치 중..."
pip install -r requirements.txt

# 프론트엔드 의존성 설치
echo "📦 프론트엔드 패키지 설치 중..."
cd frontend
npm install
cd ..

# 환경 변수 파일 확인
if [ ! -f .env ]; then
    echo "⚠️  .env 파일이 없습니다. 샘플 파일을 복사합니다."
    cp .env.example .env 2>/dev/null || echo "DB_HOST=localhost
DB_PORT=5432
DB_USER=dbagentuser
DB_PASSWORD=supersecret
DB_NAME=dbagent" > .env
fi

# 로그 디렉토리 생성
mkdir -p logs

echo "✅ 개발 환경 설정이 완료되었습니다!"
echo ""
echo "다음 명령어로 애플리케이션을 실행하세요:"
echo "  백엔드: uvicorn main:app --reload"
echo "  프론트엔드: cd frontend && npm start"
echo ""
echo "또는 Docker로 실행:"
echo "  docker-compose up -d"