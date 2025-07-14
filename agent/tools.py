import psycopg2
import psycopg2.extras
from backend.database import execute_sql # Import execute_sql

# In a real scenario, these functions would be more robust.
# For now, they are placeholders to illustrate the concept of 'tools'.

def get_cpu_usage(db_config: dict) -> float:
    """
    (Placeholder) Returns the CPU usage of the database.
    In a real implementation, this would query a monitoring view like pg_stat_statements
    or connect to a cloud provider's API (e.g., AWS CloudWatch).
    """
    # This is a dummy value.
    print(f"INFO: [Tool] Checking CPU usage for {db_config.get('name')}...")
    return 15.5 # Dummy value: 15.5%

def get_memory_usage(db_config: dict) -> float:
    """
    (Placeholder) Returns the memory usage of the database.
    """
    # This is a dummy value.
    print(f"INFO: [Tool] Checking Memory usage for {db_config.get('name')}...")
    return 40.2 # Dummy value: 40.2%

def get_active_connections(db_config: dict) -> int:
    """
    Returns the number of active connections to the database.
    """
    print(f"INFO: [Tool] Checking active connections for {db_config.get('name')}...")
    try:
        # Use the execute_sql function from backend.database
        headers, data = execute_sql("SELECT count(*) FROM pg_stat_activity WHERE state = 'active';", db_config)
        if data and data[0]:
            return data[0][0]
        return 0
    except Exception as e:
        print(f"ERROR: Could not get active connections for {db_config.get('name')}: {e}")
        return -1

def get_slow_queries(db_config: dict, min_duration_seconds: int = 5) -> list:
    """
    (Placeholder) Returns a list of slow queries.
    This requires PostgreSQL to be configured to log slow queries.
    The tool would then parse the log file.
    """
    print(f"INFO: [Tool] Checking for slow queries longer than {min_duration_seconds}s for {db_config.get('name')}...")
    # Dummy data
    return [
        {"query": "SELECT * FROM users WHERE email LIKE '%test%';", "duration_seconds": 10.2},
        {"query": "SELECT pg_sleep(6);", "duration_seconds": 6.1},
    ]

# A map to easily call tools by name
AVAILABLE_TOOLS = {
    "get_cpu_usage": get_cpu_usage,
    "get_memory_usage": get_memory_usage,
    "get_active_connections": get_active_connections,
    "get_slow_queries": get_slow_queries,
}