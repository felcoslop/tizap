import React, { useState, useEffect } from 'react';
import { X, Trash2, RefreshCw, AlertCircle } from 'lucide-react';

export function SessionManagerModal({ onClose, token, addToast }) {
    const [sessions, setSessions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [processing, setProcessing] = useState(false);

    const fetchSessions = async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/evolution/sessions', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (res.ok) {
                const data = await res.json();
                setSessions(data);
            } else {
                addToast('Erro ao carregar sessões.', 'error');
            }
        } catch (err) {
            console.error(err);
            addToast('Erro de conexão.', 'error');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchSessions();
    }, []);


    // Confirmation State
    const [confirmModal, setConfirmModal] = useState({ open: false, title: '', message: '', onConfirm: null });

    const handleCloseSession = (id) => {
        setConfirmModal({
            open: true,
            title: 'Finalizar Sessão',
            message: 'Tem certeza que deseja finalizar esta sessão? O cliente não receberá mais mensagens automáticas.',
            onConfirm: () => performCloseSession(id)
        });
    };

    const performCloseSession = async (id) => {
        setProcessing(true);
        try {
            const res = await fetch(`/api/evolution/sessions/${id}/close`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (res.ok) {
                addToast('Sessão finalizada.', 'success');
                setSessions(prev => prev.filter(s => s.id !== id));
            } else {
                addToast('Erro ao finalizar sessão.', 'error');
            }
        } catch (err) {
            addToast('Erro de conexão.', 'error');
        } finally {
            setProcessing(false);
            setConfirmModal({ open: false, title: '', message: '', onConfirm: null });
        }
    };

    const handleCloseAll = () => {
        setConfirmModal({
            open: true,
            title: 'Finalizar Todas as Sessões',
            message: `Tem certeza que deseja finalizar TODAS as ${sessions.length} sessões ativas? Isso interromperá todos os atendimentos automáticos.`,
            onConfirm: performCloseAll
        });
    };

    const performCloseAll = async () => {
        setProcessing(true);
        try {
            const res = await fetch('/api/evolution/sessions/close-all', {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (res.ok) {
                addToast('Todas as sessões foram finalizadas.', 'success');
                setSessions([]);
                onClose();
            } else {
                addToast('Erro ao finalizar sessões.', 'error');
            }
        } catch (err) {
            addToast('Erro de conexão.', 'error');
        } finally {
            setProcessing(false);
            setConfirmModal({ open: false, title: '', message: '', onConfirm: null });
        }
    };

    const formatDate = (dateStr) => {
        const date = new Date(dateStr);
        return date.toLocaleString('pt-BR');
    };

    // Calculate duration
    const getDuration = (startDate) => {
        const start = new Date(startDate);
        const now = new Date();
        const diffMs = now - start;
        const diffMins = Math.floor(diffMs / 60000);
        const diffHrs = Math.floor(diffMins / 60);

        if (diffHrs > 0) return `${diffHrs}h ${diffMins % 60}m`;
        return `${diffMins}m`;
    };

    return (
        <div className="modal-overlay" style={{ zIndex: 10000 }}>
            <div className="modal-content card fade-in" style={{ width: '800px', maxWidth: '95vw', maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}>

                {/* Header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', paddingBottom: '15px', borderBottom: '1px solid #eee' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div style={{ background: '#e6f4f1', padding: '8px', borderRadius: '8px', color: '#00a276' }}>
                            <RefreshCw size={24} />
                        </div>
                        <div>
                            <h2 style={{ margin: 0, fontSize: '1.25rem', color: '#333' }}>Gerenciar Sessões Ativas</h2>
                            <p style={{ margin: 0, fontSize: '0.85rem', color: '#666' }}>{sessions.length} sessões em andamento</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="btn-icon" style={{ color: '#999' }}>
                        <X size={24} />
                    </button>
                </div>

                {/* Content */}
                <div style={{ flex: 1, overflowY: 'auto', paddingRight: '5px' }}>
                    {loading ? (
                        <div style={{ display: 'flex', justifyContent: 'center', padding: '40px', color: '#666' }}>
                            <div className="spinner"></div>
                        </div>
                    ) : sessions.length === 0 ? (
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '60px 20px', color: '#666' }}>
                            <AlertCircle size={48} color="#ccc" style={{ marginBottom: '15px' }} />
                            <p style={{ fontSize: '1.1rem', fontWeight: 500 }}>Nenhuma sessão ativa encontrada.</p>
                            <p style={{ fontSize: '0.9rem' }}>Os clientes não estão em nenhum fluxo ou automação no momento.</p>
                        </div>
                    ) : (
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
                            <thead>
                                <tr style={{ background: '#f9fafb', color: '#666', textAlign: 'left' }}>
                                    <th style={{ padding: '12px 15px', borderRadius: '8px 0 0 8px' }}>Contato</th>
                                    <th style={{ padding: '12px 15px' }}>Origem</th>
                                    <th style={{ padding: '12px 15px' }}>Status</th>
                                    <th style={{ padding: '12px 15px' }}>Duração</th>
                                    <th style={{ padding: '12px 15px', textAlign: 'right', borderRadius: '0 8px 8px 0' }}>Ações</th>
                                </tr>
                            </thead>
                            <tbody>
                                {sessions.map(session => (
                                    <tr key={session.id} style={{ borderBottom: '1px solid #f0f0f0' }}>
                                        <td style={{ padding: '14px 15px', fontWeight: 500, color: '#333' }}>
                                            {session.contactPhone.replace(/(\d{2})(\d{2})(\d{4,5})(\d{4})/, '+$1 ($2) $3-$4')}
                                        </td>
                                        <td style={{ padding: '14px 15px' }}>
                                            <div style={{ display: 'flex', flexDirection: 'column' }}>
                                                <span style={{ fontWeight: 500, color: '#333' }}>{session.name}</span>
                                                <span style={{ fontSize: '0.75rem', color: '#888', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{session.type}</span>
                                            </div>
                                        </td>
                                        <td style={{ padding: '14px 15px' }}>
                                            <span style={{
                                                padding: '4px 10px',
                                                borderRadius: '20px',
                                                fontSize: '0.8rem',
                                                fontWeight: 600,
                                                background: session.status === 'active' ? '#e6f4f1' : '#fff7e6',
                                                color: session.status === 'active' ? '#00a276' : '#faad14'
                                            }}>
                                                {session.status === 'active' ? 'Ativo' : session.status === 'waiting_reply' ? 'Aguardando' : session.status}
                                            </span>
                                        </td>
                                        <td style={{ padding: '14px 15px', color: '#666' }}>
                                            {getDuration(session.createdAt)}
                                        </td>
                                        <td style={{ padding: '14px 15px', textAlign: 'right' }}>
                                            <button
                                                onClick={() => handleCloseSession(session.id)}
                                                disabled={processing}
                                                style={{
                                                    background: 'none',
                                                    border: '1px solid #fee2e2',
                                                    color: '#e02424',
                                                    borderRadius: '6px',
                                                    padding: '6px 10px',
                                                    cursor: 'pointer',
                                                    display: 'inline-flex',
                                                    alignItems: 'center',
                                                    gap: '5px',
                                                    fontSize: '0.8rem',
                                                    fontWeight: 600,
                                                    transition: 'all 0.2s'
                                                }}
                                                className="hover-danger"
                                            >
                                                Finalizar
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>

                {/* Footer */}
                <div style={{ marginTop: '20px', paddingTop: '15px', borderTop: '1px solid #eee', display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
                    <button className="btn-secondary" onClick={onClose} disabled={processing}>
                        Voltar
                    </button>
                    {sessions.length > 0 && (
                        <button
                            className="btn-primary"
                            onClick={handleCloseAll}
                            disabled={processing}
                            style={{ background: '#e02424', display: 'flex', alignItems: 'center', gap: '8px' }}
                        >
                            <Trash2 size={18} /> Finalizar Todas
                        </button>
                    )}
                </div>

                {/* Internal Confirmation Modal */}
                {confirmModal.open && (
                    <div className="modal-overlay" style={{ zIndex: 10010 }}>
                        <div className="modal-content card" style={{ maxWidth: '400px', width: '90%', padding: '24px', textAlign: 'center' }}>
                            <div style={{ background: '#fee2e2', width: '60px', height: '60px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
                                <Trash2 size={32} color="#dc2626" />
                            </div>
                            <h3 style={{ fontSize: '1.25rem', marginBottom: '10px', color: '#1f2937' }}>{confirmModal.title}</h3>
                            <p style={{ color: '#6b7280', marginBottom: '24px', lineHeight: '1.5' }}>
                                {confirmModal.message}
                            </p>
                            <div style={{ display: 'flex', justifyContent: 'center', gap: '12px' }}>
                                <button
                                    className="btn-secondary"
                                    onClick={() => setConfirmModal({ ...confirmModal, open: false })}
                                >
                                    Cancelar
                                </button>
                                <button
                                    className="btn-primary"
                                    style={{ background: '#dc2626', borderColor: '#dc2626' }}
                                    onClick={confirmModal.onConfirm}
                                >
                                    Sim, Finalizar
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

export default SessionManagerModal;
