import { useState, useCallback } from 'react';
import { applyNodeChanges, applyEdgeChanges, addEdge, MarkerType } from 'reactflow';

/**
 * Custom hook to manage React Flow state and common operations
 * for both FlowBuilder and AutomationBuilder.
 */
export const useFlowEditor = (options = {}) => {
    const [nodes, setNodes] = useState([]);
    const [edges, setEdges] = useState([]);
    const [reactFlowInstance, setReactFlowInstance] = useState(null);

    const onNodesChange = useCallback(
        (changes) => setNodes((nds) => applyNodeChanges(changes, nds)),
        []
    );

    const onEdgesChange = useCallback(
        (changes) => setEdges((eds) => applyEdgeChanges(changes, eds)),
        []
    );

    const handleNodeDataChange = useCallback((nodeId, newData) => {
        setNodes((nds) =>
            nds.map((node) => {
                if (node.id === nodeId) {
                    return { ...node, data: { ...node.data, ...newData } };
                }
                return node;
            })
        );
    }, []);

    const handleDeleteNode = useCallback((nodeId) => {
        setNodes((nds) => nds.filter((node) => String(node.id) !== String(nodeId)));
        setEdges((eds) => eds.filter((edge) => String(edge.source) !== String(nodeId) && String(edge.target) !== String(nodeId)));
    }, []);

    const onConnect = useCallback((params) => {
        const { defaultColor = '#6c757d' } = options;

        let edgeStyle = { stroke: defaultColor, strokeWidth: 2 };

        // Custom coloring based on handles
        if (params.sourceHandle?.includes('green')) edgeStyle = { stroke: '#00a276', strokeWidth: 2 };
        else if (params.sourceHandle?.includes('red')) edgeStyle = { stroke: '#dc3545', strokeWidth: 2 };
        else if (params.sourceHandle?.includes('source-') && !params.sourceHandle.includes('gray')) {
            edgeStyle = { stroke: '#fecb00', strokeWidth: 2 };
        }

        setEdges((eds) => {
            // Remove existing edge from the same source handle (single output rule)
            const filteredEdges = eds.filter(e => {
                const sameSource = String(e.source) === String(params.source);
                const sameHandle = String(e.sourceHandle) === String(params.sourceHandle);
                return !(sameSource && sameHandle);
            });

            return addEdge({
                ...params,
                id: `edge-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
                type: 'smoothstep',
                animated: true,
                style: edgeStyle,
                markerEnd: { type: MarkerType.ArrowClosed, color: edgeStyle.stroke }
            }, filteredEdges);
        });
    }, [options]);

    return {
        nodes,
        setNodes,
        edges,
        setEdges,
        onNodesChange,
        onEdgesChange,
        onConnect,
        reactFlowInstance,
        setReactFlowInstance,
        handleNodeDataChange,
        handleDeleteNode
    };
};
