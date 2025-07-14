import React, { useState, useEffect } from 'react';
import axios from 'axios';

function AIManager() {
    // 기존 OpenAI 상태
    const [openaiKeys, setOpenaiKeys] = useState([]);
    const [selectedOpenaiKey, setSelectedOpenaiKey] = useState('');
    const [newOpenaiKeyName, setNewOpenaiKeyName] = useState('');
    const [newOpenaiKeyValue, setNewOpenaiKeyValue] = useState('');

    // Azure OpenAI 상태 추가
    const [azureOpenAIConfigs, setAzureOpenAIConfigs] = useState([]);
    const [selectedAzureOpenAIConfig, setSelectedAzureOpenAIConfig] = useState('');
    const [newAzureOpenAIName, setNewAzureOpenAIName] = useState('');
    const [newAzureOpenAIKey, setNewAzureOpenAIKey] = useState('');
    const [newAzureOpenAIEndpoint, setNewAzureOpenAIEndpoint] = useState('');
    const [newAzureOpenAIDeploymentName, setNewAzureOpenAIDeploymentName] = useState('');
    const [newAzureOpenAIApiVersion, setNewAzureOpenAIApiVersion] = useState('');

    // Gemini 상태 추가
    const [geminiConfigs, setGeminiConfigs] = useState([]);
    const [selectedGeminiConfig, setSelectedGeminiConfig] = useState('');
    const [newGeminiName, setNewGeminiName] = useState('');
    const [newGeminiKey, setNewGeminiKey] = useState('');
    const [newGeminiModelName, setNewGeminiModelName] = useState('');

    // Claude 상태 추가
    const [claudeConfigs, setClaudeConfigs] = useState([]);
    const [selectedClaudeConfig, setSelectedClaudeConfig] = useState('');
    const [newClaudeName, setNewClaudeName] = useState('');
    const [newClaudeKey, setNewClaudeKey] = useState('');
    const [newClaudeModelName, setNewClaudeModelName] = useState('');

    // 모든 AI 모델 설정 불러오기
    const fetchAllConfigs = async () => {
        try {
            // OpenAI
            const openaiRes = await axios.get('/api/openai/keys');
            setOpenaiKeys(openaiRes.data.keys);
            setSelectedOpenaiKey(openaiRes.data.selected);

            // Azure OpenAI
            const azureOpenAIRes = await axios.get('/api/azure-openai/configs');
            setAzureOpenAIConfigs(azureOpenAIRes.data.configs);
            setSelectedAzureOpenAIConfig(azureOpenAIRes.data.selected);

            // Gemini
            const geminiRes = await axios.get('/api/gemini/configs');
            setGeminiConfigs(geminiRes.data.configs);
            setSelectedGeminiConfig(geminiRes.data.selected);

            // Claude
            const claudeRes = await axios.get('/api/claude/configs');
            setClaudeConfigs(claudeRes.data.configs);
            setSelectedClaudeConfig(claudeRes.data.selected);

        } catch (error) {
            console.error('Error fetching AI configs:', error);
        }
    };

    useEffect(() => {
        fetchAllConfigs();
    }, []);

    // --- OpenAI 관련 함수 (기존 코드 유지 및 필요시 수정) ---
    const handleAddOpenaiKey = async (e) => {
        e.preventDefault();
        try {
            const formData = new FormData();
            formData.append('name', newOpenaiKeyName);
            formData.append('key', newOpenaiKeyValue);
            await axios.post('/api/openai/keys', formData);
            setNewOpenaiKeyName('');
            setNewOpenaiKeyValue('');
            fetchAllConfigs();
        } catch (error) {
            console.error('Error adding OpenAI key:', error);
            alert('Failed to add OpenAI key.');
        }
    };

    const handleSelectOpenaiKey = async (name) => {
        try {
            const formData = new FormData();
            formData.append('name', name);
            await axios.post('/api/openai/select', formData);
            fetchAllConfigs();
        } catch (error) {
            console.error('Error selecting OpenAI key:', error);
            alert('Failed to select OpenAI key.');
        }
    };

    const handleDeleteOpenaiKey = async (name) => {
        try {
            await axios.delete(`/api/openai/keys/${name}`);
            fetchAllConfigs();
        } catch (error) {
            console.error('Error deleting OpenAI key:', error);
            alert('Failed to delete OpenAI key.');
        }
    };

    // --- Azure OpenAI 관련 함수 ---
    const handleAddAzureOpenAIConfig = async (e) => {
        e.preventDefault();
        try {
            const formData = new FormData();
            formData.append('name', newAzureOpenAIName);
            formData.append('api_key', newAzureOpenAIKey);
            formData.append('endpoint', newAzureOpenAIEndpoint);
            formData.append('deployment_name', newAzureOpenAIDeploymentName);
            formData.append('api_version', newAzureOpenAIApiVersion);
            await axios.post('/api/azure-openai/configs', formData);
            setNewAzureOpenAIName('');
            setNewAzureOpenAIKey('');
            setNewAzureOpenAIEndpoint('');
            setNewAzureOpenAIDeploymentName('');
            setNewAzureOpenAIApiVersion('');
            fetchAllConfigs();
        } catch (error) {
            console.error('Error adding Azure OpenAI config:', error);
            alert('Failed to add Azure OpenAI config.');
        }
    };

    const handleSelectAzureOpenAIConfig = async (name) => {
        try {
            const formData = new FormData();
            formData.append('name', name);
            await axios.post('/api/azure-openai/select', formData);
            fetchAllConfigs();
        } catch (error) {
            console.error('Error selecting Azure OpenAI config:', error);
            alert('Failed to select Azure OpenAI config.');
        }
    };

    const handleDeleteAzureOpenAIConfig = async (name) => {
        try {
            await axios.delete(`/api/azure-openai/configs/${name}`);
            fetchAllConfigs();
        } catch (error) {
            console.error('Error deleting Azure OpenAI config:', error);
            alert('Failed to delete Azure OpenAI config.');
        }
    };

    // --- Gemini 관련 함수 ---
    const handleAddGeminiConfig = async (e) => {
        e.preventDefault();
        try {
            const formData = new FormData();
            formData.append('name', newGeminiName);
            formData.append('api_key', newGeminiKey);
            formData.append('model_name', newGeminiModelName);
            await axios.post('/api/gemini/configs', formData);
            setNewGeminiName('');
            setNewGeminiKey('');
            setNewGeminiModelName('');
            fetchAllConfigs();
        } catch (error) {
            console.error('Error adding Gemini config:', error);
            alert('Failed to add Gemini config.');
        }
    };

    const handleSelectGeminiConfig = async (name) => {
        try {
            const formData = new FormData();
            formData.append('name', name);
            await axios.post('/api/gemini/select', formData);
            fetchAllConfigs();
        } catch (error) {
            console.error('Error selecting Gemini config:', error);
            alert('Failed to select Gemini config.');
        }
    };

    const handleDeleteGeminiConfig = async (name) => {
        try {
            await axios.delete(`/api/gemini/configs/${name}`);
            fetchAllConfigs();
        } catch (error) {
            console.error('Error deleting Gemini config:', error);
            alert('Failed to delete Gemini config.');
        }
    };

    // --- Claude 관련 함수 ---
    const handleAddClaudeConfig = async (e) => {
        e.preventDefault();
        try {
            const formData = new FormData();
            formData.append('name', newClaudeName);
            formData.append('api_key', newClaudeKey);
            formData.append('model_name', newClaudeModelName);
            await axios.post('/api/claude/configs', formData);
            setNewClaudeName('');
            setNewClaudeKey('');
            setNewClaudeModelName('');
            fetchAllConfigs();
        } catch (error) {
            console.error('Error adding Claude config:', error);
            alert('Failed to add Claude config.');
        }
    };

    const handleSelectClaudeConfig = async (name) => {
        try {
            const formData = new FormData();
            formData.append('name', name);
            await axios.post('/api/claude/select', formData);
            fetchAllConfigs();
        } catch (error) {
            console.error('Error selecting Claude config:', error);
            alert('Failed to select Claude config.');
        }
    };

    const handleDeleteClaudeConfig = async (name) => {
        try {
            await axios.delete(`/api/claude/configs/${name}`);
            fetchAllConfigs();
        } catch (error) {
            console.error('Error deleting Claude config:', error);
            alert('Failed to delete Claude config.');
        }
    };

    return (
        <div className="ai-manager-container">
            <h2>AI 모델 관리</h2>
            <div className="ai-card-grid">
                {/* OpenAI 카드 */}
                <div className="ai-card">
                    <div className="ai-card-header">OpenAI</div>
                    <div className="ai-card-body">
                        <form onSubmit={handleAddOpenaiKey} className="ai-card-form">
                            <input
                                type="text"
                                className="ai-input"
                                placeholder="이름"
                                value={newOpenaiKeyName}
                                onChange={(e) => setNewOpenaiKeyName(e.target.value)}
                                required
                            />
                            <input
                                type="text"
                                className="ai-input"
                                placeholder="API 키"
                                value={newOpenaiKeyValue}
                                onChange={(e) => setNewOpenaiKeyValue(e.target.value)}
                                required
                            />
                            <button type="submit" className="btn btn-primary">추가</button>
                        </form>
                        <div className="ai-card-list">
                            {openaiKeys.map((key) => (
                                <div key={key.name} className={`ai-card-item${selectedOpenaiKey === key.name ? ' selected' : ''}`}>
                                    <div className="ai-card-item-main">
                                        <div className="ai-card-item-title">{key.name}</div>
                                        <div className="ai-card-item-desc">{key.key}</div>
                                    </div>
                                    <div className="ai-card-item-actions">
                                        <button className="btn btn-outline btn-sm" onClick={() => handleSelectOpenaiKey(key.name)} disabled={selectedOpenaiKey === key.name}>선택</button>
                                        <button className="btn btn-outline btn-sm" onClick={() => handleDeleteOpenaiKey(key.name)}>삭제</button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
                {/* Azure OpenAI 카드 */}
                <div className="ai-card">
                    <div className="ai-card-header">Azure OpenAI</div>
                    <div className="ai-card-body">
                        <form onSubmit={handleAddAzureOpenAIConfig} className="ai-card-form">
                            <input type="text" className="ai-input" placeholder="이름" value={newAzureOpenAIName} onChange={e => setNewAzureOpenAIName(e.target.value)} required />
                            <input type="text" className="ai-input" placeholder="API 키" value={newAzureOpenAIKey} onChange={e => setNewAzureOpenAIKey(e.target.value)} required />
                            <input type="text" className="ai-input" placeholder="엔드포인트" value={newAzureOpenAIEndpoint} onChange={e => setNewAzureOpenAIEndpoint(e.target.value)} required />
                            <input type="text" className="ai-input" placeholder="배포 이름" value={newAzureOpenAIDeploymentName} onChange={e => setNewAzureOpenAIDeploymentName(e.target.value)} required />
                            <input type="text" className="ai-input" placeholder="API 버전" value={newAzureOpenAIApiVersion} onChange={e => setNewAzureOpenAIApiVersion(e.target.value)} required />
                            <button type="submit" className="btn btn-primary">추가</button>
                        </form>
                        <div className="ai-card-list">
                            {azureOpenAIConfigs.map((cfg) => (
                                <div key={cfg.name} className={`ai-card-item${selectedAzureOpenAIConfig === cfg.name ? ' selected' : ''}`}>
                                    <div className="ai-card-item-main">
                                        <div className="ai-card-item-title">{cfg.name}</div>
                                        <div className="ai-card-item-desc">{cfg.endpoint} / {cfg.deployment_name}</div>
                                    </div>
                                    <div className="ai-card-item-actions">
                                        <button className="btn btn-outline btn-sm" onClick={() => handleSelectAzureOpenAIConfig(cfg.name)} disabled={selectedAzureOpenAIConfig === cfg.name}>선택</button>
                                        <button className="btn btn-outline btn-sm" onClick={() => handleDeleteAzureOpenAIConfig(cfg.name)}>삭제</button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
                {/* Gemini 카드 */}
                <div className="ai-card">
                    <div className="ai-card-header">Gemini</div>
                    <div className="ai-card-body">
                        <form onSubmit={handleAddGeminiConfig} className="ai-card-form">
                            <input type="text" className="ai-input" placeholder="이름" value={newGeminiName} onChange={e => setNewGeminiName(e.target.value)} required />
                            <input type="text" className="ai-input" placeholder="API 키" value={newGeminiKey} onChange={e => setNewGeminiKey(e.target.value)} required />
                            <input type="text" className="ai-input" placeholder="모델명" value={newGeminiModelName} onChange={e => setNewGeminiModelName(e.target.value)} required />
                            <button type="submit" className="btn btn-primary">추가</button>
                        </form>
                        <div className="ai-card-list">
                            {geminiConfigs.map((cfg) => (
                                <div key={cfg.name} className={`ai-card-item${selectedGeminiConfig === cfg.name ? ' selected' : ''}`}>
                                    <div className="ai-card-item-main">
                                        <div className="ai-card-item-title">{cfg.name}</div>
                                        <div className="ai-card-item-desc">{cfg.model_name}</div>
                                    </div>
                                    <div className="ai-card-item-actions">
                                        <button className="btn btn-outline btn-sm" onClick={() => handleSelectGeminiConfig(cfg.name)} disabled={selectedGeminiConfig === cfg.name}>선택</button>
                                        <button className="btn btn-outline btn-sm" onClick={() => handleDeleteGeminiConfig(cfg.name)}>삭제</button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
                {/* Claude 카드 */}
                <div className="ai-card">
                    <div className="ai-card-header">Claude</div>
                    <div className="ai-card-body">
                        <form onSubmit={handleAddClaudeConfig} className="ai-card-form">
                            <input type="text" className="ai-input" placeholder="이름" value={newClaudeName} onChange={e => setNewClaudeName(e.target.value)} required />
                            <input type="text" className="ai-input" placeholder="API 키" value={newClaudeKey} onChange={e => setNewClaudeKey(e.target.value)} required />
                            <input type="text" className="ai-input" placeholder="모델명" value={newClaudeModelName} onChange={e => setNewClaudeModelName(e.target.value)} required />
                            <button type="submit" className="btn btn-primary">추가</button>
                        </form>
                        <div className="ai-card-list">
                            {claudeConfigs.map((cfg) => (
                                <div key={cfg.name} className={`ai-card-item${selectedClaudeConfig === cfg.name ? ' selected' : ''}`}>
                                    <div className="ai-card-item-main">
                                        <div className="ai-card-item-title">{cfg.name}</div>
                                        <div className="ai-card-item-desc">{cfg.model_name}</div>
                                    </div>
                                    <div className="ai-card-item-actions">
                                        <button className="btn btn-outline btn-sm" onClick={() => handleSelectClaudeConfig(cfg.name)} disabled={selectedClaudeConfig === cfg.name}>선택</button>
                                        <button className="btn btn-outline btn-sm" onClick={() => handleDeleteClaudeConfig(cfg.name)}>삭제</button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default AIManager;