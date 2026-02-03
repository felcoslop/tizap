import React from 'react';
import { Handle, Position } from 'reactflow';
import { Trash2, Edit3 } from 'lucide-react';

const BaseNode = ({
    id,
    selected,
    type,
    title,
    icon: Icon,
    headerClass = '',
    isEditing,
    onEditToggle,
    onDelete,
    children,
    showTarget = true,
    showSource = false,
    sourceId = 'source-gray',
    sourceColor = '#6c757d',
    sourceStyle = {}
}) => {
    return (
        <div className={`flow-node ${type}-node ${selected ? 'selected' : ''}`}>
            {showTarget && (
                <Handle
                    type="target"
                    position={Position.Top}
                    id="target"
                    style={{ background: '#555', width: 14, height: 14, border: '2px solid #333', zIndex: 10 }}
                />
            )}

            <div className={`node-header ${headerClass}`}>
                {Icon && <Icon size={16} />}
                <span>{title}</span>
                <div className="node-header-btns">
                    {onEditToggle && (
                        <button className="node-edit-btn" onClick={onEditToggle} title="Editar">
                            <Edit3 size={12} />
                        </button>
                    )}
                    <button className="node-delete-btn" onClick={() => onDelete(id)} title="Excluir">
                        <Trash2 size={12} />
                    </button>
                </div>
            </div>

            <div className="node-content">
                {children}
            </div>

            {showSource && (
                <div className="handles-row">
                    <Handle
                        type="source"
                        position={Position.Bottom}
                        id={sourceId}
                        style={{ background: sourceColor, width: 14, height: 14, border: '2px solid #333', zIndex: 10, ...sourceStyle }}
                    />
                </div>
            )}
        </div>
    );
};

export default BaseNode;
