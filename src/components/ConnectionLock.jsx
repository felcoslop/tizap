import React from 'react';
import { Lock, Settings } from 'lucide-react';

const ConnectionLock = ({ onGoToSettings, title = "Conexão Necessária" }) => {
    return (
        <div style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(255, 255, 255, 0.7)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 100,
            borderRadius: 'var(--radius-lg)'
        }}>
            <div style={{
                backgroundColor: 'white',
                padding: '3rem',
                borderRadius: '24px',
                boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
                textAlign: 'center',
                maxWidth: '400px',
                border: '1px solid #f3f4f6',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '1.5rem'
            }}>
                <div style={{
                    width: '80px',
                    height: '80px',
                    backgroundColor: '#f9fafb',
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    border: '2px solid #f3f4f6'
                }}>
                    <Lock size={40} color="#9ca3af" strokeWidth={1.5} />
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', alignItems: 'center' }}>
                    <h3 style={{ margin: 0, color: 'var(--ambev-blue)', fontSize: '1.25rem', fontWeight: 600 }}>
                        {title}
                    </h3>
                    <p style={{ margin: 0, color: '#6b7280', fontSize: '0.95rem', lineHeight: '1.5', textAlign: 'center' }}>
                        Para acessar esta aba, faça a conexão na aba Ajustes
                    </p>
                </div>

                <button
                    onClick={onGoToSettings}
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '0.5rem',
                        backgroundColor: 'var(--ambev-blue)',
                        color: 'white',
                        padding: '0.75rem 1.5rem',
                        borderRadius: '12px',
                        border: 'none',
                        cursor: 'pointer',
                        fontWeight: 500,
                        transition: 'all 0.2s',
                        width: '100%',
                        boxShadow: '0 4px 0 #1e006e'
                    }}
                    onMouseOver={(e) => e.target.style.backgroundColor = '#1e006e'}
                    onMouseOut={(e) => e.target.style.backgroundColor = 'var(--ambev-blue)'}
                >
                    <Settings size={18} />
                    Ir para Ajustes
                </button>
            </div>
        </div>
    );
};

export default ConnectionLock;
