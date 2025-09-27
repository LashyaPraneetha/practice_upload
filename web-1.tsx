import React, { useEffect, useState, useRef } from "react";
import {
  Table,
  Button,
  Modal,
  Form,
  Input,
  Select,
  Tag,
  Space,
  Popconfirm,
  notification,
  Drawer,
  Typography,
  Tooltip,
  Descriptions,
} from "antd";
import { PlusOutlined, SearchOutlined, PlayCircleOutlined, DeleteOutlined, EyeOutlined } from '@ant-design/icons';

// NOTE: This is a single-file starter React 19 + TypeScript UI using Ant Design.
// - Save as `src/App.tsx` in a React + TypeScript project (React 19).
// - Install dependencies: `antd`, `@ant-design/icons`, `axios` (or use fetch)
// - This file expects a backend API (see the README section at bottom of this file)

// --- Types ---
type RecordType = "character" | "story" | "verse";

export interface RamRecord {
  id: string;
  name: string;
  type: RecordType;
  description?: string;
  tags?: string[];
  createdAt?: string;
}

// --- Helper API wrapper (uses fetch) ---
const api = {
  list: async (query = ""): Promise<RamRecord[]> => {
    const q = query ? `?q=${encodeURIComponent(query)}` : "";
    const res = await fetch(`/api/records${q}`);
    if (!res.ok) throw new Error("Failed to fetch records");
    return res.json();
  },
  create: async (payload: Partial<RamRecord>) => {
    const res = await fetch(`/api/records`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error("Create failed");
    return res.json();
  },
  delete: async (id: string) => {
    const res = await fetch(`/api/records/${id}`, { method: "DELETE" });
    if (!res.ok) throw new Error("Delete failed");
    return res.json();
  },
  runCommand: async (id: string | null, cmd: string) => {
    // POST /api/commands { recordId?, command }
    const res = await fetch(`/api/commands`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ recordId: id, command: cmd }),
    });
    if (!res.ok) throw new Error("Command failed");
    return res.json(); // { output: '...', success: true }
  },
  getOne: async (id: string) => {
    const res = await fetch(`/api/records/${id}`);
    if (!res.ok) throw new Error("Fetch record failed");
    return res.json();
  }
};

// --- Main App ---
export default function App(): JSX.Element {
  const [records, setRecords] = useState<RamRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");

  const [createVisible, setCreateVisible] = useState(false);
  const [createLoading, setCreateLoading] = useState(false);

  const [selectedRecord, setSelectedRecord] = useState<RamRecord | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const [commandModalOpen, setCommandModalOpen] = useState(false);
  const [commandOutput, setCommandOutput] = useState<string | null>(null);
  const [commandRunning, setCommandRunning] = useState(false);

  const createFormRef = useRef<any>(null);

  useEffect(() => {
    fetchRecords();
  }, []);

  async function fetchRecords(q = "") {
    setLoading(true);
    try {
      const list = await api.list(q);
      setRecords(list);
    } catch (e: any) {
      notification.error({ message: "Error fetching records", description: e.message });
    } finally {
      setLoading(false);
    }
  }

  function onSearchChange(value: string) {
    setSearch(value);
  }

  async function doSearch() {
    await fetchRecords(search);
  }

  async function handleCreate(values: any) {
    setCreateLoading(true);
    try {
      const created = await api.create(values);
      notification.success({ message: "Created", description: `${created.name} created.` });
      setCreateVisible(false);
      createFormRef.current?.resetFields();
      fetchRecords();
    } catch (e: any) {
      notification.error({ message: "Create failed", description: e.message });
    } finally {
      setCreateLoading(false);
    }
  }

  async function handleDelete(id: string) {
    try {
      await api.delete(id);
      notification.success({ message: "Deleted" });
      setRecords((prev) => prev.filter(r => r.id !== id));
    } catch (e: any) {
      notification.error({ message: "Delete failed", description: e.message });
    }
  }

  async function openDetails(id: string) {
    setDrawerOpen(true);
    try {
      const rec = await api.getOne(id);
      setSelectedRecord(rec);
    } catch (e: any) {
      notification.error({ message: "Could not load details", description: e.message });
    }
  }

  async function openRunCommand(id?: string) {
    setCommandOutput(null);
    setCommandModalOpen(true);
    setSelectedRecord(id ? records.find(r => r.id === id) ?? null : null);
  }

  async function submitCommand(command: string) {
    setCommandRunning(true);
    try {
      const res = await api.runCommand(selectedRecord?.id ?? null, command);
      // Expecting { output }
      setCommandOutput(typeof res === 'string' ? res : res.output ?? JSON.stringify(res));
    } catch (e: any) {
      setCommandOutput(`Error: ${e.message}`);
    } finally {
      setCommandRunning(false);
    }
  }

  const columns = [
    {
      title: "Name",
      dataIndex: "name",
      key: "name",
      sorter: (a: RamRecord, b: RamRecord) => a.name.localeCompare(b.name),
      render: (text: string, record: RamRecord) => (
        <Button type="link" onClick={() => openDetails(record.id)} aria-label={`View ${record.name}`}>
          {text}
        </Button>
      ),
    },
    { title: "Type", dataIndex: "type", key: "type", filters: [
      { text: 'Character', value: 'character' },
      { text: 'Story', value: 'story' },
      { text: 'Verse', value: 'verse' },
    ], onFilter: (value: any, record: RamRecord) => record.type === value },
    {
      title: "Tags",
      dataIndex: "tags",
      key: "tags",
      render: (tags: string[] | undefined) => (
        <span>
          {(tags || []).slice(0, 3).map(tag => <Tag key={tag}>{tag}</Tag>)}
          {(tags || []).length > 3 && <Tag>+{(tags || []).length - 3}</Tag>}
        </span>
      )
    },
    {
      title: "Actions",
      key: "actions",
      render: (_: any, record: RamRecord) => (
        <Space size="middle" role="group" aria-label={`Actions for ${record.name}`}>
          <Tooltip title="View details">
            <Button icon={<EyeOutlined/>} onClick={() => openDetails(record.id)} aria-label={`View ${record.name}`} />
          </Tooltip>
          <Tooltip title="Run command against this record">
            <Button icon={<PlayCircleOutlined/>} onClick={() => openRunCommand(record.id)} aria-label={`Run command for ${record.name}`} />
          </Tooltip>
          <Popconfirm title={`Delete ${record.name}?`} onConfirm={() => handleDelete(record.id)} okText="Delete" cancelText="Cancel">
            <Button danger icon={<DeleteOutlined/>} aria-label={`Delete ${record.name}`} />
          </Popconfirm>
        </Space>
      )
    }
  ];

  return (
    <div style={{ padding: 20 }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginBottom: 16 }}>
        <div>
          <Typography.Title level={3} style={{ margin: 0 }}>Ramayana Explorer — Records</Typography.Title>
          <Typography.Text type="secondary">Create, search, inspect and run commands on records (accessible UI)</Typography.Text>
        </div>

        <div style={{ display: 'flex', gap: 8 }}>
          <Input
            placeholder="Search by name, tag or description"
            prefix={<SearchOutlined />}
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            onPressEnter={doSearch}
            aria-label="Search records"
            style={{ width: 320 }}
          />
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateVisible(true)} aria-label="Create record">Create</Button>
        </div>
      </header>

      <main>
        <Table<RamRecord>
          dataSource={records}
          columns={columns}
          rowKey={r => r.id}
          loading={loading}
          pagination={{ pageSize: 8 }}
          locale={{ emptyText: 'No records found — try creating one.' }}
        />
      </main>

      {/* Create Modal */}
      <Modal
        title="Create a new record"
        open={createVisible}
        onCancel={() => setCreateVisible(false)}
        footer={null}
        destroyOnClose
        aria-labelledby="create-record-title"
      >
        <Form layout="vertical" onFinish={handleCreate} ref={createFormRef}>
          <Form.Item name="name" label="Name" rules={[{ required: true, message: 'Please provide a name' }]}>
            <Input autoFocus aria-required />
          </Form.Item>

          <Form.Item name="type" label="Type" initialValue="character" rules={[{ required: true }]}>
            <Select aria-label="Select record type">
              <Select.Option value="character">Character</Select.Option>
              <Select.Option value="story">Story</Select.Option>
              <Select.Option value="verse">Verse</Select.Option>
            </Select>
          </Form.Item>

          <Form.Item name="description" label="Short description">
            <Input.TextArea rows={4} aria-label="Description" />
          </Form.Item>

          <Form.Item name="tags" label="Tags (comma separated)">
            <Input placeholder="tag1, tag2" aria-label="Tags" />
          </Form.Item>

          <Form.Item>
            <Space style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <Button onClick={() => setCreateVisible(false)}>Cancel</Button>
              <Button type="primary" htmlType="submit" loading={createLoading}>Create</Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      {/* Command Modal */}
      <Modal
        title={selectedRecord ? `Run command for ${selectedRecord.name}` : 'Run command'}
        open={commandModalOpen}
        onCancel={() => setCommandModalOpen(false)}
        footer={null}
        width={720}
      >
        <CommandRunner
          onRun={submitCommand}
          running={commandRunning}
          output={commandOutput}
        />
      </Modal>

      {/* Details Drawer */}
      <Drawer
        title={selectedRecord?.name}
        placement="right"
        onClose={() => { setDrawerOpen(false); setSelectedRecord(null); }}
        open={drawerOpen}
        width={520}
        aria-labelledby="record-details"
      >
        {selectedRecord ? (
          <Descriptions column={1} bordered>
            <Descriptions.Item label="Name">{selectedRecord.name}</Descriptions.Item>
            <Descriptions.Item label="Type">{selectedRecord.type}</Descriptions.Item>
            <Descriptions.Item label="Description">{selectedRecord.description || '—'}</Descriptions.Item>
            <Descriptions.Item label="Tags">{(selectedRecord.tags || []).map(t => <Tag key={t}>{t}</Tag>)}</Descriptions.Item>
            <Descriptions.Item label="Created">{selectedRecord.createdAt || 'Unknown'}</Descriptions.Item>
          </Descriptions>
        ) : (
          <div>Loading…</div>
        )}

        <div style={{ marginTop: 16, display: 'flex', justifyContent: 'flex-end' }}>
          <Button type="primary" onClick={() => openRunCommand(selectedRecord?.id)} icon={<PlayCircleOutlined/>}>Run Command</Button>
        </div>
      </Drawer>

    </div>
  );
}

// --- CommandRunner Component ---
function CommandRunner({ onRun, running, output }: { onRun: (cmd: string) => Promise<void>, running: boolean, output: string | null }) {
  const [cmd, setCmd] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    if (!running && textareaRef.current) textareaRef.current.focus();
  }, [running]);

  return (
    <div>
      <label htmlFor="command-input" style={{ display: 'block', marginBottom: 8 }}>Command (plain text)</label>
      <Input.TextArea
        id="command-input"
        ref={textareaRef}
        rows={4}
        value={cmd}
        onChange={(e) => setCmd(e.target.value)}
        placeholder="e.g., summarize --id=123 or fetch-related-episodes"
        aria-label="Command input"
        onKeyDown={(e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); onRun(cmd); } }}
      />

      <div style={{ display: 'flex', gap: 8, marginTop: 12, justifyContent: 'flex-end' }}>
        <Button onClick={() => { setCmd(''); }} disabled={running}>Clear</Button>
        <Button type="primary" onClick={() => onRun(cmd)} loading={running} icon={<PlayCircleOutlined/>} aria-label="Run command">Run</Button>
      </div>

      <div style={{ marginTop: 16 }}>
        <Typography.Title level={5}>Output</Typography.Title>
        <div role="status" aria-live="polite" style={{ whiteSpace: 'pre-wrap', background: '#fafafa', padding: 12, borderRadius: 6, minHeight: 120 }}>
          {running ? 'Running…' : (output ?? 'No output yet — run a command.')}
        </div>
      </div>
    </div>
  );
}

/*
README / Backend contract (expected endpoints)

GET  /api/records?q=search        -> returns array of RamRecord
POST /api/records                 -> create record (body: { name, type, description, tags (comma string) }) -> returns created record
GET  /api/records/:id             -> returns record
DELETE /api/records/:id           -> deletes record
POST /api/commands                -> run a command. body: { recordId?, command } -> returns { output: string, success: boolean }

Accessibility & Usability notes (what I implemented):
- All interactive controls have aria-labels or visible labels.
- Keyboard-friendly: Enter to search, Ctrl/Cmd+Enter to submit commands.
- Focus management: text area gets focus after command completes; modal focuses first field on open.
- Responsive: Uses Ant Design responsive components (Table + Drawer) and a fluid layout.
- Table accessible: buttons are real buttons, grouped with role="group" and aria-labels.
- Error handling: notification messages for API failures.

How to integrate quickly:
1. Create a React + TypeScript app and put this file at `src/App.tsx`.
2. `npm i antd @ant-design/icons` (and optionally `axios`).
3. Ensure your backend implements the endpoints above.
4. Start and enjoy.

Optional improvements you might add:
- Server-sent events / WebSocket for live command output streaming.
- Pagination & server-side sorting/filtering for large datasets.
- Edit/update record flow.
- Unit & integration tests for components.
*/
