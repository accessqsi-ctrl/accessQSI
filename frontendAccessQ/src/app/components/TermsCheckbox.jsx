import Link from "next/link";

// Case d'acceptation des conditions. Les liens s'ouvrent dans un nouvel onglet pour ne pas perdre la saisie.
const AUDIENCES = {
  organizer: [
    { before: "les ", href: "/conditions-utilisation", label: "conditions d’utilisation" },
    { before: " et la ", href: "/confidentialite", label: "politique de confidentialité" }
  ],
  attendee: [
    { before: "les ", href: "/conditions-vente", label: "conditions de vente des billets" },
    { before: ", les ", href: "/conditions-utilisation", label: "conditions d’utilisation" },
    { before: " et la ", href: "/confidentialite", label: "politique de confidentialité" }
  ]
};

export default function TermsCheckbox({ audience = "attendee", checked, onChange, id = "accept-terms" }) {
  const links = AUDIENCES[audience];
  return (
    <div className="flex items-start gap-2">
      <input
        type="checkbox"
        id={id}
        required
        checked={checked}
        onChange={event => onChange(event.target.checked)}
        className="mt-0.5 h-4 w-4 shrink-0 rounded border-slate-300 text-blue-600 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-900"
      />
      <label htmlFor={id} className="text-sm text-slate-600 dark:text-slate-300">
        J’accepte{" "}
        {links.map(link => (
          <span key={link.href}>
            {link.before}
            <Link href={link.href} target="_blank" rel="noopener" className="font-semibold text-blue-700 underline dark:text-blue-300">{link.label}</Link>
          </span>
        ))}
        {" "}d’AccessQ.
      </label>
    </div>
  );
}
