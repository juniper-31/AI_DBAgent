-- AWS 인증 정보 테이블에 auth_type 컬럼 추가
-- IAM Role 방식 지원을 위한 스키마 변경

-- auth_type 컬럼 추가 (기본값: 'access_key')
ALTER TABLE aws_credentials 
ADD COLUMN IF NOT EXISTS auth_type VARCHAR(20) NOT NULL DEFAULT 'access_key';

-- 기존 access_key, secret_key 컬럼을 nullable로 변경
ALTER TABLE aws_credentials 
ALTER COLUMN access_key DROP NOT NULL,
ALTER COLUMN secret_key DROP NOT NULL;

-- auth_type에 대한 체크 제약 조건 추가
ALTER TABLE aws_credentials 
ADD CONSTRAINT chk_auth_type 
CHECK (auth_type IN ('access_key', 'iam_role'));

-- IAM Role 방식일 때는 access_key, secret_key가 null이어야 하고
-- Access Key 방식일 때는 access_key, secret_key가 필수인 제약 조건 추가
ALTER TABLE aws_credentials 
ADD CONSTRAINT chk_credentials_consistency 
CHECK (
    (auth_type = 'iam_role' AND access_key IS NULL AND secret_key IS NULL) OR
    (auth_type = 'access_key' AND access_key IS NOT NULL AND secret_key IS NOT NULL)
);

-- 기존 데이터의 auth_type을 'access_key'로 설정 (이미 기본값으로 설정됨)
UPDATE aws_credentials 
SET auth_type = 'access_key' 
WHERE auth_type IS NULL;