import Link from "next/link";

function AccueilDeuxPanel() {
  return (
    <div className="w-full rounded-xl border border-slate-200 bg-slate-50 p-5 text-left shadow-sm dark:border-slate-800 dark:bg-slate-900 dark:shadow-black/20">
      <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-950">
        <div className="mb-5 flex items-center justify-between gap-4">
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
            <div key={label} className="flex items-center justify-between gap-4 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-800 dark:bg-slate-900">
              <span className="text-sm font-medium text-slate-600 dark:text-slate-300">{label}</span>
              <span className="text-right text-sm font-semibold text-slate-900 dark:text-white">{value}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col bg-white text-slate-900 dark:bg-slate-950 dark:text-white font-sans overflow-hidden">
      <header className="sticky top-0 z-50 w-full backdrop-blur-md bg-white/80 dark:bg-slate-950/80 border-b border-slate-200 dark:border-slate-800 shadow-sm transition-all duration-300">
        <div className="container mx-auto px-6 h-20 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3 group">
            <img
              src="/logo/access_logo.png"
              alt="QR Access"
              className="w-12 h-auto drop-shadow-md group-hover:scale-105 transition-transform duration-300"
            />
            <span className="font-bold text-xl tracking-tight bg-gradient-to-r from-blue-700 to-emerald-600 bg-clip-text text-transparent">
              QR Access
            </span>
          </Link>

          <nav className="flex items-center gap-6">
            <Link
              href="/login"
              className="text-sm font-semibold text-slate-600 dark:text-slate-300 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
            >
              Connexion
            </Link>
            <Link
              href="/register"
              className="text-sm font-semibold text-white dark:text-slate-900 bg-slate-900 dark:bg-slate-100 hover:bg-slate-800 dark:hover:bg-slate-200 px-5 py-2.5 rounded-full transition-all shadow-md hover:shadow-lg active:scale-95"
            >
              Créer un compte
            </Link>
          </nav>
        </div>
      </header>

      <main className="flex-1 relative flex flex-col items-center justify-center p-6 lg:p-16 text-center">
        <div className="relative z-10 max-w-4xl mx-auto space-y-8 mt-12 mb-20">
          <h1 className="text-5xl md:text-6xl lg:text-7xl font-extrabold tracking-tight text-slate-900 dark:text-white leading-[1.1]">
            Secure Access Management for your{" "}
            <span className="bg-gradient-to-r from-blue-600 via-emerald-500 to-emerald-400 bg-clip-text text-transparent relative inline-block">
              Organisation
            </span>
          </h1>

          <p className="max-w-2xl mx-auto text-lg md:text-xl text-slate-500 dark:text-slate-400 leading-relaxed">
            Effortlessly generate, manage, and verify secure QR codes. Let your administrators and agents monitor physical or digital access with total peace of mind.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
            <Link
              href="/register"
              className="w-full sm:w-auto px-8 py-4 bg-gradient-to-r from-blue-600 to-emerald-500 hover:from-blue-700 hover:to-emerald-600 text-white font-semibold rounded-full transition-all shadow-xl shadow-blue-500/25 hover:shadow-2xl hover:shadow-emerald-500/20 active:scale-95 text-lg"
            >
              Créer mon espace
            </Link>
            <Link
              href="/login"
              className="w-full sm:w-auto px-8 py-4 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 hover:border-slate-300 dark:hover:border-slate-600 font-semibold rounded-full transition-all active:scale-95 text-lg"
            >
              Se connecter
            </Link>
          </div>
        </div>

        <div className="relative z-10 w-full max-w-5xl mx-auto mt-12 mb-12 rounded-2xl border border-slate-200/50 dark:border-slate-800/50 bg-white dark:bg-slate-950 shadow-2xl shadow-blue-900/5 overflow-hidden p-2 lg:p-4">
          <div className="w-full min-h-[400px] md:min-h-[500px] lg:min-h-[560px] bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-100 dark:border-slate-800 flex items-center justify-center p-6 md:p-10">
            <AccueilDeuxPanel />
          </div>
        </div>
      </main>

      <section id="features" className="w-full py-24 bg-slate-50 dark:bg-slate-900 relative z-20 border-t border-slate-200/60 dark:border-slate-800/60 overflow-hidden">
        <div className="container mx-auto px-6 max-w-7xl relative z-10">
          <div className="text-center mb-16 relative">
            <h2 className="text-3xl md:text-5xl font-bold text-slate-900 dark:text-white mb-6 tracking-tight">
              Control your access with <span className="text-blue-900 dark:text-blue-400">ease</span>
            </h2>
            <p className="text-lg text-slate-600 dark:text-slate-300 max-w-3xl mx-auto leading-relaxed">
              Our access control and authentication platform relies on secure QR codes to offer a modern, reliable, and accessible solution. It allows organizations, businesses, and event organizers to effectively manage access to their services, premises, or activities, while significantly reducing the risks of fraud and intrusion.
            </p>
          </div>

          <div className="grid lg:grid-cols-3 gap-8 mt-12">
            <div className="bg-white dark:bg-slate-950 rounded-3xl p-8 border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 flex flex-col group">
              <div className="w-14 h-14 bg-blue-50 dark:bg-blue-950/50 group-hover:bg-blue-100 dark:group-hover:bg-blue-900 text-blue-600 dark:text-blue-300 rounded-2xl flex items-center justify-center mb-6 transition-colors shadow-sm">
                <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"></path></svg>
              </div>
              <h3 className="text-2xl font-bold text-slate-900 dark:text-white mb-4 group-hover:text-blue-700 dark:group-hover:text-blue-300 transition-colors">Smart Security</h3>
              <p className="text-slate-600 dark:text-slate-300 mb-5 leading-relaxed">Each access is generated as a unique QR code, allowing you to:</p>
              <ul className="space-y-3 mb-6 text-slate-600 dark:text-slate-300">
                <li className="flex items-start gap-3"><svg className="w-5 h-5 text-emerald-500 mt-1 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path></svg> <span>Create and manage personalized access</span></li>
                <li className="flex items-start gap-3"><svg className="w-5 h-5 text-emerald-500 mt-1 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path></svg> <span>Define validity dates</span></li>
                <li className="flex items-start gap-3"><svg className="w-5 h-5 text-emerald-500 mt-1 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path></svg> <span>Limit the number of allowed scans</span></li>
                <li className="flex items-start gap-3"><svg className="w-5 h-5 text-emerald-500 mt-1 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path></svg> <span>Configure specific usage timeframes</span></li>
                <li className="flex items-start gap-3"><svg className="w-5 h-5 text-emerald-500 mt-1 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path></svg> <span>Activate, deactivate, or revoke a QR code anytime</span></li>
              </ul>
            </div>

            <div className="bg-white dark:bg-slate-950 rounded-3xl p-8 border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 flex flex-col group relative">
              <div className="w-14 h-14 bg-emerald-50 dark:bg-emerald-950/50 group-hover:bg-emerald-100 dark:group-hover:bg-emerald-900 text-emerald-600 dark:text-emerald-300 rounded-2xl flex items-center justify-center mb-6 transition-colors shadow-sm">
                <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
              </div>
              <h3 className="text-2xl font-bold text-slate-900 dark:text-white mb-4 group-hover:text-emerald-700 dark:group-hover:text-emerald-300 transition-colors">Real-time Verification</h3>
              <p className="text-slate-600 dark:text-slate-300 mb-5 leading-relaxed">During access control, the QR code is scanned using a standard smartphone via a mobile or web application. The system instantly analyzes its validity and returns a clear response.</p>
              <p className="text-slate-800 dark:text-slate-100 font-semibold mb-3">Thus avoiding:</p>
              <ul className="space-y-3 mb-6 text-slate-600 dark:text-slate-300">
                <li className="flex items-start gap-3"><svg className="w-5 h-5 text-red-500 mt-1 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg> <span>Duplicates</span></li>
                <li className="flex items-start gap-3"><svg className="w-5 h-5 text-red-500 mt-1 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg> <span>The use of expired codes</span></li>
                <li className="flex items-start gap-3"><svg className="w-5 h-5 text-red-500 mt-1 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg> <span>Fraud attempts</span></li>
              </ul>
            </div>

            <div className="bg-white dark:bg-slate-950 rounded-3xl p-8 border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 flex flex-col group">
              <div className="w-14 h-14 bg-indigo-50 dark:bg-indigo-950/50 group-hover:bg-indigo-100 dark:group-hover:bg-indigo-900 text-indigo-600 dark:text-indigo-300 rounded-2xl flex items-center justify-center mb-6 transition-colors shadow-sm">
                <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"></path></svg>
              </div>
              <h3 className="text-2xl font-bold text-slate-900 dark:text-white mb-4 group-hover:text-indigo-700 dark:group-hover:text-indigo-300 transition-colors">A Solution Adapted to Your Reality</h3>
              <p className="text-slate-600 dark:text-slate-300 mb-5 leading-relaxed">Designed to meet the growing need for modern access control solutions, our platform is ideal for organizations that need traceable, quick, and secure access validation.</p>
              <div className="flex flex-wrap gap-2.5 mb-6">
                {["Event Organizers", "Businesses", "Educational Institutions", "NGOs", "Places of Worship", "Accommodation Facilities"].map((label) => (
                  <span key={label} className="px-3.5 py-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-200 rounded-full text-sm font-medium shadow-sm cursor-default">
                    {label}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <footer className="w-full border-t border-slate-200 dark:border-slate-800 py-8 bg-slate-50 dark:bg-slate-900 z-20">
        <div className="container mx-auto px-6 text-center text-sm text-slate-500 dark:text-slate-400">
          <p>&copy; 2026 QR Access. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
