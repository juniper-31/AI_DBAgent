"""
AI 서비스 테스트
"""
import pytest
from unittest.mock import Mock, patch
from backend.services.ai_service import AIService


class TestAIService:
    """AI 서비스 테스트"""
    
    def setup_method(self):
        """테스트 설정"""
        self.ai_service = AIService()
    
    @patch('backend.services.ai_service.get_selected_ai_model')
    def test_get_current_model(self, mock_get_model):
        """현재 모델 조회 테스트"""
        mock_get_model.return_value = {
            "type": "openai",
            "api_key": "test_key",
            "name": "test_model"
        }
        
        model = self.ai_service.get_current_model()
        assert model is not None
        assert model["type"] == "openai"
        assert model["api_key"] == "test_key"
    
    @patch('backend.services.ai_service.get_selected_ai_model')
    @patch('openai.OpenAI')
    def test_initialize_openai_client(self, mock_openai, mock_get_model):
        """OpenAI 클라이언트 초기화 테스트"""
        mock_get_model.return_value = {
            "type": "openai",
            "api_key": "test_key"
        }
        
        success = self.ai_service.initialize_client()
        assert success is True
        assert self.ai_service.current_model == "gpt-4"
        mock_openai.assert_called_once_with(api_key="test_key")
    
    @patch('backend.services.ai_service.get_selected_ai_model')
    def test_initialize_client_no_model(self, mock_get_model):
        """모델이 선택되지 않은 경우 테스트"""
        mock_get_model.return_value = None
        
        success = self.ai_service.initialize_client()
        assert success is False
    
    @patch('backend.services.ai_service.get_selected_ai_model')
    @patch('openai.OpenAI')
    def test_generate_response_openai(self, mock_openai, mock_get_model):
        """OpenAI 응답 생성 테스트"""
        # Mock 설정
        mock_get_model.return_value = {
            "type": "openai",
            "api_key": "test_key"
        }
        
        mock_client = Mock()
        mock_completion = Mock()
        mock_completion.choices[0].message.content = "테스트 응답"
        mock_client.chat.completions.create.return_value = mock_completion
        mock_openai.return_value = mock_client
        
        # 테스트 실행
        messages = [{"role": "user", "content": "테스트 질문"}]
        response = self.ai_service.generate_response(messages)
        
        assert response == "테스트 응답"
        mock_client.chat.completions.create.assert_called_once()