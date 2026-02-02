import React, { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import ReactFlow, {
    addEdge,
    Background,
    Controls,
    Handle,
    Position,
    applyNodeChanges,
    applyEdgeChanges,
    ReactFlowProvider,
    MarkerType
} from 'reactflow';
import 'reactflow/dist/style.css';
import {
    X, Plus, Trash2, Edit3, Play, Save, ArrowLeft, Image as ImageIcon,
    MessageSquare, ListOrdered, Upload, Download, RefreshCw, Zap, Search, Clock, Bell, Info, AlertCircle, XCircle, Mail
} from 'lucide-react';

const NODE_STYLES = `
    .flow-node {
        background: white;
        border: 2px solid #ddd;
        border-radius: 10px;
        width: 320px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.1);
        transition: all 0.2s;
    }
    .flow-node.selected { border-color: #00a276; box-shadow: 0 4px 20px rgba(0, 162, 118, 0.2); }
    .node-header {
        display: flex; align-items: center; gap: 8px; padding: 10px 12px;
        background: linear-gradient(135deg, #00a276, #00c896); color: white;
        border-radius: 8px 8px 0 0; font-size: 13px; font-weight: 600;
    }
    .node-header-btns { margin-left: auto; display: flex; align-items: center; gap: 6px; }
    .node-edit-btn, .node-delete-btn {
        background: rgba(255,255,255,0.2); border: none; border-radius: 4px; cursor: pointer; color: white;
        display: flex; align-items: center; justify-content: center; padding: 4px;
        transition: background 0.2s;
    }
    .node-delete-btn:hover { background: #ff5555; }
    .node-edit-btn:hover { background: rgba(255,255,255,0.4); }

    .options-header { background: linear-gradient(135deg, #fecb00, #f0a500) !important; color: #333 !important; }
    .options-header .node-edit-btn, .options-header .node-delete-btn { background: rgba(0,0,0,0.1); color: #333; }
    
    .image-header { background: linear-gradient(135deg, #e91e63, #f48fb1) !important; }
    .alert-header { background: linear-gradient(135deg, #ff9800, #ffb74d) !important; }
    .hours-header { background: linear-gradient(135deg, #1e88e5, #4dabf5) !important; }
    .close-header { background: linear-gradient(135deg, #f44336, #ef5350) !important; }
    .email-header-node { background: linear-gradient(135deg, #7c4dff, #b388ff) !important; }
    
    .node-content { padding: 12px; }
    .node-text { margin: 0; font-size: 13px; color: #333; white-space: pre-wrap; line-height: 1.4; }
    
    .edit-mode label { font-size: 11px; font-weight: 600; color: #666; display: block; margin-bottom: 4px; }
    .edit-mode textarea, .edit-mode input[type="text"], .edit-mode input[type="time"] {
        width: 100%; border: 1px solid #ddd; border-radius: 6px; padding: 8px; font-size: 13px; margin-bottom: 8px; resize: vertical;
    }
    .edit-actions { display: flex; justify-content: space-between; align-items: center; margin-top: 8px; }
    
    .btn-small { padding: 6px 12px; font-size: 12px; border: none; border-radius: 6px; cursor: pointer; }
    .btn-small.btn-primary { background: #280091; color: white; }
    
    .handles-row { display: flex; justify-content: center; padding-bottom: 8px; position: relative; min-height: 20px; }
    
    .flow-card {
        border: 1px solid #e0e0e0;
        border-radius: 12px;
        padding: 24px;
        background: white;
        box-shadow: 0 2px 4px rgba(0,0,0,0.02);
        transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        display: flex;
        flex-direction: column;
        justify-content: space-between;
    }
    .flow-card:hover {
        transform: translateY(-6px);
        box-shadow: 0 12px 30px rgba(0,0,0,0.08);
        border-color: #00a276;
    }
    .flow-card-icon {
        background: #e8f5e9;
        padding: 14px;
        border-radius: 12px;
        color: #00a276;
        display: flex;
        align-items: center;
        justify-content: center;
    }
    
    .btn-edit-flow {
        background: #00a276 !important;
        color: white !important;
        border: none !important;
        border-radius: 8px !important;
        padding: 12px 16px !important;
        font-weight: 700 !important;
        display: flex !important;
        align-items: center !important;
        justify-content: center !important;
        gap: 8px !important;
        transition: all 0.2s !important;
        cursor: pointer !important;
        text-transform: uppercase !important;
        font-size: 12px !important;
    }
    .btn-delete-flow {
        background: #fffafa !important;
        color: #ff5555 !important;
        border: 1px solid #ffebeb !important;
        border-radius: 8px !important;
        padding: 8px !important;
        cursor: pointer !important;
    }
    .btn-delete-flow:hover { background: #ff5555 !important; color: white !important; }

    .upload-section { margin-bottom: 8px; }
    .previews-grid { margin-top: 8px; }
    .preview-item { position: relative; }
    .preview-item img { width: 100%; height: 60px; object-fit: cover; border-radius: 4px; border: 1px solid #eee; }

    /* Modern Toggle Switch */
    .switch {
        position: relative; display: inline-block; width: 44px; height: 24px;
    }
    .switch input { 
        position: absolute; opacity: 0; width: 100%; height: 100%; 
        top: 0; left: 0; z-index: 2; cursor: pointer; margin: 0;
    }
    .slider {
        position: absolute; cursor: pointer; top: 0; left: 0; right: 0; bottom: 0;
        background-color: #e4e6eb; transition: .4s; border-radius: 24px; z-index: 1;
    }
    .slider:before {
        position: absolute; content: ""; height: 18px; width: 18px; left: 3px; bottom: 3px;
        background-color: white; transition: .4s; border-radius: 50%;
    }
    input:checked + .slider { background-color: #00a276; }
    input:checked + .slider:before { transform: translateX(20px); }
`;

function MessageNode({ data, id, selected }) {
    const [isEditing, setIsEditing] = useState(false);
    const [tempLabel, setTempLabel] = useState(data.label || '');
    const handleSave = () => { data.onChange(id, { label: tempLabel }); setIsEditing(false); };
    return (
        <div className={`flow-node message-node ${selected ? 'selected' : ''}`}>
            <Handle type="target" position={Position.Top} id="target" style={{ background: '#555', width: 14, height: 14, border: '2px solid #333' }} />
            <div className="node-header">
                <MessageSquare size={16} /> <span>Mensagem</span>
                <div className="node-header-btns">
                    <button className="node-edit-btn" onClick={() => setIsEditing(!isEditing)}><Edit3 size={12} /></button>
                    <button className="node-delete-btn" onClick={() => data.onDelete(id)}><Trash2 size={12} /></button>
                </div>
            </div>
            <div className="node-content">
                {isEditing ? (
                    <div className="edit-mode">
                        <textarea value={tempLabel} onChange={(e) => setTempLabel(e.target.value)} rows={4} />
                        <div className="edit-actions">
                            <label><input type="checkbox" checked={data.waitForReply} onChange={(e) => data.onChange(id, { waitForReply: e.target.checked })} /> Aguardar resposta</label>
                            <button className="btn-small btn-primary" onClick={handleSave}>Salvar</button>
                        </div>
                    </div>
                ) : <p className="node-text">{data.label || 'Clique para editar...'}</p>}
            </div>
            <div className="handles-row">
                {data.waitForReply ? (
                    <>
                        <Handle type="source" position={Position.Bottom} id="source-green" style={{ background: '#00a276', left: '30%', width: 14, height: 14, border: '2px solid #333' }} />
                        <Handle type="source" position={Position.Bottom} id="source-red" style={{ background: '#dc3545', left: '70%', width: 14, height: 14, border: '2px solid #333' }} />
                    </>
                ) : <Handle type="source" position={Position.Bottom} id="source-gray" style={{ background: '#6c757d', width: 14, height: 14, border: '2px solid #333' }} />}
            </div>
        </div>
    );
}

function OptionsNode({ data, id, selected }) {
    const [isEditing, setIsEditing] = useState(false);
    const [tempLabel, setTempLabel] = useState(data.label || '');
    const [options, setOptions] = useState(data.options || ['Sim', 'Não']);
    const handleSave = () => { data.onChange(id, { label: tempLabel, options, validateSelection: data.validateSelection, waitForReply: true }); setIsEditing(false); };
    return (
        <div className={`flow-node options-node ${selected ? 'selected' : ''}`}>
            <Handle type="target" position={Position.Top} id="target" style={{ background: '#555', width: 14, height: 14, border: '2px solid #333' }} />
            <div className="node-header options-header">
                <ListOrdered size={16} /> <span>Menu de Opções</span>
                <div className="node-header-btns">
                    <button className="node-edit-btn" onClick={() => setIsEditing(!isEditing)}><Edit3 size={12} /></button>
                    <button className="node-delete-btn" onClick={() => data.onDelete(id)}><Trash2 size={12} /></button>
                </div>
            </div>
            <div className="node-content">
                {isEditing ? (
                    <div className="edit-mode">
                        <textarea value={tempLabel} onChange={(e) => setTempLabel(e.target.value)} rows={2} />
                        {options.map((opt, i) => (
                            <div key={i} style={{ display: 'flex', gap: '4px', marginBottom: '4px' }}>
                                <input type="text" value={opt} onChange={(e) => { const n = [...options]; n[i] = e.target.value; setOptions(n); }} />
                                <button onClick={() => setOptions(options.filter((_, idx) => idx !== i))} className="btn-small"><X size={12} /></button>
                            </div>
                        ))}
                        <button onClick={() => setOptions([...options, 'Opção'])} className="btn-small" style={{ marginBottom: '8px', display: 'block' }}>+ Adicionar Opção</button>

                        <div style={{ marginBottom: '12px', padding: '8px', background: '#f8f9fa', borderRadius: '6px' }}>
                            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', margin: 0 }}>
                                <input
                                    type="checkbox"
                                    checked={data.validateSelection}
                                    onChange={(e) => data.onChange(id, { validateSelection: e.target.checked })}
                                />
                                <span style={{ fontSize: '12px' }}>Validar resposta (exigir número)</span>
                            </label>
                        </div>

                        <button className="btn-small btn-primary" onClick={handleSave} style={{ width: '100%' }}>Salvar Configuração</button>
                    </div>
                ) : (
                    <>
                        <p className="node-text">{data.label || 'Escolha:'}</p>
                        {(data.options || options).map((opt, i) => (
                            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid #eee', fontSize: 12 }}>
                                <span>{i + 1}. {opt}</span>
                                <Handle type="source" position={Position.Right} id={`source-${i + 1}`} style={{ background: '#fecb00', width: 14, height: 14, border: '2px solid #333', position: 'relative', right: -8, top: 'auto' }} />
                            </div>
                        ))}
                    </>
                )}
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '4px 12px', background: '#fff0f0', borderRadius: '0 0 8px 8px' }}>
                <span style={{ fontSize: 10, color: '#ff5555', marginRight: '4px' }}>Inválido →</span>
                <Handle type="source" position={Position.Right} id="source-invalid" style={{ background: '#dc3545', width: 14, height: 14, border: '2px solid #333', position: 'static', transform: 'none' }} />
            </div>
        </div>
    );
}

function ImageNode({ data, id, selected }) {
    const [isEditing, setIsEditing] = useState(false);
    const [imageUrls, setImageUrls] = useState(data.imageUrls || (data.imageUrl ? [data.imageUrl] : []));
    const [caption, setCaption] = useState(data.caption || '');
    const handleSave = () => { data.onChange(id, { imageUrls, caption, hasImage: true }); setIsEditing(false); };
    return (
        <div className={`flow-node image-node ${selected ? 'selected' : ''}`}>
            <Handle type="target" position={Position.Top} id="target" style={{ background: '#555', width: 14, height: 14, border: '2px solid #333' }} />
            <div className="node-header image-header">
                <ImageIcon size={16} /> <span>Imagens</span>
                <div className="node-header-btns">
                    <button className="node-edit-btn" onClick={() => setIsEditing(!isEditing)}><Edit3 size={12} /></button>
                    <button className="node-delete-btn" onClick={() => data.onDelete(id)}><Trash2 size={12} /></button>
                </div>
            </div>
            <div className="node-content">
                {isEditing ? (
                    <div className="edit-mode">
                        <textarea value={imageUrls.join('\n')} onChange={(e) => setImageUrls(e.target.value.split('\n'))} rows={3} placeholder="URLs (uma por linha)" />
                        <textarea value={caption} onChange={(e) => setCaption(e.target.value)} rows={2} placeholder="Legenda" />
                        <button className="btn-small btn-primary" onClick={handleSave}>Salvar</button>
                    </div>
                ) : (
                    <div>
                        <div className="previews-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 4 }}>
                            {imageUrls.map((url, i) => <img key={i} src={url} alt="p" style={{ width: '100%', height: 60, objectFit: 'cover', borderRadius: 4 }} />)}
                        </div>
                        {caption && <p className="node-text" style={{ marginTop: 8 }}>{caption}</p>}
                    </div>
                )}
            </div>
            <Handle type="source" position={Position.Bottom} id="source-gray" style={{ background: '#6c757d', width: 14, height: 14, border: '2px solid #333' }} />
        </div>
    );
}

function AlertNode({ data, id, selected }) {
    const [isEditing, setIsEditing] = useState(false);
    const [phone, setPhone] = useState(data.phone || '');
    const [text, setText] = useState(data.text || '');
    const handleSave = () => { data.onChange(id, { phone, text }); setIsEditing(false); };
    return (
        <div className={`flow-node alert-node ${selected ? 'selected' : ''}`}>
            <Handle type="target" position={Position.Top} id="target" style={{ background: '#555', width: 14, height: 14, border: '2px solid #333' }} />
            <div className="node-header alert-header">
                <Bell size={16} /> <span>Alerta Admin</span>
                <div className="node-header-btns">
                    <button className="node-edit-btn" onClick={() => setIsEditing(!isEditing)}><Edit3 size={12} /></button>
                    <button className="node-delete-btn" onClick={() => data.onDelete(id)}><Trash2 size={12} /></button>
                </div>
            </div>
            <div className="node-content">
                {isEditing ? (
                    <div className="edit-mode">
                        <input type="text" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Telefone" />
                        <textarea value={text} onChange={(e) => setText(e.target.value)} rows={3} placeholder="Texto" />
                        <button className="btn-small btn-primary" onClick={handleSave}>Salvar</button>
                    </div>
                ) : <p className="node-text"><strong>Para:</strong> {data.phone}<br />{data.text}</p>}
            </div>
            <Handle type="source" position={Position.Bottom} id="source-gray" style={{ background: '#6c757d', width: 14, height: 14, border: '2px solid #333' }} />
        </div>
    );
}

function BusinessHoursNode({ data, id, selected }) {
    const [isEditing, setIsEditing] = useState(false);
    const [start, setStart] = useState(data.start || '08:00');
    const [end, setEnd] = useState(data.end || '18:00');
    const [fallback, setFallback] = useState(data.fallback || '');
    const handleSave = () => { data.onChange(id, { start, end, fallback }); setIsEditing(false); };
    return (
        <div className={`flow-node hours-node ${selected ? 'selected' : ''}`}>
            <Handle type="target" position={Position.Top} id="target" style={{ background: '#555', width: 14, height: 14, border: '2px solid #333' }} />
            <div className="node-header hours-header">
                <Clock size={16} /> <span>Horário Comercial</span>
                <div className="node-header-btns">
                    <button className="node-edit-btn" onClick={() => setIsEditing(!isEditing)}><Edit3 size={12} /></button>
                    <button className="node-delete-btn" onClick={() => data.onDelete(id)}><Trash2 size={12} /></button>
                </div>
            </div>
            <div className="node-content">
                {isEditing ? (
                    <div className="edit-mode">
                        <input type="time" value={start} onChange={(e) => setStart(e.target.value)} />
                        <input type="time" value={end} onChange={(e) => setEnd(e.target.value)} />
                        <textarea value={fallback} onChange={(e) => setFallback(e.target.value)} rows={2} placeholder="Fora do horário" />
                        <button className="btn-small btn-primary" onClick={handleSave}>Salvar</button>
                    </div>
                ) : <p className="node-text">⏰ {data.start} às {data.end}</p>}
            </div>
            <Handle type="source" position={Position.Bottom} id="source-gray" style={{ background: '#6c757d', width: 14, height: 14, border: '2px solid #333' }} />
        </div>
    );
}

function CloseAutomationNode({ data, id, selected }) {
    return (
        <div className={`flow-node close-node ${selected ? 'selected' : ''}`}>
            <Handle type="target" position={Position.Top} id="target" style={{ background: '#555', width: 14, height: 14, border: '2px solid #333' }} />
            <div className="node-header close-header">
                <XCircle size={16} /> <span>Fechar Automação</span>
                <div className="node-header-btns">
                    <button className="node-delete-btn" onClick={() => data.onDelete(id)} title="Excluir"><Trash2 size={12} /></button>
                </div>
            </div>
            <div className="node-content">
                <p className="node-text">Esta ação encerra a sessão ativa do contato no fluxo.</p>
            </div>
        </div>
    );
}

function EmailNode({ data, id, selected }) {
    const [isEditing, setIsEditing] = useState(false);
    const [recipientEmail, setRecipientEmail] = useState(data.recipientEmail || '');
    const [templateId, setTemplateId] = useState(data.templateId || '');
    const [templates, setTemplates] = useState([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (isEditing) fetchTemplates();
    }, [isEditing]);

    const fetchTemplates = async () => {
        setLoading(true);
        try {
            const res = await fetch(`/api/email-templates/${data.userId}`, {
                headers: { 'Authorization': `Bearer ${data.token}` }
            });
            if (res.ok) setTemplates(await res.json());
        } catch (e) { console.error("Error templates:", e); }
        finally { setLoading(false); }
    };

    const handleSave = () => {
        const t = templates.find(x => String(x.id) === String(templateId));
        data.onChange(id, { recipientEmail, templateId, templateName: t ? t.name : data.templateName });
        setIsEditing(false);
    };

    return (
        <div className={`flow-node email-node ${selected ? 'selected' : ''}`}>
            <Handle type="target" position={Position.Top} id="target" style={{ background: '#555', width: 14, height: 14, border: '2px solid #333' }} />
            <div className="node-header email-header-node">
                <Mail size={16} /> <span>Enviar E-mail</span>
                <div className="node-header-btns">
                    <button className="node-edit-btn" onClick={() => setIsEditing(!isEditing)}><Edit3 size={12} /></button>
                    <button className="node-delete-btn" onClick={() => data.onDelete(id)}><Trash2 size={12} /></button>
                </div>
            </div>
            <div className="node-content">
                {isEditing ? (
                    <div className="edit-mode">
                        <label>Destinatário:</label>
                        <input type="text" value={recipientEmail} onChange={e => setRecipientEmail(e.target.value)} placeholder="email@exemplo.com" />

                        <label>Template:</label>
                        <select value={templateId} onChange={e => setTemplateId(e.target.value)} style={{ width: '100%', marginBottom: '10px' }}>
                            <option value="">Selecione...</option>
                            {templates.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                        </select>

                        <button className="btn-small btn-primary" onClick={handleSave}>Salvar</button>
                    </div>
                ) : (
                    <div>
                        <p className="node-text">📧 <b>Para:</b> {data.recipientEmail || '(Váriavel do fluxo)'}</p>
                        <p className="node-text" style={{ fontSize: '11px', color: '#666', marginTop: '4px' }}>Template: {data.templateName || 'Não definido'}</p>
                    </div>
                )}
            </div>
            <Handle type="source" position={Position.Bottom} id="source-gray" style={{ background: '#6c757d', width: 14, height: 14, border: '2px solid #333' }} />
        </div>
    );
}

const nodeTypes = {
    messageNode: MessageNode,
    optionsNode: OptionsNode,
    imageNode: ImageNode,
    alertNode: AlertNode,
    businessHoursNode: BusinessHoursNode,
    closeAutomationNode: CloseAutomationNode,
    emailNode: EmailNode
};

function AutomationEditor({ automation, onSave, onBack, userId, addToast, token }) {
    const [nodes, setNodes] = useState([]);
    const [edges, setEdges] = useState([]);
    const [name, setName] = useState(automation?.name || 'Nova Automação');
    const [triggerType, setTriggerType] = useState(automation?.triggerType || 'keyword');
    const [triggerKeywords, setTriggerKeywords] = useState(automation?.triggerKeywords || '');
    const [loading, setLoading] = useState(false);
    const [reactFlowInstance, setReactFlowInstance] = useState(null);

    useEffect(() => {
        if (automation && automation !== 'new') {
            setNodes(JSON.parse(automation.nodes || '[]'));
            setEdges(JSON.parse(automation.edges || '[]'));
        }
    }, [automation]);

    const handleNodeDataChange = (id, data) => setNodes(nds => nds.map(n => n.id === id ? { ...n, data: { ...n.data, ...data } } : n));
    const handleDeleteNode = (id) => setNodes(nds => nds.filter(n => n.id !== id));

    const addNode = (type) => {
        const id = `node_${Date.now()}`;
        setNodes(nds => [...nds, { id, type, position: { x: 250, y: 150 }, data: { label: 'Mensagem...', onChange: handleNodeDataChange, onDelete: handleDeleteNode, token, userId } }]);
    };

    const handleSave = async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/evolution/automations', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify({ id: automation?.id, name, triggerType, triggerKeywords, nodes: nodes.map(n => ({ ...n, data: { ...n.data, onChange: undefined, onDelete: undefined, token: undefined } })), edges })
            });
            if (res.ok) { addToast('Salvo!', 'success'); onSave(); }
        } catch (e) { addToast('Erro!', 'error'); } finally { setLoading(false); }
    };

    const nodesWithHandlers = useMemo(() => nodes.map(n => ({ ...n, data: { ...n.data, onChange: handleNodeDataChange, onDelete: handleDeleteNode, userId, token } })), [nodes, userId, token]);

    return (
        <div className="flow-editor-container" style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
            <div className="editor-header" style={{ padding: '15px 25px', background: 'white', borderBottom: '1px solid #ddd', display: 'flex', alignItems: 'center', gap: '20px', boxShadow: '0 2px 10px rgba(0,0,0,0.05)', zIndex: 10 }}>
                <button className="btn-secondary" onClick={onBack} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><ArrowLeft size={18} /> Voltar</button>
                <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <Edit3 size={18} color="#280091" />
                    <input type="text" value={name} onChange={e => setName(e.target.value)} style={{ flex: 1, padding: '10px 15px', border: '1px solid #ddd', borderRadius: '8px', fontSize: '16px', fontWeight: 600 }} />
                </div>
                <button className="btn-primary" onClick={handleSave} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 25px' }}><Save size={20} /> Salvar Alterações</button>
            </div>
            <div className="editor-toolbar" style={{ padding: '10px 20px', background: '#f8f9fa', borderBottom: '1px solid #eee', display: 'flex', gap: '10px', alignItems: 'center' }}>
                <select value={triggerType} onChange={e => setTriggerType(e.target.value)} style={{ padding: '6px', borderRadius: '6px' }}>
                    <option value="keyword">Palavras-chave</option>
                    <option value="message">Nova Mensagem</option>
                    <option value="connection_update">Conexão Caiu</option>
                    <option value="qrcode_updated">QR Code</option>
                </select>
                {triggerType === 'keyword' && <input value={triggerKeywords} onChange={e => setTriggerKeywords(e.target.value)} placeholder="Keywords..." style={{ padding: '6px', borderRadius: '6px', border: '1px solid #ddd' }} />}
                <button className="btn-small" onClick={() => addNode('messageNode')}><MessageSquare size={16} /> Mensagem</button>
                <button className="btn-small" onClick={() => addNode('optionsNode')}><ListOrdered size={16} /> Opções</button>
                <button className="btn-small" onClick={() => addNode('imageNode')}><ImageIcon size={16} /> Imagem</button>
                <button className="btn-small" onClick={() => addNode('alertNode')}><Bell size={16} /> Alerta</button>
                <button className="btn-small" onClick={() => addNode('businessHoursNode')}><Clock size={16} /> Horário</button>
                <button className="btn-small" onClick={() => addNode('emailNode')}><Mail size={16} /> E-mail</button>
                <button className="btn-small" onClick={() => addNode('closeAutomationNode')} style={{ color: '#dc3545' }}><XCircle size={16} /> Fechar</button>
            </div>
            <div style={{ flex: 1, position: 'relative' }}>
                <ReactFlow nodes={nodesWithHandlers} edges={edges} onNodesChange={(c) => setNodes(n => applyNodeChanges(c, n))} onEdgesChange={(c) => setEdges(e => applyEdgeChanges(c, e))} onConnect={(p) => setEdges(e => addEdge({ ...p, animated: true, markerEnd: { type: MarkerType.ArrowClosed } }, e))} nodeTypes={nodeTypes} fitView>
                    <Background color="#aaa" gap={20} /><Controls />
                </ReactFlow>
            </div>
        </div>
    );
}

export function AutomationBuilder({ user, addToast }) {
    const [automations, setAutomations] = useState([]);
    const [editingAutomation, setEditingAutomation] = useState(null);
    const [loading, setLoading] = useState(true);
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [autoToDelete, setAutoToDelete] = useState(null);
    const [showDisableModal, setShowDisableModal] = useState(false);
    const [autoToDisable, setAutoToDisable] = useState(null);
    const fileInputRef = useRef(null);

    const fetchAutomations = useCallback(async () => {
        const res = await fetch(`/api/evolution/automations/${user.id}`, { headers: { 'Authorization': `Bearer ${user.token}` } });
        if (res.ok) setAutomations(await res.json());
        setLoading(false);
    }, [user.id, user.token]);

    useEffect(() => { fetchAutomations(); }, [fetchAutomations]);

    const toggleActive = async (id, currentStatus) => {
        // If turning OFF, show confirmation modal first
        if (currentStatus) {
            setAutoToDisable(id);
            setShowDisableModal(true);
            return;
        }

        // If turning ON, proceed directly
        executeToggle(id);
    };

    const executeToggle = async (id) => {
        console.log('Toggling automation:', id);
        // Optimistic update
        setAutomations(prev => prev.map(a => a.id === id ? { ...a, isActive: !a.isActive } : a));

        try {
            const res = await fetch(`/api/evolution/automations/${id}/toggle`, {
                method: 'PATCH',
                headers: { 'Authorization': `Bearer ${user.token}` }
            });
            if (!res.ok) {
                // Rollback on error
                const errorData = await res.json();
                console.error('Toggle failed:', errorData);
                fetchAutomations();
                addToast('Erro ao alternar status', 'error');
            } else {
                console.log('Toggle success for:', id);
            }
        } catch (e) {
            console.error('Toggle error:', e);
            fetchAutomations();
            addToast('Erro ao alternar status', 'error');
        }
    };

    const performDelete = async () => {
        await fetch(`/api/evolution/automations/${autoToDelete}`, { method: 'DELETE', headers: { 'Authorization': `Bearer ${user.token}` } });
        fetchAutomations();
        setShowDeleteModal(false);
    };

    const confirmDelete = (id) => {
        setAutoToDelete(id);
        setShowDeleteModal(true);
    };

    const handleImport = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = async (event) => {
            try {
                const data = JSON.parse(event.target.result);

                // Robust parsing of nodes/edges (could be strings from DB or objects from UI)
                const parseField = (f) => {
                    if (!f) return [];
                    if (typeof f === 'string') return JSON.parse(f);
                    return f;
                };

                const res = await fetch('/api/evolution/automations', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${user.token}` },
                    body: JSON.stringify({
                        name: `Importado - ${data.name || 'Sem nome'}`,
                        triggerType: data.triggerType || 'message',
                        triggerKeywords: data.triggerKeywords || '',
                        nodes: parseField(data.nodes),
                        edges: parseField(data.edges),
                        conditions: parseField(data.conditions)
                    })
                });

                if (res.ok) {
                    fetchAutomations();
                    addToast('Importado com sucesso!', 'success');
                } else {
                    const errData = await res.json();
                    console.error('Import failure:', errData);
                    addToast(`Erro ao importar: ${errData.error || 'Erro no servidor'}`, 'error');
                }
            } catch (e) {
                console.error('Import error:', e);
                addToast('Erro ao processar JSON.', 'error');
            }
        };
        reader.readAsText(file);
    };

    const downloadJson = (auto) => {
        const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(auto, null, 2));
        const link = document.createElement('a'); link.href = dataStr; link.download = `${auto.name}.json`; link.click();
    };

    return (
        <div className="card" style={{ height: '100%', width: '100%', backgroundColor: 'white', padding: '2.5rem', borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-sm)' }}>
            <style>{NODE_STYLES}</style>
            {showDeleteModal && (
                <div className="modal-overlay" style={{ zIndex: 10000 }}>
                    <div className="modal-content alert" style={{ textAlign: 'center' }}>
                        <div style={{ marginBottom: '20px' }}>
                            <div style={{ background: '#fff9e6', width: '60px', height: '60px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 15px' }}><Trash2 size={30} color="#ffc200" /></div>
                            <h3 style={{ fontSize: '1.5rem', color: 'var(--ambev-blue)' }}>Excluir Automação?</h3>
                        </div>
                        <div style={{ display: 'flex', gap: '15px', justifyContent: 'center' }}>
                            <button className="btn-3d-blue" onClick={() => setShowDeleteModal(false)}>Cancelar</button>
                            <button className="btn-3d-yellow" onClick={performDelete}>Excluir</button>
                        </div>
                    </div>
                </div>
            )}

            {showDisableModal && (
                <div className="modal-overlay" style={{ zIndex: 10000 }}>
                    <div className="modal-content alert" style={{ textAlign: 'center' }}>
                        <div style={{ marginBottom: '20px' }}>
                            <div style={{ background: '#fff9e6', width: '60px', height: '60px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 15px' }}>
                                <AlertCircle size={30} color="#ffc200" />
                            </div>
                            <h3 style={{ fontSize: '1.5rem', color: 'var(--ambev-blue)' }}>Desativar Automação?</h3>
                            <p style={{ color: '#666', marginTop: '10px' }}>
                                A automação deixará de responder às mensagens recebidas.
                            </p>
                        </div>
                        <div style={{ display: 'flex', gap: '15px', justifyContent: 'center' }}>
                            <button className="btn-3d-blue" onClick={() => setShowDisableModal(false)}>Cancelar</button>
                            <button className="btn-3d-yellow" onClick={() => { executeToggle(autoToDisable); setShowDisableModal(false); }}>Desativar</button>
                        </div>
                    </div>
                </div>
            )}

            {editingAutomation || editingAutomation === 'new' ? (
                <ReactFlowProvider>
                    <AutomationEditor automation={editingAutomation === 'new' ? null : editingAutomation} onSave={() => { setEditingAutomation(null); fetchAutomations(); }} onBack={() => setEditingAutomation(null)} userId={user.id} token={user.token} addToast={addToast} />
                </ReactFlowProvider>
            ) : (
                <div className="flow-builder-list fade-in" style={{ padding: '2.5rem', backgroundColor: 'white', borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-sm)' }}>
                    <div className="list-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
                        <div>
                            <h2 style={{ fontSize: '2rem', color: 'var(--ambev-blue)', marginBottom: '8px' }}>Automações Evolution</h2>
                            <p className="subtitle">Gerencie suas automações inteligentes</p>
                        </div>
                        <div style={{ display: 'flex', gap: '10px' }}>
                            <input type="file" ref={fileInputRef} onChange={handleImport} style={{ display: 'none' }} accept=".json" />
                            <button className="btn-secondary" onClick={() => fileInputRef.current?.click()} style={{ padding: '12px 24px', borderRadius: '10px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <Upload size={18} /> Importar
                            </button>
                            <button className="btn-primary" onClick={() => setEditingAutomation('new')} style={{ padding: '12px 24px', borderRadius: '10px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <Plus size={18} /> Nova Automação
                            </button>
                        </div>
                    </div>
                    {loading ? <div style={{ textAlign: 'center' }}><RefreshCw className="animate-spin" size={32} /></div> : (
                        <div className="flows-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '25px' }}>
                            {automations.map(auto => (
                                <div key={auto.id} className="flow-card">
                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '15px' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                                            <div className="flow-card-icon"><Zap size={24} /></div>
                                            <div><h4 style={{ margin: 0 }}>{auto.name}</h4><span style={{ fontSize: 12, color: '#999' }}>ID: #{auto.id}</span></div>
                                        </div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                            <div style={{ height: '24px' }}>
                                                <label className="switch" title={auto.isActive ? "Ativo" : "Inativo"}>
                                                    <input
                                                        type="checkbox"
                                                        checked={!!auto.isActive}
                                                        onChange={() => { }}
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            toggleActive(auto.id, auto.isActive);
                                                        }}
                                                    />
                                                    <span className="slider"></span>
                                                </label>
                                            </div>
                                            <button className="btn-delete-flow" onClick={(e) => { e.stopPropagation(); confirmDelete(auto.id); }}><Trash2 size={18} /></button>
                                        </div>
                                    </div>
                                    <div style={{ marginTop: '20px', display: 'flex', gap: '12px' }}>
                                        <button className="btn-edit-flow" style={{ flex: 1, height: '42px', padding: '0 15px', borderRadius: '8px' }} onClick={() => setEditingAutomation(auto)}><Edit3 size={16} /> Editar</button>
                                        <button className="btn-secondary" style={{ height: '42px', padding: '0 15px', borderRadius: '8px' }} onClick={() => downloadJson(auto)}><Download size={16} /></button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

export default AutomationBuilder;
