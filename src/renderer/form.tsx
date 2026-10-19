import type { FormEvent, ReactNode } from "react";
import type { Field } from "../shared/forms.js";
import { Button } from "./ui.js";

/**
 * A form built from fields (`fieldsFromSchema`). It holds no state: the app keeps the values and
 * the problems, and `readForm` turns them into the run's input.
 */
export function SchemaForm({
  fields,
  values,
  issues,
  onChange,
  onSubmit,
  submitLabel,
  busy = false,
  note,
  optionalLabel,
  layout,
  children,
}: {
  fields: Field[];
  values: Record<string, string>;
  issues: Record<string, string>;
  onChange: (name: string, value: string) => void;
  onSubmit: () => void;
  submitLabel: string;
  busy?: boolean;
  /** A line under the button, such as how long the slowest site takes. */
  note?: ReactNode;
  /** The word beside an optional field's label. */
  optionalLabel?: string;
  /** Fields that share a row, by name: [["origin", "destination"], ...]. */
  layout?: string[][];
  children?: ReactNode;
}) {
  const submit = (event: FormEvent) => {
    event.preventDefault();
    onSubmit();
  };
  const byName = new Map(fields.map((field) => [field.name, field]));
  const rows = layout ?? fields.map((field) => [field.name]);
  return (
    <form className="pk-form" onSubmit={submit} noValidate>
      {rows.map((row) => (
        <div className="pk-form-row" key={row.join("-")} data-count={row.length}>
          {row.map((name) => {
            const field = byName.get(name);
            return field ? (
              <FieldControl
                key={name}
                field={field}
                value={values[name] ?? ""}
                issue={issues[name]}
                optionalLabel={optionalLabel}
                onChange={(value) => onChange(name, value)}
              />
            ) : null;
          })}
        </div>
      ))}
      {children}
      <Button type="submit" variant="primary" busy={busy} className="pk-form-submit">
        {submitLabel}
      </Button>
      {note ? <p className="pk-form-note">{note}</p> : null}
    </form>
  );
}

function FieldControl({
  field,
  value,
  issue,
  optionalLabel,
  onChange,
}: {
  field: Field;
  value: string;
  issue: string | undefined;
  optionalLabel?: string;
  onChange: (value: string) => void;
}) {
  const id = `pk-field-${field.name}`;
  const describedBy = issue ? `${id}-issue` : field.hint ? `${id}-hint` : undefined;
  const common = {
    id,
    name: field.name,
    "aria-invalid": issue ? true : undefined,
    "aria-describedby": describedBy,
    "aria-required": field.required || undefined,
  };
  let control: ReactNode;
  switch (field.kind) {
    case "select":
      control = (
        <select {...common} className="pk-input pk-select" value={value} onChange={(event) => onChange(event.target.value)}>
          {field.options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      );
      break;
    case "number":
      control = (
        <input
          {...common}
          className="pk-input"
          type="number"
          inputMode="numeric"
          min={field.min}
          max={field.max}
          step={field.step}
          value={value}
          onChange={(event) => onChange(event.target.value)}
        />
      );
      break;
    case "date":
      control = (
        <input
          {...common}
          className="pk-input"
          type="date"
          min={field.min}
          value={value}
          onChange={(event) => onChange(event.target.value)}
        />
      );
      break;
    case "text":
      control = (
        <input
          {...common}
          className="pk-input"
          type="text"
          autoComplete="off"
          spellCheck={false}
          placeholder={field.placeholder}
          maxLength={field.maxLength}
          value={value}
          onChange={(event) => onChange(event.target.value)}
        />
      );
      break;
  }
  return (
    <div className="pk-field" data-invalid={issue ? true : undefined}>
      <label className="pk-label" htmlFor={id}>
        {field.label}
        {!field.required && optionalLabel ? <span className="pk-optional">{optionalLabel}</span> : null}
      </label>
      {control}
      {issue ? (
        <p id={`${id}-issue`} className="pk-field-error">
          {issue}
        </p>
      ) : field.hint ? (
        <p id={`${id}-hint`} className="pk-field-hint">
          {field.hint}
        </p>
      ) : null}
    </div>
  );
}
