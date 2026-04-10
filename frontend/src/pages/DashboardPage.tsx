import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { apiJson } from '../lib/api';
import { useAuth } from '../contexts/useAuth';
import { useToast } from '../contexts/useToast';

type Project = { id: string; name: string; createdAt: string; updatedAt: string };

export function DashboardPage() {
  const { token } = useAuth();
  const { showError } = useToast();
  const [projects, setProjects] = useState<Project[]>([]);
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!token) return;
    const data = await apiJson<{ projects: Project[] }>('/api/projects', { token });
    setProjects(data.projects);
  }, [token]);

  useEffect(() => {
    void load().catch((e) => showError(e instanceof Error ? e.message : 'Failed to load'));
  }, [load, showError]);

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    if (!token || !name.trim()) return;
    setBusy(true);
    try {
      await apiJson('/api/projects', {
        method: 'POST',
        token,
        body: JSON.stringify({ name: name.trim() }),
      });
      setName('');
      await load();
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Failed');
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    if (!token || !confirm('Delete this project?')) return;
    try {
      await apiJson(`/api/projects/${id}`, { method: 'DELETE', token });
      await load();
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Failed');
    }
  }

  return (
    <div className="page dashboard">
      <header className="page-header">
        <h1>Projects</h1>
        <form onSubmit={onCreate} className="inline-form">
          <input
            placeholder="New project name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
          <button type="submit" disabled={busy}>
            Add
          </button>
        </form>
      </header>
      <ul className="project-list">
        {projects.map((p) => (
          <li key={p.id}>
            <Link to={`/projects/${p.id}`}>{p.name}</Link>
            <button type="button" className="link-danger" onClick={() => void remove(p.id)}>
              Delete
            </button>
          </li>
        ))}
      </ul>
      {projects.length === 0 && <p className="muted">No projects yet.</p>}
    </div>
  );
}
