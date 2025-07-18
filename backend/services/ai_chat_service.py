"""
AI 채팅 서비스
MCP와 등록된 데이터베이스 정보를 통합하여 AI 채팅에 활용합니다.
"""
import json
from typing import Dict, List, Optional, Any
from backend.database import get_registered_databases, get_selected_ai_model
from backend.services.mcp_manager import mcp_manager

class AIChatService:
    def __init__(self):
        self.mcp_manager = mcp_manager
    
    def get_database_context(self) -> Dict[str, Any]:
        """등록된 데이터베이스 정보와 MCP 상태를 반환"""
        registered_dbs = get_registered_databases()
        mcp_dbs = self.mcp_manager.get_mcp_databases()
        
        context = {
            "registered_databases": [],
            "mcp_status": {
                "enabled_databases": mcp_dbs,
                "total_mcp_servers": len(mcp_dbs)
            },
            "summary": {
                "total_registered": len(registered_dbs),
                "mcp_enabled": len(mcp_dbs),
                "sync_status": "synced" if len(registered_dbs) == len(mcp_dbs) else "out_of_sync"
            }
        }
        
        for db in registered_dbs:
            db_info = {
                "name": db['name'],
                "host": db['host'],
                "port": db['port'],
                "dbname": db['dbname'],
                "cloudwatch_id": db.get('cloudwatch_id'),
                "mcp_enabled": db['name'] in mcp_dbs,
                "connection_string": f"postgresql://{db['user']}:***@{db['host']}:{db['port']}/{db['dbname']}"
            }
            context["registered_databases"].append(db_info)
        
        return context
    
    def get_ai_model_context(self) -> Dict[str, Any]:
        """선택된 AI 모델 정보를 반환"""
        selected_model = get_selected_ai_model()
        if not selected_model:
            return {"status": "no_model_selected", "model": None}
        
        return {
            "status": "model_selected",
            "model": {
                "type": selected_model['type'],
                "name": selected_model['name'],
                "has_api_key": bool(selected_model.get('api_key'))
            }
        }
    
    def get_mcp_tools_context(self) -> Dict[str, Any]:
        """MCP 도구들의 상태와 기능을 반환"""
        config = self.mcp_manager.load_mcp_config()
        
        tools_context = {
            "available_tools": [],
            "database_tools": [],
            "general_tools": []
        }
        
        for server_name, server_config in config.get("mcpServers", {}).items():
            if server_config.get("disabled", False):
                continue
                
            tool_info = {
                "server_name": server_name,
                "command": server_config.get("command"),
                "auto_approved": server_config.get("autoApprove", []),
                "type": "database" if server_name.startswith("postgres_") else "general"
            }
            
            tools_context["available_tools"].append(tool_info)
            
            if tool_info["type"] == "database":
                db_name = server_name.replace("postgres_", "")
                tool_info["database_name"] = db_name
                tools_context["database_tools"].append(tool_info)
            else:
                tools_context["general_tools"].append(tool_info)
        
        return tools_context
    
    def get_full_context_for_ai(self) -> Dict[str, Any]:
        """AI 채팅에 필요한 모든 컨텍스트를 통합하여 반환"""
        return {
            "databases": self.get_database_context(),
            "ai_model": self.get_ai_model_context(),
            "mcp_tools": self.get_mcp_tools_context(),
            "capabilities": {
                "can_query_databases": True,
                "can_analyze_schemas": True,
                "can_generate_sql": True,
                "can_execute_queries": True,
                "mcp_integration": True
            }
        }
    
    def format_context_for_prompt(self) -> str:
        """AI 프롬프트에 포함할 수 있는 형태로 컨텍스트를 포맷팅"""
        context = self.get_full_context_for_ai()
        
        prompt_parts = []
        
        # 데이터베이스 정보
        if context["databases"]["registered_databases"]:
            prompt_parts.append("=== 등록된 데이터베이스 ===")
            for db in context["databases"]["registered_databases"]:
                mcp_status = "MCP 연동됨" if db["mcp_enabled"] else "MCP 연동 안됨"
                prompt_parts.append(f"- {db['name']}: {db['host']}:{db['port']}/{db['dbname']} ({mcp_status})")
        
        # MCP 도구 정보
        if context["mcp_tools"]["database_tools"]:
            prompt_parts.append("\n=== 사용 가능한 데이터베이스 MCP 도구 ===")
            for tool in context["mcp_tools"]["database_tools"]:
                prompt_parts.append(f"- {tool['database_name']}: {', '.join(tool['auto_approved'])}")
        
        # AI 모델 정보
        if context["ai_model"]["status"] == "model_selected":
            model = context["ai_model"]["model"]
            prompt_parts.append(f"\n=== 현재 AI 모델 ===")
            prompt_parts.append(f"- 타입: {model['type']}, 이름: {model['name']}")
        
        return "\n".join(prompt_parts)
    
    def sync_databases_with_mcp(self) -> Dict[str, Any]:
        """데이터베이스와 MCP 동기화 실행"""
        try:
            self.mcp_manager.sync_all_databases()
            return {
                "success": True,
                "message": "데이터베이스와 MCP가 성공적으로 동기화되었습니다.",
                "context": self.get_database_context()
            }
        except Exception as e:
            return {
                "success": False,
                "message": f"동기화 중 오류가 발생했습니다: {str(e)}",
                "context": None
            }
    
    def get_database_recommendations(self) -> List[str]:
        """데이터베이스 사용에 대한 추천사항 반환"""
        context = self.get_database_context()
        recommendations = []
        
        if context["summary"]["total_registered"] == 0:
            recommendations.append("데이터베이스를 먼저 등록해주세요.")
        
        if context["summary"]["sync_status"] == "out_of_sync":
            recommendations.append("데이터베이스와 MCP 동기화가 필요합니다.")
        
        if context["summary"]["mcp_enabled"] == 0 and context["summary"]["total_registered"] > 0:
            recommendations.append("MCP 연동을 활성화하면 더 강력한 데이터베이스 기능을 사용할 수 있습니다.")
        
        ai_context = self.get_ai_model_context()
        if ai_context["status"] == "no_model_selected":
            recommendations.append("AI 모델을 선택해주세요.")
        
        return recommendations

# 전역 AI 채팅 서비스 인스턴스
ai_chat_service = AIChatService()