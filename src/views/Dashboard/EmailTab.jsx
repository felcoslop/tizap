import React, { useState, useEffect, useRef } from 'react';
import {
    Mail, Upload, Layout, Eye, Send, Save, Trash2,
    Smartphone, Tablet, Monitor, RefreshCw, CheckCircle2,
    X, AlertCircle, ChevronDown, ChevronUp, History
} from 'lucide-react';
import * as XLSX from 'xlsx';
import Papa from 'papaparse';
import EmailLogModal from '../../components/Modals/EmailLogModal';

export default function EmailTab({ user, addToast }) {
    const [activeSubTab, setActiveSubTab] = useState('templates'); // templates, campaigns
    const [campaignData, setCampaignData] = useState(null);
    const [headers, setHeaders] = useState([]);
    const [mapping, setMapping] = useState({ email: '' });
    const [templates, setTemplates] = useState([]);
    const [selectedTemplate, setSelectedTemplate] = useState(null);
    const [editorHtml, setEditorHtml] = useState('');
    const [templateName, setTemplateName] = useState('');
    const [templateSubject, setTemplateSubject] = useState('');
    const [previewMode, setPreviewMode] = useState('browser'); // browser, outlook, ios, android
    const [campaigns, setCampaigns] = useState([]);
    const [loading, setLoading] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [activeCampaign, setActiveCampaign] = useState(null);

    // State for dynamic variables
    const [detectedVars, setDetectedVars] = useState([]);
    const [varMapping, setVarMapping] = useState({});

    // Deletion Modal State
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [showUnsavedModal, setShowUnsavedModal] = useState(false);
    const [templateToDelete, setTemplateToDelete] = useState(null);
    const [selectedLogCampaign, setSelectedLogCampaign] = useState(null);

    const fileInputRef = useRef(null);

    useEffect(() => {
        fetchTemplates();
        fetchCampaigns();
    }, []);

    // Detect variables in HTML
    useEffect(() => {
        const regex = /{{(.*?)}}|\[\[(.*?)\]\]/g;
        const matches = [...editorHtml.matchAll(regex)];
        const uniqueVars = [...new Set(matches.map(m => (m[1] || m[2]).trim()))];
        setDetectedVars(uniqueVars);
    }, [editorHtml]);

    const isModified = () => {
        // Se não tem template selecionado, mas tem conteúdo no editor (HTML), considera modificado (novo não salvo)
        if (!selectedTemplate) {
            return editorHtml.trim() !== '';
        }

        return templateName !== selectedTemplate.name ||
            templateSubject !== (selectedTemplate.subject || '') ||
            editorHtml !== selectedTemplate.html;
    };

    const fetchTemplates = async () => {
        try {
            const res = await fetch(`/api/email-templates/${user.id}`, {
                headers: { 'Authorization': `Bearer ${user.token}` }
            });
            if (res.ok) setTemplates(await res.json());
        } catch (e) { addToast('Erro ao buscar templates', 'error'); }
    };

    const fetchCampaigns = async () => {
        try {
            const res = await fetch(`/api/email-campaigns/${user.id}`, {
                headers: { 'Authorization': `Bearer ${user.token}` }
            });
            if (res.ok) setCampaigns(await res.json());
        } catch (e) { addToast('Erro ao buscar campanhas', 'error'); }
    };

    const handleFileUpload = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const ext = file.name.split('.').pop().toLowerCase();
        if (ext === 'xlsx' || ext === 'xls') {
            const reader = new FileReader();
            reader.onload = (evt) => {
                const wb = XLSX.read(evt.target.result, { type: 'binary' });
                const data = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1 });
                if (data.length > 0) {
                    setHeaders(data[0]);
                    setCampaignData(data.slice(1).map(row => {
                        const obj = {};
                        data[0].forEach((h, i) => obj[h] = row[i]);
                        return obj;
                    }));
                }
            };
            reader.readAsBinaryString(file);
        } else {
            Papa.parse(file, {
                header: true, skipEmptyLines: true, complete: (results) => {
                    setHeaders(results.meta.fields);
                    setCampaignData(results.data);
                }
            });
        }
    };

    const saveTemplate = async () => {
        if (!templateName || !editorHtml) return addToast('Nome e HTML são obrigatórios', 'error');
        setIsSaving(true);
        try {
            const res = await fetch('/api/email-templates', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${user.token}`
                },
                body: JSON.stringify({
                    id: selectedTemplate?.id,
                    name: templateName,
                    subject: templateSubject,
                    html: editorHtml,
                    userId: user.id
                })
            });
            if (res.ok) {
                const updated = await res.json();
                addToast('Template salvo com sucesso!', 'success');
                // Use functional update to ensure we have latest state
                setTemplates(prev => {
                    const exists = prev.find(t => t.id === updated.id);
                    if (exists) {
                        return prev.map(t => t.id === updated.id ? updated : t);
                    }
                    return [updated, ...prev];
                });
                setSelectedTemplate(updated);
                return true;
            } else {
                const errData = await res.json();
                addToast(errData.error || 'Erro ao salvar template', 'error');
                return false;
            }
        } catch (e) {
            console.error('[SAVE_TEMPLATE_ERROR]', e);
            addToast('Erro de conexão ao salvar template', 'error');
            return false;
        } finally {
            setIsSaving(false);
        }
    };

    const startCampaign = async (force = false) => {
        if (!campaignData || campaignData.length === 0) return addToast('Carregue os leads', 'error');
        if (!mapping.email) return addToast('Mapeie a coluna de E-mail', 'error');
        if (!editorHtml) return addToast('Crie ou selecione um template', 'error');

        // Check for unsaved changes before starting
        if (!force && isModified()) {
            setShowUnsavedModal(true);
            return;
        }

        // Check if all detected variables are mapped
        const unmapped = detectedVars.filter(v => !varMapping[v]);
        if (unmapped.length > 0) {
            return addToast(`Mapeie as variáveis: ${unmapped.join(', ')}`, 'warning');
        }

        setLoading(true);
        try {
            const finalLeads = campaignData.map(l => {
                const lead = { ...l, email: l[mapping.email] };
                // Also add mappings for replacements
                detectedVars.forEach(v => {
                    lead[v] = l[varMapping[v]];
                });
                return lead;
            });

            const res = await fetch('/api/email-campaigns', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${user.token}`
                },
                body: JSON.stringify({
                    name: templateName || 'Campanha sem nome',
                    subject: templateSubject || 'Sem Assunto',
                    userId: user.id,
                    templateId: selectedTemplate?.id,
                    leadsData: finalLeads
                })
            });
            if (res.ok) {
                const data = await res.json();
                addToast('Campanha iniciada!', 'success');
                setActiveSubTab('campaigns');
                fetchCampaigns();
                setActiveCampaign({ id: data.campaignId, status: 'running', currentIndex: 0, totalLeads: campaignData.length });
            }
        } catch (e) { addToast('Erro ao iniciar campanha', 'error'); }
        finally { setLoading(false); }
    };

    const getTransformedHtml = (html, mode) => {
        if (!html) return '<div style="padding: 20px; color: #999; font-family: sans-serif;">Digite seu HTML para ver o preview...</div>';

        const baseStyles = `
            <style>
                * { box-sizing: border-box; }
                body, html { margin: 0; padding: 0; width: 100%; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; line-height: 1.6; color: #333; background: #fff; }
                img { max-width: 100%; height: auto; display: block; }
                table { border-collapse: collapse; width: 100%; }
                /* Ocultar scrollbars dentro do iframe */
                ::-webkit-scrollbar { width: 0 !important; height: 0 !important; display: none !important; }
                body, html, * { -ms-overflow-style: none !important; scrollbar-width: none !important; }
            </style>
        `;

        if (mode === 'outlook') {
            return `
                <!DOCTYPE html>
                <html>
                <head>
                    ${baseStyles}
                    <style>
                        body { background: #f3f3f3; display: flex; justify-content: center; padding: 20px 0; min-height: 100vh; box-sizing: border-box; }
                        .outlook-wrapper { background: #fff; width: 600px; border: 1px solid #ddd; box-shadow: 0 4px 10px rgba(0,0,0,0.05); margin: 0 auto; mso-line-height-rule: exactly; }
                        * { font-family: "Segoe UI", Calibri, Helvetica, Arial, sans-serif !important; }
                    </style>
                </head>
                <body>
                    <div class="outlook-wrapper">
                        <div style="padding: 15px; border-bottom: 1px solid #eee; background: #fff; color: #888; font-size: 11px; margin-bottom: 20px;">
                            <strong>Para:</strong> cliente@exemplo.com.br<br/>
                            <strong>Assunto:</strong> ${templateSubject || templateName || '(Assunto do E-mail)'}
                        </div>
                        <div style="padding: 0 20px 20px;">
                            ${html}
                        </div>
                    </div>
                </body>
                </html>
            `;
        }

        if (mode === 'ios' || mode === 'android') {
            const isIOS = mode === 'ios';
            return `
                <!DOCTYPE html>
                <html>
                <head>
                    <meta name="viewport" content="width=device-width, initial-scale=1.0">
                    ${baseStyles}
                    <style>
                        body { padding: 0; margin: 0; overflow-x: hidden; width: 100% !important; background: #fff; display: block; }
                        .mobile-header { background: ${isIOS ? '#f9f9f9' : '#fff'}; padding: 40px 20px 20px; border-bottom: 1px solid #ddd; margin-bottom: 15px; font-weight: bold; font-size: 14px; text-align: left; }
                        .mobile-container { width: 100%; padding: 0 20px; box-sizing: border-box; display: block; }
                        /* Simulate mobile rendering overrides */
                        table { width: 100% !important; }
                        td { display: block !important; width: 100% !important; }
                        img { width: 100% !important; height: auto !important; }
                    </style>
                </head>
                <body>
                    <div class="mobile-header">
                        <div style="font-size: 12px; color: #666; font-weight: normal; margin-bottom: 4px;">10:41</div>
                        <div>${templateSubject || templateName || 'Nova Mensagem'}</div>
                    </div>
                    <div class="mobile-container">
                        ${html}
                    </div>
                </body>
                </html>
            `;
        }

        // Browser mode
        return `
            <!DOCTYPE html>
            <html>
            <head>
                ${baseStyles}
            </head>
            <body>
                <div style="padding: 20px;">
                    ${html}
                </div>
            </body>
            </html>
        `;
    };

    const renderPreview = () => {
        const frameStyles = {
            browser: { width: '100%', height: '500px', border: '1px solid #ddd', borderRadius: '8px', overflowY: 'auto' },
            outlook: { width: '100%', height: '500px', border: 'none', background: '#f3f3f3', overflowY: 'auto' },
            ios: { width: '500px', height: '850px', border: '16px solid #111', borderRadius: '40px', margin: '0 auto', overflowX: 'hidden', overflowY: 'auto', boxShadow: '0 20px 50px rgba(0,0,0,0.15)' },
            android: { width: '480px', height: '880px', border: '14px solid #222', borderRadius: '20px', margin: '0 auto', overflowX: 'hidden', overflowY: 'auto', boxShadow: '0 20px 50px rgba(0,0,0,0.15)' }
        };

        const previewContent = getTransformedHtml(editorHtml, previewMode);

        return (
            <div className="preview-container mt-4" style={{ textAlign: 'center' }}>
                <div className="preview-controls" style={{ display: 'flex', justifyContent: 'center', gap: '15px', marginBottom: '30px' }}>
                    <button className={`btn-secondary ${previewMode === 'browser' ? 'active' : ''}`} onClick={() => setPreviewMode('browser')} title="Navegador"><Monitor size={20} /></button>
                    <button className={`btn-secondary ${previewMode === 'outlook' ? 'active' : ''}`} onClick={() => setPreviewMode('outlook')} title="Desktop/Outlook"><Layout size={20} /></button>
                    <button className={`btn-secondary ${previewMode === 'ios' ? 'active' : ''}`} onClick={() => setPreviewMode('ios')} title="iOS Mail"><Smartphone size={20} /></button>
                    <button className={`btn-secondary ${previewMode === 'android' ? 'active' : ''}`} onClick={() => setPreviewMode('android')} title="Android Mail"><Smartphone size={20} style={{ transform: 'rotate(5deg)' }} /></button>
                </div>
                <div className="preview-frame" style={{ ...frameStyles[previewMode], background: 'white', transition: 'all 0.3s ease', position: 'relative' }}>
                    <iframe
                        key={previewMode}
                        title="Email Preview"
                        style={{ width: '100%', height: '100%', border: 'none' }}
                        srcDoc={previewContent}
                    />
                </div>
            </div>
        );
    };

    const handleSelectTemplate = (t) => {
        setSelectedTemplate(t);
        setTemplateName(t.name);
        setTemplateSubject(t.subject || '');
        setEditorHtml(t.html);
    };

    const performDeleteTemplate = async () => {
        if (!templateToDelete) return;
        try {
            const res = await fetch(`/api/email-templates/${templateToDelete.id}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${user.token}` }
            });
            if (res.ok) {
                addToast('Modelo removido.', 'info');
                setTemplates(prev => prev.filter(tmpl => tmpl.id !== templateToDelete.id));
                if (selectedTemplate?.id === templateToDelete.id) {
                    setSelectedTemplate(null);
                    setTemplateName('');
                    setTemplateSubject('');
                    setEditorHtml('');
                }
            } else {
                addToast('Erro ao remover modelo.', 'error');
            }
        } catch (e) {
            addToast('Erro de conexão ao remover modelo.', 'error');
        } finally {
            setShowDeleteModal(false);
            setTemplateToDelete(null);
        }
    };

    return (
        <div className="email-tab fade-in">
            <div className="source-selector-container">
                <div className="source-selector">
                    <button
                        className={activeSubTab === 'templates' ? 'active' : ''}
                        onClick={() => setActiveSubTab('templates')}
                    >
                        Templates e Editor
                    </button>
                    <button
                        className={activeSubTab === 'campaigns' ? 'active' : ''}
                        onClick={() => setActiveSubTab('campaigns')}
                    >
                        Campanhas e Logs
                    </button>
                </div>
            </div>

            <style>{`
                .btn-action {
                    height: 48px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    gap: 10px;
                    padding: 0 25px;
                    border-radius: 10px;
                    font-weight: 700;
                    transition: all 0.2s;
                    border: none;
                    cursor: pointer;
                }
                .btn-save {
                    background: var(--ambev-yellow);
                    color: var(--ambev-blue);
                    box-shadow: 0 4px 0 #d4a017;
                }
                .btn-save:hover:not(:disabled) { transform: translateY(-1px); box-shadow: 0 5px 0 #d4a017; }
                .btn-save:active:not(:disabled) { transform: translateY(3px); box-shadow: 0 1px 0 #d4a017; }
                .btn-save:disabled {
                    background: #eee;
                    color: #aaa;
                    box-shadow: 0 4px 0 #ccc;
                    cursor: not-allowed;
                }
                .btn-clear {
                    background: #f0f2f5;
                    color: #666;
                    box-shadow: 0 4px 0 #d1d5db;
                }
                .btn-clear:hover { background: #e5e7eb; }
                .btn-clear:active { transform: translateY(3px); box-shadow: 0 1px 0 #d1d5db; }
                
                .btn-sm {
                    padding: 6px 12px;
                    font-size: 12px;
                    height: 32px;
                    display: inline-flex;
                    align-items: center;
                    gap: 6px;
                }

                .template-card {
                    padding: 15px;
                    border: 1px solid #eee;
                    border-radius: 12px;
                    cursor: pointer;
                    transition: all 0.2s;
                    background: white;
                    position: relative;
                    display: flex;
                    flex-direction: column;
                    gap: 5px;
                }
                .template-card:hover { border-color: var(--ambev-blue); transform: translateY(-2px); box-shadow: var(--shadow-sm); }
                .template-card.active { border-color: var(--ambev-blue); background: #f0f4ff; }
                .edit-badge {
                    position: absolute;
                    top: 10px;
                    right: 10px;
                    background: var(--ambev-blue);
                    color: white;
                    padding: 4px 8px;
                    border-radius: 6px;
                    font-size: 11px;
                    display: flex;
                    align-items: center;
                    gap: 4px;
                    opacity: 0.8;
                }
                /* Ocultar scrollbars nos containers de preview mantendo scroll funcional */
                .preview-frame, .preview-frame iframe {
                    scrollbar-width: none !important;
                    -ms-overflow-style: none !important;
                }
                .preview-frame::-webkit-scrollbar, .preview-frame iframe::-webkit-scrollbar {
                    display: none !important;
                    width: 0 !important;
                    height: 0 !important;
                }
            `}</style>

            {activeSubTab === 'templates' ? (
                <div className="templates-view grid-2" style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.2fr) minmax(0, 0.8fr)', gap: '30px' }}>
                    <div className="editor-side card ambev-flag">
                        <h3><Mail size={18} /> Editor de Mensagem</h3>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
                            <div className="input-group">
                                <label>Nome do modelo de e-mail</label>
                                <input type="text" value={templateName} onChange={e => setTemplateName(e.target.value)} placeholder="Ex: Lead Rebloq Jan" />
                            </div>
                            <div className="input-group">
                                <label>Assunto do E-mail</label>
                                <input type="text" value={templateSubject} onChange={e => setTemplateSubject(e.target.value)} placeholder="Ex: Seu pedido Ambev chegou!" />
                            </div>
                        </div>
                        <div className="input-group mt-3">
                            <label>Conteúdo HTML <span style={{ fontSize: '11px', color: '#888', fontWeight: 400 }}>{"(Use {{campo}} ou [[campo]] para variáveis)"}</span></label>
                            <textarea
                                value={editorHtml}
                                onChange={e => setEditorHtml(e.target.value)}
                                style={{ height: '350px', fontFamily: 'monospace', fontSize: '13px', lineHeight: '1.5' }}
                                placeholder="<html><body><h1>Olá {{nome}}!</h1></body></html>"
                            />
                        </div>
                        <div className="actions mt-4" style={{ display: 'flex', gap: '15px', alignItems: 'center' }}>
                            <button className="btn-action btn-save" onClick={saveTemplate} disabled={isSaving || !isModified()}>
                                {isSaving ? <RefreshCw className="spinning" size={18} /> : <Save size={18} />}
                                {selectedTemplate ? 'Atualizar Modelo' : 'Salvar Novo Modelo'}
                            </button>
                            <button className="btn-action btn-clear" onClick={() => { setEditorHtml(''); setTemplateName(''); setTemplateSubject(''); setSelectedTemplate(null); setVarMapping({}); }}>
                                <Trash2 size={18} /> Limpar
                            </button>
                        </div>

                        <div className="saved-templates" style={{ marginTop: '60px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                                <h4 style={{ margin: 0 }}>Modelos Salvos</h4>
                                <span style={{ fontSize: '12px', color: '#999' }}>{templates.length} modelos</span>
                            </div>
                            <div className="templates-list" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '12px' }}>
                                {templates.length === 0 ? (
                                    <p style={{ color: '#999', fontSize: '0.8rem', gridColumn: 'span 2' }}>Nenhum modelo salvo encontrado.</p>
                                ) : (
                                    templates.map(t => (
                                        <div
                                            key={t.id}
                                            className={`template-card ${selectedTemplate?.id === t.id ? 'active' : ''}`}
                                            onClick={() => handleSelectTemplate(t)}
                                        >
                                            <div style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--ambev-blue)' }}>{t.name}</div>
                                            <div style={{ fontSize: '0.8rem', color: '#666', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{t.subject || '(Sem Assunto)'}</div>
                                            <div className="edit-badge">
                                                <Trash2 size={12} onClick={(e) => {
                                                    e.stopPropagation();
                                                    setTemplateToDelete(t);
                                                    setShowDeleteModal(true);
                                                }} />
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    </div>

                    <div className="preview-side card ambev-flag">
                        <h3><Eye size={18} /> Preview Realista</h3>
                        <p className="subtitle">Visualização fiel por dispositivo</p>
                        {renderPreview()}

                        <div className="dispatch-setup card mt-4" style={{ border: '1px solid #eee', background: '#fafafa' }}>
                            <h4 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><Layout size={18} /> Configuração de Disparo</h4>
                            {!campaignData ? (
                                <div className="dropzone" onClick={() => fileInputRef.current?.click()} style={{ background: 'white', border: '2px dashed #ddd' }}>
                                    <input type="file" ref={fileInputRef} className="hidden" accept=".xlsx,.xls,.csv" onChange={handleFileUpload} />
                                    <div className="dropzone-label"><Upload size={40} color="var(--ambev-blue)" /><span style={{ fontSize: '0.95rem', fontWeight: 600 }}>Clique para carregar o Mailing</span></div>
                                </div>
                            ) : (
                                <div className="setup-form">
                                    <div style={{ background: '#e6fffa', padding: '12px', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '10px', color: '#065f46', marginBottom: '20px', border: '1px solid #b2f5ea' }}>
                                        <CheckCircle2 size={20} />
                                        <span style={{ fontWeight: 600 }}>{campaignData.length} leads prontos</span>
                                        <button className="btn-link" onClick={() => setCampaignData(null)} style={{ marginLeft: 'auto', color: '#047857', fontSize: '12px' }}>Trocar Arquivo</button>
                                    </div>

                                    <div className="mapping-grid" style={{ display: 'grid', gap: '15px' }}>
                                        <div className="input-group">
                                            <label style={{ color: 'var(--ambev-blue)', fontWeight: 700 }}>Coluna de E-mail (Destino)</label>
                                            <select value={mapping.email} onChange={e => setMapping({ ...mapping, email: e.target.value })} style={{ border: '2px solid #ddd' }}>
                                                <option value="">Selecione...</option>
                                                {headers.map(h => <option key={h} value={h}>{h}</option>)}
                                            </select>
                                        </div>

                                        {detectedVars.length > 0 && (
                                            <div className="var-mapping mt-2">
                                                <label style={{ color: '#666', fontSize: '12px', marginBottom: '8px', display: 'block', fontWeight: 600 }}>Correspondência de Variáveis:</label>
                                                <div style={{ display: 'grid', gap: '10px' }}>
                                                    {detectedVars.map(v => (
                                                        <div key={v} style={{ display: 'grid', gridTemplateColumns: '100px 1fr', alignItems: 'center', gap: '10px' }}>
                                                            <span style={{ fontSize: '12px', background: '#eee', padding: '4px 8px', borderRadius: '4px', textAlign: 'right', fontWeight: 'bold' }}>{v}</span>
                                                            <select
                                                                value={varMapping[v] || ''}
                                                                onChange={e => setVarMapping({ ...varMapping, [v]: e.target.value })}
                                                                style={{ padding: '6px', fontSize: '12px' }}
                                                            >
                                                                <option value="">Mapear para...</option>
                                                                {headers.map(h => <option key={h} value={h}>{h}</option>)}
                                                            </select>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    <button className="btn-primary mt-4 w-full" onClick={startCampaign} disabled={loading || !mapping.email} style={{ height: '56px', fontSize: '1.2rem', boxShadow: '0 4px 0 #1e006e' }}>
                                        <Send size={22} /> Iniciar Campanha
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            ) : (
                <div className="campaigns-view card ambev-flag">
                    <h3><History size={18} /> Histórico de Disparos por E-mail</h3>
                    {campaigns.length === 0 ? (
                        <p style={{ color: '#999', textAlign: 'center', padding: '40px' }}>Nenhuma campanha de disparo encontrada.</p>
                    ) : (
                        <div className="campaign-list mt-4" style={{ overflowX: 'auto' }}>
                            <table className="preview-table">
                                <thead>
                                    <tr>
                                        <th>Data</th>
                                        <th>Identificação</th>
                                        <th>Assunto</th>
                                        <th>Status</th>
                                        <th>Progresso</th>
                                        <th>Sucessos</th>
                                        <th>Erros</th>
                                        <th>Ações</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {campaigns.map(c => (
                                        <tr key={c.id}>
                                            <td>{new Date(c.createdAt).toLocaleDateString()}</td>
                                            <td><strong>{c.name}</strong></td>
                                            <td>{c.subject || '-'}</td>
                                            <td>
                                                <span style={{
                                                    padding: '4px 10px',
                                                    borderRadius: '6px',
                                                    fontSize: '11px',
                                                    fontWeight: 700,
                                                    backgroundColor: c.status === 'completed' ? '#e8f5e9' : c.status === 'error' ? '#ffebee' : c.status === 'running' ? '#e3f2fd' : '#f5f5f5',
                                                    color: c.status === 'completed' ? '#388e3c' : c.status === 'error' ? '#d32f2f' : c.status === 'running' ? '#1976d2' : '#666',
                                                    textTransform: 'uppercase',
                                                    display: 'inline-flex',
                                                    alignItems: 'center',
                                                    gap: '4px'
                                                }}>
                                                    {c.status === 'running' && <RefreshCw size={10} className="spinning" />}
                                                    {c.status === 'completed' && <CheckCircle2 size={10} />}
                                                    {c.status === 'error' && <AlertCircle size={10} />}
                                                    {c.status === 'completed' ? 'Concluído' : c.status === 'error' ? 'Erro' : c.status === 'running' ? 'Em andamento' : c.status === 'paused' ? 'Pausado' : c.status === 'stopped' ? 'Parado' : c.status}
                                                </span>
                                            </td>
                                            <td>{c.currentIndex} / {c.totalLeads}</td>
                                            <td style={{ color: 'var(--ambev-green)', fontWeight: 700 }}>{c.successCount}</td>
                                            <td style={{ color: '#ef4444', fontWeight: 700 }}>{c.errorCount}</td>
                                            <td>
                                                <button className="btn-icon" onClick={() => setSelectedLogCampaign(c)} title="Ver Detalhes" style={{ color: 'var(--ambev-blue)', border: 'none', background: 'transparent', cursor: 'pointer', padding: '6px' }}>
                                                    <Eye size={18} />
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            )}

            {showDeleteModal && (
                <div className="modal-overlay" style={{ zIndex: 10000 }}>
                    <div className="modal-content alert" style={{ textAlign: 'center' }}>
                        <div style={{ marginBottom: '20px' }}>
                            <div style={{ background: '#fff9e6', width: '60px', height: '60px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 15px' }}>
                                <Trash2 size={30} color="#ffc200" />
                            </div>
                            <h3 style={{ fontSize: '1.5rem', color: 'var(--ambev-blue)', marginBottom: '10px' }}>Excluir Modelo?</h3>
                            <p style={{ color: '#666', fontSize: '1rem' }}>Esta ação não pode ser desfeita. Tem certeza que deseja remover este modelo de e-mail?</p>
                        </div>
                        <div style={{ display: 'flex', gap: '15px', justifyContent: 'center' }}>
                            <button className="btn-3d-blue" style={{ width: '120px' }} onClick={() => { setShowDeleteModal(false); setTemplateToDelete(null); }}>Cancelar</button>
                            <button className="btn-3d-yellow" style={{ width: '120px' }} onClick={performDeleteTemplate}>Excluir</button>
                        </div>
                    </div>
                </div>
            )}

            {showUnsavedModal && (
                <div className="modal-overlay" style={{ zIndex: 10000 }}>
                    <div className="modal-content alert" style={{ maxWidth: '450px', textAlign: 'center' }}>
                        <div style={{ marginBottom: '20px' }}>
                            <div style={{ background: '#fff7ed', width: '60px', height: '60px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 15px' }}>
                                <AlertCircle size={30} color="#ea580c" />
                            </div>
                            <h3 style={{ fontSize: '1.5rem', color: 'var(--ambev-blue)', marginBottom: '10px' }}>Alterações não salvas!</h3>
                            <p style={{ color: '#666', fontSize: '1rem' }}>
                                Você fez alterações no modelo que ainda não foram salvas.
                                Deseja **salvar agora** ou **prosseguir mesmo assim** com a versão atual do editor?
                            </p>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                            <button
                                className="btn-3d-yellow"
                                style={{ width: '100%', height: '45px' }}
                                onClick={async () => {
                                    const success = await saveTemplate();
                                    if (success) {
                                        setShowUnsavedModal(false);
                                        startCampaign(true);
                                    }
                                }}
                            >
                                <Save size={18} /> Salvar e Iniciar Campanha
                            </button>
                            <button
                                className="btn-3d-blue"
                                style={{ width: '100%', height: '45px', background: '#64748b' }}
                                onClick={() => {
                                    setShowUnsavedModal(false);
                                    startCampaign(true);
                                }}
                            >
                                Iniciar sem Salvar
                            </button>
                            <button
                                className="btn-link"
                                style={{ marginTop: '5px', color: '#94a3b8' }}
                                onClick={() => setShowUnsavedModal(false)}
                            >
                                Cancelar
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {selectedLogCampaign && (
                <EmailLogModal
                    campaign={selectedLogCampaign}
                    onClose={() => setSelectedLogCampaign(null)}
                />
            )}
        </div>
    );
}
