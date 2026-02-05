import React, { useState, useEffect, useRef, useCallback } from 'react';
import ReactFlow, { Background, Controls, ReactFlowProvider } from 'reactflow';
import 'reactflow/dist/style.css';
import {
    Plus, Trash2, Edit3, Save, ArrowLeft, Image as ImageIcon,
    MessageSquare, MessageCircle, ListOrdered, Mail, Upload, X, AlertCircle, Settings, Download
} from 'lucide-react';
import Pagination from '../../components/Pagination';

// Import Custom Nodes
import MessageNode from '../../components/nodes/MessageNode';
import OptionsNode from '../../components/nodes/OptionsNode';
import TemplateNode from '../../components/nodes/TemplateNode';
import ImageNode from '../../components/nodes/ImageNode';
import EmailNode from '../../components/nodes/EmailNode';
import '../../components/nodes/NodeStyles.css';

// Import Custom Hook
import { useFlowEditor } from '../../hooks/useFlowEditor';

const nodeTypes = {
    messageNode: MessageNode,
    optionsNode: OptionsNode,
    templateNode: TemplateNode,
    imageNode: ImageNode,
    emailNode: EmailNode
};

// --- Flow Editor Component ---

function FlowEditor({ flow, onSave, onBack, userId, addToast, token, config, setConfig, user }) {
    const [flowName, setFlowName] = useState(flow?.name || 'Novo Fluxo');
    const [showDelayModal, setShowDelayModal] = useState(false);
    const [automationDelay, setAutomationDelay] = useState(1440);
    const [sessionWaitTime, setSessionWaitTime] = useState(1440);
    const reactFlowWrapper = useRef(null);

    const {
        nodes, setNodes, edges, setEdges,
        onNodesChange, onEdgesChange, onConnect,
        reactFlowInstance, setReactFlowInstance,
        handleNodeDataChange, handleDeleteNode
    } = useFlowEditor({ defaultColor: '#6c757d' });

    useEffect(() => {
        if (config?.automationDelay !== undefined) setAutomationDelay(config.automationDelay);
        if (config?.sessionWaitTime !== undefined) setSessionWaitTime(config.sessionWaitTime);
    }, [config]);

    const saveDelayConfig = async () => {
        try {
            if (!userId) return;
            await fetch(`/api/user-config/${userId}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify({
                    ...config,
                    mapping: config?.mapping || {},
                    automationDelay: parseInt(automationDelay),
                    sessionWaitTime: parseInt(sessionWaitTime)
                })
            });
            setShowDelayModal(false);
            if (setConfig) setConfig({ ...config, automationDelay: parseInt(automationDelay), sessionWaitTime: parseInt(sessionWaitTime) });
            addToast('Configuração salva!', 'success');
        } catch (err) {
            console.error(err);
            addToast('Erro ao salvar configuração.', 'error');
        }
    };

    useEffect(() => {
        if (flow) {
            try {
                const loadedNodes = typeof flow.nodes === 'string' ? JSON.parse(flow.nodes || '[]') : (flow.nodes || []);
                const loadedEdges = typeof flow.edges === 'string' ? JSON.parse(flow.edges || '[]') : (flow.edges || []);
                // Inject token and common handlers into nodes
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
                setFlowName(flow.name);
            } catch (e) {
                console.error('Error loading flow:', e);
            }
        }
    }, [flow, handleNodeDataChange, handleDeleteNode, setNodes, setEdges, token, userId]);

    const addNode = (type) => {
        const id = `node_${Date.now()}`;
        const position = reactFlowInstance ? reactFlowInstance.project({ x: 250, y: 150 }) : { x: 250, y: 150 };
        const defaultData = { onChange: handleNodeDataChange, onDelete: handleDeleteNode, token, userId };

        if (type === 'messageNode') {
            defaultData.label = 'Nova mensagem';
            defaultData.waitForReply = false;
        } else if (type === 'optionsNode') {
            defaultData.label = 'Escolha uma opção:';
            defaultData.options = ['Opção 1', 'Opção 2'];
            defaultData.waitForReply = true;
        } else if (type === 'templateNode') {
            defaultData.templateName = '';
            defaultData.isTemplate = true;
        } else if (type === 'imageNode') {
            defaultData.imageUrl = '';
            defaultData.caption = '';
            defaultData.hasImage = true;
        } else if (type === 'emailNode') {
            defaultData.templateId = '';
            defaultData.templateName = '';
        }

        const newNode = { id, type, position, data: defaultData };
        setNodes((nds) => nds.concat(newNode));
    };

    const handleSave = () => {
        const flowData = {
            name: flowName,
            nodes,
            edges
        };
        onSave(flowData);
    };

    const handleDownloadJson = () => {
        const data = {
            name: flowName,
            nodes,
            edges
        };
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `${flowName.replace(/\s+/g, '_')}_flow.json`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        addToast('JSON do fluxo baixado!', 'success');
    };

    return (
        <div style={{ height: 'calc(100vh - 70px)', display: 'flex', flexDirection: 'column', background: '#fcfcfc' }}>
            <div style={{ padding: '8px 24px', background: 'white', borderBottom: '1px solid #eef0f2', display: 'flex', justifyContent: 'space-between', alignItems: 'center', boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                    <button onClick={onBack} title="Voltar" style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex' }}><ArrowLeft size={20} /></button>
                    <input
                        type="text"
                        value={flowName}
                        onChange={(e) => setFlowName(e.target.value)}
                        style={{ fontSize: '18px', fontWeight: 'bold', border: 'none', borderBottom: '2px solid transparent', padding: '4px', width: '600px', background: 'transparent', outline: 'none' }}
                        onFocus={(e) => e.target.style.borderBottom = '2px solid #280091'}
                        onBlur={(e) => e.target.style.borderBottom = '2px solid transparent'}
                    />
                </div>
                <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
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
                        title="Baixar JSON do Fluxo"
                    >
                        <Download size={18} />
                    </button>
                    <button className="btn-small btn-primary" onClick={handleSave} style={{ height: '38px' }}><Save size={16} /> Salvar Fluxo</button>
                </div>
            </div>

            <div style={{ flex: 1, position: 'relative' }} ref={reactFlowWrapper}>
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
                    position: 'absolute', left: 20, top: 20, zIndex: 5,
                    background: 'rgba(255,255,255,0.9)', padding: '10px', borderRadius: '12px',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.1)', display: 'flex', flexDirection: 'column', gap: '8px',
                    backdropFilter: 'blur(4px)', border: '1px solid rgba(255,255,255,0.5)'
                }}>
                    <p style={{ margin: '0 0 5px 0', fontSize: '11px', fontWeight: 'bold', color: '#666', textTransform: 'uppercase' }}>Adicionar Nó</p>
                    <button className="btn-small" onClick={() => addNode('messageNode')} style={{ background: '#f0f2ff', color: '#280091' }}><MessageSquare size={14} /> Texto</button>
                    <button className="btn-small" onClick={() => addNode('optionsNode')} style={{ background: '#fff9e6', color: '#f0a500' }}><ListOrdered size={14} /> Opções</button>
                    <button className="btn-small" onClick={() => addNode('templateNode')} style={{ background: '#e6fff9', color: '#00a276' }}><MessageCircle size={14} /> Template</button>
                    <button className="btn-small" onClick={() => addNode('imageNode')} style={{ background: '#fff0f5', color: '#e91e63' }}><ImageIcon size={14} /> Imagem</button>
                    <button className="btn-small" onClick={() => addNode('emailNode')} style={{ background: '#f5f3ff', color: '#7c3aed' }}><Mail size={14} /> E-mail</button>
                </div>

                {/* Anti-Loop Modal */}
                {showDelayModal && (
                    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(4px)' }}>
                        <div style={{ background: 'white', padding: '32px', borderRadius: '20px', width: '450px', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px' }}>
                                <h2 style={{ fontSize: '20px', fontWeight: '800' }}>Configurações Globais</h2>
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
                            </div>

                            <p style={{ fontSize: '12px', color: '#64748b', marginBottom: '24px', fontStyle: 'italic' }}>
                                * Estas configurações são globais e afetam todas as automações e fluxos.
                            </p>

                            <button className="btn-primary" onClick={saveDelayConfig} style={{ width: '100%', height: '45px', borderRadius: '12px' }}>
                                Salvar Configurações
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

// --- List View Component ---

export default function FlowBuilder({ user, addToast, config, setConfig }) {
    const [flows, setFlows] = useState([]);
    const [editingFlow, setEditingFlow] = useState(null);
    const [loading, setLoading] = useState(false);
    const [flowToDelete, setFlowToDelete] = useState(null); // State for delete modal
    const [currentPage, setCurrentPage] = useState(1); // Pagination state

    const userId = user?.id;
    const token = user?.token;
    const fileInputRef = useRef(null);

    const fetchFlows = useCallback(async () => {
        if (!userId) return;
        setLoading(true);
        try {
            const res = await fetch('/api/flows', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await res.json();
            setFlows(data || []);
        } catch (err) {
            console.error('Error fetching flows:', err);
            addToast('Erro ao carregar fluxos', 'error');
        } finally {
            setLoading(false);
        }
    }, [userId, token, addToast]);

    useEffect(() => {
        fetchFlows();
    }, [fetchFlows]);

    const handleSaveFlow = async (flowData) => {
        try {
            const res = await fetch('/api/flows', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ ...flowData, userId })
            });

            if (res.ok) {
                addToast('Fluxo salvo com sucesso!', 'success');
                fetchFlows();
                setEditingFlow(null);
            } else {
                const error = await res.json();
                addToast(error.message || 'Erro ao salvar fluxo', 'error');
            }
        } catch (err) {
            console.error('Error saving flow:', err);
            addToast('Erro de conexão ao salvar', 'error');
        }
    };

    const confirmDeleteFlow = async () => {
        if (!flowToDelete) return;
        try {
            const res = await fetch(`/api/flows/${flowToDelete.id}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (res.ok) {
                addToast('Fluxo excluído!', 'success');
                fetchFlows();
                setFlowToDelete(null);
            } else {
                addToast('Erro ao excluir fluxo', 'error');
            }
        } catch (err) {
            addToast('Erro de conexão', 'error');
        }
    };

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
                if (content.name && content.nodes && content.edges) {
                    setEditingFlow({ ...content, id: undefined, name: content.name + ' (Importado)' });
                    addToast('Fluxo importado! Clique em salvar para persistir.', 'success');
                } else {
                    addToast('Arquivo de fluxo inválido.', 'error');
                }
            } catch (err) {
                console.error(err);
                addToast('Erro ao ler arquivo.', 'error');
            }
        };
        reader.readAsText(file);
        event.target.value = ''; // Reset input
    };

    if (editingFlow) {
        return (
            <FlowEditor
                flow={editingFlow === 'new' ? null : editingFlow}
                onSave={handleSaveFlow}
                onBack={() => { setEditingFlow(null); fetchFlows(); }}
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
            <div style={{ display: 'flex', marginTop: 24, justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
                <h2 style={{ fontSize: '2rem', paddingLeft: 24, fontWeight: 800, color: 'var(--ambev-black)', margin: 0 }}>Fluxos de Disparo de Mensagens</h2>
                <div style={{ display: 'flex', gap: '12px' }}>
                    <input
                        type="file"
                        ref={fileInputRef}
                        style={{ display: 'none' }}
                        accept=".json"
                        onChange={handleImport}
                    />
                    <button className="btn-secondary" onClick={triggerImport} style={{ display: 'flex', alignItems: 'center', gap: '8px', height: '42px' }}>
                        <Upload size={20} /> Importar
                    </button>
                    <button className="btn-primary" onClick={() => setEditingFlow('new')} style={{ height: '42px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <Plus size={20} /> Novo Fluxo
                    </button>
                </div>
            </div>

            {
                (() => {
                    const rowsPerPage = 16;
                    const totalPages = Math.ceil(flows.length / rowsPerPage);
                    const paginatedFlows = flows.slice((currentPage - 1) * rowsPerPage, currentPage * rowsPerPage);

                    return (
                        <>
                            <div style={{
                                display: 'grid',
                                gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
                                gap: '24px',
                                marginTop: '24px'
                            }}>
                                {paginatedFlows.map(flow => (
                                    <div key={flow.id} className="flow-card" style={{ height: 'fit-content' }}>
                                        <div style={{ display: 'flex', gap: '16px', marginBottom: '20px' }}>
                                            <div className="flow-card-icon">
                                                <MessageSquare size={24} />
                                            </div>
                                            <div style={{ flex: 1 }}>
                                                <h3 style={{ fontSize: '18px', fontWeight: '700', color: '#1a1a1a', marginBottom: '4px' }}>{flow.name}</h3>
                                                <p style={{ fontSize: '13px', color: '#666' }}>ID: #{flow.id}</p>
                                            </div>
                                        </div>

                                        <div style={{ display: 'flex', gap: '10px' }}>
                                            <button className="btn-edit-flow" onClick={() => setEditingFlow(flow)} style={{ flex: 1 }}>
                                                <Edit3 size={16} /> Editar
                                            </button>
                                            <button className="btn-delete-flow" onClick={() => setFlowToDelete(flow)}>
                                                <Trash2 size={18} />
                                            </button>
                                        </div>
                                    </div>
                                ))}

                                {flows.length === 0 && (
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
                                        <MessageSquare size={48} color="#94a3b8" strokeWidth={1} />
                                        <p style={{ fontSize: '16px', fontWeight: '500', color: '#64748b', margin: 0 }}>Nenhum fluxo criado ainda.</p>
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
                flowToDelete && (
                    <div className="modal-overlay" style={{ zIndex: 10000 }}>
                        <div className="modal-content" style={{ maxWidth: '400px', textAlign: 'center', padding: '2rem' }}>
                            <div style={{ background: '#fee2e2', width: '60px', height: '60px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
                                <AlertCircle size={32} color="#dc2626" />
                            </div>
                            <h3 style={{ fontSize: '1.5rem', marginBottom: '10px', color: '#1f2937', textAlign: 'center', width: '100%', display: 'flex', justifyContent: 'center' }}>Excluir Fluxo?</h3>
                            <p style={{ color: '#6b7280', marginBottom: '24px' }}>
                                Tem certeza que deseja excluir o fluxo <strong>{flowToDelete.name}</strong>? Esta ação não pode ser desfeita.
                            </p>
                            <div style={{ display: 'flex', justifyContent: 'center', gap: '12px' }}>
                                <button className="btn-secondary" onClick={() => setFlowToDelete(null)}>
                                    Cancelar
                                </button>
                                <button
                                    className="btn-primary"
                                    style={{ background: '#dc2626', borderColor: '#dc2626' }}
                                    onClick={confirmDeleteFlow}
                                >
                                    Sim, Excluir
                                </button>
                            </div>
                        </div>
                    </div>
                )
            }
        </div >
    );
}
