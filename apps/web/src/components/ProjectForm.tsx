import { useState, type FormEvent } from "react";
import { api, errMsg, fieldErrors } from "../lib/api";
import Modal from "./Modal";

export default function ProjectForm({ onSaved, onClose }: { onSaved: () => void; onClose: () => void }) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [objective, setObjective] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setErrors({});
    try {
      await api("/projects", {
        method: "POST",
        body: { name, description: description || undefined, objective: objective || undefined },
      });
      onSaved();
    } catch (err) {
      const fe = fieldErrors(err);
      setErrors(fe);
      if (Object.keys(fe).length === 0) setError(errMsg(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal title="Novo projeto" onClose={onClose}>
      <form onSubmit={submit} className="space-y-4" noValidate>
        <div>
          <label className="label" htmlFor="p-name">Nome</label>
          <input id="p-name" className="input" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
          {errors.name && <p className="field-error">{errors.name}</p>}
        </div>
        <div>
          <label className="label" htmlFor="p-desc">Descrição</label>
          <textarea id="p-desc" rows={3} className="input" value={description} onChange={(e) => setDescription(e.target.value)} />
          {errors.description && <p className="field-error">{errors.description}</p>}
        </div>
        <div>
          <label className="label" htmlFor="p-obj">Objetivo</label>
          <textarea id="p-obj" rows={2} className="input" value={objective} onChange={(e) => setObjective(e.target.value)} />
          {errors.objective && <p className="field-error">{errors.objective}</p>}
        </div>
        {error && <p role="alert" className="field-error">{error}</p>}
        <div className="flex justify-end gap-2">
          <button type="button" className="btn btn-ghost" onClick={onClose}>Cancelar</button>
          <button className="btn btn-primary" disabled={busy}>{busy ? "Salvando..." : "Criar projeto"}</button>
        </div>
      </form>
    </Modal>
  );
}
