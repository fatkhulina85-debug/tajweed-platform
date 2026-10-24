import type { ReactNode } from "react";

const inputClass = "w-full rounded-lg border border-line bg-surface px-3 py-2 text-base";

export function TextArea({
  label,
  name,
  defaultValue,
  rows = 4,
  required = false,
  dir,
  hint,
}: {
  label: string;
  name: string;
  defaultValue?: string;
  rows?: number;
  required?: boolean;
  dir?: "rtl" | "ltr";
  hint?: string;
}) {
  return (
    <label className="block space-y-1 text-sm">
      <span className="font-medium text-ink">{label}</span>
      <textarea
        name={name}
        rows={rows}
        required={required}
        defaultValue={defaultValue}
        dir={dir}
        lang={dir === "rtl" ? "ar" : undefined}
        className={`${inputClass} ${dir === "rtl" ? "arabic" : ""}`}
      />
      {hint && <span className="block text-xs text-muted">{hint}</span>}
    </label>
  );
}

export function SelectField({
  label,
  name,
  options,
  defaultValue,
}: {
  label: string;
  name: string;
  options: { value: string; label: string }[];
  defaultValue?: string;
}) {
  return (
    <label className="block space-y-1 text-sm">
      <span className="font-medium text-ink">{label}</span>
      <select name={name} defaultValue={defaultValue} className={inputClass}>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

export function Checkbox({ label, name, defaultChecked }: { label: string; name: string; defaultChecked?: boolean }) {
  return (
    <label className="flex items-center gap-2 text-sm">
      <input type="checkbox" name={name} defaultChecked={defaultChecked} className="size-4" />
      <span>{label}</span>
    </label>
  );
}

const tones = {
  draft: "bg-canvas text-muted border-line",
  published: "bg-mint text-primary border-primary/30",
  archived: "bg-canvas text-muted border-line line-through",
  pending: "bg-amber-50 text-amber-900 border-amber-200",
  in_review: "bg-amber-50 text-amber-900 border-amber-200",
  verified: "bg-mint text-primary border-primary/30",
  not_required: "bg-canvas text-muted border-line",
  rejected: "bg-red-50 text-red-800 border-red-200",
} as const;

export function Pill({ tone, children }: { tone: keyof typeof tones; children: ReactNode }) {
  return (
    <span className={`inline-block whitespace-nowrap rounded-full border px-2 py-0.5 text-xs ${tones[tone]}`}>
      {children}
    </span>
  );
}

/** A one-button form for a Server Action with hidden fields. */
export function ActionButton({
  action,
  fields,
  children,
  variant = "secondary",
  disabled,
  title,
}: {
  action: (formData: FormData) => Promise<void>;
  fields: Record<string, string>;
  children: ReactNode;
  variant?: "primary" | "secondary" | "danger";
  disabled?: boolean;
  title?: string;
}) {
  const styles = {
    primary: "bg-primary text-white hover:bg-primary-strong border-primary",
    secondary: "bg-surface text-ink hover:bg-mint border-line",
    danger: "bg-surface text-red-800 hover:bg-red-50 border-line",
  }[variant];
  return (
    <form action={action} className="inline">
      {Object.entries(fields).map(([name, value]) => (
        <input key={name} type="hidden" name={name} value={value} />
      ))}
      <button
        type="submit"
        disabled={disabled}
        title={title}
        className={`rounded-lg border px-3 py-1.5 text-sm disabled:cursor-not-allowed disabled:opacity-50 ${styles}`}
      >
        {children}
      </button>
    </form>
  );
}

export function Panel({ title, children }: { title?: string; children: ReactNode }) {
  return (
    <section className="space-y-4 rounded-xl border border-line bg-surface p-5">
      {title && <h2 className="text-lg font-semibold text-ink">{title}</h2>}
      {children}
    </section>
  );
}
