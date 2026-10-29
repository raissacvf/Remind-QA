import { useState, type FormEvent } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { Sparkles } from "lucide-react";
import { useAuth } from "../auth";
import { errMsg, fieldErrors } from "../lib/api";

export default function Login() {
  const { user, login, register } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (user) return <Navigate to="/" replace />;

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setErrors({});
    try {
      await (mode === "login" ? login : register)(email, password);
      navigate("/");
    } catch (err) {
      const fe = fieldErrors(err);
      setErrors(fe);
      if (Object.keys(fe).length === 0) setError(errMsg(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <form onSubmit={submit} className="card w-full max-w-sm space-y-4 p-6" noValidate>
        <div className="flex items-center gap-2 text-lg font-semibold">
          <Sparkles className="h-5 w-5 text-brand" aria-hidden />
          RemindQA
        </div>
        <p className="text-sm text-zinc-400">
          {mode === "login" ? "Entre para gerenciar a qualidade dos seus projetos." : "Crie sua conta RemindQA."}
        </p>
        <div>
          <label className="label" htmlFor="email">E-mail</label>
          <input id="email" type="email" className="input" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
          {errors.email && <p className="field-error">{errors.email}</p>}
        </div>
        <div>
          <label className="label" htmlFor="password">Senha</label>
          <input id="password" type="password" className="input" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete={mode === "login" ? "current-password" : "new-password"} />
          {errors.password && <p className="field-error">{errors.password}</p>}
        </div>
        {error && <p role="alert" className="field-error">{error}</p>}
        <button className="btn btn-primary w-full" disabled={busy}>
          {busy ? "Aguarde..." : mode === "login" ? "Entrar" : "Criar conta"}
        </button>
        <button
          type="button"
          className="w-full text-center text-sm text-brand-300 hover:underline"
          onClick={() => {
            setMode(mode === "login" ? "register" : "login");
            setError(null);
            setErrors({});
          }}
        >
          {mode === "login" ? "Não tem conta? Cadastre-se" : "Já tem conta? Entre"}
        </button>
      </form>
    </div>
  );
}
