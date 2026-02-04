import React, { useState, useEffect } from 'react';
import { Mail, Edit3, Trash2 } from 'lucide-react';
import BaseNode from './BaseNode';

const EmailNode = ({ data, id, selected }) => {
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
            const userId = data.userId;
            const token = data.token;
            if (!userId || !token) return;

            const res = await fetch(`/api/email-templates/${userId}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (res.ok) setTemplates(await res.json());
        } catch (e) { console.error("Error fetching templates:", e); }
        finally { setLoading(false); }
    };

    const handleSave = () => {
        const t = templates.find(x => String(x.id) === String(templateId));
        data.onChange(id, {
            recipientEmail,
            templateId,
            templateName: t ? t.name : data.templateName
        });
        setIsEditing(false);
    };

    return (
        <BaseNode
            id={id}
            selected={selected}
            type="email"
            title="Enviar E-mail"
            icon={Mail}
            headerClass="email-header-node"
            isEditing={isEditing}
            onEditToggle={() => setIsEditing(!isEditing)}
            onDelete={data.onDelete}
            showSource={true}
        >
            {isEditing ? (
                <div className="edit-mode nodrag">
                    <label>Destinatário (opcional / variável):</label>
                    <input
                        type="text"
                        value={recipientEmail}
                        onChange={e => setRecipientEmail(e.target.value)}
                        placeholder="email@exemplo.com"
                    />

                    <label>Template:</label>
                    <select
                        value={templateId}
                        onChange={e => setTemplateId(e.target.value)}
                        style={{ width: '100%', marginBottom: '10px', padding: '6px', borderRadius: '4px', border: '1px solid #ddd' }}
                    >
                        <option value="">Selecione...</option>
                        {templates.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                    </select>

                    <button className="btn-small btn-primary" onClick={handleSave}>Salvar</button>
                </div>
            ) : (
                <div>
                    <p className="node-text"><b>Para:</b> {data.recipientEmail || '(Geral / Variável)'}</p>
                    <p className="node-text" style={{ fontSize: '11px', color: '#666', marginTop: '4px' }}>Template: {data.templateName || 'Não definido'}</p>
                </div>
            )}
        </BaseNode>
    );
};

export default EmailNode;
