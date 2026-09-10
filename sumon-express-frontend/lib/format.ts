// Shared display formatting (rule-of-three extraction: this was copied
// in three admin pages before it moved here).

// One place decides how a line with an option value reads ("Shirt · M").
export const lineLabel = (name: string, variant?: string | null) =>
  variant ? `${name} · ${variant}` : name;

export const formatDate = (iso?: string | null) =>
  iso
    ? new Date(iso).toLocaleDateString("en-GB", {
        day: "numeric",
        month: "short",
        year: "numeric",
      })
    : "—";
