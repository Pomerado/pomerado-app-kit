import { KIT_COPY } from "./copy.js";

/**
 * A form made from a tool's input_schema, or from an app's own ask written the same way. Each
 * property becomes one control: an enum a select, a number a number field with its bounds, a
 * date a date field, and anything else a text box. Values are kept as the strings the controls
 * hold and typed once, when the form is sent.
 */

const F = KIT_COPY.forms;

/** The most characters a text box takes when its schema sets no maximum. */
export const TEXT_MAX_LENGTH = 100;

export type SchemaProperty = {
  title?: string;
  description?: string;
  type?: string | string[];
  enum?: readonly unknown[];
  format?: string;
  pattern?: string;
  minLength?: number;
  maxLength?: number;
  minimum?: number;
  maximum?: number;
  exclusiveMinimum?: number;
  examples?: readonly unknown[];
  default?: unknown;
};

export type InputSchema = {
  type?: "object";
  required?: string[];
  properties?: Record<string, SchemaProperty>;
};

export type ValueType = "string" | "integer" | "number" | "boolean";

type FieldBase = {
  name: string;
  label: string;
  type: ValueType;
  required: boolean;
  /** A line under the control, from the property's description. */
  hint?: string;
  /** The words shown when the value doesn't match the property's pattern. */
  patternMessage?: string;
};

export type Field = FieldBase &
  (
    | { kind: "select"; options: { value: string; label: string }[] }
    | { kind: "number"; min?: number; max?: number; step: number | "any" }
    | { kind: "date"; min?: string }
    | { kind: "text"; placeholder?: string; maxLength: number; pattern?: string }
  );

export type FieldOptions = {
  /** Readable names for enum values, by value. */
  optionLabels?: Record<string, string>;
  /** The words to show when a text value fails its pattern, by field name. */
  patternMessages?: Record<string, string>;
  /** The earliest date a date field offers, by field name, as YYYY-MM-DD. */
  minDates?: Record<string, string>;
};

/** departure_date -> Departure date */
export function humanize(name: string) {
  const words = name.replace(/_/g, " ").trim();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

function valueType(property: SchemaProperty): ValueType {
  const declared = (Array.isArray(property.type) ? property.type : [property.type]).filter(
    (type) => type !== undefined && type !== "null",
  );
  const sample = property.enum?.find((value) => value !== null);
  const type = declared[0] ?? (typeof sample === "number" ? "number" : typeof sample);
  if (type === "integer" || type === "number" || type === "boolean") return type;
  return "string";
}

/** The form's fields, in the schema's property order, required ones marked. */
export function fieldsFromSchema(schema: InputSchema, options: FieldOptions = {}): Field[] {
  const required = new Set(schema.required ?? []);
  return Object.entries(schema.properties ?? {}).map(([name, property]): Field => {
    const base: FieldBase = {
      name,
      label: property.title ?? humanize(name),
      type: valueType(property),
      required: required.has(name),
      hint: property.description,
      patternMessage: options.patternMessages?.[name],
    };
    if (Array.isArray(property.enum)) {
      const values = property.enum.filter((value) => value !== null && typeof value !== "object");
      return {
        ...base,
        kind: "select",
        options: values.map((value) => ({
          value: String(value),
          label: options.optionLabels?.[String(value)] ?? humanize(String(value)),
        })),
      };
    }
    if (base.type === "boolean") {
      return {
        ...base,
        kind: "select",
        options: [
          { value: "true", label: options.optionLabels?.true ?? F.yes },
          { value: "false", label: options.optionLabels?.false ?? F.no },
        ],
      };
    }
    if (base.type === "integer" || base.type === "number") {
      const exclusive = property.exclusiveMinimum;
      const min =
        property.minimum ?? (exclusive !== undefined && base.type === "integer" ? exclusive + 1 : undefined);
      return {
        ...base,
        kind: "number",
        min,
        max: property.maximum,
        step: base.type === "integer" ? 1 : "any",
      };
    }
    if (property.format === "date") return { ...base, kind: "date", min: options.minDates?.[name] };
    const sample = property.examples?.[0];
    return {
      ...base,
      kind: "text",
      placeholder: typeof sample === "string" ? sample : undefined,
      maxLength: property.maxLength ?? TEXT_MAX_LENGTH,
      pattern: property.pattern,
    };
  });
}

/** The starting values: each property's default, as the control's string. */
export function initialValues(schema: InputSchema): Record<string, string> {
  return Object.fromEntries(
    Object.entries(schema.properties ?? {}).map(([name, property]) => [
      name,
      property.default === undefined ? "" : String(property.default),
    ]),
  );
}

export function isCalendarDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().startsWith(value);
}

/** What is wrong with one field's text, or null when it is fine or empty and optional. */
function issueOf(field: Field, text: string): string | null {
  if (text === "") return field.required ? F.required : null;
  switch (field.kind) {
    case "select":
      return field.options.some((option) => option.value === text) ? null : F.choice;
    case "number": {
      const number = Number(text);
      const integer = field.type === "integer";
      const bad =
        !Number.isFinite(number) ||
        (integer && !Number.isInteger(number)) ||
        (field.min !== undefined && number < field.min) ||
        (field.max !== undefined && number > field.max);
      return bad ? F.number(field.min ?? 0, field.max ?? 999) : null;
    }
    case "date":
      if (!isCalendarDate(text)) return F.date;
      return field.min !== undefined && text < field.min ? F.date : null;
    case "text":
      if ([...text].length > field.maxLength) return F.tooLong(field.maxLength);
      if (field.pattern !== undefined && !new RegExp(field.pattern, "u").test(text)) {
        return field.patternMessage ?? F.format;
      }
      return null;
  }
}

function coerce(type: ValueType, text: string): unknown {
  if (type === "integer" || type === "number") return Number(text);
  if (type === "boolean") return text === "true";
  return text;
}

/**
 * The typed input when every field is fine, else the problems by field name. Empty optional
 * fields are left out of the input.
 */
export function readForm(
  fields: Field[],
  values: Record<string, string>,
): { ok: true; input: Record<string, unknown> } | { ok: false; issues: Record<string, string> } {
  const issues: Record<string, string> = {};
  const input: Record<string, unknown> = {};
  for (const field of fields) {
    const text = (values[field.name] ?? "").trim();
    const issue = issueOf(field, text);
    if (issue !== null) issues[field.name] = issue;
    else if (text !== "") input[field.name] = coerce(field.type, text);
  }
  return Object.keys(issues).length > 0 ? { ok: false, issues } : { ok: true, input };
}
