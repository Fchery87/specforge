import { Button } from "@/components/ui/button";

/**
 * Says a phase's document no longer matches its requirements, and why, with the control that fixes
 * it. An applied change is the usual reason ("CHG-0003 applied"); a regenerated upstream phase or a
 * changed evidence source are the others.
 */
export function StaleDocumentNotice({
  reason,
  onRegenerate,
  disabled = false,
}: {
  reason?: string;
  onRegenerate: () => void;
  disabled?: boolean;
}) {
  return (
    <div
      role="status"
      className="flex flex-col justify-between gap-4 rounded-lg border border-warning/40 bg-warning/10 px-4 py-3 sm:flex-row sm:items-center"
    >
      <p className="text-ui text-ink">
        <span className="font-semibold">This document is out of date</span>
        {reason ? <span className="text-muted-foreground">: {reason}.</span> : "."} Regenerate it to bring it in
        line with the requirements.
      </p>
      <Button size="sm" variant="outline" className="shrink-0" disabled={disabled} onClick={onRegenerate}>
        Regenerate
      </Button>
    </div>
  );
}
