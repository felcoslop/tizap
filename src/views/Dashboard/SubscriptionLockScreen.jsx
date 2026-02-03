import React, { useState } from 'react';
import { Lock, CreditCard, CheckCircle2, AlertTriangle, LogOut } from 'lucide-react';

export default function SubscriptionLockScreen({ user, onLogout }) {
    const [loading, setLoading] = useState(false);

    const handleSubscribe = async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/payment/preference', {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${user.token}` }
            });
            const data = await res.json();
            if (data.init_point) {
                window.location.href = data.init_point;
            } else {
                alert('Erro ao iniciar pagamento.');
            }
        } catch (err) {
            console.error(err);
            alert('Erro ao conectar com o serviço de pagamento.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div style={{
            position: 'fixed', inset: 0, zIndex: 9999, background: '#f8f9fa',
            display: 'flex', alignItems: 'center', justifyContent: 'center', pading: '20px'
        }}>
            <div className="card fade-in" style={{
                maxWidth: '500px', width: '100%', padding: '40px',
                textAlign: 'center', boxShadow: '0 20px 50px rgba(0,0,0,0.1)',
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '20px'
            }}>
                <div style={{
                    width: '80px', height: '80px', borderRadius: '50%',
                    background: '#fff0f0', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    marginBottom: '10px'
                }}>
                    <Lock size={40} color="#ff4444" />
                </div>

                <h1 style={{ fontSize: '2rem', margin: 0, color: '#333' }}>Acesso Bloqueado</h1>

                <p style={{ fontSize: '1.1rem', color: '#666', lineHeight: 1.6 }}>
                    Seu período de teste gratuito do <strong>App Village</strong> expirou.
                    Para continuar utilizando todas as ferramentas de automação e gestão, é necessário adquirir/reativar sua licença.
                </p>

                <div style={{
                    background: '#f0f4ff', padding: '20px', borderRadius: '12px',
                    width: '100%', textAlign: 'left'
                }}>
                    <h3 style={{ margin: '0 0 15px', color: '#280091' }}>Plano Premium</h3>
                    <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        <li style={{ display: 'flex', gap: '10px' }}><CheckCircle2 size={20} color="#00a276" /> Automações Ilimitadas</li>
                        <li style={{ display: 'flex', gap: '10px' }}><CheckCircle2 size={20} color="#00a276" /> Dashboard Completo</li>
                        <li style={{ display: 'flex', gap: '10px' }}><CheckCircle2 size={20} color="#00a276" /> Suporte Prioritário</li>
                    </ul>
                </div>

                <div style={{ width: '100%', borderTop: '1px solid #eee', paddingTop: '20px' }}>
                    <div style={{ fontSize: '2rem', fontWeight: 800, color: '#333', marginBottom: '20px' }}>
                        R$ 129,99 <span style={{ fontSize: '1rem', fontWeight: 400, color: '#999' }}>/mês</span>
                    </div>

                    <button
                        className="btn-primary"
                        onClick={handleSubscribe}
                        disabled={loading}
                        style={{ width: '100%', height: '56px', fontSize: '1.2rem', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' }}
                    >
                        {loading ? 'Processando...' : <><CreditCard size={24} /> Pagar Agora</>}
                    </button>

                    <button
                        onClick={onLogout}
                        style={{ background: 'none', border: 'none', color: '#999', marginTop: '15px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
                    >
                        <LogOut size={16} /> Sair da conta
                    </button>
                </div>
            </div>
        </div>
    );
}
