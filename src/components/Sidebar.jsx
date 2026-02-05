import React from 'react';
import {
    Send, GitBranch, History, MessageSquare, Settings, Users,
    LogOut, Mail, Zap, Radio, ChevronLeft, ChevronRight
} from 'lucide-react';

export default function Sidebar({
    activeTab,
    setActiveTab,
    isSidebarCollapsed,
    setIsSidebarCollapsed,
    user,
    onLogout,
    isMaster
}) {
    // Sidebar navigation items
    const navItems = [
        { id: 'disparos', label: <div className="nav-label-multiline">Disparos<br /><span>API-OF</span></div>, icon: Send },
        { id: 'fluxos', label: 'Fluxos', icon: GitBranch },
        { id: 'automacoes', label: <div className="nav-label-multiline">Automações<br /><span>API-EVO</span></div>, icon: Zap },
        { id: 'historico', label: 'Histórico', icon: History },
        { id: 'recebidas', label: <div className="nav-label-multiline">Recebidas<br /><span>API-OF</span></div>, icon: MessageSquare },
        { id: 'recebidas-evolution', label: <div className="nav-label-multiline">Recebidas<br /><span>API-EVO</span></div>, icon: Radio },
        { id: 'email', label: 'E-mail', icon: Mail },
        { id: 'ajustes', label: 'Ajustes', icon: Settings },
        ...(isMaster ? [{ id: 'users', icon: Users, label: 'Usuários' }] : []),
    ];

    return (
        <aside className={`sidebar ${isSidebarCollapsed ? 'collapsed' : ''}`}>
            <div
                className="sidebar-toggle"
                onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
                title={isSidebarCollapsed ? "Expandir Menu" : "Recolher Menu"}
            >
                {isSidebarCollapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
            </div>
            <div className="logo-small">
                <img
                    src={isSidebarCollapsed ? "/logo.png" : "/logo-estendida.png"}
                    alt="tiZAP!"
                    className={isSidebarCollapsed ? "rounded-logo" : "extended-logo"}
                />
                {isSidebarCollapsed && <span>tizap!</span>}
            </div>
            <nav>
                {navItems.map(item => (
                    <button
                        key={item.id}
                        className={`nav-item ${activeTab === item.id ? 'active' : ''}`}
                        onClick={() => setActiveTab(item.id)}
                    >
                        <item.icon size={20} />
                        <span className="nav-label">{item.label}</span>
                    </button>
                ))}
            </nav>
            <div className="user-profile">
                <div className="user-info">
                    <span className="user-email">{user.email}</span>
                </div>
                <button className="logout-btn" onClick={onLogout} title="Sair">
                    <LogOut size={18} />
                </button>
            </div>
        </aside>
    );
}
