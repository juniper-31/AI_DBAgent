-- AI DBAgent 데이터베이스 초기화 스크립트

-- 확장 설치 (필요한 경우)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 기본 테이블들은 애플리케이션에서 자동 생성되므로 여기서는 기본 설정만

-- 기본 관리자 계정 생성 (선택사항)
-- INSERT INTO users (username, email, is_admin) VALUES ('admin', 'admin@example.com', true);

-- 샘플 데이터 (개발용)
-- INSERT INTO databases (name, host, port, username, password, dbname, remark) 
-- VALUES ('sample_db', 'localhost', 5432, 'postgres', 'password', 'sampledb', '샘플 데이터베이스');

-- 인덱스 생성 (성능 최적화)
-- CREATE INDEX IF NOT EXISTS idx_conversations_db_name ON conversations(db_name);
-- CREATE INDEX IF NOT EXISTS idx_messages_conversation_id ON messages(conversation_id);
-- CREATE INDEX IF NOT EXISTS idx_messages_timestamp ON messages(timestamp);

-- 권한 설정
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO dbagentuser;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO dbagentuser;