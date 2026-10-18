"use client";
import { useMemo, useState, useEffect, useCallback } from "react";
import { useReducedMotion } from "framer-motion";
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  Handle,
  Position,
  Panel,
  MarkerType,
  type Connection,
  type NodeProps,
  type Node,
  type Edge,
  BackgroundVariant,
  applyNodeChanges,
  type NodeChange,
  type ReactFlowInstance,
} from "@xyflow/react";
import {
  Flame,
  EyeOff,
  ChevronDown,
  ChevronUp,
  Moon,
  GitBranch,
  Combine,
  Unlink,
  Link2,
} from "lucide-react";
import "@xyflow/react/dist/style.css";
import "@/app/idea-connections.css";
import type { Concept, VoteCount, IdeaConnection } from "@/lib/types";
type Data = Record<string, unknown> & {
  concept: Concept;
  votes: VoteCount;
  masked: boolean;
  revealed: boolean;
  myVote?: string;
  inheritedSources: { title: string; contribution: string }[];
  keyboardSource: string | null;
  onKeyConnect: (id: string, type: "source" | "target") => void;
  onVote: (id: string, value: "fire" | "pass") => void;
};
function IdeaCard({ data, selected }: NodeProps<Node<Data>>) {
  const [expanded, setExpanded] = useState(false);
  const c = data.concept;
  const polar = data.votes.fire > 0 && data.votes.pass > 0;
  return (
    <div
      className={`idea-node ${selected ? "node-selected" : ""} ${data.revealed && data.votes.fire > 0 ? (polar ? "polarized" : "consensus") : ""}`}
      style={{ opacity: c.dimmed ? 0.25 : 1 }}
    >
      <Handle
        type="target"
        position={Position.Top}
        className="idea-handle"
        role="button"
        tabIndex={0}
        aria-label={`Connect to ${c.title}`}
        title="Drop a line here, or click after choosing a bottom dot"
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            event.stopPropagation();
            data.onKeyConnect(c.id, "target");
          }
        }}
      />
      <div className="node-eyebrow">
        <span>
          <GitBranch size={12} />
          {c.parentId ? c.mutation || "MUTATION" : "ROOT CONCEPT"}
        </span>
        <span className="node-testing-status">
          {c.source === "demo" ? "Demo · untested" : "Needs testing"}
        </span>
      </div>
      <h3>{c.title}</h3>
      <p className={expanded ? "" : "node-copy-collapsed"}>{c.pitch}</p>
      <div className="node-mechanism">
        <span>What makes it different</span>
        <p className={expanded ? "" : "node-copy-collapsed"}>
          {c.mechanism ||
            "Mechanism not yet assessed. Open this idea to compare and test it."}
        </p>
      </div>
      <div className="parent-badges">
        {c.perspectives.slice(0, 3).map((p) => (
          <span key={p}>{p}</span>
        ))}
      </div>
      <button
        className="node-detail nodrag"
        onClick={() => setExpanded(!expanded)}
        aria-expanded={expanded}
        aria-controls={`idea-details-${c.id}`}
      >
        Reasons, assumptions & sources{" "}
        {expanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
      </button>
      {expanded && (
        <div className="node-pros" id={`idea-details-${c.id}`}>
          {c.pros.map((p, i) => (
            <p key={i} className="positive">
              + {p}
            </p>
          ))}
          {c.cons.map((p, i) => (
            <p key={i}>− {p}</p>
          ))}
          {Boolean(c.assumptions?.length) && (
            <div className="node-detail-section">
              <h4>Assumptions to test</h4>
              <ul>
                {c.assumptions?.map((assumption, i) => (
                  <li key={i}>{assumption}</li>
                ))}
              </ul>
            </div>
          )}
          {data.inheritedSources.length > 0 && (
            <div className="node-detail-section">
              <h4>What each source contributes</h4>
              <dl>
                {data.inheritedSources.map((source, i) => (
                  <div key={i}>
                    <dt>{source.title}</dt>
                    <dd>{source.contribution}</dd>
                  </div>
                ))}
              </dl>
            </div>
          )}
        </div>
      )}
      <div className="node-votes nodrag">
        <button
          aria-label={`Vote for ${c.title}`}
          className={data.myVote === "fire" ? "voted" : ""}
          onClick={() => data.onVote(c.id, "fire")}
        >
          <Flame size={15} />
          {data.masked ? <EyeOff size={12} /> : data.votes.fire} <span>+1</span>
        </button>
        <button
          aria-label={`Pass on ${c.title}`}
          className={data.myVote === "pass" ? "voted" : ""}
          onClick={() => data.onVote(c.id, "pass")}
        >
          <Moon size={14} />
          Pass {data.masked ? "" : data.votes.pass || ""}
        </button>
        {c.dimmed && <span className="pruned-label">Pruned</span>}
      </div>
      <Handle
        type="source"
        position={Position.Bottom}
        className={`idea-handle ${data.keyboardSource === c.id ? "connection-start" : ""}`}
        role="button"
        tabIndex={0}
        aria-label={`Connect from ${c.title}`}
        title="Drag to another idea’s top dot, or click to start a line"
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            event.stopPropagation();
            data.onKeyConnect(c.id, "source");
          }
        }}
      />
    </div>
  );
}
const nodeTypes = { idea: IdeaCard };
const noConnections: IdeaConnection[] = [];
export default function IdeaTree({
  concepts,
  connections = noConnections,
  onConnect,
  onRemoveConnections,
  onCombine,
  busy = false,
  selectedId,
  onSelect,
  onMove,
  votes,
  myVotes,
  masked,
  revealed,
  onVote,
}: {
  concepts: Concept[];
  connections?: IdeaConnection[];
  onConnect: (source: string, target: string) => void;
  onRemoveConnections: (ids: string[]) => void;
  onCombine?: (sourceId: string, targetId: string) => void;
  busy?: boolean;
  selectedId: string | null;
  onSelect: (id: string) => void;
  onMove: (id: string, x: number, y: number) => void;
  votes: Record<string, VoteCount>;
  myVotes: Record<string, string>;
  masked: boolean;
  revealed: boolean;
  onVote: Data["onVote"];
}) {
  const reduceMotion = useReducedMotion();
  const [selectedEdge, setSelectedEdge] = useState<string | null>(null);
  const [keyboardSource, setKeyboardSource] = useState<string | null>(null);
  const isValidConnection = useCallback(
    ({ source, target }: Connection | Edge) =>
      connections.length < 300 &&
      source !== target &&
      concepts.some((c) => c.id === source) &&
      concepts.some((c) => c.id === target) &&
      !concepts.some((c) => c.id === target && c.parentId === source) &&
      !connections.some((c) => c.source === source && c.target === target),
    [concepts, connections],
  );
  const handleConnect = useCallback(
    ({ source, target }: Connection) => {
      if (
        isValidConnection({
          source,
          target,
          sourceHandle: null,
          targetHandle: null,
        })
      )
        onConnect(source, target);
      setKeyboardSource(null);
    },
    [isValidConnection, onConnect],
  );
  const onKeyConnect = useCallback(
    (id: string, type: "source" | "target") => {
      if (type === "source") setKeyboardSource(id);
      else if (keyboardSource)
        handleConnect({
          source: keyboardSource,
          target: id,
          sourceHandle: null,
          targetHandle: null,
        });
    },
    [keyboardSource, handleConnect],
  );
  const nodes = useMemo(
    () =>
      concepts.map((concept, i) => ({
        id: concept.id,
        type: "idea",
        deletable: false,
        selected: selectedId === concept.id,
        position: { x: concept.x ?? i * 380, y: concept.y ?? 40 },
        data: {
          concept,
          votes: votes[concept.id] || { fire: 0, pass: 0 },
          myVote: myVotes[concept.id],
          inheritedSources: (concept.inheritedFrom || []).map((source) => ({
            title:
              concepts.find((c) => c.id === source.conceptId)?.title ||
              "Earlier idea",
            contribution: source.contribution,
          })),
          masked,
          revealed,
          onVote,
          keyboardSource,
          onKeyConnect,
        },
      })),
    [
      concepts,
      selectedId,
      votes,
      myVotes,
      masked,
      revealed,
      onVote,
      keyboardSource,
      onKeyConnect,
    ],
  );
  const [instance, setInstance] = useState<ReactFlowInstance | null>(null);
  const [flowNodes, setFlowNodes] = useState<Node<Data>[]>(nodes);
  useEffect(
    () =>
      setFlowNodes((current) =>
        nodes.map((node) => {
          const previous = current.find((n) => n.id === node.id);
          return { ...node, measured: previous?.measured };
        }),
      ),
    [nodes],
  );
  useEffect(() => {
    if (!instance) return;
    const frame = requestAnimationFrame(
      () =>
        void instance.fitView({
          padding: 0.18,
          duration: reduceMotion ? 0 : 300,
        }),
    );
    return () => cancelAnimationFrame(frame);
  }, [instance, flowNodes.length, reduceMotion]);
  const handleNodesChange = (changes: NodeChange[]) =>
    setFlowNodes(
      (current) => applyNodeChanges(changes, current) as typeof current,
    );
  const edges: Edge[] = useMemo(
    () =>
      concepts
        .filter((c) => c.parentId)
        .map((c) => ({
          id: `mutation:${c.parentId}:${c.id}`,
          deletable: false,
          reconnectable: false,
          source: c.parentId!,
          target: c.id,
          animated: !c.dimmed && !reduceMotion,
          type: "smoothstep",
          style: {
            stroke: c.dimmed ? "#deddd8" : "#a8aaa7",
            strokeWidth: 1.5,
          },
        })),
    [concepts, reduceMotion],
  );
  const manualEdges: Edge[] = connections.map((connection) => ({
    id: `manual:${connection.id}`,
    source: connection.source,
    target: connection.target,
    data: { connectionId: connection.id },
    type: "smoothstep",
    selected: selectedEdge === `manual:${connection.id}`,
    deletable: true,
    reconnectable: false,
    interactionWidth: 28,
    ariaLabel: `Connection from ${concepts.find((c) => c.id === connection.source)?.title} to ${concepts.find((c) => c.id === connection.target)?.title}`,
    style: {
      stroke: "#2864d8",
      strokeWidth: selectedEdge === `manual:${connection.id}` ? 3 : 2,
    },
    markerEnd: {
      type: MarkerType.ArrowClosed,
      color: "#2864d8",
      width: 16,
      height: 16,
    },
  }));
  const selectedConnection = connections.find(
    (c) => `manual:${c.id}` === selectedEdge,
  );
  const selectedSource = concepts.find(
    (c) => c.id === selectedConnection?.source,
  );
  const selectedTarget = concepts.find(
    (c) => c.id === selectedConnection?.target,
  );
  return (
    <ReactFlow
      onInit={setInstance}
      nodes={flowNodes}
      onNodesChange={handleNodesChange}
      edges={[...edges, ...manualEdges]}
      onConnect={handleConnect}
      isValidConnection={isValidConnection}
      connectOnClick
      connectionRadius={36}
      connectionDragThreshold={1}
      connectionLineStyle={{ stroke: "#2864d8", strokeWidth: 2 }}
      onEdgesChange={(changes) => {
        for (const change of changes)
          if (change.type === "select") {
            setSelectedEdge((current) =>
              change.selected
                ? change.id
                : current === change.id
                  ? null
                  : current,
            );
          }
      }}
      onEdgesDelete={(deleted) => {
        onRemoveConnections(
          deleted.flatMap((edge) =>
            typeof edge.data?.connectionId === "string"
              ? [edge.data.connectionId]
              : [],
          ),
        );
        setSelectedEdge(null);
      }}
      onEdgeClick={(_, edge) => setSelectedEdge(edge.id)}
      onPaneClick={() => {
        setSelectedEdge(null);
        setKeyboardSource(null);
      }}
      deleteKeyCode={["Backspace", "Delete"]}
      onKeyDown={(event) => {
        if (event.key === "Escape") setKeyboardSource(null);
      }}
      nodeTypes={nodeTypes}
      onNodeClick={(_, n) => {
        setSelectedEdge(null);
        onSelect(n.id);
      }}
      onNodeDragStop={(_, n) => onMove(n.id, n.position.x, n.position.y)}
      fitView
      fitViewOptions={{ padding: 0.2 }}
      minZoom={0.25}
      maxZoom={1.5}
      colorMode="light"
      style={{ backgroundColor: "#f7f7f4" }}
      proOptions={{ hideAttribution: true }}
    >
      <Panel
        position="top-left"
        className={`canvas-connection-bar ${selectedConnection ? "connection-selected" : ""}`}
      >
        <span role="status">
          <Link2 size={14} />
          {keyboardSource
            ? "Choose another idea’s top dot, then press Enter."
            : "Drag bottom dot → top dot to connect. Or click each dot."}
        </span>
        {selectedConnection && selectedSource && selectedTarget && (
          <div className="connection-selection">
            <p className="connection-pair">
              <strong>{selectedSource.title}</strong>
              <span aria-hidden="true">+</span>
              <strong>{selectedTarget.title}</strong>
            </p>
            {onCombine && (
              <p className="connection-description">
                Create a new idea that keeps a contribution from each source.
              </p>
            )}
            <div className="connection-actions">
              {onCombine && (
                <button
                  className="button button-lime button-small"
                  disabled={busy}
                  onClick={() =>
                    onCombine(
                      selectedConnection.source,
                      selectedConnection.target,
                    )
                  }
                >
                  <Combine size={14} />
                  {busy ? "Combining ideas…" : "Combine these ideas"}
                </button>
              )}
              <button
                className="button button-small"
                onClick={() => {
                  onRemoveConnections([selectedConnection.id]);
                  setSelectedEdge(null);
                }}
              >
                <Unlink size={14} />
                Remove connection
              </button>
            </div>
          </div>
        )}
      </Panel>
      <Background
        variant={BackgroundVariant.Dots}
        gap={22}
        size={1}
        color="#d9d9d3"
      />
      <Controls showInteractive={false} />
      <MiniMap
        nodeColor={(n) => (n.selected ? "#1671e8" : "#b4b7b4")}
        nodeStrokeColor={(n) => (n.selected ? "#0e5bc0" : "#8c908c")}
        nodeStrokeWidth={2}
        bgColor="#efefeb"
        maskColor="rgba(247,247,244,.7)"
      />
    </ReactFlow>
  );
}
