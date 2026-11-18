import DOMPurify from "dompurify";

export function RichTextRenderer({
  html,
  className,
}: {
  html: string | null | undefined;
  className?: string;
}) {
  if (!html) {
    return <p className="text-sm text-slate-500">Мазмұн әлі енгізілмеген.</p>;
  }
  return (
    <div
      className={["prose-content", className].filter(Boolean).join(" ")}
      // Draft previews can contain unsaved HTML that has not reached the API yet.
      dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(html) }}
    />
  );
}
