import React, { useState } from 'react';

export function RegisterView({ onRegister, onSwitch }) {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');

    return (
        <div className="auth-container">
            <div className="auth-card ambev-flag" style={{ position: 'relative', overflow: 'hidden', borderTopColor: 'var(--ambev-blue)' }}>
                <div style={{ position: 'absolute', bottom: '-50px', left: '-50px', width: '150px', height: '150px', background: 'var(--ambev-blue)', opacity: 0.1, borderRadius: '50%' }}></div>
                <img src="/logo.png" alt="tizap!" className="rounded-logo" style={{ width: '80px', height: '80px', objectFit: 'cover', marginBottom: '1.5rem' }} />
                <h1 className="logo-text" style={{ color: 'var(--ambev-yellow)', fontSize: '2.5rem', marginBottom: '0.2rem' }}>tizap!</h1>
                <h2 style={{ color: '#888' }}>Cadastro</h2>
                <form onSubmit={(e) => { e.preventDefault(); onRegister(email, password); }}>
                    <div className="input-group">
                        <label>E-mail</label>
                        <input type="email" value={email} onChange={e => setEmail(e.target.value)} required />
                    </div>
                    <div className="input-group">
                        <label>Senha</label>
                        <input type="password" value={password} onChange={e => setPassword(e.target.value)} required />
                    </div>
                    <button type="submit" className="btn-primary btn-block" style={{ backgroundColor: 'var(--ambev-yellow) !important', color: 'var(--ambev-blue) !important', border: 'none !important', borderBottom: '3px solid rgba(0,0,0,0.1) !important', fontWeight: 'bold' }}>Cadastrar</button>
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
