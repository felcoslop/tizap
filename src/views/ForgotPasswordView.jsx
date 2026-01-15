import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

export function ForgotPasswordView({ onSwitch }) {
    const navigate = useNavigate();
    const [email, setEmail] = useState('');
    const [message, setMessage] = useState('');
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setIsLoading(true);
        setError('');
        setMessage('');

        try {
            const res = await fetch('/api/auth/forgot-password', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: email.trim().toLowerCase() })
            });
            const data = await res.json();
            if (res.ok) {
                setMessage(data.message);
            } else {
                setError(data.error || 'Erro ao processar solicitação.');
            }
        } catch (err) {
            setError('Erro de conexão.');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="auth-container">
            <div className="auth-card ambev-flag" style={{ position: 'relative', overflow: 'hidden' }}>
                <div style={{ position: 'absolute', top: '-50px', right: '-50px', width: '150px', height: '150px', background: 'var(--ambev-blue)', opacity: 0.05, borderRadius: '50%' }}></div>
                <div onClick={() => navigate('/login')} style={{ cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                    <img src="/logo.png" alt="tizap!" className="rounded-logo" style={{ width: '80px', height: '80px', objectFit: 'cover', marginBottom: '1.5rem' }} />
                    <h1 className="logo-text" style={{ fontSize: '2.5rem', marginBottom: '0.2rem', color: 'var(--ambev-yellow)' }}>tizap!</h1>
                </div>
                <h2 style={{ color: '#888', marginBottom: '1rem' }}>Recuperar Senha</h2>

                {message && (
                    <div style={{ backgroundColor: 'rgba(0, 162, 118, 0.1)', color: 'var(--ambev-green)', padding: '12px', borderRadius: '8px', marginBottom: '1rem', fontSize: '0.9rem', fontWeight: 'bold' }}>
                        {message}
                    </div>
                )}
                {error && (
                    <div style={{ backgroundColor: 'rgba(255, 85, 85, 0.1)', color: 'var(--color-error)', padding: '12px', borderRadius: '8px', marginBottom: '1rem', fontSize: '0.9rem', fontWeight: 'bold' }}>
                        {error}
                    </div>
                )}

                <p style={{ color: '#666', fontSize: '0.9rem', marginBottom: '1.5rem' }}>
                    Insira seu e-mail para receber um link de redefinição de senha.
                </p>

                <form onSubmit={handleSubmit}>
                    <div className="input-group">
                        <label>E-mail</label>
                        <input
                            type="email"
                            value={email}
                            onChange={e => setEmail(e.target.value)}
                            required
                            placeholder="exemplo@dominio.com"
                            disabled={isLoading}
                        />
                    </div>
                    <button type="submit" className="btn-primary btn-block" disabled={isLoading}>
                        {isLoading ? 'Enviando...' : 'Enviar Link'}
                    </button>
                </form>

                <button className="btn-link" onClick={onSwitch} style={{ marginTop: '1rem' }}>Voltar para o Login</button>
            </div>
        </div>
    );
}

export default ForgotPasswordView;
