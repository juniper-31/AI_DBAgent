#!/bin/bash

# 로컬 개발 환경 시작 스크립트 (Docker 없이)

echo "🚀 AI DBAgent 로컬 개발 환경 시작..."

# 환경 변수 확인
if [ ! -f .env ]; then
    echo "⚠️  .env 파일이 없습니다. .env.example을 복사하여 .env를 만들어주세요."
    if [ -f .env.example ]; then
        cp .env.example .env
        echo "✅ .env 파일을 생성했습니다. 필요한 설정을 수정해주세요."
    fi
fi

# Python 가상환경 확인
if [ ! -d "venv" ]; then
    echo "📦 Python 가상환경을 생성합니다..."
    python3 -m venv venv
fi

# 가상환경 활성화
echo "🔧 Python 가상환경을 활성화합니다..."
source venv/bin/activate

# Python 의존성 설치
echo "📚 Python 의존성을 설치합니다..."
pip install -r requirements.txt

# uv 설치 (MCP용)
echo "🔧 uv를 설치합니다..."
if ! command -v uv &> /dev/null; then
    curl -LsSf https://astral.sh/uv/install.sh | sh
    export PATH="$HOME/.local/bin:$PATH"
fi

# 프론트엔드 의존성 설치
echo "🎨 프론트엔드 의존성을 설치합니다..."
cd frontend
if [ ! -d "node_modules" ]; then
    npm install
fi

# 프론트엔드 빌드
echo "🏗️  프론트엔드를 빌드합니다..."
npm run build
cd ..

# 데이터베이스 확인
echo "🗄️  데이터베이스 연결을 확인합니다..."
echo "PostgreSQL이 실행 중인지 확인해주세요."
echo "기본 설정: localhost:5432, 사용자: dbagentuser, DB: dbagent"

# 백엔드 서버 시작
echo "🚀 백엔드 서버를 시작합니다..."
echo "브라우저에서 http://localhost:8000 을 열어주세요."
echo ""
echo "종료하려면 Ctrl+C를 누르세요."

uvicorn main:app --reload --host 0.0.0.0 --port 8000