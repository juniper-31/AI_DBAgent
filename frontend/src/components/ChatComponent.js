// ChatComponent.js
// 자연어→SQL, AI 통합 채팅 컴포넌트
import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';

import ReactMarkdown from 'react-markdown';

function ChatComponent({ selectedDb, databases, onDbChange }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [textareaRows, setTextareaRows] = useState(1);
  const messagesEndRef = useRef(null);
  const textareaRef = useRef(null);

  const [aiModels, setAiModels] = useState([]);
  const [selectedAiModel, setSelectedAiModel] = useState('');
  const [dbSchema, setDbSchema] = useState(null); // DB 스키마 정보

  const [conversations, setConversations] = useState([]); // 대화 목록
  const [currentConversationId, setCurrentConversationId] = useState(null); // 현재 대화 ID

  // 추천 질문들 (카드형)
  const suggestedQuestions = [
    {
      title: '성능 분석',
      questions: [
        '오늘 가장 오래 걸린 쿼리 보여줘',
        '슬로우 쿼리 10개만 보여줘',
        '테이블별 row 수와 크기 알려줘'
      ]
    },
    {
      title: '데이터 탐색',
      questions: [
        '가장 row가 많은 테이블 알려줘',
        '최근 7일간 생성된 데이터 보여줘',
        '사용자 테이블의 구조를 설명해줘'
      ]
    },
    {
      title: '시스템 상태',
      questions: [
        '현재 활성 연결 수는?',
        '데이터베이스 크기와 사용량 알려줘',
        '인덱스 사용 현황을 분석해줘'
      ]
    }
  ];

  // 자동 스크롤
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // DB 선택 변경 시 대화 목록 불러오기
  useEffect(() => {
    const fetchConversations = async () => {
      if (selectedDb) {
        try {
          const response = await axios.get(`/api/conversations?db_name=${selectedDb}`);
          if (response.data.status === 'success') {
            const conversations = response.data.conversations;
            setConversations(conversations);
            if (conversations.length > 0) {
              // 가장 최근 대화를 자동으로 선택
              setCurrentConversationId(conversations[0].id);
            } else {
              // 대화가 없으면 현재 대화 초기화
              setCurrentConversationId(null);
              setMessages([]);
            }
          }
        } catch (error) {
          console.error('대화 목록을 불러오는데 실패했습니다:', error);
          setConversations([]);
        }
      } else {
        setConversations([]);
        setCurrentConversationId(null);
        setMessages([]);
      }
    };

    fetchConversations();
  }, [selectedDb]);

  // DB 선택 변경 시 스키마 정보 불러오기
  useEffect(() => {
    const fetchDbSchema = async () => {
      if (selectedDb && selectedDb !== '__ALL_DBS__') {
        try {
          const response = await axios.get(`/api/schema/${selectedDb}`);
          if (response.data.status === 'success') {
            setDbSchema(response.data.schema);
            console.log('DB 스키마 정보 로드 완료:', response.data.schema);
          }
        } catch (error) {
          console.error('DB 스키마 정보를 불러오는데 실패했습니다:', error);
          setDbSchema(null);
        }
      } else {
        setDbSchema(null);
      }
    };

    fetchDbSchema();
  }, [selectedDb]);

  // 현재 대화 ID 변경 시 메시지 불러오기
  useEffect(() => {
    const fetchMessages = async () => {
      if (currentConversationId) {
        try {
          const response = await axios.get(`/api/conversations/${currentConversationId}/messages`);
          if (response.data.status === 'success') {
            // DB에서 불러온 메시지 형식 변환
            const formattedMessages = response.data.messages.map(msg => ({
              role: msg.role,
              content: msg.content,
              sql: msg.sql_query,
              result: msg.sql_result ? JSON.parse(msg.sql_result) : null,
              timestamp: new Date(msg.timestamp).toLocaleTimeString()
            }));
            setMessages(formattedMessages);
          }
        } catch (error) {
          console.error('메시지를 불러오는데 실패했습니다:', error);
          setMessages([]);
        }
      } else {
        setMessages([]);
      }
    };
    fetchMessages();
  }, [currentConversationId]);

  // AI 모델 목록 불러오기 (한 번만 실행)
  useEffect(() => {
    const fetchAiModels = async () => {
      try {
        const openaiRes = await axios.get('/api/openai/keys');
        const azureOpenAIRes = await axios.get('/api/azure-openai/configs');
        const geminiRes = await axios.get('/api/gemini/configs');
        const claudeRes = await axios.get('/api/claude/configs');

        const allModels = [
          ...openaiRes.data.keys.map(k => ({ ...k, type: 'openai' })),
          ...azureOpenAIRes.data.configs.map(c => ({ ...c, type: 'azure_openai' })),
          ...geminiRes.data.configs.map(c => ({ ...c, type: 'gemini' })),
          ...claudeRes.data.configs.map(c => ({ ...c, type: 'claude' })),
        ];
        setAiModels(allModels);

        const currentSelected = allModels.find(m => m.is_selected);
        if (currentSelected) {
          setSelectedAiModel(currentSelected.name);
        } else if (allModels.length > 0) {
          const defaultModel = allModels[0];
          let selectApiEndpoint = '';
          if (defaultModel.type === 'openai') selectApiEndpoint = '/api/openai/select';
          else if (defaultModel.type === 'azure_openai') selectApiEndpoint = '/api/azure-openai/select';
          else if (defaultModel.type === 'gemini') selectApiEndpoint = '/api/gemini/select';
          else if (defaultModel.type === 'claude') selectApiEndpoint = '/api/claude/select';

          if (selectApiEndpoint) {
            const formData = new FormData();
            formData.append('name', defaultModel.name);
            axios.post(selectApiEndpoint, formData)
              .then(() => {
                setSelectedAiModel(defaultModel.name);
                console.log(`Default AI model selected: ${defaultModel.name}`);
              })
              .catch(error => {
                console.error('Error selecting default AI model:', error);
              });
          }
        }

      } catch (error) {
        console.error('Error fetching AI models:', error);
      }
    };
    fetchAiModels();
  }, []);

  // 텍스트 영역 자동 크기 조정
  const autoResizeTextarea = (el) => {
    el.style.height = 'auto';
    const newHeight = Math.min(el.scrollHeight, 120); // 최대 5줄
    el.style.height = newHeight + 'px';
    setTextareaRows(Math.ceil(newHeight / 24));
  };

  // 추천 질문 클릭
  const handleSuggestedQuestion = (question) => {
    setInput(question);
    textareaRef.current?.focus();
  };

  // DB 스키마 정보를 AI 프롬프트로 변환
  const generateSchemaPrompt = (schema) => {
    let prompt = '';
    
    // 테이블 정보
    prompt += `데이터베이스에 ${schema.tables.length}개의 테이블이 있습니다:\n\n`;
    
    schema.tables.forEach(table => {
      prompt += `테이블: ${table.name}`;
      if (table.comment) {
        prompt += ` (${table.comment})`;
      }
      prompt += '\n';
      
      // 컬럼 정보
      prompt += '  컬럼:\n';
      table.columns.forEach(column => {
        prompt += `    - ${column.name}: ${column.type}`;
        if (column.max_length) {
          prompt += `(${column.max_length})`;
        }
        if (column.precision && column.scale) {
          prompt += `(${column.precision},${column.scale})`;
        }
        if (!column.nullable) {
          prompt += ' (NOT NULL)';
        }
        if (column.default) {
          prompt += ` (기본값: ${column.default})`;
        }
        if (column.comment) {
          prompt += ` - ${column.comment}`;
        }
        prompt += '\n';
      });
      
      // 인덱스 정보
      if (table.indexes && table.indexes.length > 0) {
        prompt += '  인덱스:\n';
        table.indexes.forEach(index => {
          prompt += `    - ${index.name}: [${index.columns.join(', ')}]`;
          if (index.unique) {
            prompt += ' (UNIQUE)';
          }
          if (index.primary) {
            prompt += ' (PRIMARY KEY)';
          }
          prompt += '\n';
        });
      }
      prompt += '\n';
    });
    
    // 관계 정보
    if (schema.relationships && schema.relationships.length > 0) {
      prompt += '테이블 관계:\n';
      schema.relationships.forEach(rel => {
        prompt += `  ${rel.table}.${rel.column} -> ${rel.foreign_table}.${rel.foreign_column}\n`;
      });
      prompt += '\n';
    }
    
    return prompt;
  };

  // 기존 대화 선택
  const handleSelectConversation = (convId) => {
    setCurrentConversationId(convId);
  };

  // 대화 삭제
  const handleDeleteConversation = async (convId) => {
    if (window.confirm('정말로 이 대화를 삭제하시겠습니까? 모든 메시지가 영구적으로 삭제됩니다.')) {
      try {
        await axios.delete(`/api/conversations/${convId}`);
        // 대화 목록 새로고침
        const convRes = await axios.get(`/api/conversations?db_name=${selectedDb}`);
        if (convRes.data.status === 'success') {
          setConversations(convRes.data.conversations);
        }
        if (currentConversationId === convId) {
          setCurrentConversationId(null);
          setMessages([]);
        }
      } catch (error) {
        console.error('대화 삭제 실패:', error);
        alert('대화 삭제에 실패했습니다.');
      }
    }
  };

  // 메시지 전송
  const handleSend = async () => {
    if (!input.trim() || !selectedDb) return;
    
    if (!selectedAiModel) {
      alert('먼저 사용할 AI 모델을 선택해주세요.');
      return;
    }

    let conversationId = currentConversationId;

    // 현재 대화가 없으면 새로 생성
    if (!conversationId) {
      try {
        const newConvResponse = await axios.post('/api/conversations/new', new URLSearchParams({
          db_name: selectedDb,
          title: input.substring(0, 30) // 첫 메시지를 제목으로 사용
        }));
        if (newConvResponse.data.status === 'success') {
          conversationId = newConvResponse.data.conversation_id;
          setCurrentConversationId(conversationId);
          // 대화 목록 새로고침
          const convRes = await axios.get(`/api/conversations?db_name=${selectedDb}`);
          if (convRes.data.status === 'success') {
            setConversations(convRes.data.conversations);
          }
        } else {
          throw new Error('Failed to create new conversation');
        }
      } catch (error) {
        console.error('새 대화 생성 실패:', error);
        alert('새 대화를 생성하는데 실패했습니다.');
        return;
      }
    }
    
    const userMessage = { 
      role: 'user', 
      content: input,
      timestamp: new Date().toLocaleTimeString()
    };
    setMessages(prev => [...prev, userMessage]);
    setLoading(true);
    setInput('');
    setTextareaRows(1);
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }

    try {
      const formData = new FormData();
      formData.append('db_name', selectedDb);
      
      // DB 스키마 정보를 포함한 향상된 프롬프트 생성
      let enhancedPrompt = input;
      if (dbSchema && dbSchema.tables && dbSchema.tables.length > 0) {
        const schemaInfo = generateSchemaPrompt(dbSchema);
        enhancedPrompt = `[데이터베이스 스키마 정보]\n${schemaInfo}\n\n[사용자 질문]\n${input}`;
      }
      
      formData.append('prompt', enhancedPrompt);
      formData.append('conversation_id', conversationId); // 대화 ID 전송

      const response = await axios.post('/api/nl2sql', formData);

      if (response.data.status === 'success') {
        const data = response.data.message;
        const assistantMessage = {
          role: 'assistant',
          content: data.content || '',
          sql: data.sql || '',
          result: data.result || null,
          timestamp: new Date().toLocaleTimeString()
        };
        setMessages(prev => [...prev, assistantMessage]);
      } else {
        const errorMessage = {
          role: 'assistant',
          content: response.data.error || '알 수 없는 오류 발생',
          error: true,
          timestamp: new Date().toLocaleTimeString()
        };
        setMessages(prev => [...prev, errorMessage]);
      }
    } catch (error) {
      console.error('요청 처리 중 오류 발생:', error);
      const errorMessage = {
        role: 'assistant',
        content: '죄송합니다. 요청 처리 중 오류가 발생했습니다.',
        error: true,
        timestamp: new Date().toLocaleTimeString()
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setLoading(false);
    }
  };

  // 키보드 이벤트 처리
  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // 텍스트 영역 입력 처리
  const handleInputChange = (e) => {
    setInput(e.target.value);
    autoResizeTextarea(e.target);
  };

  // 채팅 초기화 (현재 대화의 메시지만 삭제)
  const handleResetChat = async () => {
    if (!currentConversationId) return;
    
    if (window.confirm('현재 대화의 모든 메시지를 초기화하시겠습니까?')) {
      try {
        const formData = new FormData();
        formData.append('conversation_id', currentConversationId);
        const response = await axios.post('/api/nl2sql/reset', formData);
        
        if (response.data.status === 'success') {
          setMessages([]);
          // 대화 목록 새로고침 (업데이트된 updated_at 반영)
          const convRes = await axios.get(`/api/conversations?db_name=${selectedDb}`);
          if (convRes.data.status === 'success') {
            setConversations(convRes.data.conversations);
          }
        }
      } catch (error) {
        console.error('채팅 초기화 오류:', error);
        alert('채팅 초기화에 실패했습니다.');
      }
    }
  };

  return (
    <div className="chat-page-container">
      {/* 대화 목록 사이드바 */}
      <div className="conversation-sidebar">
        <div className="sidebar-header">
          <h3>💬 대화 목록</h3>
          <button 
            className="btn btn-primary btn-sm"
            onClick={() => {
              setCurrentConversationId(null);
              setMessages([]);
            }}
            title="새 대화 시작"
          >
            ➕ 새 대화
          </button>
        </div>
        
        <div className="conversation-list-container">
          {conversations.length === 0 ? (
            <div className="no-conversations">
              <p>아직 대화가 없습니다.</p>
              <p>새 대화를 시작해보세요!</p>
            </div>
          ) : (
            <ul className="conversation-list list-group">
              {conversations.map(conv => (
                <li 
                  key={conv.id} 
                  className={`conversation-item ${currentConversationId === conv.id ? 'active' : ''}`}
                  onClick={() => handleSelectConversation(conv.id)}
                >
                  <div className="conversation-content">
                    <div className="conversation-title">
                      {conv.title || '제목 없음'}
                    </div>
                    <div className="conversation-meta">
                      <small>{new Date(conv.updated_at).toLocaleString()}</small>
                    </div>
                  </div>
                  <button 
                    className="btn btn-sm btn-outline-danger delete-btn"
                    onClick={(e) => { 
                      e.stopPropagation(); 
                      handleDeleteConversation(conv.id); 
                    }}
                    title="대화 삭제"
                  >
                    🗑️
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div className="chat-container">
        {/* 채팅 헤더 */}
        <div className="chat-header">
          <div className="header-left">
            <div className="db-selector">
              <label htmlFor="db-select" className="prompt-label">DB 선택</label>
              <select 
                id="db-select" 
                value={selectedDb || ''} 
                onChange={(e) => onDbChange(e.target.value)}
              >
                <option value="">DB를 선택하세요</option>
                <option value="__ALL_DBS__">모든 DB</option>
                {databases?.map(db => (
                  <option key={db.name} value={db.name}>
                    {db.name}
                  </option>
                ))}
              </select>
            </div>
            
            {/* AI 모델 선택 드롭다운 */}
            <div className="ai-model-selector ms-3">
              <label htmlFor="ai-model-select" className="prompt-label">AI 모델 선택</label>
              <select 
                id="ai-model-select" 
                value={selectedAiModel} 
                onChange={async (e) => {
                  const modelName = e.target.value;
                  const selected = aiModels.find(m => m.name === modelName);
                  if (selected) {
                    let selectApiEndpoint = '';
                    if (selected.type === 'openai') selectApiEndpoint = '/api/openai/select';
                    else if (selected.type === 'azure_openai') selectApiEndpoint = '/api/azure-openai/select';
                    else if (selected.type === 'gemini') selectApiEndpoint = '/api/gemini/select';
                    else if (selected.type === 'claude') selectApiEndpoint = '/api/claude/select';

                    if (selectApiEndpoint) {
                      try {
                        const formData = new FormData();
                        formData.append('name', selected.name);
                        await axios.post(selectApiEndpoint, formData);
                        setSelectedAiModel(selected.name);
                        alert(`${selected.name} AI 모델이 선택되었습니다.`);
                      } catch (error) {
                        console.error('Error selecting AI model:', error);
                        alert('AI 모델 선택에 실패했습니다.');
                      }
                    }
                  }
                }}
              >
                <option value="">AI 모델 선택</option>
                {aiModels.map(model => (
                  <option key={model.name} value={model.name}>
                    {model.name} ({model.type})
                  </option>
                ))}
              </select>
            </div>

          </div>
          
          <div className="header-actions">
            {currentConversationId && (
              <button 
                onClick={handleResetChat} 
                className="btn btn-outline-warning btn-sm"
                title="현재 대화 초기화"
              >
                🔄 초기화
              </button>
            )}
            <button 
              onClick={() => {
                setCurrentConversationId(null);
                setMessages([]);
              }}
              className="btn btn-outline-primary btn-sm ms-2"
              title="새 대화 시작"
            >
              ➕ 새 대화
            </button>
          </div>
        </div>

        {/* 채팅 메시지 영역 */}
        <div className="chat-messages" id="chat-messages">
          <div className="chat-box">
            {/* 추천 질문 카드들 (첫 대화 전만 표시) */}
            {messages.length === 0 && !currentConversationId && (
              <div className="suggest-section">
                <h3>💡 추천 질문</h3>
                <div className="suggest-cards">
                  {suggestedQuestions.map((category, categoryIndex) => (
                    <div key={categoryIndex} className="suggest-category">
                      <h4>{category.title}</h4>
                      <div className="suggest-cards-grid">
                        {category.questions.map((question, questionIndex) => (
                          <div 
                            key={questionIndex}
                            className="suggest-card" 
                            onClick={() => handleSuggestedQuestion(question)}
                          >
                            {question}
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 메시지들 */}
            {messages.map((msg, idx) => (
              <div key={idx} className={`message ${msg.role === 'user' ? 'message-user' : 'message-ai'}`}>
                <div className="message-content">
                  <div className="message-header">
                    <span className="message-role">
                      {msg.role === 'user' ? '👤 사용자' : '🤖 AI'}
                    </span>
                    <span className="message-time">{msg.timestamp}</span>
                  </div>
                  
                  <div className="message-body">
                    {msg.role === 'user' ? (
                      <div className="user-message">{msg.content}</div>
                    ) : (
                      <div className="ai-message-card">
                        {msg.content && (
                          <div className="ai-response-section">
                            <ReactMarkdown>{msg.content}</ReactMarkdown>
                          </div>
                        )}
                        {msg.sql && (
                          <div className="sql-section">
                            <div className="section-header">
                              <strong>🔍 생성된 SQL</strong>
                              <button onClick={() => navigator.clipboard.writeText(msg.sql)} className="btn-copy">복사</button>
                            </div>
                            <pre><code>{msg.sql}</code></pre>
                          </div>
                        )}
                        {msg.result && (
                          <div className="result-section">
                            <div className="section-header">
                              <strong>📊 쿼리 결과</strong>
                            </div>
                            <div className="result-table-container">
                              {Array.isArray(msg.result) && msg.result.length > 0 ? (
                                <table className="result-table">
                                  <thead>
                                    <tr>
                                      {Object.keys(msg.result[0] || {}).map((key, i) => (
                                        <th key={i}>{key}</th>
                                      ))}
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {msg.result.map((row, i) => (
                                      <tr key={i}>
                                        {Object.values(row).map((value, j) => (
                                          <td key={j}>{String(value)}</td>
                                        ))}
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              ) : (
                                <div className="no-result">
                                  <p>결과가 없습니다.</p>
                                  <pre><code>{JSON.stringify(msg.result, null, 2)}</code></pre>
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                        {msg.error && (
                          <div className="error-section">
                            <div className="alert alert-danger">
                              <strong>❌ 오류 발생</strong>
                              <p>{msg.content}</p>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}

            {/* 로딩 인디케이터 */}
            {loading && (
              <div className="message message-ai">
                <div className="message-content">
                  <div className="message-header">
                    <span className="message-role">🤖 AI</span>
                    <span className="message-time">처리 중...</span>
                  </div>
                  <div className="message-body">
                    <div className="loading-indicator">
                      <div className="spinner"></div>
                      <span>AI가 응답을 생성하고 있습니다...</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>
        </div>

        {/* 입력 영역 */}
        <div className="chat-input-area">
          <div className="input-container">
            <textarea
              ref={textareaRef}
              value={input}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              placeholder="질문을 입력하세요... (Shift+Enter로 줄바꿈)"
              className="chat-input"
              rows={textareaRows}
              disabled={loading || !selectedDb}
            />
            <button
              onClick={handleSend}
              disabled={loading || !input.trim() || !selectedDb}
              className="send-button"
            >
              {loading ? '⏳' : '📤'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default ChatComponent;
