import Link from "next/link";
import { COMPANY, LEGAL_LINKS, LEGAL_UPDATED_LABEL } from "../lib/legal";

// Mise en page commune des textes juridiques : sommaire, sections numérotées et liens entre les textes.
export default function LegalDocument({ title, intro, sections, current }) {
  return (
    <main className="min-h-screen bg-slate-50 px-4 py-10 text-slate-800 dark:bg-slate-950 dark:text-slate-200">
      <article className="mx-auto max-w-3xl rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-10 dark:border-slate-800 dark:bg-slate-900">
        <Link href="/" className="text-sm font-semibold text-blue-700 hover:underline dark:text-blue-300">← {COMPANY.brand}</Link>
        <h1 className="mt-6 text-3xl font-black tracking-tight text-slate-950 dark:text-slate-50">{title}</h1>
        <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">Dernière mise à jour : {LEGAL_UPDATED_LABEL}</p>
        {intro && <div className="mt-6 space-y-3 leading-7">{intro}</div>}

        <nav aria-label="Sommaire" className="mt-8 rounded-2xl bg-slate-50 p-5 dark:bg-slate-950/60">
          <p className="text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">Sommaire</p>
          <ol className="mt-3 space-y-1 text-sm">
            {sections.map((section, index) => (
              <li key={section.id}><a href={`#${section.id}`} className="text-blue-700 hover:underline dark:text-blue-300">{index + 1}. {section.title}</a></li>
            ))}
          </ol>
        </nav>

        {sections.map((section, index) => (
          <section key={section.id} id={section.id} className="mt-10 scroll-mt-6">
            <h2 className="text-xl font-bold text-slate-950 dark:text-slate-50">{index + 1}. {section.title}</h2>
            <div className="mt-3 space-y-3 leading-7 [&_li]:ml-5 [&_li]:list-disc [&_ul]:space-y-1">{section.body}</div>
          </section>
        ))}

        <footer className="mt-12 border-t border-slate-200 pt-6 text-sm dark:border-slate-800">
          <p className="text-slate-500 dark:text-slate-400">Voir aussi :</p>
          <ul className="mt-2 flex flex-wrap gap-x-5 gap-y-2">
            {LEGAL_LINKS.filter(link => link.href !== current).map(link => (
              <li key={link.href}><Link href={link.href} className="font-semibold text-blue-700 hover:underline dark:text-blue-300">{link.label}</Link></li>
            ))}
          </ul>
        </footer>
      </article>
    </main>
  );
}

// Encadré d'identité de l'éditeur, repris dans chaque texte.
export function CompanyIdentity() {
  return (
    <ul>
      <li>Éditeur : {COMPANY.legalName} ({COMPANY.legalForm}), exploitant la plateforme {COMPANY.brand}</li>
      <li>RCCM : {COMPANY.rccm} · Id. Nat. : {COMPANY.idNat} · N° impôt : {COMPANY.taxId}</li>
      <li>Siège : {COMPANY.address}</li>
      <li>Contact : <a className="text-blue-700 underline dark:text-blue-300" href={`mailto:${COMPANY.supportEmail}`}>{COMPANY.supportEmail}</a></li>
    </ul>
  );
}
