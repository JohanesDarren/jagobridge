import { useState, type FormEvent } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { apiRequest, ApiError } from "../../lib/api-client";
import { useAuth } from "../../hooks/useAuth";
import { Button } from "../../components/ui/Button";
import { FieldError, Input, Label } from "../../components/ui/Input";

export function AcceptInvitePage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token") ?? "";
  const navigate = useNavigate();
  const { refreshMe } = useAuth();
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [submitting, setSubmitting] = useState(false);

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    setFieldErrors({});
    setSubmitting(true);
    try {
      await apiRequest("/auth/accept-invite", { method: "POST", body: { token, name, password } });
      await refreshMe();
      navigate("/usage-notice", { replace: true });
    } catch (caught) {
      if (caught instanceof ApiError) {
        setError(caught.message);
        setFieldErrors(caught.fieldErrors);
      } else {
        setError("Unable to accept the invitation right now.");
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (!token) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
        <div className="jb-card max-w-md p-8 text-center rounded-2xl shadow-xl">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-50 text-warning">
            <span className="text-xl">⚠️</span>
          </div>
          <h1 className="text-xl font-bold text-slate-900">Undangan Tidak Berlaku</h1>
          <p className="mt-2 text-sm text-slate-500">Tautan undangan ini telah kedaluwarsa atau tidak valid. Silakan hubungi administrator.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-12">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-[#0b22db] to-[#040e5e] text-white shadow-md shadow-primary/25">
            <span className="text-xl font-bold">JB</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-900">Terima Undangan Anda</h1>
          <p className="mt-1.5 text-sm text-slate-500">Lengkapi data diri dan buat kata sandi untuk bergabung ke JagoBridge.</p>
        </div>

        <form onSubmit={onSubmit} className="jb-card space-y-5 p-8 rounded-2xl shadow-xl border border-slate-200/80">
          <div>
            <Label htmlFor="name">Nama Lengkap</Label>
            <Input
              id="name"
              required
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Nama Lengkap Anda"
              className="h-11"
            />
            <FieldError messages={fieldErrors.name} />
          </div>

          <div>
            <Label htmlFor="password">Kata Sandi Baru</Label>
            <Input
              id="password"
              type="password"
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="••••••••"
              className="h-11"
            />
            <p className="mt-1.5 text-xs text-slate-400">
              Minimal 10 karakter dengan huruf besar, huruf kecil, dan angka.
            </p>
            <FieldError messages={fieldErrors.password} />
          </div>

          {error ? (
            <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-danger" role="alert">
              {error}
            </p>
          ) : null}

          <Button type="submit" size="lg" loading={submitting} className="w-full">
            Bergabung ke JagoBridge →
          </Button>
        </form>
      </div>
    </div>
  );
}
