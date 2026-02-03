import React from 'react';
import { XCircle, Trash2 } from 'lucide-react';
import BaseNode from './BaseNode';

const CloseAutomationNode = ({ data, id, selected }) => {
    return (
        <BaseNode
            id={id}
            selected={selected}
            type="close"
            title="Fechar Automação"
            icon={XCircle}
            headerClass="close-header"
            onDelete={data.onDelete}
            showSource={false}
        >
            <p className="node-text">Esta ação encerra a sessão ativa do contato no fluxo.</p>
        </BaseNode>
    );
};

export default CloseAutomationNode;
