import { Suspense, lazy, useEffect, useState, type FormEvent } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { AtSign, Eye, EyeOff, Lock } from "lucide-react";
import { useAuth } from "../../hooks/useAuth";
import { ApiError } from "../../lib/api-client";
import { Button } from "../../components/ui/Button";
import { FieldError, Input, Label } from "../../components/ui/Input";
import { Logo } from "../../components/ui/Logo";

/**
 * The 3D scene is split out so the WebGL bundle never blocks first paint and
 * never loads at all for users who cannot use it.
 */
const BridgeScene = lazy(() =>
  import("./login3d/BridgeScene").then((m) => ({ default: m.BridgeScene })),
);
const Logo3D = lazy(() =>
  import("./login3d/Logo3D").then((m) => ({ default: m.Logo3D })),
);

/** True when the visitor asked the OS to reduce motion. */
function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(query.matches);
    const listener = (event: MediaQueryListEvent) => setReduced(event.matches);
    query.addEventListener("change", listener);
    return () => query.removeEventListener("change", listener);
  }, []);

  return reduced;
}

/**
 * WebGL support check. Without it the 3D canvas would mount and fail, so we
 * fall back to a static gradient instead.
 */
function useWebGLSupport(): boolean {
  const [supported, setSupported] = useState(false);

  useEffect(() => {
    try {
      const canvas = document.createElement("canvas");
      const context =
        canvas.getContext("webgl2") ??
        canvas.getContext("webgl") ??
        canvas.getContext("experimental-webgl");
      setSupported(Boolean(context));
    } catch {
      setSupported(false);
    }
  }, []);

  return supported;
}

export function LoginPage() {
  const { status, user, login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [submitting, setSubmitting] = useState(false);

  const reducedMotion = useReducedMotion();
  const webgl = useWebGLSupport();

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
    "h-[52px] border-white/20 bg-white/[0.07] text-base text-white placeholder:text-slate-400 focus:border-cyan-300/70 focus:ring-cyan-300/20 hover:border-white/30";

  return (
    <div className="relative min-h-screen w-full overflow-hidden bg-[#070d1b] font-sans">
      {/* ------------------------------------------------------ 3D BACKGROUND */}
      <div className="absolute inset-0 z-0">
        {webgl ? (
          <Suspense fallback={<StaticBackdrop />}>
            <BridgeScene reducedMotion={reducedMotion} />
          </Suspense>
        ) : (
          <StaticBackdrop />
        )}
      </div>

      {/* Vignette so the centred card always has contrast over the scene. */}
      <div
        className="pointer-events-none absolute inset-0 z-10"
        style={{
          background:
            "radial-gradient(ellipse 46% 54% at 50% 50%, rgba(7,13,27,0.86) 0%, rgba(7,13,27,0.45) 46%, rgba(7,13,27,0.04) 74%, rgba(7,13,27,0.42) 100%)",
        }}
        aria-hidden="true"
      />

      {/* ------------------------------------------------------------- CONTENT */}
      <div className="relative z-20 flex min-h-screen w-full items-center justify-center px-5 py-10 sm:px-8">
        <div className="w-full max-w-[452px]">
          {/* Logo sits at the top-centre of the card */}
          <div className="mb-5 flex flex-col items-center">
            <div className="relative flex h-[132px] w-[132px] items-center justify-center">
              {webgl ? (
                <Suspense fallback={<Logo className="h-16 w-16 drop-shadow-lg" />}>
                  <Logo3D reducedMotion={reducedMotion} />
                </Suspense>
              ) : (
                <Logo className="h-16 w-16 drop-shadow-lg" />
              )}
            </div>
            <h1 className="mt-1 text-2xl font-bold tracking-tight text-white">JagoBridge</h1>
            <p className="mt-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-cyan-300/80">
              Enterprise AI Gateway
            </p>
          </div>

          {/* Glass sign-in card */}
          <div className="relative rounded-[26px] border border-white/12 bg-white/[0.055] p-7 shadow-[0_24px_70px_-20px_rgba(0,0,0,0.85)] backdrop-blur-2xl sm:p-8">
            {/* Top highlight edge */}
            <div
              className="pointer-events-none absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-white/40 to-transparent"
              aria-hidden="true"
            />

            <div className="mb-6 text-center">
              <h2 className="text-xl font-semibold tracking-tight text-white">Masuk</h2>
              <p className="mt-1.5 text-sm text-slate-200/90">
                Akses model AI tim Anda dengan satu pintu.
              </p>
            </div>

            <form onSubmit={onSubmit} className="space-y-5">
              <div>
                <Label htmlFor="email" className="text-slate-200/90">
                  EMAIL
                </Label>
                <Input
                  id="email"
                  type="email"
                  autoComplete="username"
                  required
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="nama@perusahaan.com"
                  leftIcon={<AtSign className="h-5 w-5" />}
                  className={fieldClass}
                />
                <FieldError messages={fieldErrors.email} />
              </div>

              <div>
                <Label htmlFor="password" className="text-slate-200/90">
                  KATA SANDI
                </Label>
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="••••••••"
                  leftIcon={<Lock className="h-5 w-5" />}
                  rightIcon={
                    <button
                      type="button"
                      tabIndex={-1}
                      onClick={() => setShowPassword((open) => !open)}
                      className="p-1 text-slate-400 transition-colors hover:text-white"
                      aria-label={showPassword ? "Sembunyikan kata sandi" : "Tampilkan kata sandi"}
                    >
                      {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                    </button>
                  }
                  className={fieldClass}
                />
                <FieldError messages={fieldErrors.password} />
              </div>

              {error ? (
                <div
                  className="rounded-xl border border-red-400/30 bg-red-500/12 px-4 py-3 text-sm text-red-200"
                  role="alert"
                >
                  {error}
                </div>
              ) : null}

              <Button
                type="submit"
                size="lg"
                loading={submitting}
                className="h-[52px] w-full rounded-xl bg-gradient-to-b from-[#2a44ff] to-primary text-base font-semibold text-white shadow-[0_10px_30px_-8px_rgba(13,38,222,0.85)] ring-1 ring-inset ring-white/20 transition-all hover:-translate-y-0.5 hover:from-[#3a54ff] hover:to-[#0d26de] active:translate-y-0"
              >
                Masuk
              </Button>
            </form>
          </div>

          <p className="mt-6 text-center text-xs text-slate-300/70">
            Dilindungi kebijakan akses internal JagoAI
          </p>
        </div>
      </div>
    </div>
  );
}

/** Shown while the WebGL bundle loads, and for browsers without WebGL. */
function StaticBackdrop() {
  return (
    <div className="h-full w-full bg-[#070d1b]">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_28%,rgba(47,107,214,0.42),transparent_58%)]" />
      <div className="absolute inset-x-0 bottom-0 h-1/2 bg-[linear-gradient(to_top,rgba(13,38,222,0.28),transparent)]" />
    </div>
  );
}
