import psycopg2
from psycopg2.extras import RealDictCursor
import os
from backend.config import DB_HOST, DB_PORT, DB_USER, DB_PASSWORD, DB_NAME

def get_app_db_connection():
    """Helper to get a connection to the application's internal database."""
    return psycopg2.connect(
        host=DB_HOST,
        port=DB_PORT,
        user=DB_USER,
        password=DB_PASSWORD,
        dbname=DB_NAME
    )

def create_tables_if_not_exists():
    """Creates necessary tables for storing database connections and OpenAI keys."""
    conn = None
    try:
        conn = get_app_db_connection()
        cur = conn.cursor()

        # Create databases table (cloudwatch_id, 비고 컬럼 추가)
        cur.execute("""
            CREATE TABLE IF NOT EXISTS databases (
                id SERIAL PRIMARY KEY,
                name VARCHAR(255) UNIQUE NOT NULL,
                host VARCHAR(255) NOT NULL,
                port INTEGER NOT NULL,
                username VARCHAR(255),
                password VARCHAR(255),
                dbname VARCHAR(255),
                cloudwatch_id VARCHAR(255),  -- AWS RDS 인스턴스ID
                remark VARCHAR(255)  -- 비고(설명) 컬럼 추가
            );
        """)
        # 이미 있는 경우 cloudwatch_id, remark 컬럼이 없으면 추가
        cur.execute("""
            DO $$
            BEGIN
                IF NOT EXISTS (
                    SELECT 1 FROM information_schema.columns 
                    WHERE table_name='databases' AND column_name='cloudwatch_id'
                ) THEN
                    ALTER TABLE databases ADD COLUMN cloudwatch_id VARCHAR(255);
                END IF;
                IF NOT EXISTS (
                    SELECT 1 FROM information_schema.columns 
                    WHERE table_name='databases' AND column_name='remark'
                ) THEN
                    ALTER TABLE databases ADD COLUMN remark VARCHAR(255);
                END IF;
            END$$;
        """)

        # Create openai_keys table
        cur.execute("""
            CREATE TABLE IF NOT EXISTS openai_keys (
                id SERIAL PRIMARY KEY,
                name VARCHAR(255) UNIQUE NOT NULL,
                api_key VARCHAR(255) NOT NULL,
                is_selected BOOLEAN DEFAULT FALSE
            );
        """)

        # Create azure_openai_configs table
        cur.execute("""
            CREATE TABLE IF NOT EXISTS azure_openai_configs (
                id SERIAL PRIMARY KEY,
                name VARCHAR(255) UNIQUE NOT NULL,
                api_key VARCHAR(255) NOT NULL,
                endpoint VARCHAR(255) NOT NULL,
                deployment_name VARCHAR(255) NOT NULL,
                api_version VARCHAR(50) NOT NULL,
                is_selected BOOLEAN DEFAULT FALSE
            );
        """)

        # Create gemini_configs table
        cur.execute("""
            CREATE TABLE IF NOT EXISTS gemini_configs (
                id SERIAL PRIMARY KEY,
                name VARCHAR(255) UNIQUE NOT NULL,
                api_key VARCHAR(255) NOT NULL,
                model_name VARCHAR(255) NOT NULL,
                is_selected BOOLEAN DEFAULT FALSE
            );
        """)

        # Create claude_configs table
        cur.execute("""
            CREATE TABLE IF NOT EXISTS claude_configs (
                id SERIAL PRIMARY KEY,
                name VARCHAR(255) UNIQUE NOT NULL,
                api_key VARCHAR(255) NOT NULL,
                model_name VARCHAR(255) NOT NULL,
                is_selected BOOLEAN DEFAULT FALSE
            );
        """)

        # Create conversations table
        cur.execute("""
            CREATE TABLE IF NOT EXISTS conversations (
                id SERIAL PRIMARY KEY,
                title VARCHAR(255) NOT NULL,
                db_name VARCHAR(255) NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        """)

        # Create messages table
        cur.execute("""
            CREATE TABLE IF NOT EXISTS messages (
                id SERIAL PRIMARY KEY,
                conversation_id INTEGER NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
                role VARCHAR(50) NOT NULL,
                content TEXT,
                sql_query TEXT,
                sql_result TEXT,
                timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        """)

        conn.commit()
        print("INFO: Database tables checked/created successfully.")
    except Exception as e:
        print(f"ERROR: Failed to create database tables: {e}")
    finally:
        if conn:
            conn.close()

def execute_sql(sql, dbinfo):
    conn = psycopg2.connect(
        host=dbinfo["host"],
        user=dbinfo["user"],
        password=dbinfo["password"],
        dbname=dbinfo["dbname"],
        port=dbinfo.get("port", 5432)
    )
    try:
        with conn.cursor() as cursor:
            cursor.execute(sql)
            if cursor.description:
                headers = [desc[0] for desc in cursor.description]
                data = cursor.fetchall()
                return headers, data
            else: # Non-SELECT queries (no result)
                return [], []
    finally:
        conn.close()

def get_all_databases(dbinfo):
    try:
        conn = psycopg2.connect(
            host=dbinfo["host"],
            user=dbinfo["user"],
            password=dbinfo["password"],
            dbname=dbinfo.get("dbname", "postgres"),
            port=dbinfo.get("port", 5432)
        )
        with conn.cursor() as cursor:
            cursor.execute("SELECT datname FROM pg_database WHERE datistemplate = false;")
            dbs = [row[0] for row in cursor.fetchall()]
        conn.close()
        return dbs
    except Exception:
        return []

def get_tables(dbinfo):
    # If no dbname, return all DBs
    if not dbinfo.get("dbname"):
        return get_all_databases(dbinfo)
    try:
        conn = psycopg2.connect(
            host=dbinfo["host"],
            user=dbinfo["user"],
            password=dbinfo["password"],
            dbname=dbinfo["dbname"],
            port=dbinfo.get("port", 5432)
        )
        with conn.cursor() as cursor:
            cursor.execute("SELECT schemaname, tablename FROM pg_catalog.pg_tables WHERE schemaname NOT IN ('pg_catalog', 'information_schema');")
            tables = [f"{row[0]}.{row[1]}" for row in cursor.fetchall()]
        conn.close()
        return tables
    except Exception:
        return []

def get_table_schemas(dbinfo):
    # If no dbname, return schema for all DBs as a dict
    if not dbinfo.get("dbname"):
        dbs = get_all_databases(dbinfo)
        result = {}
        for db in dbs:
            try:
                info = dbinfo.copy()
                info["dbname"] = db
                conn = psycopg2.connect(
                    host=info["host"],
                    user=info["user"],
                    password=info["password"],
                    dbname=db,
                    port=info.get("port", 5432)
                )
                with conn.cursor(cursor_factory=psycopg2.extras.DictCursor) as cursor:
                    cursor.execute("""
                        SELECT table_schema, table_name, column_name, data_type
                        FROM information_schema.columns
                        WHERE table_schema NOT IN ('pg_catalog', 'information_schema')
                        ORDER BY table_schema, table_name, ordinal_position;
                    """)
                    rows = cursor.fetchall()
                conn.close()
                schema = {}
                for row in rows:
                    t = f"{row['table_schema']}.{row['table_name']}"
                    if t not in schema:
                        schema[t] = []
                    schema[t].append(f"{row['column_name']} {row['data_type']}")
                result[db] = schema
            except Exception:
                continue
        # Summarize as a string
        return "\n".join([
            f"[{db}]\n" + "\n".join([f"{t}({', '.join(cols)})" for t, cols in tables.items()])
            for db, tables in result.items()
        ])
    # Single DB
    try:
        conn = psycopg2.connect(
            host=dbinfo["host"],
            user=dbinfo["user"],
            password=dbinfo["password"],
            dbname=dbinfo["dbname"],
            port=dbinfo.get("port", 5432)
        )
        with conn.cursor(cursor_factory=psycopg2.extras.DictCursor) as cursor:
            cursor.execute("""
                SELECT table_schema, table_name, column_name, data_type
                FROM information_schema.columns
                WHERE table_schema NOT IN ('pg_catalog', 'information_schema')
                ORDER BY table_schema, table_name, ordinal_position;
            """)
            rows = cursor.fetchall()
        conn.close()
        schema = {}
        for row in rows:
            t = f"{row['table_schema']}.{row['table_name']}"
            if t not in schema:
                schema[t] = []
            schema[t].append(f"{row['column_name']} {row['data_type']}")
        return "\n".join([f"{t}({', '.join(cols)})" for t, cols in schema.items()])
    except Exception as e:
        return ""

def test_db_connection(dbinfo):
    try:
        conn = psycopg2.connect(
            host=dbinfo["host"],
            user=dbinfo["user"],
            password=dbinfo["password"],
            dbname=dbinfo["dbname"],
            port=int(dbinfo.get("port", 5432)),
            connect_timeout=3
        )
        conn.close()
        return True, None
    except Exception as e:
        return False, str(e)

def get_registered_databases():
    conn = None
    try:
        conn = get_app_db_connection()
        cur = conn.cursor(cursor_factory=RealDictCursor)
        cur.execute("SELECT name, host, port, username AS user, password, dbname, cloudwatch_id FROM databases;")
        databases = cur.fetchall()
        return databases
    except Exception as e:
        print(f"ERROR: Failed to get databases from DB: {e}")
        return []
    finally:
        if conn:
            conn.close()

def get_openai_keys():
    conn = None
    try:
        conn = get_app_db_connection()
        cur = conn.cursor(cursor_factory=RealDictCursor)
        cur.execute("SELECT name, api_key, is_selected FROM openai_keys;")
        keys = cur.fetchall()
        return keys
    except Exception as e:
        print(f"ERROR: Failed to get OpenAI keys from DB: {e}")
        return []
    finally:
        if conn:
            conn.close()

def get_selected_openai_key():
    conn = None
    try:
        conn = get_app_db_connection()
        cur = conn.cursor(cursor_factory=RealDictCursor)
        cur.execute("SELECT api_key FROM openai_keys WHERE is_selected = TRUE LIMIT 1;")
        selected_key_obj = cur.fetchone()
        return selected_key_obj['api_key'] if selected_key_obj else None
    except Exception as e:
        print(f"ERROR: Failed to retrieve selected OpenAI key from DB: {e}")
        return None
    finally:
        if conn:
            conn.close()

def add_or_update_database(name, host, port, user, password, dbname, remark=None, cloudwatch_id=None):
    conn = None
    try:
        conn = get_app_db_connection()
        cur = conn.cursor()
        cur.execute(
            "INSERT INTO databases (name, host, port, username, password, dbname, remark, cloudwatch_id) VALUES (%s, %s, %s, %s, %s, %s, %s, %s) ON CONFLICT (name) DO UPDATE SET host = EXCLUDED.host, port = EXCLUDED.port, username = EXCLUDED.username, password = EXCLUDED.password, dbname = EXCLUDED.dbname, remark = EXCLUDED.remark, cloudwatch_id = EXCLUDED.cloudwatch_id;",
            (name, host, int(port), user, password, dbname, remark, cloudwatch_id)
        )
        conn.commit()
        return True, None
    except Exception as e:
        return False, str(e)
    finally:
        if conn:
            conn.close()

def delete_database(name):
    conn = None
    try:
        conn = get_app_db_connection()
        cur = conn.cursor()
        cur.execute("DELETE FROM databases WHERE name = %s;", (name,))
        conn.commit()
        return True, None
    except Exception as e:
        return False, str(e)
    finally:
        if conn:
            conn.close()

def add_or_update_openai_key(name, key):
    conn = None
    try:
        conn = get_app_db_connection()
        cur = conn.cursor()
        cur.execute(
            "INSERT INTO openai_keys (name, api_key) VALUES (%s, %s) ON CONFLICT (name) DO UPDATE SET api_key = EXCLUDED.api_key;",
            (name, key)
        )
        conn.commit()
        return True, None
    except Exception as e:
        return False, str(e)
    finally:
        if conn:
            conn.close()

def select_openai_key(name):
    conn = None
    try:
        conn = get_app_db_connection()
        cur = conn.cursor()
        cur.execute("UPDATE openai_keys SET is_selected = FALSE;")
        cur.execute("UPDATE openai_keys SET is_selected = TRUE WHERE name = %s;", (name,))
        conn.commit()
        return True, None
    except Exception as e:
        return False, str(e)
    finally:
        if conn:
            conn.close()

def delete_openai_key(name):
    conn = None
    try:
        conn = get_app_db_connection()
        cur = conn.cursor()
        cur.execute("DELETE FROM openai_keys WHERE name = %s;", (name,))
        conn.commit()
        return True, None
    except Exception as e:
        return False, str(e)
    finally:
        if conn:
            conn.close()

def get_azure_openai_configs():
    conn = None
    try:
        conn = get_app_db_connection()
        cur = conn.cursor(cursor_factory=RealDictCursor)
        cur.execute("SELECT name, api_key, endpoint, deployment_name, api_version, is_selected FROM azure_openai_configs;")
        configs = cur.fetchall()
        return configs
    except Exception as e:
        print(f"ERROR: Failed to get Azure OpenAI configs from DB: {e}")
        return []
    finally:
        if conn:
            conn.close()

def add_or_update_azure_openai_config(name, api_key, endpoint, deployment_name, api_version):
    conn = None
    try:
        conn = get_app_db_connection()
        cur = conn.cursor()
        cur.execute(
            "INSERT INTO azure_openai_configs (name, api_key, endpoint, deployment_name, api_version) VALUES (%s, %s, %s, %s, %s) ON CONFLICT (name) DO UPDATE SET api_key = EXCLUDED.api_key, endpoint = EXCLUDED.endpoint, deployment_name = EXCLUDED.deployment_name, api_version = EXCLUDED.api_version;",
            (name, api_key, endpoint, deployment_name, api_version)
        )
        conn.commit()
        return True, None
    except Exception as e:
        return False, str(e)
    finally:
        if conn:
            conn.close()

def select_azure_openai_config(name):
    conn = None
    try:
        conn = get_app_db_connection()
        cur = conn.cursor()
        # Deselect all other AI models first
        cur.execute("UPDATE openai_keys SET is_selected = FALSE;")
        cur.execute("UPDATE azure_openai_configs SET is_selected = FALSE;")
        
        # Select the chosen Azure OpenAI config
        cur.execute("UPDATE azure_openai_configs SET is_selected = TRUE WHERE name = %s;", (name,))
        conn.commit()
        return True, None
    except Exception as e:
        return False, str(e)
    finally:
        if conn:
            conn.close()

def delete_azure_openai_config(name):
    conn = None
    try:
        conn = get_app_db_connection()
        cur = conn.cursor()
        cur.execute("DELETE FROM azure_openai_configs WHERE name = %s;", (name,))
        conn.commit()
        return True, None
    except Exception as e:
        return False, str(e)
    finally:
        if conn:
            conn.close()

def get_gemini_configs():
    conn = None
    try:
        conn = get_app_db_connection()
        cur = conn.cursor(cursor_factory=RealDictCursor)
        cur.execute("SELECT name, api_key, model_name, is_selected FROM gemini_configs;")
        configs = cur.fetchall()
        return configs
    except Exception as e:
        print(f"ERROR: Failed to get Gemini configs from DB: {e}")
        return []
    finally:
        if conn:
            conn.close()

def add_or_update_gemini_config(name, api_key, model_name):
    conn = None
    try:
        conn = get_app_db_connection()
        cur = conn.cursor()
        cur.execute(
            "INSERT INTO gemini_configs (name, api_key, model_name) VALUES (%s, %s, %s) ON CONFLICT (name) DO UPDATE SET api_key = EXCLUDED.api_key, model_name = EXCLUDED.model_name;",
            (name, api_key, model_name)
        )
        conn.commit()
        return True, None
    except Exception as e:
        return False, str(e)
    finally:
        if conn:
            conn.close()

def select_gemini_config(name):
    conn = None
    try:
        conn = get_app_db_connection()
        cur = conn.cursor()
        # Deselect all other AI models first
        cur.execute("UPDATE openai_keys SET is_selected = FALSE;")
        cur.execute("UPDATE azure_openai_configs SET is_selected = FALSE;")
        cur.execute("UPDATE claude_configs SET is_selected = FALSE;")
        cur.execute("UPDATE gemini_configs SET is_selected = FALSE;")
        
        # Select the chosen Gemini config
        cur.execute("UPDATE gemini_configs SET is_selected = TRUE WHERE name = %s;", (name,))
        conn.commit()
        return True, None
    except Exception as e:
        return False, str(e)
    finally:
        if conn:
            conn.close()

def delete_gemini_config(name):
    conn = None
    try:
        conn = get_app_db_connection()
        cur = conn.cursor()
        cur.execute("DELETE FROM gemini_configs WHERE name = %s;", (name,))
        conn.commit()
        return True, None
    except Exception as e:
        return False, str(e)
    finally:
        if conn:
            conn.close()

def get_claude_configs():
    conn = None
    try:
        conn = get_app_db_connection()
        cur = conn.cursor(cursor_factory=RealDictCursor)
        cur.execute("SELECT name, api_key, model_name, is_selected FROM claude_configs;")
        configs = cur.fetchall()
        return configs
    except Exception as e:
        print(f"ERROR: Failed to get Claude configs from DB: {e}")
        return []
    finally:
        if conn:
            conn.close()

def add_or_update_claude_config(name, api_key, model_name):
    conn = None
    try:
        conn = get_app_db_connection()
        cur = conn.cursor()
        cur.execute(
            "INSERT INTO claude_configs (name, api_key, model_name) VALUES (%s, %s, %s) ON CONFLICT (name) DO UPDATE SET api_key = EXCLUDED.api_key, model_name = EXCLUDED.model_name;",
            (name, api_key, model_name)
        )
        conn.commit()
        return True, None
    except Exception as e:
        return False, str(e)
    finally:
        if conn:
            conn.close()

def select_claude_config(name):
    conn = None
    try:
        conn = get_app_db_connection()
        cur = conn.cursor()
        # Deselect all other AI models first
        cur.execute("UPDATE openai_keys SET is_selected = FALSE;")
        cur.execute("UPDATE azure_openai_configs SET is_selected = FALSE;")
        cur.execute("UPDATE gemini_configs SET is_selected = FALSE;")
        cur.execute("UPDATE claude_configs SET is_selected = FALSE;")
        
        # Select the chosen Claude config
        cur.execute("UPDATE claude_configs SET is_selected = TRUE WHERE name = %s;", (name,))
        conn.commit()
        return True, None
    except Exception as e:
        return False, str(e)
    finally:
        if conn:
            conn.close()

def delete_claude_config(name):
    conn = None
    try:
        conn = get_app_db_connection()
        cur = conn.cursor()
        cur.execute("DELETE FROM claude_configs WHERE name = %s;", (name,))
        conn.commit()
        return True, None
    except Exception as e:
        return False, str(e)
    finally:
        if conn:
            conn.close()

def get_selected_ai_model():
    conn = None
    try:
        conn = get_app_db_connection()
        cur = conn.cursor(cursor_factory=RealDictCursor)
        
        # Check for selected OpenAI key
        cur.execute("SELECT 'openai' as type, name, api_key FROM openai_keys WHERE is_selected = TRUE LIMIT 1;")
        openai_key = cur.fetchone()
        if openai_key:
            return openai_key
            
        # Check for selected Azure OpenAI config
        cur.execute("SELECT 'azure_openai' as type, name, api_key, endpoint, deployment_name, api_version FROM azure_openai_configs WHERE is_selected = TRUE LIMIT 1;")
        azure_openai_config = cur.fetchone()
        if azure_openai_config:
            return azure_openai_config

        # Check for selected Gemini config
        cur.execute("SELECT 'gemini' as type, name, api_key, model_name FROM gemini_configs WHERE is_selected = TRUE LIMIT 1;")
        gemini_config = cur.fetchone()
        if gemini_config:
            return gemini_config

        # Check for selected Claude config
        cur.execute("SELECT 'claude' as type, name, api_key, model_name FROM claude_configs WHERE is_selected = TRUE LIMIT 1;")
        claude_config = cur.fetchone()
        if claude_config:
            return claude_config
            
        return None
    except Exception as e:
        print(f"ERROR: Failed to retrieve selected AI model from DB: {e}")
        return None
    finally:
        if conn:
            conn.close()

def create_conversation(title: str, db_name: str):
    conn = None
    try:
        conn = get_app_db_connection()
        cur = conn.cursor()
        cur.execute(
            "INSERT INTO conversations (title, db_name) VALUES (%s, %s) RETURNING id;",
            (title, db_name)
        )
        conversation_id = cur.fetchone()[0]
        conn.commit()
        return conversation_id, None
    except Exception as e:
        return None, str(e)
    finally:
        if conn:
            conn.close()

def get_conversations(db_name: str = None):
    conn = None
    try:
        conn = get_app_db_connection()
        cur = conn.cursor(cursor_factory=RealDictCursor)
        if db_name:
            cur.execute("SELECT id, title, db_name, created_at, updated_at FROM conversations WHERE db_name = %s ORDER BY updated_at DESC;", (db_name,))
        else:
            cur.execute("SELECT id, title, db_name, created_at, updated_at FROM conversations ORDER BY updated_at DESC;")
        conversations = cur.fetchall()
        return conversations, None
    except Exception as e:
        return None, str(e)
    finally:
        if conn:
            conn.close()

def get_conversation_messages(conversation_id: int):
    conn = None
    try:
        conn = get_app_db_connection()
        cur = conn.cursor(cursor_factory=RealDictCursor)
        cur.execute("SELECT id, conversation_id, role, content, sql_query, sql_result, timestamp FROM messages WHERE conversation_id = %s ORDER BY timestamp ASC;", (conversation_id,))
        messages = cur.fetchall()
        return messages, None
    except Exception as e:
        return None, str(e)
    finally:
        if conn:
            conn.close()

def add_message_to_conversation(
    conversation_id: int,
    role: str,
    content: str = None,
    sql_query: str = None,
    sql_result: str = None
):
    conn = None
    try:
        conn = get_app_db_connection()
        cur = conn.cursor()
        cur.execute(
            "INSERT INTO messages (conversation_id, role, content, sql_query, sql_result) VALUES (%s, %s, %s, %s, %s);",
            (conversation_id, role, content, sql_query, sql_result)
        )
        # Update conversation's updated_at timestamp
        cur.execute("UPDATE conversations SET updated_at = CURRENT_TIMESTAMP WHERE id = %s;", (conversation_id,))
        conn.commit()
        return True, None
    except Exception as e:
        return False, str(e)
    finally:
        if conn:
            conn.close()

def delete_conversation(conversation_id: int):
    conn = None
    try:
        conn = get_app_db_connection()
        cur = conn.cursor()
        cur.execute("DELETE FROM conversations WHERE id = %s;", (conversation_id,))
        conn.commit()
        return True, None
    except Exception as e:
        return False, str(e)
    finally:
        if conn:
            conn.close()
