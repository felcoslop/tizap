import React, { useState } from 'react';
import { Handle, Position } from 'reactflow';
import { MessageCircle } from 'lucide-react';
import BaseNode from './BaseNode';

const TemplateNode = ({ data, id, selected }) => {
    const [isEditing, setIsEditing] = useState(false);
    const [templateName, setTemplateName] = useState(data.templateName || '');

    const handleSave = () => {
        data.onChange(id, {
            templateName,
            isTemplate: true,
            waitForReply: data.waitForReply,
            waitTimeout: data.waitTimeout
        });
        setIsEditing(false);
    };

    const waitForReply = data.waitForReply;

    return (
        <BaseNode
            id={id}
            selected={selected}
            type="template"
            title="Template Meta"
            icon={MessageCircle}
            headerClass="template-header"
            isEditing={isEditing}
            onEditToggle={() => setIsEditing(!isEditing)}
            onDelete={data.onDelete}
        >
            {isEditing ? (
                <div className="edit-mode nodrag">
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
                        {data.waitForReply && (
                            <div style={{ marginTop: '8px', padding: '8px', background: '#f8f9fa', borderRadius: '4px' }}>
                                <label style={{ fontSize: '11px', color: '#555', display: 'block', marginBottom: '4px' }}>Tempo limite (minutos):</label>
                                <input
                                    type="number"
                                    min="1"
                                    value={data.waitTimeout || 5}
                                    onChange={(e) => data.onChange(id, { waitTimeout: Number(e.target.value) })}
                                    style={{ width: '100%', padding: '4px', fontSize: '12px' }}
                                />
                                <span style={{ fontSize: '10px', color: '#888' }}>Segue pelo caminho vermelho se não responder.</span>
                            </div>
                        )}
                        <button className="btn-small btn-primary" onClick={handleSave}>Salvar</button>
                    </div>
                </div>
            ) : (
                <div>
                    <p className="node-text" style={{ color: '#00a276' }}><strong>Template:</strong> {data.templateName || 'Nenhum selecionado'}</p>
                    {waitForReply && <p style={{ fontSize: 11, color: '#666', marginTop: 4 }}>Aguardando resposta</p>}
                </div>
            )}

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
        </BaseNode>
    );
};

export default TemplateNode;
