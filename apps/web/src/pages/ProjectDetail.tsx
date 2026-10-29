import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, ExternalLink, History, Pencil, Plus, Search, Trash2 } from "lucide-react";
import { api, errMsg } from "../lib/api";
import {
  PRIORITY_LABEL,
  PRIORITY_STYLE,
  STATUS_LABEL,
  STATUS_STYLE,
  TYPE_LABEL,
  type Paged,
  type Project,
  type Requirement,
} from "../lib/types";
import { useDebounce } from "../lib/useDebounce";
import HistoryModal from "../components/HistoryModal";
import Pagination from "../components/Pagination";
import RequirementForm from "../components/RequirementForm";

const PAGE_SIZE = 10;

export default function ProjectDetail() {
  const { id = "" } = useParams<{ id: string }>();
  const [project, setProject] = useState<Project | null>(null);
  const [projectError, setProjectError] = useState<string | null>(null);

  const [q, setQ] = useState("");
  const dq = useDebounce(q, 300);
  const [status, setStatus] = useState("");
  const [priority, setPriority] = useState("");
  const [type, setType] = useState("");
  const [page, setPage] = useState(1);
  const [list, setList] = useState<{ loading: boolean; error: string | null; data: Paged<Requirement> | null }>({
    loading: true,
    error: null,
    data: null,
  });

  const [editing, setEditing] = useState<Requirement | "new" | null>(null);
  const [historyOf, setHistoryOf] = useState<Requirement | null>(null);

  const loadProject = useCallback(() => {
    api<Project>(`/projects/${id}`)
      .then(setProject)
      .catch((e) => setProjectError(errMsg(e)));
  }, [id]);

  const loadList = useCallback(async () => {
    setList((s) => ({ ...s, loading: true, error: null }));
    try {
      const params = new URLSearchParams({ page: String(page), pageSize: String(PAGE_SIZE) });
      if (dq) params.set("q", dq);
      if (status) params.set("status", status);
      if (priority) params.set("priority", priority);
      if (type) params.set("type", type);
      const data = await api<Paged<Requirement>>(`/projects/${id}/requirements?${params}`);
      setList({ loading: false, error: null, data });
    } catch (e) {
      setList((s) => ({ ...s, loading: false, error: errMsg(e) }));
    }
  }, [id, page, dq, status, priority, type]);

  useEffect(loadProject, [loadProject]);
  useEffect(() => {
    loadList();
  }, [loadList]);
  useEffect(() => setPage(1), [dq, status, priority, type]);

  async function remove(r: Requirement) {
    if (!window.confirm(`Excluir ${r.code}? Ele sai das listas, mas o histórico é preservado.`)) return;
    try {
      await api(`/projects/${id}/requirements/${r.id}`, { method: "DELETE" });
      loadList();
      loadProject();
    } catch (e) {
      setList((s) => ({ ...s, error: errMsg(e) }));
    }
  }

  if (projectError) {
    return (
      <div className="mx-auto max-w-5xl">
        <p role="alert" className="text-sm text-red-300">{projectError}</p>
        <Link to="/" className="mt-3 inline-block text-sm text-brand-300 hover:underline">Voltar aos projetos</Link>
      </div>
    );
  }
  if (!project) return <p className="text-sm text-zinc-400">Carregando...</p>;

  const archived = project.status === "ARCHIVED";
  const { loading, error, data } = list;
  const hasFilters = Boolean(dq || status || priority || type);

  return (
    <div className="mx-auto max-w-5xl">
      <Link to="/" className="mb-4 inline-flex items-center gap-1 text-sm text-zinc-400 hover:text-zinc-100">
        <ArrowLeft className="h-4 w-4" aria-hidden /> Projetos
      </Link>

      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-semibold">{project.name}</h1>
            {archived && <span className="badge bg-zinc-700/40 text-zinc-300">Arquivado</span>}
          </div>
          {project.description && <p className="mt-1 text-sm text-zinc-400">{project.description}</p>}
          {project.objective && (
            <p className="mt-1 text-sm text-zinc-400"><span className="text-zinc-300">Objetivo:</span> {project.objective}</p>
          )}
          <p className="mt-2 text-xs text-zinc-500">
            {project._count?.requirements ?? 0} requisitos · {project._count?.testCases ?? 0} casos de teste
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link to={`/projects/${id}/qa`} className="btn btn-ghost"><ExternalLink className="h-4 w-4" aria-hidden /> Espaço QA</Link>
          <button className="btn btn-primary" disabled={archived} onClick={() => setEditing("new")} title={archived ? "Projeto arquivado" : undefined}>
            <Plus className="h-4 w-4" aria-hidden /> Novo requisito
          </button>
        </div>
      </div>

      <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="relative sm:col-span-2 lg:col-span-1">
          <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-zinc-500" aria-hidden />
          <input className="input pl-9" placeholder="Pesquisar" aria-label="Pesquisar requisitos" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <select className="input" aria-label="Filtrar por status" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">Todos os status</option>
          {Object.entries(STATUS_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
        <select className="input" aria-label="Filtrar por prioridade" value={priority} onChange={(e) => setPriority(e.target.value)}>
          <option value="">Todas as prioridades</option>
          {Object.entries(PRIORITY_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
        <select className="input" aria-label="Filtrar por tipo" value={type} onChange={(e) => setType(e.target.value)}>
          <option value="">Todos os tipos</option>
          {Object.entries(TYPE_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
      </div>

      {error && <p role="alert" className="card mb-4 border-red-500/40 p-3 text-sm text-red-300">{error}</p>}
      {loading && !data && <p className="text-sm text-zinc-400">Carregando...</p>}

      {data && data.data.length === 0 && !loading && (
        <div className="card p-10 text-center">
          <p className="text-sm text-zinc-300">
            {hasFilters ? "Nenhum requisito encontrado com esses filtros." : "Este projeto ainda não tem requisitos."}
          </p>
          {!hasFilters && !archived && (
            <button className="btn btn-primary mt-4" onClick={() => setEditing("new")}>Cadastrar o primeiro requisito</button>
          )}
        </div>
      )}

      {data && data.data.length > 0 && (
        <ul className="space-y-3">
          {data.data.map((r) => (
            <li key={r.id} className="card p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium text-brand-300">{r.code}</p>
                  <p className="mt-0.5 font-medium">{r.title}</p>
                  <p className="mt-1 line-clamp-2 text-sm text-zinc-400">{r.description}</p>
                </div>
                <div className="flex shrink-0 gap-1">
                  <button className="icon-btn" aria-label={`Histórico de ${r.code}`} onClick={() => setHistoryOf(r)}>
                    <History className="h-4 w-4" aria-hidden />
                  </button>
                  <button className="icon-btn" aria-label={`Editar ${r.code}`} onClick={() => setEditing(r)}>
                    <Pencil className="h-4 w-4" aria-hidden />
                  </button>
                  <button className="icon-btn" aria-label={`Excluir ${r.code}`} onClick={() => remove(r)}>
                    <Trash2 className="h-4 w-4" aria-hidden />
                  </button>
                </div>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <span className="badge bg-zinc-700/40 text-zinc-300">{TYPE_LABEL[r.type]}</span>
                <span className={`badge ${PRIORITY_STYLE[r.priority]}`}>{PRIORITY_LABEL[r.priority]}</span>
                <span className={`badge ${STATUS_STYLE[r.status]}`}>{STATUS_LABEL[r.status]}</span>
                {r.source && <span className="badge bg-brand/15 text-brand-300">{r.source}</span>}
              </div>
            </li>
          ))}
        </ul>
      )}

      {data && <Pagination page={page} pageSize={PAGE_SIZE} total={data.total} onChange={setPage} />}

      {editing && (
        <RequirementForm
          projectId={id}
          requirement={editing === "new" ? undefined : editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            loadList();
            loadProject();
          }}
        />
      )}
      {historyOf && <HistoryModal projectId={id} requirement={historyOf} onClose={() => setHistoryOf(null)} />}
    </div>
  );
}
