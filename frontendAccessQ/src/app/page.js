import Link from "next/link";
import {
  BadgeCheck,
  Building2,
  CalendarDays,
  Check,
  FileCheck2,
  GraduationCap,
  HandHeart,
  Hotel,
  Landmark,
  ScanLine,
} from "lucide-react";

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
            <p className="text-sm font-semibold text-slate-900 dark:text-white">Centre de contrôle AccessQ</p>
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
    points: ["Billets personnalisés", "Contrôle à l'entrée", "Accès VIP ou zones réservées"],
    icon: CalendarDays,
    tone: "blue"
  },
  {
    title: "Entreprises et sites privés",
    audience: "Bureaux, entrepôts, chantiers, visiteurs",
    description: "Gérez les accès temporaires des employés, prestataires et visiteurs avec une traçabilité claire de chaque passage.",
    points: ["Badges journaliers", "Accès par niveau", "Révocation immédiate"],
    icon: Building2,
    tone: "indigo"
  },
  {
    title: "Écoles et formations",
    audience: "Campus, examens, séminaires, ateliers",
    description: "Sécurisez les présences, les accès aux salles et les inscriptions sans dépendre de listes papier difficiles à maintenir.",
    points: ["Présence vérifiable", "Salles autorisées", "Historique des scans"],
    icon: GraduationCap,
    tone: "emerald"
  },
  {
    title: "Églises et organisations",
    audience: "Cultes, retraites, conférences, programmes",
    description: "Organisez les flux d'entrée, les zones d'accueil et les accès spéciaux pour les équipes, invités et participants.",
    points: ["Accueil fluide", "Équipes identifiées", "Zones séparées"],
    icon: Landmark,
    tone: "amber"
  },
  {
    title: "Hôtels et hébergements",
    audience: "Résidences, locations, espaces partagés",
    description: "Remettez des accès numériques limités dans le temps pour les clients, les visiteurs et les services internes.",
    points: ["Validité par séjour", "Accès temporaires", "Contrôle discret"],
    icon: Hotel,
    tone: "cyan"
  },
  {
    title: "ONG et opérations terrain",
    audience: "Distributions, missions, centres d'aide",
    description: "Vérifiez les bénéficiaires, agents et zones d'intervention avec des QR codes simples à scanner même sur le terrain.",
    points: ["Bénéficiaires uniques", "Limites d'usage", "Rapports exportables"],
    icon: HandHeart,
    tone: "rose"
  }
];

const marketingStats = [
  {
    title: "Moins de fraude",
    description: "Codes uniques, révocables et limités",
    icon: BadgeCheck,
    tone: "bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-200"
  },
  {
    title: "Entrées plus rapides",
    description: "Scan mobile et décision instantanée",
    icon: ScanLine,
    tone: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-200"
  },
  {
    title: "Meilleure image",
    description: "Invitations PDF propres et personnalisables",
    icon: FileCheck2,
    tone: "bg-indigo-50 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-200"
  }
];

const pricingPlans = [
  {
    name: "Découverte",
    price: "Gratuit",
    description: "Pour tester un premier contrôle à petite échelle.",
    features: ["1 événement par mois", "50 QR par événement", "2 agents actifs", "2 zones actives", "Dashboard basique"],
    cta: "Créer mon compte",
    href: "/register"
  },
  {
    name: "Essential",
    price: "15 $",
    cadence: "/ mois",
    annual: "144 $ par an — économisez 20 %",
    description: "Pour les organisateurs et équipes aux besoins réguliers.",
    features: ["5 événements par mois", "200 QR par événement", "5 agents actifs", "6 zones actives", "Imports CSV et exports"],
    cta: "Essayer Essential gratuitement",
    href: "/register",
    featured: true
  },
  {
    name: "Pro",
    price: "25 $",
    cadence: "/ mois",
    annual: "240 $ par an — économisez 20 %",
    description: "Pour les opérations exigeantes et les volumes importants.",
    features: ["7 événements par mois", "500 QR par événement", "10 agents actifs", "15 zones actives", "Analytics et modèles personnalisés"],
    cta: "Créer mon compte",
    href: "/register"
  },
  {
    name: "Entreprise",
    price: "Sur devis",
    description: "Pour les grands comptes et les déploiements sur mesure.",
    features: ["Volumes personnalisés", "Support événementiel", "Personnalisation avancée", "Toutes les capacités Pro", "SLA sur mesure"],
    cta: "Nous contacter",
    href: "mailto:access.supportclient@gmail.com"
  }
];

const useCaseStyles = {
  blue: {
    accent: "bg-blue-500",
    icon: "bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-200",
    audience: "text-blue-700 dark:text-blue-300",
    hover: "hover:border-blue-300 dark:hover:border-blue-700"
  },
  indigo: {
    accent: "bg-indigo-500",
    icon: "bg-indigo-50 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-200",
    audience: "text-indigo-700 dark:text-indigo-300",
    hover: "hover:border-indigo-300 dark:hover:border-indigo-700"
  },
  emerald: {
    accent: "bg-emerald-500",
    icon: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-200",
    audience: "text-emerald-700 dark:text-emerald-300",
    hover: "hover:border-emerald-300 dark:hover:border-emerald-700"
  },
  amber: {
    accent: "bg-amber-500",
    icon: "bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-200",
    audience: "text-amber-700 dark:text-amber-300",
    hover: "hover:border-amber-300 dark:hover:border-amber-700"
  },
  cyan: {
    accent: "bg-cyan-500",
    icon: "bg-cyan-50 text-cyan-700 dark:bg-cyan-950/60 dark:text-cyan-200",
    audience: "text-cyan-700 dark:text-cyan-300",
    hover: "hover:border-cyan-300 dark:hover:border-cyan-700"
  },
  rose: {
    accent: "bg-rose-500",
    icon: "bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-200",
    audience: "text-rose-700 dark:text-rose-300",
    hover: "hover:border-rose-300 dark:hover:border-rose-700"
  }
};

function UseCaseCard({ useCase }) {
  const Icon = useCase.icon;
  const style = useCaseStyles[useCase.tone];

  return (
    <article className={`group relative flex h-full flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition-all duration-300 hover:-translate-y-1.5 hover:shadow-xl hover:shadow-slate-200/70 dark:border-slate-700 dark:bg-slate-950 dark:hover:shadow-slate-950/30 ${style.hover}`}>
      <span className={`absolute inset-x-0 top-0 h-1 ${style.accent}`} />
      <div className={`mb-5 flex h-12 w-12 items-center justify-center rounded-2xl shadow-sm transition-transform duration-300 group-hover:scale-105 ${style.icon}`}>
        <Icon className="h-6 w-6" strokeWidth={1.9} />
      </div>
      <p className={`text-xs font-bold uppercase tracking-[0.14em] ${style.audience}`}>{useCase.audience}</p>
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
  );
}

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col bg-white text-slate-900 dark:bg-slate-900 dark:text-white font-sans overflow-hidden">
      <header className="sticky top-0 z-50 w-full backdrop-blur-md bg-white/80 dark:bg-slate-900/85 border-b border-slate-200 dark:border-slate-700 shadow-sm transition-all duration-300">
        <div className="container mx-auto flex min-h-16 items-center justify-between gap-2 px-3 py-3 sm:h-20 sm:px-6 sm:py-0">
          <Link href="/" className="group flex shrink-0 items-center gap-2 sm:gap-3">
            <img
              src="/logo/access_logo.png"
              alt="AccessQ"
              className="h-auto w-9 drop-shadow-md transition-transform duration-300 group-hover:scale-105 sm:w-12"
            />
            <span className="bg-gradient-to-r from-blue-700 to-emerald-600 bg-clip-text text-base font-bold tracking-tight text-transparent sm:text-xl">
              AccessQ
            </span>
          </Link>

          <nav className="flex shrink-0 items-center gap-2 sm:gap-6">
            <a
              href="#pricing"
              className="hidden text-sm font-semibold text-slate-600 transition-colors hover:text-blue-600 dark:text-slate-300 dark:hover:text-blue-400 md:inline"
            >
              Tarifs
            </a>
            <a
              href="mailto:access.supportclient@gmail.com"
              className="hidden text-sm font-semibold text-slate-600 transition-colors hover:text-blue-600 dark:text-slate-300 dark:hover:text-blue-400 sm:inline"
            >
              Nous contacter
            </a>
            <Link
              href="/login"
              className="text-xs font-semibold text-slate-600 transition-colors hover:text-blue-600 dark:text-slate-300 dark:hover:text-blue-400 sm:text-sm"
            >
              Connexion
            </Link>
            <Link
              href="/register"
              className="rounded-full bg-slate-900 px-3 py-2 text-xs font-semibold text-white shadow-md transition-all hover:bg-slate-800 hover:shadow-lg active:scale-95 dark:bg-[#BED3C3] dark:text-slate-900 dark:hover:bg-[#AEC5B3] sm:px-5 sm:py-2.5 sm:text-sm"
            >
              <span className="sm:hidden">Inscription</span>
              <span className="hidden sm:inline">Essayer gratuitement</span>
            </Link>
          </nav>
        </div>
      </header>

      <main className="relative flex flex-1 flex-col items-center justify-center bg-gradient-to-b from-slate-50/80 via-white to-white p-6 text-center dark:from-slate-950 dark:via-slate-900 dark:to-slate-900 lg:p-16">
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="landing-grid absolute inset-x-0 top-0 h-[42rem] opacity-60 dark:opacity-20" />
          <div className="absolute -left-32 top-16 h-80 w-80 rounded-full bg-blue-300/20 blur-3xl dark:bg-blue-600/10" />
          <div className="absolute -right-28 top-72 h-96 w-96 rounded-full bg-emerald-300/20 blur-3xl dark:bg-emerald-600/10" />
        </div>

        <div className="relative z-10 mx-auto mt-12 mb-20 w-full max-w-6xl space-y-8">
          <div className="landing-rise inline-flex items-center gap-2 rounded-full border border-blue-200/80 bg-white/85 px-4 py-2 text-xs font-bold uppercase tracking-[0.16em] text-blue-800 shadow-sm backdrop-blur dark:border-blue-800 dark:bg-slate-900/80 dark:text-blue-200">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-50 motion-safe:animate-ping" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
            </span>
            Contrôle d&apos;accès nouvelle génération
          </div>

          <h1 className="landing-rise landing-rise-delay-1 mx-auto max-w-4xl text-4xl font-extrabold leading-[1.1] tracking-tight text-slate-900 dark:text-white md:text-4xl lg:text-5xl">
            Gérez vos accès avec sécurité et simplicité pour votre{" "}
            <span className="bg-gradient-to-r from-blue-600 via-emerald-500 to-emerald-400 bg-clip-text text-transparent relative inline-block">
              organisation ou événement
            </span>
          </h1>

          <p className="landing-rise landing-rise-delay-2 mx-auto max-w-2xl text-base font-medium leading-relaxed text-slate-700 dark:text-slate-300 md:text-lg">
            AccessQ est une solution simple et sécurisée qui permet de générer, gérer et vérifier des QR codes, de les attribuer aux personnes autorisées et de contrôler rapidement les accès physiques ou numériques. Grâce à une visibilité claire et fiable, les administrateurs et les agents assurent une gestion des accès efficace en toute simplicité.
          </p>

          <div className="landing-rise landing-rise-delay-3 mx-auto grid w-full max-w-5xl grid-cols-2 gap-3 text-left sm:gap-4 lg:grid-cols-3">
            <figure className="group col-span-2 overflow-hidden rounded-2xl border border-slate-200/70 bg-slate-100 shadow-xl shadow-slate-900/10 transition-all duration-500 hover:-translate-y-1 hover:shadow-2xl dark:border-slate-700 dark:bg-slate-800 sm:rounded-3xl lg:col-span-1">
              <img
                src="/accessq-billet-event.webp"
                alt="Billets de concert avec contrôle d’accès par QR code"
                width="1021"
                height="1253"
                fetchPriority="high"
                decoding="async"
                className="block aspect-[4/5] h-full w-full object-cover transition-transform duration-700 group-hover:scale-[1.025]"
              />
            </figure>

            <figure className="group overflow-hidden rounded-2xl border border-slate-200/70 bg-slate-100 shadow-xl shadow-slate-900/10 transition-all duration-500 hover:-translate-y-1 hover:shadow-2xl dark:border-slate-700 dark:bg-slate-800 sm:rounded-3xl">
              <img
                src="/accessq-bracelet.webp"
                alt="Bracelets d’accès munis d’un QR code"
                width="940"
                height="1254"
                decoding="async"
                className="block aspect-[4/5] h-full w-full object-cover transition-transform duration-700 group-hover:scale-[1.025]"
              />
            </figure>

            <figure className="group overflow-hidden rounded-2xl border border-slate-200/70 bg-slate-100 shadow-xl shadow-slate-900/10 transition-all duration-500 hover:-translate-y-1 hover:shadow-2xl dark:border-slate-700 dark:bg-slate-800 sm:rounded-3xl">
              <img
                src="/accessq-carte-access.webp"
                alt="Cartes professionnelles avec contrôle d’accès par QR code"
                width="1085"
                height="1450"
                decoding="async"
                className="block aspect-[4/5] h-full w-full object-cover transition-transform duration-700 group-hover:scale-[1.025]"
              />
            </figure>
          </div>

          <div className="landing-rise landing-rise-delay-4 flex flex-col justify-center gap-3 sm:flex-row">
            <Link
              href="/register"
              className="inline-flex items-center justify-center rounded-full bg-slate-900 px-6 py-3 text-sm font-bold text-white shadow-lg shadow-slate-900/15 transition-all hover:bg-slate-800 active:scale-95 dark:bg-[#BED3C3] dark:text-slate-950 dark:hover:bg-[#AEC5B3]"
            >
              Créer mon événement gratuitement
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

      <section id="use-cases" className="relative w-full overflow-hidden border-t border-slate-200 bg-gradient-to-b from-white via-slate-50/80 to-white py-24 dark:border-slate-700 dark:from-slate-900 dark:via-slate-950/70 dark:to-slate-900">
        <div aria-hidden="true" className="absolute -right-40 top-20 h-96 w-96 rounded-full bg-blue-200/20 blur-3xl dark:bg-blue-800/10" />
        <div className="container relative mx-auto max-w-7xl px-6">
          <div className="grid gap-10 lg:grid-cols-[0.9fr_1.1fr] lg:items-end">
            <div>
              <p className="mb-4 text-xs font-black uppercase tracking-[0.2em] text-blue-700 dark:text-blue-300">Une plateforme, plusieurs réalités</p>
              <h2 className="text-3xl font-black tracking-tight text-slate-950 dark:text-white md:text-5xl">
                Un même outil pour tous les accès qui doivent rester sous contrôle
              </h2>
              <p className="mt-5 text-lg leading-8 text-slate-600 dark:text-slate-300">
                AccessQ remplace les listes papier, les invitations faciles à copier et les contrôles improvisés par un système clair : un QR, une règle, une décision immédiate.
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              {marketingStats.map(({ title, description, icon: Icon, tone }) => (
                <div key={title} className="group rounded-2xl border border-slate-200 bg-white/90 p-5 shadow-sm backdrop-blur transition-all duration-300 hover:-translate-y-1 hover:shadow-lg dark:border-slate-700 dark:bg-slate-800/90">
                  <div className={`mb-4 flex h-10 w-10 items-center justify-center rounded-xl transition-transform duration-300 group-hover:scale-105 ${tone}`}>
                    <Icon className="h-5 w-5" strokeWidth={2} />
                  </div>
                  <p className="text-base font-black text-slate-950 dark:text-white">{title}</p>
                  <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">{description}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-10 grid grid-cols-2 gap-3 sm:gap-5 lg:grid-cols-3">
            <figure className="col-span-2 group relative overflow-hidden rounded-2xl bg-slate-100 shadow-lg shadow-slate-900/10 dark:bg-slate-800 sm:rounded-3xl lg:col-span-1">
              <img
                src="/accessq-conference.webp"
                alt="Conférence professionnelle organisée dans une grande salle"
                width="1086"
                height="1448"
                loading="lazy"
                decoding="async"
                className="block aspect-[4/5] w-full object-cover transition-transform duration-500 group-hover:scale-[1.02]"
              />
              <figcaption className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-slate-950/85 via-slate-950/45 to-transparent px-5 pb-4 pt-14 text-base font-bold text-white">
                Conférences
              </figcaption>
            </figure>

            <figure className="group relative overflow-hidden rounded-2xl bg-slate-100 shadow-lg shadow-slate-900/10 dark:bg-slate-800 sm:rounded-3xl">
              <img
                src="/accessq-concert.webp"
                alt="Public réuni lors d’un concert"
                width="736"
                height="920"
                loading="lazy"
                decoding="async"
                className="block aspect-[4/5] w-full object-cover transition-transform duration-500 group-hover:scale-[1.02]"
              />
              <figcaption className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-slate-950/85 via-slate-950/45 to-transparent px-4 pb-4 pt-12 text-sm font-bold text-white sm:px-5 sm:text-base">
                Concerts
              </figcaption>
            </figure>

            <figure className="group relative overflow-hidden rounded-2xl bg-slate-100 shadow-lg shadow-slate-900/10 dark:bg-slate-800 sm:rounded-3xl">
              <img
                src="/accessq-mariage.webp"
                alt="Salle de réception décorée pour un mariage"
                width="735"
                height="962"
                loading="lazy"
                decoding="async"
                className="block aspect-[4/5] w-full object-cover transition-transform duration-500 group-hover:scale-[1.02]"
              />
              <figcaption className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-slate-950/85 via-slate-950/45 to-transparent px-4 pb-4 pt-12 text-sm font-bold text-white sm:px-5 sm:text-base">
                Mariages
              </figcaption>
            </figure>
          </div>

          <div className="mt-14 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {useCases.slice(0, 2).map((useCase) => (
              <UseCaseCard key={useCase.title} useCase={useCase} />
            ))}

            <figure className="col-span-full overflow-hidden rounded-2xl bg-slate-800 shadow-lg shadow-slate-900/10 md:hidden">
              <img
                src="/accessq-mobile-showcase-2.webp"
                alt="Exemples de badge professionnel, carte cantine, ticket de taxi et bracelets avec QR code"
                width="1640"
                height="725"
                loading="lazy"
                decoding="async"
                className="block h-auto w-full"
              />
            </figure>

            <UseCaseCard useCase={useCases[2]} />

            <figure className="relative left-1/2 col-span-full my-3 hidden w-screen -translate-x-1/2 overflow-hidden bg-white dark:bg-slate-800 md:block">
              <img
                src="/accessq-banni-finale.png"
                alt="Exemples de badges, cartes, bracelets, coupons et billets personnalisés avec QR code"
                width="1738"
                height="429"
                loading="lazy"
                decoding="async"
                className="block h-auto w-full"
              />
            </figure>

            <UseCaseCard useCase={useCases[3]} />

            <figure className="col-span-full overflow-hidden rounded-2xl bg-slate-800 shadow-lg shadow-slate-900/10 md:hidden">
              <img
                src="/accessq-mobile-showcase-3.webp"
                alt="Exemples de carte cadeau, coupon, pass média et invitation de mariage avec QR code"
                width="1671"
                height="772"
                loading="lazy"
                decoding="async"
                className="block h-auto w-full"
              />
            </figure>

            {useCases.slice(4).map((useCase) => (
              <UseCaseCard key={useCase.title} useCase={useCase} />
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
              AccessQ s'appuie sur des QR codes sécurisés pour offrir une solution moderne, fiable et accessible. Les organisations, entreprises et équipes événementielles peuvent gérer leurs accès plus efficacement, tout en réduisant les risques de fraude et d'intrusion.
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

      <section id="pricing" className="relative w-full overflow-hidden border-t border-slate-200 bg-white py-24 dark:border-slate-700 dark:bg-slate-900">
        <div aria-hidden="true" className="absolute left-1/2 top-0 h-72 w-[42rem] -translate-x-1/2 rounded-full bg-blue-100/60 blur-3xl dark:bg-blue-900/15" />
        <div className="container relative mx-auto max-w-7xl px-6">
          <div className="mx-auto max-w-3xl text-center">
            <h2 className="text-3xl font-black tracking-tight text-slate-950 dark:text-white md:text-5xl">
              Commencez gratuitement, évoluez selon vos événements
            </h2>
            <p className="mt-5 text-lg leading-8 text-slate-600 dark:text-slate-300">
              Chaque nouvelle organisation bénéficie d&apos;un mois d&apos;Essential offert. À la fin de l&apos;essai, choisissez votre formule ou poursuivez avec le plan Découverte.
            </p>
          </div>

          <div className="mt-14 grid gap-5 md:grid-cols-2 xl:grid-cols-4">
            {pricingPlans.map((plan) => (
              <article
                key={plan.name}
                className={`relative flex h-full flex-col rounded-3xl border p-7 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-xl ${plan.featured
                  ? "border-blue-500 bg-slate-950 text-white shadow-blue-900/15 dark:border-emerald-400 dark:bg-slate-950"
                  : "border-slate-200 bg-white text-slate-950 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                }`}
              >
                {plan.featured && (
                  <span className="absolute -top-3 left-6 rounded-full bg-emerald-400 px-3 py-1 text-xs font-black uppercase tracking-wider text-slate-950">
                    1 mois offert
                  </span>
                )}
                <p className={`text-sm font-black uppercase tracking-[0.16em] ${plan.featured ? "text-blue-200" : "text-blue-700 dark:text-blue-300"}`}>{plan.name}</p>
                <div className="mt-4 flex min-h-12 items-end gap-2">
                  <span className="text-4xl font-black tracking-tight">{plan.price}</span>
                  {plan.cadence && <span className={`pb-1 text-sm ${plan.featured ? "text-slate-300" : "text-slate-500 dark:text-slate-400"}`}>{plan.cadence}</span>}
                </div>
                <p className={`mt-2 min-h-6 text-xs font-bold ${plan.featured ? "text-emerald-300" : "text-emerald-700 dark:text-emerald-300"}`}>
                  {plan.annual || "Tarification adaptée à votre besoin"}
                </p>
                <p className={`mt-5 text-sm leading-6 ${plan.featured ? "text-slate-300" : "text-slate-600 dark:text-slate-300"}`}>{plan.description}</p>
                <ul className="mt-6 flex-1 space-y-3">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-3 text-sm">
                      <Check className={`mt-0.5 h-4 w-4 shrink-0 ${plan.featured ? "text-emerald-400" : "text-emerald-600 dark:text-emerald-400"}`} strokeWidth={3} />
                      <span className={plan.featured ? "text-slate-200" : "text-slate-700 dark:text-slate-200"}>{feature}</span>
                    </li>
                  ))}
                </ul>
                {plan.href.startsWith("/") ? (
                  <Link href={plan.href} className={`mt-8 inline-flex min-h-11 items-center justify-center rounded-full px-5 py-3 text-center text-sm font-black transition-all active:scale-95 ${plan.featured ? "bg-emerald-400 text-slate-950 hover:bg-emerald-300" : "bg-slate-900 text-white hover:bg-slate-800 dark:bg-white dark:text-slate-950 dark:hover:bg-slate-100"}`}>
                    {plan.cta}
                  </Link>
                ) : (
                  <a href={plan.href} className="mt-8 inline-flex min-h-11 items-center justify-center rounded-full bg-slate-900 px-5 py-3 text-center text-sm font-black text-white transition-all hover:bg-slate-800 active:scale-95 dark:bg-white dark:text-slate-950 dark:hover:bg-slate-100">
                    {plan.cta}
                  </a>
                )}
              </article>
            ))}
          </div>

          <div className="mt-6 grid gap-5 rounded-3xl border border-amber-200 bg-amber-50 p-7 shadow-sm dark:border-amber-700/60 dark:bg-amber-950/25 md:grid-cols-[1fr_auto] md:items-center">
            <div>
              <div className="flex flex-wrap items-center gap-3">
                <p className="text-lg font-black text-slate-950 dark:text-white">Pass événement</p>
                <span className="rounded-full bg-amber-200 px-3 py-1 text-xs font-black uppercase tracking-wider text-amber-900 dark:bg-amber-800 dark:text-amber-100">Paiement unique</span>
              </div>
              <p className="mt-2 text-sm leading-6 text-slate-700 dark:text-slate-300">
                Un seul événement, jusqu&apos;à 200 QR et 30 jours de validité après attribution. Idéal si vous n&apos;avez pas besoin d&apos;un abonnement récurrent.
              </p>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <p className="whitespace-nowrap text-3xl font-black text-slate-950 dark:text-white">7 $</p>
              <Link href="/register" className="inline-flex min-h-11 items-center justify-center rounded-full bg-amber-500 px-5 py-3 text-center text-sm font-black text-slate-950 transition-all hover:bg-amber-400 active:scale-95">
                Commencer gratuitement
              </Link>
            </div>
          </div>

          <p className="mx-auto mt-6 max-w-3xl text-center text-xs leading-5 text-slate-500 dark:text-slate-400">
            Prix de référence en dollars américains. Le paiement Mobile Money peut être présenté dans la devise locale prise en charge par votre opérateur. L&apos;essai Essential est réservé aux nouvelles organisations et ne nécessite aucun paiement initial.
          </p>
        </div>
      </section>

      <footer className="w-full border-t border-slate-200 dark:border-slate-700 py-8 bg-slate-50 dark:bg-slate-800 z-20">
        <div className="container mx-auto flex flex-col items-center justify-center gap-2 px-6 text-center text-sm text-slate-500 dark:text-slate-400 sm:flex-row sm:gap-4">
          <p>&copy; 2026 Tinkli Software. Tous droits réservés.</p>
          <a
            href="mailto:access.supportclient@gmail.com"
            className="font-semibold text-blue-700 transition-colors hover:text-blue-600 hover:underline dark:text-blue-300 dark:hover:text-blue-200"
          >
            Nous contacter
          </a>
        </div>
      </footer>
    </div>
  );
}
