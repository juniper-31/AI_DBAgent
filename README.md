# 🚀 AI DBAgent - AI-Powered Database Management Tool

> **AI-based Database Monitoring, Analysis and Automation Platform for SRE/DBA**

**AI DBAgent is a modern database management tool that enables natural language database queries, real-time AWS CloudWatch metrics monitoring, and streamlined database operations through automated playbooks.**

<div style="color: #666; margin-top: 10px;">

> **SRE/DBA용 AI 기반 데이터베이스 모니터링, 분석 및 자동화 플랫폼**

AI DBAgent는 자연어로 데이터베이스를 조회하고, AWS CloudWatch 메트릭을 실시간 모니터링하며, 자동화된 플레이북을 통해 데이터베이스 운영을 효율화하는 현대적인 DB 관리 도구입니다.

</div>

## 🚀 Quick Start

### 1. Environment Setup

```bash
# Clone repository
git clone <repository-url>
cd AI_DBAgent

# Automatic development environment setup
./scripts/dev-setup.sh
```

<div style="color: #666;">

### 1. 환경 설정

```bash
# 저장소 클론
git clone <repository-url>
cd AI_DBAgent

# 개발 환경 설정 (자동)
./scripts/dev-setup.sh
```

</div>

### 2. Environment Variables Configuration

Create a `.env` file and add the following content:

```env
# Database Configuration
DB_HOST=localhost
DB_PORT=5432
DB_USER=dbagentuser
DB_PASSWORD=supersecret
DB_NAME=dbagent

# AWS Configuration (Optional)
AWS_DEFAULT_REGION=ap-northeast-2

# Application Configuration
SECRET_KEY=supersecretkey123
DEBUG=true
```

<div style="color: #666;">

### 2. 환경 변수 설정![alt text](image.png)

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

</div>

### 3. Running the Application

#### Development Environment (Recommended)
```bash
# Start development server (Backend + Frontend)
./scripts/start-dev.sh
```

#### Manual Execution
```bash
# Run Backend
pip install -r requirements.txt
uvicorn main:app --reload

# Run Frontend (New Terminal)
cd frontend
npm install
npm start
```

#### Docker Compose Execution
```bash
# Run entire stack with Docker Compose
docker-compose up -d
```

<div style="color: #666;">

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

</div>

### 4. Access URLs

- **WEB**: http://localhost:8000
- **API Documentation**: http://localhost:8000/docs

<div style="color: #666;">

### 4. 접속

- **WEB**: http://localhost:8000
- **API 문서**: http://localhost:8000/docs

</div>

## ✨ Key Features

### 🤖 AI-Powered Natural Language SQL Translation
- **Multi-AI Model Support**: OpenAI, Azure OpenAI, Google Gemini, Anthropic Claude
- **Multi-Language Interface**: Full Korean/English support with language toggle button
- **Interactive Interface**: Natural Q&A through chat-based interface
- **Query Execution & Interpretation**: Automatic SQL execution and result analysis
- **Conversation History**: Database-specific conversation history management

### 🔗 MCP (Model Context Protocol) Integration
- **Automatic Database Registration**: Auto-setup MCP servers when registering databases
- **Real-time Synchronization**: Automatic sync between registered databases and MCP servers
- **PostgreSQL MCP Server**: Dedicated MCP server creation for each database
- **AI Chat Integration**: Automatic inclusion of MCP context in AI conversations
- **Status Monitoring**: Real-time MCP integration status monitoring and management

### 📋 Automated Playbooks
- **Pre-defined Scenarios**: GDPR compliance, daily health checks, weekly reviews, etc.
- **Auto-execution Mode**: Step-by-step automatic progression (3-second intervals)
- **Manual Execution Mode**: Step-by-step manual control
- **Real-time Progress**: Live playbook execution status display
- **Chat Integration**: View playbook results in chat interface

### 📊 Real-time Monitoring
- **AWS CloudWatch Integration**: Real-time RDS/Aurora metrics collection
- **Key Metrics Monitoring**: CPU, Memory, Connections, IOPS, Storage, etc.
- **Visualization**: Intuitive dashboard with cards and graphs
- **Auto-detection**: Automatic instance/cluster differentiation

### 🔍 Performance Analysis
- **Slow Query Analysis**: Based on pg_stat_statements and CloudWatch logs
- **Performance Bottleneck Identification**: AI-powered optimization suggestions
- **Query History**: Execution pattern and performance trend analysis

### ☁️ AWS Native Integration
- **Auto-discovery of RDS Instances/Clusters**
- **CloudWatch Log Stream Analysis**
- **Multi-AWS Account Support**
- **Secure Credential Management**

<div style="color: #666;">

## ✨ 주요 기능

### 🤖 AI 기반 자연어 SQL 변환
- **다중 AI 모델 지원**: OpenAI, Azure OpenAI, Google Gemini, Anthropic Claude
- **다국어 지원**: 한국어와 영어 인터페이스 및 자동 언어 감지
- **대화형 인터페이스**: 채팅 형태로 자연스러운 질의응답
- **쿼리 실행 및 해석**: SQL 자동 실행 및 결과 분석
- **대화 히스토리**: 데이터베이스별 대화 내역 관리

### 🔗 MCP (Model Context Protocol) 통합
- **자동 데이터베이스 등록**: 데이터베이스 등록 시 MCP 서버 자동 설정
- **실시간 동기화**: 등록된 데이터베이스와 MCP 서버 자동 동기화
- **PostgreSQL MCP 서버**: 각 데이터베이스별 전용 MCP 서버 생성
- **AI 채팅 통합**: MCP 컨텍스트를 AI 채팅에 자동 포함
- **상태 모니터링**: MCP 연동 상태 실시간 확인 및 관리

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

</div>

## 📖 사용 가이드 / User Guide

### 1. 데이터베이스 등록 / Database Registration

1. **DB 관리** 메뉴에서 새 데이터베이스 추가
2. **CloudWatch ID** 입력 (AWS RDS 인스턴스/클러스터 ID와 정확히 일치해야 함)
3. 연결 테스트 후 저장

**English:**
1. Add a new database from the **DB Management** menu
2. Enter **CloudWatch ID** (must exactly match AWS RDS instance/cluster ID)
3. Test connection and save

### 2. AI 모델 설정 / AI Model Configuration

1. **AI 등록** 메뉴에서 사용할 AI 모델 선택
2. API 키 입력 및 모델 설정
3. 원하는 모델을 활성화

**English:**
1. Select AI model to use from **AI Registration** menu
2. Enter API key and configure model settings
3. Activate desired model

### 3. CloudWatch 모니터링 / CloudWatch Monitoring

1. **모니터링** 메뉴에서 대상 데이터베이스 선택
2. 실시간 메트릭 확인
3. 기간/주기 조정하여 상세 분석

**English:**
1. Select target database from **Monitoring** menu
2. Check real-time metrics
3. Adjust time period/interval for detailed analysis

### 4. AI 채팅 사용 / Using AI Chat

```
사용자: "현재 DB 상태 어때?"
AI: 현재 데이터베이스 상태를 확인해드리겠습니다...

사용자: "느린 쿼리 찾아줘"
AI: 실행 시간이 긴 쿼리들을 조회하겠습니다...
```

**English:**
```
User: "How is the current DB status?"
AI: I'll check the current database status for you...

User: "Find slow queries"
AI: I'll query for long-running queries...
```

### 5. MCP 설정 및 사용 / MCP Setup and Usage

#### MCP 초기 설정 / MCP Initial Setup
```bash
# uv 및 uvx 설치 (MCP 서버 실행에 필요)
curl -LsSf https://astral.sh/uv/install.sh | sh

# 또는 Homebrew 사용 (macOS)
brew install uv
```

**English:**
```bash
# Install uv and uvx (required for MCP server execution)
curl -LsSf https://astral.sh/uv/install.sh | sh

# Or use Homebrew (macOS)
brew install uv
```

#### MCP 설정 파일 위치 (우선순위별) / MCP Configuration File Locations (by Priority)

AI DBAgent는 다양한 환경에서 사용할 수 있도록 MCP 설정 파일 위치를 유연하게 지원합니다:

**English:** AI DBAgent flexibly supports MCP configuration file locations for use in various environments:

1. **환경변수로 직접 지정** (최우선) / **Direct Environment Variable** (Highest Priority)
   ```bash
   export MCP_CONFIG_PATH="/path/to/your/mcp.json"
   ```

2. **프로젝트 config 폴더** (권장) / **Project Config Folder** (Recommended)
   ```bash
   # config/mcp.json 파일 생성
   cp config/mcp.example.json config/mcp.json
   # 설정 수정 후 사용
   ```
   **English:**
   ```bash
   # Create config/mcp.json file
   cp config/mcp.example.json config/mcp.json
   # Modify settings and use
   ```

3. **Kiro IDE 사용자용** / **For Kiro IDE Users**
   ```bash
   # .kiro/settings/mcp.json (Kiro IDE 자동 생성)
   # .kiro/settings/mcp.json (Auto-generated by Kiro IDE)
   ```

4. **기타 일반적인 위치들** / **Other Common Locations**
   ```
   mcp/mcp.json
   settings/mcp.json
   .config/mcp.json
   mcp.json (프로젝트 루트 / project root)
   ```

#### MCP 설정 파일 예시

```json
{
  "mcpServers": {
    "postgres_mydb": {
      "command": "uvx",
      "args": ["mcp-server-postgres@latest"],
      "env": {
        "POSTGRES_CONNECTION_STRING": "postgresql://user:pass@host:5432/db"
      },
      "disabled": false,
      "autoApprove": ["query", "list_tables", "describe_table"]
    },
    "cloudwatch_logs_mydb": {
      "command": "python3",
      "args": ["scripts/aws_cloudwatch_mcp_server.py"],
      "env": {
        "AWS_DEFAULT_REGION": "ap-northeast-2",
        "RDS_INSTANCE_ID": "my-rds-instance"
      },
      "disabled": false,
      "autoApprove": ["get_slow_logs", "get_error_logs", "search_logs"]
    }
  }
}
```

#### MCP 기능 사용 / Using MCP Features
1. **자동 동기화**: 데이터베이스 등록 시 MCP 서버가 자동으로 설정됩니다
2. **상태 확인**: 대시보드에서 MCP 연동 상태를 실시간으로 확인
3. **수동 동기화**: 필요 시 "동기화" 버튼으로 수동 동기화 실행
4. **AI 채팅**: MCP 컨텍스트가 자동으로 AI 채팅에 포함되어 더 정확한 응답 제공

**English:**
1. **Auto Sync**: MCP servers are automatically configured when registering databases
2. **Status Check**: Real-time monitoring of MCP integration status on dashboard
3. **Manual Sync**: Execute manual sync with "Sync" button when needed
4. **AI Chat**: MCP context automatically included in AI chat for more accurate responses

#### MCP 테스트 / MCP Testing
```bash
# MCP 기능 테스트
python scripts/test_mcp.py

# MCP 동기화 테스트
python scripts/test_mcp.py sync

# 특정 설정 파일로 테스트
MCP_CONFIG_PATH="config/mcp.json" python scripts/test_mcp.py
```

**English:**
```bash
# Test MCP functionality
python scripts/test_mcp.py

# Test MCP synchronization
python scripts/test_mcp.py sync

# Test with specific config file
MCP_CONFIG_PATH="config/mcp.json" python scripts/test_mcp.py
```

#### 팀 협업을 위한 MCP 설정 / MCP Setup for Team Collaboration

**Git에 포함할 파일들:** / **Files to Include in Git:**
- `config/mcp.example.json` - 예시 설정 (민감정보 제외) / Example config (excluding sensitive info)
- `scripts/aws_cloudwatch_mcp_server.py` - CloudWatch MCP 서버 / CloudWatch MCP server
- `scripts/postgres_mcp_server.py` - PostgreSQL MCP 서버 / PostgreSQL MCP server

**Git에서 제외할 파일들 (.gitignore):** / **Files to Exclude from Git (.gitignore):**
```gitignore
# MCP 설정 파일들 (민감정보 포함) / MCP config files (containing sensitive info)
config/mcp.json
.kiro/settings/mcp.json
mcp.json

# AWS 자격증명 / AWS credentials
.env
.env.local
```

**팀원 설정 가이드:** / **Team Member Setup Guide:**
```bash
# 1. 예시 파일 복사 / Copy example file
cp config/mcp.example.json config/mcp.json

# 2. 개인 설정 수정 / Modify personal settings
# - 데이터베이스 연결 정보 / Database connection info
# - AWS 자격증명 / AWS credentials
# - RDS 인스턴스 ID 등 / RDS instance ID, etc.

# 3. 환경변수 설정 (선택사항) / Set environment variables (optional)
export MCP_CONFIG_PATH="config/mcp.json"
```

### 6. 플레이북 실행 / Playbook Execution

1. **플레이북** 메뉴에서 원하는 시나리오 선택
2. 대상 데이터베이스 선택
3. **실행** 버튼 클릭
4. 자동으로 채팅 페이지로 이동하여 플레이북 실행
5. 자동 모드에서 각 단계가 3초 간격으로 순차 실행

**English:**
1. Select desired scenario from **Playbooks** menu
2. Select target database
3. Click **Execute** button
4. Automatically navigate to chat page for playbook execution
5. In auto mode, each step executes sequentially at 3-second intervals

#### 사용 가능한 플레이북 / Available Playbooks
- **GDPR 컴플라이언스**: 개인정보 관련 데이터 현황 점검 / **GDPR Compliance**: Personal data status inspection
- **일일 헬스체크**: 데이터베이스 상태 및 성능 점검 / **Daily Health Check**: Database status and performance inspection
- **주간 리뷰**: 주간 성능 분석 및 리포트 생성 / **Weekly Review**: Weekly performance analysis and report generation
- **보안 감사**: 보안 설정 및 권한 점검 / **Security Audit**: Security settings and permission inspection
- **용량 분석**: 스토리지 사용량 및 증가 추이 분석 / **Capacity Analysis**: Storage usage and growth trend analysis

## 🔧 고급 설정 / Advanced Configuration

### CloudWatch 설정 / CloudWatch Configuration

```bash
# AWS CLI 설정
aws configure

# 또는 환경 변수 설정
export AWS_ACCESS_KEY_ID=your_access_key
export AWS_SECRET_ACCESS_KEY=your_secret_key
export AWS_DEFAULT_REGION=ap-northeast-2
```

**English:**
```bash
# AWS CLI configuration
aws configure

# Or set environment variables
export AWS_ACCESS_KEY_ID=your_access_key
export AWS_SECRET_ACCESS_KEY=your_secret_key
export AWS_DEFAULT_REGION=ap-northeast-2
```

### 플레이북 커스터마이징 / Playbook Customization

`playbooks.json` 파일을 수정하여 자동화 시나리오를 추가할 수 있습니다:

**English:** You can add automation scenarios by modifying the `playbooks.json` file:

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

**English Example:**
```json
{
  "name": "customMonitoring",
  "description": "Custom monitoring playbook",
  "steps": [
    {
      "title": "Check CPU Usage",
      "prompt": "Is the current CPU usage above 80%?"
    }
  ]
}
```

## 🧪 테스트 / Testing

```bash
# 단위 테스트 실행
pytest tests/

# 특정 테스트 실행
pytest tests/test_database.py

# 커버리지 포함 테스트
pytest --cov=backend tests/
```

**English:**
```bash
# Run unit tests
pytest tests/

# Run specific tests
pytest tests/test_database.py

# Run tests with coverage
pytest --cov=backend tests/
```

## 📁 프로젝트 구조 / Project Structure

```
AI_DBAgent/
├── backend/              # FastAPI 백엔드 / FastAPI Backend
│   ├── api/             # API 라우터 / API Routers
│   ├── integrations/    # AWS 통합 / AWS Integrations
│   ├── models/          # 데이터 모델 / Data Models
│   ├── monitoring/      # 메트릭 수집기 / Metric Collectors
│   └── services/        # 비즈니스 로직 / Business Logic
├── frontend/            # React 프론트엔드 / React Frontend
│   ├── src/            # 소스 코드 / Source Code
│   └── public/         # 정적 파일 / Static Files
├── agent/              # 백그라운드 에이전트 / Background Agent
├── database/           # DB 스키마 / DB Schema
├── docker/             # Docker 설정 / Docker Configuration
├── scripts/            # 유틸리티 스크립트 / Utility Scripts
├── tests/              # 테스트 코드 / Test Code
└── templates/          # HTML 템플릿 / HTML Templates
```

## 🔍 트러블슈팅 / Troubleshooting

### 일반적인 문제들 / Common Issues

**Q: CloudWatch 데이터가 표시되지 않아요** / **Q: CloudWatch data is not displayed**
- AWS 자격증명이 올바른지 확인 / Check if AWS credentials are correct
- CloudWatch ID가 AWS 콘솔의 인스턴스/클러스터 ID와 정확히 일치하는지 확인 / Verify CloudWatch ID exactly matches AWS console instance/cluster ID
- 해당 리전에 데이터가 있는지 확인 / Check if data exists in the region

**Q: AI 응답이 없어요** / **Q: No AI response**
- AI 모델이 선택되어 있는지 확인 / Check if AI model is selected
- API 키가 유효한지 확인 / Verify API key is valid
- 네트워크 연결 상태 확인 / Check network connection status

**Q: 데이터베이스 연결이 안 돼요** / **Q: Database connection failed**
- 연결 정보 (호스트, 포트, 사용자명, 비밀번호) 확인 / Check connection info (host, port, username, password)
- 방화벽 설정 확인 / Check firewall settings
- 데이터베이스 서버 상태 확인 / Check database server status

### 로그 확인 / Log Checking

```bash
# 애플리케이션 로그
tail -f logs/app.log

# 에러 로그
tail -f logs/error.log

# Docker 로그
docker-compose logs -f app
```

**English:**
```bash
# Application logs
tail -f logs/app.log

# Error logs
tail -f logs/error.log

# Docker logs
docker-compose logs -f app
```

## 🤝 기여하기 / Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

**한국어:**
1. 저장소를 포크하세요
2. 기능 브랜치를 생성하세요 (`git checkout -b feature/amazing-feature`)
3. 변경사항을 커밋하세요 (`git commit -m 'Add some amazing feature'`)
4. 브랜치에 푸시하세요 (`git push origin feature/amazing-feature`)
5. Pull Request를 열어주세요

## 📄 라이선스 / License

이 프로젝트는 MIT 라이선스 하에 배포됩니다. 자세한 내용은 `LICENSE` 파일을 참조하세요.

**English:** This project is distributed under the MIT License. See the `LICENSE` file for more details.

## 🙋‍♂️ 지원 / Support

- **이슈 리포트**: GitHub Issues / **Issue Reports**: GitHub Issues
- **기능 요청**: GitHub Discussions / **Feature Requests**: GitHub Discussions
- **문서**: 프로젝트 Wiki / **Documentation**: Project Wiki

---

**Made with ❤️ for SRE/DBA Engineers**