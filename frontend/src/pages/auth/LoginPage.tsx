import { useState, type FormEvent } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { AtSign, Eye, EyeOff, Lock, Sparkles } from "lucide-react";
import { useAuth } from "../../hooks/useAuth";
import { ApiError } from "../../lib/api-client";
import { Button } from "../../components/ui/Button";
import { FieldError, Input, Label } from "../../components/ui/Input";

export function LoginPage() {
  const { status, user, login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [submitting, setSubmitting] = useState(false);

  if (status === "authenticated" && user) {
    return <Navigate to={user.must_change_password ? "/change-password" : "/"} replace />;
  }

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    setFieldErrors({});
    setSubmitting(true);
    try {
      const loggedIn = await login(email, password);
      navigate(loggedIn.must_change_password ? "/change-password" : "/", { replace: true });
    } catch (caught) {
      if (caught instanceof ApiError) {
        setError(caught.message);
        setFieldErrors(caught.fieldErrors);
      } else {
        setError("Gagal masuk. Silakan periksa kembali email dan kata sandi Anda.");
      }
    } finally {
      setSubmitting(false);
    }
  };

  const fieldClass =
    "h-11 border-slate-200 bg-white text-sm text-slate-900 placeholder:text-slate-400 focus:border-primary";

  return (
    <div className="relative min-h-screen w-full overflow-hidden bg-white font-sans">
      <svg className="sr-only" aria-hidden="true">
        <defs>
          <linearGradient id="jbLoginGrad" x1="0%" y1="0%" x2="90%" y2="100%">
            <stop offset="0%" stopColor="#e0f2fe" />
            <stop offset="45%" stopColor="#bae6fd" />
            <stop offset="100%" stopColor="#7dd3fc" />
          </linearGradient>
        </defs>
      </svg>

      {/* ---------------------------------------- CURVED GRADIENT (DESKTOP) */}
      <svg
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        className="pointer-events-none absolute inset-y-0 left-0 hidden h-full w-[62%] lg:block"
        aria-hidden="true"
      >
        <path d="M0,0 H60 C 74,20 48,44 64,66 C 72,80 78,90 72,100 H0 Z" fill="url(#jbLoginGrad)" />
      </svg>

      {/* Soft light behind the edge */}
      <div className="pointer-events-none absolute inset-y-0 left-0 hidden w-[62%] lg:block">
        <div className="absolute left-[-10%] top-[-12%] h-[420px] w-[420px] rounded-full bg-white/70 blur-[120px]" />
        <div className="absolute bottom-[-14%] left-[28%] h-[380px] w-[380px] rounded-full bg-cyan-200/60 blur-[130px]" />
      </div>

      {/* ----------------------------------------- CURVED GRADIENT (MOBILE) */}
      <svg
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        className="pointer-events-none absolute inset-x-0 top-0 h-[340px] w-full lg:hidden"
        aria-hidden="true"
      >
        <path d="M0,0 H100 V74 C 70,96 32,62 0,86 Z" fill="url(#jbLoginGrad)" />
      </svg>

      {/* ----------------------------------------------------------- CONTENT */}
      <div className="relative z-10 grid min-h-screen w-full lg:grid-cols-[62%_38%]">
        {/* Brand */}
        <div className="flex min-h-[340px] items-center justify-center px-8 pb-10 pt-16 lg:min-h-full lg:justify-start lg:py-0 lg:pl-20">
          <div className="flex flex-col items-center gap-4 text-center lg:items-start lg:text-left">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-[#3b82f6] to-[#2563eb] shadow-lg shadow-blue-500/25">
              <Sparkles className="h-6 w-6 text-white" />
            </div>
            <div>
              <div className="flex items-center justify-center gap-1.5 lg:justify-start">
                <span className="text-xl font-bold tracking-tight text-slate-900">JagoBridge</span>
                <span className="rounded bg-blue-600/10 px-1.5 py-0.5 text-[10px] font-bold uppercase text-blue-700">
                  Pro
                </span>
              </div>
              <p className="mt-1 text-sm text-slate-600">Enterprise AI Gateway</p>
            </div>
          </div>
        </div>

        {/* Simple form */}
        <div className="flex items-center justify-center px-6 py-16 lg:py-0">
          <div className="w-full max-w-[340px]">
            <h2 className="mb-6 text-2xl font-bold tracking-tight text-slate-900">Masuk</h2>

            <form onSubmit={onSubmit} className="space-y-5">
              <div>
                <Label htmlFor="email">EMAIL</Label>
                <Input
                  id="email"
                  type="email"
                  autoComplete="username"
                  required
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="nama@perusahaan.com"
                  leftIcon={<AtSign className="h-4 w-4" />}
                  className={fieldClass}
                />
                <FieldError messages={fieldErrors.email} />
              </div>

              <div>
                <Label htmlFor="password">KATA SANDI</Label>
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="••••••••"
                  leftIcon={<Lock className="h-4 w-4" />}
                  rightIcon={
                    <button
                      type="button"
                      tabIndex={-1}
                      onClick={() => setShowPassword((open) => !open)}
                      className="p-1 text-slate-400 transition-colors hover:text-slate-600"
                      aria-label={showPassword ? "Sembunyikan kata sandi" : "Tampilkan kata sandi"}
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  }
                  className={fieldClass}
                />
                <FieldError messages={fieldErrors.password} />
              </div>

              {error ? (
                <div className="rounded-xl border border-red-200 bg-red-50/90 px-4 py-3 text-sm text-danger" role="alert">
                  {error}
                </div>
              ) : null}

              <Button
                type="submit"
                size="lg"
                loading={submitting}
                className="h-11 w-full rounded-xl bg-primary text-sm font-semibold text-white shadow-brand hover:bg-primary-hover"
              >
                Masuk
              </Button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
