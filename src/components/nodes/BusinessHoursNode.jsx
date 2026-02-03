import React, { useState } from 'react';
import { Handle, Position } from 'reactflow';
import { Clock } from 'lucide-react';
import BaseNode from './BaseNode';

const BusinessHoursNode = ({ data, id, selected }) => {
    const [isEditing, setIsEditing] = useState(false);
    const [start, setStart] = useState(data.start || '08:00');
    const [end, setEnd] = useState(data.end || '18:00');
    const [fallback, setFallback] = useState(data.fallback || '');

    const handleSave = () => {
        data.onChange(id, { start, end, fallback });
        setIsEditing(false);
    };

    return (
        <BaseNode
            id={id}
            selected={selected}
            type="hours"
            title="Horário Comercial"
            icon={Clock}
            headerClass="hours-header"
            isEditing={isEditing}
            onEditToggle={() => setIsEditing(!isEditing)}
            onDelete={data.onDelete}
            showSource={true}
        >
            {isEditing ? (
                <div className="edit-mode nodrag">
                    <div style={{ display: 'flex', gap: '5px', marginBottom: '8px' }}>
                        <input type="time" value={start} onChange={(e) => setStart(e.target.value)} style={{ flex: 1 }} />
                        <input type="time" value={end} onChange={(e) => setEnd(e.target.value)} style={{ flex: 1 }} />
                    </div>
                    <textarea value={fallback} onChange={(e) => setFallback(e.target.value)} rows={2} placeholder="Fora do horário" />
                    <button className="btn-small btn-primary" onClick={handleSave} style={{ marginTop: '8px', width: '100%' }}>Salvar</button>
                </div>
            ) : (
                <div className="nodrag">
                    <p className="node-text">
                        <strong>Aberto:</strong> {start} - {end}<br />
                        <span style={{ fontSize: 11, color: '#666' }}>Se fechado: {fallback || '(Sem msg)'}</span>
                    </p>
                </div>
            )}
        </BaseNode>
    );
};

export default BusinessHoursNode;
