import React, { useState, useRef } from 'react';
import { Trash2, RefreshCw, Clock, Download, Paperclip, Mic, Send, AlertCircle, X, Wifi } from 'lucide-react';

export function ReceivedEvolutionTab({
    user,
    config,
    messages = [],
    isRefreshing,
    fetchMessages,
    addToast
}) {
    const [activeContact, setActiveContact] = useState(null);
    const [isDeleting, setIsDeleting] = useState(false);
    const [selectedContacts, setSelectedContacts] = useState([]);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [showProfileModal, setShowProfileModal] = useState(null);
    const [isUploadingMedia, setIsUploadingMedia] = useState(false);
    const fileInputRef = useRef(null);

    const normalize = p => {
        let s = String(p || '').replace(/\D/g, '');
        if (s.startsWith('55') && s.length === 12) {
            return s.slice(0, 4) + '9' + s.slice(4);
        }
        return s;
    };

    // Group messages by contact
    const groups = {};
    messages.forEach(m => {
        const key = normalize(m.contactPhone);
        if (!groups[key]) groups[key] = [];
        groups[key].push(m);
    });

    const contactKeys = Object.keys(groups).sort((a, b) => {
        const lastA = [...groups[a]].sort((x, y) => new Date(y.createdAt) - new Date(x.createdAt))[0];
        const lastB = [...groups[b]].sort((x, y) => new Date(y.createdAt) - new Date(x.createdAt))[0];
        return new Date(lastB.createdAt) - new Date(lastA.createdAt);
    });

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
                    body: text
                })
            });

            if (res.ok) {
                e.target.reply.value = '';
                addToast('Mensagem enviada via Evolution!', 'success');
                fetchMessages();
            } else {
                addToast('Erro ao enviar mensagem.', 'error');
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

                const uploadRes = await fetch('/api/upload-media', {
                    method: 'POST',
                    headers: { 'Authorization': `Bearer ${user.token}` },
                    body: formData
                });

                if (uploadRes.ok) {
                    const data = await uploadRes.json();
                    await fetch('/api/evolution/send-message', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${user.token}`
                        },
                        body: JSON.stringify({
                            phone: activeContact,
                            mediaUrl: data.url,
                            mediaType: data.type
                        })
                    });
                }
            }
            addToast('Mídias enviadas!', 'success');
            fetchMessages();
        } catch (err) {
            addToast('Erro ao enviar mídias.', 'error');
        } finally {
            setIsUploadingMedia(false);
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    return (
        <div className="card fade-in" style={{ backgroundColor: 'white', padding: '2.5rem', borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-sm)' }}>
            <div className="received-container" style={{ display: 'flex', gap: '24px', height: 'calc(100vh - 320px)' }}>
                {/* Contact List Sidebar - Matched with ReceivedTab */}
                <div style={{ width: '320px', flexShrink: 0, display: 'flex', flexDirection: 'column', padding: '1.5rem', backgroundColor: 'white', borderRadius: 'var(--radius-lg)', boxShadow: '0 4px 12px rgba(0,0,0,0.08)', borderTop: '4px solid #00a276' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <h3>Contatos</h3>
                        <div style={{ display: 'flex', gap: '8px' }}>
                            <button
                                onClick={() => setIsDeleting(!isDeleting)}
                                title={isDeleting ? "Cancelar Exclusão" : "Excluir Conversas"}
                                style={{ padding: '4px', border: 'none', background: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: isDeleting ? 'red' : '#999' }}
                            >
                                <Trash2 size={18} />
                            </button>
                            <button
                                className={`refresh-btn ${isRefreshing ? 'spinning' : ''}`}
                                onClick={fetchMessages}
                                title="Atualizar mensagens"
                                disabled={isRefreshing}
                                style={{ padding: '4px', border: 'none', background: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#00a276' }}
                            >
                                <RefreshCw size={18} />
                            </button>
                        </div>
                    </div>

                    <div className="contact-list" style={{ flex: 1, overflowY: 'auto', marginTop: '1rem' }}>
                        {contactKeys.map(phoneKey => {
                            const contactMsgs = groups[phoneKey];
                            const sortedMsgs = [...contactMsgs].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
                            const lastMsg = sortedMsgs[0];

                            // Robust name labeling logic
                            const nonMeMsg = sortedMsgs.find(m => !m.isFromMe);
                            const contactName = nonMeMsg?.pushName || nonMeMsg?.contactName || lastMsg.pushName || lastMsg.contactName || phoneKey;

                            const hasUnread = contactMsgs.some(m => !m.isFromMe && !m.isRead);
                            const isSelected = normalize(activeContact) === phoneKey;

                            return (
                                <div
                                    key={phoneKey}
                                    className={`contact-item ${isSelected ? 'active' : ''}`}
                                    onClick={() => {
                                        setActiveContact(lastMsg.contactPhone);
                                        // Simple local mark as read
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
                                        borderRadius: '8px',
                                        cursor: 'pointer',
                                        marginBottom: '8px',
                                        border: isSelected ? '2px solid #00a276' : '1px solid #eee',
                                        backgroundColor: isSelected ? '#f0fff4' : 'white',
                                        width: '100%',
                                        boxSizing: 'border-box',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '10px'
                                    }}
                                >
                                    <div
                                        style={{
                                            width: '40px',
                                            height: '40px',
                                            borderRadius: '50%',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            backgroundColor: isSelected ? '#00a276' : '#e8f5e9',
                                            color: isSelected ? 'white' : '#00a276',
                                            fontWeight: 700,
                                            flexShrink: 0,
                                            overflow: 'hidden'
                                        }}
                                    >
                                        {(() => {
                                            const photo = lastMsg.profilePicUrl || contactMsgs.find(m => m.profilePicUrl)?.profilePicUrl;
                                            if (photo && photo.startsWith('http')) {
                                                return <img src={photo} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />;
                                            }
                                            const initials = contactName
                                                .split(' ')
                                                .map(n => n[0])
                                                .join('')
                                                .slice(0, 2)
                                                .toUpperCase();
                                            return initials || '?';
                                        })()}
                                    </div>
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
                                        <div style={{ fontWeight: 700, fontSize: '0.9rem', color: isSelected ? '#006d50' : '#333', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                            {contactName}
                                        </div>
                                        <div style={{ fontSize: '0.75rem', color: '#999', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                            <Clock size={10} />
                                            {new Date(lastMsg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                        </div>
                                    </div>
                                    {hasUnread && <span className="unread-dot" style={{ backgroundColor: '#00a276', width: '8px', height: '8px', borderRadius: '50%' }}></span>}
                                </div>
                            );
                        })}
                        {contactKeys.length === 0 && <p style={{ textAlign: 'center', color: '#999', marginTop: '2rem' }}>Nenhuma conversa.</p>}
                    </div>
                </div>

                {/* Chat View - Matched with ReceivedTab */}
                <div className="card ambev-flag chat-view" style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '0', backgroundColor: '#f9fafb', borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
                    {activeContact ? (
                        <>
                            <header style={{ padding: '1rem', borderBottom: '1px solid #eee', display: 'flex', alignItems: 'center', backgroundColor: 'white' }}>
                                <div
                                    className="profile-avatar"
                                    onClick={() => {
                                        const cMsgs = groups[normalize(activeContact)] || [];
                                        const nonMe = cMsgs.find(m => !m.isFromMe);
                                        const name = nonMe?.pushName || nonMe?.contactName || activeContact;
                                        setShowProfileModal({ name, phone: activeContact });
                                    }}
                                    style={{ cursor: 'pointer', marginRight: '12px', width: '40px', height: '40px', borderRadius: '50%', backgroundColor: '#00a276', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, overflow: 'hidden' }}
                                >
                                    {(() => {
                                        const cMsgs = groups[normalize(activeContact)] || [];
                                        const withPhoto = cMsgs.find(m => m.profilePicUrl)?.profilePicUrl;
                                        if (withPhoto && withPhoto.startsWith('http')) {
                                            return <img src={withPhoto} alt="Avatar" style={{ width: '40px', height: '40px', objectFit: 'cover' }} />;
                                        }
                                        const name = cMsgs.find(m => !m.isFromMe)?.pushName || activeContact;
                                        return name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase() || '?';
                                    })()}
                                </div>
                                <div style={{ flex: 1 }}>
                                    <div style={{ fontWeight: 700, color: '#00a276' }}>
                                        {(() => {
                                            const cMsgs = groups[normalize(activeContact)] || [];
                                            const nonMe = cMsgs.find(m => !m.isFromMe);
                                            return nonMe?.pushName || nonMe?.contactName || activeContact;
                                        })()}
                                    </div>
                                    <div style={{ fontSize: '0.8rem', color: '#666' }}>{activeContact} (Evolution)</div>
                                </div>
                            </header>

                            <div className="chat-messages" style={{ flex: 1, overflowY: 'auto', padding: '1.5rem', display: 'flex', flexDirection: 'column-reverse' }}>
                                {messages
                                    .filter(m => normalize(m.contactPhone) === normalize(activeContact))
                                    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
                                    .map(msg => (
                                        <div key={msg.id} style={{
                                            alignSelf: msg.isFromMe ? 'flex-end' : 'flex-start',
                                            backgroundColor: msg.isFromMe ? '#00a276' : 'white',
                                            color: msg.isFromMe ? 'white' : '#333',
                                            padding: '10px 14px',
                                            borderRadius: '12px',
                                            maxWidth: '75%',
                                            marginBottom: '10px',
                                            boxShadow: '0 2px 5px rgba(0,0,0,0.05)',
                                            fontSize: '0.9rem',
                                            position: 'relative'
                                        }}>
                                            {msg.mediaUrl ? (
                                                <div style={{ marginBottom: '4px' }}>
                                                    {msg.mediaType === 'image' ? (
                                                        <img src={msg.mediaUrl} alt="" style={{ maxWidth: '100%', borderRadius: '8px', display: 'block', cursor: 'pointer' }} onClick={() => window.open(msg.mediaUrl, '_blank')} />
                                                    ) : msg.mediaType === 'audio' ? (
                                                        <audio controls src={msg.mediaUrl} style={{ maxWidth: '100%' }} />
                                                    ) : msg.mediaType === 'video' ? (
                                                        <video controls src={msg.mediaUrl} style={{ maxWidth: '100%', borderRadius: '8px' }} />
                                                    ) : (
                                                        <a href={msg.mediaUrl} target="_blank" rel="noopener noreferrer" download style={{ color: 'inherit', display: 'flex', alignItems: 'center', gap: '6px', textDecoration: 'underline' }}>
                                                            <Download size={16} /> {msg.mediaType === 'document' ? 'Documento (PDF)' : (msg.mediaType || 'Arquivo')}
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
                                <button type="submit" style={{ backgroundColor: '#00a276', color: 'white', border: 'none', borderRadius: '50%', width: '40px', height: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                                    <Send size={20} />
                                </button>
                            </form>
                        </>
                    ) : (
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#999', flexDirection: 'column' }}>
                            <Wifi size={48} strokeWidth={1} style={{ marginBottom: '1rem', opacity: 0.3 }} />
                            Selecione um contato Evolution para iniciar
                        </div>
                    )}
                </div>
            </div>

            {/* Profile Modal */}
            {showProfileModal && (
                <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000 }}>
                    <div style={{ position: 'relative', maxWidth: '90vw', maxHeight: '90vh' }}>
                        <button onClick={() => setShowProfileModal(null)} style={{ position: 'absolute', top: '-40px', right: '0', background: 'none', border: 'none', color: 'white', cursor: 'pointer' }}>
                            <X size={32} />
                        </button>
                        <img
                            src={(() => {
                                const cMsgs = groups[normalize(showProfileModal.phone)] || [];
                                return cMsgs.find(m => m.profilePicUrl)?.profilePicUrl || `/api/evolution/contact/${showProfileModal.phone}/photo?name=${encodeURIComponent(showProfileModal.name)}`;
                            })()}
                            alt="Profile"
                            style={{ maxWidth: '100%', maxHeight: '80vh', borderRadius: '8px' }}
                        />
                    </div>
                </div>
            )}
        </div>
    );
}

export default ReceivedEvolutionTab;
