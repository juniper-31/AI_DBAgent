"""
MCP 관련 API 엔드포인트
"""
from fastapi import APIRouter, Form, HTTPException
from backend.services.mcp_manager import mcp_manager
from backend.services.ai_chat_service import ai_chat_service

router = APIRouter(prefix="/api/mcp", tags=["mcp"])

@router.get("/status")
def get_mcp_status():
    """MCP 상태 조회"""
    try:
        context = ai_chat_service.get_full_context_for_ai()
        return {
            "status": "success",
            "data": context
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"MCP 상태 조회 실패: {str(e)}")

@router.get("/databases")
def get_mcp_databases():
    """MCP에 등록된 데이터베이스 목록 조회"""
    try:
        mcp_dbs = mcp_manager.get_mcp_databases()
        return {
            "status": "success",
            "databases": mcp_dbs
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"MCP 데이터베이스 목록 조회 실패: {str(e)}")

@router.post("/sync")
def sync_databases_with_mcp():
    """데이터베이스와 MCP 동기화"""
    try:
        result = ai_chat_service.sync_databases_with_mcp()
        if result["success"]:
            return {
                "status": "success",
                "message": result["message"],
                "data": result["context"]
            }
        else:
            raise HTTPException(status_code=500, detail=result["message"])
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"동기화 실패: {str(e)}")

@router.get("/config")
def get_mcp_config():
    """MCP 설정 조회"""
    try:
        config = mcp_manager.load_mcp_config()
        return {
            "status": "success",
            "config": config
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"MCP 설정 조회 실패: {str(e)}")

@router.get("/context")
def get_ai_context():
    """AI 채팅용 컨텍스트 조회"""
    try:
        context = ai_chat_service.get_full_context_for_ai()
        formatted_context = ai_chat_service.format_context_for_prompt()
        recommendations = ai_chat_service.get_database_recommendations()
        
        return {
            "status": "success",
            "context": context,
            "formatted_context": formatted_context,
            "recommendations": recommendations
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"컨텍스트 조회 실패: {str(e)}")

@router.post("/database/{db_name}/add")
def add_database_to_mcp(db_name: str):
    """특정 데이터베이스를 MCP에 수동 추가"""
    try:
        from backend.database import get_registered_databases
        
        # 등록된 데이터베이스에서 해당 DB 찾기
        databases = get_registered_databases()
        target_db = next((db for db in databases if db["name"] == db_name), None)
        
        if not target_db:
            raise HTTPException(status_code=404, detail=f"데이터베이스 '{db_name}'을 찾을 수 없습니다.")
        
        db_info = {
            'host': target_db['host'],
            'port': target_db['port'],
            'user': target_db['user'],
            'password': target_db['password'],
            'dbname': target_db['dbname']
        }
        
        mcp_manager.add_database_to_mcp(db_name, db_info)
        
        return {
            "status": "success",
            "message": f"데이터베이스 '{db_name}'이 MCP에 추가되었습니다."
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"MCP 데이터베이스 추가 실패: {str(e)}")

@router.delete("/database/{db_name}")
def remove_database_from_mcp(db_name: str):
    """특정 데이터베이스를 MCP에서 제거"""
    try:
        mcp_manager.remove_database_from_mcp(db_name)
        return {
            "status": "success",
            "message": f"데이터베이스 '{db_name}'이 MCP에서 제거되었습니다."
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"MCP 데이터베이스 제거 실패: {str(e)}")