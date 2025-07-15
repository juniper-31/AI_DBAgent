import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import ReactMarkdown from 'react-markdown';

function renderMarkdownTable(md) {
  const tableMatch = md.match(/\|.*\|/g);
  if (!tableMatch) return null;
  const rows = tableMatch.map(row => row.split('|').slice(1, -1).map(cell => cell.trim()));
  if (rows.length < 2) return null;
  const headers = rows[0];
  const data = rows.slice(2);
  return (
    <table className="result-table" style={{ minWidth: 600, fontSize: '1.05em' }}>
      <thead>
        <tr>{headers.map((h, i) => <th key={i}>{h}</th>)}</tr>
      </thead>
      <tbody>
        {data.map((row, ridx) => (
          <tr key={ridx}>{row.map((cell, cidx) => <td key={cidx}>{cell}</td>)}</tr>
        ))}
      </tbody>
    </table>
  );
}

function renderAutoTable(data) {
  if (Array.isArray(data)) {
    if (data.length === 0) return null;
    if (typeof data[0] === 'object' && data[0] !== null) {
      const headers = Object.keys(data[0]);
      return (
        <table className="result-table" style={{ minWidth: 600, fontSize: '1.05em' }}>
          <thead>
            <tr>{headers.map((h, i) => <th key={i}>{h}</th>)}</tr>
          </thead>
          <tbody>
            {data.map((row, ridx) => (
              <tr key={ridx}>{headers.map((h, cidx) => <td key={cidx}>{row[h]}</td>)}</tr>
            ))}
          </tbody>
        </table>
      );
    } else {
      return (
        <table className="result-table" style={{ minWidth: 300, fontSize: '1.05em' }}>
          <tbody>
            {data.map((v, i) => <tr key={i}><td>{v}</td></tr>)}
          </tbody>
        </table>
      );
    }
  } else if (typeof data === 'object' && data !== null) {
    const headers = Object.keys(data);
    return (
      <table className="result-table" style={{ minWidth: 300, fontSize: '1.05em' }}>
        <tbody>
          {headers.map((h, i) => <tr key={i}><th>{h}</th><td>{data[h]}</td></tr>)}
        </tbody>
      </table>
    );
  }
  return null;
}

function ChatComponent({ selectedDb, databases, onDbChange }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [textareaRows, setTextareaRows] = useState(1);
  const messagesEndRef = useRef(null);
  const textareaRef = useRef(null);
  const [aiModels, setAiModels] = useState([]);
  const [selectedAiModel, setSelectedAiModel] = useState('');
  const [dbSchema, setDbSchema] = useState(null);
  const [conversations, setConversations] = useState([]);
  const [currentConversationId, setCurrentConversationId] = useState(null);
  const [conversationSidebarCollapsed, setConversationSidebarCollapsed] = useState(false);
  const [runningPlaybook, setRunningPlaybook] = useState(null);
  const [currentPlaybookStep, setCurrentPlaybookStep] = useState(0);
  const [playbookAutoMode, setPlaybookAutoMode] = useState(false);

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

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    const checkForPlaybookExecution = () => {
      const playbookData = sessionStorage.getItem('runningPlaybook');
      if (playbookData) {
        try {
          const playbook = JSON.parse(playbookData);
          sessionStorage.removeItem('runningPlaybook');
          setRunningPlaybook(playbook);
          setCurrentPlaybookStep(0);
          setPlaybookAutoMode(true); // 플레이북 실행 시 자동 모드로 설정
          if (playbook.selectedDb && playbook.selectedDb !== selectedDb) {
            onDbChange(playbook.selectedDb);
          }
          const welcomeMessage = {
            role: 'assistant',
            content: `🚀 **플레이북 "${playbook.name}" 실행을 시작합니다**\n\n📋 **설명:** ${playbook.description}\n\n📊 **총 ${playbook.steps.length}단계**로 구성되어 있습니다.`,
            timestamp: new Date().toLocaleTimeString(),
            isPlaybookMessage: true
          };
          setMessages([welcomeMessage]);
          setTimeout(() => {
            executePlaybookStep(playbook, 0);
          }, 1000);
        } catch (error) {
          console.error('플레이북 데이터 파싱 오류:', error);
          sessionStorage.removeItem('runningPlaybook');
        }
      }
    };
    checkForPlaybookExecution();
  }, []);

  useEffect(() => {
    const fetchConversations = async () => {
      if (selectedDb) {
        try {
          const response = await axios.get(`/api/conversations?db_name=${selectedDb}`);
          if (response.data.status === 'success') {
            const conversations = response.data.conversations;
            setConversations(conversations);
            if (conversations.length > 0) {
              setCurrentConversationId(conversations[0].id);
            } else {
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

  useEffect(() => {
    const fetchDbSchema = async () => {
      if (selectedDb && selectedDb !== '__ALL_DBS__') {
        try {
          const response = await axios.get(`/api/schema/${selectedDb}`);
          if (response.data.status === 'success') {
            setDbSchema(response.data.schema);
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

  useEffect(() => {
    const fetchMessages = async () => {
      if (currentConversationId) {
        try {
          const response = await axios.get(`/api/conversations/${currentConversationId}/messages`);
          if (response.data.status === 'success') {
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

  const autoResizeTextarea = (el) => {
    el.style.height = 'auto';
    const newHeight = Math.min(el.scrollHeight, 120);
    el.style.height = newHeight + 'px';
    setTextareaRows(Math.ceil(newHeight / 24));
  };

  const handleSuggestedQuestion = (question) => {
    setInput(question);
    textareaRef.current?.focus();
  };

  const generateSchemaPrompt = (schema) => {
    let prompt = `데이터베이스에 ${schema.tables.length}개의 테이블이 있습니다:\n\n`;
    schema.tables.forEach(table => {
      prompt += `테이블: ${table.name}`;
      if (table.comment) {
        prompt += ` (${table.comment})`;
      }
      prompt += '\n  컬럼:\n';
      table.columns.forEach(column => {
        prompt += `    - ${column.name}: ${column.type}`;
        if (column.max_length) {
          prompt += `(${column.max_length})`;
        }
        if (!column.nullable) {
          prompt += ' (NOT NULL)';
        }
        if (column.comment) {
          prompt += ` - ${column.comment}`;
        }
        prompt += '\n';
      });
      prompt += '\n';
    });
    return prompt;
  }; 
 const handleSelectConversation = (convId) => {
    setCurrentConversationId(convId);
  };

  const handleDeleteConversation = async (convId) => {
    if (window.confirm('정말로 이 대화를 삭제하시겠습니까?')) {
      try {
        await axios.delete(`/api/conversations/${convId}`);
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

  const executePlaybookStep = async (playbook, stepIndex) => {
    if (!playbook || !playbook.steps || stepIndex >= playbook.steps.length) {
      return;
    }
    const step = playbook.steps[stepIndex];
    const stepStartMessage = {
      role: 'assistant',
      content: `📋 **단계 ${stepIndex + 1}/${playbook.steps.length}: ${step.title}**\n\n🔍 실행 중...`,
      timestamp: new Date().toLocaleTimeString(),
      isPlaybookStep: true
    };
    setMessages(prev => [...prev, stepStartMessage]);
    setLoading(true);
    try {
      let conversationId = currentConversationId;
      
      // 플레이북 전용 대화 찾기 또는 생성
      if (!conversationId || stepIndex === 0) {
        // 기존 플레이북 대화 찾기
        const existingPlaybookConv = conversations.find(conv => 
          conv.title.includes(`플레이북: ${playbook.name}`) || 
          conv.title.includes('플레이북:')
        );
        
        if (existingPlaybookConv && stepIndex === 0) {
          // 기존 플레이북 대화가 있고 첫 번째 단계라면 해당 대화 초기화
          conversationId = existingPlaybookConv.id;
          setCurrentConversationId(conversationId);
          
          // 기존 대화 내용 초기화
          const resetFormData = new FormData();
          resetFormData.append('conversation_id', conversationId);
          await axios.post('/api/nl2sql/reset', resetFormData);
        } else if (existingPlaybookConv) {
          // 기존 플레이북 대화 재사용
          conversationId = existingPlaybookConv.id;
          setCurrentConversationId(conversationId);
        } else {
          // 새 플레이북 대화 생성
          const newConvResponse = await axios.post('/api/conversations/new', new URLSearchParams({
            db_name: playbook.selectedDb,
            title: `플레이북: ${playbook.name}`
          }));
          if (newConvResponse.data.status === 'success') {
            conversationId = newConvResponse.data.conversation_id;
            setCurrentConversationId(conversationId);
            
            // 대화 목록 새로고침
            const convRes = await axios.get(`/api/conversations?db_name=${playbook.selectedDb}`);
            if (convRes.data.status === 'success') {
              setConversations(convRes.data.conversations);
            }
          }
        }
      }
      const formData = new FormData();
      formData.append('db_name', playbook.selectedDb);
      let enhancedPrompt = step.prompt;
      if (dbSchema && dbSchema.tables && dbSchema.tables.length > 0) {
        const schemaInfo = generateSchemaPrompt(dbSchema);
        enhancedPrompt = `[데이터베이스 스키마 정보]\n${schemaInfo}\n\n[플레이북 단계 실행]\n단계: ${step.title}\n요청: ${step.prompt}`;
      }
      formData.append('prompt', enhancedPrompt);
      formData.append('conversation_id', conversationId);
      const response = await axios.post('/api/nl2sql', formData);
      if (response.data.status === 'success') {
        const data = response.data.message;
        const stepResultMessage = {
          role: 'assistant',
          content: `✅ **단계 ${stepIndex + 1} 완료: ${step.title}**\n\n${data.content || ''}`,
          sql: data.sql || '',
          result: data.result || null,
          timestamp: new Date().toLocaleTimeString(),
          isPlaybookStep: true
        };
        setMessages(prev => {
          const newMessages = [...prev];
          newMessages[newMessages.length - 1] = stepResultMessage;
          return newMessages;
        });
        const nextStepIndex = stepIndex + 1;
        
        if (nextStepIndex < playbook.steps.length) {
          // 자동 모드 상태를 직접 확인하여 클로저 문제 해결
          setPlaybookAutoMode(currentAutoMode => {
            if (currentAutoMode) {
              setTimeout(() => {
                setCurrentPlaybookStep(nextStepIndex);
                executePlaybookStep(playbook, nextStepIndex);
              }, 3000);
            } else {
              setCurrentPlaybookStep(nextStepIndex);
              const nextStepPrompt = {
                role: 'assistant',
                content: `⏭️ **다음 단계 준비됨**\n\n**단계 ${nextStepIndex + 1}: ${playbook.steps[nextStepIndex].title}**`,
                timestamp: new Date().toLocaleTimeString(),
                isPlaybookControl: true,
                nextStepIndex: nextStepIndex
              };
              setMessages(prev => [...prev, nextStepPrompt]);
            }
            return currentAutoMode; // 상태 변경 없이 현재 값 유지
          });
        } else {
          setCurrentPlaybookStep(playbook.steps.length); // 모든 단계 완료
          const completionMessage = {
            role: 'assistant',
            content: `🎉 **플레이북 "${playbook.name}" 실행 완료!**`,
            timestamp: new Date().toLocaleTimeString(),
            isPlaybookComplete: true
          };
          setMessages(prev => [...prev, completionMessage]);
          setRunningPlaybook(null);
          setCurrentPlaybookStep(0);
        }
      }
    } catch (error) {
      console.error('플레이북 단계 실행 오류:', error);
    } finally {
      setLoading(false);
    }
  }; 
 const handleNextPlaybookStep = (stepIndex) => {
    if (runningPlaybook) {
      executePlaybookStep(runningPlaybook, stepIndex);
    }
  };

  const togglePlaybookAutoMode = () => {
    setPlaybookAutoMode(!playbookAutoMode);
  };

  const stopPlaybook = () => {
    if (window.confirm('플레이북 실행을 중단하시겠습니까?')) {
      setRunningPlaybook(null);
      setCurrentPlaybookStep(0);
      setPlaybookAutoMode(false);
      const stopMessage = {
        role: 'assistant',
        content: `⏹️ **플레이북 실행이 중단되었습니다.**`,
        timestamp: new Date().toLocaleTimeString(),
        isPlaybookStop: true
      };
      setMessages(prev => [...prev, stopMessage]);
    }
  };

  const handleSend = async () => {
    if (!input.trim() || !selectedDb) return;
    if (!selectedAiModel) {
      alert('먼저 사용할 AI 모델을 선택해주세요.');
      return;
    }
    let conversationId = currentConversationId;
    if (!conversationId) {
      try {
        const newConvResponse = await axios.post('/api/conversations/new', new URLSearchParams({
          db_name: selectedDb,
          title: input.substring(0, 30)
        }));
        if (newConvResponse.data.status === 'success') {
          conversationId = newConvResponse.data.conversation_id;
          setCurrentConversationId(conversationId);
        }
      } catch (error) {
        console.error('새 대화 생성 실패:', error);
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
      let enhancedPrompt = input;
      if (dbSchema && dbSchema.tables && dbSchema.tables.length > 0) {
        const schemaInfo = generateSchemaPrompt(dbSchema);
        enhancedPrompt = `[데이터베이스 스키마 정보]\n${schemaInfo}\n\n[사용자 질문]\n${input}`;
      }
      formData.append('prompt', enhancedPrompt);
      formData.append('conversation_id', conversationId);
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

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleInputChange = (e) => {
    setInput(e.target.value);
    autoResizeTextarea(e.target);
  };

  const handleResetChat = async () => {
    if (!currentConversationId) return;
    if (window.confirm('현재 대화의 모든 메시지를 초기화하시겠습니까?')) {
      try {
        const formData = new FormData();
        formData.append('conversation_id', currentConversationId);
        const response = await axios.post('/api/nl2sql/reset', formData);
        if (response.data.status === 'success') {
          setMessages([]);
        }
      } catch (error) {
        console.error('채팅 초기화 오류:', error);
        alert('채팅 초기화에 실패했습니다.');
      }
    }
  };

  return (
    <div className="chat-page-container">
      <div className={`conversation-sidebar${conversationSidebarCollapsed ? ' collapsed' : ''}`}> 
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
          <button 
            className="sidebar-toggle-btn"
            style={{ marginLeft: 8 }}
            onClick={() => setConversationSidebarCollapsed(v => !v)}
            title={conversationSidebarCollapsed ? '대화목록 펼치기' : '대화목록 접기'}
          >
            {conversationSidebarCollapsed ? '▶' : '◀'}
          </button>
        </div>
        {!conversationSidebarCollapsed && (
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
                    className={`conversation-item list-group-item${currentConversationId === conv.id ? ' active' : ''}`}
                    onClick={() => handleSelectConversation(conv.id)}
                  >
                    <div className="conversation-content">
                      <div className="conversation-title">{conv.title}</div>
                      <div className="conversation-meta">{conv.updated_at}</div>
                    </div>
                    <button className="delete-btn btn btn-danger btn-sm" onClick={e => { e.stopPropagation(); handleDeleteConversation(conv.id); }}>삭제</button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>

      <div className="chat-container">
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
       <div className="chat-messages" id="chat-messages">
          <div className="chat-box">
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

            {runningPlaybook && (
              <div className="playbook-control-panel">
                <div className="playbook-header">
                  <h4>🚀 플레이북 실행 중: {runningPlaybook.name}</h4>
                  <div className="playbook-progress">
                    진행률: {currentPlaybookStep + 1}/{runningPlaybook.steps.length} 
                    ({Math.round(((currentPlaybookStep + 1) / runningPlaybook.steps.length) * 100)}%)
                  </div>
                </div>
                <div className="playbook-controls">
                  <button 
                    onClick={togglePlaybookAutoMode}
                    className={`btn ${playbookAutoMode ? 'btn-warning' : 'btn-success'} btn-sm`}
                  >
                    {playbookAutoMode ? '⏸️ 수동 모드' : '▶️ 자동 모드'}
                  </button>
                  <button 
                    onClick={stopPlaybook}
                    className="btn btn-danger btn-sm"
                  >
                    ⏹️ 중단
                  </button>
                </div>
              </div>
            )}

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
                        
                        {msg.isPlaybookControl && (
                          <div className="playbook-step-controls">
                            <button
                              onClick={() => handleNextPlaybookStep(msg.nextStepIndex)}
                              className="btn btn-primary"
                              disabled={loading}
                            >
                              ▶️ 다음 단계 실행
                            </button>
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
                            <div className="result-table-container" style={{ maxWidth: '100%', overflowX: 'auto', minWidth: 600 }}>
                              {msg.result.headers && msg.result.data ? (
                                msg.result.data.length > 0 ? (
                                  <table className="result-table" style={{ minWidth: 600, fontSize: '1.05em' }}>
                                    <thead>
                                      <tr>
                                        {msg.result.headers.map((header, idx) => (
                                          <th key={idx} style={{ padding: '8px 12px', background: '#f5f5f5', border: '1px solid #ddd' }}>{header}</th>
                                        ))}
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {msg.result.data.map((row, ridx) => (
                                        <tr key={ridx}>
                                          {row.map((cell, cidx) => (
                                            <td key={cidx} style={{ padding: '8px 12px', border: '1px solid #eee', background: ridx % 2 === 0 ? '#fff' : '#fafbfc' }}>{cell === null ? '' : String(cell)}</td>
                                          ))}
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                ) : (
                                  <div style={{ color: '#888', padding: '16px' }}>데이터 없음</div>
                                )
                              ) : (
                                (typeof msg.result === 'string' && renderMarkdownTable(msg.result)) ||
                                renderAutoTable(msg.result) ||
                                <pre style={{ fontSize: '1.05em', background: '#f8f8f8', padding: 12, borderRadius: 6, overflowX: 'auto' }}>{typeof msg.result === 'object' ? JSON.stringify(msg.result, null, 2) : String(msg.result)}</pre>
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