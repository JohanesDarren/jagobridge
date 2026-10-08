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
      <div className="flex min-h-screen items-center justify-center bg-surface px-4">
        <div className="jb-card max-w-md p-6 text-center">
          <h1 className="text-lg font-semibold">This invitation is no longer valid</h1>
          <p className="mt-2 text-sm text-muted">Please ask an administrator to send you a new invitation.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-surface px-4">
      <form onSubmit={onSubmit} className="jb-card w-full max-w-sm space-y-4 p-6">
        <div>
          <h1 className="text-xl font-semibold">Accept your invitation</h1>
          <p className="mt-1 text-sm text-muted">Set your name and password to join JagoBridge.</p>
        </div>

        <div>
          <Label htmlFor="name">Full name</Label>
          <Input id="name" required value={name} onChange={(event) => setName(event.target.value)} />
          <FieldError messages={fieldErrors.name} />
        </div>

        <div>
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            type="password"
            required
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
          <p className="mt-1 text-xs text-muted">
            At least 10 characters, with an uppercase letter, a lowercase letter, and a digit.
          </p>
          <FieldError messages={fieldErrors.password} />
        </div>

        {error ? (
          <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-danger" role="alert">
            {error}
          </p>
        ) : null}

        <Button type="submit" loading={submitting} className="w-full">
          Join JagoBridge
        </Button>
      </form>
    </div>
  );
}
