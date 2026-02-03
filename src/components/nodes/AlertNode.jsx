import React, { useState } from 'react';
import { Bell } from 'lucide-react';
import BaseNode from './BaseNode';

const AlertNode = ({ data, id, selected }) => {
    const [isEditing, setIsEditing] = useState(false);
    const [phone, setPhone] = useState(data.phone || '');
    const [text, setText] = useState(data.text || '');

    const handleSave = () => {
        data.onChange(id, { phone, text });
        setIsEditing(false);
    };

    return (
        <BaseNode
            id={id}
            selected={selected}
            type="alert"
            title="Alerta Admin"
            icon={Bell}
            headerClass="alert-header"
            isEditing={isEditing}
            onEditToggle={() => setIsEditing(!isEditing)}
            onDelete={data.onDelete}
            showSource={true}
        >
            {isEditing ? (
                <div className="edit-mode nodrag">
                    <input
                        type="text"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        placeholder="Telefone (ex: 5511999999999)"
                    />
                    <textarea
                        value={text}
                        onChange={(e) => setText(e.target.value)}
                        rows={3}
                        placeholder="Texto do alerta..."
                    />
                    <button className="btn-small btn-primary" onClick={handleSave}>Salvar</button>
                </div>
            ) : (
                <p className="node-text">
                    <strong>Para:</strong> {data.phone || '(Não definido)'}<br />
                    {data.text || '(Sem mensagem)'}
                </p>
            )}
        </BaseNode>
    );
};

export default AlertNode;
