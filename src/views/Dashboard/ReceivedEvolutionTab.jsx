import React, { useState, useEffect, useRef } from 'react';
import { Trash2, RefreshCw, Clock, Download, Paperclip, Mic, Send, AlertCircle, X, Image as ImageIcon } from 'lucide-react';

export function ReceivedEvolutionTab({
    user,
    config,
    addToast,
    isRefreshing: parentIsRefreshing,
    messages: globalMessages,
    fetchMessages: globalFetchMessages
}) {
    // Sync with global messages if provided, otherwise fallback to local fetch
    const [messages, setMessages] = useState(globalMessages || []);

    useEffect(() => {
        if (globalMessages) setMessages(globalMessages);
    }, [globalMessages]);

    const [activeContact, setActiveContact] = useState(null);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);
    const [selectedContacts, setSelectedContacts] = useState([]);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [isUploadingMedia, setIsUploadingMedia] = useState(false);
    const [isRecording, setIsRecording] = useState(false);
    const [recordingTime, setRecordingTime] = useState(0);
    const fileInputRef = useRef(null);
    const recordingInterval = useRef(null);
    const [mediaRecorder, setMediaRecorder] = useState(null);

    const fetchMessages = async () => {
        if (globalFetchMessages) {
            return globalFetchMessages();
        }
        // Fallback local fetch
        setIsRefreshing(true);
        try {
            const res = await fetch(`/api/evolution/messages/${user.id}`, {
                headers: { 'Authorization': `Bearer ${user.token}` }
            });
            if (res.ok) {
                const data = await res.json();
                setMessages(data);
            }
        } catch (err) {
            console.error('Error fetching evolution messages:', err);
            addToast('Erro ao carregar mensagens Evolution', 'error');
        } finally {
            setIsRefreshing(false);
        }
    };

    useEffect(() => {
        fetchMessages();
        const interval = setInterval(fetchMessages, 10000); // Poll every 10s
        return () => clearInterval(interval);
    }, []);

    const normalize = p => String(p || '').replace(/\D/g, '');

    const groups = {};
    messages.forEach(m => {
        const key = normalize(m.contactPhone);
        if (!groups[key]) groups[key] = [];
        groups[key].push(m);
    });

    const contactKeys = Object.keys(groups);

    const handleSendMessage = async (e) => {
        e.preventDefault();
        const text = e.target.reply.value;
        if (!text || !activeContact) return;

        try {
            const res = await fetch('/api/evolution/send-message', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${user.token}`
                },
                body: JSON.stringify({
                    phone: activeContact,
                    message: text
                })
            });
            if (res.ok) {
                e.target.reply.value = '';
                addToast('Mensagem enviada!', 'success');
                fetchMessages();
            } else {
                addToast('Erro ao enviar resposta via Evolution.', 'error');
            }
        } catch (err) {
            addToast('Erro de conexão.', 'error');
        }
    };

    const handleMediaUpload = async (e) => {
        const files = Array.from(e.target.files);
        if (files.length === 0 || !activeContact) return;

        setIsUploadingMedia(true);
        try {
            for (const file of files) {
                const formData = new FormData();
                formData.append('file', file);

                // Use existing upload endpoint (assuming it returns a public URL)
                const uploadRes = await fetch('/api/upload-media', {
                    method: 'POST',
                    headers: { 'Authorization': `Bearer ${user.token}` },
                    body: formData
                });

                if (uploadRes.ok) {
                    const uploadData = await uploadRes.json();

                    // Send via Evolution
                    await fetch('/api/evolution/send-message', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${user.token}`
                        },
                        body: JSON.stringify({
                            phone: activeContact,
                            mediaUrl: uploadData.url,
                            mediaType: uploadData.type === 'image' ? 'image' :
                                uploadData.type === 'audio' ? 'audio' :
                                    uploadData.type === 'video' ? 'video' : 'document'
                        })
                    });
                }
            }
            addToast('Mídia enviada!', 'success');
            fetchMessages();
        } catch (err) {
            addToast('Erro ao enviar mídia.', 'error');
        } finally {
            setIsUploadingMedia(false);
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    const handleDeleteConversations = async () => {
        if (selectedContacts.length === 0) return;

        try {
            const res = await fetch('/api/evolution/messages/delete', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${user.token}`
                },
                body: JSON.stringify({ phones: selectedContacts })
            });

            if (res.ok) {
                addToast('Conversas excluídas!', 'success');
                setIsDeleting(false);
                setSelectedContacts([]);
                fetchMessages();
                if (selectedContacts.includes(normalize(activeContact))) {
                    setActiveContact(null);
                }
            }
        } catch (err) {
            addToast('Erro ao excluir conversas.', 'error');
        }
        setShowDeleteConfirm(false);
    };

    return (
        <div className="card fade-in" style={{ backgroundColor: 'white', padding: '2.5rem', borderRadius: '16px', boxShadow: '0 4px 20px rgba(0,0,0,0.05)' }}>
            <div className="received-container" style={{ display: 'flex', gap: '24px', height: 'calc(100vh - 320px)' }}>
                {/* Contact List */}
                <div style={{ width: '320px', flexShrink: 0, display: 'flex', flexDirection: 'column', padding: '1.5rem', backgroundColor: 'white', borderRadius: '16px', boxShadow: '0 4px 12px rgba(0,0,0,0.08)', borderTop: '4px solid #00a276' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                            <h3 style={{ color: '#00a276', margin: 0 }}>Evolution</h3>
                            {config?.evolutionWebhookToken && (
                                <div style={{ fontSize: '10px', color: '#999', display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer' }}
                                    onClick={() => {
                                        navigator.clipboard.writeText(`${window.location.origin}/api/evolution/webhook/${config.evolutionWebhookToken}`);
                                        addToast('URL do Webhook copiada!', 'success');
                                    }}
                                    title="URL única deste usuário"
                                >
                                    <Radio size={10} color="#00a276" /> Webhook: {config.evolutionWebhookToken.slice(0, 8)}...
                                </div>
                            )}
                        </div>
                        <div style={{ display: 'flex', gap: '8px' }}>
                            <button
                                onClick={() => {
                                    if (isDeleting && selectedContacts.length > 0) {
                                        setShowDeleteConfirm(true);
                                    } else {
                                        setIsDeleting(!isDeleting);
                                        setSelectedContacts([]);
                                    }
                                }}
                                style={{ padding: '4px', border: 'none', background: 'none', cursor: 'pointer', color: isDeleting ? 'red' : '#999' }}
                            >
                                <Trash2 size={18} />
                            </button>
                            <button
                                className={isRefreshing ? 'animate-spin' : ''}
                                onClick={fetchMessages}
                                style={{ padding: '4px', border: 'none', background: 'none', cursor: 'pointer', color: '#00a276' }}
                            >
                                <RefreshCw size={18} />
                            </button>
                        </div>
                    </div>

                    <div style={{ flex: 1, overflowY: 'auto', marginTop: '1rem' }}>
                        {contactKeys.map(phoneKey => {
                            const contactMsgs = groups[phoneKey];
                            const lastMsg = [...contactMsgs].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))[0];
                            const contactName = lastMsg.pushName || lastMsg.contactName || phoneKey;
                            const hasUnread = contactMsgs.some(m => !m.isFromMe && !m.isRead);
                            const isSelected = normalize(activeContact) === phoneKey;

                            return (
                                <div
                                    key={phoneKey}
                                    onClick={() => {
                                        setActiveContact(lastMsg.contactPhone);
                                        // Mark as read locally
                                        setMessages(prev => prev.map(m =>
                                            normalize(m.contactPhone) === phoneKey ? { ...m, isRead: true } : m
                                        ));
                                        // Mark as read on server
                                        fetch('/api/evolution/messages/mark-read', {
                                            method: 'POST',
                                            headers: {
                                                'Content-Type': 'application/json',
                                                'Authorization': `Bearer ${user.token}`
                                            },
                                            body: JSON.stringify({ phone: lastMsg.contactPhone })
                                        }).catch(console.error);
                                    }}
                                    style={{
                                        padding: '12px',
                                        borderRadius: '12px',
                                        cursor: 'pointer',
                                        marginBottom: '8px',
                                        border: isSelected ? '2px solid #00a276' : '1px solid #eee',
                                        backgroundColor: isSelected ? '#e8f5e9' : 'white',
                                        transition: 'all 0.2s'
                                    }}
                                >
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                        {isDeleting && (
                                            <input
                                                type="checkbox"
                                                checked={selectedContacts.includes(phoneKey)}
                                                onClick={(e) => e.stopPropagation()}
                                                onChange={() => {
                                                    setSelectedContacts(prev =>
                                                        prev.includes(phoneKey) ? prev.filter(p => p !== phoneKey) : [...prev, phoneKey]
                                                    );
                                                }}
                                            />
                                        )}
                                        <div style={{ flex: 1, minWidth: 0 }}>
                                            <div style={{ fontWeight: 700, fontSize: '0.9rem', color: '#333', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                {contactName}
                                            </div>
                                            <div style={{ fontSize: '0.75rem', color: '#999', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                <Clock size={10} />
                                                {new Date(lastMsg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                            </div>
                                        </div>
                                        {hasUnread && <div style={{ width: '8px', height: '8px', background: '#00a276', borderRadius: '50%' }}></div>}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* Chat View */}
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: '#f8f9fa', borderRadius: '16px', overflow: 'hidden' }}>
                    {activeContact ? (
                        <>
                            <header style={{ padding: '1rem', background: 'white', borderBottom: '1px solid #eee', display: 'flex', alignItems: 'center', gap: '12px' }}>
                                <div style={{ width: '40px', height: '40px', borderRadius: '50%', overflow: 'hidden', background: '#eee' }}>
                                    <img
                                        src={`/api/evolution/contact/${activeContact}/photo`}
                                        alt=""
                                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                        onError={(e) => { e.target.src = 'https://ui-avatars.com/api/?name=' + activeContact; }}
                                    />
                                </div>
                                <div>
                                    <div style={{ fontWeight: 700 }}>{activeContact}</div>
                                    <div style={{ fontSize: '0.75rem', color: '#00a276' }}>Conectado via Evolution</div>
                                </div>
                            </header>

                            <div style={{ flex: 1, overflowY: 'auto', padding: '1.5rem', display: 'flex', flexDirection: 'column-reverse' }}>
                                {[...messages]
                                    .filter(m => normalize(m.contactPhone) === normalize(activeContact))
                                    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
                                    .map(msg => (
                                        <div key={msg.id} style={{
                                            alignSelf: msg.isFromMe ? 'flex-end' : 'flex-start',
                                            backgroundColor: msg.isFromMe ? '#00a276' : 'white',
                                            color: msg.isFromMe ? 'white' : '#333',
                                            padding: '10px 14px',
                                            borderRadius: '12px',
                                            maxWidth: '70%',
                                            marginBottom: '10px',
                                            boxShadow: '0 2px 5px rgba(0,0,0,0.05)',
                                            fontSize: '0.9rem'
                                        }}>
                                            {msg.mediaUrl ? (
                                                <div style={{ marginBottom: '4px' }}>
                                                    {msg.mediaType === 'image' ? (
                                                        <img src={msg.mediaUrl} alt="" style={{ maxWidth: '100%', borderRadius: '8px', display: 'block' }} onClick={() => window.open(msg.mediaUrl, '_blank')} />
                                                    ) : msg.mediaType === 'audio' ? (
                                                        <audio controls src={msg.mediaUrl} style={{ maxWidth: '100%' }} />
                                                    ) : (
                                                        <a href={msg.mediaUrl} target="_blank" rel="noopener noreferrer" style={{ color: 'inherit', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                            <Download size={16} /> {msg.mediaType || 'Arquivo'}
                                                        </a>
                                                    )}
                                                    {msg.messageBody && msg.messageBody !== `[${msg.mediaType?.toUpperCase()}]` && (
                                                        <div style={{ marginTop: '8px' }}>{msg.messageBody}</div>
                                                    )}
                                                </div>
                                            ) : (
                                                msg.messageBody
                                            )}
                                            <div style={{ fontSize: '0.65rem', opacity: 0.6, textAlign: 'right', marginTop: '4px' }}>
                                                {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                            </div>
                                        </div>
                                    ))
                                }
                            </div>

                            <form
                                onSubmit={handleSendMessage}
                                style={{ padding: '1rem', background: 'white', borderTop: '1px solid #eee', display: 'flex', gap: '10px', alignItems: 'center' }}
                            >
                                <input type="file" ref={fileInputRef} multiple style={{ display: 'none' }} onChange={handleMediaUpload} />
                                <button type="button" onClick={() => fileInputRef.current?.click()} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#666' }}>
                                    {isUploadingMedia ? <RefreshCw className="animate-spin" size={20} /> : <Paperclip size={20} />}
                                </button>
                                <input
                                    name="reply"
                                    placeholder="Digite sua mensagem via Evolution..."
                                    style={{ flex: 1, padding: '10px 16px', borderRadius: '24px', border: '1px solid #ddd', outline: 'none' }}
                                />
                                <button type="submit" style={{ width: '40px', height: '40px', borderRadius: '50%', background: '#00a276', color: 'white', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                    <Send size={18} />
                                </button>
                            </form>
                        </>
                    ) : (
                        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#999' }}>
                            <ImageIcon size={64} strokeWidth={1} style={{ marginBottom: '1rem', opacity: 0.3 }} />
                            <p>Selecione uma conversa do Evolution</p>
                        </div>
                    )}
                </div>
            </div>

            {/* Delete Confirm Modal */}
            {showDeleteConfirm && (
                <div className="modal-overlay">
                    <div className="modal-content">
                        <h3>Excluir Conversas?</h3>
                        <p>Deseja realmente excluir as {selectedContacts.length} conversas selecionadas do Evolution?</p>
                        <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
                            <button className="btn-secondary" onClick={() => setShowDeleteConfirm(false)}>Cancelar</button>
                            <button className="btn-primary" style={{ background: 'red' }} onClick={handleDeleteConversations}>Excluir</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default ReceivedEvolutionTab;
