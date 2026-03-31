'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  type Node,
  type Edge,
  MarkerType,
  Position,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import dagre from '@dagrejs/dagre';
import type { Participant, CommunicationEdge as CommEdge } from '@/types/lineage';
import { PersonNode } from './person-node';

const nodeTypes = { person: PersonNode };

const NODE_WIDTH = 180;
const NODE_HEIGHT = 80;

function layoutGraph(
  nodes: Node[],
  edges: Edge[],
): { nodes: Node[]; edges: Edge[] } {
  const g = new dagre.graphlib.Graph();
  g.setDefaultEdgeLabel(() => ({}));
  g.setGraph({ rankdir: 'LR', ranksep: 120, nodesep: 60 });

  nodes.forEach((node) => {
    g.setNode(node.id, { width: NODE_WIDTH, height: NODE_HEIGHT });
  });

  edges.forEach((edge) => {
    g.setEdge(edge.source, edge.target);
  });

  dagre.layout(g);

  const layoutedNodes = nodes.map((node) => {
    const n = g.node(node.id);
    return {
      ...node,
      position: { x: n.x - NODE_WIDTH / 2, y: n.y - NODE_HEIGHT / 2 },
      sourcePosition: Position.Right,
      targetPosition: Position.Left,
    };
  });

  return { nodes: layoutedNodes, edges };
}

export function CommunicationGraph({ ticketId }: { ticketId: string }) {
  const [nodes, setNodes] = useState<Node[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchGraph = useCallback(async () => {
    setLoading(true);
    try {
      // Fetch participants
      const pRes = await fetch(`/api/tickets/${ticketId}/emails`);
      const emails = await pRes.json();

      if (!emails.length) {
        setNodes([]);
        setEdges([]);
        setLoading(false);
        return;
      }

      // Fetch participants from a separate endpoint or build from emails
      const participantRes = await fetch(`/api/tickets/${ticketId}/graph`);
      if (!participantRes.ok) {
        setLoading(false);
        return;
      }

      const { participants, edges: commEdges } = await participantRes.json() as {
        participants: Participant[];
        edges: CommEdge[];
      };

      // Build nodes
      const graphNodes: Node[] = participants.map((p) => ({
        id: p.id,
        type: 'person',
        data: {
          name: p.name,
          title: p.title || '',
          department: p.department || '',
          email: p.email || '',
        },
        position: { x: 0, y: 0 },
      }));

      // Build edges - aggregate bidirectional
      const edgeMap = new Map<string, { from: string; to: string; count: number; reverse: number }>();

      for (const e of commEdges) {
        const key = [e.from_participant_id, e.to_participant_id].sort().join('-');
        if (!edgeMap.has(key)) {
          edgeMap.set(key, { from: e.from_participant_id, to: e.to_participant_id, count: 0, reverse: 0 });
        }
        const entry = edgeMap.get(key)!;
        if (e.from_participant_id === entry.from) {
          entry.count++;
        } else {
          entry.reverse++;
        }
      }

      const graphEdges: Edge[] = [...edgeMap.entries()].map(([key, val]) => {
        const isBidirectional = val.count > 0 && val.reverse > 0;
        return {
          id: key,
          source: val.from,
          target: val.to,
          label: isBidirectional ? `${val.count} / ${val.reverse}` : `${val.count + val.reverse}`,
          style: { stroke: '#00ffff', strokeWidth: 2 },
          labelStyle: { fill: '#6080a0', fontSize: 10 },
          markerEnd: { type: MarkerType.ArrowClosed, color: '#00ffff', width: 15, height: 15 },
          markerStart: isBidirectional
            ? { type: MarkerType.ArrowClosed, color: '#00ffff', width: 15, height: 15 }
            : undefined,
        };
      });

      const { nodes: ln, edges: le } = layoutGraph(graphNodes, graphEdges);
      setNodes(ln);
      setEdges(le);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [ticketId]);

  useEffect(() => {
    fetchGraph();
  }, [fetchGraph]);

  if (loading) {
    return (
      <div className="glass rounded-lg border border-border p-8 text-center">
        <div className="text-neon-cyan neon-pulse text-xs tracking-widest">
          BUILDING COMMUNICATION NETWORK...
        </div>
      </div>
    );
  }

  if (nodes.length === 0) {
    return (
      <div className="glass rounded-lg border border-dashed border-border p-8 text-center">
        <p className="text-muted-foreground text-xs tracking-wider">
          NO COMMUNICATION DATA — UPLOAD EMAILS TO BUILD GRAPH
        </p>
      </div>
    );
  }

  return (
    <div className="glass rounded-lg border border-border overflow-hidden" style={{ height: 400 }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        fitView
        proOptions={{ hideAttribution: true }}
        style={{ background: 'transparent' }}
      >
        <Background color="rgba(0,255,255,0.05)" gap={30} />
        <Controls
          style={{ background: 'rgba(10,10,30,0.8)', border: '1px solid rgba(0,255,255,0.2)', borderRadius: 4 }}
        />
      </ReactFlow>
    </div>
  );
}
