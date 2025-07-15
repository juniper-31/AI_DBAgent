"""
AI 서비스 - 다양한 AI 모델과의 통합을 관리
"""
import openai
import google.generativeai as genai
from anthropic import Anthropic
from typing import List, Dict, Any, Optional
from backend.database import get_selected_ai_model


class AIService:
    """AI 모델 통합 서비스"""
    
    def __init__(self):
        self.current_model = None
        self.client = None
    
    def get_current_model(self) -> Optional[Dict[str, Any]]:
        """현재 선택된 AI 모델 정보 반환"""
        return get_selected_ai_model()
    
    def initialize_client(self) -> bool:
        """선택된 AI 모델에 따라 클라이언트 초기화"""
        model_info = self.get_current_model()
        if not model_info:
            return False
        
        try:
            if model_info["type"] == "openai":
                self.client = openai.OpenAI(api_key=model_info["api_key"])
                self.current_model = "gpt-4"
            elif model_info["type"] == "azure_openai":
                self.client = openai.AzureOpenAI(
                    api_key=model_info["api_key"],
                    api_version=model_info["api_version"],
                    azure_endpoint=model_info["endpoint"]
                )
                self.current_model = model_info["deployment_name"]
            elif model_info["type"] == "gemini":
                genai.configure(api_key=model_info["api_key"])
                self.client = genai.GenerativeModel(model_info["model_name"])
                self.current_model = model_info["model_name"]
            elif model_info["type"] == "claude":
                self.client = Anthropic(api_key=model_info["api_key"])
                self.current_model = model_info["model_name"]
            else:
                return False
            
            return True
        except Exception as e:
            print(f"AI 클라이언트 초기화 실패: {e}")
            return False
    
    def generate_response(self, messages: List[Dict[str, str]], temperature: float = 0) -> Optional[str]:
        """AI 모델로부터 응답 생성"""
        if not self.client or not self.current_model:
            if not self.initialize_client():
                return None
        
        model_info = self.get_current_model()
        if not model_info:
            return None
        
        try:
            if model_info["type"] in ["openai", "azure_openai"]:
                completion = self.client.chat.completions.create(
                    model=self.current_model,
                    messages=messages,
                    temperature=temperature,
                )
                return completion.choices[0].message.content
            
            elif model_info["type"] == "gemini":
                # Gemini 형식으로 메시지 변환
                gemini_messages = []
                for msg in messages:
                    if msg["role"] == "system":
                        gemini_messages.append({"role": "user", "parts": [msg["content"]]})
                        gemini_messages.append({"role": "model", "parts": ["Ok."]})
                    elif msg["role"] == "user":
                        gemini_messages.append({"role": "user", "parts": [msg["content"]]})
                    elif msg["role"] == "assistant":
                        gemini_messages.append({"role": "model", "parts": [msg["content"]]})
                
                response = self.client.generate_content(gemini_messages)
                return response.text
            
            elif model_info["type"] == "claude":
                # Claude 형식으로 메시지 변환
                claude_messages = []
                system_message = ""
                for msg in messages:
                    if msg["role"] == "system":
                        system_message = msg["content"]
                    elif msg["role"] in ["user", "assistant"]:
                        claude_messages.append({"role": msg["role"], "content": msg["content"]})
                
                response = self.client.messages.create(
                    model=self.current_model,
                    max_tokens=1024,
                    messages=claude_messages,
                    system=system_message
                )
                return response.content[0].text
            
        except Exception as e:
            print(f"AI 응답 생성 실패: {e}")
            return None
        
        return None


# 전역 인스턴스
ai_service = AIService()