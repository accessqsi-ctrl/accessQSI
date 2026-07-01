"use client";

import { useState, useEffect } from "react";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { apiFetch } from "../../lib/api";
import LoadingBar from "../../components/LoadingBar";

export default function AgentsPage() {
    const [agents, setAgents] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    // Filters
    const [searchQuery, setSearchQuery] = useState("");
    const [roleFilter, setRoleFilter] = useState("Tous les rôles");
    const [statusFilter, setStatusFilter] = useState("Tous les statuts");

    // Modal state for adding a new agent
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [addForm, setAddForm] = useState({ fullName: "", email: "", password: "", confirmPassword: "", role: "ORG_AGENT" });
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);
    const [adding, setAdding] = useState(false);
    const [addError, setAddError] = useState("");
    const [addSuccess, setAddSuccess] = useState("");
    const [actionMessage, setActionMessage] = useState("");

    const [togglingId, setTogglingId] = useState(null);
    const [confirmAction, setConfirmAction] = useState(null);

    const showActionMessage = (message) => {
        setActionMessage(message);
        setTimeout(() => setActionMessage(""), 4000);
    };

    useEffect(() => {
        fetchAgents();
    }, []);

    const fetchAgents = async () => {
        try {
            const res = await apiFetch("/agents");
            const data = await res.json();
            if (data.success) {
                setAgents(data.agents);
            } else {
                setError(data.message || "Erreur lors du chargement des agents.");
            }
        } catch (err) {
            setError("Erreur de connexion au serveur.");
        } finally {
            setLoading(false);
        }
    };

    const handleAddAgent = async (e) => {
        e.preventDefault();
        setAddError("");
        setAddSuccess("");

        if (addForm.password !== addForm.confirmPassword) {
            setAddError("Les mots de passe ne correspondent pas.");
            return;
        }

        setAdding(true);

        try {
            const payload = {
                fullName: addForm.fullName,
                email: addForm.email,
                password: addForm.password,
                role: addForm.role
            };
            const res = await apiFetch("/agents/add-agent", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload)
            });
            const data = await res.json();

            if (data.success) {
                setAddSuccess(data.message);
                setAddForm({ fullName: "", email: "", password: "", confirmPassword: "", role: "ORG_AGENT" });
                setShowPassword(false);
                setShowConfirmPassword(false);
                fetchAgents();
                setTimeout(() => {
                    setIsAddModalOpen(false);
                    setAddSuccess("");
                }, 2000);
            } else {
                setAddError(data.message || "Erreur lors de l'ajout.");
            }
        } catch (err) {
            setAddError("Erreur de connexion serveur.");
        } finally {
            setAdding(false);
        }
    };

    const openAgentConfirm = (type, agent) => {
        setActionMessage("");
        setConfirmAction({ type, agent });
    };

    const closeAgentConfirm = () => {
        if (togglingId) return;
        setConfirmAction(null);
    };

    const handleToggleStatus = async (agentId) => {
        setActionMessage("");
        setTogglingId(agentId);
        try {
            const res = await apiFetch(`/agents/${agentId}/toggle`, {
                method: "PUT"
            });
            const data = await res.json();
            if (data.success) {
                setAgents(agents.map(a => a.id === agentId ? { ...a, status: data.newStatus } : a));
                setConfirmAction(null);
            } else {
                showActionMessage(data.message || "Erreur avec cet agent.");
            }
        } catch (err) {
            showActionMessage("Erreur serveur.");
        } finally {
            setTogglingId(null);
        }
    };

    const handleDeleteAgent = async (agentId) => {
        setActionMessage("");
        setTogglingId(agentId);
        try {
            const res = await apiFetch(`/agents/${agentId}`, {
                method: "DELETE"
            });
            const data = await res.json();
            if (data.success) {
                setAgents(agents.filter(a => a.id !== agentId));
                setConfirmAction(null);
            } else {
                showActionMessage(data.message || "Erreur lors de la suppression.");
            }
        } catch (err) {
            showActionMessage("Erreur réseau lors de la suppression.");
        } finally {
            setTogglingId(null);
        }
    };

    const filteredAgents = agents.filter(agent => {
        const matchesSearch = !searchQuery || 
            agent.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
            agent.email.toLowerCase().includes(searchQuery.toLowerCase());
        
        const matchesRole = roleFilter === "Tous les rôles" || agent.role.toLowerCase() === roleFilter.toLowerCase();
        const matchesStatus = statusFilter === "Tous les statuts" || agent.status.toLowerCase() === statusFilter.toLowerCase();
        
        return matchesSearch && matchesRole && matchesStatus;
    });

    const activeAgentsCount = agents.filter(a => a.status === 'Actif').length;
    const inactiveAgentsCount = agents.length - activeAgentsCount;
    const confirmAgent = confirmAction?.agent;
    const confirmAgentIsActive = confirmAgent?.status === "Actif";
    const confirmAgentTitle = confirmAction?.type === "delete"
        ? "Supprimer cet agent ?"
        : confirmAgentIsActive
            ? "Révoquer l'accès de cet agent ?"
            : "Restaurer l'accès de cet agent ?";
    const confirmAgentMessage = confirmAction?.type === "delete"
        ? "Cette action supprimera définitivement le compte agent et ne pourra pas être annulée depuis l'interface."
        : confirmAgentIsActive
            ? "L'agent ne pourra plus accéder au tableau de bord ni scanner les QR codes."
            : "L'agent pourra de nouveau se connecter et utiliser les accès autorisés par son rôle.";
    const confirmAgentButton = confirmAction?.type === "delete"
        ? "Supprimer l'agent"
        : confirmAgentIsActive
            ? "Révoquer l'accès"
            : "Restaurer l'accès";

    if (loading) {
        return (
            <div className="flex h-[80vh] items-center justify-center">
                <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
            </div>
        );
    }

    return (
        <div className="max-w-7xl mx-auto space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Agents et équipe</h1>
                    <p className="text-slate-500 dark:text-slate-400 mt-1">Gérez les membres autorisés à scanner les codes QR.</p>
                </div>
                <button
                    onClick={() => setIsAddModalOpen(true)}
                    className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-xl shadow-sm hover:shadow active:scale-95 transition-all text-sm"
                >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z"></path></svg>
                    Ajouter un agent
                </button>
            </div>

            <div className="bg-white dark:bg-slate-950 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm dark:shadow-black/20 flex flex-col md:flex-row items-center gap-8">
                <div className="flex-1 flex items-center gap-4 w-full">
                    <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center">
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"></path></svg>
                    </div>
                    <div>
                        <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Accès agents</p>
                        <p className="text-xl font-bold text-slate-900 dark:text-white">{activeAgentsCount} actifs <span className="text-sm font-normal text-slate-500 dark:text-slate-400">sur {agents.length} comptes</span></p>
                    </div>
                </div>
                <div className="grid grid-cols-2 gap-3 w-full md:w-auto">
                    <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-300">
                        <p className="text-xs font-semibold uppercase">Actifs</p>
                        <p className="text-xl font-bold">{activeAgentsCount}</p>
                    </div>
                    <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-700 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300">
                        <p className="text-xs font-semibold uppercase">Inactifs</p>
                        <p className="text-xl font-bold">{inactiveAgentsCount}</p>
                    </div>
                </div>
            </div>

            {error && <div className="p-4 bg-red-50 text-red-600 rounded-xl">{error}</div>}
            {actionMessage && <div className="p-4 bg-red-50 text-red-600 rounded-xl">{actionMessage}</div>}

            <div className="bg-white dark:bg-slate-950 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col md:flex-row gap-4 items-center justify-between">
                <div className="relative w-full md:w-96">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <svg className="h-5 w-5 text-slate-400 dark:text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                        </svg>
                    </div>
                    <input
                        type="text"
                        placeholder="Rechercher par nom ou email..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="block w-full pl-10 pr-3 py-2 border border-slate-200 dark:border-slate-800 rounded-xl leading-5 bg-slate-50 dark:bg-slate-900 placeholder-slate-400 focus:outline-none focus:bg-white dark:focus:bg-slate-950 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 sm:text-sm transition-colors"
                    />
                </div>

                <div className="flex gap-2 w-full md:w-auto overflow-x-auto pb-1 md:pb-0">
                    <select value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)} className="px-3 py-2 border border-slate-200 dark:border-slate-800 rounded-xl bg-white dark:bg-slate-950 text-sm text-slate-700 dark:text-slate-200 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500">
                        <option>Tous les rôles</option>
                        <option>Admin</option>
                        <option>Agent</option>
                        <option>Opérateur</option>
                    </select>
                    <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="px-3 py-2 border border-slate-200 dark:border-slate-800 rounded-xl bg-white dark:bg-slate-950 text-sm text-slate-700 dark:text-slate-200 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500">
                        <option>Tous les statuts</option>
                        <option>Actif</option>
                        <option>Inactif</option>
                    </select>
                </div>
            </div>

            <div className="bg-white dark:bg-slate-950 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse min-w-[800px]">
                        <thead>
                            <tr className="bg-slate-50 dark:bg-slate-900 text-slate-600 dark:text-slate-300 text-sm border-b border-slate-200 dark:border-slate-800">
                                <th className="px-6 py-4 font-semibold uppercase tracking-wider">Détails Agent</th>
                                <th className="px-6 py-4 font-semibold uppercase tracking-wider">Rôle</th>
                                <th className="px-6 py-4 font-semibold uppercase tracking-wider">Statut</th>
                                <th className="px-6 py-4 font-semibold uppercase tracking-wider">Total Scans</th>
                                <th className="px-6 py-4 font-semibold uppercase tracking-wider">Dernière Connexion</th>
                                <th className="px-6 py-4 font-semibold uppercase tracking-wider text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-700 dark:text-slate-200 text-sm">
                            {filteredAgents.length === 0 ? (
                                <tr>
                                    <td colSpan="6" className="px-6 py-12 text-center text-slate-500 dark:text-slate-400">Aucun agent trouvé.</td>
                                </tr>
                            ) : (
                                filteredAgents.map((agent) => {
                                    const isAdmin = agent.role === 'Admin';
                                    const isOperator = agent.role === 'Opérateur';
                                    const spanClass = isAdmin ? "px-2.5 py-1 rounded-lg text-xs font-semibold border bg-purple-50 text-purple-700 border-purple-200" : isOperator ? "px-2.5 py-1 rounded-lg text-xs font-semibold border bg-amber-50 text-amber-700 border-amber-200" : "px-2.5 py-1 rounded-lg text-xs font-semibold border bg-slate-50 dark:bg-slate-900 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-800";
                                    
                                    const isActive = agent.status === 'Actif';
                                    const statusDotClass = isActive ? "w-2 h-2 rounded-full bg-emerald-500" : "w-2 h-2 rounded-full bg-slate-300";
                                    const actionBtnClass = isActive ? "p-1.5 rounded-lg transition-colors text-red-600 dark:text-red-300 bg-white dark:bg-slate-900 border border-red-100 dark:border-red-900/50 hover:bg-red-50 dark:hover:bg-red-950/40 disabled:opacity-50" : "p-1.5 rounded-lg transition-colors text-emerald-600 dark:text-emerald-300 bg-white dark:bg-slate-900 border border-emerald-100 dark:border-emerald-900/50 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 disabled:opacity-50";

                                    return (
                                        <tr key={agent.id} className="table-row-hover group">
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-4">
                                                    <div className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-600 dark:text-slate-300 font-bold uppercase">
                                                        {agent.name.charAt(0)}
                                                    </div>
                                                    <div>
                                                        <p className="font-medium text-slate-900 dark:text-white">{agent.name}</p>
                                                        <p className="text-slate-500 dark:text-slate-400 text-xs">{agent.email}</p>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className={spanClass}>{agent.role}</span>
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-2">
                                                    <div className={statusDotClass}></div>
                                                    <span className="font-medium">{agent.status}</span>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 font-medium text-slate-900 dark:text-white">{agent.scans}</td>
                                            <td className="px-6 py-4 text-slate-500 dark:text-slate-400">{agent.lastActive}</td>
                                            <td className="px-6 py-4 text-right">
                                                <div className="flex items-center justify-end gap-2">
                                                    {!isAdmin && (
                                                        <>
                                                            <button 
                                                                onClick={() => openAgentConfirm("toggle", agent)}
                                                                disabled={togglingId === agent.id}
                                                                className={actionBtnClass} 
                                                                title={isActive ? 'Révoquer l’accès' : 'Restaurer l’accès'}
                                                            >
                                                                {togglingId === agent.id ? <Loader2 className="w-5 h-5 animate-spin"/> : (
                                                                    isActive ? (
                                                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636"></path></svg>
                                                                    ) : (
                                                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                                                                    )
                                                                )}
                                                            </button>
                                                            <button 
                                                                onClick={() => openAgentConfirm("delete", agent)}
                                                                disabled={togglingId === agent.id}
                                                                className="p-1.5 rounded-lg transition-colors text-red-700 dark:text-red-300 bg-white dark:bg-slate-900 border border-red-100 dark:border-red-900/50 hover:bg-red-100 dark:hover:bg-red-950/40 disabled:opacity-50" 
                                                                title="Supprimer"
                                                            >
                                                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                                                            </button>
                                                        </>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {isAddModalOpen && (
                <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white dark:bg-slate-950 rounded-3xl w-full max-w-md p-6 sm:p-8 shadow-2xl relative animate-in fade-in zoom-in-95 duration-200 text-slate-900 dark:text-slate-100">
                        <button
                            onClick={() => {
                                setIsAddModalOpen(false);
                                setAddError("");
                                setShowPassword(false);
                                setShowConfirmPassword(false);
                            }}
                            className="absolute top-6 right-6 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white transition-colors"
                        >
                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                        </button>

                        <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center mb-6">
                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z"></path></svg>
                        </div>

                        <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">Inviter un agent</h3>
                        <p className="text-slate-500 dark:text-slate-400 text-sm mb-6">Créez un compte rattaché à votre organisation.</p>

                        <form onSubmit={handleAddAgent} className="space-y-4">
                            {adding && (
                                <LoadingBar label="Création du compte agent" />
                            )}
                            {addError && <div className="p-3 bg-red-50 text-red-600 rounded-lg text-sm">{addError}</div>}
                            {addSuccess && <div className="p-3 bg-emerald-50 text-emerald-600 rounded-lg text-sm">{addSuccess}</div>}

                            <div className="space-y-2">
                                <label className="text-sm font-medium text-slate-700 dark:text-slate-200">Nom complet *</label>
                                <input
                                    type="text"
                                    required
                                    value={addForm.fullName}
                                    onChange={(e) => setAddForm({ ...addForm, fullName: e.target.value })}
                                    placeholder="Ex. Jane Smith"
                                    className="w-full px-4 py-3 border border-slate-200 dark:border-slate-800 rounded-xl bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-100 placeholder:text-slate-500 dark:placeholder:text-slate-400 focus:bg-white dark:focus:bg-slate-950 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-colors"
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-slate-700 dark:text-slate-200">Adresse Email *</label>
                                <input
                                    type="email"
                                    required
                                    value={addForm.email}
                                    onChange={(e) => setAddForm({ ...addForm, email: e.target.value })}
                                    placeholder="e.g. jane@example.com"
                                    className="w-full px-4 py-3 border border-slate-200 dark:border-slate-800 rounded-xl bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-100 placeholder:text-slate-500 dark:placeholder:text-slate-400 focus:bg-white dark:focus:bg-slate-950 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-colors"
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-slate-700 dark:text-slate-200">Mot de Passe *</label>
                                <div className="relative">
                                    <input
                                        type={showPassword ? "text" : "password"}
                                        required
                                        minLength={8}
                                        value={addForm.password}
                                        onChange={(e) => setAddForm({ ...addForm, password: e.target.value })}
                                        placeholder="••••••••"
                                        className="w-full px-4 py-3 pr-12 border border-slate-200 dark:border-slate-800 rounded-xl bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-100 placeholder:text-slate-500 dark:placeholder:text-slate-400 focus:bg-white dark:focus:bg-slate-950 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-colors"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowPassword(!showPassword)}
                                        className="absolute inset-y-0 right-0 px-4 text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-200 transition-colors"
                                        aria-label={showPassword ? "Masquer le mot de passe" : "Afficher le mot de passe"}
                                        title={showPassword ? "Masquer le mot de passe" : "Afficher le mot de passe"}
                                    >
                                        {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                                    </button>
                                </div>
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-slate-700 dark:text-slate-200">Confirmer le mot de passe *</label>
                                <div className="relative">
                                    <input
                                        type={showConfirmPassword ? "text" : "password"}
                                        required
                                        minLength={8}
                                        value={addForm.confirmPassword}
                                        onChange={(e) => setAddForm({ ...addForm, confirmPassword: e.target.value })}
                                        placeholder="••••••••"
                                        className="w-full px-4 py-3 pr-12 border border-slate-200 dark:border-slate-800 rounded-xl bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-100 placeholder:text-slate-500 dark:placeholder:text-slate-400 focus:bg-white dark:focus:bg-slate-950 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-colors"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                                        className="absolute inset-y-0 right-0 px-4 text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-200 transition-colors"
                                        aria-label={showConfirmPassword ? "Masquer la confirmation" : "Afficher la confirmation"}
                                        title={showConfirmPassword ? "Masquer la confirmation" : "Afficher la confirmation"}
                                    >
                                        {showConfirmPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                                    </button>
                                </div>
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-slate-700 dark:text-slate-200">Rôle *</label>
                                <select
                                    value={addForm.role}
                                    onChange={(e) => setAddForm({ ...addForm, role: e.target.value })}
                                    className="w-full px-4 py-3 border border-slate-200 dark:border-slate-800 rounded-xl bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:bg-white dark:focus:bg-slate-950 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-colors text-sm font-medium"
                                >
                                    <option value="ORG_AGENT">Agent (Scan standard)</option>
                                    <option value="OPERATOR">Opérateur (Responsable de zone)</option>
                                    <option value="ORG_ADMIN">Administrateur (Gestion complète)</option>
                                </select>
                            </div>

                            <button
                                type="submit"
                                disabled={adding}
                                className="w-full mt-6 py-3.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl shadow-lg shadow-blue-500/20 active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                            >
                                {adding ? <Loader2 className="w-5 h-5 animate-spin"/> : "Envoyer l'Invitation"}
                            </button>
                        </form>
                    </div>
                </div>
            )}

            {confirmAction && confirmAgent && (
                <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white dark:bg-slate-950 rounded-2xl w-full max-w-md p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-200 text-slate-900 dark:text-slate-100">
                        {togglingId === confirmAgent.id && (
                            <LoadingBar label={confirmAction.type === "delete" ? "Suppression de l'agent" : "Mise à jour de l'accès"} className="mb-5" />
                        )}
                        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center mb-4 ${confirmAction.type === "delete" || confirmAgentIsActive ? "bg-red-50 text-red-600" : "bg-emerald-50 text-emerald-600"}`}>
                            {confirmAction.type === "delete" || confirmAgentIsActive ? (
                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636"></path></svg>
                            ) : (
                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                            )}
                        </div>
                        <h3 className="text-lg font-bold text-slate-900 dark:text-white">{confirmAgentTitle}</h3>
                        <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
                            {confirmAgentMessage}
                        </p>
                        <div className="mt-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 p-4">
                            <p className="font-semibold text-slate-900 dark:text-white">{confirmAgent.name}</p>
                            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{confirmAgent.email}</p>
                        </div>
                        <div className="mt-6 flex gap-3">
                            <button
                                type="button"
                                onClick={closeAgentConfirm}
                                disabled={togglingId === confirmAgent.id}
                                className="flex-1 px-4 py-2.5 border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-700 dark:text-slate-200 font-medium rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors disabled:opacity-60"
                            >
                                Annuler
                            </button>
                            <button
                                type="button"
                                onClick={() => confirmAction.type === "delete" ? handleDeleteAgent(confirmAgent.id) : handleToggleStatus(confirmAgent.id)}
                                disabled={togglingId === confirmAgent.id}
                                className={`flex-1 px-4 py-2.5 text-white font-medium rounded-xl transition-colors flex items-center justify-center gap-2 disabled:opacity-60 ${confirmAction.type === "delete" || confirmAgentIsActive ? "bg-red-600 hover:bg-red-700" : "bg-emerald-600 hover:bg-emerald-700"}`}
                            >
                                {togglingId === confirmAgent.id && <Loader2 className="w-4 h-4 animate-spin" />}
                                {confirmAgentButton}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
