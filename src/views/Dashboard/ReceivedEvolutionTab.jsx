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

    // Audio Recording State
    const [isRecording, setIsRecording] = useState(false);
    const [recordingTime, setRecordingTime] = useState(0);
    const [mediaRecorder, setMediaRecorder] = useState(null);
    const [audioStream, setAudioStream] = useState(null);
    const recordingInterval = useRef(null);

    // Cleanup interval on unmount
    React.useEffect(() => {
        return () => {
            if (recordingInterval.current) clearInterval(recordingInterval.current);
            if (audioStream) audioStream.getTracks().forEach(track => track.stop());
        };
    }, [audioStream]);

    const startRecording = async () => {
        try {
            if (typeof window.MicRecorder === 'undefined') {
                return addToast('Gravador não carregado. Recarregue a página.', 'error');
            }

            const recorder = new window.MicRecorder({ bitRate: 128 });

            await recorder.start();
            setMediaRecorder(recorder);
            setIsRecording(true);
            setRecordingTime(0);
            recordingInterval.current = setInterval(() => {
                setRecordingTime(prev => prev + 1);
            }, 1000);
        } catch (err) {
            console.error('Mic Error:', err);
            addToast('Erro ao acessar microfone.', 'error');
        }
    };

    const stopRecording = () => {
        if (!mediaRecorder) return;

        mediaRecorder.stop().getMp3().then(async ([buffer, blob]) => {
            const file = new File([blob], `evorec-${Date.now()}.mp3`, { type: 'audio/mpeg' });

            setIsUploadingMedia(true);
            try {
                const formData = new FormData();
                formData.append('file', file);
                const uploadRes = await fetch('/api/upload-media', {
                    method: 'POST',
                    headers: { 'Authorization': `Bearer ${user.token}` },
                    body: formData
                });

                if (uploadRes.ok) {
                    const data = await uploadRes.json();
                    // Send via Evolution API
                    await fetch('/api/evolution/send-message', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${user.token}`
                        },
                        body: JSON.stringify({
                            phone: activeContact,
                            mediaUrl: data.url,
                            mediaType: 'audio'
                        })
                    });
                    addToast('Áudio enviado via Evolution!', 'success');
                    fetchMessages();
                } else {
                    addToast('Erro ao enviar áudio.', 'error');
                }
            } catch (err) {
                console.error('Send Audio Error:', err);
                addToast('Erro ao processar envio.', 'error');
            } finally {
                setIsUploadingMedia(false);
            }
        }).catch((e) => {
            console.error('Stop Recording Error:', e);
            addToast('Erro ao gravar áudio.', 'error');
        });

        clearInterval(recordingInterval.current);
        setIsRecording(false);
        setMediaRecorder(null);
        setAudioStream(null);
    };

    const cancelRecording = () => {
        if (mediaRecorder) {
            mediaRecorder.stop();
        }
        clearInterval(recordingInterval.current);
        setIsRecording(false);
        setMediaRecorder(null);
        setAudioStream(null);
        setRecordingTime(0);
        addToast('Gravação cancelada.', 'info');
    };

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
                            const foundName = nonMeMsg?.pushName || nonMeMsg?.contactName || lastMsg.pushName || lastMsg.contactName;
                            const contactName = foundName && foundName !== 'Eu' ? foundName : lastMsg.contactPhone;

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
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            const photo = lastMsg.profilePicUrl || contactMsgs.find(m => m.profilePicUrl)?.profilePicUrl;
                                            setShowProfileModal({
                                                name: contactName,
                                                phone: lastMsg.contactPhone,
                                                photo: photo
                                            });
                                        }}
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
                                            overflow: 'hidden',
                                            cursor: 'pointer'
                                        }}
                                    >
                                        {(() => {
                                            const photo = lastMsg.profilePicUrl || contactMsgs.find(m => m.profilePicUrl)?.profilePicUrl;
                                            const photoUrl = (photo && photo.startsWith('http'))
                                                ? photo
                                                : `/api/evolution/public/contact/${user.id}/${lastMsg.contactPhone}/photo?name=${encodeURIComponent(contactName)}`;

                                            return <img
                                                src={photoUrl}
                                                alt=""
                                                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                                onError={(e) => {
                                                    e.target.onerror = null;
                                                    const initials = contactName.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase() || '?';
                                                    e.target.parentElement.innerHTML = `<div style="width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; background-color: #00a276; color: white;">${initials}</div>`;
                                                }}
                                            />;
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
                                            {new Date(lastMsg.createdAt).toLocaleString([], { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' })}
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
                                        const nonMe = cMsgs.find(m => !m.isFromMe);
                                        const name = nonMe?.pushName || nonMe?.contactName || activeContact;
                                        const photo = cMsgs.find(m => m.profilePicUrl)?.profilePicUrl;

                                        const photoUrl = (photo && photo.startsWith('http'))
                                            ? photo
                                            : `/api/evolution/public/contact/${user.id}/${activeContact}/photo?name=${encodeURIComponent(name)}`;

                                        return <img
                                            src={photoUrl}
                                            alt="Avatar"
                                            style={{ width: '40px', height: '40px', objectFit: 'cover' }}
                                            onError={(e) => {
                                                e.target.onerror = null;
                                                const initials = name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase() || '?';
                                                e.target.parentElement.innerHTML = initials;
                                            }}
                                        />;
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
                                                        <img
                                                            src={msg.mediaUrl}
                                                            alt=""
                                                            style={{ width: '240px', height: '240px', objectFit: 'cover', borderRadius: '8px', display: 'block', cursor: 'pointer' }}
                                                            onClick={() => window.open(msg.mediaUrl, '_blank')}
                                                        />
                                                    ) : msg.mediaType === 'audio' ? (
                                                        <audio controls src={msg.mediaUrl} style={{ maxWidth: '100%' }} />
                                                    ) : msg.mediaType === 'video' ? (
                                                        <video controls src={msg.mediaUrl} style={{ maxWidth: '100%', borderRadius: '8px' }} />
                                                    ) : (
                                                        <a href={msg.mediaUrl} target="_blank" rel="noopener noreferrer" download style={{ color: 'inherit', display: 'flex', alignItems: 'center', gap: '6px', textDecoration: 'underline' }}>
                                                            <Download size={16} /> {msg.mediaType === 'document' ? 'Documento' : (msg.mediaType || 'Arquivo')}
                                                        </a>
                                                    )}
                                                    {msg.messageBody && msg.messageBody !== `[${msg.mediaType?.toUpperCase()}]` && (
                                                        <div style={{ marginTop: '8px', whiteSpace: 'pre-wrap' }}>{msg.messageBody}</div>
                                                    )}
                                                </div>
                                            ) : (
                                                <div style={{ whiteSpace: 'pre-wrap' }}>{msg.messageBody}</div>
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

                                {!isRecording ? (
                                    <>
                                        <button type="button" onClick={() => fileInputRef.current?.click()} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#666' }}>
                                            {isUploadingMedia ? <RefreshCw className="animate-spin" size={20} /> : <Paperclip size={20} />}
                                        </button>
                                        <input
                                            name="reply"
                                            placeholder="Digite sua mensagem via Evolution..."
                                            style={{ flex: 1, padding: '10px 16px', borderRadius: '24px', border: '1px solid #ddd', outline: 'none' }}
                                        />
                                        <button
                                            type="button"
                                            onClick={startRecording}
                                            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#666', padding: '8px' }}
                                        >
                                            <Mic size={20} />
                                        </button>
                                        <button type="submit" style={{ backgroundColor: '#00a276', color: 'white', border: 'none', borderRadius: '50%', width: '40px', height: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                                            <Send size={20} />
                                        </button>
                                    </>
                                ) : (
                                    <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '15px', padding: '5px 15px', backgroundColor: '#f0f2f5', borderRadius: '24px' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#e02424' }}>
                                            <div className="pulse-red" style={{ width: '10px', height: '10px', backgroundColor: '#e02424', borderRadius: '50%' }}></div>
                                            <span style={{ fontWeight: 600, minWidth: '40px' }}>
                                                {Math.floor(recordingTime / 60)}:{String(recordingTime % 60).padStart(2, '0')}
                                            </span>
                                        </div>
                                        <div style={{ flex: 1, color: '#666', fontSize: '0.9rem' }}>Gravando áudio...</div>
                                        <button
                                            type="button"
                                            onClick={cancelRecording}
                                            style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#666' }}
                                            title="Cancelar"
                                        >
                                            <X size={20} />
                                        </button>
                                        <button
                                            type="button"
                                            onClick={stopRecording}
                                            style={{
                                                backgroundColor: '#e02424',
                                                color: 'white',
                                                border: 'none',
                                                borderRadius: '50%',
                                                width: '32px',
                                                height: '32px',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                cursor: 'pointer'
                                            }}
                                            title="Parar e Enviar"
                                        >
                                            <div style={{ width: '12px', height: '12px', backgroundColor: 'white', borderRadius: '2px' }}></div>
                                        </button>
                                    </div>
                                )}
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
                <div
                    style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000, padding: '20px' }}
                    onClick={() => setShowProfileModal(null)}
                >
                    <div
                        style={{ position: 'relative', width: 'min(500px, 90vw)', aspectRatio: '1/1', backgroundColor: '#fff', borderRadius: '12px', overflow: 'hidden', boxShadow: '0 20px 50px rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                        onClick={(e) => e.stopPropagation()}
                    >
                        <button
                            onClick={() => setShowProfileModal(null)}
                            style={{ position: 'absolute', top: '15px', right: '15px', background: 'rgba(255,255,255,0.8)', border: 'none', color: '#333', cursor: 'pointer', zIndex: 10, borderRadius: '50%', width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 5px rgba(0,0,0,0.1)' }}
                        >
                            <X size={20} />
                        </button>

                        {(() => {
                            const photo = showProfileModal.photo;
                            const fallbackUrl = `/api/evolution/public/contact/${user.id}/${showProfileModal.phone}/photo?name=${encodeURIComponent(showProfileModal.name)}`;

                            return (
                                <img
                                    src={photo && photo.startsWith('http') ? photo : fallbackUrl}
                                    alt="Profile"
                                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                    onError={(e) => {
                                        // If Evolution API photo fails, show initials
                                        e.target.onerror = null;
                                        const initials = showProfileModal.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase() || '?';
                                        const parent = e.target.parentElement;
                                        parent.innerHTML = `
                                            <div style="width: 100%; height: 100%; display: flex; alignItems: center; justifyContent: center; backgroundColor: #00a276; color: white; fontSize: 120px; fontWeight: 700; fontFamily: Arial">
                                                ${initials}
                                            </div>
                                        `;
                                    }}
                                />
                            );
                        })()}
                    </div>
                </div>
            )}
        </div>
    );
}

export default ReceivedEvolutionTab;
