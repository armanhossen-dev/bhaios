import React from "react";

type BadgeTone = "blue" | "amber" | "emerald" | "red" | "neutral";

const TONES: Record<BadgeTone, string> = {
  blue: "bg-blue-500/12 text-blue-400 border-blue-500/25",
  amber: "bg-amber-500/12 text-amber-400 border-amber-500/25",
  emerald: "bg-emerald-500/12 text-emerald-400 border-emerald-500/25",
  red: "bg-red-500/12 text-red-400 border-red-500/25",
  neutral: "bg-[var(--bg-elevated)] text-[var(--text-secondary)] border-[var(--border-subtle)]",
};

export const Badge: React.FC<{
  children: React.ReactNode;
  tone?: BadgeTone;
  className?: string;
}> = ({ children, tone = "neutral", className = "" }) => (
  <span
    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md border text-[11px] font-medium ${TONES[tone]} ${className}`}
  >
    {children}
  </span>
);

export const Panel: React.FC<{
  children: React.ReactNode;
  title?: string;
  subtitle?: string;
  actions?: React.ReactNode;
  className?: string;
}> = ({ children, title, subtitle, actions, className = "" }) => (
  <section
    className={`rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] ${className}`}
  >
    {(title || actions) && (
      <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-[var(--border-subtle)]">
        <div className="min-w-0">
          {title && <h2 className="text-sm font-semibold tracking-tight truncate">{title}</h2>}
          {subtitle && <p className="text-xs text-[var(--text-muted)] truncate">{subtitle}</p>}
        </div>
        {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
      </div>
    )}
    <div className="p-4">{children}</div>
  </section>
);

export const PageHeader: React.FC<{
  title: string;
  subtitle?: string;
  icon?: string;
  badge?: React.ReactNode;
  actions?: React.ReactNode;
}> = ({ title, subtitle, icon, badge, actions }) => (
  <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-[var(--border-subtle)]">
    <div className="min-w-0 space-y-0.5">
      <div className="flex items-center gap-2 flex-wrap">
        {icon && <i className={`bx ${icon} text-lg text-[var(--accent-blue)]`} />}
        <h1 className="text-lg font-semibold tracking-tight">{title}</h1>
        {badge}
      </div>
      {subtitle && <p className="text-xs text-[var(--text-secondary)]">{subtitle}</p>}
    </div>
    {actions && <div className="flex items-center gap-2 flex-wrap shrink-0">{actions}</div>}
  </header>
);

export const LoadingState: React.FC<{ label?: string }> = ({ label = "Loading workspace…" }) => (
  <div className="flex items-center justify-center py-12 text-xs text-[var(--text-muted)] gap-2">
    <i className="bx bx-loader-alt bx-spin text-base text-[var(--accent-blue)]" />
    <span>{label}</span>
  </div>
);

export const EmptyState: React.FC<{
  icon: string;
  title: string;
  description: string;
  action?: React.ReactNode;
}> = ({ icon, title, description, action }) => (
  <div className="rounded-xl border border-dashed border-[var(--border-subtle)] bg-[var(--bg-surface)]/40 px-6 py-10 text-center space-y-2.5">
    <div className="w-10 h-10 rounded-lg bg-[var(--bg-elevated)] border border-[var(--border-subtle)] mx-auto flex items-center justify-center text-[var(--text-muted)]">
      <i className={`bx ${icon} text-xl`} />
    </div>
    <div className="text-sm font-semibold">{title}</div>
    <p className="text-xs text-[var(--text-muted)] max-w-md mx-auto">{description}</p>
    {action && <div className="pt-1">{action}</div>}
  </div>
);

export const ErrorState: React.FC<{ message: string; onRetry?: () => void }> = ({
  message,
  onRetry,
}) => (
  <div className="rounded-xl border border-red-500/30 bg-red-500/5 px-4 py-3 flex items-center justify-between gap-3 text-xs text-red-400">
    <span className="flex items-center gap-2">
      <i className="bx bx-error-circle text-base shrink-0" />
      <span>{message}</span>
    </span>
    {onRetry && (
      <button
        type="button"
        onClick={onRetry}
        className="px-2.5 py-1 rounded-md bg-red-500/15 hover:bg-red-500/25 font-semibold cursor-pointer shrink-0"
      >
        Retry
      </button>
    )}
  </div>
);
