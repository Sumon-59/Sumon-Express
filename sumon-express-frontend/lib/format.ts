// Shared display formatting (rule-of-three extraction: this was copied
// in three admin pages before it moved here).

export const formatDate = (iso?: string | null) =>
  iso
    ? new Date(iso).toLocaleDateString("en-GB", {
        day: "numeric",
        month: "short",
        year: "numeric",
      })
    : "—";
