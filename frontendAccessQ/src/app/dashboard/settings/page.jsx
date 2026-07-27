"use client";

import { useState, useEffect, useRef } from "react";
import { Loader2, User, Building, Lock, Save, CheckCircle, AlertCircle } from "lucide-react";
import { apiFetch } from "../../lib/api";
import LoadingBar from "../../components/LoadingBar";

export default function SettingsPage() {
    const [user, setUser] = useState(null);
    const [organization, setOrganization] = useState(null);
    const [loading, setLoading] = useState(true);
    const [activeSection, setActiveSection] = useState("profile");
    const profileSectionRef = useRef(null);
    const orgSectionRef = useRef(null);

    // Profile form
    const [profileForm, setProfileForm] = useState({ fullName: "", email: "" });
    const [profileLoading, setProfileLoading] = useState(false);
    const [profileStatus, setProfileStatus] = useState({ type: "", message: "" });

    // Password form
    const [pwdForm, setPwdForm] = useState({ currentPassword: "", newPassword: "", confirmPassword: "" });
    const [pwdLoading, setPwdLoading] = useState(false);
    const [pwdStatus, setPwdStatus] = useState({ type: "", message: "" });

    // Org form
    const [orgForm, setOrgForm] = useState({ name: "" });
    const [orgLoading, setOrgLoading] = useState(false);
    const [orgStatus, setOrgStatus] = useState({ type: "", message: "" });

    // Delete Org state
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [deleteInput, setDeleteInput] = useState("");
    const [deleteLoading, setDeleteLoading] = useState(false);
    const [deleteStatus, setDeleteStatus] = useState("");
    const requiredDeleteText = "oui, je comprend les consequences de mon action et je valide la suppression";
    const isAdmin = user?.role === "ORG_ADMIN" || user?.role === "SUPER_ADMIN";
    const isAgent = user?.role === "ORG_AGENT";
    const isOperator = user?.role === "OPERATOR";

    const scrollToSection = (section) => {
        setActiveSection(section);
        const targetRef = section === "organization" ? orgSectionRef : profileSectionRef;
        targetRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    };

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        try {
            const userRes = await apiFetch("/user/profile");

            if (userRes.ok) {
                const userData = await userRes.json();
                if (userData.success && userData.user) {
                    const u = userData.user;
                    setUser(u);
                    setProfileForm({ fullName: u.full_name || "", email: u.email || "" });

                    if (u.role === "ORG_ADMIN" || u.role === "SUPER_ADMIN") {
                        const orgRes = await apiFetch("/user/org");
                        if (orgRes.ok) {
                            const orgData = await orgRes.json();
                            if (orgData.success && orgData.organization) {
                                const o = orgData.organization;
                                setOrganization(o);
                                setOrgForm({ name: o.name || "" });
                            }
                        }
                    }
                }
            }
        } catch (err) {
            console.error("Error fetching settings:", err);
        } finally {
            setLoading(false);
        }
    };

    const handleUpdateProfile = async (e) => {
        e.preventDefault();
        setProfileLoading(true);
        setProfileStatus({ type: "", message: "" });

        try {
            const res = await apiFetch("/user/profile", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    fullName: profileForm.fullName,
                    ...(!isAgent ? { email: profileForm.email } : {})
                })
            });
            const data = await res.json();
            if (data.success) {
                setProfileStatus({ type: "success", message: data.message });
            } else {
                setProfileStatus({ type: "error", message: data.message });
            }
        } catch (err) {
            setProfileStatus({ type: "error", message: "Erreur réseau." });
        } finally {
            setProfileLoading(false);
        }
    };

    const handleUpdatePassword = async (e) => {
        e.preventDefault();
        if (pwdForm.newPassword !== pwdForm.confirmPassword) {
            setPwdStatus({ type: "error", message: "Les mots de passe ne correspondent pas." });
            return;
        }

        setPwdLoading(true);
        setPwdStatus({ type: "", message: "" });

        try {
            const res = await apiFetch("/user/password", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    currentPassword: pwdForm.currentPassword,
                    newPassword: pwdForm.newPassword
                })
            });
            const data = await res.json();
            if (data.success) {
                setPwdStatus({ type: "success", message: data.message });
                setPwdForm({ currentPassword: "", newPassword: "", confirmPassword: "" });
            } else {
                setPwdStatus({ type: "error", message: data.message });
            }
        } catch (err) {
            setPwdStatus({ type: "error", message: "Erreur réseau." });
        } finally {
            setPwdLoading(false);
        }
    };

    const handleUpdateOrg = async (e) => {
        e.preventDefault();
        setOrgLoading(true);
        setOrgStatus({ type: "", message: "" });

        try {
            const res = await apiFetch("/user/org", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(orgForm)
            });
            const data = await res.json();
            if (data.success) {
                setOrgStatus({ type: "success", message: data.message });
            } else {
                setOrgStatus({ type: "error", message: data.message });
            }
        } catch (err) {
            setOrgStatus({ type: "error", message: "Erreur réseau." });
        } finally {
            setOrgLoading(false);
        }
    };

    const handleDeleteOrg = async () => {
        setDeleteLoading(true);
        setDeleteStatus("");
        try {
            const res = await apiFetch("/user/org", {
                method: "DELETE"
            });
            const data = await res.json();
            if (data.success) {
                // Redirect to login page upon success
                window.location.href = "/login";
            } else {
                setDeleteStatus(data.message || "Erreur lors de la suppression.");
                setDeleteLoading(false);
            }
        } catch (err) {
            setDeleteStatus("Erreur réseau.");
            setDeleteLoading(false);
        }
    };

    if (loading) {
        return (
            <div className="flex h-[80vh] items-center justify-center">
                <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
            </div>
        );
    }

    return (
        <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in duration-500 pb-12">
            {/* **************************************** */}
            {/* En-tête des paramètres */}
            {/* **************************************** */}
            <div>
                <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Paramètres</h1>
                <p className="text-slate-500 dark:text-slate-400 mt-1">
                    {isOperator ? "Modifiez le mot de passe de votre compte." : "Gérez vos informations personnelles et celles de votre organisation."}
                </p>
            </div>

            <div className={`grid grid-cols-1 gap-8 ${isOperator ? "max-w-2xl mx-auto" : "md:grid-cols-3"}`}>
                {/* **************************************** */}
                {/* Navigation entre les catégories */}
                {/* **************************************** */}
                <div className="space-y-1">
                    <button
                        type="button"
                        onClick={() => scrollToSection("profile")}
                        className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-xl font-medium text-sm border transition-colors ${
                            activeSection === "profile"
                                ? "bg-blue-50 text-blue-700 border-blue-100/50 dark:bg-blue-950/30 dark:text-blue-300 dark:border-blue-900/50"
                                : "text-slate-600 dark:text-slate-300 border-transparent hover:bg-slate-50 dark:hover:bg-slate-800"
                        }`}
                    >
                        {isOperator ? <Lock className="w-4 h-4" /> : <User className="w-4 h-4" />}
                        {isOperator ? "Sécurité" : "Profil & Sécurité"}
                    </button>
                    {isAdmin && (
                        <button
                            type="button"
                            onClick={() => scrollToSection("organization")}
                            className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-xl font-medium text-sm border transition-colors ${
                                activeSection === "organization"
                                    ? "bg-blue-50 text-blue-700 border-blue-100/50 dark:bg-blue-950/30 dark:text-blue-300 dark:border-blue-900/50"
                                    : "text-slate-600 dark:text-slate-300 border-transparent hover:bg-slate-50 dark:hover:bg-slate-800"
                            }`}
                        >
                            <Building className="w-4 h-4" /> Organisation
                        </button>
                    )}
                </div>

                {/* **************************************** */}
                {/* Formulaires de paramètres */}
                {/* **************************************** */}
                <div className={`${isOperator ? "" : "md:col-span-2"} space-y-8`}>
                    
                    {/* **************************************** */}
                    {/* Formulaire du profil utilisateur */}
                    {/* **************************************** */}
                    {!isOperator && <section ref={profileSectionRef} className="scroll-mt-24 bg-white dark:bg-slate-950 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
                        <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex items-center gap-4">
                            <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                                <User className="w-5 h-5" />
                            </div>
                            <h2 className="font-bold text-slate-900 dark:text-white">Informations Personnelles</h2>
                        </div>
                        <div className="p-6 space-y-6">
                            <form onSubmit={handleUpdateProfile} className="space-y-4">
                                {profileLoading && (
                                    <LoadingBar label="Mise à jour du profil" />
                                )}
                                {profileStatus.message && (
                                    <div className={`p-4 rounded-xl flex items-center gap-3 text-sm ${
                                        profileStatus.type === 'success' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'
                                    }`}>
                                        {profileStatus.type === 'success' ? <CheckCircle className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
                                        {profileStatus.message}
                                    </div>
                                )}
                                
                                <div className="grid grid-cols-1 gap-4">
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium text-slate-700 dark:text-slate-200">Nom Complet</label>
                                        <input
                                            type="text"
                                            value={profileForm.fullName}
                                            onChange={(e) => setProfileForm({...profileForm, fullName: e.target.value})}
                                            className="w-full px-4 py-2.5 border border-slate-200 dark:border-slate-800 rounded-xl bg-slate-50 dark:bg-slate-900 focus:bg-white dark:focus:bg-slate-950 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all sm:text-sm"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium text-slate-700 dark:text-slate-200">Adresse Email</label>
                                        <input
                                            type="email"
                                            value={profileForm.email}
                                            onChange={(e) => setProfileForm({...profileForm, email: e.target.value})}
                                            readOnly={isAgent}
                                            aria-readonly={isAgent}
                                            title={isAgent ? "L’adresse e-mail d’un agent est gérée par un administrateur." : undefined}
                                            className={`w-full px-4 py-2.5 border border-slate-200 dark:border-slate-800 rounded-xl transition-all sm:text-sm ${
                                                isAgent
                                                    ? "cursor-not-allowed bg-slate-100 text-slate-500 dark:bg-slate-900 dark:text-slate-400"
                                                    : "bg-slate-50 dark:bg-slate-900 focus:bg-white dark:focus:bg-slate-950 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                                            }`}
                                        />
                                        {isAgent && <p className="text-xs text-slate-500 dark:text-slate-400">Cette adresse est gérée par un administrateur.</p>}
                                    </div>
                                </div>
                                <button
                                    type="submit"
                                    disabled={profileLoading}
                                    className="inline-flex items-center gap-2 px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-xl shadow-sm transition-all active:scale-95 disabled:opacity-50 text-sm"
                                >
                                    {profileLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                                    Sauvegarder les modifications
                                </button>
                            </form>
                        </div>
                    </section>}

                    {/* **************************************** */}
                    {/* Formulaire de modification du mot de passe */}
                    {/* **************************************** */}
                    <section ref={isOperator ? profileSectionRef : null} className="scroll-mt-24 bg-white dark:bg-slate-950 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
                        <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex items-center gap-4">
                            <div className="w-10 h-10 rounded-xl bg-slate-50 dark:bg-slate-900 text-slate-600 dark:text-slate-300 flex items-center justify-center">
                                <Lock className="w-5 h-5" />
                            </div>
                            <h2 className="font-bold text-slate-900 dark:text-white">Mot de Passe</h2>
                        </div>
                        <div className="p-6 space-y-6">
                            <form onSubmit={handleUpdatePassword} className="space-y-4">
                                {pwdLoading && (
                                    <LoadingBar label="Changement du mot de passe" />
                                )}
                                {pwdStatus.message && (
                                    <div className={`p-4 rounded-xl flex items-center gap-3 text-sm ${
                                        pwdStatus.type === 'success' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'
                                    }`}>
                                        {pwdStatus.type === 'success' ? <CheckCircle className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
                                        {pwdStatus.message}
                                    </div>
                                )}
                                
                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-slate-700 dark:text-slate-200">Mot de passe actuel</label>
                                    <input
                                        type="password"
                                        value={pwdForm.currentPassword}
                                        onChange={(e) => setPwdForm({...pwdForm, currentPassword: e.target.value})}
                                        className="w-full px-4 py-2.5 border border-slate-200 dark:border-slate-800 rounded-xl bg-slate-50 dark:bg-slate-900 focus:bg-white dark:focus:bg-slate-950 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all sm:text-sm"
                                    />
                                </div>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium text-slate-700 dark:text-slate-200">Nouveau mot de passe</label>
                                        <input
                                            type="password"
                                            value={pwdForm.newPassword}
                                            onChange={(e) => setPwdForm({...pwdForm, newPassword: e.target.value})}
                                            className="w-full px-4 py-2.5 border border-slate-200 dark:border-slate-800 rounded-xl bg-slate-50 dark:bg-slate-900 focus:bg-white dark:focus:bg-slate-950 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all sm:text-sm"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium text-slate-700 dark:text-slate-200">Confirmer</label>
                                        <input
                                            type="password"
                                            value={pwdForm.confirmPassword}
                                            onChange={(e) => setPwdForm({...pwdForm, confirmPassword: e.target.value})}
                                            className="w-full px-4 py-2.5 border border-slate-200 dark:border-slate-800 rounded-xl bg-slate-50 dark:bg-slate-900 focus:bg-white dark:focus:bg-slate-950 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all sm:text-sm"
                                        />
                                    </div>
                                </div>
                                <button
                                    type="submit"
                                    disabled={pwdLoading}
                                    className="inline-flex items-center gap-2 px-6 py-2.5 bg-slate-900 text-white hover:bg-black dark:bg-[#BED3C3] dark:text-slate-900 dark:hover:bg-[#AEC5B3] font-medium rounded-xl shadow-sm transition-all active:scale-95 disabled:opacity-50 text-sm"
                                >
                                    {pwdLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Lock className="w-4 h-4" />}
                                    Changer le mot de passe
                                </button>
                            </form>
                        </div>
                    </section>

                    {/* **************************************** */}
                    {/* Formulaire des informations de l'organisation */}
                    {/* **************************************** */}
                    {isAdmin && (
                        <section ref={orgSectionRef} className="scroll-mt-24 bg-white dark:bg-slate-950 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden border-l-4 border-l-blue-500">
                            <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex items-center gap-4">
                                <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                                    <Building className="w-5 h-5" />
                                </div>
                                <h2 className="font-bold text-slate-900 dark:text-white">Organisation</h2>
                            </div>
                            <div className="p-6 space-y-6">
                                <form onSubmit={handleUpdateOrg} className="space-y-4">
                                    {orgLoading && (
                                        <LoadingBar label="Mise à jour de l'organisation" />
                                    )}
                                    {orgStatus.message && (
                                        <div className={`p-4 rounded-xl flex items-center gap-3 text-sm ${
                                            orgStatus.type === 'success' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'
                                        }`}>
                                            {orgStatus.type === 'success' ? <CheckCircle className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
                                            {orgStatus.message}
                                        </div>
                                    )}
                                    
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium text-slate-700 dark:text-slate-200">Nom de l'Organisation</label>
                                        <input
                                            type="text"
                                            value={orgForm.name}
                                            onChange={(e) => setOrgForm({ name: e.target.value })}
                                            className="w-full px-4 py-2.5 border border-slate-200 dark:border-slate-800 rounded-xl bg-slate-50 dark:bg-slate-900 focus:bg-white dark:focus:bg-slate-950 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all sm:text-sm"
                                        />
                                    </div>
                                    <button
                                        type="submit"
                                        disabled={orgLoading}
                                        className="inline-flex items-center gap-2 px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-xl shadow-sm transition-all active:scale-95 disabled:opacity-50 text-sm"
                                    >
                                        {orgLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                                        Mettre à jour l'organisation
                                    </button>
                                </form>
                            </div>
                        </section>
                    )}

                    {/* **************************************** */}
                    {/* Zone sensible : suppression de l'organisation */}
                    {/* **************************************** */}
                    {isAdmin && (
                        <section className="bg-red-50 rounded-3xl border border-red-200 shadow-sm overflow-hidden">
                            <div className="p-6 border-b border-red-200 flex items-center gap-4">
                                <div className="w-10 h-10 rounded-xl bg-red-100 text-red-600 flex items-center justify-center">
                                    <AlertCircle className="w-5 h-5" />
                                </div>
                                <h2 className="font-bold text-red-900">Suppression de l'organisation</h2>
                            </div>
                            <div className="p-6 space-y-4">
                                <p className="text-sm text-red-800">
                                    La suppression de votre organisation est irréversible depuis l'interface. 
                                    Cela désactivera immédiatement tous les comptes liés, y compris le vôtre.
                                </p>
                                <button
                                    onClick={() => {
                                        setDeleteStatus("");
                                        setShowDeleteModal(true);
                                    }}
                                    className="px-6 py-2.5 bg-red-600 hover:bg-red-700 text-white font-medium rounded-xl shadow-sm transition-all text-sm"
                                >
                                    Supprimer l'organisation
                                </button>
                            </div>
                        </section>
                    )}

                </div>
            </div>

            {/* **************************************** */}
            {/* Confirmation de suppression de l'organisation */}
            {/* **************************************** */}
            {showDeleteModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
                    <div className="bg-white dark:bg-slate-950 rounded-2xl max-w-md w-full shadow-2xl overflow-hidden animate-in zoom-in-95 text-slate-900 dark:text-slate-100">
                        <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex items-center gap-3">
                            <AlertCircle className="w-6 h-6 text-red-500" />
                            <h3 className="font-bold text-lg text-slate-900 dark:text-white">Confirmation de suppression</h3>
                        </div>
                        <div className="p-6 space-y-4">
                            {deleteLoading && (
                                <LoadingBar label="Suppression de l'organisation" />
                            )}
                            <p className="text-sm text-slate-600 dark:text-slate-300">
                                Êtes-vous absolument sûr ? Cette action va désactiver l'accès à tous les membres de <strong>{organization?.name}</strong>.
                            </p>
                            <div className="bg-red-50 dark:bg-red-950/30 text-red-800 dark:text-red-200 p-4 rounded-xl text-sm border border-red-100 dark:border-red-900/60">
                                Veuillez taper exactement la phrase suivante pour confirmer :<br/>
                                <strong className="select-all block mt-2 font-mono text-center">"{requiredDeleteText}"</strong>
                            </div>
                            <input
                                type="text"
                                value={deleteInput}
                                onChange={(e) => {
                                    setDeleteInput(e.target.value);
                                    setDeleteStatus("");
                                }}
                                placeholder="Tapez la phrase ici..."
                                className="w-full px-4 py-3 border border-slate-200 dark:border-slate-800 rounded-xl bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-100 placeholder:text-slate-500 dark:placeholder:text-slate-400 focus:bg-white dark:focus:bg-slate-950 focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500 transition-all text-sm"
                            />
                            {deleteStatus && (
                                <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                                    <AlertCircle className="h-4 w-4 shrink-0" />
                                    {deleteStatus}
                                </div>
                            )}
                        </div>
                        <div className="p-4 bg-slate-50 dark:bg-slate-900 border-t border-slate-100 dark:border-slate-800 flex justify-end gap-3">
                            <button
                                onClick={() => {
                                    setShowDeleteModal(false);
                                    setDeleteInput("");
                                    setDeleteStatus("");
                                }}
                                disabled={deleteLoading}
                                className="px-4 py-2 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 font-medium rounded-xl transition-all text-sm"
                            >
                                Annuler
                            </button>
                            <button
                                onClick={handleDeleteOrg}
                                disabled={deleteInput !== requiredDeleteText || deleteLoading}
                                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-medium rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 text-sm"
                            >
                                {deleteLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                                Confirmer la suppression
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
