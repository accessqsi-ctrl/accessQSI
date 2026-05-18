"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Loader2, Calendar, MapPin, QrCode, Edit2, Trash2, ArrowLeft, Plus, Download, X, CheckCircle2 } from "lucide-react";

export default function EventDetailPage() {
    const params = useParams();
    const router = useRouter();
    const eventId = params.id;

    const [event, setEvent] = useState(null);
    const [qrCodes, setQrCodes] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    // Modal states
    const [showQrModal, setShowQrModal] = useState(false);
    const [showEditModal, setShowEditModal] = useState(false);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);
    const [showImportModal, setShowImportModal] = useState(false);
    const [importFile, setImportFile] = useState(null);
    const [importing, setImporting] = useState(false);
    const [importError, setImportError] = useState("");
    const [importSuccess, setImportSuccess] = useState("");
    const [areas, setAreas] = useState([]);
    const [loadingAreas, setLoadingAreas] = useState(true);
    const [toast, setToast] = useState({ show: false, message: "" });



    // QR Generation Form
    const [qrForm, setQrForm] = useState({
        fullName: "", email: "", phone: "",
        accessType: 'single', limit: "1",
        validFrom: "", validUntil: "", level: "1"
    });
    const [generatingQr, setGeneratingQr] = useState(false);
    const [qrError, setQrError] = useState("");

    // Edit Form
    const [editForm, setEditForm] = useState({
        title: "", description: "", areaIds: [], startDate: "", endDate: ""
    });
    const [updatingEvent, setUpdatingEvent] = useState(false);
    const [editError, setEditError] = useState("");

    // Filters and Actions State
    const [searchQuery, setSearchQuery] = useState("");
    const [statusFilter, setStatusFilter] = useState("All Statuses");
    const [selectedQr, setSelectedQr] = useState(null);
    const [revokingId, setRevokingId] = useState(null);

    useEffect(() => {
        if (eventId) {
            fetchAll();
            fetchAreas();
        }
    }, [eventId]);

    const fetchAreas = async () => {
        try {
            const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/areas`, {
                method: "GET",
                headers: { "Content-Type": "application/json" },
                credentials: "include"
            });
            const data = await res.json();
            if (data.success) {
                setAreas(data.areas || []);
            }
        } catch (err) {
            console.error("Error fetching areas:", err);
        } finally {
            setLoadingAreas(false);
        }
    };

    const fetchAll = async () => {
        setLoading(true);
        setError("");
        try {
            const [eventRes, qrRes] = await Promise.all([
                fetch(`${process.env.NEXT_PUBLIC_API_URL}/events/${eventId}`, { credentials: "include" }),
                fetch(`${process.env.NEXT_PUBLIC_API_URL}/qr/event/${eventId}`, { credentials: "include" })
            ]);
            const eventData = await eventRes.json();
            const qrData = await qrRes.json();

            if (eventData.success) {
                const evt = eventData.event;
                const schedules = evt.EventSchedules || [];
                const firstSchedule = schedules[0];
                setEvent(evt);
                setEditForm({
                    title: evt.title,
                    description: evt.description || "",
                    areaIds: schedules.map(s => s.id_area),
                    startDate: firstSchedule ? new Date(firstSchedule.start_date).toISOString().slice(0, 16) : "",
                    endDate: firstSchedule ? new Date(firstSchedule.end_date).toISOString().slice(0, 16) : ""
                });
            } else {
                setError("Événement introuvable.");
            }
            if (qrData.success) setQrCodes(qrData.qrs || []);
        } catch (err) {
            setError("Erreur de connexion au serveur.");
        } finally {
            setLoading(false);
        }
    };

    const handleAreaChange = (areaId) => {
        setEditForm(prev => {
            const currentIds = prev.areaIds;
            if (currentIds.includes(areaId)) {
                return { ...prev, areaIds: currentIds.filter(id => id !== areaId) };
            } else {
                return { ...prev, areaIds: [...currentIds, areaId] };
            }
        });
    };

    const handleUpdateEvent = async (e) => {
        e.preventDefault();
        setEditError("");
        setUpdatingEvent(true);
        if (new Date(editForm.endDate) <= new Date(editForm.startDate)) {
            setEditError("La date de fin doit être postérieure à la date de début.");
            setUpdatingEvent(false);
            return;
        }

        try {
            const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/events/${eventId}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                credentials: "include",
                body: JSON.stringify(editForm)
            });
            const data = await res.json();
            if (data.success) {
                setShowEditModal(false);
                fetchAll();
            } else {
                setEditError(data.message || "Erreur lors de la mise à jour.");
            }
        } catch {
            setEditError("Erreur de connexion au serveur.");
        } finally {
            setUpdatingEvent(false);
        }
    };

    const handleDeleteEvent = async () => {
        setIsDeleting(true);
        try {
            const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/events/${eventId}`, {
                method: "DELETE",
                credentials: "include"
            });
            const data = await res.json();
            if (data.success) {
                router.push("/dashboard/events");
            } else {
                alert(data.message || "Erreur lors de la suppression.");
                setShowDeleteConfirm(false);
            }
        } catch {
            alert("Erreur de connexion au serveur.");
        } finally {
            setIsDeleting(false);
        }
    };

    const handleGenerateQr = async (e) => {
        e.preventDefault();
        setQrError("");
        setGeneratingQr(true);
        try {
            const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/qr/generate/${eventId}`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                credentials: "include",
                body: JSON.stringify(qrForm)
            });
            const data = await res.json();
            if (data.success) {
                setShowQrModal(false);
                setQrForm({ ...qrForm, fullName: "", email: "", phone: "", level: "1" });
                // Refresh QR list
                const qrRes = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/qr/event/${eventId}`, { credentials: "include" });
                const qrData = await qrRes.json();
                if (qrData.success) setQrCodes(qrData.qrs || []);
            } else {
                setQrError(data.message || "Erreur lors de la génération.");
            }
        } catch {
            setQrError("Erreur de connexion au serveur.");
        } finally {
            setGeneratingQr(false);
        }
    };

    const handleRevoke = async (id) => {
        if (!confirm("Voulez-vous vraiment révoquer ce QR Code ?")) return;
        setRevokingId(id);
        try {
            const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/qr/revoke/${id}`, {
                method: "PUT",
                credentials: "include"
            });
            const data = await res.json();
            if (data.success) {
                setQrCodes(qrCodes.map(qr => qr.id === id ? { ...qr, status: 'revoked' } : qr));
            } else {
                alert(data.message || "Erreur lors de la révocation.");
            }
        } catch (err) {
            alert("Erreur de connexion au serveur.");
        } finally {
            setRevokingId(null);
        }
    };

    const handleExport = (format) => {
        const totalScanLogs = qrCodes.reduce((sum, qr) => sum + (qr.scans_count || 0), 0);
        if (totalScanLogs === 0) {
            setToast({ show: true, message: "Aucune donnée de scan n'est disponible pour cet événement." });
            setTimeout(() => setToast({ show: false, message: "" }), 4000);
            return;
        }
        window.open(`${process.env.NEXT_PUBLIC_API_URL}/export/${format}?event_id=${eventId}`, '_blank');
    };



    const handleImportCSV = async (e) => {
        e.preventDefault();
        if (!importFile) {
            setImportError("Veuillez sélectionner un fichier.");
            return;
        }

        setImporting(true);
        setImportError("");
        setImportSuccess("");

        const formData = new FormData();
        formData.append("file", importFile);

        try {
            const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/qr/import/${eventId}`, {
                method: "POST",
                credentials: "include",
                body: formData
            });
            const data = await res.json();
            if (data.success) {
                setImportSuccess(data.message);
                setImportFile(null);
                // Refresh list
                const qrRes = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/qr/event/${eventId}`, { credentials: "include" });
                const qrData = await qrRes.json();
                if (qrData.success) setQrCodes(qrData.qrs || []);
                
                setTimeout(() => {
                    setShowImportModal(false);
                    setImportSuccess("");
                }, 2000);
            } else {
                setImportError(data.message || "Erreur lors de l'importation.");
            }
        } catch (err) {
            setImportError("Erreur de connexion au serveur.");
        } finally {
            setImporting(false);
        }
    };



    const filteredQrs = qrCodes.filter(qr => {
        const matchesSearch = !searchQuery ||
            qr.holder?.toLowerCase().includes(searchQuery.toLowerCase()) ||
            String(qr.id).includes(searchQuery);

        const matchesStatus = statusFilter === "All Statuses" ||
            qr.status.toLowerCase() === statusFilter.toLowerCase();

        return matchesSearch && matchesStatus;
    });

    const getStatusStyle = (status) => {
        if (status === 'active') return 'bg-emerald-100 text-emerald-700';
        if (status === 'exhausted') return 'bg-amber-100 text-amber-700';
        if (status === 'expired') return 'bg-orange-100 text-orange-700';
        if (status === 'revoked') return 'bg-red-100 text-red-700';
        return 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300';
    };

    const getEventStatus = () => {
        if (!event || !event.EventSchedules || event.EventSchedules.length === 0) return { label: "—", style: "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300" };
        const now = new Date();
        const first = event.EventSchedules[0];
        const last = event.EventSchedules[event.EventSchedules.length - 1];
        if (new Date(first.start_date) > now) return { label: "Upcoming", style: "bg-blue-100 text-blue-700" };
        if (new Date(last.end_date) < now) return { label: "Past", style: "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300" };
        return { label: "Active", style: "bg-emerald-100 text-emerald-700" };
    };

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh]">
                <Loader2 className="w-10 h-10 animate-spin text-blue-600 mb-3" />
                <p className="text-slate-500 dark:text-slate-400 font-medium">Chargement de l'événement...</p>
            </div>
        );
    }

    if (error || !event) {
        return (
            <div className="max-w-lg mx-auto text-center py-20">
                <div className="w-16 h-16 bg-red-50 text-red-400 rounded-2xl flex items-center justify-center mx-auto mb-4">
                    <X className="w-8 h-8" />
                </div>
                <h1 className="text-xl font-bold text-slate-900 dark:text-white mb-2">{error || "Événement introuvable"}</h1>
                <Link href="/dashboard/events" className="mt-6 inline-flex items-center gap-2 px-5 py-2.5 bg-slate-900 dark:bg-slate-100 text-white rounded-xl font-medium text-sm hover:bg-slate-800 dark:hover:bg-slate-200 transition-colors">
                    <ArrowLeft className="w-4 h-4" /> Retour aux événements
                </Link>
            </div>
        );
    }

    const evtStatus = getEventStatus();

    return (
        <div className="max-w-7xl mx-auto space-y-6">
            {/* Breadcrumb & Actions */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <Link href="/dashboard/events" className="inline-flex items-center gap-2 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors text-sm font-medium">
                    <ArrowLeft className="w-4 h-4" /> Retour aux événements
                </Link>
                <div className="flex items-center gap-3">
                    <button
                        onClick={() => { setShowEditModal(true); setEditError(""); }}
                        className="inline-flex items-center gap-2 px-4 py-2 border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-700 dark:text-slate-200 rounded-xl text-sm font-medium hover:bg-slate-50 dark:hover:bg-slate-800 active:scale-95 transition-all shadow-sm"
                    >
                        <Edit2 className="w-4 h-4" /> Modifier
                    </button>
                    <button
                        onClick={() => setShowDeleteConfirm(true)}
                        className="inline-flex items-center gap-2 px-4 py-2 bg-red-50 text-red-600 border border-red-100 rounded-xl text-sm font-medium hover:bg-red-100 active:scale-95 transition-all shadow-sm"
                    >
                        <Trash2 className="w-4 h-4" /> Supprimer
                    </button>
                </div>
            </div>

            {/* Event Header */}
            <div className="bg-white dark:bg-slate-950 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm p-6 sm:p-8">
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                    <div className="space-y-3 flex-1">
                        <div className="flex items-center gap-3 flex-wrap">
                            <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${evtStatus.style}`}>{evtStatus.label}</span>
                            <span className="text-xs text-slate-400 dark:text-slate-500 font-medium">ID #{event.id}</span>
                        </div>
                        <h1 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight">{event.title}</h1>
                        {event.description && (
                            <p className="text-slate-500 dark:text-slate-400 leading-relaxed max-w-2xl">{event.description}</p>
                        )}
                        <div className="flex flex-wrap gap-5 pt-1">
                            <div className="flex items-center gap-2 text-slate-600 dark:text-slate-300">
                                <Calendar className="w-4 h-4 text-blue-500 flex-shrink-0" />
                                <span className="text-sm font-medium">
                                    {event.EventSchedules?.[0] ? new Date(event.EventSchedules[0].start_date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }) : 'N/A'}
                                    {' → '}
                                    {event.EventSchedules?.[event.EventSchedules.length - 1] ? new Date(event.EventSchedules[event.EventSchedules.length - 1].end_date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }) : 'N/A'}
                                </span>
                            </div>
                            <div className="flex items-center gap-2 text-slate-600 dark:text-slate-300">
                                <MapPin className="w-4 h-4 text-blue-500 flex-shrink-0" />
                                <span className="text-sm font-medium">
                                    {event.EventSchedules?.length > 0
                                        ? event.EventSchedules.map(s => s.area?.area_name).filter(Boolean).join(", ")
                                        : "Lieu non défini"}
                                </span>
                            </div>
                            <div className="flex items-center gap-2 text-slate-600 dark:text-slate-300">
                                <QrCode className="w-4 h-4 text-blue-500 flex-shrink-0" />
                                <span className="text-sm font-medium">{qrCodes.length} QR code{qrCodes.length !== 1 ? 's' : ''}</span>
                            </div>
                        </div>
                    </div>
                    <div className="flex gap-2 flex-shrink-0">
                        <button
                            onClick={() => handleExport('csv')}
                            className="inline-flex items-center justify-center p-2.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-200 rounded-xl transition-all border border-slate-200 dark:border-slate-800"
                            title="Exporter en CSV"
                        >
                            <Download className="w-5 h-5" />
                        </button>
                        <button
                            onClick={() => handleExport('pdf')}
                            className="inline-flex items-center justify-center p-2.5 bg-slate-50 dark:bg-slate-900 hover:bg-slate-100 text-slate-700 dark:text-slate-200 rounded-xl transition-all border border-slate-200 dark:border-slate-800"
                            title="Exporter en PDF"
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"></path></svg>
                        </button>
                        <button
                            onClick={() => {
                                setShowImportModal(true);
                                setImportError("");
                                setImportSuccess("");
                            }}
                            className="inline-flex items-center justify-center p-2.5 bg-slate-50 dark:bg-slate-900 hover:bg-slate-100 text-slate-700 dark:text-slate-200 rounded-xl transition-all border border-slate-200 dark:border-slate-800"
                            title="Importer CSV"
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"></path></svg>
                        </button>
                        <button
                            onClick={() => {
                                setShowQrModal(true);
                                setSuccessData(null);
                                setQrError("");
                                if (event && event.EventSchedules && event.EventSchedules.length > 0) {
                                    const schedules = event.EventSchedules;
                                    setQrForm(prev => ({
                                        ...prev,
                                        validFrom: new Date(schedules[0].start_date).toISOString().slice(0, 16),
                                        validUntil: new Date(schedules[schedules.length - 1].end_date).toISOString().slice(0, 16)
                                    }));
                                }
                            }}
                            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-xl shadow-sm hover:shadow active:scale-95 transition-all text-sm"
                        >
                            <Plus className="w-5 h-5" /> Générer un QR
                        </button>

                    </div>

                </div>
            </div>

            {/* QR Codes Section */}
            <div className="bg-white dark:bg-slate-950 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
                    <h2 className="text-lg font-bold text-slate-900 dark:text-white">Codes QR de cet événement</h2>
                    <span className="text-sm text-slate-500 dark:text-slate-400">{qrCodes.length} total</span>
                </div>

                {/* Filters and Search */}
                <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 flex flex-col md:flex-row gap-4 items-center justify-between">
                    <div className="relative w-full md:w-96">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <svg className="h-5 w-5 text-slate-400 dark:text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                            </svg>
                        </div>
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="Rechercher par ID, Nom..."
                            className="block w-full pl-10 pr-3 py-2 border border-slate-200 dark:border-slate-800 rounded-xl leading-5 bg-white dark:bg-slate-950 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 sm:text-sm transition-colors"
                        />
                    </div>

                    <div className="flex gap-2 w-full md:w-auto overflow-x-auto pb-1 md:pb-0">
                        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="px-3 py-2 border border-slate-200 dark:border-slate-800 rounded-xl bg-white dark:bg-slate-950 text-sm text-slate-700 dark:text-slate-200 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500">
                            <option value="All Statuses">Tous les statuts</option>
                            <option value="active">Actif</option>
                            <option value="exhausted">Épuisé</option>
                            <option value="expired">Expiré</option>
                            <option value="revoked">Révoqué</option>
                        </select>
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse min-w-[700px]">
                        <thead>
                            <tr className="bg-slate-50 dark:bg-slate-900 text-slate-500 dark:text-slate-400 text-xs font-semibold uppercase tracking-wider border-b border-slate-100 dark:border-slate-800">
                                <th className="px-6 py-3">QR ID</th>
                                <th className="px-6 py-3">Titulaire</th>
                                <th className="px-6 py-3">Email</th>
                                <th className="px-6 py-3">Utilisations</th>
                                <th className="px-6 py-3">Statut</th>
                                <th className="px-6 py-3">Créé le</th>
                                <th className="px-6 py-3 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 text-slate-700 dark:text-slate-200 text-sm">
                            {filteredQrs.length === 0 ? (
                                <tr>
                                    <td colSpan="7" className="px-6 py-14 text-center">
                                        <div className="w-14 h-14 bg-slate-100 dark:bg-slate-800 text-slate-300 rounded-2xl flex items-center justify-center mx-auto mb-3">
                                            <QrCode className="w-7 h-7" />
                                        </div>
                                        <h3 className="text-base font-semibold text-slate-900 dark:text-white">Aucun QR code</h3>
                                        <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">{qrCodes.length === 0 ? "Générez votre premier code QR pour cet événement." : "Aucun QR Code trouvé pour ces critères."}</p>
                                        <button
                                            onClick={() => {
                                                setShowQrModal(true);
                                                setSuccessData(null);
                                                setQrError("");
                                                if (event && event.EventSchedules && event.EventSchedules.length > 0) {
                                                    const schedules = event.EventSchedules;
                                                    setQrForm(prev => ({
                                                        ...prev,
                                                        validFrom: new Date(schedules[0].start_date).toISOString().slice(0, 16),
                                                        validUntil: new Date(schedules[schedules.length - 1].end_date).toISOString().slice(0, 16)
                                                    }));
                                                }
                                            }}
                                            className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-xl text-sm font-medium hover:bg-blue-700 transition-colors"
                                        >
                                            <Plus className="w-4 h-4" /> Générer un QR
                                        </button>
                                    </td>
                                </tr>
                            ) : (
                                filteredQrs.map((qr) => (
                                    <tr key={qr.id} className="hover:bg-slate-50/60 transition-colors group">
                                        <td className="px-6 py-4 font-medium text-slate-900 dark:text-white">{qr.id}</td>
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-3">
                                                <div className="w-8 h-8 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center font-bold text-xs">
                                                    {qr.holder?.charAt(0)?.toUpperCase() || '?'}
                                                </div>
                                                <span className="font-medium text-slate-900 dark:text-white">{qr.holder}</span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-slate-500 dark:text-slate-400">{qr.email}</td>
                                        <td className="px-6 py-4">
                                            <span className="font-medium text-slate-700 dark:text-slate-200">{qr.scans}</span>
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${getStatusStyle(qr.status)}`}>
                                                {qr.status.charAt(0).toUpperCase() + qr.status.slice(1)}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-slate-500 dark:text-slate-400">{qr.createdAt}</td>
                                        <td className="px-6 py-4 text-right">
                                            <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <button onClick={() => setSelectedQr(qr)} className="p-1.5 text-slate-400 dark:text-slate-500 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 rounded-lg transition-colors" title="Voir Ticket">
                                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"></path></svg>
                                                </button>
                                                <a
                                                    href={`${process.env.NEXT_PUBLIC_API_URL}/qrcodes/qr_${qr.token}.png`}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="p-1.5 text-slate-400 dark:text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 rounded-lg transition-colors inline-block"
                                                    title="Télécharger le QR"
                                                >
                                                    <Download className="w-5 h-5" />
                                                </a>
                                                {qr.status === 'active' ? (
                                                    <button onClick={() => handleRevoke(qr.id)} disabled={revokingId === qr.id} className="p-1.5 text-slate-400 dark:text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50" title="Révoquer Accès">
                                                        {revokingId === qr.id ? <Loader2 className="w-5 h-5 animate-spin" /> : <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636"></path></svg>}
                                                    </button>
                                                ) : null}
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* ── MODAL: Generate QR ── */}
            {showQrModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm overflow-y-auto">
                    <div className="bg-white dark:bg-slate-950 w-full max-w-md rounded-3xl shadow-2xl p-6 sm:p-8 relative my-8">
                        <button onClick={() => setShowQrModal(false)} className="absolute top-4 right-4 p-2 hover:bg-slate-100 rounded-xl transition-colors">
                            <X className="w-5 h-5 text-slate-400 dark:text-slate-500" />
                        </button>
                        
                        <div className="mb-6 pr-8">
                            <h2 className="text-xl font-bold text-slate-900 dark:text-white">Générer un QR Code</h2>
                            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 truncate">Pour : <span className="font-semibold text-blue-600">{event.title}</span></p>
                        </div>

                        <form onSubmit={handleGenerateQr} className="space-y-6">
                                {qrError && (
                                    <div className="p-4 bg-red-50 text-red-600 rounded-xl text-sm border border-red-100 animate-in fade-in zoom-in duration-300">{qrError}</div>
                                )}

                                <div className="space-y-5">
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium text-slate-700 dark:text-slate-200">Nom complet *</label>
                                        <input
                                            required
                                            type="text"
                                            placeholder="John Doe"
                                            value={qrForm.fullName}
                                            onChange={(e) => setQrForm({ ...qrForm, fullName: e.target.value })}
                                            className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:bg-white transition-all"
                                        />
                                    </div>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <label className="text-sm font-medium text-slate-700 dark:text-slate-200">Email</label>
                                            <input
                                                type="email"
                                                placeholder="john@example.com"
                                                value={qrForm.email}
                                                onChange={(e) => setQrForm({ ...qrForm, email: e.target.value })}
                                                className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:bg-white transition-all"
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-sm font-medium text-slate-700 dark:text-slate-200">Téléphone</label>
                                            <input
                                                type="tel"
                                                placeholder="+33..."
                                                value={qrForm.phone}
                                                onChange={(e) => setQrForm({ ...qrForm, phone: e.target.value })}
                                                className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:bg-white transition-all"
                                            />
                                        </div>
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-slate-700 dark:text-slate-200">Niveau d'accréditation</label>
                                    <input
                                        type="number"
                                        min="1"
                                        value={qrForm.level}
                                        onChange={(e) => setQrForm({ ...qrForm, level: e.target.value })}
                                        className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:bg-white transition-all"
                                    />
                                </div>

                                <div className="space-y-3">
                                    <label className="text-sm font-medium text-slate-700 dark:text-slate-200">Type d'accès</label>
                                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                        {[
                                            { value: 'single', label: 'Simple', desc: '1 scan' },
                                            { value: 'multi', label: 'Multiple', desc: 'N scans' },
                                            { value: 'unlimited', label: 'Illimité', desc: '∞ scans' }
                                        ].map(({ value, label, desc }) => (
                                            <button
                                                key={value}
                                                type="button"
                                                onClick={() => setQrForm({ ...qrForm, accessType: value, limit: value === 'single' ? "1" : value === 'unlimited' ? "999999" : (qrForm.limit == "1" ? "2" : qrForm.limit) })}
                                                className={`px-3 py-3 rounded-xl border text-left transition-all ${qrForm.accessType === value ? 'bg-blue-50 border-blue-200 text-blue-700 shadow-sm' : 'bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:border-slate-300 dark:hover:border-slate-600'}`}
                                            >
                                                <div className="text-sm font-bold">{label}</div>
                                                <div className="text-[10px] opacity-70 font-medium">{desc}</div>
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {qrForm.accessType === 'multi' && (
                                    <div className="space-y-2 animate-in fade-in slide-in-from-top-2 duration-300">
                                        <label className="text-sm font-medium text-slate-700 dark:text-slate-200">Nombre de scans</label>
                                        <input
                                            type="number"
                                            min="2"
                                            value={qrForm.limit}
                                            onChange={(e) => setQrForm({ ...qrForm, limit: e.target.value })}
                                            className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:bg-white transition-all"
                                        />
                                    </div>
                                )}

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium text-slate-700 dark:text-slate-200">Valide du</label>
                                        <input
                                            type="datetime-local"
                                            value={qrForm.validFrom}
                                            onChange={(e) => setQrForm({ ...qrForm, validFrom: e.target.value })}
                                            className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:bg-white transition-all text-slate-600 dark:text-slate-300"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium text-slate-700 dark:text-slate-200">Valide jusqu'au</label>
                                        <input
                                            type="datetime-local"
                                            value={qrForm.validUntil}
                                            onChange={(e) => setQrForm({ ...qrForm, validUntil: e.target.value })}
                                            className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:bg-white transition-all text-slate-600 dark:text-slate-300"
                                        />
                                    </div>
                                </div>

                                <button
                                    type="submit"
                                    disabled={generatingQr}
                                    className="w-full py-4 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-2xl shadow-lg shadow-blue-600/20 active:scale-95 transition-all flex items-center justify-center gap-3 disabled:opacity-60"
                                >
                                    {generatingQr ? <Loader2 className="w-5 h-5 animate-spin" /> : <QrCode className="w-5 h-5" />}
                                    {generatingQr ? "Génération en cours..." : "Générer & Sauvegarder"}
                                </button>
                            </form>
                    </div>
                </div>
            )}

            {/* ── MODAL: View Ticket ── */}
            {selectedQr && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
                    <div className="bg-white dark:bg-slate-950 w-full max-w-sm rounded-3xl shadow-2xl p-6 relative overflow-hidden text-center animate-in zoom-in duration-300">
                        <button onClick={() => setSelectedQr(null)} className="absolute top-4 right-4 p-2 hover:bg-slate-100 rounded-xl transition-colors">
                            <X className="w-5 h-5 text-slate-400 dark:text-slate-500" />
                        </button>
                        <h3 className="text-sm font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-6">Détails du Ticket</h3>

                        <div className="w-full flex flex-col items-center">
                            <img src={`${process.env.NEXT_PUBLIC_API_URL}/qrcodes/qr_${selectedQr.token}.png`} alt="QR Code" className="w-48 h-48 rounded-2xl border border-slate-100 dark:border-slate-800 p-2 shadow-inner bg-slate-50 dark:bg-slate-900 mb-6 object-contain" />

                            <div className="w-full space-y-4 text-left bg-slate-50 dark:bg-slate-900 p-4 rounded-2xl border border-slate-100 dark:border-slate-800">
                                <div>
                                    <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-tighter">Titulaire</p>
                                    <p className="text-sm font-black text-slate-900 dark:text-white truncate">{selectedQr.holder}</p>
                                </div>
                                <div>
                                    <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-tighter">Événement</p>
                                    <p className="text-sm font-bold text-slate-700 dark:text-slate-200">{event.title}</p>
                                </div>
                                <div className="flex justify-between items-end">
                                    <div>
                                        <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-tighter">Statut</p>
                                        <p className={`text-xs font-bold capitalize ${selectedQr.status === 'active' ? 'text-emerald-600' : selectedQr.status === 'revoked' ? 'text-red-600' : 'text-slate-600 dark:text-slate-300'}`}>
                                            {selectedQr.status}
                                        </p>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-tighter">Scans</p>
                                        <p className="text-xs font-bold text-slate-700 dark:text-slate-200">{selectedQr.scans}</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* ── MODAL: Edit Event ── */}
            {showEditModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
                    <div className="bg-white dark:bg-slate-950 w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden">
                        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800">
                            <h2 className="text-lg font-bold text-slate-900 dark:text-white">Modifier l'événement</h2>
                            <button onClick={() => setShowEditModal(false)} className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors">
                                <X className="w-5 h-5 text-slate-400 dark:text-slate-500" />
                            </button>
                        </div>
                        <form onSubmit={handleUpdateEvent} className="p-6 space-y-4">
                            {editError && (
                                <div className="p-3 bg-red-50 text-red-600 rounded-xl text-sm border border-red-100">{editError}</div>
                            )}
                            <div className="space-y-1.5">
                                <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Titre *</label>
                                <input
                                    required
                                    type="text"
                                    value={editForm.title}
                                    onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
                                    className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-900 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:bg-white transition-all"
                                />
                            </div>
                            <div className="space-y-3">
                                <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Zones / Areas *</label>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto p-1">
                                    {loadingAreas ? (
                                        <p className="text-xs text-slate-500 dark:text-slate-400 italic">Chargement...</p>
                                    ) : areas.length === 0 ? (
                                        <p className="text-xs text-red-500">Aucune zone disponible</p>
                                    ) : (
                                        areas.map(area => (
                                            <label key={area.area_id} className={`flex items-center gap-2 p-2 rounded-lg border transition-all cursor-pointer ${editForm.areaIds.includes(area.area_id) ? 'bg-blue-50 border-blue-200 text-blue-700' : 'bg-slate-50 dark:bg-slate-900 border-slate-100 dark:border-slate-800 text-slate-600 dark:text-slate-300'}`}>
                                                <input
                                                    type="checkbox"
                                                    checked={editForm.areaIds.includes(area.area_id)}
                                                    onChange={() => handleAreaChange(area.area_id)}
                                                    className="w-3.5 h-3.5 text-blue-600 rounded border-slate-300 dark:border-slate-700"
                                                />
                                                <span className="text-xs font-medium truncate">{area.area_name}</span>
                                            </label>
                                        ))
                                    )}
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1.5">
                                    <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Date de début</label>
                                    <input
                                        type="datetime-local"
                                        value={editForm.startDate}
                                        onChange={(e) => setEditForm({ ...editForm, startDate: e.target.value })}
                                        className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-900 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:bg-white transition-all text-slate-600 dark:text-slate-300"
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Date de fin</label>
                                    <input
                                        type="datetime-local"
                                        value={editForm.endDate}
                                        onChange={(e) => setEditForm({ ...editForm, endDate: e.target.value })}
                                        className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-900 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:bg-white transition-all text-slate-600 dark:text-slate-300"
                                    />
                                </div>
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Description</label>
                                <textarea
                                    rows="3"
                                    value={editForm.description}
                                    onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                                    className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-900 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:bg-white transition-all resize-none"
                                />
                            </div>
                            <button
                                type="submit"
                                disabled={updatingEvent}
                                className="w-full py-3 bg-slate-900 dark:bg-slate-100 hover:bg-black text-white font-semibold rounded-xl shadow-sm active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-60"
                            >
                                {updatingEvent ? <Loader2 className="w-5 h-5 animate-spin" /> : <Edit2 className="w-5 h-5" />}
                                {updatingEvent ? "Mise à jour..." : "Enregistrer les modifications"}
                            </button>
                        </form>
                    </div>
                </div>
            )}

            {/* ── MODAL: Delete Confirm ── */}
            {showDeleteConfirm && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
                    <div className="bg-white dark:bg-slate-950 w-full max-w-sm rounded-2xl shadow-2xl p-6 text-center">
                        <div className="w-14 h-14 bg-red-50 text-red-500 rounded-2xl flex items-center justify-center mx-auto mb-4">
                            <Trash2 className="w-7 h-7" />
                        </div>
                        <h2 className="text-lg font-bold text-slate-900 dark:text-white">Supprimer l'événement ?</h2>
                        <p className="text-slate-500 dark:text-slate-400 text-sm mt-2 mb-6">
                            Cette action supprimera définitivement <span className="font-semibold text-slate-700 dark:text-slate-200">"{event.title}"</span> et tous ses codes QR associés.
                        </p>
                        <div className="flex gap-3">
                            <button
                                onClick={() => setShowDeleteConfirm(false)}
                                className="flex-1 py-2.5 border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-700 dark:text-slate-200 rounded-xl font-medium text-sm hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                            >
                                Annuler
                            </button>
                            <button
                                onClick={handleDeleteEvent}
                                disabled={isDeleting}
                                className="flex-1 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl font-medium text-sm transition-colors flex items-center justify-center gap-2 disabled:opacity-60"
                            >
                                {isDeleting ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                                {isDeleting ? "Suppression..." : "Confirmer"}
                            </button>
                        </div>
                    </div>
                </div>
            )}
            {/* ── MODAL: Import CSV ── */}
            {showImportModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
                    <div className="bg-white dark:bg-slate-950 w-full max-w-md rounded-2xl shadow-2xl p-6 relative">
                        <button onClick={() => setShowImportModal(false)} className="absolute top-4 right-4 p-2 hover:bg-slate-100 rounded-xl transition-colors">
                            <X className="w-5 h-5 text-slate-400 dark:text-slate-500" />
                        </button>
                        <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-2">Importer des QR Codes</h2>
                        <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">Téléchargez un fichier CSV pour générer des codes QR en masse.</p>

                        <form onSubmit={handleImportCSV} className="space-y-4">
                            {importError && (
                                <div className="p-3 bg-red-50 text-red-600 rounded-xl text-sm border border-red-100">{importError}</div>
                            )}
                            {importSuccess && (
                                <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl text-sm border border-emerald-100 flex items-center gap-2">
                                    <CheckCircle2 className="w-4 h-4" /> {importSuccess}
                                </div>
                            )}

                            <div className="border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-2xl p-8 text-center hover:border-blue-400 transition-colors cursor-pointer relative">
                                <input
                                    type="file"
                                    accept=".csv"
                                    onChange={(e) => setImportFile(e.target.files[0])}
                                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                />
                                <div className="space-y-2">
                                    <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center mx-auto">
                                        <Download className="w-6 h-6 rotate-180" />
                                    </div>
                                    <p className="text-sm font-medium text-slate-900 dark:text-white">{importFile ? importFile.name : "Cliquez ou glissez votre fichier CSV ici"}</p>
                                    <p className="text-xs text-slate-400 dark:text-slate-500">Format .csv uniquement</p>
                                </div>
                            </div>

                            <div className="bg-slate-50 dark:bg-slate-900 p-4 rounded-xl border border-slate-100 dark:border-slate-800">
                                <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">Instructions</p>
                                <ul className="text-xs text-slate-600 dark:text-slate-300 space-y-1 list-disc pl-4">
                                    <li>Utilisez le modèle CSV fourni ci-dessous.</li>
                                    <li>Les colonnes obligatoires sont : <code className="bg-slate-200 dark:bg-slate-700 px-1 rounded">fullName</code>.</li>
                                    <li>Les types d'accès valides : <code className="bg-slate-200 dark:bg-slate-700 px-1 rounded">single</code>, <code className="bg-slate-200 dark:bg-slate-700 px-1 rounded">multi</code>, <code className="bg-slate-200 dark:bg-slate-700 px-1 rounded">unlimited</code>.</li>
                                </ul>
                                <a
                                    href={`${process.env.NEXT_PUBLIC_API_URL}/templates/qr_template.csv`}
                                    download
                                    className="mt-3 inline-flex items-center gap-1.5 text-blue-600 hover:text-blue-700 font-bold text-xs"
                                >
                                    <Download className="w-3 h-3" /> Télécharger le modèle CSV
                                </a>
                            </div>

                            <button
                                type="submit"
                                disabled={importing || !importFile}
                                className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-sm active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                            >
                                {importing ? <Loader2 className="w-5 h-5 animate-spin" /> : <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"></path></svg>}
                                {importing ? "Importation..." : "Importer maintenant"}
                            </button>
                        </form>
                    </div>
                </div>
            )}
            {/* ── CUSTOM TOAST ── */}
            {toast.show && (
                <div className="fixed bottom-10 left-1/2 -translate-x-1/2 z-[100] animate-in slide-in-from-bottom-5 fade-in duration-300">
                    <div className="bg-slate-900 dark:bg-slate-100 text-white px-6 py-4 rounded-2xl shadow-2xl flex items-center gap-3 border border-slate-700/50 backdrop-blur-md">
                        <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center">
                            <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                        </div>
                        <p className="text-sm font-bold tracking-tight">{toast.message}</p>
                        <button onClick={() => setToast({ show: false, message: "" })} className="ml-2 p-1 hover:bg-white/10 rounded-lg transition-colors">
                            <X className="w-4 h-4" />
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}


