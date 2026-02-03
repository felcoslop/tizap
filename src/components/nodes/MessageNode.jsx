import React, { useState } from 'react';
import { Handle, Position } from 'reactflow';
import { MessageSquare } from 'lucide-react';
import BaseNode from './BaseNode';

const MessageNode = ({ data, id, selected }) => {
    const [isEditing, setIsEditing] = useState(false);
    const [tempLabel, setTempLabel] = useState(data.label || '');
    const [typingTime, setTypingTime] = useState(data.typingTime !== undefined ? data.typingTime : 2);

    const handleSave = () => {
        data.onChange(id, {
            label: tempLabel,
            typingTime: Number(typingTime),
            waitForReply: data.waitForReply
        });
        setIsEditing(false);
    };

    const hasOptions = data.options && data.options.length > 0;
    const waitForReply = data.waitForReply;

    return (
        <BaseNode
            id={id}
            selected={selected}
            type="message"
            title="Mensagem"
            icon={MessageSquare}
            isEditing={isEditing}
            onEditToggle={() => setIsEditing(!isEditing)}
            onDelete={data.onDelete}
        >
            {isEditing ? (
                <div className="edit-mode nodrag">
                    <textarea
                        value={tempLabel}
                        onChange={(e) => setTempLabel(e.target.value)}
                        placeholder="Escreva sua mensagem..."
                        rows={4}
                    />

                    {/* Only show typing time if specified in data or using default */}
                    <div style={{ marginBottom: '8px' }}>
                        <label style={{ fontSize: '11px', color: '#555', display: 'block', marginBottom: '4px' }}>Tempo de Digitação (segundos):</label>
                        <input
                            type="number"
                            min="0"
                            max="60"
                            value={typingTime}
                            onChange={(e) => setTypingTime(e.target.value)}
                            style={{ width: '100%', padding: '6px', borderRadius: '4px', border: '1px solid #ddd' }}
                        />
                    </div>

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
        </BaseNode>
    );
};

export default MessageNode;
