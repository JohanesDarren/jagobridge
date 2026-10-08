import { Link } from "react-router-dom";

export function NotFoundPage() {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-20 text-center">
      <p className="text-3xl font-semibold text-foreground">404</p>
      <p className="text-sm text-muted">This page does not exist.</p>
      <Link to="/" className="text-sm font-medium text-primary hover:underline">
        Back to the dashboard
      </Link>
    </div>
  );
}
