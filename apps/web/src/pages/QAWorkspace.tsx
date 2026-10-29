import { useCallback, useEffect, useState, type FormEvent, type ReactNode } from "react";
import { Link, useParams } from "react-router-dom";
import {
  ArrowLeft, Bug, CheckCircle2, ClipboardList, GitBranch, Plus,
  RefreshCw, ShieldCheck, Sparkles,
} from "lucide-react";
import Modal from "../components/Modal";
import { api, errMsg } from "../lib/api";
import type { Paged, Project, Requirement } from "../lib/types";

type Tab = "overview" | "cases" | "cycles" | "executions" | "bugs" | "paths";
type Result = "PASSED" | "FAILED" | "BLOCKED" | "NOT_EXECUTED";
type Priority = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
type AutomationStep =
  | { action: "goto"; path: string }
  | { action: "fill"; selector: string; value: string }
  | { action: "click"; selector: string }
  | { action: "expectVisible"; selector: string }
  | { action: "expectText"; text: string };
type TestCase = {
  id: string; code: string; title: string; objective: string | null; preconditions: string | null;
  testData: string | null; steps: string; expected: string; type: string; priority: Priority;
  status: "DRAFT" | "READY" | "DEPRECATED"; module: string | null;
  requirementId?: string | null;
  automationSteps: AutomationStep[] | null;
  requirement?: { id: string; code: string; title: string } | null; _count?: { executions: number };
};
type Execution = {
  id: string; result: Result; executor: string | null; notes: string | null; evidence: string | null;
  executedAt: string; testCase: { id: string; code: string; title: string };
  cycle: { id: string; name: string } | null;
  targetUrl?: string | null; durationMs?: number | null; failureMessage?: string | null;
  stepResults?: { position: number; action: string; status: "PASSED" | "FAILED"; durationMs: number; message: string }[] | null;
  defects?: { id: string; title: string; severity: Priority; status: string }[];
};
type Cycle = {
  id: string; name: string; goal: string | null; status: "PLANNED" | "IN_PROGRESS" | "COMPLETED";
  testCases: { id: string; testCase: Pick<TestCase, "id" | "code" | "title" | "priority"> }[];
  executions: { result: Result }[];
};
type Defect = {
  id: string; title: string; description: string; severity: Priority;
  status: "OPEN" | "IN_PROGRESS" | "RESOLVED" | "CLOSED"; actualResult: string | null;
  expectedResult: string | null; stepsToReproduce: string | null; environment: string | null;
  assignee: string | null; createdAt: string;
  testCase: { id: string; code: string; title: string } | null;
  execution: { id: string; result: Result; executedAt: string } | null;
};
type TestPath = {
  id: string; name: string; description: string | null;
  steps: { id: string; position: number; testCase: Pick<TestCase, "id" | "code" | "title"> }[];
};
type Overview = {
  testCases: { status: string; _count: { _all: number } }[];
  cycles: { status: string; _count: { _all: number } }[];
  executions: { result: Result; _count: { _all: number } }[];
  defectCount: number;
  recentExecutions: Execution[];
};

const TABS: { id: Tab; label: string; icon: typeof ClipboardList }[] = [
  { id: "overview", label: "Visão geral", icon: ShieldCheck },
  { id: "cases", label: "Casos de teste", icon: ClipboardList },
  { id: "cycles", label: "Ciclos", icon: RefreshCw },
  { id: "executions", label: "Execuções", icon: CheckCircle2 },
  { id: "bugs", label: "Bugs", icon: Bug },
  { id: "paths", label: "Fluxos de teste", icon: GitBranch },
];
const RESULT_LABEL: Record<Result, string> = {
  PASSED: "Passou", FAILED: "Falhou", BLOCKED: "Bloqueado", NOT_EXECUTED: "Não executado",
};
const RESULT_STYLE: Record<Result, string> = {
  PASSED: "bg-emerald-500/15 text-emerald-300",
  FAILED: "bg-red-500/15 text-red-300",
  BLOCKED: "bg-amber-500/15 text-amber-300",
  NOT_EXECUTED: "bg-zinc-700/40 text-zinc-300",
};
const PRIORITY_LABEL: Record<Priority, string> = { LOW: "Baixa", MEDIUM: "Média", HIGH: "Alta", CRITICAL: "Crítica" };
const CASE_STATUS: Record<TestCase["status"], string> = { DRAFT: "Rascunho", READY: "Pronto", DEPRECATED: "Descontinuado" };

function countOf(rows: { _count: { _all: number } }[]) {
  return rows.reduce((total, row) => total + row._count._all, 0);
}

function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <section className={`card ${className}`}>{children}</section>;
}

function Empty({ children }: { children: ReactNode }) {
  return <Card className="p-8 text-center text-sm text-zinc-400">{children}</Card>;
}

function CaseForm({
  projectId, testCase, requirements, onClose, onSaved,
}: { projectId: string; testCase?: TestCase; requirements: Requirement[]; onClose: () => void; onSaved: () => void }) {
  const [values, setValues] = useState({
    title: testCase?.title ?? "", objective: testCase?.objective ?? "", module: testCase?.module ?? "",
    preconditions: testCase?.preconditions ?? "", testData: testCase?.testData ?? "",
    steps: testCase?.steps ?? "", expected: testCase?.expected ?? "", type: testCase?.type ?? "functional",
    priority: testCase?.priority ?? "MEDIUM", status: testCase?.status ?? "READY",
    requirementId: testCase?.requirement?.id ?? testCase?.requirementId ?? "",
  });
  const [automationSteps, setAutomationSteps] = useState<AutomationStep[]>(testCase?.automationSteps ?? []);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const set = (key: keyof typeof values, value: string) => setValues((v) => ({ ...v, [key]: value }));
  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await api(`/projects/${projectId}/qa/test-cases${testCase ? `/${testCase.id}` : ""}`, {
        method: testCase ? "PATCH" : "POST",
        body: { ...values, requirementId: values.requirementId || null, automationSteps },
      });
      onSaved();
    } catch (e) { setError(errMsg(e)); } finally { setBusy(false); }
  }
  return (
    <Modal title={testCase ? `Editar ${testCase.code}` : "Novo caso de teste"} onClose={onClose}>
      <form className="space-y-3" onSubmit={submit}>
        <Field label="Título" value={values.title} onChange={(v) => set("title", v)} required />
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Módulo / área" value={values.module} onChange={(v) => set("module", v)} />
          <SelectField label="Tipo" value={values.type} onChange={(v) => set("type", v)} options={[["functional", "Funcional"], ["regression", "Regressão"], ["smoke", "Smoke"], ["integration", "Integração"], ["performance", "Performance"], ["security", "Segurança"], ["usability", "Usabilidade"]]}/>
        </div>
        <Field label="Objetivo" value={values.objective} onChange={(v) => set("objective", v)} />
        <SelectField label="Requisito relacionado" value={values.requirementId} onChange={(v) => set("requirementId", v)} options={[["", "Sem vínculo"], ...requirements.map((r): [string, string] => [r.id, `${r.code} — ${r.title}`])]} />
        <Field label="Pré-condições" value={values.preconditions} onChange={(v) => set("preconditions", v)} />
        <Field label="Dados de teste" value={values.testData} onChange={(v) => set("testData", v)} />
        <TextAreaField label="Passos" value={values.steps} onChange={(v) => set("steps", v)} required rows={4} />
        <TextAreaField label="Resultado esperado" value={values.expected} onChange={(v) => set("expected", v)} required rows={3} />
        <div className="space-y-3 rounded-lg border border-line p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div><p className="text-sm font-medium">Automação do caso</p><p className="mt-1 text-xs text-zinc-500">Ações executadas no navegador quando você iniciar o teste.</p></div>
            <button type="button" className="btn btn-ghost" onClick={() => setAutomationSteps((current) => [...current, { action: "goto", path: "/" }])}>Adicionar ação</button>
          </div>
          {automationSteps.map((step, index) => (
            <div key={index} className="space-y-2 rounded-md bg-bg p-3">
              <div className="flex items-center gap-2">
                <span className="text-xs text-zinc-500">Etapa {index + 1}</span>
                <select
                  className="input"
                  aria-label={`Ação da etapa ${index + 1}`}
                  value={step.action}
                  onChange={(e) => {
                    const action = e.target.value as AutomationStep["action"];
                    const defaults: Record<AutomationStep["action"], AutomationStep> = {
                      goto: { action: "goto", path: "/" },
                      fill: { action: "fill", selector: "", value: "" },
                      click: { action: "click", selector: "" },
                      expectVisible: { action: "expectVisible", selector: "" },
                      expectText: { action: "expectText", text: "" },
                    };
                    setAutomationSteps((current) => current.map((item, i) => i === index ? defaults[action] : item));
                  }}
                >
                  <option value="goto">Abrir caminho</option>
                  <option value="fill">Preencher campo</option>
                  <option value="click">Clicar elemento</option>
                  <option value="expectVisible">Verificar elemento visível</option>
                  <option value="expectText">Verificar texto na página</option>
                </select>
                <button type="button" className="icon-btn" aria-label={`Remover etapa ${index + 1}`} onClick={() => setAutomationSteps((current) => current.filter((_, i) => i !== index))}>×</button>
              </div>
              {step.action === "goto" && <Field label="Caminho relativo à URL base" value={step.path} onChange={(path) => setAutomationSteps((current) => current.map((item, i) => i === index && item.action === "goto" ? { ...item, path } : item))} />}
              {step.action === "fill" && <div className="grid gap-2 sm:grid-cols-2"><Field label="Seletor CSS" value={step.selector} onChange={(selector) => setAutomationSteps((current) => current.map((item, i) => i === index && item.action === "fill" ? { ...item, selector } : item))} /><Field label="Valor ou {{secret:nome}}" value={step.value} onChange={(value) => setAutomationSteps((current) => current.map((item, i) => i === index && item.action === "fill" ? { ...item, value } : item))} /></div>}
              {(step.action === "click" || step.action === "expectVisible") && <Field label="Seletor CSS" value={step.selector} onChange={(selector) => setAutomationSteps((current) => current.map((item, i) => i === index && item.action === step.action ? { ...item, selector } : item))} />}
              {step.action === "expectText" && <Field label="Texto que deve aparecer" value={step.text} onChange={(text) => setAutomationSteps((current) => current.map((item, i) => i === index && item.action === "expectText" ? { ...item, text } : item))} />}
            </div>
          ))}
          {automationSteps.length === 0 && <p className="text-xs text-zinc-500">Adicione ações para habilitar a execução automática. Use <code>{"{{secret:email}}"}</code> ou <code>{"{{secret:senha}}"}</code> para informar dados sigilosos só na hora da execução.</p>}
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <SelectField label="Prioridade" value={values.priority} onChange={(v) => set("priority", v)} options={Object.entries(PRIORITY_LABEL)} />
          <SelectField label="Status" value={values.status} onChange={(v) => set("status", v)} options={Object.entries(CASE_STATUS)} />
        </div>
        {error && <p role="alert" className="field-error">{error}</p>}
        <FormActions busy={busy} onClose={onClose} label="Salvar caso" />
      </form>
    </Modal>
  );
}

function CycleForm({
  projectId, cases, cycle, onClose, onSaved,
}: { projectId: string; cases: TestCase[]; cycle?: Cycle; onClose: () => void; onSaved: () => void }) {
  const [name, setName] = useState(cycle?.name ?? "");
  const [goal, setGoal] = useState(cycle?.goal ?? "");
  const [selected, setSelected] = useState<string[]>(cycle?.testCases.map(({ testCase }) => testCase.id) ?? []);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      if (cycle) {
        await api(`/projects/${projectId}/qa/cycles/${cycle.id}`, { method: "PATCH", body: { name, goal: goal || null } });
        const existing = cycle.testCases.map(({ testCase }) => testCase.id);
        await Promise.all([
          ...selected.filter((testCaseId) => !existing.includes(testCaseId)).map((testCaseId) =>
            api(`/projects/${projectId}/qa/cycles/${cycle.id}/cases`, { method: "POST", body: { testCaseId } })),
          ...existing.filter((testCaseId) => !selected.includes(testCaseId)).map((testCaseId) =>
            api(`/projects/${projectId}/qa/cycles/${cycle.id}/cases/${testCaseId}`, { method: "DELETE" })),
        ]);
      } else {
        await api(`/projects/${projectId}/qa/cycles`, { method: "POST", body: { name, goal: goal || null, testCaseIds: selected } });
      }
      onSaved();
    } catch (e) { setError(errMsg(e)); } finally { setBusy(false); }
  }
  return (
    <Modal title={cycle ? "Editar ciclo de testes" : "Planejar ciclo de testes"} onClose={onClose}>
      <form className="space-y-4" onSubmit={submit}>
        <Field label="Nome do ciclo" value={name} onChange={setName} required />
        <TextAreaField label="Objetivo / escopo" value={goal} onChange={setGoal} rows={2} />
        <div>
          <p className="label">Casos incluídos ({selected.length})</p>
          <div className="max-h-48 space-y-2 overflow-auto rounded-lg border border-line p-3">
            {cases.filter((c) => c.status !== "DEPRECATED").map((c) => (
              <label key={c.id} className="flex items-center gap-2 text-sm text-zinc-300">
                <input type="checkbox" checked={selected.includes(c.id)} onChange={(e) => setSelected(e.target.checked ? [...selected, c.id] : selected.filter((id) => id !== c.id))} />
                <span className="text-brand-300">{c.code}</span> {c.title}
              </label>
            ))}
            {cases.length === 0 && <p className="text-sm text-zinc-500">Cadastre casos de teste antes de criar um ciclo.</p>}
          </div>
        </div>
        {error && <p role="alert" className="field-error">{error}</p>}
        <FormActions busy={busy} onClose={onClose} label={cycle ? "Salvar ciclo" : "Criar ciclo"} />
      </form>
    </Modal>
  );
}

function PathForm({
  projectId, cases, path, onClose, onSaved,
}: { projectId: string; cases: TestCase[]; path?: TestPath; onClose: () => void; onSaved: () => void }) {
  const [name, setName] = useState(path?.name ?? "");
  const [description, setDescription] = useState(path?.description ?? "");
  const [selected, setSelected] = useState(path?.steps.map((s) => s.testCase.id) ?? []);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  function toggle(id: string) {
    setSelected((current) => current.includes(id) ? current.filter((value) => value !== id) : [...current, id]);
  }
  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await api(`/projects/${projectId}/qa/paths${path ? `/${path.id}` : ""}`, {
        method: path ? "PATCH" : "POST",
        body: { name, description: description || null, testCaseIds: selected },
      });
      onSaved();
    } catch (e) { setError(errMsg(e)); } finally { setBusy(false); }
  }
  return (
    <Modal title={path ? "Editar fluxo de teste" : "Criar fluxo de teste"} onClose={onClose}>
      <form className="space-y-4" onSubmit={submit}>
        <Field label="Nome do fluxo" value={name} onChange={setName} required />
        <TextAreaField label="Descrição e objetivo" value={description} onChange={setDescription} rows={2} />
        <div>
          <p className="label">Etapas (a ordem selecionada é preservada)</p>
          <div className="max-h-48 space-y-2 overflow-auto rounded-lg border border-line p-3">
            {cases.filter((c) => c.status !== "DEPRECATED").map((c) => (
              <label key={c.id} className="flex items-center gap-2 text-sm text-zinc-300">
                <input type="checkbox" checked={selected.includes(c.id)} onChange={() => toggle(c.id)} />
                {selected.includes(c.id) && <span className="text-brand-300">{selected.indexOf(c.id) + 1}.</span>}
                <span className="text-brand-300">{c.code}</span> {c.title}
              </label>
            ))}
            {cases.length === 0 && <p className="text-sm text-zinc-500">Cadastre casos antes de montar um fluxo.</p>}
          </div>
        </div>
        {error && <p role="alert" className="field-error">{error}</p>}
        <FormActions busy={busy} onClose={onClose} label="Salvar fluxo" />
      </form>
    </Modal>
  );
}

function ExecutionForm({
  projectId, testCase, cycleId, onClose, onSaved,
}: { projectId: string; testCase: TestCase; cycleId?: string; onClose: () => void; onSaved: () => void }) {
  const [result, setResult] = useState<Result>("PASSED");
  const [executor, setExecutor] = useState("");
  const [notes, setNotes] = useState("");
  const [evidence, setEvidence] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const body = { testCaseId: testCase.id, result, executor: executor || null, notes: notes || null, evidence: evidence || null };
      if (cycleId) await api(`/projects/${projectId}/qa/cycles/${cycleId}/executions`, { method: "POST", body });
      else await api(`/projects/${projectId}/qa/executions`, { method: "POST", body });
      onSaved();
    } catch (e) { setError(errMsg(e)); } finally { setBusy(false); }
  }
  return (
    <Modal title={`Registrar execução manual · ${testCase.code}`} onClose={onClose}>
      <form className="space-y-4" onSubmit={submit}>
        <p className="text-sm text-zinc-400">{testCase.title}</p>
        <SelectField label="Resultado" value={result} onChange={(v) => setResult(v as Result)} options={Object.entries(RESULT_LABEL)} />
        <Field label="Executado por" value={executor} onChange={setExecutor} />
        <TextAreaField label="Notas da execução" value={notes} onChange={setNotes} rows={3} />
        <Field label="Link da evidência (opcional)" value={evidence} onChange={setEvidence} />
        {error && <p role="alert" className="field-error">{error}</p>}
        <FormActions busy={busy} onClose={onClose} label="Registrar resultado" />
      </form>
    </Modal>
  );
}

function AutomationRunForm({
  projectId, testCase, cycleId, onClose, onSaved,
}: { projectId: string; testCase: TestCase; cycleId?: string; onClose: () => void; onSaved: () => void }) {
  const [baseUrl, setBaseUrl] = useState("");
  const [secrets, setSecrets] = useState<Record<string, string>>({});
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [execution, setExecution] = useState<Execution | null>(null);
  const secretNames = [...new Set((testCase.automationSteps ?? []).flatMap((step) => {
    if (step.action !== "fill") return [];
    const match = /^\{\{secret:([a-zA-Z][a-zA-Z0-9_-]{0,39})\}\}$/.exec(step.value);
    return match ? [match[1]] : [];
  }))];

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    setExecution(null);
    try {
      const path = cycleId
        ? `/projects/${projectId}/qa/cycles/${cycleId}/test-cases/${testCase.id}/run`
        : `/projects/${projectId}/qa/test-cases/${testCase.id}/run`;
      const result = await api<Execution>(path, { method: "POST", body: { baseUrl, secrets } });
      setExecution(result);
      onSaved();
    } catch (e) { setError(errMsg(e)); } finally { setBusy(false); }
  }

  return (
    <Modal title={`Executar teste automático · ${testCase.code}`} onClose={onClose}>
      <form className="space-y-4" onSubmit={submit}>
        <div>
          <p className="font-medium">{testCase.title}</p>
          <p className="mt-1 text-xs text-zinc-500">{testCase.automationSteps?.length ?? 0} ações automáticas · os passos usam apenas o ambiente autorizado</p>
        </div>
        <Field label="URL do ambiente de teste" value={baseUrl} onChange={setBaseUrl} required />
        <p className="-mt-2 text-xs text-zinc-500">A URL deve estar autorizada na configuração da API. Não use credenciais na URL.</p>
        {secretNames.map((name) => (
          <label key={name} className="block">
            <span className="label">Segredo de teste: {name}</span>
            <input
              className="input"
              type="password"
              autoComplete="new-password"
              value={secrets[name] ?? ""}
              onChange={(e) => setSecrets((current) => ({ ...current, [name]: e.target.value }))}
              required
            />
            <span className="mt-1 block text-xs text-zinc-500">Usado apenas nesta execução; não é salvo no caso nem no histórico.</span>
          </label>
        ))}
        {!testCase.automationSteps?.length && <p role="alert" className="text-sm text-amber-300">Edite o caso e adicione as ações automáticas antes de executá-lo.</p>}
        {error && <p role="alert" className="field-error">{error}</p>}
        {execution && (
          <div className="space-y-2 rounded-lg border border-line p-3" aria-live="polite">
            <div className="flex items-center justify-between gap-2">
              <span className={`badge ${RESULT_STYLE[execution.result]}`}>{RESULT_LABEL[execution.result]}</span>
              <span className="text-xs text-zinc-500">{execution.durationMs ?? 0} ms</span>
            </div>
            {execution.failureMessage && <p role="alert" className="text-sm text-red-300">{execution.failureMessage}</p>}
            <ol className="space-y-1">
              {execution.stepResults?.map((step) => (
                <li key={step.position} className={`text-xs ${step.status === "FAILED" ? "text-red-300" : "text-emerald-300"}`}>
                  {step.position}. {step.action}: {step.message} ({step.durationMs} ms)
                </li>
              ))}
            </ol>
          </div>
        )}
        {execution
          ? <div className="flex justify-end"><button type="button" className="btn btn-ghost" onClick={onClose}>Fechar</button></div>
          : <FormActions busy={busy} onClose={onClose} label="Iniciar teste automático" />}
      </form>
    </Modal>
  );
}

function DefectForm({
  projectId, cases, onClose, onSaved,
}: { projectId: string; cases: TestCase[]; onClose: () => void; onSaved: () => void }) {
  const [values, setValues] = useState({
    title: "", description: "", severity: "MEDIUM", testCaseId: "", stepsToReproduce: "",
    expectedResult: "", actualResult: "", environment: "", assignee: "",
  });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const set = (key: keyof typeof values, value: string) => setValues((v) => ({ ...v, [key]: value }));
  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await api(`/projects/${projectId}/qa/defects`, {
        method: "POST",
        body: { ...values, testCaseId: values.testCaseId || null, executionId: null },
      });
      onSaved();
    } catch (e) { setError(errMsg(e)); } finally { setBusy(false); }
  }
  return (
    <Modal title="Registrar bug" onClose={onClose}>
      <form className="space-y-3" onSubmit={submit}>
        <Field label="Título" value={values.title} onChange={(v) => set("title", v)} required />
        <TextAreaField label="Descrição" value={values.description} onChange={(v) => set("description", v)} required rows={3} />
        <SelectField label="Severidade" value={values.severity} onChange={(v) => set("severity", v)} options={Object.entries(PRIORITY_LABEL)} />
        <SelectField label="Caso relacionado" value={values.testCaseId} onChange={(v) => set("testCaseId", v)} options={[["", "Selecione um caso"], ...cases.map((c): [string, string] => [c.id, `${c.code} — ${c.title}`])]} required />
        <TextAreaField label="Como reproduzir" value={values.stepsToReproduce} onChange={(v) => set("stepsToReproduce", v)} rows={3} />
        <div className="grid gap-3 sm:grid-cols-2">
          <TextAreaField label="Resultado esperado" value={values.expectedResult} onChange={(v) => set("expectedResult", v)} rows={2} />
          <TextAreaField label="Resultado obtido" value={values.actualResult} onChange={(v) => set("actualResult", v)} rows={2} />
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Ambiente / versão" value={values.environment} onChange={(v) => set("environment", v)} />
          <Field label="Responsável" value={values.assignee} onChange={(v) => set("assignee", v)} />
        </div>
        {error && <p role="alert" className="field-error">{error}</p>}
        <FormActions busy={busy} onClose={onClose} label="Registrar bug" />
      </form>
    </Modal>
  );
}

function Field({
  label, value, onChange, required = false,
}: { label: string; value: string; onChange: (value: string) => void; required?: boolean }) {
  return <label className="block"><span className="label">{label}</span><input className="input" value={value} onChange={(e) => onChange(e.target.value)} required={required} /></label>;
}

function TextAreaField({
  label, value, onChange, required = false, rows = 3,
}: { label: string; value: string; onChange: (value: string) => void; required?: boolean; rows?: number }) {
  return <label className="block"><span className="label">{label}</span><textarea className="input" rows={rows} value={value} onChange={(e) => onChange(e.target.value)} required={required} /></label>;
}

function SelectField({
  label, value, onChange, options, required = false,
}: { label: string; value: string; onChange: (value: string) => void; options: [string, string][]; required?: boolean }) {
  return <label className="block"><span className="label">{label}</span><select className="input" value={value} onChange={(e) => onChange(e.target.value)} required={required}>{options.map(([v, text]) => <option key={v} value={v}>{text}</option>)}</select></label>;
}

function FormActions({ busy, onClose, label }: { busy: boolean; onClose: () => void; label: string }) {
  return <div className="flex justify-end gap-2 pt-2"><button type="button" className="btn btn-ghost" onClick={onClose}>Cancelar</button><button className="btn btn-primary" disabled={busy}>{busy ? "Salvando..." : label}</button></div>;
}

export default function QAWorkspace() {
  const { id = "" } = useParams<{ id: string }>();
  const [tab, setTab] = useState<Tab>("overview");
  const [project, setProject] = useState<Project | null>(null);
  const [cases, setCases] = useState<TestCase[]>([]);
  const [requirements, setRequirements] = useState<Requirement[]>([]);
  const [cycles, setCycles] = useState<Cycle[]>([]);
  const [executions, setExecutions] = useState<Execution[]>([]);
  const [defects, setDefects] = useState<Defect[]>([]);
  const [paths, setPaths] = useState<TestPath[]>([]);
  const [overview, setOverview] = useState<Overview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [modal, setModal] = useState<{ type: "case"; value?: TestCase } | { type: "cycle"; value?: Cycle } | { type: "path"; value?: TestPath } | { type: "bug" } | { type: "run"; value: TestCase; cycleId?: string } | { type: "manualExecution"; value: TestCase } | null>(null);
  const [search, setSearch] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [p, o, c, cy, ex, bugs, flow, reqs] = await Promise.all([
        api<Project>(`/projects/${id}`),
        api<Overview>(`/projects/${id}/qa/overview`),
        api<TestCase[]>(`/projects/${id}/qa/test-cases`),
        api<Cycle[]>(`/projects/${id}/qa/cycles`),
        api<Execution[]>(`/projects/${id}/qa/executions`),
        api<Defect[]>(`/projects/${id}/qa/defects`),
        api<TestPath[]>(`/projects/${id}/qa/paths`),
        api<Paged<Requirement>>(`/projects/${id}/requirements?page=1&pageSize=50`),
      ]);
      setProject(p); setOverview(o); setCases(c); setCycles(cy); setExecutions(ex); setDefects(bugs); setPaths(flow); setRequirements(reqs.data);
    } catch (e) { setError(errMsg(e)); } finally { setLoading(false); }
  }, [id]);

  useEffect(() => { void load(); }, [load]);

  async function mutate(action: () => Promise<unknown>) {
    setError("");
    try { await action(); await load(); } catch (e) { setError(errMsg(e)); }
  }

  const archived = project?.status === "ARCHIVED";
  const visibleCases = cases.filter((c) =>
    `${c.code} ${c.title} ${c.module ?? ""}`.toLocaleLowerCase().includes(search.toLocaleLowerCase()),
  );
  const openBugs = defects.filter((d) => d.status === "OPEN" || d.status === "IN_PROGRESS").length;
  const passed = overview?.executions.find((row) => row.result === "PASSED")?._count._all ?? 0;
  const failed = overview?.executions.find((row) => row.result === "FAILED")?._count._all ?? 0;
  const blocked = overview?.executions.find((row) => row.result === "BLOCKED")?._count._all ?? 0;
  const totalExecutions = countOf(overview?.executions ?? []);

  if (loading && !project) return <p className="text-sm text-zinc-400">Carregando espaço QA...</p>;
  if (error && !project) return <div><p role="alert" className="text-sm text-red-300">{error}</p><Link className="mt-3 inline-block text-sm text-brand-300" to="/">Voltar aos projetos</Link></div>;
  if (!project) return null;

  return (
    <div className="mx-auto max-w-6xl">
      <Link to={`/projects/${id}`} className="mb-4 inline-flex items-center gap-1 text-sm text-zinc-400 hover:text-zinc-100"><ArrowLeft className="h-4 w-4" aria-hidden /> Requisitos</Link>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2"><Sparkles className="h-5 w-5 text-brand" aria-hidden /><p className="text-xs font-medium uppercase tracking-wide text-brand-300">RemindQA · {project.name}</p></div>
          <h1 className="mt-2 text-2xl font-semibold">Qualidade do produto</h1>
          <p className="mt-1 text-sm text-zinc-400">Planeje cenários, execute testes e acompanhe bugs do projeto.</p>
        </div>
        {archived && <span className="badge bg-zinc-700/40 text-zinc-300">Projeto arquivado · somente leitura</span>}
      </div>

      <div role="tablist" aria-label="Módulos de qualidade" className="mb-5 flex gap-1 overflow-x-auto border-b border-line">
        {TABS.map(({ id: key, label, icon: Icon }) => (
          <button key={key} role="tab" aria-selected={tab === key} onClick={() => setTab(key)} className={`flex shrink-0 items-center gap-2 border-b-2 px-3 py-3 text-sm ${tab === key ? "border-brand text-brand-300" : "border-transparent text-zinc-400 hover:text-zinc-100"}`}>
            <Icon className="h-4 w-4" aria-hidden />{label}
          </button>
        ))}
      </div>

      {error && <p role="alert" className="card mb-4 border-red-500/40 p-3 text-sm text-red-300">{error}</p>}
      {loading && <p className="mb-3 text-xs text-zinc-500">Atualizando...</p>}

      {tab === "overview" && overview && (
        <div className="space-y-5">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <Metric icon={ClipboardList} label="Casos de teste" value={countOf(overview.testCases)} hint={`${overview.testCases.find((r) => r.status === "READY")?._count._all ?? 0} prontos para execução`} />
            <Metric icon={RefreshCw} label="Ciclos ativos" value={overview.cycles.find((r) => r.status === "IN_PROGRESS")?._count._all ?? 0} hint={`${countOf(overview.cycles)} no total`} />
            <Metric icon={CheckCircle2} label="Execuções" value={totalExecutions} hint={`${passed} aprovadas · ${failed} falhas · ${blocked} bloqueadas`} />
            <Metric icon={Bug} label="Bugs em aberto" value={openBugs} hint={`${defects.length} registrados no projeto`} />
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            <Card className="p-5">
              <h2 className="font-medium">Atividade recente</h2>
              <div className="mt-4 space-y-3">
                {overview.recentExecutions.slice(0, 6).map((execution) => <ExecutionRow key={execution.id} execution={execution} />)}
                {overview.recentExecutions.length === 0 && <p className="text-sm text-zinc-500">As execuções aparecerão aqui quando os testes começarem.</p>}
              </div>
            </Card>
            <Card className="p-5">
              <h2 className="font-medium">Próximos passos</h2>
              <div className="mt-4 grid gap-2 sm:grid-cols-2">
                <QuickAction icon={ClipboardList} title="Organize a cobertura" body="Crie casos com passos e resultados esperados." onClick={() => setTab("cases")} />
                <QuickAction icon={RefreshCw} title="Planeje uma rodada" body="Agrupe casos em ciclos de teste." onClick={() => setTab("cycles")} />
                <QuickAction icon={GitBranch} title="Documente jornadas" body="Monte fluxos de ponta a ponta." onClick={() => setTab("paths")} />
                <QuickAction icon={Bug} title="Acompanhe defeitos" body="Registre severidade, contexto e responsável." onClick={() => setTab("bugs")} />
              </div>
            </Card>
          </div>
        </div>
      )}

      {tab === "cases" && (
        <div className="space-y-4">
          <PageHeading title="Biblioteca de casos de teste" description="Cenários reutilizáveis com pré-condições, dados, passos e resultado esperado." action={<button className="btn btn-primary" disabled={archived} onClick={() => setModal({ type: "case" })}><Plus className="h-4 w-4" aria-hidden /> Novo caso</button>} />
          <input className="input max-w-sm" aria-label="Pesquisar casos de teste" placeholder="Pesquisar por código, título ou módulo" value={search} onChange={(e) => setSearch(e.target.value)} />
          <div className="space-y-3">
            {visibleCases.map((c) => (
              <Card key={c.id} className="p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium text-brand-300">{c.code}{c.module ? ` · ${c.module}` : ""}</p>
                    <h2 className="mt-1 font-medium">{c.title}</h2>
                    {c.objective && <p className="mt-1 text-sm text-zinc-400">{c.objective}</p>}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <span className="badge bg-zinc-700/40 text-zinc-300">{CASE_STATUS[c.status]}</span>
                    <span className="badge bg-sky-500/15 text-sky-300">{PRIORITY_LABEL[c.priority]}</span>
                  </div>
                </div>
                <div className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
                  <div><p className="text-xs text-zinc-500">Passos</p><p className="mt-1 whitespace-pre-line text-zinc-300">{c.steps}</p></div>
                  <div><p className="text-xs text-zinc-500">Resultado esperado</p><p className="mt-1 whitespace-pre-line text-zinc-300">{c.expected}</p></div>
                </div>
                {(c.preconditions || c.testData || c.requirement) && <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-zinc-500">{c.preconditions && <span>Pré-condições: {c.preconditions}</span>}{c.testData && <span>Dados: {c.testData}</span>}{c.requirement && <span>Requisito: {c.requirement.code}</span>}</div>}
                <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-line pt-3">
                  <span className="text-xs text-zinc-500">{c._count?.executions ?? 0} execuções registradas</span>
                  <div className="flex gap-2">
                    <button className="btn btn-primary" disabled={archived || c.status === "DEPRECATED"} onClick={() => setModal({ type: "run", value: c })}>Executar teste</button>
                    <button className="btn btn-ghost" disabled={archived || c.status === "DEPRECATED"} onClick={() => setModal({ type: "manualExecution", value: c })}>Resultado manual</button>
                    <button className="btn btn-ghost" disabled={archived} onClick={() => setModal({ type: "case", value: c })}>Editar</button>
                    {c.status !== "DEPRECATED" && <button className="btn btn-ghost text-red-300" disabled={archived} onClick={() => void mutate(() => api(`/projects/${id}/qa/test-cases/${c.id}`, { method: "DELETE" }))}>Descontinuar</button>}
                  </div>
                </div>
              </Card>
            ))}
            {visibleCases.length === 0 && <Empty>Nenhum caso encontrado. Crie seu primeiro cenário de teste.</Empty>}
          </div>
        </div>
      )}

      {tab === "cycles" && (
        <div className="space-y-4">
          <PageHeading title="Ciclos de teste" description="Planeje uma rodada, reúna casos e registre o resultado de cada execução." action={<button className="btn btn-primary" disabled={archived} onClick={() => setModal({ type: "cycle" })}><Plus className="h-4 w-4" aria-hidden /> Planejar ciclo</button>} />
          {cycles.length === 0 && <Empty>Não há ciclos de teste. Crie um para organizar a próxima rodada.</Empty>}
          <div className="grid gap-4 lg:grid-cols-2">
            {cycles.map((cycle) => {
              const results = cycle.executions.reduce<Record<Result, number>>((acc, item) => ({ ...acc, [item.result]: acc[item.result] + 1 }), { PASSED: 0, FAILED: 0, BLOCKED: 0, NOT_EXECUTED: 0 });
              return <Card key={cycle.id} className="p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div><h2 className="font-semibold">{cycle.name}</h2>{cycle.goal && <p className="mt-1 text-sm text-zinc-400">{cycle.goal}</p>}</div>
                  <select className="input w-auto" aria-label={`Status do ciclo ${cycle.name}`} value={cycle.status} disabled={archived} onChange={(e) => void mutate(() => api(`/projects/${id}/qa/cycles/${cycle.id}`, { method: "PATCH", body: { status: e.target.value } }))}>
                    <option value="PLANNED">Planejado</option><option value="IN_PROGRESS">Em andamento</option><option value="COMPLETED">Concluído</option>
                  </select>
                </div>
                <div className="mt-4 flex flex-wrap items-center gap-2 text-xs text-zinc-400"><span>{cycle.testCases.length} casos</span><span>{cycle.executions.length} execuções</span><span>{results.PASSED} passaram</span><span>{results.FAILED} falharam</span><span>{results.BLOCKED} bloqueadas</span><button className="ml-auto text-brand-300 hover:underline" disabled={archived || cycle.status === "COMPLETED"} onClick={() => setModal({ type: "cycle", value: cycle })}>Editar ciclo</button></div>
                <div className="mt-4 space-y-2 border-t border-line pt-3">
                  {cycle.testCases.map(({ testCase }) => <div key={testCase.id} className="flex flex-wrap items-center justify-between gap-2 text-sm">
                    <span><span className="text-brand-300">{testCase.code}</span> · {testCase.title}</span>
                    <button className="btn btn-ghost px-2 py-1 text-xs" disabled={archived || cycle.status === "COMPLETED"} onClick={() => {
                      const caseItem = cases.find((c) => c.id === testCase.id);
                      if (caseItem) setModal({ type: "run", value: caseItem, cycleId: cycle.id });
                    }}>Executar</button>
                  </div>)}
                  {cycle.testCases.length === 0 && <p className="text-sm text-zinc-500">Este ciclo ainda não tem casos associados.</p>}
                </div>
              </Card>;
            })}
          </div>
        </div>
      )}

      {tab === "executions" && (
        <div className="space-y-4">
          <PageHeading title="Execuções" description="Histórico auditável de resultados, responsáveis, evidências e bugs relacionados." />
          <Card className="overflow-hidden">
            {executions.length === 0 ? <p className="p-8 text-center text-sm text-zinc-400">Nenhum teste foi executado ainda.</p> : <div className="divide-y divide-line">
              {executions.map((execution) => <ExecutionRow key={execution.id} execution={execution} extended />)}
            </div>}
          </Card>
        </div>
      )}

      {tab === "bugs" && (
        <div className="space-y-4">
          <PageHeading title="Gestão de bugs" description="Defeitos com severidade, reprodução, resultados, ambiente, responsável e vínculo com testes." action={<button className="btn btn-primary" disabled={archived} onClick={() => setModal({ type: "bug" })}><Plus className="h-4 w-4" aria-hidden /> Registrar bug</button>} />
          <div className="grid gap-3 sm:grid-cols-3"><Metric icon={Bug} label="Em aberto" value={defects.filter((d) => d.status === "OPEN").length} hint="Aguardando triagem" /><Metric icon={RefreshCw} label="Em andamento" value={defects.filter((d) => d.status === "IN_PROGRESS").length} hint="Em correção" /><Metric icon={CheckCircle2} label="Resolvidos" value={defects.filter((d) => d.status === "RESOLVED" || d.status === "CLOSED").length} hint="Concluídos / encerrados" /></div>
          <div className="space-y-3">
            {defects.map((bug) => <Card key={bug.id} className="p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><h2 className="font-medium">{bug.title}</h2><span className={`badge ${bug.severity === "CRITICAL" ? "bg-red-500/20 text-red-200" : bug.severity === "HIGH" ? "bg-orange-500/15 text-orange-300" : "bg-zinc-700/40 text-zinc-300"}`}>{PRIORITY_LABEL[bug.severity]}</span></div><p className="mt-1 text-sm text-zinc-400">{bug.description}</p></div>
                <select className="input w-auto" value={bug.status} disabled={archived} aria-label={`Status do bug ${bug.title}`} onChange={(e) => void mutate(() => api(`/projects/${id}/qa/defects/${bug.id}`, { method: "PATCH", body: { status: e.target.value } }))}><option value="OPEN">Aberto</option><option value="IN_PROGRESS">Em andamento</option><option value="RESOLVED">Resolvido</option><option value="CLOSED">Fechado</option></select>
              </div>
              <div className="mt-3 grid gap-2 text-xs text-zinc-500 sm:grid-cols-2 lg:grid-cols-4">
                {bug.testCase && <span>Teste: {bug.testCase.code} · {bug.testCase.title}</span>}
                {bug.assignee && <span>Responsável: {bug.assignee}</span>}
                {bug.environment && <span>Ambiente: {bug.environment}</span>}
                <span>Criado em {new Date(bug.createdAt).toLocaleDateString("pt-BR")}</span>
              </div>
              {(bug.stepsToReproduce || bug.expectedResult || bug.actualResult) && <details className="mt-3 text-sm text-zinc-400"><summary className="cursor-pointer">Detalhes de reprodução</summary><div className="mt-2 grid gap-2 sm:grid-cols-3"><p><b>Passos:</b> {bug.stepsToReproduce || "—"}</p><p><b>Esperado:</b> {bug.expectedResult || "—"}</p><p><b>Obtido:</b> {bug.actualResult || "—"}</p></div></details>}
            </Card>)}
            {defects.length === 0 && <Empty>Nenhum bug registrado. Você pode criar um e vinculá-lo a um caso de teste.</Empty>}
          </div>
        </div>
      )}

      {tab === "paths" && (
        <div className="space-y-4">
          <PageHeading title="Fluxos de teste" description="Jornadas de ponta a ponta compostas por casos ordenados, como cadastro, compra e pagamento." action={<button className="btn btn-primary" disabled={archived} onClick={() => setModal({ type: "path" })}><Plus className="h-4 w-4" aria-hidden /> Criar fluxo</button>} />
          <div className="grid gap-4 lg:grid-cols-2">
            {paths.map((path) => <Card key={path.id} className="p-5">
              <div className="flex items-start justify-between gap-3"><div><h2 className="font-semibold">{path.name}</h2>{path.description && <p className="mt-1 text-sm text-zinc-400">{path.description}</p>}</div><button className="btn btn-ghost" disabled={archived} onClick={() => setModal({ type: "path", value: path })}>Editar fluxo</button></div>
              <ol className="mt-4 space-y-2">{path.steps.map((step) => <li key={step.id} className="flex gap-3 text-sm"><span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand/15 text-xs text-brand-300">{step.position}</span><span><b className="text-brand-300">{step.testCase.code}</b> · {step.testCase.title}</span></li>)}</ol>
              {path.steps.length === 0 && <p className="mt-4 text-sm text-zinc-500">Adicione casos para descrever a jornada.</p>}
              <div className="mt-4 flex justify-end border-t border-line pt-3"><button className="text-xs text-red-300 hover:text-red-200" disabled={archived} onClick={() => void mutate(() => api(`/projects/${id}/qa/paths/${path.id}`, { method: "DELETE" }))}>Excluir fluxo</button></div>
            </Card>)}
            {paths.length === 0 && <div className="lg:col-span-2"><Empty>Nenhum fluxo criado. Use casos de teste para descrever jornadas do usuário.</Empty></div>}
          </div>
        </div>
      )}

      {modal?.type === "case" && <CaseForm projectId={id} testCase={modal.value} requirements={requirements} onClose={() => setModal(null)} onSaved={() => { setModal(null); void load(); }} />}
      {modal?.type === "cycle" && <CycleForm projectId={id} cases={cases} cycle={modal.value} onClose={() => setModal(null)} onSaved={() => { setModal(null); void load(); }} />}
      {modal?.type === "path" && <PathForm projectId={id} cases={cases} path={modal.value} onClose={() => setModal(null)} onSaved={() => { setModal(null); void load(); }} />}
      {modal?.type === "bug" && <DefectForm projectId={id} cases={cases} onClose={() => setModal(null)} onSaved={() => { setModal(null); void load(); }} />}
      {modal?.type === "run" && modal.value && <AutomationRunForm projectId={id} testCase={modal.value} cycleId={modal.cycleId} onClose={() => setModal(null)} onSaved={() => { void load(); }} />}
      {modal?.type === "manualExecution" && modal.value && <ExecutionForm projectId={id} testCase={modal.value} onClose={() => setModal(null)} onSaved={() => { setModal(null); void load(); }} />}
    </div>
  );
}

function Metric({ icon: Icon, label, value, hint }: { icon: typeof ClipboardList; label: string; value: number; hint: string }) {
  return <Card className="p-4"><div className="flex items-center justify-between"><span className="text-sm text-zinc-400">{label}</span><Icon className="h-4 w-4 text-brand-300" aria-hidden /></div><p className="mt-3 text-2xl font-semibold">{value}</p><p className="mt-1 text-xs text-zinc-500">{hint}</p></Card>;
}

function PageHeading({ title, description, action }: { title: string; description: string; action?: ReactNode }) {
  return <div className="flex flex-wrap items-end justify-between gap-3"><div><h2 className="text-lg font-semibold">{title}</h2><p className="mt-1 text-sm text-zinc-400">{description}</p></div>{action}</div>;
}

function QuickAction({ icon: Icon, title, body, onClick }: { icon: typeof ClipboardList; title: string; body: string; onClick: () => void }) {
  return <button className="rounded-lg border border-line p-3 text-left transition hover:border-brand/50 hover:bg-white/[0.03]" onClick={onClick}><Icon className="h-4 w-4 text-brand-300" aria-hidden /><p className="mt-2 text-sm font-medium">{title}</p><p className="mt-1 text-xs text-zinc-500">{body}</p></button>;
}

function ExecutionRow({ execution, extended = false }: { execution: Execution; extended?: boolean }) {
  return <div className={`flex flex-wrap items-center justify-between gap-3 ${extended ? "p-4" : ""}`}>
    <div className="min-w-0"><p className="truncate text-sm font-medium"><span className="text-brand-300">{execution.testCase.code}</span> · {execution.testCase.title}</p><p className="mt-1 text-xs text-zinc-500">{execution.cycle?.name ?? "Execução"} · {new Date(execution.executedAt).toLocaleString("pt-BR")}{execution.executor ? ` · ${execution.executor}` : ""}</p>{extended && execution.targetUrl && <p className="mt-2 break-all text-xs text-zinc-400">Ambiente: {execution.targetUrl}{execution.durationMs != null ? ` · ${execution.durationMs} ms` : ""}</p>}{extended && execution.notes && <p className="mt-2 text-sm text-zinc-400">{execution.notes}</p>}{extended && execution.failureMessage && <p className="mt-2 text-sm text-red-300">{execution.failureMessage}</p>}{extended && execution.stepResults?.map((step) => <p key={step.position} className={`mt-1 text-xs ${step.status === "FAILED" ? "text-red-300" : "text-emerald-300"}`}>{step.position}. {step.action}: {step.message} ({step.durationMs} ms)</p>)}{extended && execution.evidence && <a className="mt-1 inline-block text-xs text-brand-300 hover:underline" href={execution.evidence} target="_blank" rel="noreferrer">Abrir evidência</a>}{extended && execution.defects?.map((bug) => <p key={bug.id} className="mt-1 text-xs text-red-300">Bug: {bug.title}</p>)}</div>
    <span className={`badge ${RESULT_STYLE[execution.result]}`}>{RESULT_LABEL[execution.result]}</span>
  </div>;
}
