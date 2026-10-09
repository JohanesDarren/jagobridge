import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { apiRequest, ApiError } from "../../lib/api-client";
import { useAuth } from "../../hooks/useAuth";
import { Button } from "../../components/ui/Button";
import { FieldError, Input, Label } from "../../components/ui/Input";

export function ChangePasswordPage() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [submitting, setSubmitting] = useState(false);

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    setFieldErrors({});
    if (newPassword !== confirmPassword) {
      setError("The new password and confirmation do not match.");
      return;
    }
    setSubmitting(true);
    try {
      await apiRequest("/auth/change-password", {
        method: "POST",
        body: { current_password: currentPassword, new_password: newPassword },
      });
      await logout();
      navigate("/login", { replace: true });
    } catch (caught) {
      if (caught instanceof ApiError) {
        setError(caught.message);
        setFieldErrors(caught.fieldErrors);
      } else {
        setError("Unable to change the password right now.");
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-12">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-[#0b22db] to-[#040e5e] text-white shadow-md shadow-primary/25">
            <span className="text-xl font-bold">🔒</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-900">Ubah Kata Sandi</h1>
          <p className="mt-1.5 text-sm text-slate-500">
            {user?.must_change_password
              ? "Anda harus mengatur kata sandi baru sebelum dapat melanjutkan ke aplikasi."
              : "Perbarui kata sandi untuk mengamankan akun JagoBridge Anda."}
          </p>
        </div>

        <form onSubmit={onSubmit} className="jb-card space-y-5 p-8 rounded-2xl shadow-xl border border-slate-200/80">
          <div>
            <Label htmlFor="current">Kata Sandi Saat Ini</Label>
            <Input
              id="current"
              type="password"
              required
              value={currentPassword}
              onChange={(event) => setCurrentPassword(event.target.value)}
              placeholder="••••••••"
              className="h-11"
            />
            <FieldError messages={fieldErrors.current_password} />
          </div>

          <div>
            <Label htmlFor="new">Kata Sandi Baru</Label>
            <Input
              id="new"
              type="password"
              required
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
              placeholder="••••••••"
              className="h-11"
            />
            <FieldError messages={fieldErrors.new_password} />
          </div>

          <div>
            <Label htmlFor="confirm">Konfirmasi Kata Sandi Baru</Label>
            <Input
              id="confirm"
              type="password"
              required
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              placeholder="••••••••"
              className="h-11"
            />
          </div>

          {error ? (
            <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-danger" role="alert">
              {error}
            </p>
          ) : null}

          <Button type="submit" size="lg" loading={submitting} className="w-full">
            Simpan Kata Sandi Baru →
          </Button>
        </form>
      </div>
    </div>
  );
}
