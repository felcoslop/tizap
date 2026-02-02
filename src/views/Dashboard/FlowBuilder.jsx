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
import { X, Plus, Trash2, Edit3, Play, Save, ArrowLeft, Image, MessageSquare, MessageCircle, ListOrdered, Upload, Download, RefreshCw, Mail } from 'lucide-react';

const NODE_STYLES = `
    .flow-node {
        background: white;
        border: 2px solid #ddd;
        border-radius: 10px;
        width: 320px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.1);
        transition: all 0.2s;
    }
    .flow-node.selected {
        border-color: #280091;
        box-shadow: 0 4px 20px rgba(40, 0, 145, 0.2);
    }
    .node-header {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 10px 12px;
        background: linear-gradient(135deg, #280091, #4a1dc1);
        color: white;
        border-radius: 8px 8px 0 0;
        font-size: 13px;
        font-weight: 600;
    }
    .node-header-btns {
        margin-left: auto;
        display: flex;
        align-items: center;
        gap: 6px;
    }
    .node-edit-btn, .node-delete-btn {
        background: rgba(255,255,255,0.2);
        border: none;
        border-radius: 4px;
        cursor: pointer;
        color: white;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 4px;
        transition: background 0.2s;
    }
    .node-delete-btn:hover { background: #ff5555; }
    .node-edit-btn:hover { background: rgba(255,255,255,0.4); }

    .options-header { background: linear-gradient(135deg, #fecb00, #f0a500) !important; color: #333 !important; }
    .options-header .node-edit-btn, .options-header .node-delete-btn { background: rgba(0,0,0,0.1); color: #333; }
    .options-header .node-delete-btn:hover { background: #ff5555; color: white; }

    .template-header { background: linear-gradient(135deg, #00a276, #00c896) !important; }
    .image-header { background: linear-gradient(135deg, #e91e63, #f48fb1) !important; }
    .email-header { background: linear-gradient(135deg, #7c3aed, #a78bfa) !important; }
    
    .node-content { padding: 12px; }
    .node-text { margin: 0; font-size: 13px; color: #333; white-space: pre-wrap; line-height: 1.4; }
    
    .edit-mode textarea, .edit-mode input[type="text"] {
        width: 100%;
        border: 1px solid #ddd;
        border-radius: 6px;
        padding: 8px;
        font-size: 13px;
        margin-bottom: 8px;
        resize: vertical;
    }
    .edit-actions {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-top: 8px;
    }
    .edit-actions label { font-size: 12px; display: flex; align-items: center; gap: 4px; }
    
    .btn-small { padding: 6px 12px; font-size: 12px; border: none; border-radius: 6px; cursor: pointer; }
    .btn-small.btn-primary { background: #280091; color: white; }
    
    .handles-row { display: flex; justify-content: center; padding-bottom: 8px; position: relative; min-height: 20px; }
    
    .options-list { margin: 10px 0; }
    .option-item { display: flex; align-items: center; gap: 6px; margin-bottom: 6px; }
    .option-num { font-weight: 700; color: #280091; }
    .option-item input { flex: 1; padding: 6px; border: 1px solid #ddd; border-radius: 4px; font-size: 12px; }
    .remove-opt { background: #dc3545; color: white; border: none; padding: 4px; border-radius: 4px; cursor: pointer; }
    .add-option-btn {
        display: flex; align-items: center; gap: 4px; background: none; border: 1px dashed #999;
        padding: 6px 10px; border-radius: 6px; cursor: pointer; font-size: 12px; color: #666;
        width: 100%; justify-content: center; margin-bottom: 8px;
    }
    
    .option-row {
        display: flex; align-items: center; justify-content: space-between;
        padding: 6px 0; border-bottom: 1px solid #eee; font-size: 12px; position: relative;
    }
    .option-row:last-child { border-bottom: none; }
    
    .invalid-handle-wrapper {
        display: flex; align-items: center; justify-content: flex-end;
        padding: 8px 12px; background: #fff0f0; border-radius: 0 0 10px 10px; font-size: 11px; color: #dc3545; position: relative;
    }
    .invalid-label { margin-right: 8px; }
    
    .upload-section { margin-bottom: 8px; }
    .btn-upload {
        padding: 8px 16px; background: #e91e63; color: white; border: none;
        border-radius: 6px; cursor: pointer; font-size: 12px; width: 100%;
        display: flex; align-items: center; justify-content: center; gap: 6px;
    }
    .btn-upload:disabled { opacity: 0.6; cursor: not-allowed; }
    
    .previews-grid { margin-top: 8px; }
    .preview-item { position: relative; }
    .preview-item img { width: 100%; height: 60px; object-fit: cover; border-radius: 4px; border: 1px solid #eee; }
    .remove-img-btn:hover { transform: scale(1.1); background: #ff0000; }

    /* Flow List Styles */
    .flow-builder-list {
        padding: 0;
        animation: fadeIn 0.3s ease-out;
    }
    @keyframes fadeIn {
        from { opacity: 0; transform: translateY(10px); }
        to { opacity: 1; transform: translateY(0); }
    }
    .subtitle {
        color: #666;
        font-size: 14px;
        margin: 0;
    }
    .btn-primary {
        background: #280091;
        color: white;
        border: none;
        border-radius: 8px;
        padding: 10px 20px;
        font-weight: 600;
        cursor: pointer;
        display: flex;
        align-items: center;
        gap: 8px;
        transition: all 0.2s;
    }
    .btn-primary:hover {
        background: #4a1dc1;
        box-shadow: 0 4px 12px rgba(40, 0, 145, 0.3);
    }
    .btn-secondary {
        background: #f0f2f5;
        color: #333;
        border: 1px solid #ddd;
        border-radius: 8px;
        padding: 8px 16px;
        font-weight: 600;
        cursor: pointer;
        display: flex;
        align-items: center;
        gap: 8px;
        transition: all 0.2s;
    }
    .btn-secondary:hover { background: #e4e6e9; }

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
        border-color: #280091;
    }
    .flow-card-icon {
        background: #f0f2ff;
        padding: 14px;
        border-radius: 12px;
        color: #280091;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: transform 0.2s;
    }
    .flow-card:hover .flow-card-icon { transform: scale(1.1); }
    
    .btn-edit-flow {
        background: #280091 !important;
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
        letter-spacing: 0.5px !important;
    }
    .btn-edit-flow:hover { background: #4a1dc1 !important; transform: translateY(-2px) !important; }
    
    .btn-delete-flow {
        background: #fffafa !important;
        color: #ff5555 !important;
        border: 1px solid #ffebeb !important;
        border-radius: 8px !important;
        padding: 8px !important;
        transition: all 0.2s !important;
        cursor: pointer !important;
    }
    .btn-delete-flow:hover { background: #ff5555 !important; color: white !important; border-color: #ff5555 !important; }
`;

// --- Custom Node Types ---

// Message Node Component
function MessageNode({ data, id, selected }) {
    const [isEditing, setIsEditing] = useState(false);
    const [tempLabel, setTempLabel] = useState(data.label || '');

    const handleSave = () => {
        data.onChange(id, { label: tempLabel });
        setIsEditing(false);
    };

    const hasOptions = data.options && data.options.length > 0;
    const waitForReply = data.waitForReply;

    return (
        <div className={`flow-node message-node ${selected ? 'selected' : ''}`}>
            <Handle type="target" position={Position.Top} id="target" style={{ background: '#555', width: 14, height: 14, border: '2px solid #333' }} />

            <div className="node-header">
                <MessageSquare size={16} />
                <span>Mensagem</span>
                <div className="node-header-btns">
                    <button className="node-edit-btn" onClick={() => setIsEditing(!isEditing)} title="Editar">
                        <Edit3 size={12} />
                    </button>
                    <button className="node-delete-btn" onClick={() => data.onDelete(id)} title="Excluir">
                        <Trash2 size={12} />
                    </button>
                </div>
            </div>

            <div className="node-content">
                {isEditing ? (
                    <div className="edit-mode">
                        <textarea
                            value={tempLabel}
                            onChange={(e) => setTempLabel(e.target.value)}
                            placeholder="Escreva sua mensagem..."
                            rows={4}
                        />
                        <div className="edit-actions">
                            <label>
                                <input
                                    type="checkbox"
                                    checked={data.waitForReply || false}
                                    onChange={(e) => data.onChange(id, { waitForReply: e.target.checked })}
                                />
                                Aguardar resposta
                            </label>
                            <button className="btn-small btn-primary" onClick={handleSave}>Salvar</button>
                        </div>
                    </div>
                ) : (
                    <p className="node-text">{data.label || 'Clique para editar...'}</p>
                )}
            </div>

            {!hasOptions && (
                <div className="handles-row">
                    {waitForReply ? (
                        <>
                            <Handle type="source" position={Position.Bottom} id="source-green" style={{ background: '#00a276', left: '30%', width: 14, height: 14, border: '2px solid #333' }} title="Respondeu" />
                            <Handle type="source" position={Position.Bottom} id="source-red" style={{ background: '#dc3545', left: '70%', width: 14, height: 14, border: '2px solid #333' }} title="Não respondeu" />
                        </>
                    ) : (
                        <Handle type="source" position={Position.Bottom} id="source-gray" style={{ background: '#6c757d', width: 14, height: 14, border: '2px solid #333' }} title="Continuar" />
                    )}
                </div>
            )}

            {hasOptions && (
                <div className="handles-row options-handles">
                    {data.options.map((opt, i) => (
                        <Handle
                            key={i}
                            type="source"
                            position={Position.Bottom}
                            id={`source-${i + 1}`}
                            style={{ background: '#fecb00', left: `${((i + 1) / (data.options.length + 1)) * 100}%`, width: 14, height: 14, border: '2px solid #333' }}
                            title={`Opção ${i + 1}`}
                        />
                    ))}
                </div>
            )}
        </div>
    );
}

// Options Node Component
function OptionsNode({ data, id, selected }) {
    const [isEditing, setIsEditing] = useState(false);
    const [tempLabel, setTempLabel] = useState(data.label || '');
    const [options, setOptions] = useState(data.options || ['Sim', 'Não']);

    const handleSave = () => {
        data.onChange(id, { label: tempLabel, options, waitForReply: true });
        setIsEditing(false);
    };

    const addOption = () => setOptions([...options, `Opção ${options.length + 1}`]);
    const removeOption = (index) => setOptions(options.filter((_, i) => i !== index));
    const updateOption = (index, value) => {
        const newOptions = [...options];
        newOptions[index] = value;
        setOptions(newOptions);
    };

    const displayOptions = data.options || options;

    return (
        <div className={`flow-node options-node ${selected ? 'selected' : ''}`}>
            <Handle type="target" position={Position.Top} id="target" style={{ background: '#555', width: 14, height: 14, border: '2px solid #333' }} />

            <div className="node-header options-header">
                <ListOrdered size={16} />
                <span>Menu de Opções</span>
                <div className="node-header-btns">
                    <button className="node-edit-btn" onClick={() => setIsEditing(!isEditing)} title="Editar">
                        <Edit3 size={12} />
                    </button>
                    <button className="node-delete-btn" onClick={() => data.onDelete(id)} title="Excluir">
                        <Trash2 size={12} />
                    </button>
                </div>
            </div>

            <div className="node-content">
                {isEditing ? (
                    <div className="edit-mode">
                        <textarea
                            value={tempLabel}
                            onChange={(e) => setTempLabel(e.target.value)}
                            placeholder="Mensagem antes das opções..."
                            rows={3}
                        />
                        <div className="options-list">
                            {options.map((opt, i) => (
                                <div key={i} className="option-item">
                                    <span className="option-num">{i + 1}.</span>
                                    <input type="text" value={opt} onChange={(e) => updateOption(i, e.target.value)} />
                                    <button onClick={() => removeOption(i)} className="remove-opt"><X size={12} /></button>
                                </div>
                            ))}
                            <button className="add-option-btn" onClick={addOption}><Plus size={14} /> Adicionar opção</button>
                        </div>
                        <button className="btn-small btn-primary" onClick={handleSave}>Salvar</button>
                    </div>
                ) : (
                    <div className="options-display">
                        <p className="node-text">{data.label || 'Escolha uma opção:'}</p>
                        <div className="options-with-handles">
                            {displayOptions.map((opt, i) => (
                                <div key={i} className="option-row">
                                    <span><strong>{i + 1}.</strong> {opt}</span>
                                    <Handle
                                        type="source"
                                        position={Position.Right}
                                        id={`source-${i + 1}`}
                                        style={{ background: '#fecb00', width: 14, height: 14, border: '2px solid #333', position: 'relative', right: '-8px', top: 'auto' }}
                                        title={`Opção ${i + 1}`}
                                    />
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>

            <div className="invalid-handle-wrapper">
                <span className="invalid-label">Inválido →</span>
                <Handle type="source" position={Position.Right} id="source-invalid" style={{ background: '#dc3545', width: 14, height: 14, border: '2px solid #333', position: 'relative', right: '-8px', top: 'auto' }} title="Resposta inválida" />
            </div>
        </div>
    );
}

// Template Node Component
function TemplateNode({ data, id, selected }) {
    const [isEditing, setIsEditing] = useState(false);
    const [templateName, setTemplateName] = useState(data.templateName || '');

    const handleSave = () => {
        data.onChange(id, { templateName, isTemplate: true });
        setIsEditing(false);
    };

    const waitForReply = data.waitForReply;

    return (
        <div className={`flow-node template-node ${selected ? 'selected' : ''}`}>
            <Handle type="target" position={Position.Top} id="target" style={{ background: '#555', width: 14, height: 14, border: '2px solid #333' }} />

            <div className="node-header template-header">
                <MessageCircle size={16} />
                <span>Template Meta</span>
                <div className="node-header-btns">
                    <button className="node-edit-btn" onClick={() => setIsEditing(!isEditing)} title="Editar">
                        <Edit3 size={12} />
                    </button>
                    <button className="node-delete-btn" onClick={() => data.onDelete(id)} title="Excluir">
                        <Trash2 size={12} />
                    </button>
                </div>
            </div>

            <div className="node-content">
                {isEditing ? (
                    <div className="edit-mode">
                        <input
                            type="text"
                            value={templateName}
                            onChange={(e) => setTemplateName(e.target.value)}
                            placeholder="Nome do template..."
                        />
                        <div className="edit-actions">
                            <label>
                                <input
                                    type="checkbox"
                                    checked={data.waitForReply || false}
                                    onChange={(e) => data.onChange(id, { waitForReply: e.target.checked })}
                                />
                                Aguardar resposta
                            </label>
                            <button className="btn-small btn-primary" onClick={handleSave}>Salvar</button>
                        </div>
                    </div>
                ) : (
                    <div>
                        <p className="node-text" style={{ color: '#00a276' }}><strong>Template:</strong> {data.templateName || 'Nenhum selecionado'}</p>
                        {waitForReply && <p style={{ fontSize: 11, color: '#666', marginTop: 4 }}>⏱ Aguardando resposta</p>}
                    </div>
                )}
            </div>

            <div className="handles-row">
                {waitForReply ? (
                    <>
                        <Handle type="source" position={Position.Bottom} id="source-green" style={{ background: '#00a276', left: '30%', width: 14, height: 14, border: '2px solid #333' }} title="Respondeu" />
                        <Handle type="source" position={Position.Bottom} id="source-red" style={{ background: '#dc3545', left: '70%', width: 14, height: 14, border: '2px solid #333' }} title="Não respondeu" />
                    </>
                ) : (
                    <Handle type="source" position={Position.Bottom} id="source-gray" style={{ background: '#6c757d', width: 14, height: 14, border: '2px solid #333' }} />
                )}
            </div>
        </div>
    );
}

// Image Node Component
function ImageNode({ data, id, selected }) {
    const [isEditing, setIsEditing] = useState(false);
    const [imageUrls, setImageUrls] = useState(data.imageUrls || (data.imageUrl ? [data.imageUrl] : []));
    const [caption, setCaption] = useState(data.caption || '');
    const [uploading, setUploading] = useState(false);
    const fileInputRef = useRef(null);

    const handleSave = () => {
        data.onChange(id, { imageUrls: imageUrls.map(url => url.trim()).filter(Boolean), caption, hasImage: true });
        setIsEditing(false);
    };

    const handleFileUpload = async (e) => {
        const files = Array.from(e.target.files);
        if (!files.length) return;
        setUploading(true);
        const formData = new FormData();
        files.forEach(file => formData.append('images', file));
        try {
            const res = await fetch('/api/upload-image', {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${data.token}` },
                body: formData
            });
            const result = await res.json();
            if (res.ok && result.urls) {
                const newUrls = [...imageUrls, ...result.urls];
                setImageUrls(newUrls);
                data.onChange(id, { imageUrls: newUrls });
            } else if (res.ok && result.url) {
                const newUrls = [...imageUrls, result.url];
                setImageUrls(newUrls);
                data.onChange(id, { imageUrls: newUrls });
            }
        } catch (err) {
            console.error('Upload error:', err);
        } finally {
            setUploading(false);
        }
    };

    const removeImage = (index) => {
        const newUrls = imageUrls.filter((_, i) => i !== index);
        setImageUrls(newUrls);
        data.onChange(id, { imageUrls: newUrls });
    };

    return (
        <div className={`flow-node image-node ${selected ? 'selected' : ''}`}>
            <Handle type="target" position={Position.Top} id="target" style={{ background: '#555', width: 14, height: 14, border: '2px solid #333' }} />

            <div className="node-header image-header">
                <Image size={16} />
                <span>Imagens ({imageUrls.length})</span>
                <div className="node-header-btns">
                    <button className="node-edit-btn" onClick={() => setIsEditing(!isEditing)} title="Editar">
                        <Edit3 size={12} />
                    </button>
                    <button className="node-delete-btn" onClick={() => data.onDelete(id)} title="Excluir">
                        <Trash2 size={12} />
                    </button>
                </div>
            </div>

            <div className="node-content">
                {isEditing ? (
                    <div className="edit-mode">
                        <div className="upload-section">
                            <input type="file" ref={fileInputRef} onChange={handleFileUpload} accept="image/*" multiple style={{ display: 'none' }} />
                            <button className="btn-upload" onClick={() => fileInputRef.current?.click()} disabled={uploading}>
                                {uploading ? <><RefreshCw className="animate-spin" size={14} /> Enviando...</> : <><Plus size={14} /> Fazer Upload (Múltiplo)</>}
                            </button>
                        </div>
                        <p style={{ fontSize: 10, color: '#666', marginBottom: 4 }}>URLs Manuais (uma por linha):</p>
                        <textarea
                            rows={3}
                            value={imageUrls.join('\n')}
                            onChange={(e) => setImageUrls(e.target.value.split('\n'))}
                            placeholder="Cole as URLs..."
                        />
                        <div className="previews-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 4 }}>
                            {imageUrls.filter(u => u.trim()).map((url, i) => (
                                <div key={i} className="preview-item">
                                    <img src={url.trim()} alt="preview" />
                                    <button onClick={() => removeImage(i)} className="remove-img-btn"><X size={10} /></button>
                                </div>
                            ))}
                        </div>
                        <textarea value={caption} onChange={(e) => setCaption(e.target.value)} placeholder="Legenda (opcional)..." rows={2} style={{ marginTop: 8 }} />
                        <button className="btn-small btn-primary" onClick={handleSave} style={{ marginTop: 8 }}>Salvar</button>
                    </div>
                ) : (
                    <div>
                        {imageUrls.length > 0 ? (
                            <div className="previews-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 6 }}>
                                {imageUrls.slice(0, 4).map((url, i) => (
                                    <div key={i} style={{ position: 'relative' }}>
                                        <img src={url.trim()} alt="preview" style={{ width: '100%', height: 60, objectFit: 'cover', borderRadius: 4 }} />
                                        {i === 3 && imageUrls.length > 4 && (
                                            <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.5)', borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 700 }}>
                                                +{imageUrls.length - 4}
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div style={{ background: '#f0f0f0', padding: 20, textAlign: 'center', borderRadius: 6, color: '#999' }}>
                                <Image size={32} />
                                <p style={{ fontSize: 12, margin: '8px 0 0' }}>Clique em editar para adicionar imagens</p>
                            </div>
                        )}
                        {data.caption && <p className="node-text" style={{ marginTop: 8 }}>{data.caption}</p>}
                    </div>
                )}
            </div>
            <Handle type="source" position={Position.Bottom} id="source-gray" style={{ background: '#6c757d', width: 14, height: 14, border: '2px solid #333' }} />
        </div>
    );
}

// Email Node Component
function EmailNode({ data, id, selected }) {
    const [isEditing, setIsEditing] = useState(false);
    const [templates, setTemplates] = useState([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (isEditing) {
            fetchTemplates();
        }
    }, [isEditing]);

    const fetchTemplates = async () => {
        setLoading(true);
        try {
            const userId = data.userId;
            const token = data.token;
            if (!userId || !token) {
                console.warn("[EmailNode] Missing userId or token", { userId, token });
                return;
            }

            const res = await fetch(`/api/email-templates/${userId}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (res.ok) setTemplates(await res.json());
        } catch (e) {
            console.error("Error fetching templates:", e);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className={`flow-node email-node ${selected ? 'selected' : ''}`}>
            <Handle type="target" position={Position.Top} id="target" style={{ background: '#555', width: 14, height: 14, border: '2px solid #333' }} />

            <div className="node-header email-header">
                <Mail size={16} />
                <span>E-mail</span>
                <div className="node-header-btns">
                    <button className="node-edit-btn" onClick={() => setIsEditing(!isEditing)} title="Editar">
                        <Edit3 size={12} />
                    </button>
                    <button className="node-delete-btn" onClick={() => data.onDelete(id)} title="Excluir">
                        <Trash2 size={12} />
                    </button>
                </div>
            </div>

            <div className="node-content">
                {isEditing ? (
                    <div className="edit-mode">
                        <label style={{ fontSize: '11px', color: '#666', marginBottom: '4px', display: 'block' }}>Template:</label>
                        <select
                            value={data.templateId || ''}
                            onChange={(e) => {
                                const val = e.target.value;
                                const t = templates.find(x => String(x.id) === String(val));
                                data.onChange(id, { templateId: val, templateName: t ? t.name : '' });
                            }}
                            style={{ width: '100%', padding: '6px', borderRadius: '4px', border: '1px solid #ddd', marginBottom: '10px' }}
                        >
                            <option value="">Selecione um template...</option>
                            {templates.map(t => (
                                <option key={t.id} value={t.id}>{t.name}</option>
                            ))}
                        </select>

                        <div className="edit-actions">
                            <button className="btn-small btn-primary" onClick={() => setIsEditing(false)}>Salvar</button>
                        </div>
                    </div>
                ) : (
                    <div>
                        <p className="node-text" style={{ color: '#7c3aed' }}>
                            <strong>Template:</strong> {data.templateName || 'Nenhum selecionado'}
                        </p>
                    </div>
                )}
            </div>

            <div className="handles-row">
                <Handle type="source" position={Position.Bottom} id="source-gray" style={{ background: '#6c757d', width: 14, height: 14, border: '2px solid #333' }} title="Continuar" />
            </div>
        </div>
    );
}

const nodeTypes = {
    messageNode: MessageNode,
    optionsNode: OptionsNode,
    templateNode: TemplateNode,
    imageNode: ImageNode,
    emailNode: EmailNode
};

// --- Flow Editor Component ---

function FlowEditor({ flow, onSave, onBack, userId, addToast, token }) {
    const [nodes, setNodes] = useState([]);
    const [edges, setEdges] = useState([]);
    const [flowName, setFlowName] = useState(flow?.name || 'Novo Fluxo');
    const reactFlowWrapper = useRef(null);
    const [reactFlowInstance, setReactFlowInstance] = useState(null);

    useEffect(() => {
        if (flow) {
            try {
                const loadedNodes = JSON.parse(flow.nodes || '[]');
                const loadedEdges = JSON.parse(flow.edges || '[]');
                // Inject token into nodes
                const nodesWithToken = loadedNodes.map(n => ({
                    ...n,
                    data: { ...n.data, token }
                }));
                setNodes(nodesWithToken);
                setEdges(loadedEdges);
                setFlowName(flow.name);
            } catch (e) {
                console.error('Error loading flow:', e);
            }
        }
    }, [flow]);

    const onNodesChange = useCallback((changes) => setNodes((nds) => applyNodeChanges(changes, nds)), []);
    const onEdgesChange = useCallback((changes) => setEdges((eds) => applyEdgeChanges(changes, eds)), []);

    const onConnect = useCallback((params) => {
        let edgeStyle = { stroke: '#6c757d', strokeWidth: 2 };
        if (params.sourceHandle?.includes('green')) edgeStyle = { stroke: '#00a276', strokeWidth: 2 };
        if (params.sourceHandle?.includes('red')) edgeStyle = { stroke: '#dc3545', strokeWidth: 2 };
        if (params.sourceHandle?.includes('source-') && !params.sourceHandle.includes('gray')) edgeStyle = { stroke: '#fecb00', strokeWidth: 2 };

        setEdges((eds) => {
            // Robust source handle check
            const filteredEdges = eds.filter(e => {
                const sameSource = String(e.source) === String(params.source);
                const sameHandle = String(e.sourceHandle) === String(params.sourceHandle);
                return !(sameSource && sameHandle);
            });

            return addEdge({
                ...params,
                id: `edge-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
                type: 'smoothstep',
                animated: true,
                style: edgeStyle,
                markerEnd: { type: MarkerType.ArrowClosed }
            }, filteredEdges);
        });
    }, []);

    const handleNodeDataChange = useCallback((nodeId, newData) => {
        setNodes((nds) =>
            nds.map((node) => {
                if (node.id === nodeId) return { ...node, data: { ...node.data, ...newData } };
                return node;
            })
        );
    }, []);

    const handleDeleteNode = useCallback((nodeId) => {
        setNodes((nds) => nds.filter((node) => String(node.id) !== String(nodeId)));
        setEdges((eds) => eds.filter((edge) => String(edge.source) !== String(nodeId) && String(edge.target) !== String(nodeId)));
    }, []);

    const onNodesDelete = useCallback((deletedNodes) => {
        const deletedIds = deletedNodes.map(n => String(n.id));
        setEdges((eds) => eds.filter((edge) => !deletedIds.includes(String(edge.source)) && !deletedIds.includes(String(edge.target))));
    }, []);

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

        setNodes((nds) => [...nds, { id, type, position, data: defaultData }]);
    };

    const handleSave = async () => {
        console.log('[DEBUG] Starting Save. Token:', token, 'UserId:', userId);
        try {
            // Strip onChange, onDelete and token before saving
            const nodesForSave = nodes.map(node => ({
                ...node,
                data: { ...(node.data || {}), onChange: undefined, onDelete: undefined, token: undefined }
            }));

            const endpoint = `/api/flows`;
            const method = 'POST';
            const payload = {
                name: flowName,
                nodes: nodesForSave,
                edges,
                userId: parseInt(userId)
            };
            if (flow?.id) payload.id = parseInt(flow.id);

            console.log('[DEBUG] Payload prepared:', JSON.stringify(payload).slice(0, 200) + '...');

            const res = await fetch(endpoint, {
                method,
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(payload)
            });

            if (res.ok) {
                addToast('Fluxo salvo com sucesso!', 'success');
                onSave();
            } else {
                const errData = await res.json();
                console.error('[SAVE ERROR SERVER]', errData);
                addToast('Erro ao salvar fluxo: ' + (errData.error || 'Desconhecido'), 'error');
            }
        } catch (err) {
            console.error('[SAVE ERROR CLIENT]', err);
            addToast('Erro de conexão ao salvar: ' + err.message, 'error');
        }
    };

    const nodesWithHandlers = useMemo(() => {
        return nodes.map(node => ({
            ...node,
            data: {
                ...node.data,
                userId,
                token,
                onChange: handleNodeDataChange,
                onDelete: handleDeleteNode
            }
        }));
    }, [nodes, handleNodeDataChange, handleDeleteNode, userId, token]);

    return (
        <div className="flow-editor-container" style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
            <div className="editor-header" style={{ padding: '15px 25px', background: 'white', borderBottom: '1px solid #ddd', display: 'flex', alignItems: 'center', gap: '20px', boxShadow: '0 2px 10px rgba(0,0,0,0.05)', zIndex: 10 }}>
                <button className="btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: '8px' }} onClick={onBack}><ArrowLeft size={18} /> Voltar</button>
                <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <Edit3 size={18} color="#280091" />
                    <input
                        type="text"
                        value={flowName}
                        onChange={(e) => setFlowName(e.target.value)}
                        placeholder="Nome do fluxo..."
                        style={{ flex: 1, padding: '10px 15px', border: '1px solid #ddd', borderRadius: '8px', fontSize: '16px', fontWeight: 600, color: '#333' }}
                    />
                </div>
                <button className="btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 25px' }} onClick={handleSave}><Save size={20} /> Salvar Alterações</button>
            </div>

            <div className="editor-toolbar" style={{ padding: '10px 20px', background: '#f8f9fa', borderBottom: '1px solid #eee', display: 'flex', gap: '10px', alignItems: 'center' }}>
                <span style={{ fontSize: '12px', fontWeight: 600, color: '#666' }}>Adicionar:</span>
                <button className="btn-small" style={{ background: 'white', border: '1px solid #ddd' }} onClick={() => addNode('messageNode')}><MessageSquare size={16} /> Mensagem</button>
                <button className="btn-small" style={{ background: 'white', border: '1px solid #ddd' }} onClick={() => addNode('optionsNode')}><ListOrdered size={16} /> Opções</button>
                <button className="btn-small" style={{ background: 'white', border: '1px solid #ddd' }} onClick={() => addNode('templateNode')}><MessageCircle size={16} /> Template</button>
                <button className="btn-small" style={{ background: 'white', border: '1px solid #ddd' }} onClick={() => addNode('imageNode')}><Image size={16} /> Imagem</button>
                <button className="btn-small" style={{ background: 'white', border: '1px solid #ddd' }} onClick={() => addNode('emailNode')}><Mail size={16} /> E-mail</button>
            </div>

            <div className="flow-canvas" style={{ flex: 1, position: 'relative' }} ref={reactFlowWrapper}>
                <ReactFlow
                    nodes={nodesWithHandlers}
                    edges={edges}
                    onNodesChange={onNodesChange}
                    onEdgesChange={onEdgesChange}
                    onConnect={onConnect}
                    onNodesDelete={onNodesDelete}
                    onInit={setReactFlowInstance}
                    nodeTypes={nodeTypes}
                    fitView
                    deleteKeyCode={['Backspace', 'Delete']}
                    fitViewOptions={{ maxZoom: 1 }}
                    snapToGrid
                    snapGrid={[15, 15]}
                >
                    <Background color="#aaa" gap={20} />
                    <Controls />
                </ReactFlow>
            </div>
        </div>
    );
}

// --- Main FlowBuilder Component ---

export default function FlowBuilder({ user, addToast }) {
    const [flows, setFlows] = useState([]);
    const [loading, setLoading] = useState(true);
    const [editingFlow, setEditingFlow] = useState(null);
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [flowToDelete, setFlowToDelete] = useState(null);
    const fileInputRef = useRef(null);

    const downloadFlow = (flow) => {
        const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(flow, null, 2));
        const downloadAnchorNode = document.createElement('a');
        downloadAnchorNode.setAttribute("href", dataStr);
        downloadAnchorNode.setAttribute("download", `${flow.name}.json`);
        document.body.appendChild(downloadAnchorNode);
        downloadAnchorNode.click();
        downloadAnchorNode.remove();
        addToast('JSON do fluxo gerado!', 'success');
    };

    const handleFileUpload = (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = async (event) => {
            try {
                const flowData = JSON.parse(event.target.result);
                // Prepare payload for creation
                const payload = {
                    name: `Cópia de ${flowData.name || 'Fluxo Importado'}`,
                    nodes: JSON.parse(flowData.nodes || '[]'),
                    edges: JSON.parse(flowData.edges || '[]'),
                    userId: user.id
                };

                const res = await fetch('/api/flows', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${user.token}`
                    },
                    body: JSON.stringify(payload)
                });

                if (res.ok) {
                    addToast('Fluxo importado com sucesso!', 'success');
                    fetchFlows();
                } else {
                    const err = await res.json();
                    addToast('Erro ao importar: ' + (err.error || 'Desconhecido'), 'error');
                }
            } catch (err) {
                console.error('Import error:', err);
                addToast('Arquivo JSON inválido ou corrompido.', 'error');
            }
        };
        reader.readAsText(file);
        // Clear input
        e.target.value = '';
    };

    const fetchFlows = useCallback(async () => {
        setLoading(true);
        try {
            const res = await fetch(`/api/flows/${user.id}`, {
                headers: { 'Authorization': `Bearer ${user.token}` }
            });
            if (res.ok) {
                const data = await res.json();
                setFlows(data);
            }
        } catch (err) {
            addToast('Erro ao carregar fluxos.', 'error');
        } finally {
            setLoading(false);
        }
    }, [user.id, addToast]);

    useEffect(() => {
        fetchFlows();
    }, [fetchFlows]);

    const performDelete = async () => {
        if (!flowToDelete) return;
        try {
            const res = await fetch(`/api/flows/${flowToDelete}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${user.token}` }
            });
            if (res.ok) {
                addToast('Fluxo excluído.', 'info');
                fetchFlows();
            } else {
                addToast('Erro ao excluir no servidor.', 'error');
            }
        } catch (err) {
            addToast('Erro ao excluir.', 'error');
        } finally {
            setShowDeleteModal(false);
            setFlowToDelete(null);
        }
    };

    const confirmDelete = (id) => {
        setFlowToDelete(id);
        setShowDeleteModal(true);
    };

    return (
        <div className="card" style={{ height: '100%', width: '100%', backgroundColor: 'white', padding: '2.5rem', borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-sm)' }}>
            <style>{NODE_STYLES}</style>
            {showDeleteModal && (
                <div className="modal-overlay" style={{ zIndex: 10000 }}>
                    <div className="modal-content alert" style={{ textAlign: 'center' }}>
                        <div style={{ marginBottom: '20px' }}>
                            <div style={{ background: '#fff9e6', width: '60px', height: '60px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 15px' }}>
                                <Trash2 size={30} color="#ffc200" />
                            </div>
                            <h3 style={{ fontSize: '1.5rem', color: 'var(--ambev-blue)', marginBottom: '10px' }}>Excluir Fluxo?</h3>
                            <p style={{ color: '#666', fontSize: '1rem' }}>Esta ação não pode ser desfeita. Tem certeza que deseja remover este fluxo?</p>
                        </div>
                        <div style={{ display: 'flex', gap: '15px', justifyContent: 'center' }}>
                            <button className="btn-3d-blue" style={{ width: '120px' }} onClick={() => setShowDeleteModal(false)}>Cancelar</button>
                            <button className="btn-3d-yellow" style={{ width: '120px' }} onClick={performDelete}>Excluir</button>
                        </div>
                    </div>
                </div>
            )}

            {editingFlow || editingFlow === 'new' ? (
                <ReactFlowProvider>
                    <FlowEditor
                        flow={editingFlow === 'new' ? null : editingFlow}
                        onSave={() => { setEditingFlow(null); fetchFlows(); }}
                        onBack={() => setEditingFlow(null)}
                        userId={user.id}
                        token={user.token}
                        addToast={addToast}
                        style={{ background: '#f8fbfc' }}
                    />
                </ReactFlowProvider>
            ) : (
                <div className="flow-builder-list fade-in" style={{ padding: '2.5rem', backgroundColor: 'white', borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-sm)' }}>
                    <div className="list-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
                        <div>
                            <h2 style={{ fontSize: '2rem', color: 'var(--ambev-blue)', marginBottom: '8px' }}>Seus Fluxos</h2>
                            <p className="subtitle">Gerencie seus fluxos de conversas automáticas</p>
                        </div>
                        <div style={{ display: 'flex', gap: '10px', alignItems: 'stretch' }}>
                            <input
                                type="file"
                                ref={fileInputRef}
                                onChange={handleFileUpload}
                                accept=".json"
                                style={{ display: 'none' }}
                            />
                            <button
                                className="btn-secondary"
                                onClick={() => fileInputRef.current?.click()}
                                style={{ height: '48px', padding: '0 24px', borderRadius: '10px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}
                            >
                                <Upload size={18} /> Importar
                            </button>
                            <button
                                className="btn-primary"
                                onClick={() => setEditingFlow('new')}
                                style={{ height: '48px', padding: '0 24px', borderRadius: '10px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}
                            >
                                <Plus size={18} /> Novo Fluxo
                            </button>
                        </div>
                    </div>

                    {loading ? (
                        <div style={{ textAlign: 'center', padding: '40px' }}><RefreshCw className="animate-spin" size={32} /></div>
                    ) : flows.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: '60px', color: '#999', backgroundColor: '#f9fbfd', borderRadius: '16px', border: '2px dashed #e1e8ed' }}>
                            <MessageSquare size={48} style={{ opacity: 0.2, marginBottom: '15px' }} />
                            <p>Nenhum fluxo criado. Comece criando um novo fluxo.</p>
                        </div>
                    ) : (
                        <div className="flows-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '25px', padding: '10px 0' }}>
                            {flows.map((flow) => (
                                <div key={flow.id} className="flow-card">
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '15px' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                                            <div className="flow-card-icon">
                                                <Play size={24} />
                                            </div>
                                            <div>
                                                <h4 style={{ margin: 0, fontSize: '18px', color: '#333' }}>{flow.name}</h4>
                                                <span style={{ fontSize: '12px', color: '#999', fontWeight: 500 }}>ID do Fluxo: #{flow.id}</span>
                                            </div>
                                        </div>
                                        <button className="btn-delete-flow" onClick={() => confirmDelete(flow.id)} title="Excluir Fluxo">
                                            <Trash2 size={18} />
                                        </button>
                                    </div>
                                    <div style={{ marginTop: '20px', display: 'flex', gap: '12px' }}>
                                        <button className="btn-edit-flow" style={{ flex: 1, height: '42px', padding: '0 15px', borderRadius: '8px' }} onClick={() => setEditingFlow(flow)}>
                                            <Edit3 size={16} /> Editar
                                        </button>
                                        <button className="btn-secondary" style={{ height: '42px', padding: '0 15px', borderRadius: '8px' }} onClick={() => downloadFlow(flow)} title="Baixar JSON">
                                            <Download size={16} />
                                        </button>
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
