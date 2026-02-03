import React, { useState, useEffect, useRef, useCallback } from 'react';
import ReactFlow, { Background, Controls, ReactFlowProvider } from 'reactflow';
import 'reactflow/dist/style.css';
import {
    Plus, Trash2, Edit3, Save, ArrowLeft, Image as ImageIcon,
    MessageSquare, MessageCircle, ListOrdered, Mail
} from 'lucide-react';

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

function FlowEditor({ flow, onSave, onBack, userId, addToast, token }) {
    const [flowName, setFlowName] = useState(flow?.name || 'Novo Fluxo');
    const reactFlowWrapper = useRef(null);

    const {
        nodes, setNodes, edges, setEdges,
        onNodesChange, onEdgesChange, onConnect,
        reactFlowInstance, setReactFlowInstance,
        handleNodeDataChange, handleDeleteNode
    } = useFlowEditor({ defaultColor: '#6c757d' });

    useEffect(() => {
        if (flow) {
            try {
                const loadedNodes = JSON.parse(flow.nodes || '[]');
                const loadedEdges = JSON.parse(flow.edges || '[]');
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
            nodes: JSON.stringify(nodes),
            edges: JSON.stringify(edges)
        };
        onSave(flowData);
    };

    return (
        <div style={{ height: 'calc(100vh - 100px)', display: 'flex', flexDirection: 'column' }}>
            <div style={{ padding: '10px 20px', background: 'white', borderBottom: '1px solid #eee', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                    <button onClick={onBack} title="Voltar" style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex' }}><ArrowLeft size={20} /></button>
                    <input
                        type="text"
                        value={flowName}
                        onChange={(e) => setFlowName(e.target.value)}
                        style={{ fontSize: '18px', fontWeight: 'bold', border: 'none', borderBottom: '2px solid transparent', padding: '4px', width: '250px' }}
                        onFocus={(e) => e.target.style.borderBottom = '2px solid #280091'}
                        onBlur={(e) => e.target.style.borderBottom = '2px solid transparent'}
                    />
                </div>
                <div style={{ display: 'flex', gap: '10px' }}>
                    <button className="btn-small btn-primary" onClick={handleSave}><Save size={16} /> Salvar Fluxo</button>
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
                    <Background color="#aaa" gap={20} />
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
            </div>
        </div>
    );
}

// --- List View Component ---

export default function FlowBuilder({ user, addToast }) {
    const [flows, setFlows] = useState([]);
    const [editingFlow, setEditingFlow] = useState(null);
    const [loading, setLoading] = useState(false);

    const userId = user?.id;
    const token = user?.token;

    const fetchFlows = useCallback(async () => {
        if (!userId) return;
        setLoading(true);
        try {
            const res = await fetch(`/api/flows/${userId}`, {
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

    const handleSaveFlow = async (id, flowData) => {
        try {
            const url = id ? `/api/flows/${id}` : '/api/flows';
            const method = id ? 'PUT' : 'POST';

            const res = await fetch(url, {
                method,
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ ...flowData, userId })
            });

            if (res.ok) {
                addToast(id ? 'Fluxo atualizado!' : 'Fluxo criado!', 'success');
                fetchFlows();
                setEditingFlow(null);
            } else {
                const error = await res.json();
                addToast(error.message || 'Erro ao salvar fluxo', 'error');
            }
        } catch (err) {
            console.error('Error saving flow:', err);
            addToast('Erro de conexão ao salvar fluxo', 'error');
        }
    };

    const handleDeleteFlow = async (id) => {
        if (!window.confirm('Excluir este fluxo?')) return;
        try {
            const res = await fetch(`/api/flows/${id}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (res.ok) {
                addToast('Fluxo excluído!', 'success');
                fetchFlows();
            } else {
                addToast('Erro ao excluir fluxo', 'error');
            }
        } catch (err) {
            addToast('Erro de conexão', 'error');
        }
    };

    if (editingFlow) {
        return (
            <ReactFlowProvider>
                <FlowEditor
                    flow={editingFlow === 'new' ? null : editingFlow}
                    onSave={(data) => handleSaveFlow(editingFlow === 'new' ? null : editingFlow.id, data)}
                    onBack={() => setEditingFlow(null)}
                    userId={userId}
                    addToast={addToast}
                    token={token}
                />
            </ReactFlowProvider>
        );
    }

    return (
        <div className="flow-builder-list">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
                <div>
                    <h1 style={{ fontSize: '28px', fontWeight: '800', color: '#1a1a1a', marginBottom: '8px' }}>Fluxos de Conversa</h1>
                    <p className="subtitle">Crie árvores de decisão e automações complexas</p>
                </div>
                <button className="btn-primary" onClick={() => setEditingFlow('new')}>
                    <Plus size={20} /> Novo Fluxo
                </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '24px' }}>
                {flows.map(flow => (
                    <div key={flow.id} className="flow-card">
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
                            <button className="btn-delete-flow" onClick={() => handleDeleteFlow(flow.id)}>
                                <Trash2 size={18} />
                            </button>
                        </div>
                    </div>
                ))}

                {flows.length === 0 && (
                    <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '80px', background: '#f9fafb', borderRadius: '16px', border: '2px dashed #e5e7eb' }}>
                        <div style={{ background: '#fff', width: '64px', height: '64px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px', boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}>
                            <MessageSquare size={32} color="#9ca3af" />
                        </div>
                        <h3 style={{ fontSize: '18px', fontWeight: '600', color: '#374151', marginBottom: '8px' }}>Nenhum fluxo criado</h3>
                        <p style={{ color: '#6b7280', marginBottom: '24px' }}>Comece criando seu primeiro fluxo de atendimento automatizado.</p>
                        <button className="btn-primary" style={{ margin: '0 auto' }} onClick={() => setEditingFlow('new')}>
                            <Plus size={20} /> Criar Primeiro Fluxo
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}
