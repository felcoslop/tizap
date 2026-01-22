import React, { useState, useEffect } from 'react';
import { X, Check, AlertCircle, RefreshCw } from 'lucide-react';

export function LogModal({ dispatch, onClose }) {
    const [logs, setLogs] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchLogs = async () => {
            const token = localStorage.getItem('tizap_token');
            try {
                const res = await fetch(`/api/dispatch/${dispatch.userId}/${dispatch.id}`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                if (res.ok) {
                    const data = await res.json();
                    setLogs(data.logs || []);
                }
            } catch (err) {
                console.error('Error fetching logs:', err);
            } finally {
                setLoading(false);
            }
        };
        fetchLogs();
    }, [dispatch]);

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '900px', width: '95%', maxHeight: '90vh', display: 'flex', flexDirection: 'column', padding: '2rem' }}>
                <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', borderBottom: '2px solid #f0f2f5', paddingBottom: '1rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                        <div style={{ width: '12px', height: '12px', borderRadius: '50%', backgroundColor: dispatch.status === 'running' ? 'var(--ambev-green)' : '#ddd' }}></div>
                        <h2 style={{ margin: 0, color: 'var(--ambev-blue)', fontSize: '1.5rem', fontWeight: 800 }}>Logs do Disparo #{dispatch.id}</h2>
                    </div>
                    <button className="btn-icon" onClick={onClose} style={{ padding: '8px', borderRadius: '50%', background: '#f5f5f5' }}><X size={24} /></button>
                </header>

                <div style={{ overflowY: 'auto', flex: 1, paddingRight: '10px' }}>
                    {loading ? (
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '40px' }}>
                            <div className="spinner" style={{ width: '40px', height: '40px', border: '4px solid #f3f3f3', borderTop: '4px solid var(--ambev-blue)', borderRadius: '50%', animation: 'spin 1s linear infinite' }}></div>
                            <p style={{ marginTop: '15px', color: '#666' }}>Carregando histórico de execuções...</p>
                        </div>
                    ) : (
                        <table className="preview-table" style={{ width: '100%' }}>
                            <thead style={{ position: 'sticky', top: 0, backgroundColor: 'white', zIndex: 10 }}>
                                <tr>
                                    <th style={{ textAlign: 'left', padding: '12px' }}>Destinatário / Telefone</th>
                                    <th style={{ textAlign: 'center', padding: '12px' }}>Status</th>
                                    <th style={{ textAlign: 'left', padding: '12px' }}>Resultado / Mensagem</th>
                                    <th style={{ textAlign: 'right', padding: '12px' }}>Data/Hora</th>
                                </tr>
                            </thead>
                            <tbody>
                                {logs.map(log => (
                                    <tr key={log.id} style={{ borderBottom: '1px solid #f0f2f5' }}>
                                        <td style={{ padding: '12px', fontWeight: 600 }}>{log.phone}</td>
                                        <td style={{ padding: '12px', textAlign: 'center' }}>
                                            <span style={{
                                                padding: '4px 8px',
                                                borderRadius: '4px',
                                                fontSize: '10px',
                                                fontWeight: 700,
                                                textTransform: 'uppercase',
                                                backgroundColor: log.status === 'success' || log.status === 'sent_message' || log.status === 'sent_email' ? '#e8f5e9' : '#ffebee',
                                                color: log.status === 'success' || log.status === 'sent_message' || log.status === 'sent_email' ? '#388e3c' : '#d32f2f',
                                                display: 'inline-flex',
                                                alignItems: 'center',
                                                gap: '4px'
                                            }}>
                                                {(log.status === 'success' || log.status === 'sent_message' || log.status === 'sent_email') ? <Check size={10} /> : <AlertCircle size={10} />}
                                                {(log.status === 'success' || log.status === 'sent_message' || log.status === 'sent_email') ? 'Concluído' : 'Erro'}
                                            </span>
                                        </td>
                                        <td style={{ padding: '12px', fontSize: '0.85rem', color: '#444' }}>{log.message || '-'}</td>
                                        <td style={{ padding: '12px', textAlign: 'right', fontSize: '0.75rem', color: '#888', whiteSpace: 'nowrap' }}>
                                            {new Date(log.createdAt).toLocaleString()}
                                        </td>
                                    </tr>
                                ))}
                                {logs.length === 0 && (
                                    <tr>
                                        <td colSpan="4" style={{ textAlign: 'center', padding: '40px', color: '#999' }}>Nenhum log disponível para esta campanha.</td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    )}
                </div>

                <footer style={{ marginTop: '1.5rem', display: 'flex', justifyContent: 'flex-end' }}>
                    <button className="btn-secondary" onClick={onClose} style={{ padding: '10px 24px', borderRadius: '8px', fontWeight: 600 }}>Fechar Detalhes</button>
                </footer>
            </div>
            <style>{`
                @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
            `}</style>
        </div>
    );
}

export default LogModal;
