import Link from "next/link";

export default function Home() {
  return (
    <main className="min-h-screen bg-white text-slate-900 dark:bg-slate-950 dark:text-white">
      <header className="border-b border-slate-200 bg-white/90 dark:border-slate-800 dark:bg-slate-950/90">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5">
          <Link href="/" className="flex items-center gap-3">
            <img
              src="/logo/access_logo.png"
              alt="QR Access"
              className="h-9 w-auto"
            />
            <span className="text-lg font-bold tracking-tight">QR Access</span>
          </Link>
          <nav className="flex items-center gap-3">
            <Link
              href="/login"
              className="rounded-lg px-4 py-2 text-sm font-semibold text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-900 dark:hover:text-white"
            >
              Connexion
            </Link>
            <Link
              href="/register"
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-blue-700"
            >
              Créer un compte
            </Link>
          </nav>
        </div>
      </header>

      <section className="mx-auto grid min-h-[calc(100vh-4rem)] max-w-6xl items-center gap-10 px-5 py-12 lg:grid-cols-[1.05fr_0.95fr]">
        <div className="space-y-8">
          <div className="space-y-4">
            <p className="text-sm font-semibold uppercase tracking-wide text-blue-600 dark:text-blue-400">
              Contrôle d'accès par QR code
            </p>
            <h1 className="max-w-3xl text-4xl font-bold tracking-tight text-slate-950 dark:text-white sm:text-5xl">
              QR Access
            </h1>
            <p className="max-w-2xl text-lg leading-8 text-slate-600 dark:text-slate-300">
              Créez des événements, attribuez des zones, générez des QR codes et
              contrôlez les entrées depuis le scanner intégré.
            </p>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row">
            <Link
              href="/login"
              className="inline-flex items-center justify-center rounded-lg bg-blue-600 px-6 py-3 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-blue-700"
            >
              Ouvrir le tableau de bord
            </Link>
            <Link
              href="/scan"
              className="inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white px-6 py-3 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-200 dark:hover:bg-slate-900"
            >
              Accéder au scanner
            </Link>
          </div>

          <dl className="grid max-w-2xl grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900">
              <dt className="text-xs font-semibold uppercase text-slate-500 dark:text-slate-400">QR</dt>
              <dd className="mt-1 text-sm font-semibold text-slate-900 dark:text-white">Actifs, révoqués, expirés</dd>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900">
              <dt className="text-xs font-semibold uppercase text-slate-500 dark:text-slate-400">Agents</dt>
              <dd className="mt-1 text-sm font-semibold text-slate-900 dark:text-white">Comptes de scan contrôlés</dd>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900">
              <dt className="text-xs font-semibold uppercase text-slate-500 dark:text-slate-400">Exports</dt>
              <dd className="mt-1 text-sm font-semibold text-slate-900 dark:text-white">CSV et PDF des scans</dd>
            </div>
          </dl>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900 dark:shadow-black/20">
          <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-950">
            <div className="mb-5 flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-slate-900 dark:text-white">État opérationnel</p>
                <p className="text-xs text-slate-500 dark:text-slate-400">Vue synthétique des accès</p>
              </div>
              <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300">
                En service
              </span>
            </div>

            <div className="space-y-3">
              {[
                ["Validation QR", "Scanner web et mobile"],
                ["Zones", "Accréditations par lieu"],
                ["Journal", "Historique des scans"],
                ["Sessions", "Cookies HttpOnly et refresh token"]
              ].map(([label, value]) => (
                <div key={label} className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-800 dark:bg-slate-900">
                  <span className="text-sm font-medium text-slate-600 dark:text-slate-300">{label}</span>
                  <span className="text-sm font-semibold text-slate-900 dark:text-white">{value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
