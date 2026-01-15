import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Eye, EyeOff } from 'lucide-react';

export function RegisterView({ onRegister, onSwitch }) {
    const navigate = useNavigate();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [isLoading, setIsLoading] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (isLoading) return;
        setIsLoading(true);
        try {
            await onRegister(email, password);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="auth-container">
            <div className="auth-card ambev-flag" style={{ position: 'relative', overflow: 'hidden', borderTopColor: 'var(--ambev-blue)' }}>
                <div style={{ position: 'absolute', bottom: '-50px', left: '-50px', width: '150px', height: '150px', background: 'var(--ambev-blue)', opacity: 0.1, borderRadius: '50%' }}></div>
                <div onClick={() => navigate('/login')} style={{ cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                    <img src="/logo.png" alt="tizap!" className="rounded-logo" style={{ width: '80px', height: '80px', objectFit: 'cover', marginBottom: '1.5rem' }} />
                    <h1 className="logo-text" style={{ color: 'var(--ambev-yellow)', fontSize: '2.5rem', marginBottom: '0.2rem' }}>tizap!</h1>
                </div>
                <h2 style={{ color: '#888' }}>Cadastro</h2>
                <form onSubmit={handleSubmit}>
                    <div className="input-group">
                        <label>E-mail</label>
                        <input type="email" value={email} onChange={e => setEmail(e.target.value)} required disabled={isLoading} />
                    </div>
                    <div className="input-group">
                        <label>Senha</label>
                        <div className="input-with-btn">
                            <input type={showPassword ? "text" : "password"} value={password} onChange={e => setPassword(e.target.value)} required disabled={isLoading} />
                            <button type="button" className="btn-secondary" onClick={() => setShowPassword(!showPassword)} disabled={isLoading}>
                                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                            </button>
                        </div>
                    </div>
                    <button type="submit" className="btn-primary btn-block" disabled={isLoading} style={{ backgroundColor: 'var(--ambev-yellow) !important', color: 'var(--ambev-blue) !important', border: 'none !important', borderBottom: '3px solid rgba(0,0,0,0.1) !important', fontWeight: 'bold' }}>
                        {isLoading ? 'Cadastrando...' : 'Cadastrar'}
                    </button>
                </form>
                <button className="btn-link" onClick={onSwitch}>Já tenho conta</button>
                <div className="legal-footer-login" style={{ marginTop: '20px', display: 'flex', gap: '10px', justifyContent: 'center', fontSize: '12px' }}>
                    <a href="/politics/privacidade.html" target="_blank" style={{ color: '#666' }}>Privacidade</a>
                    <a href="/politics/termos.html" target="_blank" style={{ color: '#666' }}>Termos de Uso</a>
                </div>
            </div>
        </div>
    );
}

export default RegisterView;
