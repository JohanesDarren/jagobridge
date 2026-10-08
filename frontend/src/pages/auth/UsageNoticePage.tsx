import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../hooks/useAuth";
import { Button } from "../../components/ui/Button";

export function UsageNoticePage() {
  const { acknowledgeUsageNotice } = useAuth();
  const navigate = useNavigate();
  const [submitting, setSubmitting] = useState(false);

  const acknowledge = async () => {
    setSubmitting(true);
    try {
      await acknowledgeUsageNotice();
      navigate("/", { replace: true });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-surface px-4 py-8">
      <div className="jb-card w-full max-w-2xl p-6">
        <h1 className="text-xl font-semibold">How JagoBridge handles your data</h1>
        <div className="mt-4 space-y-3 text-sm text-foreground">
          <p>
            JagoBridge records <strong>usage metadata</strong> for every request: the model used, token counts, the
            source (API or playground), status, and timestamps. Usage metadata is kept for 180 days.
          </p>
          <p>
            Prompts and responses for API traffic are <strong>not stored</strong>. Playground chat history is stored so
            you can return to a conversation, and you can delete it at any time. Playground history is kept for up to
            90 days.
          </p>
          <p>
            Your prompts and responses are sent to the upstream model provider (9router) to produce answers. Usage
            limits are measured in weighted tokens and reset on a rolling basis.
          </p>
          <p className="text-muted">
            Audit log entries about administrative actions are kept for 365 days. Sign-in events and account changes
            are recorded for accountability.
          </p>
        </div>
        <div className="mt-6 flex justify-end">
          <Button onClick={acknowledge} loading={submitting}>
            I understand and accept
          </Button>
        </div>
      </div>
    </div>
  );
}
