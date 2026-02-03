import React, { useState, useRef } from 'react';
import { Image as ImageIcon, Plus, RefreshCw, X } from 'lucide-react';
import BaseNode from './BaseNode';

const ImageNode = ({ data, id, selected }) => {
    const [isEditing, setIsEditing] = useState(false);
    const [imageUrls, setImageUrls] = useState(data.imageUrls || (data.imageUrl ? [data.imageUrl] : []));
    const [caption, setCaption] = useState(data.caption || '');
    const [uploading, setUploading] = useState(false);
    const fileInputRef = useRef(null);

    const handleSave = () => {
        data.onChange(id, {
            imageUrls: imageUrls.map(url => url.trim()).filter(Boolean),
            caption,
            hasImage: true
        });
        setIsEditing(false);
    };

    const handleFileUpload = async (e) => {
        const files = Array.from(e.target.files);
        if (!files.length) return;
        setUploading(true);
        const formData = new FormData();
        files.forEach(file => formData.append('images', file));
        try {
            const res = await fetch('/api/upload-image', {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${data.token}` },
                body: formData
            });
            const result = await res.json();
            if (res.ok && result.urls) {
                const newUrls = [...imageUrls, ...result.urls];
                setImageUrls(newUrls);
                data.onChange(id, { imageUrls: newUrls });
            } else if (res.ok && result.url) {
                const newUrls = [...imageUrls, result.url];
                setImageUrls(newUrls);
                data.onChange(id, { imageUrls: newUrls });
            }
        } catch (err) {
            console.error('Upload error:', err);
        } finally {
            setUploading(false);
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    const removeImage = (index) => {
        const newUrls = imageUrls.filter((_, i) => i !== index);
        setImageUrls(newUrls);
        data.onChange(id, { imageUrls: newUrls });
    };

    return (
        <BaseNode
            id={id}
            selected={selected}
            type="image"
            title={`Imagens (${imageUrls.length})`}
            icon={ImageIcon}
            headerClass="image-header"
            isEditing={isEditing}
            onEditToggle={() => setIsEditing(!isEditing)}
            onDelete={data.onDelete}
            showSource={true}
        >
            {isEditing ? (
                <div className="edit-mode nodrag">
                    <div className="upload-section">
                        <input type="file" ref={fileInputRef} onChange={handleFileUpload} accept="image/*" multiple style={{ display: 'none' }} />
                        <button className="btn-upload" onClick={() => fileInputRef.current?.click()} disabled={uploading}>
                            {uploading ? <><RefreshCw className="animate-spin" size={14} /> Enviando...</> : <><Plus size={14} /> Fazer Upload (Múltiplo)</>}
                        </button>
                    </div>
                    <p style={{ fontSize: 10, color: '#666', marginBottom: 4 }}>URLs Manuais (uma por linha):</p>
                    <textarea
                        rows={3}
                        value={imageUrls.join('\n')}
                        onChange={(e) => setImageUrls(e.target.value.split('\n'))}
                        placeholder="URLs (uma por linha)"
                    />
                    <div className="previews-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 4 }}>
                        {imageUrls.filter(u => u.trim()).map((url, i) => (
                            <div key={i} className="preview-item">
                                <img src={url.trim()} alt="preview" />
                                <button onClick={() => removeImage(i)} className="remove-img-btn" style={{ position: 'absolute', top: -4, right: -4, border: 'none', background: 'red', color: 'white', borderRadius: '50%', width: 16, height: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', fontSize: 10 }}>
                                    <X size={10} />
                                </button>
                            </div>
                        ))}
                    </div>
                    <textarea value={caption} onChange={(e) => setCaption(e.target.value)} rows={2} placeholder="Legenda" style={{ marginTop: 8 }} />
                    <button className="btn-small btn-primary" onClick={handleSave} style={{ marginTop: 8, width: '100%' }}>Salvar</button>
                </div>
            ) : (
                <div>
                    {imageUrls.length > 0 ? (
                        <div className="previews-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 4 }}>
                            {imageUrls.slice(0, 4).map((url, i) => (
                                <div key={i} style={{ position: 'relative' }}>
                                    <img src={url} alt="p" style={{ width: '100%', height: 60, objectFit: 'cover', borderRadius: 4 }} />
                                    {i === 3 && imageUrls.length > 4 && (
                                        <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.5)', borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 700, fontSize: 12 }}>
                                            +{imageUrls.length - 4}
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div style={{ background: '#f0f0f0', padding: 20, textAlign: 'center', borderRadius: 6, color: '#999' }}>
                            <ImageIcon size={32} />
                            <p style={{ fontSize: 12, margin: '8px 0 0' }}>Clique em editar para adicionar imagens</p>
                        </div>
                    )}
                    {(caption || data.caption) && <p className="node-text" style={{ marginTop: 8 }}>{caption || data.caption}</p>}
                </div>
            )}
        </BaseNode>
    );
};

export default ImageNode;
