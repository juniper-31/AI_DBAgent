# AI DBAgent - CloudWatch 기반 DB 모니터링 가이드

## 주요 기능

- **AWS RDS/Aurora CloudWatch 메트릭 실시간 모니터링**
  - 연결 수, CPU 사용률, 메모리, 스토리지, IOPS 등 주요 지표를 카드+그래프 형태로 시각화
- **DB 등록/수정 시 CloudWatch ID(Identifier) 관리**
  - 인스턴스/클러스터 모두 지원 (DBInstanceIdentifier, DBClusterIdentifier)
- **CloudWatch Dimension 자동 판별**
  - cloudwatch_id에 'cluster' 또는 'aurora'가 포함되면 클러스터, 아니면 인스턴스로 자동 구분
- **실무적 UX**
  - 기간/주기 조합에 따라 데이터포인트 한도 초과 방지
  - 에러/데이터 없음 안내, 자동 새로고침 등

---

## 실행 방법

### 1. 환경 변수(.env) 설정

- 프로젝트 루트 또는 backend 디렉토리에 `.env` 파일을 생성하고, 다음과 같이 DB 및 AWS 관련 환경변수를 입력하세요.

```env
# DB 연결 정보
DB_HOST=localhost
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=yourpassword
DB_NAME=ai_dbagent

# (선택) AWS 기본 리전 등
AWS_DEFAULT_REGION=ap-northeast-2
```

---

### 2. Python 백엔드 실행

1. 의존성 설치  
   ```bash
   pip install -r requirements.txt
   ```
2. FastAPI 서버 실행  
   ```bash
   uvicorn main:app --reload
   ```
   - 기본적으로 `http://localhost:8000`에서 API가 실행됩니다.

---

### 3. React 프론트엔드 실행

1. 프론트엔드 디렉토리로 이동  
   ```bash
   cd frontend
   ```
2. 의존성 설치  
   ```bash
   npm install
   ```
3. 개발 서버 실행  
   ```bash
   npm start
   ```
   - 기본적으로 `http://localhost:3000`에서 프론트엔드가 실행됩니다.

---

### 4. 웹 브라우저에서 접속

- 프론트엔드: [http://localhost:3000](http://localhost:3000)
- 백엔드 API: [http://localhost:8000/docs](http://localhost:8000/docs) (Swagger 문서)

---

### 5. 기타

- 최초 실행 시 DB 테이블이 자동 생성됩니다.
- AWS CloudWatch 연동을 위해서는 AWS 자격증명(Access Key/Secret Key 등)이 필요합니다.
- 환경에 따라 CORS, 포트, 프록시 설정이 필요할 수 있습니다.

---

## CloudWatch 모니터링 사용법

### 1. DB 등록/수정 시 CloudWatch ID 입력

- **CloudWatch ID(Identifier)**는 AWS 콘솔의 RDS 인스턴스ID 또는 클러스터ID와 100% 일치해야 합니다.
  - 예시:  
    - 인스턴스: `mydb-instance-01`
    - 클러스터: `mydb-cluster`
- DB 등록/수정 폼에서 CloudWatch ID를 정확히 입력하세요.

### 2. 인스턴스/클러스터 자동 판별

- CloudWatch API 호출 시, cloudwatch_id에 `cluster` 또는 `aurora`가 포함되어 있으면 `DBClusterIdentifier`로,  
  아니면 `DBInstanceIdentifier`로 자동 판별하여 Dimension을 지정합니다.
- 별도의 설정 없이 인스턴스/클러스터 모두 지원합니다.

### 3. 모니터링 화면에서 주요 메트릭 확인

- DB를 선택하면 CloudWatch에서 주요 메트릭을 자동으로 불러와 카드+그래프 형태로 표시합니다.
- 데이터가 없거나 에러가 발생하면 안내 메시지가 표시됩니다.

### 4. 데이터포인트 한도 초과 주의

- AWS CloudWatch API는 한 번에 최대 1,440개 데이터포인트만 반환합니다.
- 기간(예: 7일)과 주기(예: 30초) 조합에 따라 한도를 초과하면 에러가 발생할 수 있습니다.
- 기간을 줄이거나, 주기를 늘려서 사용하세요.

---

## 실무적 체크리스트

- **CloudWatch ID는 AWS 콘솔의 인스턴스/클러스터 ID와 반드시 일치해야 합니다.**
- 데이터가 안 나올 경우:
  1. CloudWatch 콘솔에서 해당 ID, 기간, 메트릭에 데이터가 실제로 있는지 확인
  2. 기간/주기/통계(stat) 파라미터를 바꿔서 테스트
  3. 인스턴스/클러스터 구분이 맞는지 확인
- 모든 메트릭이 비어 있으면 ID/Dimension 불일치 가능성이 높음

---

## 코드 주요 변경점

- `backend/api/monitoring.py`  
  CloudWatch Dimension을 자동 판별하여 인스턴스/클러스터 모두 지원
- 프론트엔드/백엔드 전체에서 cloudwatch_id를 일관되게 사용

---

## 예시

### DB 등록 예시

| 이름         | 호스트           | 포트 | 사용자 | 비밀번호 | DB명   | CloudWatch ID      | 비고      |
|--------------|------------------|------|--------|----------|--------|--------------------|-----------|
| 운영DB       | mydb.xxxx.rds... | 5432 | admin  | ******   | mydb   | mydb-instance-01   | 운영용    |
| 분석클러스터 | aurora.xxxx...   | 3306 | admin  | ******   | aurora | mydb-cluster       | 분석용    |

---

## Troubleshooting

- **CloudWatch ID가 정확한데도 데이터가 없으면?**
  - AWS 콘솔에서 해당 ID, 메트릭, 기간, 주기로 데이터가 실제로 있는지 확인
  - 인스턴스/클러스터 구분이 맞는지 확인
- **에러 메시지: 데이터포인트 한도 초과**
  - 기간을 줄이거나, 주기를 늘려서 요청

---

## 문의/기여

- 실무적 개선, 버그 제보, 기능 제안은 이슈로 남겨주세요!
