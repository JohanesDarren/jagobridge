import { useState } from "react";
import { Link } from "react-router-dom";
import { Eye, EyeOff, KeyRound } from "lucide-react";
import { Input, Label } from "../ui/Input";

/**
 * The key the testers authenticate with: the caller's own gateway key, the
 * same one pictured on the API Keys page. It is kept in this browser only.
 */
export function GatewayKeyField({
  value,
  onChange,
}: {
  value: string;
  onChange: (next: string) => void;
}) {
  const [visible, setVisible] = useState(false);

  return (
    <div>
      <Label htmlFor="gateway-key">API key</Label>
      <Input
        id="gateway-key"
        type={visible ? "text" : "password"}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder="jb_..."
        autoComplete="off"
        spellCheck={false}
        className="font-mono text-xs"
        leftIcon={<KeyRound className="h-4 w-4" aria-hidden />}
        rightIcon={
          <button
            type="button"
            onClick={() => setVisible((open) => !open)}
            className="text-slate-400 transition-colors hover:text-slate-600"
            aria-label={visible ? "Hide API key" : "Show API key"}
          >
            {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        }
      />
      <p className="mt-1.5 text-xs text-muted">
        Bring your own gateway key — requests run through the real pipeline. Create one on the{" "}
        <Link to="/api-keys" className="font-medium text-primary hover:underline">
          API Keys
        </Link>{" "}
        page. Stored in this browser only.
      </p>
    </div>
  );
}
