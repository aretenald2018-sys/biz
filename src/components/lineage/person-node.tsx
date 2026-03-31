'use client';

import { Handle, Position, type NodeProps } from '@xyflow/react';

interface PersonNodeData {
  name: string;
  title: string;
  department: string;
  email: string;
  [key: string]: unknown;
}

export function PersonNode({ data }: NodeProps) {
  const d = data as PersonNodeData;
  return (
    <div className="glass rounded-lg px-4 py-3 min-w-[160px] border border-neon-cyan/20 hover:glow-cyan transition-all">
      <Handle type="target" position={Position.Left} className="!bg-neon-cyan !border-neon-cyan/50 !w-2 !h-2" />
      <Handle type="source" position={Position.Right} className="!bg-neon-cyan !border-neon-cyan/50 !w-2 !h-2" />

      <div className="text-xs font-bold text-neon-cyan text-glow-cyan">
        {d.name}
      </div>
      {d.title && (
        <div className="text-[10px] text-neon-amber mt-0.5">
          {d.title}
        </div>
      )}
      {d.department && (
        <div className="text-[10px] text-muted-foreground mt-0.5">
          {d.department}
        </div>
      )}
      {d.email && (
        <div className="text-[9px] text-muted-foreground/50 mt-1 truncate max-w-[140px]">
          {d.email}
        </div>
      )}
    </div>
  );
}
