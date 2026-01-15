import React, { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';

export function LoginView({ onLogin, onSwitch }) {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);

    return (
        <div className="auth-container">
            <div className="auth-card ambev-flag" style={{ position: 'relative', overflow: 'hidden' }}>
                <div style={{ position: 'absolute', top: '-50px', right: '-50px', width: '150px', height: '150px', background: 'var(--ambev-blue)', opacity: 0.05, borderRadius: '50%' }}></div>
                <img src="/logo.png" alt="tizap!" className="rounded-logo" style={{ width: '80px', height: '80px', objectFit: 'cover', marginBottom: '1.5rem' }} />
                <h1 className="logo-text" style={{ fontSize: '2.5rem', marginBottom: '0.2rem', color: 'var(--ambev-yellow)' }}>tizap!</h1>
                <p className="subtitle" style={{ color: '#888', fontWeight: 600, opacity: 0.8 }}>Comunicação inteligente para o seu negócio</p>
                <form onSubmit={(e) => { e.preventDefault(); onLogin(email, password); }}>
                    <div className="input-group">
                        <label>E-mail</label>
                        <input type="email" value={email} onChange={e => setEmail(e.target.value)} required placeholder="exemplo@ab-inbev.com.br" />
                    </div>
                    <div className="input-group">
                        <label>Senha</label>
                        <div className="input-with-btn">
                            <input type={showPassword ? "text" : "password"} value={password} onChange={e => setPassword(e.target.value)} required />
                            <button type="button" className="btn-secondary" onClick={() => setShowPassword(!showPassword)}>
                                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                            </button>
                        </div>
                    </div>
                    <button type="submit" className="btn-primary btn-block">Entrar</button>
                </form>
                <button className="btn-link" onClick={onSwitch}>Criar nova conta</button>
                <div className="legal-footer-login" style={{ marginTop: '20px', display: 'flex', gap: '10px', justifyContent: 'center', fontSize: '12px' }}>
                    <a href="/politics/privacidade.html" target="_blank" style={{ color: '#666' }}>Privacidade</a>
                    <a href="/politics/termos.html" target="_blank" style={{ color: '#666' }}>Termos de Uso</a>
                </div>
            </div>
        </div>
    );
}

export default LoginView;
