import os
import openai
from fastapi import FastAPI, Request, Form, Depends, Body
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from starlette.middleware.sessions import SessionMiddleware
import re
from typing import List, Dict, Any
from openai.types.chat import ChatCompletionMessageParam, ChatCompletionUserMessageParam, ChatCompletionAssistantMessageParam, ChatCompletionSystemMessageParam
import json
import threading
import datetime
import google.generativeai as genai
from anthropic import Anthropic

# Local imports
from backend.config import FRONTEND_ORIGINS, DB_HOST, DB_PORT, DB_USER, DB_PASSWORD, DB_NAME
from backend.database import (
    create_tables_if_not_exists,
    get_app_db_connection,
    execute_sql,
    get_table_schemas,
    get_all_databases,
    test_db_connection,
    get_registered_databases,
    get_openai_keys,
    get_selected_openai_key,
    add_or_update_database,
    delete_database,
    add_or_update_openai_key,
    select_openai_key,
    delete_openai_key,
    get_azure_openai_configs,
    add_or_update_azure_openai_config,
    select_azure_openai_config,
    delete_azure_openai_config,
    get_gemini_configs,
    add_or_update_gemini_config,
    select_gemini_config,
    delete_gemini_config,
    get_claude_configs,
    add_or_update_claude_config,
    select_claude_config,
    delete_claude_config,
    get_selected_ai_model,
    create_conversation,
    get_conversations,
    get_conversation_messages,
    add_message_to_conversation,
    delete_conversation
)
from agent.agent import Agent
from backend.api.monitoring import router as monitoring_router
from backend.api.aws import router as aws_router

# Initialize OpenAI API key globally (can be overridden by selected key from DB)
openai.api_key = os.getenv("OPENAI_API_KEY")

app = FastAPI()

app.add_middleware(
    SessionMiddleware, secret_key="supersecretkey123"
)

# CORS Middleware
from fastapi.middleware.cors import CORSMiddleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=FRONTEND_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Global agent instance
agent_instance = None
agent_thread = None

@app.on_event("startup")
async def startup_event():
    global agent_instance, agent_thread
    print("INFO: FastAPI app startup. Initializing agent...")
    create_tables_if_not_exists()
    
    # Fetch initial DB connections for the agent
    agent_instance = Agent()
    initial_db_connections = get_registered_databases()
    agent_instance.set_db_connections(initial_db_connections)
    
    # Start the agent's loop in a separate thread
    agent_thread = threading.Thread(target=agent_instance.run_loop, daemon=True)
    agent_thread.start()
    print("INFO: Agent thread started.")

@app.on_event("shutdown")
async def shutdown_event():
    print("INFO: FastAPI app shutdown. Stopping agent (if running)...")
    # In a real scenario, you might want a more graceful shutdown for the agent thread
    # For now, relying on daemon=True to terminate with main process.

# API Routers
app.include_router(monitoring_router)
app.include_router(aws_router)

# Slow query log parsing function (PostgreSQL specific implementation needed)
def parse_slow_query_log(log_path, min_time=1.0):
    slow_queries = []
    if not os.path.exists(log_path):
        return slow_queries
    with open(log_path, 'r') as f:
        log = f.read()
    # PostgreSQL slow query log format needs to be adjusted
    pattern = re.compile(r'duration: ([\d\\.]+) ms.*?statement: (SELECT.*?;)', re.DOTALL)
    for match in pattern.finditer(log):
        query_time = float(match.group(1)) / 1000.0  # ms -> s
        query = match.group(2).strip()
        if query_time >= min_time:
            slow_queries.append((query_time, query))
    return slow_queries

def mask_key(key):
    if len(key) < 8:
        return '*' * len(key)
    return key[:3] + '*' * (len(key)-7) + key[-4:]

async def process_single_prompt(
    prompt: str,
    db_name: str,
    db_connections: list,
    chat_history: list
) -> Dict[str, Any]:
    """
    Processes a single prompt, including AI calls and SQL execution,
    and returns a message object to be added to the chat history.
    """
    target_db_info = None
    schema_for_ai = ""
    system_prompt_base = ""

    if db_name == "__ALL_DBS__":
        # For "__ALL_DBS__", the AI will query the application's internal DB
        # to get metadata about all registered databases.
        # The schema provided to AI will be about the internal DB's 'databases' table.
        target_db_info = {
            "host": DB_HOST,
            "port": DB_PORT,
            "user": DB_USER,
            "password": DB_PASSWORD,
            "dbname": DB_NAME
        }
        # Provide schema of the internal 'databases' table to AI
        schema_for_ai = "Table: databases (id INTEGER, name VARCHAR, host VARCHAR, port INTEGER, username VARCHAR, password VARCHAR, dbname VARCHAR)\n"
        schema_for_ai += "\nRegistered Databases:\n" + "\n".join([f"- {db['name']} (Host: {db['host']}, Port: {db['port']}, DB: {db['dbname']})" for db in db_connections])

        system_prompt_base = """당신은 PostgreSQL 데이터베이스 전문가입니다. 사용자의 자연어 질문을 SQL 쿼리로 변환하거나, 데이터베이스 관련 질문에 답변하는 것이 당신의 임무입니다.
당신은 현재 등록된 모든 데이터베이스의 메타데이터(이름, 호스트 등)를 조회할 수 있습니다.
모든 답변은 한국어로 해주세요.

주어진 데이터베이스 스키마와 질문을 바탕으로 질문에 답하는 SQL 쿼리를 생성하고, 그 쿼리에 대한 설명과 실행 결과에 대한 해석을 제공하세요. 필요하다면 추가적인 데이터베이스 관련 정보도 대화하듯이 설명해주세요.

데이터베이스 스키마:
{schema}

지침:
- SQL 쿼리는 반드시 ```sql ... ``` 블록 안에 포함해주세요.
- SQL 쿼리 설명, 실행 결과 해석, 추가 정보 등은 자유롭게 마크다운을 사용하여 설명해주세요.
- 만약 주어진 스키마로 질문에 답할 수 없다면, 그 이유를 한국어로 설명해주세요.
- SQL 방언은 PostgreSQL입니다.
- 데이터베이스 및 SQL과 관련 없는 질문이라도, 먼저 당신의 전문 분야가 데이터베이스임을 밝히고 최선을 다해 답변해 주세요.
- 여러 데이터베이스에 걸친 복잡한 분석 쿼리는 현재 지원되지 않습니다. 각 데이터베이스의 메타데이터를 조회하는 쿼리만 생성할 수 있습니다.
"""
    else:
        # For a specific DB, get its connection info and schema
        target_db_info = next((db for db in db_connections if db["name"] == db_name), None)
        if not target_db_info:
            return {"role": "assistant", "sender": "assistant", "content": None, "sql": "Error", "result": f"DB connection info for {db_name} not found."}

        schema_for_ai = get_table_schemas(target_db_info)
        if not schema_for_ai:
            return {"role": "assistant", "sender": "assistant", "content": None, "sql": "Error", "result": "Could not retrieve DB schema."}
        
        system_prompt_base = """당신은 PostgreSQL 데이터베이스 전문가입니다. 사용자의 자연어 질문을 SQL 쿼리로 변환하거나, 데이터베이스 관련 질문에 답변하는 것이 당신의 임무입니다.\n모든 답변은 한국어로 해주세요.\n\n주어진 데이터베이스 스키마와 질문을 바탕으로 질문에 답하는 SQL 쿼리를 생성하고, 그 쿼리에 대한 설명과 실행 결과에 대한 해석을 제공하세요. 필요하다면 추가적인 데이터베이스 관련 정보도 대화하듯이 설명해주세요.\n\n데이터베이스 스키마:\n{schema}\n\n지침:\n- SQL 쿼리는 반드시 ```sql ... ``` 블록 안에 포함해주세요.\n- SQL 쿼리 설명, 실행 결과 해석, 추가 정보 등은 자유롭게 마크다운을 사용하여 설명해주세요. (예: 제목, 목록, 굵게, 굵게, 코드 블록 등)\n- 만약 주어진 스키마로 질문에 답할 수 없다면, 그 이유를 한국어로 설명해주세요.\n- SQL 방언은 PostgreSQL입니다.\n- 데이터베이스 및 SQL과 관련 없는 질문이라도, 먼저 당신의 전문 분야가 데이터베이스임을 밝히고 최선을 다해 답변해 주세요.\n"""

    error_feedback = ""
    if chat_history and len(chat_history) > 1:
        # Check for previous errors in assistant messages
        for i in range(len(chat_history) - 1, -1, -1):
            if chat_history[i].get("sender") == "assistant":
                last_message = chat_history[i]
                if last_message.get("result") and "Error: " in str(last_message.get("result")):
                    error_feedback = f"이전에 생성된 쿼리에서 오류가 발생했습니다. 오류 내용은 다음과 같습니다: {last_message['result']}. 오류와 사용자 요청을 분석하여 수정된 SQL 쿼리를 생성해주세요."
                break

    system_prompt_content = system_prompt_base.format(schema=schema_for_ai) + error_feedback

    messages_for_api: List[ChatCompletionMessageParam] = [
        ChatCompletionSystemMessageParam(role="system", content=system_prompt_content)
    ]
    # Build context from history, including SQL and its result
    for msg in chat_history:
        if msg.get('role') == 'user':
            messages_for_api.append(ChatCompletionUserMessageParam(role='user', content=str(msg.get('content', ''))))
        elif msg.get('role') == 'assistant':
            assistant_content = ""
            if msg.get('sql'):
                assistant_content += f"SQL: ```sql\n{msg['sql']}\n```\n"
            if msg.get('result'):
                # Format result for AI consumption
                if isinstance(msg['result'], dict) and 'headers' in msg['result'] and 'data' in msg['result']:
                    headers = msg['result']['headers']
                    data = msg['result']['data']
                    if headers and data:
                        # Simple text table format
                        table_str = "| " + " | ".join(headers) + " |\n"
                        table_str += "| " + " | ".join(["---"] * len(headers)) + " |\n"
                        for row in data:
                            table_str += "| " + " | ".join(map(str, row)) + " |\n"
                        assistant_content += f"SQL 실행 결과:\n```\n{table_str}\n```\n"
                    else:
                        assistant_content += f"SQL 실행 결과: (데이터 없음)\n"
                else:
                    assistant_content += f"SQL 실행 결과: {json.dumps(msg['result'], ensure_ascii=False)}\n"
            elif msg.get('content'): # If no SQL/result, use general content
                assistant_content += msg['content']
            
            if assistant_content:
                messages_for_api.append(ChatCompletionAssistantMessageParam(role='assistant', content=assistant_content))

    # Add the current user's prompt to the list of messages for the API
    messages_for_api.append(ChatCompletionUserMessageParam(role="user", content=prompt))

    selected_ai_model = get_selected_ai_model()
    if not selected_ai_model:
        return {"role": "assistant", "sender": "assistant", "content": None, "sql": "Error", "result": "사용할 AI 모델을 먼저 선택해주세요."}

    client = None
    model_to_use = None
    if selected_ai_model["type"] == "openai":
        client = openai.OpenAI(api_key=selected_ai_model["api_key"])
        model_to_use = "gpt-4" # Default model for OpenAI
    elif selected_ai_model["type"] == "azure_openai":
        client = openai.AzureOpenAI(
            api_key=selected_ai_model["api_key"],
            api_version=selected_ai_model["api_version"],
            azure_endpoint=selected_ai_model["endpoint"]
        )
        model_to_use = selected_ai_model["deployment_name"]
    elif selected_ai_model["type"] == "gemini":
        genai.configure(api_key=selected_ai_model["api_key"])
        client = genai.GenerativeModel(selected_ai_model["model_name"])
        model_to_use = selected_ai_model["model_name"]
    elif selected_ai_model["type"] == "claude":
        client = Anthropic(api_key=selected_ai_model["api_key"])
        model_to_use = selected_ai_model["model_name"]
    else:
        return {"role": "assistant", "sender": "assistant", "content": None, "sql": "Error", "result": f"지원하지 않는 AI 모델 타입입니다: {selected_ai_model['type']}"}

    try:
        if selected_ai_model["type"] in ["openai", "azure_openai"]:
            completion = client.chat.completions.create(
                model=model_to_use,
                messages=messages_for_api,
                temperature=0,
            )
            ai_response_content = completion.choices[0].message.content
        elif selected_ai_model["type"] == "gemini":
            # Gemini API expects messages in a different format
            gemini_messages = []
            for msg in messages_for_api:
                if msg["role"] == "system":
                    # Gemini doesn't have a direct system role, integrate into user message or initial prompt
                    gemini_messages.append({"role": "user", "parts": [msg["content"]]})
                    gemini_messages.append({"role": "model", "parts": ["Ok."]}) # Acknowledge system prompt
                elif msg["role"] == "user":
                    gemini_messages.append({"role": "user", "parts": [msg["content"]]})
                elif msg["role"] == "assistant":
                    gemini_messages.append({"role": "model", "parts": [msg["content"]]})
            
            # For Gemini, the last message should be from the user to get a response
            if gemini_messages and gemini_messages[-1]["role"] == "model":
                gemini_messages.append({"role": "user", "parts": [prompt]}) # Re-add the last user prompt if needed

            response = client.generate_content(gemini_messages)
            ai_response_content = response.text
        elif selected_ai_model["type"] == "claude":
            # Claude API expects messages in a different format
            claude_messages = []
            system_message = ""
            for msg in messages_for_api:
                if msg["role"] == "system":
                    system_message = msg["content"]
                elif msg["role"] == "user":
                    claude_messages.append({"role": "user", "content": msg["content"]})
                elif msg["role"] == "assistant":
                    claude_messages.append({"role": "assistant", "content": msg["content"]})
            
            response = client.messages.create(
                model=model_to_use,
                max_tokens=1024,
                messages=claude_messages,
                system=system_message
            )
            ai_response_content = response.content[0].text
        else:
            ai_response_content = ""

        ai_response_sql = ai_response_content.strip() if ai_response_content else ""
        
        sql_to_run = None
        # Extract SQL from AI response
        sql_match = re.search(r"```sql\s*([\s\S]+?)```", ai_response_sql, re.IGNORECASE)
        if sql_match:
            sql_to_run = sql_match.group(1).strip()
        elif ai_response_sql.lower().strip().startswith(('select', 'show', 'explain', 'with')):
             sql_to_run = ai_response_sql
        
        result_message = ""
        bubble_content = ai_response_sql # Default to AI's full response for bubble content
        
        # If AI explicitly states it can't answer or gives a general error
        if "I can't answer this question" in ai_response_sql or "죄송합니다" in ai_response_sql:
             result_message = ai_response_sql
             sql_to_run = None
             bubble_content = ai_response_sql # Ensure the refusal message is shown
        elif not sql_to_run:
             # If no SQL was generated, and it's not a refusal, just show AI's content
             pass
        
        # If AI response is exactly the SQL, don't duplicate in bubble_content
        if sql_to_run and sql_to_run == bubble_content:
            bubble_content = None

        ai_message: Dict[str, Any] = {"role": "assistant", "sender": "assistant", "content": bubble_content, "sql": sql_to_run, "result": None}

        if sql_to_run:
            try:
                # Execute SQL against the determined target_db_info
                headers, result_data = execute_sql(sql_to_run, target_db_info)
                # Convert datetime objects in result_data to strings for JSON serialization
                serialized_data = []
                for row in result_data:
                    serialized_row = []
                    for item in row:
                        if isinstance(item, datetime.datetime):
                            serialized_row.append(item.isoformat())
                        else:
                            serialized_row.append(item)
                    serialized_data.append(tuple(serialized_row))
                ai_message["result"] = {"headers": headers, "data": serialized_data}
            except Exception as e:
                ai_message["result"] = f"Error: {e}"
        else:
            if result_message: # If there's a refusal message
                ai_message["result"] = result_message

        return ai_message

    except Exception as e:
        return {"role": "assistant", "sender": "assistant", "content": None, "sql": "Error", "result": f"An error occurred with OpenAI: {e}"}

def get_playbooks():
    try:
        with open('playbooks.json', 'r', encoding='utf-8') as f:
            return json.load(f)
    except (FileNotFoundError, json.JSONDecodeError):
        return []

# Health check and system info endpoints
@app.get("/health")
def health_check():
    """헬스체크 엔드포인트"""
    return {"status": "healthy", "timestamp": datetime.datetime.now().isoformat()}

@app.get("/api/system/info")
def system_info():
    """시스템 정보 조회"""
    import platform
    import psutil
    
    return {
        "system": {
            "platform": platform.platform(),
            "python_version": platform.python_version(),
            "cpu_count": psutil.cpu_count(),
            "memory_total": psutil.virtual_memory().total,
            "memory_available": psutil.virtual_memory().available
        },
        "application": {
            "name": "AI DBAgent",
            "version": "1.0.0",
            "agent_running": agent_instance is not None and agent_thread is not None
        }
    }

# JSON API Endpoints (for React app)
@app.get("/api/databases")
def api_get_databases():
    databases = get_registered_databases()
    return {"databases": databases}

@app.post("/api/databases")
def api_add_database(
    name: str = Form(...),
    host: str = Form(...),
    port: str = Form(...),
    user: str = Form(''),
    password: str = Form(''),
    dbname: str = Form(''),
    remark: str = Form(None),  # 비고(설명) 필드 추가, 선택사항
    cloudwatch_id: str = Form(None)  # AWS RDS 인스턴스ID (CloudWatch용)
):
    success, message = add_or_update_database(name, host, port, user, password, dbname, remark, cloudwatch_id)
    if success:
        # Update agent with new database list
        if agent_instance:
            agent_instance.set_db_connections(get_registered_databases())
        return {"status": "success", "databases": get_registered_databases()}
    else:
        return {"status": "error", "message": message}

@app.delete("/api/databases/{name}")
def api_delete_database(name: str):
    success, message = delete_database(name)
    if success:
        # Update agent with new database list
        if agent_instance:
            agent_instance.set_db_connections(get_registered_databases())
        return {"status": "success", "databases": get_registered_databases()}
    else:
        return {"status": "error", "message": message}

@app.get("/api/openai/keys")
def api_get_openai_keys_endpoint():
    keys = get_openai_keys()
    selected_key = next((k["name"] for k in keys if k["is_selected"]), None)
    return {"keys": keys, "selected": selected_key}

@app.post("/api/openai/keys")
def api_add_openai_key_endpoint(name: str = Form(...), key: str = Form(...)):
    success, message = add_or_update_openai_key(name, key)
    if success:
        return {"status": "success"}
    else:
        return {"status": "error", "message": message}

@app.post("/api/openai/select")
def api_select_openai_key_endpoint(name: str = Form(...)):
    success, message = select_openai_key(name)
    if success:
        return {"status": "success"}
    else:
        return {"status": "error", "message": message}

@app.delete("/api/openai/keys/{name}")
def api_delete_openai_key_endpoint(name: str):
    success, message = delete_openai_key(name)
    if success:
        return {"status": "success"}
    else:
        return {"status": "error", "message": message}

@app.get("/api/azure-openai/configs")
def api_get_azure_openai_configs_endpoint():
    configs = get_azure_openai_configs()
    selected_config = next((c["name"] for c in configs if c["is_selected"]), None)
    return {"configs": configs, "selected": selected_config}

@app.post("/api/azure-openai/configs")
def api_add_azure_openai_config_endpoint(
    name: str = Form(...),
    api_key: str = Form(...),
    endpoint: str = Form(...),
    deployment_name: str = Form(...),
    api_version: str = Form(...)
):
    success, message = add_or_update_azure_openai_config(name, api_key, endpoint, deployment_name, api_version)
    if success:
        return {"status": "success"}
    else:
        return {"status": "error", "message": message}

@app.post("/api/azure-openai/select")
def api_select_azure_openai_config_endpoint(name: str = Form(...)):
    success, message = select_azure_openai_config(name)
    if success:
        return {"status": "success"}
    else:
        return {"status": "error", "message": message}

@app.delete("/api/azure-openai/configs/{name}")
def api_delete_azure_openai_config_endpoint(name: str):
    success, message = delete_azure_openai_config(name)
    if success:
        return {"status": "success"}
    else:
        return {"status": "error", "message": message}

@app.get("/api/gemini/configs")
def api_get_gemini_configs_endpoint():
    configs = get_gemini_configs()
    selected_config = next((c["name"] for c in configs if c["is_selected"]), None)
    return {"configs": configs, "selected": selected_config}

@app.post("/api/gemini/configs")
def api_add_gemini_config_endpoint(
    name: str = Form(...),
    api_key: str = Form(...),
    model_name: str = Form(...)
):
    success, message = add_or_update_gemini_config(name, api_key, model_name)
    if success:
        return {"status": "success"}
    else:
        return {"status": "error", "message": message}

@app.post("/api/gemini/select")
def api_select_gemini_config_endpoint(name: str = Form(...)):
    success, message = select_gemini_config(name)
    if success:
        return {"status": "success"}
    else:
        return {"status": "error", "message": message}

@app.delete("/api/gemini/configs/{name}")
def api_delete_gemini_config_endpoint(name: str):
    success, message = delete_gemini_config(name)
    if success:
        return {"status": "success"}
    else:
        return {"status": "error", "message": message}

@app.get("/api/claude/configs")
def api_get_claude_configs_endpoint():
    configs = get_claude_configs()
    selected_config = next((c["name"] for c in configs if c["is_selected"]), None)
    return {"configs": configs, "selected": selected_config}

@app.post("/api/claude/configs")
def api_add_claude_config_endpoint(
    name: str = Form(...),
    api_key: str = Form(...),
    model_name: str = Form(...)
):
    success, message = add_or_update_claude_config(name, api_key, model_name)
    if success:
        return {"status": "success"}
    else:
        return {"status": "error", "message": message}

@app.post("/api/claude/select")
def api_select_claude_config_endpoint(name: str = Form(...)):
    success, message = select_claude_config(name)
    if success:
        return {"status": "success"}
    else:
        return {"status": "error", "message": message}

@app.delete("/api/claude/configs/{name}")
def api_delete_claude_config_endpoint(name: str):
    success, message = delete_claude_config(name)
    if success:
        return {"status": "success"}
    else:
        return {"status": "error", "message": message}

@app.get("/api/playbooks")
def api_get_playbooks_endpoint():
    return get_playbooks()

@app.post("/api/conversations/new")
async def api_create_new_conversation(db_name: str = Form(...), title: str = Form(...)):
    conversation_id, error = create_conversation(title, db_name)
    if error:
        raise HTTPException(status_code=500, detail=f"대화 생성 실패: {error}")
    return {"status": "success", "conversation_id": conversation_id}

@app.get("/api/conversations")
async def api_get_conversations(db_name: str = None):
    conversations, error = get_conversations(db_name)
    if error:
        raise HTTPException(status_code=500, detail=f"대화 목록 조회 실패: {error}")
    return {"status": "success", "conversations": conversations}

@app.get("/api/conversations/{conversation_id}/messages")
async def api_get_conversation_messages(conversation_id: int):
    messages, error = get_conversation_messages(conversation_id)
    if error:
        raise HTTPException(status_code=500, detail=f"메시지 조회 실패: {error}")
    return {"status": "success", "messages": messages}

@app.delete("/api/conversations/{conversation_id}")
async def api_delete_conversation(conversation_id: int):
    success, error = delete_conversation(conversation_id)
    if error:
        raise HTTPException(status_code=500, detail=f"대화 삭제 실패: {error}")
    return {"status": "success"}

@app.post("/api/nl2sql")
async def api_nl2sql_chat(request: Request, db_name: str = Form(...), prompt: str = Form(...), conversation_id: int = Form(None)):
    if not prompt:
        return {"error": "프롬프트가 필요합니다."}

    # 대화 ID가 없으면 새로운 대화 생성 (첫 메시지)
    current_conversation_id = conversation_id
    if not current_conversation_id:
        # 대화 제목은 첫 프롬프트로 설정하거나, 나중에 AI가 요약하도록 할 수 있음
        title = prompt[:50] + "..." if len(prompt) > 50 else prompt
        new_conv_id, error = create_conversation(title, db_name)
        if error:
            raise HTTPException(status_code=500, detail=f"새 대화 생성 실패: {error}")
        current_conversation_id = new_conv_id

    # 이전 메시지 불러오기 (AI 모델에 전달할 컨텍스트)
    messages_from_db, error = get_conversation_messages(current_conversation_id)
    if error:
        raise HTTPException(status_code=500, detail=f"이전 메시지 불러오기 실패: {error}")
    
    # DB에서 불러온 메시지를 chat_history 형식으로 변환
    chat_history = []
    for msg in messages_from_db:
        chat_history.append({
            "role": msg["role"],
            "content": msg["content"],
            "sql": msg["sql_query"],
            "result": json.loads(msg["sql_result"]) if msg["sql_result"] else None,
            "timestamp": msg["timestamp"].isoformat() if msg["timestamp"] else None
        })

    # 사용자 메시지 DB에 저장
    success, error = add_message_to_conversation(
        current_conversation_id, "user", content=prompt
    )
    if not success:
        raise HTTPException(status_code=500, detail=f"사용자 메시지 저장 실패: {error}")

    db_connections = get_registered_databases()
    
    ai_message = await process_single_prompt(
        prompt=prompt,
        db_name=db_name,
        db_connections=db_connections,
        chat_history=chat_history # 이전 대화 기록 전달
    )
    
    # AI 응답 메시지 DB에 저장
    success, error = add_message_to_conversation(
        current_conversation_id,
        "assistant",
        content=ai_message["content"],
        sql_query=ai_message["sql"],
        sql_result=json.dumps(ai_message["result"], ensure_ascii=False) if ai_message["result"] else None
    )
    if not success:
        raise HTTPException(status_code=500, detail=f"AI 응답 메시지 저장 실패: {error}")

    # 응답에 conversation_id 포함
    ai_message["conversation_id"] = current_conversation_id
    
    return {
        "status": "success",
        "message": ai_message
    }

@app.post("/api/nl2sql/reset")
def api_nl2sql_reset(conversation_id: int = Form(...)):
    success, error = delete_conversation(conversation_id)
    if error:
        raise HTTPException(status_code=500, detail=f"대화 초기화 실패: {error}")
    return {"status": "success"}

@app.post("/api/databases/test")
def api_test_database_endpoint(dbinfo: dict = Body(...)):
    success, message = test_db_connection(dbinfo)
    if success:
        return {"success": True}
    else:
        return {"success": False, "message": message}

@app.post("/api/databases/browse")
def api_browse_databases_endpoint(host: str = Form(...), port: str = Form(...), user: str = Form(''), password: str = Form('')):
    dbinfo = {
        "host": host,
        "port": int(port),
        "user": user,
        "password": password,
        "dbname": "postgres" # Connect to default postgres DB to list all DBs
    }
    try:
        databases = get_all_databases(dbinfo)
        if not databases:
            return {"status": "error", "message": "데이터베이스 목록을 가져올 수 없습니다. 연결 정보를 확인하거나, 'postgres' 데이터베이스에 접근 권한이 있는지 확인해주세요.", "databases": []}
        return {"status": "success", "databases": databases}
    except Exception as e:
        return {"status": "error", "message": f"데이터베이스 목록을 가져오는 중 오류 발생: {e}", "databases": []}

# Serve React app
app.mount("/", StaticFiles(directory="frontend/build", html=True), name="static")

@app.exception_handler(404)
async def not_found(request, exc):
    return FileResponse('frontend/build/index.html')

# Run server
if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)