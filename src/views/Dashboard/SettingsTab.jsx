import React from 'react';
import { Eye, EyeOff, RefreshCw, Copy } from 'lucide-react';

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
    addToast
}) {
    return (
        <div className="card ambev-flag">
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <h3>Credenciais</h3>
                <button className="btn-secondary" onClick={() => setIsEditing(!isEditing)}>{isEditing ? 'Cancelar' : 'Editar'}</button>
            </div>
            <div className="input-grid mt-4">
                <div className="input-group">
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

                <hr style={{ border: 'none', borderTop: '1px solid #eee', margin: '1rem 0' }} />

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                    <h4 style={{ margin: 0 }}>Webhook para o Meta</h4>
                    {isEditing && (
                        <button className="btn-secondary" onClick={generateWebhook} style={{ fontSize: '0.8rem', padding: '6px 12px' }}>
                            <RefreshCw size={14} style={{ marginRight: '6px' }} /> Gerar Verify Token
                        </button>
                    )}
                </div>

                <div className="input-group">
                    <label>Webhook URL (Configurações do App Meta)</label>
                    <div className="copy-input" style={{ display: 'flex', gap: '8px' }}>
                        <input
                            type="text"
                            value={`${window.location.origin}/webhook/${user.id}`}
                            readOnly
                            style={{ flex: 1 }}
                        />
                        <button
                            className="btn-icon"
                            onClick={() => {
                                navigator.clipboard.writeText(`${window.location.origin}/webhook/${user.id}`);
                                addToast('URL copiada!', 'info');
                            }}
                            title="Copiar URL"
                        >
                            <Copy size={18} />
                        </button>
                    </div>
                </div>

                <div className="input-group mt-3">
                    <label>Verify Token (Configurações do App Meta)</label>
                    <div className="copy-input" style={{ display: 'flex', gap: '8px' }}>
                        <input
                            type="text"
                            value={isEditing ? tempConfig.webhookVerifyToken : config.webhookVerifyToken}
                            onChange={e => setTempConfig({ ...tempConfig, webhookVerifyToken: e.target.value })}
                            readOnly={!isEditing}
                            placeholder="Clique em Gerar ou digite um token"
                            style={{ flex: 1 }}
                        />
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

                {isEditing && <button className="btn-primary w-full mt-6" onClick={saveConfig}>Salvar Configurações</button>}
            </div>
        </div>
    );
}

export default SettingsTab;
