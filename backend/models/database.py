from typing import Optional, Dict, Any, List
from datetime import datetime
from pydantic import BaseModel
from sqlalchemy import create_engine, Column, Integer, String, Boolean, TIMESTAMP, ForeignKey, Text
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, relationship
import os
from dotenv import load_dotenv

load_dotenv()

SQLALCHEMY_DATABASE_URL = f"postgresql://{os.getenv('DB_USER')}:{os.getenv('DB_PASSWORD')}@{os.getenv('DB_HOST')}:{os.getenv('DB_PORT')}/{os.getenv('DB_NAME')}"
engine = create_engine(SQLALCHEMY_DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

class AwsCredentials(Base):
    __tablename__ = 'aws_credentials'
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(50), nullable=False)
    access_key = Column(String(100), nullable=False)
    secret_key = Column(String(100), nullable=False)
    session_token = Column(String(500))
    region = Column(String(50))
    created_at = Column(TIMESTAMP, server_default="CURRENT_TIMESTAMP")
    updated_at = Column(TIMESTAMP, server_default="CURRENT_TIMESTAMP")
    is_active = Column(Boolean, default=False)

class DatabaseConnection(BaseModel):
    name: str
    host: str
    port: int
    user: str
    password: str
    dbname: str
    cloudwatch_id: Optional[str] = None  # AWS RDS 인스턴스ID (CloudWatch용)
    is_active: bool = True
    created_at: datetime = datetime.now()
    last_checked: Optional[datetime] = None

class DatabaseMetrics(BaseModel):
    db_name: str
    timestamp: datetime
    cpu_usage: Optional[float] = None
    memory_usage: Optional[float] = None
    active_connections: Optional[int] = None
    total_connections: Optional[int] = None
    slow_queries_count: Optional[int] = None
    queries_per_second: Optional[float] = None
    disk_usage: Optional[float] = None
    uptime: Optional[int] = None
    version: Optional[str] = None

class MonitoringConfig(BaseModel):
    db_name: str
    check_interval: int = 60  # seconds
    cpu_threshold: float = 80.0
    memory_threshold: float = 80.0
    connection_threshold: int = 100
    slow_query_threshold: float = 1.0  # seconds
    is_enabled: bool = True

class AlertRule(BaseModel):
    id: str
    name: str
    db_name: str
    metric: str  # cpu, memory, connections, slow_queries
    operator: str  # >, <, >=, <=, ==
    threshold: float
    is_active: bool = True
    created_at: datetime = datetime.now()

class AzureOpenAIConfig(Base):
    __tablename__ = 'azure_openai_configs'
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), unique=True, nullable=False)
    api_key = Column(String(255), nullable=False)
    endpoint = Column(String(255), nullable=False)
    deployment_name = Column(String(255), nullable=False)
    api_version = Column(String(50), nullable=False)
    is_selected = Column(Boolean, default=False)
    created_at = Column(TIMESTAMP, server_default="CURRENT_TIMESTAMP")
    updated_at = Column(TIMESTAMP, server_default="CURRENT_TIMESTAMP")

class GeminiConfig(Base):
    __tablename__ = 'gemini_configs'
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), unique=True, nullable=False)
    api_key = Column(String(255), nullable=False)
    model_name = Column(String(255), nullable=False)
    is_selected = Column(Boolean, default=False)
    created_at = Column(TIMESTAMP, server_default="CURRENT_TIMESTAMP")
    updated_at = Column(TIMESTAMP, server_default="CURRENT_TIMESTAMP")

class ClaudeConfig(Base):
    __tablename__ = 'claude_configs'
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), unique=True, nullable=False)
    api_key = Column(String(255), nullable=False)
    model_name = Column(String(255), nullable=False)
    is_selected = Column(Boolean, default=False)
    created_at = Column(TIMESTAMP, server_default="CURRENT_TIMESTAMP")
    updated_at = Column(TIMESTAMP, server_default="CURRENT_TIMESTAMP")

class Conversation(Base):
    __tablename__ = 'conversations'
    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(255), nullable=False)
    db_name = Column(String(255), nullable=False) # 어떤 DB와 관련된 대화인지
    created_at = Column(TIMESTAMP, server_default="CURRENT_TIMESTAMP")
    updated_at = Column(TIMESTAMP, server_default="CURRENT_TIMESTAMP")

class Message(Base):
    __tablename__ = 'messages'
    id = Column(Integer, primary_key=True, index=True)
    conversation_id = Column(Integer, ForeignKey('conversations.id'), nullable=False)
    role = Column(String(50), nullable=False) # 'user' or 'assistant'
    content = Column(Text, nullable=True)
    sql_query = Column(Text, nullable=True)
    sql_result = Column(Text, nullable=True) # JSON string of result
    timestamp = Column(TIMESTAMP, server_default="CURRENT_TIMESTAMP")

    conversation = relationship("Conversation", backref="messages") 