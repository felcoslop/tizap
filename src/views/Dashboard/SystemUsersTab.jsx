import React, { useState, useEffect } from 'react';
import { Users, Search, Edit3, Shield, Check, X, RefreshCw } from 'lucide-react';

export default function SystemUsersTab({ user, addToast }) {
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [editingUser, setEditingUser] = useState(null);

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

    const filteredUsers = users.filter(u =>
        u.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        u.email?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="card fade-in" style={{ backgroundColor: 'white', padding: '2.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px' }}>
                <div>
                    <h2 style={{ fontSize: '1.8rem', color: '#280091', display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <Users /> Gestão de Usuários
                    </h2>
                    <p style={{ color: '#666' }}>Controle de licenças e métricas</p>
                </div>
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
                                            background: u.planType === 'free' ? '#e8f5e9' : '#e3f2fd',
                                            color: u.planType === 'free' ? '#2e7d32' : '#1565c0'
                                        }}>
                                            {u.planType.toUpperCase()}
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
                                        {u.trialExpiresAt ? (
                                            new Date(u.trialExpiresAt) > new Date() ?
                                                `Vence em ${Math.ceil((new Date(u.trialExpiresAt) - new Date()) / (1000 * 60 * 60 * 24))} dias` :
                                                <span style={{ color: 'red' }}>Expirado</span>
                                        ) : '-'}
                                    </td>
                                    <td style={{ padding: '15px' }}>
                                        <div style={{ display: 'flex', gap: '8px', fontSize: '0.8rem' }}>
                                            <span title="Automações">🤖 {u.metrics.automations}</span>
                                            <span title="Fluxos">⚡ {u.metrics.flows}</span>
                                        </div>
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
            )}

            {/* Edit User Modal */}
            {editingUser && (
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
            )}
        </div>
    );
}
