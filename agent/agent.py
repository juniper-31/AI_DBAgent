import time
import yaml
import os

from agent.tools import AVAILABLE_TOOLS
from backend.database import get_registered_databases # Import the new function

class Agent:
    def __init__(self):
        """
        Initializes the Agent.
        The config will be loaded from playbooks.json.
        """
        print("INFO: Initializing agent...")
        self.db_connections = [] # This will be populated from the main app's session
        self.playbooks = self.load_playbooks() # Load playbooks here

    def load_playbooks(self):
        """Loads the playbooks from playbooks.json."""
        try:
            with open('playbooks.json', 'r', encoding='utf-8') as f:
                return yaml.safe_load(f) # Assuming playbooks.json is valid YAML/JSON
        except (FileNotFoundError, yaml.YAMLError) as e:
            print(f"ERROR: Could not load playbooks.json: {e}")
            return []

    def set_db_connections(self, db_connections: list):
        """
        Sets the database connection details.
        This method allows the main FastAPI app to pass the user-configured
        DB connections to the agent.
        """
        self.db_connections = db_connections
        print(f"INFO: Agent received {len(db_connections)} DB connections.")

    def run_loop(self):
        """
        The main loop of the agent.
        It periodically checks the databases based on the playbooks.
        """
        # Get interval from playbooks or default to 60 seconds
        interval = 60 # Default interval
        

        print(f"INFO: Starting agent loop with {interval}s interval.")

        while True:
            print("\n" + "="*50)
            print(f"INFO: Running agent check at {time.ctime()}")
            
            # Refresh db_connections from the database before each run
            self.db_connections = get_registered_databases()

            if not self.db_connections:
                print("WARN: No database connections configured. Skipping check.")
                time.sleep(interval)
                continue

            self.run_playbooks()
            
            print("="*50 + "\n")
            time.sleep(interval)

    def run_playbooks(self):
        """
        Executes all enabled playbooks.
        """
        for playbook in self.playbooks:
            if not playbook.get("enabled", False):
                continue

            print(f"INFO: Running playbook: {playbook.get('name')}")
            
            db_name = playbook.get("database_name")
            db_config = next((db for db in self.db_connections if db["name"] == db_name), None)

            if not db_config:
                print(f"WARN: No database configuration found for '{db_name}'. Skipping playbook.")
                continue

            self.execute_triggers(playbook.get("triggers", []), db_config)

    def execute_triggers(self, triggers: list, db_config: dict):
        """
        Checks all triggers within a playbook.
        """
        for trigger in triggers:
            metric_name = trigger.get("metric")
            threshold = trigger.get("threshold")
            operator = trigger.get("operator", "==")

            # This is a simplified metric mapping.
            # In a real agent, you might have more complex tools.
            if metric_name == "cpu_usage":
                value = AVAILABLE_TOOLS["get_cpu_usage"](db_config)
            elif metric_name == "memory_usage":
                value = AVAILABLE_TOOLS["get_memory_usage"](db_config)
            elif metric_name == "slow_queries":
                # For slow queries, the 'value' is the count of queries.
                slow_queries = AVAILABLE_TOOLS["get_slow_queries"](db_config, trigger.get("min_duration_seconds", 5))
                value = len(slow_queries)
            else:
                print(f"WARN: Unknown metric '{metric_name}' in playbook. Skipping.")
                continue
            
            print(f"INFO:  - Checking metric '{metric_name}': Current value = {value}, Threshold = {threshold}")

            # Check if the trigger condition is met
            if self.condition_met(value, operator, threshold):
                print(f"ALERT: Trigger condition met for '{metric_name}'! Value {value} {operator} {threshold}")
                self.handle_alert(trigger, value, db_config)
            else:
                print(f"INFO:  - OK: '{metric_name}' is within normal parameters.")


    def condition_met(self, value, operator, threshold) -> bool:
        """
        Checks if the condition (e.g., value >= threshold) is true.
        """
        if operator == ">=":
            return value >= threshold
        if operator == ">":
            return value > threshold
        if operator == "<=":
            return value <= threshold
        if operator == "<":
            return value < threshold
        if operator == "==":
            return value == threshold
        return False

    def handle_alert(self, trigger: dict, value, db_config: dict):
        """
        Handles a triggered alert.
        This is where the agent would use AI to diagnose the problem.
        """
        action = trigger.get("action")
        print(f"ACTION: Performing action '{action}' for metric '{trigger.get('metric')}'")

        # Here, you would integrate with an AI model to get a diagnosis.
        # For now, we'll just print a message.
        
        # Example of what the AI prompt could look like:
        prompt = f"""
        You are a PostgreSQL expert.
        The database '{db_config.get('name')}' has triggered an alert.
        Metric: {trigger.get('metric')}
        Current Value: {value}
        Threshold: {trigger.get('threshold')}
        
        Based on this, what are the likely causes and what should I investigate next?
        Suggest which of the following tools I should use: {list(AVAILABLE_TOOLS.keys())}
        """
        
        print("\n--- AI DIAGNOSIS (SIMULATED) ---")
        print(prompt)
        print("--- END AI DIAGNOSIS ---\n")
        
        # In a real implementation, you would send this prompt to the OpenAI API
        # and then potentially execute the tool suggested by the AI.