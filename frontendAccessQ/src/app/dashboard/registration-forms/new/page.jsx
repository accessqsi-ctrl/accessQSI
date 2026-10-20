"use client";

import { useRouter } from "next/navigation";
import RegistrationFormEditor from "../../../components/RegistrationFormEditor";

export default function NewRegistrationFormPage() { const router = useRouter(); return <div className="aq-page space-y-6"><div className="aq-page-header"><div><h1 className="aq-page-title">Nouveau formulaire</h1><p className="aq-page-subtitle">Configurez les informations demandées et les offres gratuites.</p></div></div><RegistrationFormEditor onSaved={form => router.push(`/dashboard/registration-forms/${form.id}`)} /></div>; }
