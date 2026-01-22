import React, { useState, useEffect } from 'react';
import { RefreshCw, Check, AlertCircle, Send, Clock, Download, XCircle, FileText, ChevronDown, ChevronRight, CheckCircle2, Eye } from 'lucide-react';
import Pagination from '../../components/Pagination';

export function FlowSessionsHistory({ user, addToast }) {
    const [sessions, setSessions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [expandedSession, setExpandedSession] = useState(null);
    const [sessionLogs, setSessionLogs] = useState([]);
    const [loadingLogs, setLoadingLogs] = useState(false);
    const [currentPage, setCurrentPage] = useState(1);
    const [stoppingSession, setStoppingSession] = useState(null);
    const [showStopConfirm, setShowStopConfirm] = useState(false);
    const rowsPerPage = 10;

    const fetchSessions = async () => {
        try {
            const res = await fetch(`/api/flow-sessions/${user.id}`, {
                headers: { 'Authorization': `Bearer ${user.token}` }
            });
            if (res.ok) {
                const data = await res.json();
                setSessions(data);
            }
        } catch (err) {
            console.error('Error fetching flow sessions:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (user?.id) fetchSessions();
    }, [user?.id]);

    const stopFlowSession = async (sessionId) => {
        try {
            const res = await fetch(`/api/flow-sessions/${sessionId}/stop`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${user.token}` }
            });
            if (res.ok) {
                addToast('Fluxo interrompido', 'success');
            } else {
                addToast('Erro ao interromper fluxo no servidor', 'error');
            }
            setStoppingSession(null);
            fetchSessions();
        } catch (err) {
            console.error(err);
            addToast('Erro ao interromper fluxo', 'error');
        }
    };

    const totalPages = Math.ceil(sessions.length / rowsPerPage);
    const paginatedSessions = sessions.slice((currentPage - 1) * rowsPerPage, currentPage * rowsPerPage);

    const toggleLogs = async (sessionId) => {
        if (expandedSession === sessionId) {
            setExpandedSession(null);
            setSessionLogs([]);
            return;
        }

        setExpandedSession(sessionId);
        setLoadingLogs(true);
        try {
            const res = await fetch(`/api/flow-session-logs/${sessionId}`, {
                headers: { 'Authorization': `Bearer ${user.token}` }
            });
            if (res.ok) {
                const data = await res.json();
                setSessionLogs(data);
            }
        } catch (err) {
            console.error('Error fetching logs:', err);
        } finally {
            setLoadingLogs(false);
        }
    };

    const getStatusBadge = (status) => {
        const colors = {
            'active': { bg: '#e3f2fd', color: '#1976d2', label: 'Ativo' },
            'waiting_reply': { bg: '#fff3e0', color: '#f57c00', label: 'Aguardando' },
            'completed': { bg: '#e8f5e9', color: '#388e3c', label: 'Concluído' },
            'error': { bg: '#ffebee', color: '#d32f2f', label: 'Erro' },
            'stopped': { bg: '#f5f5f5', color: '#9e9e9e', label: 'Interrompido' }
        };
        const style = colors[status] || { bg: '#f5f5f5', color: '#666', label: status };
        return (
            <span style={{
                padding: '4px 10px',
                borderRadius: '6px',
                fontSize: '11px',
                fontWeight: 700,
                backgroundColor: style.bg,
                color: style.color,
                textTransform: 'uppercase',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px'
            }}>
                {status === 'active' && <RefreshCw size={10} className="spinning" />}
                {status === 'completed' && <Check size={10} />}
                {status === 'error' && <AlertCircle size={10} />}
                {style.label}
            </span>
        );
    };

    const getActionIcon = (action) => {
        switch (action) {
            case 'sent_message': return <Send size={14} style={{ color: '#007bff' }} />;
            case 'waiting_reply': return <Clock size={14} style={{ color: '#f57c00' }} />;
            case 'received_reply': return <Download size={14} style={{ color: '#00a276' }} />;
            case 'invalid_reply': return <XCircle size={14} style={{ color: '#ff5555' }} />;
            case 'completed': return <CheckCircle2 size={14} style={{ color: '#388e3c' }} />;
            case 'error': return <AlertCircle size={14} style={{ color: '#d32f2f' }} />;
            default: return <FileText size={14} />;
        }
    };

    const getActionLabel = (action) => {
        switch (action) {
            case 'sent_message': return 'Mensagem enviada';
            case 'waiting_reply': return 'Aguardando resposta';
            case 'received_reply': return 'Resposta recebida';
            case 'invalid_reply': return 'Resposta inválida';
            case 'completed': return 'Fluxo concluído';
            case 'error': return 'Erro';
            case 'stopped': return 'Fluxo interrompido';
            default: return action;
        }
    };

    const hasActiveSessions = sessions.some(s => s.status === 'active' || s.status === 'waiting_reply');

    return (
        <div className="card ambev-flag" style={{ width: '100%', backgroundColor: 'white', padding: '1.5rem', position: 'relative' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                <h3 style={{ display: 'flex', alignItems: 'center', gap: '12px', color: 'var(--ambev-blue)', fontSize: '1.5rem', fontWeight: 800, margin: 0 }}>
                    <FileText size={28} color="var(--ambev-blue)" /> Sessões de Fluxo
                </h3>
                <button
                    onClick={() => hasActiveSessions && setShowStopConfirm(true)}
                    className={hasActiveSessions ? "btn-primary" : ""}
                    disabled={!hasActiveSessions}
                    style={{
                        backgroundColor: hasActiveSessions ? '#d32f2f' : '#ccc',
                        color: 'white',
                        border: 'none',
                        padding: '8px 16px',
                        borderRadius: '6px',
                        fontWeight: 600,
                        cursor: hasActiveSessions ? 'pointer' : 'not-allowed',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        transition: 'all 0.2s',
                        boxShadow: hasActiveSessions ? '0 2px 5px rgba(211, 47, 47, 0.3)' : 'none',
                        opacity: hasActiveSessions ? 1 : 0.7
                    }}
                >
                    <XCircle size={16} /> Parar Tudo (Emergência)
                </button>
            </div>

            {showStopConfirm && (
                <div className="modal-overlay" style={{ zIndex: 10000 }}>
                    <div className="modal-content alert" style={{ textAlign: 'center' }}>
                        <div style={{ marginBottom: '20px' }}>
                            <div style={{ background: '#ffebee', width: '60px', height: '60px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 15px' }}>
                                <AlertCircle size={30} color="#d32f2f" />
                            </div>
                            <h3 style={{ fontSize: '1.5rem', color: '#d32f2f', marginBottom: '10px' }}>Parada de Emergência</h3>
                            <p style={{ color: '#666', fontSize: '1rem', lineHeight: '1.5' }}>
                                Tem certeza que deseja <strong>interromper todos os fluxos</strong> em andamento?
                                <br />
                                <span style={{ fontSize: '0.9rem', color: '#888' }}>Essa ação não pode ser desfeita.</span>
                            </p>
                        </div>
                        <div style={{ display: 'flex', gap: '15px', justifyContent: 'center' }}>
                            <button
                                className="btn-secondary"
                                style={{ width: '120px', padding: '10px' }}
                                onClick={() => setShowStopConfirm(false)}
                            >
                                Cancelar
                            </button>
                            <button
                                style={{
                                    width: '180px',
                                    padding: '10px',
                                    backgroundColor: '#d32f2f',
                                    color: 'white',
                                    border: 'none',
                                    borderRadius: '8px',
                                    fontWeight: 'bold',
                                    cursor: 'pointer',
                                    boxShadow: '0 4px 6px rgba(211, 47, 47, 0.3)'
                                }}
                                onClick={async () => {
                                    try {
                                        const res = await fetch(`/api/flow-sessions/stop-all/${user.id}`, {
                                            method: 'POST',
                                            headers: { 'Authorization': `Bearer ${user.token}` }
                                        });

                                        if (res.ok) {
                                            await res.json();
                                            addToast('Todos os fluxos foram interrompidos.', 'success');
                                            fetchSessions();
                                        } else {
                                            addToast('Erro ao parar tudo.', 'error');
                                        }
                                    } catch (e) {
                                        console.error(e);
                                        addToast('Erro de conexão.', 'error');
                                    } finally {
                                        setShowStopConfirm(false);
                                    }
                                }}
                            >
                                Confirmar Parada
                            </button>
                        </div>
                    </div>
                </div>
            )}
            {loading ? (
                <p style={{ color: '#999', textAlign: 'center', padding: '20px' }}>Carregando...</p>
            ) : sessions.length === 0 ? (
                <p style={{ color: '#999', textAlign: 'center', padding: '20px' }}>Nenhuma sessão de fluxo encontrada.</p>
            ) : (
                <>
                    <div style={{ overflowX: 'auto' }}>
                        <table className="preview-table">
                            <thead>
                                <tr>
                                    <th style={{ width: '40px' }}></th>
                                    <th>ID Fluxo</th>
                                    <th>Telefone</th>
                                    <th>Fluxo</th>
                                    <th>Mensagem Atual</th>
                                    <th>Status</th>
                                    <th>Última Atualização</th>
                                    <th>Ações</th>
                                </tr>
                            </thead>
                            <tbody>
                                {paginatedSessions.map(s => (
                                    <React.Fragment key={s.id}>
                                        <tr
                                            style={{ cursor: 'pointer', backgroundColor: expandedSession === s.id ? '#f5f5f5' : 'transparent' }}
                                            onClick={() => toggleLogs(s.id)}
                                        >
                                            <td style={{ textAlign: 'center' }}>{expandedSession === s.id ? <ChevronDown size={16} /> : <ChevronRight size={16} />}</td>
                                            <td style={{ fontSize: '0.8rem', color: '#666' }}>{s.flowId}</td>
                                            <td style={{ fontFamily: 'monospace' }}>{s.contactPhone}</td>
                                            <td><strong>{s.flowName}</strong></td>
                                            <td style={{ maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={s.currentStepName}>
                                                {s.currentStepName}
                                            </td>
                                            <td>{getStatusBadge(s.status)}</td>
                                            <td style={{ fontSize: '0.8rem' }}>{new Date(s.updatedAt).toLocaleString('pt-BR')}</td>
                                            <td>
                                                {(() => {
                                                    const canCancel = (s.status === 'active' || s.status === 'waiting_reply');
                                                    return (
                                                        <div style={{ display: 'flex', gap: '8px' }}>
                                                            <button
                                                                className="btn-icon"
                                                                onClick={(e) => { e.stopPropagation(); toggleLogs(s.id); }}
                                                                title="Ver Logs"
                                                                style={{ color: 'var(--ambev-blue)', border: 'none', background: 'transparent', cursor: 'pointer', padding: '6px' }}
                                                            >
                                                                <Eye size={18} />
                                                            </button>
                                                            <button
                                                                disabled={!canCancel}
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    if (canCancel && confirm('Deseja cancelar esta sessão?')) {
                                                                        stopFlowSession(s.id);
                                                                    }
                                                                }}
                                                                style={{
                                                                    backgroundColor: 'transparent',
                                                                    border: canCancel ? '1px solid #d32f2f' : '1px solid #ccc',
                                                                    color: canCancel ? 'd32f2f' : '#ccc',
                                                                    borderRadius: '4px',
                                                                    fontSize: '11px',
                                                                    fontWeight: 600,
                                                                    padding: '4px 10px',
                                                                    cursor: canCancel ? 'pointer' : 'not-allowed',
                                                                    transition: 'all 0.2s',
                                                                    opacity: canCancel ? 1 : 0.6
                                                                }}
                                                                onMouseOver={(e) => { if (canCancel) e.target.style.backgroundColor = '#ffebee'; }}
                                                                onMouseOut={(e) => { if (canCancel) e.target.style.backgroundColor = 'transparent'; }}
                                                            >
                                                                Cancelar
                                                            </button>
                                                        </div>
                                                    );
                                                })()}
                                            </td>
                                        </tr>
                                        {expandedSession === s.id && (
                                            <tr>
                                                <td colSpan="8" style={{ padding: 0, backgroundColor: '#fafafa' }}>
                                                    <div style={{ padding: '12px 24px', borderLeft: '4px solid #280091' }}>
                                                        <strong style={{ fontSize: '12px', color: '#666' }}>Histórico de Ações:</strong>
                                                        {loadingLogs ? (
                                                            <p style={{ margin: '8px 0', color: '#999' }}>Carregando logs...</p>
                                                        ) : sessionLogs.length === 0 ? (
                                                            <p style={{ margin: '8px 0', color: '#999' }}>Nenhum log encontrado.</p>
                                                        ) : (
                                                            <div style={{ marginTop: '8px', maxHeight: '200px', overflowY: 'auto' }}>
                                                                {sessionLogs.map(log => (
                                                                    <div key={log.id} style={{
                                                                        display: 'flex',
                                                                        alignItems: 'flex-start',
                                                                        gap: '10px',
                                                                        padding: '8px 0',
                                                                        borderBottom: '1px solid #eee'
                                                                    }}>
                                                                        <div style={{ marginTop: '2px' }}>{getActionIcon(log.action)}</div>
                                                                        <div>
                                                                            <div style={{ fontSize: '13px', fontWeight: 600 }}>{getActionLabel(log.action)}</div>
                                                                            {log.content && <div style={{ fontSize: '12px', color: '#555', marginTop: '2px' }}>{log.content}</div>}
                                                                            <div style={{ fontSize: '10px', color: '#999', marginTop: '2px' }}>{new Date(log.createdAt).toLocaleString('pt-BR')}</div>
                                                                        </div>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        )}
                                                    </div>
                                                </td>
                                            </tr>
                                        )}
                                    </React.Fragment>
                                ))}
                            </tbody>
                        </table>
                    </div>
                    <Pagination
                        currentPage={currentPage}
                        totalPages={totalPages}
                        onPageChange={setCurrentPage}
                    />
                </>
            )}
        </div>
    );
}

export default FlowSessionsHistory;
