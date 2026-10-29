import { useEffect, useState } from "react";
import { api, errMsg } from "../lib/api";
import {
  FIELD_LABEL,
  PRIORITY_LABEL,
  STATUS_LABEL,
  TYPE_LABEL,
  formatDate,
  type HistoryEntry,
  type Requirement,
} from "../lib/types";
import Modal from "./Modal";

const VALUE_LABEL: Record<string, string> = { ...STATUS_LABEL, ...PRIORITY_LABEL, ...TYPE_LABEL };
const show = (v: string | null) => (v == null || v === "" ? "—" : (VALUE_LABEL[v] ?? v));

export default function HistoryModal({
  projectId,
  requirement,
  onClose,
}: {
  projectId: string;
  requirement: Requirement;
  onClose: () => void;
}) {
  const [history, setHistory] = useState<HistoryEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api<Requirement>(`/projects/${projectId}/requirements/${requirement.id}`)
      .then((r) => setHistory(r.history ?? []))
      .catch((e) => setError(errMsg(e)));
  }, [projectId, requirement.id]);

  return (
    <Modal title={`Histórico de ${requirement.code}`} onClose={onClose}>
      {error && <p role="alert" className="field-error">{error}</p>}
      {!history && !error && <p className="text-sm text-zinc-400">Carregando...</p>}
      {history && history.length === 0 && <p className="text-sm text-zinc-400">Sem alterações registradas.</p>}
      {history && history.length > 0 && (
        <ol className="space-y-3">
          {history.map((h) => (
            <li key={h.id} className="rounded-lg border border-line p-3 text-sm">
              <p className="text-xs text-zinc-500">{formatDate(h.changedAt)}</p>
              <p className="mt-1">
                <span className="font-medium">{FIELD_LABEL[h.field] ?? h.field}</span>
                {h.field === "criação" || h.field === "exclusão" ? (
                  <span className="text-zinc-400"> {h.newValue ?? h.oldValue}</span>
                ) : (
                  <span className="text-zinc-400">
                    : {show(h.oldValue)} → {show(h.newValue)}
                  </span>
                )}
              </p>
            </li>
          ))}
        </ol>
      )}
    </Modal>
  );
}
