import React, { useState, useEffect } from 'react';
import { Users, Search, Edit3, Shield, Check, X, RefreshCw, GitBranch, Send } from 'lucide-react';

export default function SystemUsersTab({ user, addToast }) {
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [editingUser, setEditingUser] = useState(null);
    const [statsModalOpen, setStatsModalOpen] = useState(false);
    const [selectedStatsUser, setSelectedStatsUser] = useState(null);

    // Initial Fetch
    useEffect(() => {
        fetchUsers();
    }, []);

    const fetchUsers = async () => {
        try {
            const res = await fetch('/api/admin/users', {
                headers: { 'Authorization': `Bearer ${user.token}` }
            });
            if (res.ok) {
                setUsers(await res.json());
            } else {
                addToast('Erro ao carregar usuários', 'error');
            }
        } catch (err) {
            console.error(err);
            addToast('Erro de conexão', 'error');
        } finally {
            setLoading(false);
        }
    };

    const handleSaveUser = async (e) => {
        e.preventDefault();
        try {
            const res = await fetch(`/api/admin/users/${editingUser.id}/plan`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${user.token}` },
                body: JSON.stringify({
                    planType: editingUser.planType,
                    subscriptionStatus: editingUser.subscriptionStatus,
                    trialDays: editingUser.addTrialDays
                })
            });
            if (res.ok) {
                addToast('Usuário atualizado!', 'success');
                setEditingUser(null);
                fetchUsers();
            } else {
                addToast('Erro ao atualizar.', 'error');
            }
        } catch (err) {
            console.error(err);
        }
    };

    const filteredUsers = (users || []).filter(u =>
        u.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        u.email?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="card fade-in">
            <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', marginBottom: '30px' }}>
                <div style={{ position: 'relative' }}>
                    <Search size={18} style={{ position: 'absolute', left: 12, top: 12, color: '#999' }} />
                    <input
                        type="text"
                        placeholder="Buscar usuário..."
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                        style={{ padding: '10px 10px 10px 38px', borderRadius: '8px', border: '1px solid #ddd', width: '250px' }}
                    />
                </div>
            </div>

            {loading ? (
                <div style={{ textAlign: 'center', padding: '40px' }}><RefreshCw className="spinning" /> Carregando...</div>
            ) : (
                <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                            <tr style={{ borderBottom: '2px solid #eee', textAlign: 'left', color: '#666', fontSize: '0.9rem' }}>
                                <th style={{ padding: '15px' }}>Usuário</th>
                                <th style={{ padding: '15px' }}>Plano</th>
                                <th style={{ padding: '15px' }}>Status</th>
                                <th style={{ padding: '15px' }}>Trial / Validade</th>
                                <th style={{ padding: '15px' }}>Métricas</th>
                                <th style={{ padding: '15px' }}>Envios</th>
                                <th style={{ padding: '15px', textAlign: 'right' }}>Ações</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredUsers.map(u => (
                                <tr key={u.id} style={{ borderBottom: '1px solid #f5f5f5' }}>
                                    <td style={{ padding: '15px' }}>
                                        <div style={{ fontWeight: 600, color: '#333' }}>{u.name}</div>
                                        <div style={{ fontSize: '0.8rem', color: '#888' }}>{u.email}</div>
                                    </td>
                                    <td style={{ padding: '15px' }}>
                                        <span style={{
                                            padding: '4px 8px', borderRadius: '4px', fontSize: '0.8rem', fontWeight: 700,
                                            background: (u.planType || 'free') === 'free' ? '#e8f5e9' : '#e3f2fd',
                                            color: (u.planType || 'free') === 'free' ? '#2e7d32' : '#1565c0'
                                        }}>
                                            {(u.planType || 'free').toUpperCase()}
                                        </span>
                                    </td>
                                    <td style={{ padding: '15px' }}>
                                        {u.planType === 'paid' ? (
                                            <span style={{ color: u.subscriptionStatus === 'active' ? 'green' : 'red', fontWeight: 600 }}>
                                                {u.subscriptionStatus === 'active' ? 'ATIVO' : 'BLOQUEADO'}
                                            </span>
                                        ) : '-'}
                                    </td>
                                    <td style={{ padding: '15px', fontSize: '0.9rem' }}>
                                        {(() => {
                                            const now = new Date();
                                            const trialDate = u.trialExpiresAt ? new Date(u.trialExpiresAt) : null;
                                            const subDate = u.subscriptionExpiresAt ? new Date(u.subscriptionExpiresAt) : null;

                                            // Priority: Active subscription
                                            if (u.subscriptionStatus === 'active' && subDate && subDate > now) {
                                                const days = Math.ceil((subDate - now) / (1000 * 60 * 60 * 24));
                                                return <span style={{ color: '#2e7d32', fontWeight: 600 }}>Assinatura: {days} dias</span>;
                                            }

                                            // Trial check
                                            if (trialDate && trialDate > now) {
                                                const days = Math.ceil((trialDate - now) / (1000 * 60 * 60 * 24));
                                                return <span style={{ color: '#1565c0' }}>Trial: {days} dias</span>;
                                            }

                                            return <span style={{ color: '#d32f2f', fontWeight: 600 }}>Expirado / Bloqueado</span>;
                                        })()}
                                    </td>
                                    <td style={{ padding: '15px' }}>
                                        <div style={{ display: 'flex', gap: '8px', fontSize: '0.8rem', alignItems: 'center' }}>
                                            <span title="Automações" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><Shield size={12} /> {u.metrics?.automations || 0}</span>
                                            <span title="Fluxos" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><GitBranch size={12} /> {u.metrics?.flows || 0}</span>
                                            <span title="Disparos" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><Send size={12} /> {u.metrics?.dispatches || 0}</span>
                                        </div>
                                    </td>
                                    <td style={{ padding: '15px' }}>
                                        <button
                                            className="btn-secondary"
                                            onClick={() => { setSelectedStatsUser(u); setStatsModalOpen(true); }}
                                            style={{ padding: '6px 10px', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '5px' }}
                                        >
                                            <Send size={14} /> Ver Envios
                                        </button>
                                    </td>
                                    <td style={{ padding: '15px', textAlign: 'right' }}>
                                        <button
                                            className="btn-secondary"
                                            onClick={() => setEditingUser(u)}
                                            style={{ padding: '6px' }}
                                        >
                                            <Edit3 size={16} />
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )
            }
            {
                editingUser && (
                    <div className="modal-overlay" style={{ zIndex: 10000 }}>
                        <div className="modal-content" style={{ width: '400px' }}>
                            <h3>Editar Usuário: {editingUser.name}</h3>
                            <form onSubmit={handleSaveUser}>
                                <div className="input-group mb-4">
                                    <label>Tipo de Plano</label>
                                    <select
                                        value={editingUser.planType}
                                        onChange={e => setEditingUser({ ...editingUser, planType: e.target.value })}
                                        style={{ width: '100%', padding: '10px' }}
                                    >
                                        <option value="free">FREE (Grátis para sempre)</option>
                                        <option value="paid">PAGANTE (Requer assinatura)</option>
                                    </select>
                                </div>

                                {editingUser.planType === 'paid' && (
                                    <>
                                        <div className="input-group mb-4">
                                            <label>Status da Assinatura</label>
                                            <select
                                                value={editingUser.subscriptionStatus}
                                                onChange={e => setEditingUser({ ...editingUser, subscriptionStatus: e.target.value })}
                                                style={{ width: '100%', padding: '10px' }}
                                            >
                                                <option value="active">Ativo (Pago)</option>
                                                <option value="expired">Expirado / Bloqueado</option>
                                            </select>
                                        </div>
                                        <div className="input-group mb-4">
                                            <label>Adicionar Dias de Trial</label>
                                            <input
                                                type="number"
                                                placeholder="Ex: 7"
                                                onChange={e => setEditingUser({ ...editingUser, addTrialDays: e.target.value })}
                                                style={{ width: '100%', padding: '10px' }}
                                            />
                                            <p style={{ fontSize: '0.8rem', color: '#666' }}>Deixe vazio para não alterar.</p>
                                        </div>
                                    </>
                                )}

                                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                                    <button type="button" className="btn-secondary" onClick={() => setEditingUser(null)}>Cancelar</button>
                                    <button type="submit" className="btn-primary">Salvar Alterações</button>
                                </div>
                            </form>
                        </div>
                    </div>
                )
            }
            <SendStatsModal
                isOpen={statsModalOpen}
                onClose={() => setStatsModalOpen(false)}
                user={selectedStatsUser}
                token={user.token}
                addToast={addToast}
            />
        </div >
    );
}

function SendStatsModal({ isOpen, onClose, user, token, addToast }) {
    const [year, setYear] = useState(new Date().getFullYear());
    const [stats, setStats] = useState([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (isOpen && user) {
            fetchStats();
        }
    }, [isOpen, user, year]);

    const fetchStats = async () => {
        setLoading(true);
        try {
            const res = await fetch(`/api/admin/users/${user.id}/stats?year=${year}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (res.ok) {
                const data = await res.json();
                setStats(data.stats);
            } else {
                addToast('Erro ao carregar estatísticas', 'error');
            }
        } catch (err) {
            console.error(err);
            addToast('Erro de conexão', 'error');
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen) return null;

    const currentYear = new Date().getFullYear();
    const years = Array.from({ length: 5 }, (_, i) => currentYear - i);

    return (
        <div className="modal-overlay" style={{ zIndex: 10001 }}>
            <div className="modal-content" style={{ width: '500px', maxWidth: '90%' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                    <h3>Estatísticas de Envio: {user?.name}</h3>
                    <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X size={24} /></button>
                </div>

                <div style={{ marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <label style={{ fontWeight: 600 }}>Filtrar por Ano:</label>
                    <select
                        value={year}
                        onChange={(e) => setYear(parseInt(e.target.value))}
                        style={{ padding: '8px', borderRadius: '4px', border: '1px solid #ddd' }}
                    >
                        {years.map(y => (
                            <option key={y} value={y}>{y}</option>
                        ))}
                    </select>
                </div>

                {loading ? (
                    <div style={{ textAlign: 'center', padding: '40px' }}><RefreshCw className="spinning" /> Carregando dados...</div>
                ) : (
                    <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '10px' }}>
                        <thead>
                            <tr style={{ background: '#f9fafb', borderBottom: '2px solid #eee' }}>
                                <th style={{ padding: '12px', textAlign: 'left', color: '#6b7280' }}>Canal de Envio</th>
                                <th style={{ padding: '12px', textAlign: 'right', color: '#6b7280' }}>Quantidade</th>
                            </tr>
                        </thead>
                        <tbody>
                            {stats.map(stat => (
                                <tr key={stat.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                                    <td style={{ padding: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: stat.color }}></span>
                                        {stat.name}
                                    </td>
                                    <td style={{ padding: '12px', textAlign: 'right', fontWeight: 600, fontSize: '1.1rem' }}>
                                        {stat.count.toLocaleString()}
                                    </td>
                                </tr>
                            ))}
                            <tr style={{ background: '#f0fdf4', fontWeight: 700 }}>
                                <td style={{ padding: '12px', color: '#166534' }}>TOTAL</td>
                                <td style={{ padding: '12px', textAlign: 'right', color: '#166534' }}>
                                    {stats.reduce((acc, curr) => acc + curr.count, 0).toLocaleString()}
                                </td>
                            </tr>
                        </tbody>
                    </table>
                )}

                <div style={{ marginTop: '20px', textAlign: 'right' }}>
                    <button className="btn-primary" onClick={onClose}>Fechar</button>
                </div>
            </div>
        </div>
    );
}
