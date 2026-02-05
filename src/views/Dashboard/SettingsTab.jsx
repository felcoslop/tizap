import { Eye, EyeOff, RefreshCw, Copy, LogOut, Radio, Wifi, WifiOff, X, QrCode } from 'lucide-react';
import { useState, useEffect, useRef } from 'react';

export function SettingsTab({
    user,
    config,
    tempConfig,
    setTempConfig,
    isEditing,
    setIsEditing,
    showToken,
    setShowToken,
    generateWebhook,
    saveConfig,
    addToast,
    onLogout,
    fetchUserData
}) {
    const [showEvolutionQR, setShowEvolutionQR] = useState(false);
    const [evolutionQR, setEvolutionQR] = useState(null);
    const [evolutionStatus, setEvolutionStatus] = useState('unknown');
    const [evolutionLoading, setEvolutionLoading] = useState(false);
    const [showEvolutionKey, setShowEvolutionKey] = useState(false);
    const qrPollRef = useRef(null);

    // Check Evolution connection status on mount and when config changes
    useEffect(() => {
        if (config?.evolutionApiUrl && config?.evolutionInstanceName) {
            checkEvolutionStatus();
        }
    }, [config?.evolutionApiUrl, config?.evolutionInstanceName]);

    // Cleanup QR polling on unmount
    useEffect(() => {
        return () => {
            if (qrPollRef.current) clearInterval(qrPollRef.current);
        };
    }, []);

    const checkEvolutionStatus = async () => {
        try {
            const res = await fetch(`/api/evolution/status/${user.id}`, {
                headers: { 'Authorization': `Bearer ${user.token}` }
            });
            if (res.ok) {
                const data = await res.json();
                setEvolutionStatus(data.connected ? 'connected' : 'disconnected');
            }
        } catch (err) {
            console.error('Error checking Evolution status:', err);
            setEvolutionStatus('error');
        }
    };

    const handleSetupEvolution = async () => {
        setEvolutionLoading(true);
        try {
            const res = await fetch('/api/evolution/instance', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${user.token}`
                }
            });

            const data = await res.json();
            if (res.ok) {
                if (fetchUserData) fetchUserData();
                addToast('Instância Evolution configurada!', 'success');
                // Open QR Code modal
                setShowEvolutionQR(true);
                fetchEvolutionQR();
            } else {
                addToast(data.error || 'Erro ao configurar Evolution', 'error');
            }
        } catch (err) {
            console.error('Evolution setup error:', err);
            addToast('Erro de conexão com Evolution', 'error');
        } finally {
            setEvolutionLoading(false);
        }
    };

    const fetchEvolutionQR = async () => {
        try {
            const res = await fetch(`/api/evolution/qr/${user.id}`, {
                headers: { 'Authorization': `Bearer ${user.token}` }
            });
            const data = await res.json();

            if (data.status === 'open') {
                // Already connected!
                setShowEvolutionQR(false);
                setEvolutionStatus('connected');
                addToast('Evolution conectada com sucesso!', 'success');
                if (qrPollRef.current) clearInterval(qrPollRef.current);
                return;
            }

            if (data.qrcode) {
                setEvolutionQR(data.qrcode);
            }

            // Start polling for connection status
            if (!qrPollRef.current) {
                qrPollRef.current = setInterval(async () => {
                    const statusRes = await fetch(`/api/evolution/status/${user.id}`, {
                        headers: { 'Authorization': `Bearer ${user.token}` }
                    });
                    const statusData = await statusRes.json();

                    if (statusData.connected) {
                        setShowEvolutionQR(false);
                        setEvolutionStatus('connected');
                        addToast('Evolution conectada com sucesso!', 'success');
                        clearInterval(qrPollRef.current);
                        qrPollRef.current = null;
                    }
                }, 3000);
            }
        } catch (err) {
            console.error('Error fetching QR:', err);
        }
    };

    const handleDisconnectEvolution = async () => {
        try {
            const res = await fetch(`/api/evolution/disconnect/${user.id}`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${user.token}` }
            });
            if (res.ok) {
                setEvolutionStatus('disconnected');
                addToast('Evolution desconectada', 'info');
            }
        } catch (err) {
            addToast('Erro ao desconectar', 'error');
        }
    };

    const handleEnableWebhook = async () => {
        setEvolutionLoading(true);
        try {
            const res = await fetch('/api/evolution/webhook/enable', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${user.token}`
                },
                body: JSON.stringify({
                    instanceName: config.evolutionInstanceName
                })
            });

            const data = await res.json();
            if (res.ok) {
                addToast(data.message || 'Webhook configurado com sucesso!', 'success');
            } else {
                addToast(data.error || 'Erro ao configurar webhook', 'error');
            }
        } catch (err) {
            console.error('Webhook enable error:', err);
            addToast('Erro de conexão ao configurar webhook', 'error');
        } finally {
            setEvolutionLoading(false);
        }
    };

    const closeQRModal = () => {
        setShowEvolutionQR(false);
        if (qrPollRef.current) {
            clearInterval(qrPollRef.current);
            qrPollRef.current = null;
        }
    };

    return (
        <div className="card fade-in" style={{ backgroundColor: 'white', padding: '2.5rem' }}>
            {/* Evolution QR Code Modal */}
            {showEvolutionQR && (
                <div className="modal-overlay" style={{ zIndex: 10000 }}>
                    <div className="modal-content" style={{ textAlign: 'center', maxWidth: '400px', padding: '2rem' }}>
                        <button
                            onClick={closeQRModal}
                            style={{ position: 'absolute', top: '15px', right: '15px', background: 'none', border: 'none', cursor: 'pointer' }}
                        >
                            <X size={24} color="#666" />
                        </button>

                        <div style={{ marginBottom: '20px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                            <Radio size={48} color="#00a276" style={{ marginBottom: '10px' }} />
                            <h3 style={{ fontSize: '1.5rem', color: 'var(--ambev-blue)', marginBottom: '10px', textAlign: 'center' }}>
                                Conectar Evolution
                            </h3>
                            <p style={{ color: '#666', fontSize: '0.9rem', textAlign: 'center' }}>
                                Escaneie o QR Code com seu WhatsApp
                            </p>
                        </div>

                        {evolutionQR ? (
                            <div style={{ background: 'white', padding: '20px', borderRadius: '16px', display: 'inline-block', boxShadow: '0 4px 20px rgba(0,0,0,0.1)' }}>
                                <img
                                    src={evolutionQR.startsWith('data:') ? evolutionQR : `data:image/png;base64,${evolutionQR}`}
                                    alt="Evolution QR Code"
                                    style={{ width: '250px', height: '250px' }}
                                />
                            </div>
                        ) : (
                            <div style={{ padding: '60px', color: '#999' }}>
                                <RefreshCw size={32} className="animate-spin" />
                                <p style={{ marginTop: '10px' }}>Carregando QR Code...</p>
                            </div>
                        )}

                        <p style={{ marginTop: '20px', fontSize: '0.85rem', color: '#888' }}>
                            Aguardando conexão...
                        </p>

                        <button
                            className="btn-secondary"
                            onClick={fetchEvolutionQR}
                            style={{ marginTop: '15px' }}
                        >
                            <RefreshCw size={16} style={{ marginRight: '8px' }} />
                            Atualizar QR Code
                        </button>
                    </div>
                </div>
            )}

            {/* Split layout for Meta and Evolution */}
            <div className="settings-grid" style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))',
                gap: '1.5rem',
                alignItems: 'start'
            }}>
                {/* Meta WhatsApp Credentials Section */}
                <div className="card ambev-flag" style={{ width: '100%', backgroundColor: 'white', padding: '1.5rem', boxSizing: 'border-box', height: '100%' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <h3 style={{ margin: 0 }}>Credenciais WhatsApp Meta</h3>
                        <button className="btn-secondary" onClick={() => setIsEditing(!isEditing)}>{isEditing ? 'Cancelar' : 'Editar'}</button>
                    </div>
                    <div className="input-grid mt-4">
                        <div className="input-group" style={{ gridColumn: 'span 2' }}>
                            <label>Token</label>
                            <div className="input-with-btn">
                                <input type={showToken ? "text" : "password"} value={isEditing ? tempConfig.token : config.token} onChange={e => setTempConfig({ ...tempConfig, token: e.target.value })} disabled={!isEditing} />
                                <button type="button" className="btn-secondary" onClick={() => setShowToken(!showToken)} style={{ padding: '0 12px' }}>
                                    {showToken ? <EyeOff size={18} /> : <Eye size={18} />}
                                </button>
                            </div>
                        </div>
                        <div className="input-group">
                            <label>Phone ID</label>
                            <input type="text" value={isEditing ? tempConfig.phoneId : config.phoneId} onChange={e => setTempConfig({ ...tempConfig, phoneId: e.target.value })} disabled={!isEditing} />
                        </div>
                        <div className="input-group">
                            <label>WABA ID</label>
                            <input type="text" value={isEditing ? tempConfig.wabaId : config.wabaId} onChange={e => setTempConfig({ ...tempConfig, wabaId: e.target.value })} disabled={!isEditing} />
                        </div>

                        <div style={{ gridColumn: 'span 2' }}>
                            <hr style={{ border: 'none', borderTop: '1px solid #eee', margin: '1rem 0' }} />
                        </div>

                        <div style={{ gridColumn: 'span 2', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                            <h4 style={{ margin: 0 }}>Webhook para o Meta</h4>
                            {isEditing && (
                                <button className="btn-secondary" onClick={generateWebhook} style={{ fontSize: '0.8rem', padding: '6px 12px' }}>
                                    <RefreshCw size={14} style={{ marginRight: '6px' }} /> Gerar Verify Token
                                </button>
                            )}
                        </div>

                        <div className="input-group" style={{ gridColumn: 'span 2' }}>
                            <label>Webhook URL (Configurações do App Meta)</label>
                            <div className="copy-input" style={{ display: 'flex', gap: '8px' }}>
                                <input
                                    type="text"
                                    value={config.webhookToken ? `${window.location.origin}/webhook/token/${config.webhookToken}` : 'Salve as configurações para gerar a URL'}
                                    readOnly
                                    style={{ flex: 1 }}
                                />
                                <button
                                    className="btn-icon"
                                    onClick={() => {
                                        if (config.webhookToken) {
                                            navigator.clipboard.writeText(`${window.location.origin}/webhook/token/${config.webhookToken}`);
                                            addToast('URL copiada!', 'info');
                                        }
                                    }}
                                    title="Copiar URL"
                                    disabled={!config.webhookToken}
                                >
                                    <Copy size={18} />
                                </button>
                            </div>
                        </div>

                        <div className="input-group mt-3" style={{ gridColumn: 'span 2' }}>
                            <label>Verify Token (Configurações do App Meta)</label>
                            <div className="copy-input" style={{ display: 'flex', gap: '8px' }}>
                                <div className="input-with-btn" style={{ flex: 1, display: 'flex' }}>
                                    <input
                                        type={showToken ? "text" : "password"}
                                        value={isEditing ? tempConfig.webhookVerifyToken : config.webhookVerifyToken}
                                        onChange={e => setTempConfig({ ...tempConfig, webhookVerifyToken: e.target.value })}
                                        readOnly={!isEditing}
                                        placeholder="Clique em Gerar ou digite um token"
                                        style={{ flex: 1 }}
                                    />
                                    <button type="button" className="btn-secondary" onClick={() => setShowToken(!showToken)} style={{ padding: '0 12px' }}>
                                        {showToken ? <EyeOff size={18} /> : <Eye size={18} />}
                                    </button>
                                </div>
                                <button
                                    className="btn-icon"
                                    onClick={() => {
                                        navigator.clipboard.writeText(isEditing ? tempConfig.webhookVerifyToken : config.webhookVerifyToken);
                                        addToast('Token copiado!', 'info');
                                    }}
                                    title="Copiar Token"
                                >
                                    <Copy size={18} />
                                </button>
                            </div>
                        </div>

                        {isEditing && (
                            <div style={{ gridColumn: 'span 2' }}>
                                <button className="btn-primary w-full mt-6" onClick={saveConfig}>Salvar Configurações</button>
                            </div>
                        )}
                    </div>
                </div>

                {/* Evolution API Section */}
                <div className="card" style={{ width: '100%', backgroundColor: 'white', padding: '1.5rem', boxSizing: 'border-box', border: '2px solid #00a276', borderRadius: '16px', height: '100%' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <Radio size={24} color="#00a276" />
                            <div>
                                <h3 style={{ margin: 0, color: '#00a276' }}>Evolution API</h3>
                                <p style={{ margin: '4px 0 0', fontSize: '0.85rem', color: '#666' }}>Conexão via QR Code (Baileys)</p>
                            </div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            {evolutionStatus === 'connected' ? (
                                <span style={{ display: 'flex', alignItems: 'center', gap: '6px', background: '#e8f5e9', color: '#2e7d32', padding: '6px 14px', borderRadius: '20px', fontSize: '0.85rem', fontWeight: 600 }}>
                                    <Wifi size={16} /> Conectado
                                </span>
                            ) : (
                                <span style={{ display: 'flex', alignItems: 'center', gap: '6px', background: '#fff3e0', color: '#e65100', padding: '6px 14px', borderRadius: '20px', fontSize: '0.85rem', fontWeight: 600 }}>
                                    <WifiOff size={16} /> Desconectado
                                </span>
                            )}
                        </div>
                    </div>

                    <div className="input-grid">
                        <div style={{ gridColumn: 'span 2', background: '#f8f9fa', padding: '12px', borderRadius: '8px', border: '1px solid #eee', marginBottom: '10px' }}>
                            <p style={{ margin: 0, fontSize: '0.85rem', color: '#666' }}>
                                <strong>Configuração Servidor:</strong> A URL e API Key estão configuradas globalmente.
                                Cada usuário terá uma instância exclusiva criada automaticamente.
                            </p>
                        </div>

                        {config.evolutionWebhookToken && (
                            <div className="input-group" style={{ gridColumn: 'span 2' }}>
                                <label>Webhook Evolution (gerado automaticamente)</label>
                                <div className="copy-input" style={{ display: 'flex', gap: '8px' }}>
                                    <input
                                        type="text"
                                        value={`${window.location.origin}/api/evolution/webhook/${config.evolutionWebhookToken}`}
                                        readOnly
                                        style={{ flex: 1, fontSize: '0.85rem' }}
                                    />
                                    <button
                                        className="btn-icon"
                                        onClick={() => {
                                            navigator.clipboard.writeText(`${window.location.origin}/api/evolution/webhook/${config.evolutionWebhookToken}`);
                                            addToast('Webhook URL copiada!', 'info');
                                        }}
                                        title="Copiar URL"
                                    >
                                        <Copy size={18} />
                                    </button>
                                </div>
                            </div>
                        )}

                        <div style={{ gridColumn: 'span 2', display: 'flex', gap: '12px', marginTop: '1rem' }}>
                            {evolutionStatus === 'connected' ? (
                                <>
                                    <button
                                        className="btn-secondary"
                                        onClick={() => { setShowEvolutionQR(true); fetchEvolutionQR(); }}
                                        style={{ flex: 1 }}
                                    >
                                        <QrCode size={18} style={{ marginRight: '8px' }} />
                                        Ver QR Code
                                    </button>
                                    <button
                                        className="btn-secondary"
                                        onClick={handleEnableWebhook}
                                        disabled={evolutionLoading || !config.evolutionInstanceName}
                                        style={{ flex: 1 }}
                                        title="Sincroniza os eventos de áudio, imagem e texto"
                                    >
                                        <Wifi size={18} style={{ marginRight: '8px' }} />
                                        Ativar Webhook
                                    </button>
                                    <button
                                        className="btn-secondary"
                                        onClick={handleDisconnectEvolution}
                                        style={{ color: '#d32f2f', borderColor: '#ffcdd2', background: '#fff5f5' }}
                                    >
                                        <WifiOff size={18} style={{ marginRight: '8px' }} />
                                        Desconectar
                                    </button>
                                </>
                            ) : (
                                <div style={{ display: 'flex', gap: '12px', width: '100%', alignItems: 'stretch' }}>
                                    <button
                                        className="btn-primary"
                                        onClick={handleSetupEvolution}
                                        disabled={evolutionLoading}
                                        style={{ flex: 2, background: '#00a276', height: '45px', margin: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                                    >
                                        {evolutionLoading ? (
                                            <><RefreshCw size={18} className="animate-spin" style={{ marginRight: '8px' }} /> Configurando...</>
                                        ) : (
                                            <><QrCode size={18} style={{ marginRight: '8px' }} /> Conectar via QR Code</>
                                        )}
                                    </button>
                                    <button
                                        className="btn-secondary"
                                        onClick={handleEnableWebhook}
                                        disabled={true}
                                        style={{ flex: 1, height: '45px', margin: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: 0.6, cursor: 'not-allowed' }}
                                        title="Conecte seu WhatsApp para habilitar esta função"
                                    >
                                        <Wifi size={18} style={{ marginRight: '8px' }} />
                                        Corrigir Webhook
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Logout Section */}
            <div className="mobile-only-logout" style={{ marginTop: '2rem' }}>
                <hr style={{ border: 'none', borderTop: '1px solid #eee', marginBottom: '2rem' }} />
                <button
                    className="btn-secondary w-full"
                    onClick={onLogout}
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '10px',
                        color: '#d32f2f',
                        border: '1px solid #ffcdd2',
                        backgroundColor: '#fff5f5'
                    }}
                >
                    <LogOut size={18} /> Sair da Conta
                </button>
            </div>
        </div>
    );
}

export default SettingsTab;

