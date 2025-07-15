# 🚀 AI DBAgent - AI 기반 데이터베이스 관리 도구

> **SRE/DBA용 AI 기반 데이터베이스 모니터링, 분석 및 자동화 플랫폼**

AI DBAgent는 자연어로 데이터베이스를 조회하고, AWS CloudWatch 메트릭을 실시간 모니터링하며, 자동화된 플레이북을 통해 데이터베이스 운영을 효율화하는 현대적인 DB 관리 도구입니다.

## 🚀 빠른 시작

### 1. 환경 설정

```bash
# 저장소 클론
git clone <repository-url>
cd AI_DBAgent

# 개발 환경 설정 (자동)
./scripts/dev-setup.sh
```

### 2. 환경 변수 설정

`.env` 파일을 생성하고 다음 내용을 입력하세요:

```env
# 데이터베이스 설정
DB_HOST=localhost
DB_PORT=5432
DB_USER=dbagentuser
DB_PASSWORD=supersecret
DB_NAME=dbagent

# AWS 설정 (선택사항)
AWS_DEFAULT_REGION=ap-northeast-2

# 애플리케이션 설정
SECRET_KEY=supersecretkey123
DEBUG=true
```

### 3. 실행 방법

#### 개발 환경 (권장)
```bash
# 개발 서버 시작 (백엔드 + 프론트엔드)
./scripts/start-dev.sh
```

#### 수동 실행
```bash
# 백엔드 실행
pip install -r requirements.txt
uvicorn main:app --reload

# 프론트엔드 실행 (새 터미널)
cd frontend
npm install
npm start
```

#### Docker 실행
```bash
# Docker Compose로 전체 스택 실행
docker-compose up -d
```

### 4. 접속

- **프론트엔드**: http://localhost:3000
- **백엔드 API**: http://localhost:8000
- **API 문서**: http://localhost:8000/docs

## ✨ 주요 기능

### 🤖 AI 기반 자연어 SQL 변환
- **다중 AI 모델 지원**: OpenAI, Azure OpenAI, Google Gemini, Anthropic Claude
- **한국어 최적화**: 모든 AI 응답이 한국어로 제공
- **대화형 인터페이스**: 채팅 형태로 자연스러운 질의응답
- **쿼리 실행 및 해석**: SQL 자동 실행 및 결과 분석
- **대화 히스토리**: 데이터베이스별 대화 내역 관리

### 📋 자동화 플레이북
- **사전 정의된 시나리오**: GDPR 컴플라이언스, 일일 헬스체크, 주간 리뷰 등
- **자동 실행 모드**: 단계별 자동 진행 (3초 간격)
- **수동 실행 모드**: 단계별 수동 제어
- **실시간 진행률**: 플레이북 실행 상태 실시간 표시
- **대화 통합**: 플레이북 결과를 채팅 인터페이스에서 확인

### 📊 실시간 모니터링
- **AWS CloudWatch 통합**: RDS/Aurora 메트릭 실시간 수집
- **주요 지표 모니터링**: CPU, 메모리, 연결 수, IOPS, 스토리지 등
- **시각화**: 카드 + 그래프 형태의 직관적인 대시보드
- **자동 판별**: 인스턴스/클러스터 자동 구분

### 🔍 성능 분석
- **슬로우 쿼리 분석**: pg_stat_statements 및 CloudWatch 로그 기반
- **성능 병목 식별**: AI 기반 최적화 제안
- **쿼리 히스토리**: 실행 패턴 및 성능 추이 분석

### ☁️ AWS 네이티브 통합
- **RDS 인스턴스/클러스터 자동 발견**
- **CloudWatch 로그 스트림 분석**
- **다중 AWS 계정 지원**
- **안전한 자격증명 관리**

## 🏗️ 기술 스택

### 백엔드
- **FastAPI**: 고성능 Python 웹 프레임워크
- **PostgreSQL**: 메타데이터 저장
- **AWS SDK (boto3)**: CloudWatch/RDS 통합
- **SQLAlchemy**: ORM 및 데이터베이스 추상화

### 프론트엔드
- **React 18**: 모던 UI 프레임워크
- **React Router**: SPA 라우팅
- **Axios**: HTTP 클라이언트
- **React Markdown**: 마크다운 렌더링

### 인프라
- **Docker**: 컨테이너화
- **Docker Compose**: 개발 환경 구성
- **AWS CloudWatch**: 메트릭 수집
- **AWS RDS**: 데이터베이스 서비스

## 📖 사용 가이드

### 1. 데이터베이스 등록

1. **DB 관리** 메뉴에서 새 데이터베이스 추가
2. **CloudWatch ID** 입력 (AWS RDS 인스턴스/클러스터 ID와 정확히 일치해야 함)
3. 연결 테스트 후 저장

### 2. AI 모델 설정

1. **AI 등록** 메뉴에서 사용할 AI 모델 선택
2. API 키 입력 및 모델 설정
3. 원하는 모델을 활성화

### 3. CloudWatch 모니터링

1. **모니터링** 메뉴에서 대상 데이터베이스 선택
2. 실시간 메트릭 확인
3. 기간/주기 조정하여 상세 분석

### 4. AI 채팅 사용

```
사용자: "현재 DB 상태 어때?"
AI: 현재 데이터베이스 상태를 확인해드리겠습니다...

사용자: "느린 쿼리 찾아줘"
AI: 실행 시간이 긴 쿼리들을 조회하겠습니다...
```

### 5. 플레이북 실행

1. **플레이북** 메뉴에서 원하는 시나리오 선택
2. 대상 데이터베이스 선택
3. **실행** 버튼 클릭
4. 자동으로 채팅 페이지로 이동하여 플레이북 실행
5. 자동 모드에서 각 단계가 3초 간격으로 순차 실행

#### 사용 가능한 플레이북
- **GDPR 컴플라이언스**: 개인정보 관련 데이터 현황 점검
- **일일 헬스체크**: 데이터베이스 상태 및 성능 점검
- **주간 리뷰**: 주간 성능 분석 및 리포트 생성
- **보안 감사**: 보안 설정 및 권한 점검
- **용량 분석**: 스토리지 사용량 및 증가 추이 분석

## 🔧 고급 설정

### CloudWatch 설정

```bash
# AWS CLI 설정
aws configure

# 또는 환경 변수 설정
export AWS_ACCESS_KEY_ID=your_access_key
export AWS_SECRET_ACCESS_KEY=your_secret_key
export AWS_DEFAULT_REGION=ap-northeast-2
```

### 플레이북 커스터마이징

`playbooks.json` 파일을 수정하여 자동화 시나리오를 추가할 수 있습니다:

```json
{
  "name": "customMonitoring",
  "description": "커스텀 모니터링 플레이북",
  "steps": [
    {
      "title": "CPU 사용률 확인",
      "prompt": "현재 CPU 사용률이 80% 이상인가요?"
    }
  ]
}
```

## 🧪 테스트

```bash
# 단위 테스트 실행
pytest tests/

# 특정 테스트 실행
pytest tests/test_database.py

# 커버리지 포함 테스트
pytest --cov=backend tests/
```

## 📁 프로젝트 구조

```
AI_DBAgent/
├── backend/              # FastAPI 백엔드
│   ├── api/             # API 라우터
│   ├── integrations/    # AWS 통합
│   ├── models/          # 데이터 모델
│   ├── monitoring/      # 메트릭 수집기
│   └── services/        # 비즈니스 로직
├── frontend/            # React 프론트엔드
│   ├── src/            # 소스 코드
│   └── public/         # 정적 파일
├── agent/              # 백그라운드 에이전트
├── database/           # DB 스키마
├── docker/             # Docker 설정
├── scripts/            # 유틸리티 스크립트
├── tests/              # 테스트 코드
└── templates/          # HTML 템플릿
```

## 🔍 트러블슈팅

### 일반적인 문제들

**Q: CloudWatch 데이터가 표시되지 않아요**
- AWS 자격증명이 올바른지 확인
- CloudWatch ID가 AWS 콘솔의 인스턴스/클러스터 ID와 정확히 일치하는지 확인
- 해당 리전에 데이터가 있는지 확인

**Q: AI 응답이 없어요**
- AI 모델이 선택되어 있는지 확인
- API 키가 유효한지 확인
- 네트워크 연결 상태 확인

**Q: 데이터베이스 연결이 안 돼요**
- 연결 정보 (호스트, 포트, 사용자명, 비밀번호) 확인
- 방화벽 설정 확인
- 데이터베이스 서버 상태 확인

### 로그 확인

```bash
# 애플리케이션 로그
tail -f logs/app.log

# 에러 로그
tail -f logs/error.log

# Docker 로그
docker-compose logs -f app
```

## 🤝 기여하기

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 라이선스

이 프로젝트는 MIT 라이선스 하에 배포됩니다. 자세한 내용은 `LICENSE` 파일을 참조하세요.

## 🙋‍♂️ 지원

- **이슈 리포트**: GitHub Issues
- **기능 요청**: GitHub Discussions
- **문서**: 프로젝트 Wiki

---

**Made with ❤️ for SRE/DBA Engineers**