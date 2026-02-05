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
    const [isMobile, setIsMobile] = React.useState(window.innerWidth <= 768);

    React.useEffect(() => {
        const handleResize = () => setIsMobile(window.innerWidth <= 768);
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    // Sidebar navigation items
    const navItems = [
        { id: 'disparos', label: <div className="nav-label-multiline">Início<br /><span>API-OF</span></div>, icon: Send, mobileVisible: true },
        { id: 'fluxos', label: 'Fluxos', icon: GitBranch, mobileVisible: false },
        { id: 'automacoes', label: <div className="nav-label-multiline">Automações<br /><span>API-EVO</span></div>, icon: Zap, mobileVisible: false },
        { id: 'historico', label: 'Histórico', icon: History, mobileVisible: false },
        { id: 'recebidas', label: <div className="nav-label-multiline">Recebidas<br /><span>API-OF</span></div>, icon: MessageSquare, mobileVisible: true },
        { id: 'recebidas-evolution', label: <div className="nav-label-multiline">Recebidas<br /><span>API-EVO</span></div>, icon: Radio, mobileVisible: true },
        { id: 'email', label: 'E-mail', icon: Mail, mobileVisible: false },
        { id: 'ajustes', label: 'Ajustes', icon: Settings, mobileVisible: true },
        ...(isMaster ? [{ id: 'users', icon: Users, label: 'Usuários', mobileVisible: false }] : []),
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
                {navItems
                    .filter(item => !isMobile || item.mobileVisible)
                    .map(item => (
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
