import { useState, type FormEvent } from "react";
import { api, errMsg, fieldErrors } from "../lib/api";
import {
  PRIORITY_LABEL,
  STATUS_LABEL,
  TRANSITIONS,
  TYPE_LABEL,
  type Priority,
  type Requirement,
  type RequirementStatus,
  type RequirementType,
} from "../lib/types";
import Modal from "./Modal";

export default function RequirementForm({
  projectId,
  requirement,
  onSaved,
  onClose,
}: {
  projectId: string;
  requirement?: Requirement;
  onSaved: () => void;
  onClose: () => void;
}) {
  const [title, setTitle] = useState(requirement?.title ?? "");
  const [description, setDescription] = useState(requirement?.description ?? "");
  const [type, setType] = useState<RequirementType>(requirement?.type ?? "FUNCTIONAL");
  const [priority, setPriority] = useState<Priority>(requirement?.priority ?? "MEDIUM");
  const [status, setStatus] = useState<RequirementStatus>(requirement?.status ?? "DRAFT");
  const [source, setSource] = useState(requirement?.source ?? "");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setErrors({});
    try {
      const body = { title, description, type, priority, source: source.trim() || null };
      if (requirement) {
        await api(`/projects/${projectId}/requirements/${requirement.id}`, {
          method: "PATCH",
          body: { ...body, status },
        });
      } else {
        await api(`/projects/${projectId}/requirements`, { method: "POST", body });
      }
      onSaved();
    } catch (err) {
      const fe = fieldErrors(err);
      setErrors(fe);
      if (Object.keys(fe).length === 0) setError(errMsg(err));
    } finally {
      setBusy(false);
    }
  }

  const statusOptions = requirement ? [requirement.status, ...TRANSITIONS[requirement.status]] : [];

  return (
    <Modal title={requirement ? `Editar ${requirement.code}` : "Novo requisito"} onClose={onClose}>
      <form onSubmit={submit} className="space-y-4" noValidate>
        <div>
          <label className="label" htmlFor="r-title">Título</label>
          <input id="r-title" className="input" value={title} onChange={(e) => setTitle(e.target.value)} autoFocus />
          {errors.title && <p className="field-error">{errors.title}</p>}
        </div>
        <div>
          <label className="label" htmlFor="r-desc">Descrição</label>
          <textarea id="r-desc" rows={4} className="input" value={description} onChange={(e) => setDescription(e.target.value)} />
          {errors.description && <p className="field-error">{errors.description}</p>}
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="r-type">Tipo</label>
            <select id="r-type" className="input" value={type} onChange={(e) => setType(e.target.value as RequirementType)}>
              {Object.entries(TYPE_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="r-priority">Prioridade</label>
            <select id="r-priority" className="input" value={priority} onChange={(e) => setPriority(e.target.value as Priority)}>
              {Object.entries(PRIORITY_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </div>
        </div>
        {requirement && (
          <div>
            <label className="label" htmlFor="r-status">Status</label>
            <select id="r-status" className="input" value={status} onChange={(e) => setStatus(e.target.value as RequirementStatus)}>
              {statusOptions.map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
            </select>
          </div>
        )}
        <div>
          <label className="label" htmlFor="r-source">Origem ou responsável (opcional)</label>
          <input id="r-source" className="input" value={source} onChange={(e) => setSource(e.target.value)} />
          {errors.source && <p className="field-error">{errors.source}</p>}
        </div>
        {error && <p role="alert" className="field-error">{error}</p>}
        <div className="flex justify-end gap-2">
          <button type="button" className="btn btn-ghost" onClick={onClose}>Cancelar</button>
          <button className="btn btn-primary" disabled={busy}>{busy ? "Salvando..." : "Salvar"}</button>
        </div>
      </form>
    </Modal>
  );
}
