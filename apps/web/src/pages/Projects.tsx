import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Archive, Plus, Search } from "lucide-react";
import { api, errMsg } from "../lib/api";
import type { Paged, Project } from "../lib/types";
import { useDebounce } from "../lib/useDebounce";
import Pagination from "../components/Pagination";
import ProjectForm from "../components/ProjectForm";

const PAGE_SIZE = 9;

export default function Projects() {
  const [q, setQ] = useState("");
  const dq = useDebounce(q, 300);
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const [creating, setCreating] = useState(false);
  const [state, setState] = useState<{ loading: boolean; error: string | null; data: Paged<Project> | null }>({
    loading: true,
    error: null,
    data: null,
  });

  const load = useCallback(async () => {
    setState((s) => ({ ...s, loading: true, error: null }));
    try {
      const params = new URLSearchParams({ page: String(page), pageSize: String(PAGE_SIZE) });
      if (dq) params.set("q", dq);
      if (status) params.set("status", status);
      const data = await api<Paged<Project>>(`/projects?${params}`);
      setState({ loading: false, error: null, data });
    } catch (e) {
      setState((s) => ({ ...s, loading: false, error: errMsg(e) }));
    }
  }, [page, dq, status]);

  useEffect(() => {
    load();
  }, [load]);
  useEffect(() => setPage(1), [dq, status]);

  async function archive(p: Project) {
    if (!window.confirm(`Arquivar o projeto "${p.name}"? Ele deixará de aceitar novos requisitos.`)) return;
    try {
      await api(`/projects/${p.id}/archive`, { method: "POST" });
      load();
    } catch (e) {
      setState((s) => ({ ...s, error: errMsg(e) }));
    }
  }

  const { loading, error, data } = state;

  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold">Projetos</h1>
        <button className="btn btn-primary" onClick={() => setCreating(true)}>
          <Plus className="h-4 w-4" aria-hidden /> Novo projeto
        </button>
      </div>

      <div className="mb-4 flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-zinc-500" aria-hidden />
          <input
            className="input pl-9"
            placeholder="Pesquisar por nome"
            aria-label="Pesquisar projetos"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
        <select className="input sm:w-44" aria-label="Filtrar por status" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">Todos os status</option>
          <option value="ACTIVE">Ativos</option>
          <option value="ARCHIVED">Arquivados</option>
        </select>
      </div>

      {error && <p role="alert" className="card mb-4 border-red-500/40 p-3 text-sm text-red-300">{error}</p>}
      {loading && !data && <p className="text-sm text-zinc-400">Carregando...</p>}

      {data && data.data.length === 0 && !loading && (
        <div className="card p-10 text-center">
          <p className="text-sm text-zinc-300">
            {dq || status ? "Nenhum projeto encontrado com esses filtros." : "Você ainda não tem projetos."}
          </p>
          {!dq && !status && (
            <button className="btn btn-primary mt-4" onClick={() => setCreating(true)}>Criar o primeiro projeto</button>
          )}
        </div>
      )}

      {data && data.data.length > 0 && (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {data.data.map((p) => (
            <li key={p.id} className="card flex flex-col p-4">
              <div className="flex items-start justify-between gap-2">
                <Link to={`/projects/${p.id}`} className="font-medium hover:text-brand-300">
                  {p.name}
                </Link>
                {p.status === "ARCHIVED" && <span className="badge bg-zinc-700/40 text-zinc-300">Arquivado</span>}
              </div>
              <p className="mt-1 line-clamp-2 min-h-[2.5rem] text-sm text-zinc-400">
                {p.description || "Sem descrição"}
              </p>
              <div className="mt-3 flex items-center justify-between text-xs text-zinc-400">
                <span>
                  {p._count?.testCases ?? 0} casos de teste · {p._count?.requirements ?? 0} requisitos
                </span>
                <div className="flex items-center gap-1">
                  <Link to={`/projects/${p.id}/qa`} className="text-xs font-medium text-brand-300 hover:underline">Abrir QA</Link>
                  {p.status === "ACTIVE" && (
                    <button className="icon-btn" aria-label={`Arquivar ${p.name}`} onClick={() => archive(p)}>
                      <Archive className="h-4 w-4" aria-hidden />
                    </button>
                  )}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      {data && <Pagination page={page} pageSize={PAGE_SIZE} total={data.total} onChange={setPage} />}

      {creating && (
        <ProjectForm
          onClose={() => setCreating(false)}
          onSaved={() => {
            setCreating(false);
            load();
          }}
        />
      )}
    </div>
  );
}
