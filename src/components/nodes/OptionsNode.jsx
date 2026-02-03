import React, { useState } from 'react';
import { Handle, Position } from 'reactflow';
import { ListOrdered, X, Plus } from 'lucide-react';
import BaseNode from './BaseNode';

const OptionsNode = ({ data, id, selected }) => {
    const [isEditing, setIsEditing] = useState(false);
    const [tempLabel, setTempLabel] = useState(data.label || '');
    const [options, setOptions] = useState(data.options || ['Sim', 'Não']);
    const [typingTime, setTypingTime] = useState(data.typingTime !== undefined ? data.typingTime : 2);

    const handleSave = () => {
        data.onChange(id, {
            label: tempLabel,
            options,
            validateSelection: data.validateSelection,
            waitForReply: true,
            typingTime: Number(typingTime)
        });
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
        <BaseNode
            id={id}
            selected={selected}
            type="options"
            title="Menu de Opções"
            icon={ListOrdered}
            headerClass="options-header"
            isEditing={isEditing}
            onEditToggle={() => setIsEditing(!isEditing)}
            onDelete={data.onDelete}
        >
            {isEditing ? (
                <div className="edit-mode nodrag">
                    <textarea
                        value={tempLabel}
                        onChange={(e) => setTempLabel(e.target.value)}
                        placeholder="Mensagem antes das opções..."
                        rows={2}
                    />

                    <div style={{ marginBottom: '10px' }}>
                        <label style={{ fontSize: '11px', color: '#555', display: 'block', marginBottom: '4px' }}>Tempo de Digitação (s):</label>
                        <input
                            type="number"
                            min="0"
                            value={typingTime}
                            onChange={(e) => setTypingTime(e.target.value)}
                            style={{ width: '100%', padding: '6px', borderRadius: '4px', border: '1px solid #ddd' }}
                        />
                    </div>

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

                    <button className="btn-small btn-primary" onClick={handleSave} style={{ width: '100%' }}>Salvar</button>
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
                                    style={{ background: '#fecb00', width: 14, height: 14, border: '2px solid #333', position: 'relative', right: '-8px', top: 'auto', zIndex: 10 }}
                                    title={`Opção ${i + 1}`}
                                />
                            </div>
                        ))}
                    </div>
                </div>
            )}

            <div className="invalid-handle-wrapper">
                <span className="invalid-label">Inválido →</span>
                <Handle
                    type="source"
                    position={Position.Right}
                    id="source-invalid"
                    style={{ background: '#dc3545', width: 14, height: 14, border: '2px solid #333', position: 'relative', right: '-8px', top: 'auto', zIndex: 10 }}
                    title="Resposta inválida"
                />
            </div>
        </BaseNode>
    );
};

export default OptionsNode;
