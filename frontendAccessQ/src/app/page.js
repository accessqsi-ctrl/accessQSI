import Link from "next/link";

function AccueilDeuxPanel() {
  const metrics = [
    ["Accès validés", "248", "+18 aujourd'hui"],
    ["Zones actives", "12", "4 sites ouverts"],
    ["Agents en ligne", "7", "scan en direct"]
  ];

  const activity = [
    ["QR-1842", "Entrée principale", "Validé", "text-emerald-700 dark:text-emerald-300"],
    ["QR-0931", "Salon VIP", "Déjà utilisé", "text-amber-700 dark:text-amber-300"],
    ["QR-7710", "Back office", "Refusé", "text-rose-700 dark:text-rose-300"]
  ];

  return (
    <div className="w-full text-left">
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl shadow-slate-200/60 dark:border-slate-700 dark:bg-slate-900 dark:shadow-slate-950/20">
        <div className="flex flex-col gap-4 border-b border-slate-200 bg-slate-50 px-5 py-4 dark:border-slate-700 dark:bg-slate-800 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-semibold text-slate-900 dark:text-white">Centre de contrôle QR Access</p>
            <p className="text-xs text-slate-500 dark:text-slate-400">Vue instantanée des accès et validations</p>
          </div>
          <div className="flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-700 dark:border-emerald-700/70 dark:bg-emerald-900/40 dark:text-emerald-200">
            <span className="h-2 w-2 rounded-full bg-emerald-500 shadow-[0_0_0_4px_rgba(16,185,129,0.16)]" />
            En service
          </div>
        </div>

        <div className="grid gap-5 p-5 lg:grid-cols-[1.05fr_0.95fr]">
          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-3">
              {metrics.map(([label, value, hint]) => (
                <div key={label} className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800">
                  <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">{label}</p>
                  <p className="mt-2 text-2xl font-black tracking-tight text-slate-950 dark:text-white">{value}</p>
                  <p className="mt-1 text-xs font-medium text-emerald-700 dark:text-emerald-200">{hint}</p>
                </div>
              ))}
            </div>

            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800">
              <div className="mb-4 flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-bold text-slate-900 dark:text-white">Activité récente</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Dernières décisions du contrôle</p>
                </div>
                <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-600 ring-1 ring-slate-200 dark:bg-slate-700 dark:text-slate-200 dark:ring-slate-600">
                  Direct
                </span>
              </div>

              <div className="space-y-2.5">
                {activity.map(([code, place, status, color]) => (
                  <div key={code} className="flex items-center justify-between gap-4 rounded-lg border border-slate-200 bg-white px-3 py-3 dark:border-slate-700 dark:bg-slate-900/70">
                    <div>
                      <p className="text-sm font-bold text-slate-900 dark:text-white">{code}</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">{place}</p>
                    </div>
                    <span className={`text-right text-xs font-bold ${color}`}>{status}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 dark:border-blue-700/60 dark:bg-blue-900/35">
                <p className="text-xs font-semibold uppercase text-blue-700 dark:text-blue-200">Validation QR</p>
                <p className="mt-2 text-sm font-semibold text-slate-900 dark:text-white">Scanner web et mobile</p>
              </div>
              
            </div>
          </div>

          <div className="flex flex-col justify-between rounded-xl border border-slate-200 bg-slate-900 p-5 text-white shadow-lg shadow-slate-900/20 dark:border-slate-700 dark:bg-slate-800">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-bold">Scan en cours</p>
                <p className="text-xs text-slate-300">Contrôle Entrée principale</p>
              </div>
              <span className="rounded-full bg-emerald-400/15 px-3 py-1 text-xs font-bold text-emerald-200 ring-1 ring-emerald-300/30">
                Autorisé
              </span>
            </div>

            <div className="my-8 flex items-center justify-center">
              <div className="grid h-40 w-40 grid-cols-5 grid-rows-5 gap-1 rounded-2xl bg-white p-4 shadow-2xl shadow-emerald-500/20">
                {Array.from({ length: 25 }).map((_, index) => (
                  <span
                    key={index}
                    className={`rounded-sm ${
                      [0, 1, 2, 5, 7, 10, 11, 12, 14, 18, 20, 22, 23, 24].includes(index)
                        ? "bg-slate-950"
                        : index % 4 === 0
                          ? "bg-emerald-500"
                          : "bg-slate-200"
                    }`}
                  />
                ))}
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between gap-4 rounded-lg bg-white/12 px-4 py-3 ring-1 ring-white/15">
                <span className="text-xs text-slate-200">Titulaire</span>
                <span className="text-sm font-bold">Invité validé</span>
              </div>
              <div className="flex items-center justify-between gap-4 rounded-lg bg-white/12 px-4 py-3 ring-1 ring-white/15">
                <span className="text-xs text-slate-200">Zone</span>
                <span className="text-sm font-bold">Hall A</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-white/15">
                <div className="h-full w-[78%] rounded-full bg-emerald-400" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

const useCases = [
  {
    title: "Événements et cérémonies",
    audience: "Mariages, conférences, concerts, galas",
    description: "Créez des invitations avec QR code, contrôlez chaque entrée et évitez les invitations dupliquées ou transférées sans autorisation.",
    points: ["Billets personnalisés", "Contrôle à l'entrée", "Accès VIP ou zones réservées"]
  },
  {
    title: "Entreprises et sites privés",
    audience: "Bureaux, entrepôts, chantiers, visiteurs",
    description: "Gérez les accès temporaires des employés, prestataires et visiteurs avec une traçabilité claire de chaque passage.",
    points: ["Badges journaliers", "Accès par niveau", "Révocation immédiate"]
  },
  {
    title: "Écoles et formations",
    audience: "Campus, examens, séminaires, ateliers",
    description: "Sécurisez les présences, les accès aux salles et les inscriptions sans dépendre de listes papier difficiles à maintenir.",
    points: ["Présence vérifiable", "Salles autorisées", "Historique des scans"]
  },
  {
    title: "Églises et organisations",
    audience: "Cultes, retraites, conférences, programmes",
    description: "Organisez les flux d'entrée, les zones d'accueil et les accès spéciaux pour les équipes, invités et participants.",
    points: ["Accueil fluide", "Équipes identifiées", "Zones séparées"]
  },
  {
    title: "Hôtels et hébergements",
    audience: "Résidences, locations, espaces partagés",
    description: "Remettez des accès numériques limités dans le temps pour les clients, les visiteurs et les services internes.",
    points: ["Validité par séjour", "Accès temporaires", "Contrôle discret"]
  },
  {
    title: "ONG et opérations terrain",
    audience: "Distributions, missions, centres d'aide",
    description: "Vérifiez les bénéficiaires, agents et zones d'intervention avec des QR codes simples à scanner même sur le terrain.",
    points: ["Bénéficiaires uniques", "Limites d'usage", "Rapports exportables"]
  }
];

const marketingStats = [
  ["Moins de fraude", "Codes uniques, révocables et limités"],
  ["Entrées plus rapides", "Scan mobile et décision instantanée"],
  ["Meilleure image", "Invitations PDF propres et personnalisables"]
];

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col bg-white text-slate-900 dark:bg-slate-900 dark:text-white font-sans overflow-hidden">
      <header className="sticky top-0 z-50 w-full backdrop-blur-md bg-white/80 dark:bg-slate-900/85 border-b border-slate-200 dark:border-slate-700 shadow-sm transition-all duration-300">
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
            <a
              href="mailto:access.qsi@gmail.com"
              className="hidden text-sm font-semibold text-slate-600 transition-colors hover:text-blue-600 dark:text-slate-300 dark:hover:text-blue-400 sm:inline"
            >
              Nous contacter
            </a>
            <Link
              href="/login"
              className="text-sm font-semibold text-slate-600 dark:text-slate-300 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
            >
              Connexion
            </Link>
            <Link
              href="/register"
              className="text-sm font-semibold text-white dark:text-slate-900 bg-slate-900 dark:bg-slate-100 hover:bg-slate-800 dark:hover:bg-white px-5 py-2.5 rounded-full transition-all shadow-md hover:shadow-lg active:scale-95"
            >
              Créer un compte
            </Link>
          </nav>
        </div>
      </header>

      <main className="flex-1 relative flex flex-col items-center justify-center p-6 lg:p-16 text-center">
        <div className="relative z-10 max-w-4xl mx-auto space-y-8 mt-12 mb-20">
          <h1 className="text-4xl md:text-4xl lg:text-5xl font-extrabold tracking-tight text-slate-900 dark:text-white leading-[1.1]">
            Gérez vos accès avec sécurité et simplicité pour votre{" "}
            <span className="bg-gradient-to-r from-blue-600 via-emerald-500 to-emerald-400 bg-clip-text text-transparent relative inline-block">
              organisation ou evenement 
            </span>
          </h1>

          <p className="max-w-2xl mx-auto text-base md:text-lg font-medium text-slate-700 dark:text-slate-300 leading-relaxed">
            AccesQSI est une solution simple et sécurisée qui permet de générer, gérer et vérifier des QR codes, de les attribuer aux personnes autorisées et de contrôler rapidement les accès physiques ou numériques. Grâce à une visibilité claire et fiable, les administrateurs et les agents assurent une gestion des accès efficace en toute simplicité.
          </p>

        

          <div className="flex flex-col justify-center gap-3 sm:flex-row">
            <Link
              href="/register"
              className="inline-flex items-center justify-center rounded-full bg-slate-900 px-6 py-3 text-sm font-bold text-white shadow-lg shadow-slate-900/15 transition-all hover:bg-slate-800 active:scale-95 dark:bg-white dark:text-slate-950 dark:hover:bg-slate-100"
            >
              Essayer QR Access
            </Link>
            <a
              href="#use-cases"
              className="inline-flex items-center justify-center rounded-full border border-slate-300 bg-white px-6 py-3 text-sm font-bold text-slate-700 transition-all hover:border-blue-300 hover:text-blue-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-blue-500 dark:hover:text-blue-200"
            >
              Voir les cas d'utilisation
            </a>
          </div>
        </div>

        <div className="relative z-10 w-full max-w-5xl mx-auto mt-12 mb-12 rounded-2xl border border-slate-200/50 dark:border-slate-700/70 bg-white dark:bg-slate-800 shadow-2xl shadow-blue-900/5 overflow-hidden p-2 lg:p-4">
          <div className="w-full min-h-[400px] md:min-h-[500px] lg:min-h-[560px] bg-slate-50 dark:bg-slate-800/80 rounded-xl border border-slate-100 dark:border-slate-700 flex items-center justify-center p-6 md:p-10">
            <AccueilDeuxPanel />
          </div>
        </div>
      </main>

      <section id="use-cases" className="w-full border-t border-slate-200 bg-white py-24 dark:border-slate-700 dark:bg-slate-900">
        <div className="container mx-auto max-w-7xl px-6">
          <div className="grid gap-10 lg:grid-cols-[0.9fr_1.1fr] lg:items-end">
            <div>
               <h2 className="text-3xl font-black tracking-tight text-slate-950 dark:text-white md:text-5xl">
                Un même outil pour tous les accès qui doivent rester sous contrôle
              </h2>
              <p className="mt-5 text-lg leading-8 text-slate-600 dark:text-slate-300">
                QR Access remplace les listes papier, les invitations faciles à copier et les contrôles improvisés par un système clair : un QR, une règle, une décision immédiate.
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              {marketingStats.map(([title, description]) => (
                <div key={title} className="rounded-2xl border border-slate-200 bg-slate-50 p-5 dark:border-slate-700 dark:bg-slate-800">
                  <p className="text-base font-black text-slate-950 dark:text-white">{title}</p>
                  <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">{description}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-14 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {useCases.map((useCase) => (
              <article key={useCase.title} className="flex h-full flex-col rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition-all hover:-translate-y-1 hover:border-blue-200 hover:shadow-xl hover:shadow-slate-200/70 dark:border-slate-700 dark:bg-slate-950 dark:hover:border-blue-700 dark:hover:shadow-slate-950/30">
                <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50 text-blue-700 dark:bg-blue-950/50 dark:text-blue-200">
                  <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-7 4h8m-9 4h10a2 2 0 002-2V7.5L14.5 3H7a2 2 0 00-2 2v13a2 2 0 002 2z" />
                  </svg>
                </div>
                <p className="text-xs font-bold uppercase tracking-[0.14em] text-emerald-700 dark:text-emerald-300">{useCase.audience}</p>
                <h3 className="mt-3 text-xl font-black text-slate-950 dark:text-white">{useCase.title}</h3>
                <p className="mt-3 flex-1 text-sm leading-7 text-slate-600 dark:text-slate-300">{useCase.description}</p>
                <div className="mt-6 flex flex-wrap gap-2">
                  {useCase.points.map((point) => (
                    <span key={point} className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-bold text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200">
                      {point}
                    </span>
                  ))}
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section id="features" className="w-full py-24 bg-slate-50 dark:bg-slate-800 relative z-20 border-t border-slate-200/60 dark:border-slate-700/70 overflow-hidden">
        <div className="container mx-auto px-6 max-w-7xl relative z-10">
          <div className="text-center mb-16 relative">
            <h2 className="text-3xl md:text-5xl font-bold text-slate-900 dark:text-white mb-6 tracking-tight">
              Contrôlez vos accès avec <span className="text-blue-900 dark:text-blue-400">fluidité</span>
            </h2>
            <p className="text-lg text-slate-600 dark:text-slate-300 max-w-3xl mx-auto leading-relaxed">
              QR Access s'appuie sur des QR codes sécurisés pour offrir une solution moderne, fiable et accessible. Les organisations, entreprises et équipes événementielles peuvent gérer leurs accès plus efficacement, tout en réduisant les risques de fraude et d'intrusion.
            </p>
          </div>

          <div className="grid lg:grid-cols-3 gap-8 mt-12">
            <div className="bg-white dark:bg-slate-900 rounded-3xl p-8 border border-slate-200 dark:border-slate-700 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 flex flex-col group">
              <div className="w-14 h-14 bg-blue-50 dark:bg-blue-900/45 group-hover:bg-blue-100 dark:group-hover:bg-blue-800 text-blue-600 dark:text-blue-200 rounded-2xl flex items-center justify-center mb-6 transition-colors shadow-sm">
                <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"></path></svg>
              </div>
              <h3 className="text-2xl font-bold text-slate-900 dark:text-white mb-4 group-hover:text-blue-700 dark:group-hover:text-blue-200 transition-colors">Sécurité intelligente</h3>
              <p className="text-slate-600 dark:text-slate-300 mb-5 leading-relaxed">Chaque accès est généré sous forme de QR code unique, ce qui vous permet de :</p>
              <ul className="space-y-3 mb-6 text-slate-600 dark:text-slate-300">
                <li className="flex items-start gap-3"><svg className="w-5 h-5 text-emerald-500 mt-1 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path></svg> <span>Créer et gérer des accès personnalisés</span></li>
                <li className="flex items-start gap-3"><svg className="w-5 h-5 text-emerald-500 mt-1 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path></svg> <span>Définir des dates de validité</span></li>
                <li className="flex items-start gap-3"><svg className="w-5 h-5 text-emerald-500 mt-1 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path></svg> <span>Limiter le nombre de scans autorisés</span></li>
                <li className="flex items-start gap-3"><svg className="w-5 h-5 text-emerald-500 mt-1 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path></svg> <span>Configurer des plages horaires d'utilisation</span></li>
                <li className="flex items-start gap-3"><svg className="w-5 h-5 text-emerald-500 mt-1 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path></svg> <span>Activer, désactiver ou révoquer un QR code à tout moment</span></li>
              </ul>
            </div>

            <div className="bg-white dark:bg-slate-900 rounded-3xl p-8 border border-slate-200 dark:border-slate-700 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 flex flex-col group relative">
              <div className="w-14 h-14 bg-emerald-50 dark:bg-emerald-900/45 group-hover:bg-emerald-100 dark:group-hover:bg-emerald-800 text-emerald-600 dark:text-emerald-200 rounded-2xl flex items-center justify-center mb-6 transition-colors shadow-sm">
                <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
              </div>
              <h3 className="text-2xl font-bold text-slate-900 dark:text-white mb-4 group-hover:text-emerald-700 dark:group-hover:text-emerald-200 transition-colors">Vérification en temps réel</h3>
              <p className="text-slate-600 dark:text-slate-300 mb-5 leading-relaxed">Lors du contrôle, le QR code est scanné depuis un smartphone via l'application web ou mobile. Le système analyse immédiatement sa validité et retourne une réponse claire.</p>
              <p className="text-slate-800 dark:text-slate-100 font-semibold mb-3">Cela permet d'éviter :</p>
              <ul className="space-y-3 mb-6 text-slate-600 dark:text-slate-300">
                <li className="flex items-start gap-3"><svg className="w-5 h-5 text-red-500 mt-1 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg> <span>Les doublons</span></li>
                <li className="flex items-start gap-3"><svg className="w-5 h-5 text-red-500 mt-1 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg> <span>L'utilisation de codes expirés</span></li>
                <li className="flex items-start gap-3"><svg className="w-5 h-5 text-red-500 mt-1 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg> <span>Les tentatives de fraude</span></li>
              </ul>
            </div>

            <div className="bg-white dark:bg-slate-900 rounded-3xl p-8 border border-slate-200 dark:border-slate-700 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 flex flex-col group">
              <div className="w-14 h-14 bg-indigo-50 dark:bg-indigo-900/45 group-hover:bg-indigo-100 dark:group-hover:bg-indigo-800 text-indigo-600 dark:text-indigo-200 rounded-2xl flex items-center justify-center mb-6 transition-colors shadow-sm">
                <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"></path></svg>
              </div>
              <h3 className="text-2xl font-bold text-slate-900 dark:text-white mb-4 group-hover:text-indigo-700 dark:group-hover:text-indigo-200 transition-colors">Une solution adaptée à votre réalité</h3>
              <p className="text-slate-600 dark:text-slate-300 mb-5 leading-relaxed">Pensée pour les besoins modernes de contrôle d'accès, la plateforme convient aux structures qui recherchent une validation rapide, traçable et sécurisée.</p>
              <div className="flex flex-wrap gap-2.5 mb-6">
                {["Événements", "Entreprises", "Établissements scolaires", "ONG", "Lieux de culte", "Sites d'hébergement"].map((label) => (
                  <span key={label} className="px-3.5 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 rounded-full text-sm font-medium shadow-sm cursor-default">
                    {label}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <footer className="w-full border-t border-slate-200 dark:border-slate-700 py-8 bg-slate-50 dark:bg-slate-800 z-20">
        <div className="container mx-auto flex flex-col items-center justify-center gap-2 px-6 text-center text-sm text-slate-500 dark:text-slate-400 sm:flex-row sm:gap-4">
          <p>&copy; 2026 Tinkli Software. Tous droits réservés.</p>
          <a
            href="mailto:access.qsi@gmail.com"
            className="font-semibold text-blue-700 transition-colors hover:text-blue-600 hover:underline dark:text-blue-300 dark:hover:text-blue-200"
          >
            Nous contacter
          </a>
        </div>
      </footer>
    </div>
  );
}
