"""
데이터베이스 관련 테스트
"""
import pytest
import psycopg2
from backend.database import (
    get_registered_databases,
    add_or_update_database,
    delete_database,
    test_db_connection
)


class TestDatabase:
    """데이터베이스 기능 테스트"""
    
    def test_add_database(self):
        """데이터베이스 추가 테스트"""
        success, message = add_or_update_database(
            name="test_db",
            host="localhost",
            port="5432",
            user="test_user",
            password="test_password",
            dbname="test_dbname",
            remark="테스트용 DB"
        )
        assert success is True
        
        # 추가된 DB 확인
        databases = get_registered_databases()
        test_db = next((db for db in databases if db["name"] == "test_db"), None)
        assert test_db is not None
        assert test_db["host"] == "localhost"
        assert test_db["remark"] == "테스트용 DB"
    
    def test_delete_database(self):
        """데이터베이스 삭제 테스트"""
        # 먼저 테스트 DB 추가
        add_or_update_database(
            name="test_db_to_delete",
            host="localhost",
            port="5432",
            user="test_user",
            password="test_password",
            dbname="test_dbname"
        )
        
        # 삭제
        success, message = delete_database("test_db_to_delete")
        assert success is True
        
        # 삭제 확인
        databases = get_registered_databases()
        test_db = next((db for db in databases if db["name"] == "test_db_to_delete"), None)
        assert test_db is None
    
    def test_connection_test(self):
        """데이터베이스 연결 테스트"""
        # 유효하지 않은 연결 정보로 테스트
        db_info = {
            "host": "invalid_host",
            "port": 5432,
            "user": "invalid_user",
            "password": "invalid_password",
            "dbname": "invalid_db"
        }
        
        success, error = test_db_connection(db_info)
        assert success is False
        assert error is not None
    
    def teardown_method(self):
        """테스트 후 정리"""
        # 테스트용 DB 삭제
        try:
            delete_database("test_db")
            delete_database("test_db_to_delete")
        except:
            pass