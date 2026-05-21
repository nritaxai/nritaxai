import { useEffect, useMemo, useState } from "react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";

export type ClarificationQuestion = {
  field: string;
  label: string;
  question: string;
  inputType: "text" | "select";
  placeholder?: string;
  options?: Array<{ value: string; label: string }>;
};

export type ClarificationState = {
  originalQuestion: string;
  requiredFields: string[];
  missingFields: string[];
  context: Record<string, string>;
  contextSummary?: string;
  questions: ClarificationQuestion[];
};

type ClarificationPanelProps = {
  clarification: ClarificationState;
  submitting?: boolean;
  onSubmit: (values: Record<string, string>) => Promise<void> | void;
  onReset: () => void;
};

const formatFieldLabel = (field: string) =>
  field
    .replace(/([A-Z])/g, " $1")
    .replace(/^./, (char) => char.toUpperCase());

export function ClarificationPanel({
  clarification,
  submitting = false,
  onSubmit,
  onReset,
}: ClarificationPanelProps) {
  const initialValues = useMemo(
    () =>
      clarification.questions.reduce<Record<string, string>>((acc, question) => {
        acc[question.field] = clarification.context?.[question.field] || "";
        return acc;
      }, {}),
    [clarification]
  );
  const [values, setValues] = useState<Record<string, string>>(initialValues);

  useEffect(() => {
    setValues(initialValues);
  }, [initialValues]);

  const missingRequiredValue = clarification.questions.some((question) => !String(values[question.field] || "").trim());

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (missingRequiredValue || submitting) return;
    await onSubmit(
      Object.fromEntries(
        Object.entries(values).map(([field, value]) => [field, String(value || "").trim()])
      )
    );
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="mt-4 rounded-2xl border border-[#BFDBFE] bg-[#EFF6FF] p-4 text-[#0F172A] shadow-sm"
    >
      <p className="text-sm font-semibold">Required tax context</p>
      <p className="mt-1 text-xs text-[#475569]">
        Yukti will continue once these details are filled.
      </p>

      {Object.keys(clarification.context || {}).length > 0 ? (
        <div className="mt-3 flex flex-wrap gap-2">
          {Object.entries(clarification.context).map(([field, value]) => (
            <span
              key={field}
              className="rounded-full border border-[#BFDBFE] bg-white px-3 py-1 text-[11px] font-medium"
            >
              {formatFieldLabel(field)}: {value}
            </span>
          ))}
        </div>
      ) : null}

      <div className="mt-4 grid gap-4">
        {clarification.questions.map((question) => (
          <label key={question.field} className="block">
            <span className="mb-2 block text-sm font-medium">{question.question}</span>
            {question.inputType === "select" ? (
              <Select
                value={values[question.field] || ""}
                onValueChange={(nextValue) =>
                  setValues((current) => ({ ...current, [question.field]: nextValue }))
                }
              >
                <SelectTrigger className="w-full border-[#BFDBFE] bg-white text-[#0F172A]">
                  <SelectValue placeholder={`Select ${question.label.toLowerCase()}`} />
                </SelectTrigger>
                <SelectContent>
                  {(question.options || []).map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <Input
                value={values[question.field] || ""}
                onChange={(event) =>
                  setValues((current) => ({ ...current, [question.field]: event.target.value }))
                }
                placeholder={question.placeholder || question.label}
                className="border-[#BFDBFE] bg-white text-[#0F172A]"
              />
            )}
          </label>
        ))}
      </div>

      <div className="mt-4 flex flex-col gap-2 sm:flex-row">
        <Button type="submit" disabled={missingRequiredValue || submitting}>
          {submitting ? "Continuing..." : "Continue"}
        </Button>
        <Button type="button" variant="outline" onClick={onReset} disabled={submitting}>
          Reset
        </Button>
      </div>
    </form>
  );
}
