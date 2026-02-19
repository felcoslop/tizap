import React, { useState, useEffect, useRef, useCallback } from 'react';
import ReactFlow, { Background, Controls, ReactFlowProvider } from 'reactflow';
import 'reactflow/dist/style.css';
import {
    Plus, Trash2, Edit3, Save, ArrowLeft, Image as ImageIcon,
    MessageSquare, ListOrdered, RefreshCw, Zap, Clock, Bell, XCircle, Mail, Settings, X, Upload, AlertCircle, Download
} from 'lucide-react';
import Pagination from '../../components/Pagination';

// Import Custom Nodes
import MessageNode from '../../components/nodes/MessageNode';
import OptionsNode from '../../components/nodes/OptionsNode';
import ImageNode from '../../components/nodes/ImageNode';
import AlertNode from '../../components/nodes/AlertNode';
import BusinessHoursNode from '../../components/nodes/BusinessHoursNode';
import CloseAutomationNode from '../../components/nodes/CloseAutomationNode';
import EmailNode from '../../components/nodes/EmailNode';
import '../../components/nodes/NodeStyles.css';
import SessionManagerModal from '../../components/Modals/SessionManagerModal';

// Import Custom Hook
import { useFlowEditor } from '../../hooks/useFlowEditor';

const nodeTypes = {
    messageNode: MessageNode,
    optionsNode: OptionsNode,
    imageNode: ImageNode,
    alertNode: AlertNode,
    businessHoursNode: BusinessHoursNode,
    closeAutomationNode: CloseAutomationNode,
    emailNode: EmailNode
};

function AutomationEditor({ automation, onSave, onBack, userId, addToast, token, config, setConfig, user }) {
    const [name, setName] = useState(automation?.name || 'Nova Automação');
    const [triggerType, setTriggerType] = useState(automation?.triggerType || 'keyword');
    const [triggerKeywords, setTriggerKeywords] = useState(automation?.triggerKeywords || '');
    const [loading, setLoading] = useState(false);

    // Settings Modal State
    const [showDelayModal, setShowDelayModal] = useState(false);
    const [automationDelay, setAutomationDelay] = useState(1440); // Default 24h
    const [sessionWaitTime, setSessionWaitTime] = useState(1440); // Default 24h expiration
    const [agentLockoutTime, setAgentLockoutTime] = useState(2160); // Default 36h

    const {
        nodes, setNodes, edges, setEdges,
        onNodesChange, onEdgesChange, onConnect,
        reactFlowInstance, setReactFlowInstance,
        handleNodeDataChange, handleDeleteNode
    } = useFlowEditor({ defaultColor: '#00a276' });

    // Load initial config (automationDelay is still global, sessionWaitTime is per-automation)
    useEffect(() => {
        if (config?.automationDelay !== undefined) {
            setAutomationDelay(config.automationDelay);
        }
        if (config?.agentLockoutTime !== undefined) {
            setAgentLockoutTime(config.agentLockoutTime);
        }
        // sessionWaitTime is loaded from automation in the other useEffect
    }, [config]);

    const saveDelayConfig = async () => {
        try {
            if (!user?.id) return;
            // Only save automationDelay to global config (sessionWaitTime is now per-automation)
            await fetch(`/api/user-config/${user.id}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify({
                    ...config,
                    mapping: config?.mapping || {},
                    automationDelay: parseInt(automationDelay),
                    agentLockoutTime: parseInt(agentLockoutTime)
                })
            });
            setShowDelayModal(false);
            if (setConfig) setConfig({ ...config, automationDelay: parseInt(automationDelay), agentLockoutTime: parseInt(agentLockoutTime) });
            addToast('Configuração salva!', 'success');
        } catch (err) {
            console.error(err);
            addToast('Erro ao salvar configuração.', 'error');
        }
    };

    useEffect(() => {
        if (automation && automation !== 'new') {
            try {
                const loadedNodes = typeof automation.nodes === 'string' ? JSON.parse(automation.nodes || '[]') : (automation.nodes || []);
                const loadedEdges = typeof automation.edges === 'string' ? JSON.parse(automation.edges || '[]') : (automation.edges || []);
                // Inject common handlers 
                const nodesWithHandlers = loadedNodes.map(n => ({
                    ...n,
                    data: {
                        ...n.data,
                        token, userId,
                        onChange: handleNodeDataChange,
                        onDelete: handleDeleteNode
                    }
                }));
                setNodes(nodesWithHandlers);
                setEdges(loadedEdges);
                setName(automation.name);
                setTriggerType(automation.triggerType || 'keyword');
                setTriggerKeywords(automation.triggerKeywords || '');
                // Load per-automation sessionWaitTime
                if (automation.sessionWaitTime !== undefined) {
                    setSessionWaitTime(automation.sessionWaitTime);
                }
            } catch (e) {
                console.error('Error loading automation nodes:', e);
            }
        } else if (!nodes.length) {
            // Initial Start Node for new automation
            setNodes([
                {
                    id: 'node_start',
                    type: 'messageNode',
                    position: { x: 250, y: 100 },
                    data: { label: 'Primeira mensagem da automação', onChange: handleNodeDataChange, onDelete: handleDeleteNode, token, userId }
                }
            ]);
        }
    }, [automation, handleNodeDataChange, handleDeleteNode, setNodes, setEdges, token, userId]);

    const addNode = (type) => {
        const id = `node_${Date.now()}`;
        const position = reactFlowInstance ? reactFlowInstance.project({ x: 400, y: 200 }) : { x: 400, y: 200 };
        const defaultData = { onChange: handleNodeDataChange, onDelete: handleDeleteNode, token, userId };

        if (type === 'messageNode') { defaultData.label = 'Nova mensagem'; defaultData.typingTime = 2; }
        else if (type === 'optionsNode') { defaultData.label = 'Escolha:'; defaultData.options = ['Sim', 'Não']; defaultData.typingTime = 2; }
        else if (type === 'imageNode') { defaultData.imageUrls = []; defaultData.caption = ''; }
        else if (type === 'alertNode') { defaultData.phone = ''; defaultData.text = 'Alerta!'; }
        else if (type === 'businessHoursNode') { defaultData.start = '08:00'; defaultData.end = '18:00'; }
        else if (type === 'emailNode') { defaultData.recipientEmail = ''; defaultData.templateId = ''; }

        setNodes((nds) => nds.concat({ id, type, position, data: defaultData }));
    };

    const handleSave = async () => {
        if (triggerType === 'keyword' && !triggerKeywords.trim()) {
            return addToast('Por favor, insira ao menos uma palavra-chave.', 'error');
        }

        setLoading(true);
        try {
            const data = {
                id: automation?.id,
                name,
                triggerType,
                triggerKeywords,
                nodes, // Pass as object, backend/wrapper handles stringify
                edges,
                sessionWaitTime: parseInt(sessionWaitTime),
                isActive: automation && automation !== 'new' ? (automation.isActive ?? true) : false
            };
            await onSave(data);
        } finally {
            setLoading(false);
        }
    };

    const handleDownloadJson = () => {
        const data = {
            name,
            triggerType,
            triggerKeywords,
            nodes,
            edges
        };
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `${name.replace(/\s+/g, '_')}_automation.json`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        addToast('JSON da automação baixado!', 'success');
    };

    return (
        <div style={{ height: 'calc(100vh - 70px)', display: 'flex', flexDirection: 'column', background: '#fcfcfc' }}>
            <div style={{ padding: '8px 24px', background: 'white', borderBottom: '1px solid #eef0f2', display: 'flex', justifyContent: 'space-between', alignItems: 'center', boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                    <button onClick={onBack} style={{ background: '#f8f9fa', border: 'none', padding: '8px', borderRadius: '8px', cursor: 'pointer' }}><ArrowLeft size={18} /></button>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <input
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            style={{ fontSize: '18px', fontWeight: '800', border: 'none', background: 'transparent', outline: 'none', color: '#1a1a1a', width: '400px' }}
                            placeholder="Nome da Automação"
                        />
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span style={{ fontSize: '11px', color: '#666', fontWeight: 'bold', textTransform: 'uppercase' }}>Disparado por:</span>
                            <select
                                value={triggerType}
                                onChange={(e) => setTriggerType(e.target.value)}
                                style={{ fontSize: '11px', border: 'none', background: '#f0fdf4', color: '#166534', padding: '2px 6px', borderRadius: '4px', fontWeight: 'bold', cursor: 'pointer' }}
                            >
                                <option value="keyword">Palavra-Chave</option>
                                <option value="message">Qualquer Mensagem</option>
                                <option value="connection_update">Status da Conexão</option>
                                <option value="qrcode_updated">Novo QR Code</option>
                                <option value="contacts_upsert">Novo Contato</option>
                            </select>
                        </div>
                    </div>
                </div>

                <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                    {triggerType === 'keyword' && (
                        <div style={{ position: 'relative' }}>
                            <Zap size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#00a276' }} />
                            <input
                                type="text"
                                value={triggerKeywords}
                                onChange={(e) => setTriggerKeywords(e.target.value)}
                                placeholder="palavra, outra, termo"
                                style={{ padding: '8px 12px 8px 32px', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '13px', width: '220px' }}
                            />
                        </div>
                    )}
                    <button
                        onClick={() => setShowDelayModal(true)}
                        style={{ background: '#f1f5f9', border: 'none', padding: '8px', borderRadius: '8px', cursor: 'pointer', color: '#475569' }}
                        title="Configurações de Anti-Loop"
                    >
                        <Settings size={18} />
                    </button>
                    <button
                        onClick={handleDownloadJson}
                        style={{ background: '#f1f5f9', border: 'none', padding: '8px', borderRadius: '8px', cursor: 'pointer', color: '#475569' }}
                        title="Baixar JSON da Automação"
                    >
                        <Download size={18} />
                    </button>
                    <button className="btn-small btn-primary" onClick={handleSave} disabled={loading} style={{ background: '#00a276', height: '38px', padding: '0 20px', fontWeight: '700' }}>
                        {loading ? <RefreshCw className="animate-spin" size={16} /> : <><Save size={16} /> Salvar Automação</>}
                    </button>
                </div>
            </div>

            <div style={{ flex: 1, position: 'relative' }}>
                <ReactFlow
                    nodes={nodes}
                    edges={edges}
                    onNodesChange={onNodesChange}
                    onEdgesChange={onEdgesChange}
                    onConnect={onConnect}
                    onInit={setReactFlowInstance}
                    nodeTypes={nodeTypes}
                    deleteKeyCode={["Backspace", "Delete"]}
                    fitView
                >
                    <Background color="#e2e8f0" gap={20} size={1} />
                    <Controls />
                </ReactFlow>

                {/* Toolbar */}
                <div style={{
                    position: 'absolute', left: 24, top: 24, zIndex: 5,
                    background: 'white', padding: '12px', borderRadius: '16px',
                    boxShadow: '0 10px 25px rgba(0,0,0,0.08)', display: 'flex', flexDirection: 'column', gap: '8px',
                    width: '180px', border: '1px solid #eef0f2'
                }}>
                    <p style={{ margin: '0 4px 4px', fontSize: '10px', fontWeight: '800', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Conteúdo</p>
                    <button className="btn-small" onClick={() => addNode('messageNode')} style={{ background: '#f0fdf4', color: '#166534', border: '1px solid #dcfce7', justifyContent: 'flex-start' }}><MessageSquare size={14} /> Texto</button>
                    <button className="btn-small" onClick={() => addNode('imageNode')} style={{ background: '#fff1f2', color: '#9f1239', border: '1px solid #ffe4e6', justifyContent: 'flex-start' }}><ImageIcon size={14} /> Imagens</button>

                    <p style={{ margin: '8px 4px 4px', fontSize: '10px', fontWeight: '800', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Interação</p>
                    <button className="btn-small" onClick={() => addNode('optionsNode')} style={{ background: '#fffbeb', color: '#92400e', border: '1px solid #fef3c7', justifyContent: 'flex-start' }}><ListOrdered size={14} /> Menu Opções</button>

                    <p style={{ margin: '8px 4px 4px', fontSize: '10px', fontWeight: '800', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Lógica</p>
                    <button className="btn-small" onClick={() => addNode('businessHoursNode')} style={{ background: '#eff6ff', color: '#1e40af', border: '1px solid #dbeafe', justifyContent: 'flex-start' }}><Clock size={14} /> Horário</button>
                    <button className="btn-small" onClick={() => addNode('alertNode')} style={{ background: '#fff7ed', color: '#9a3412', border: '1px solid #ffedd5', justifyContent: 'flex-start' }}><Bell size={14} /> Alerta Admin</button>
                    <button className="btn-small" onClick={() => addNode('emailNode')} style={{ background: '#f5f3ff', color: '#5b21b6', border: '1px solid #ede9fe', justifyContent: 'flex-start' }}><Mail size={14} /> Enviar E-mail</button>
                    <button className="btn-small" onClick={() => addNode('closeAutomationNode')} style={{ background: '#fef2f2', color: '#991b1b', border: '1px solid #fee2e2', justifyContent: 'flex-start' }}><XCircle size={14} /> Encerrar</button>
                </div>
            </div>

            {/* Anti-Loop Modal */}
            {showDelayModal && (
                <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(4px)' }}>
                    <div style={{ background: 'white', padding: '32px', borderRadius: '20px', width: '450px', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px' }}>
                            <h2 style={{ fontSize: '20px', fontWeight: '800' }}>Configurações Anti-Loop</h2>
                            <button onClick={() => setShowDelayModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#666' }}><X size={20} /></button>
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '24px' }}>
                            <div>
                                <label style={{ fontSize: '11px', fontWeight: 'bold', color: '#64748b', display: 'block', marginBottom: '8px', textTransform: 'uppercase' }}>Anti-Loop (Reentrada):</label>
                                <select
                                    value={automationDelay}
                                    onChange={(e) => setAutomationDelay(e.target.value)}
                                    style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '14px', background: '#f8fafc' }}
                                >
                                    <option value="1">1 minuto</option>
                                    <option value="60">1 hora</option>
                                    <option value="180">3 horas</option>
                                    <option value="360">6 horas</option>
                                    <option value="720">12 horas</option>
                                    <option value="1440">24 horas</option>
                                </select>
                            </div>
                            <div>
                                <label style={{ fontSize: '11px', fontWeight: 'bold', color: '#64748b', display: 'block', marginBottom: '8px', textTransform: 'uppercase' }}>Expiração da Sessão:</label>
                                <select
                                    value={sessionWaitTime}
                                    onChange={(e) => setSessionWaitTime(e.target.value)}
                                    style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '14px', background: '#f8fafc' }}
                                >
                                    <option value="1">1 minuto</option>
                                    <option value="60">1 hora</option>
                                    <option value="180">3 horas</option>
                                    <option value="360">6 horas</option>
                                    <option value="720">12 horas</option>
                                    <option value="1440">24 horas</option>
                                </select>
                            </div>
                            <div style={{ gridColumn: 'span 2' }}>
                                <label style={{ fontSize: '11px', fontWeight: 'bold', color: '#64748b', display: 'block', marginBottom: '8px', textTransform: 'uppercase' }}>Trava após Humano (Lockout):</label>
                                <select
                                    value={agentLockoutTime}
                                    onChange={(e) => setAgentLockoutTime(e.target.value)}
                                    style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '14px', background: '#f8fafc' }}
                                >
                                    <option value="60">1 hora</option>
                                    <option value="360">6 horas</option>
                                    <option value="720">12 horas</option>
                                    <option value="1440">24 horas</option>
                                    <option value="2160">36 horas (Padrão)</option>
                                    <option value="2880">48 horas</option>
                                </select>
                            </div>
                        </div>

                        <p style={{ fontSize: '12px', color: '#64748b', marginBottom: '24px', fontStyle: 'italic' }}>
                            * O tempo de expiração define quanto tempo o sistema espera uma resposta antes de liberar novas automações.
                        </p>

                        <button className="btn-primary" onClick={saveDelayConfig} style={{ width: '100%', height: '45px', borderRadius: '12px' }}>
                            Salvar Configurações
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}

// --- List View Component ---

export default function AutomationBuilder({ user, addToast, config, setConfig }) {
    const [automations, setAutomations] = useState([]);
    const [editingAutomation, setEditingAutomation] = useState(null);
    const [loading, setLoading] = useState(false);
    const [automationToDelete, setAutomationToDelete] = useState(null); // State for delete modal
    const [automationToToggle, setAutomationToToggle] = useState(null); // State for deactivate confirmation
    const [showKillModal, setShowKillModal] = useState(false); // State for kill sessions modal
    const [currentPage, setCurrentPage] = useState(1); // Pagination state

    const userId = user?.id;
    const token = user?.token;
    const fileInputRef = useRef(null);

    const fetchAutomations = useCallback(async () => {
        if (!userId) return;
        setLoading(true);
        try {
            const res = await fetch('/api/evolution/automations', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await res.json();
            const sortedAutomations = (data || []).sort((a, b) => b.id - a.id);
            setAutomations(sortedAutomations);
        } catch (err) {
            console.error('Error fetching automations:', err);
            addToast('Erro ao carregar automações', 'error');
        } finally {
            setLoading(false);
        }
    }, [userId, token, addToast]);

    useEffect(() => {
        fetchAutomations();
    }, [fetchAutomations]);

    const handleSaveAutomation = async (automationData) => {
        try {
            const res = await fetch('/api/evolution/automations', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ ...automationData, userId })
            });

            if (res.ok) {
                addToast('Automação salva!', 'success');
                fetchAutomations();
                setEditingAutomation(null);
            } else {
                const error = await res.json();
                addToast(error.message || 'Erro ao salvar automação', 'error');
            }
        } catch (err) {
            console.error('Error saving automation:', err);
            addToast('Erro de conexão ao salvar', 'error');
        }
    };

    const confirmDeleteAutomation = async () => {
        if (!automationToDelete) return;
        try {
            const res = await fetch(`/api/evolution/automations/${automationToDelete.id}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (res.ok) {
                addToast('Automação excluída!', 'success');
                fetchAutomations();
                setAutomationToDelete(null);
            } else {
                addToast('Erro ao excluir automação', 'error');
            }
        } catch (err) {
            addToast('Erro de conexão', 'error');
        }
    };

    const handleToggleAutomation = (id) => {
        const auto = automations.find(a => a.id === id);
        if (auto && auto.isActive) {
            setAutomationToToggle(auto);
        } else {
            executeToggle(id);
        }
    };

    const executeToggle = async (id) => {
        try {
            const res = await fetch(`/api/evolution/automations/${id}/toggle`, {
                method: 'PATCH',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (res.ok) {
                addToast('Status atualizado!', 'success');
                fetchAutomations();
                if (automationToToggle) setAutomationToToggle(null);
            } else {
                addToast('Erro ao atualizar status', 'error');
            }
        } catch (err) {
            addToast('Erro de conexão', 'error');
        }
    };



    const handleKillSessions = () => setShowKillModal(true);

    const triggerImport = () => {
        fileInputRef.current?.click();
    };

    const handleImport = (event) => {
        const file = event.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const content = JSON.parse(e.target.result);
                if (content.nodes && content.edges) {
                    setEditingAutomation({
                        ...content,
                        id: undefined,
                        name: (content.name || 'Nova Automação') + ' (Importado)',
                        triggerType: content.triggerType || 'keyword',
                        triggerKeywords: content.triggerKeywords || '',
                        isActive: false
                    });
                    addToast('Automação importada! Clique em salvar para persistir.', 'success');
                } else {
                    addToast('Arquivo de automação inválido.', 'error');
                }
            } catch (err) {
                console.error(err);
                addToast('Erro ao ler arquivo.', 'error');
            }
        };
        reader.readAsText(file);
        event.target.value = ''; // Reset input
    };

    if (editingAutomation) {
        return (
            <AutomationEditor
                automation={editingAutomation === 'new' ? null : editingAutomation}
                onSave={handleSaveAutomation}
                onBack={() => { setEditingAutomation(null); fetchAutomations(); }}
                userId={userId}
                addToast={addToast}
                token={token}
                config={config}
                setConfig={setConfig}
                user={user}
            />
        );
    }

    return (
        <div className="card fade-in" style={{
            minHeight: 'calc(100vh - 180px)',
            display: 'flex',
            flexDirection: 'column'
        }}>
            <div style={{ display: 'flex', marginTop: 24, justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                <h2 style={{ fontSize: '2rem', fontWeight: 800, paddingLeft: 24, color: 'var(--ambev-black)', margin: 0 }}>Automações API-EVO</h2>
                <div style={{ display: 'flex', gap: '12px' }}>
                    <input
                        type="file"
                        ref={fileInputRef}
                        style={{ display: 'none' }}
                        accept=".json"
                        onChange={handleImport}
                    />
                    <button
                        className="btn-secondary"
                        onClick={handleKillSessions}
                        style={{ height: '42px', display: 'flex', alignItems: 'center', gap: '8px', color: '#dc2626', borderColor: '#fee2e2', background: '#fef2f2' }}
                    >
                        <XCircle size={20} /> Finalizar Sessões
                    </button>
                    <button className="btn-secondary" onClick={triggerImport} style={{ display: 'flex', alignItems: 'center', gap: '8px', height: '42px' }}>
                        <Upload size={20} /> Importar
                    </button>
                    <button className="btn-primary" style={{ background: '#00a276', height: '42px', display: 'flex', alignItems: 'center', gap: '8px' }} onClick={() => setEditingAutomation('new')}>
                        <Plus size={20} /> Nova Automação
                    </button>
                </div>
            </div>

            {
                (() => {
                    const rowsPerPage = 16;
                    const totalPages = Math.ceil(automations.length / rowsPerPage);
                    const paginatedAutomations = automations.slice((currentPage - 1) * rowsPerPage, currentPage * rowsPerPage);

                    return (
                        <>
                            <div style={{
                                display: 'grid',
                                gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
                                gap: '24px',
                                marginTop: '24px'
                            }}>
                                {paginatedAutomations.map(auto => (
                                    <div key={auto.id} className="flow-card">
                                        <div style={{ display: 'flex', gap: '16px' }}>
                                            <div className="flow-card-icon" style={{ background: auto.isActive ? '#e8f5e9' : '#f1f5f9', color: auto.isActive ? '#00a276' : '#94a3b8' }}>
                                                <Zap size={24} />
                                            </div>
                                            <div style={{ flex: 1 }}>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                                    <h3 style={{ fontSize: '18px', fontWeight: '700', color: '#1a1a1a', marginBottom: '4px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '140px' }} title={auto.name}>
                                                        {auto.name}
                                                    </h3>
                                                    <label className="switch" title={auto.isActive ? 'Ativado' : 'Desativado'} style={{ cursor: 'pointer', flexShrink: 0 }}>
                                                        <input type="checkbox" checked={auto.isActive} onChange={() => handleToggleAutomation(auto.id)} />
                                                        <span className="slider"></span>
                                                    </label>
                                                </div>
                                                <p style={{ fontSize: '12px', color: '#666', margin: '2px 0 8px' }}>ID: #{auto.id}</p>
                                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginTop: '4px' }}>
                                                    <span style={{ fontSize: '10px', background: '#f1f5f9', padding: '2px 8px', borderRadius: '10px', color: '#475569', fontWeight: 'bold' }}>
                                                        {auto.triggerType === 'keyword' ? 'PALAVRA-CHAVE' : 'MENSAGEM'}
                                                    </span>
                                                    {auto.triggerKeywords && auto.triggerType === 'keyword' && (
                                                        <span style={{ fontSize: '10px', background: '#e0f2fe', padding: '2px 8px', borderRadius: '10px', color: '#0369a1', fontWeight: 'bold' }}>
                                                            {auto.triggerKeywords.length > 20 ? auto.triggerKeywords.substring(0, 20) + '...' : auto.triggerKeywords}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        </div>

                                        <div style={{ display: 'flex', gap: '10px', marginTop: '24px' }}>
                                            <button className="btn-edit-flow" onClick={() => setEditingAutomation(auto)} style={{ flex: 1, background: '#00a276' }}>
                                                <Edit3 size={16} /> Editar
                                            </button>
                                            <button className="btn-delete-flow" onClick={() => setAutomationToDelete(auto)}>
                                                <Trash2 size={18} />
                                            </button>
                                        </div>
                                    </div>
                                ))}

                                {automations.length === 0 && (
                                    <div style={{
                                        gridColumn: '1 / -1',
                                        minHeight: '300px',
                                        padding: '2rem',
                                        textAlign: 'center',
                                        background: '#f8fafc',
                                        border: '2px dashed #e2e8f0',
                                        borderRadius: '16px',
                                        display: 'flex',
                                        flexDirection: 'column',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        gap: '12px'
                                    }}>
                                        <Zap size={48} color="#94a3b8" strokeWidth={1} />
                                        <p style={{ fontSize: '16px', fontWeight: '500', color: '#64748b', margin: 0 }}>Nenhuma automação criada ainda.</p>
                                    </div>
                                )}
                            </div>
                            <Pagination
                                currentPage={currentPage}
                                totalPages={totalPages}
                                onPageChange={setCurrentPage}
                                className="mt-4"
                            />
                        </>
                    );
                })()
            }

            {/* Delete Confirmation Modal */}
            {
                automationToDelete && (
                    <div className="modal-overlay" style={{ zIndex: 10000 }}>
                        <div className="modal-content" style={{ maxWidth: '400px', textAlign: 'center', padding: '2rem' }}>
                            <div style={{ background: '#fee2e2', width: '60px', height: '60px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
                                <AlertCircle size={32} color="#dc2626" />
                            </div>
                            <h3 style={{ fontSize: '1.5rem', marginBottom: '10px', color: '#1f2937', textAlign: 'center', width: '100%', display: 'flex', justifyContent: 'center' }}>Excluir Automação?</h3>
                            <p style={{ color: '#6b7280', marginBottom: '24px' }}>
                                Tem certeza que deseja excluir a automação <strong>{automationToDelete.name}</strong>? Esta ação não pode ser desfeita.
                            </p>
                            <div style={{ display: 'flex', justifyContent: 'center', gap: '12px' }}>
                                <button className="btn-secondary" onClick={() => setAutomationToDelete(null)}>
                                    Cancelar
                                </button>
                                <button
                                    className="btn-primary"
                                    style={{ background: '#dc2626', borderColor: '#dc2626' }}
                                    onClick={confirmDeleteAutomation}
                                >
                                    Sim, Excluir
                                </button>
                            </div>
                        </div>
                    </div>
                )
            }

            {/* Deactivate Confirmation Modal */}
            {
                automationToToggle && (
                    <div className="modal-overlay" style={{ zIndex: 10000 }}>
                        <div className="modal-content" style={{ maxWidth: '400px', textAlign: 'center', padding: '2rem' }}>
                            <div style={{ background: '#fff7ed', width: '60px', height: '60px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
                                <AlertCircle size={32} color="#ea580c" />
                            </div>
                            <h3 style={{ fontSize: '1.5rem', marginBottom: '10px', color: '#1f2937', textAlign: 'center', width: '100%', display: 'flex', justifyContent: 'center' }}>Desativar Automação?</h3>
                            <p style={{ color: '#6b7280', marginBottom: '24px' }}>
                                Tem certeza que deseja desativar a automação <strong>{automationToToggle.name}</strong>? Ela parará de responder às mensagens.
                            </p>
                            <div style={{ display: 'flex', justifyContent: 'center', gap: '12px' }}>
                                <button className="btn-secondary" onClick={() => setAutomationToToggle(null)}>
                                    Manter Ativa
                                </button>
                                <button
                                    className="btn-primary"
                                    style={{ background: '#ea580c', borderColor: '#ea580c' }}
                                    onClick={() => executeToggle(automationToToggle.id)}
                                >
                                    Sim, Desativar
                                </button>
                            </div>
                        </div>
                    </div>
                )
            }

            {/* Kill Sessions Confirmation Modal */}
            {
                showKillModal && (
                    <SessionManagerModal
                        onClose={() => setShowKillModal(false)}
                        addToast={addToast}
                        token={user?.token}
                    />
                )
            }
        </div >
    );
}
