import Image from "next/image";
import Link from "next/link";

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col bg-white dark:bg-slate-950 text-slate-900 dark:text-white font-sans overflow-hidden">
      {/* Navigation Bar */}
      <header className="sticky top-0 z-50 w-full backdrop-blur-md bg-white/80 dark:bg-slate-950/80 border-b border-slate-200 dark:border-slate-800 shadow-sm transition-all duration-300">
        <div className="container mx-auto px-6 h-20 flex items-center justify-between">
          {/* Logo Section */}
          <Link href="/" className="flex items-center gap-3 group">
            <img
              src="/logo/access_logo.png"
              alt="Logo"
              className="w-12 h-auto drop-shadow-md group-hover:scale-105 transition-transform duration-300"
            />
            <span className="font-bold text-xl tracking-tight bg-gradient-to-r from-blue-700 to-emerald-600 bg-clip-text text-transparent">
              QR Access
            </span>
          </Link>

          {/* Navigation Links */}
          <nav className="flex items-center gap-6">
            <Link
              href="/login"
              className="text-sm font-semibold text-slate-600 dark:text-slate-300 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
            >
              Log in
            </Link>
            <Link
              href="/register"
              className="text-sm font-semibold text-white dark:text-slate-900 bg-slate-900 dark:bg-slate-100 hover:bg-slate-800 dark:hover:bg-slate-200 px-5 py-2.5 rounded-full transition-all shadow-md hover:shadow-lg active:scale-95"
            >
              Sign up
            </Link>
          </nav>
        </div>
      </header>

      {/* Hero Section */}
      {/* Hero Section */}
      <main className="flex-1 relative flex flex-col items-center justify-center p-6 lg:p-16 text-center">
        {/* Decorative Background Gradients */}
        <div className="absolute top-[10%] left-[20%] w-[30%] h-[40%] rounded-full bg-blue-300/30 blur-[120px] pointer-events-none" />
        <div className="absolute top-[20%] right-[10%] w-[25%] h-[35%] rounded-full bg-yellow-300/20 blur-[120px] pointer-events-none" />
        <div className="absolute bottom-[20%] right-[20%] w-[30%] h-[40%] rounded-full bg-emerald-300/20 blur-[120px] pointer-events-none" />

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
              Get Started Free
            </Link>
            <a
              href="#features"
              className="w-full sm:w-auto px-8 py-4 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 hover:border-slate-300 dark:hover:border-slate-600 hover:border-b-yellow-400/50 font-semibold rounded-full transition-all active:scale-95 text-lg"
            >
              Learn More
            </a>
          </div>
        </div>

        {/* Dashboard Mockup / Image Preview (Optional visual flare) */}
        <div className="relative z-10 w-full max-w-5xl mx-auto mt-12 mb-12 rounded-2xl border border-slate-200/50 dark:border-slate-800/50 bg-white dark:bg-slate-950 shadow-2xl shadow-blue-900/5 overflow-hidden p-2 lg:p-4">
          <div className="w-full h-[400px] md:h-[500px] lg:h-[600px] bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-100 dark:border-slate-800 flex items-center justify-center flex-col gap-6 relative overflow-hidden">
            {/* Subtle ambient glow behind logo */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="w-64 h-64 bg-yellow-200/40 rounded-full blur-[80px]"></div>
            </div>
            <img
              src="/logo/access_logo.png"
              alt="Dashboard Placeholder"
              className="w-40 md:w-56 h-auto opacity-60 drop-shadow-xl relative z-10 transition-transform duration-700 hover:scale-105"
            />
            <p className="text-slate-400 dark:text-slate-500 font-medium tracking-wide uppercase text-sm relative z-10 bg-white/50 dark:bg-slate-950/50 px-4 py-1.5 rounded-full backdrop-blur-sm border border-slate-200/50 dark:border-slate-800/50">Dashboard Preview</p>
          </div>
        </div>
      </main>

      {/* Features Section */}
      <section id="features" className="w-full py-24 bg-slate-50 dark:bg-slate-900 relative z-20 border-t border-slate-200/60 dark:border-slate-800/60 overflow-hidden">
        {/* Decorative blob for features section */}
        <div className="absolute top-0 right-0 w-[40%] h-[50%] bg-blue-100/40 rounded-bl-full blur-[100px] pointer-events-none" />

        <div className="container mx-auto px-6 max-w-7xl relative z-10">
          <div className="text-center mb-16 relative">
            {/* Subtle Yellow accent shape */}
            <div className="absolute -top-6 left-1/2 -translate-x-1/2 w-24 h-24 bg-yellow-300/20 rounded-full blur-2xl pointer-events-none -z-10"></div>
            <h2 className="text-3xl md:text-5xl font-bold text-slate-900 dark:text-white mb-6 tracking-tight">
              Control your access with <span className="text-blue-900">ease</span>
            </h2>
            <p className="text-lg text-slate-600 dark:text-slate-300 max-w-3xl mx-auto leading-relaxed">
              Our access control and authentication platform relies on secure QR codes to offer a modern, reliable, and accessible solution. It allows organizations, businesses, and event organizers to effectively manage access to their services, premises, or activities, while significantly reducing the risks of fraud and intrusion.
            </p>
          </div>

          <div className="grid lg:grid-cols-3 gap-8 mt-12">
            {/* Feature 1 */}
            <div className="bg-white dark:bg-slate-950 rounded-3xl p-8 border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 flex flex-col group">
              <div className="w-14 h-14 bg-blue-50 group-hover:bg-blue-100 text-blue-600 rounded-2xl flex items-center justify-center mb-6 transition-colors shadow-sm shadow-blue-100 italic">
                <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"></path></svg>
              </div>
              <h3 className="text-2xl font-bold text-slate-900 dark:text-white mb-4 group-hover:text-blue-700 transition-colors">Smart Security</h3>
              <p className="text-slate-600 dark:text-slate-300 mb-5 leading-relaxed">Each access is generated as a unique QR code, allowing you to:</p>
              <ul className="space-y-3 mb-6 text-slate-600 dark:text-slate-300">
                <li className="flex items-start gap-3"><svg className="w-5 h-5 text-emerald-500 mt-1 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path></svg> <span>Create and manage personalized access</span></li>
                <li className="flex items-start gap-3"><svg className="w-5 h-5 text-emerald-500 mt-1 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path></svg> <span>Define validity dates</span></li>
                <li className="flex items-start gap-3"><svg className="w-5 h-5 text-emerald-500 mt-1 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path></svg> <span>Limit the number of allowed scans</span></li>
                <li className="flex items-start gap-3"><svg className="w-5 h-5 text-emerald-500 mt-1 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path></svg> <span>Configure specific usage timeframes</span></li>
                <li className="flex items-start gap-3"><svg className="w-5 h-5 text-emerald-500 mt-1 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path></svg> <span>Activate, deactivate, or revoke a QR code anytime</span></li>
              </ul>
              <div className="mt-auto pt-5 border-t border-slate-100 dark:border-slate-800">
                <p className="text-sm text-slate-500 dark:text-slate-400 font-medium p-2 rounded-lg  ">All accesses are automatically logged to ensure complete and secure traceability.</p>
              </div>
            </div>

            {/* Feature 2 */}
            <div className="bg-white dark:bg-slate-950 rounded-3xl p-8 border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 flex flex-col group relative">
              {/* Subtle Yellow accent line for middle card */}
              <div className="absolute top-0 left-1/2 -translate-x-1/2 w-1/3 h-1 bg-gradient-to-r from-transparent via-yellow-400 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-t-3xl"></div>

              <div className="w-14 h-14 bg-emerald-50 group-hover:bg-emerald-100 text-emerald-600 rounded-2xl flex items-center justify-center mb-6 transition-colors shadow-sm shadow-emerald-100">
                <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
              </div>
              <h3 className="text-2xl font-bold text-slate-900 dark:text-white mb-4 group-hover:text-emerald-700 transition-colors">Real-time Verification</h3>
              <p className="text-slate-600 dark:text-slate-300 mb-5 leading-relaxed">During access control, the QR code is scanned using a standard smartphone via a mobile or web application. The system instantly analyzes its validity and returns a clear response.</p>
              <p className="text-slate-800 dark:text-slate-100 font-semibold mb-3">Thus avoiding:</p>
              <ul className="space-y-3 mb-6 text-slate-600 dark:text-slate-300">
                <li className="flex items-start gap-3"><svg className="w-5 h-5 text-red-500 mt-1 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg> <span>Duplicates</span></li>
                <li className="flex items-start gap-3"><svg className="w-5 h-5 text-red-500 mt-1 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg> <span>The use of expired codes</span></li>
                <li className="flex items-start gap-3"><svg className="w-5 h-5 text-red-500 mt-1 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg> <span>Fraud attempts</span></li>
              </ul>
              <div className="mt-auto pt-5 border-t border-slate-100 dark:border-slate-800">
                <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">Guaranteeing a smooth, fast, and secure experience for all users.</p>
              </div>
            </div>

            {/* Feature 3 */}
            <div className="bg-white dark:bg-slate-950 rounded-3xl p-8 border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 flex flex-col group">
              <div className="w-14 h-14 bg-indigo-50 group-hover:bg-indigo-100 text-indigo-600 rounded-2xl flex items-center justify-center mb-6 transition-colors shadow-sm shadow-indigo-100">
                <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"></path></svg>
              </div>
              <h3 className="text-2xl font-bold text-slate-900 dark:text-white mb-4 group-hover:text-indigo-700 transition-colors">A Solution Adapted to Your Reality</h3>
              <p className="text-slate-600 dark:text-slate-300 mb-5 leading-relaxed">Designed to meet the growing need for modern access control solutions, our platform is ideal for:</p>
              <div className="flex flex-wrap gap-2.5 mb-6">
                <span className="px-3.5 py-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-200 rounded-full text-sm font-medium shadow-sm hover:border-yellow-300 hover:bg-yellow-50 focus:bg-yellow-50 transition-colors cursor-default">Event Organizers</span>
                <span className="px-3.5 py-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-200 rounded-full text-sm font-medium shadow-sm hover:border-blue-300 hover:bg-blue-50 transition-colors cursor-default">Businesses</span>
                <span className="px-3.5 py-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-200 rounded-full text-sm font-medium shadow-sm hover:border-emerald-300 hover:bg-emerald-50 transition-colors cursor-default">Educational Institutions</span>
                <span className="px-3.5 py-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-200 rounded-full text-sm font-medium shadow-sm hover:border-indigo-300 hover:bg-indigo-50 transition-colors cursor-default">NGOs</span>
                <span className="px-3.5 py-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-200 rounded-full text-sm font-medium shadow-sm hover:border-purple-300 hover:bg-purple-50 transition-colors cursor-default">Places of Worship</span>
                <span className="px-3.5 py-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-200 rounded-full text-sm font-medium shadow-sm hover:border-orange-300 hover:bg-orange-50 transition-colors cursor-default">Accommodation Facilities</span>
              </div>
              <div className="mt-auto pt-5 border-t border-slate-100 dark:border-slate-800">
                <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">Operating with standard equipment and without complex infrastructure, it stands as a simple, affordable, and highly effective alternative to traditional, costly systems.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Simple Footer */}
      <footer className="w-full border-t border-slate-200 dark:border-slate-800 py-8 bg-slate-50 dark:bg-slate-900 z-20">
        <div className="container mx-auto px-6 text-center text-sm text-slate-500 dark:text-slate-400">
          <p>&copy; 2026 QR Access. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
