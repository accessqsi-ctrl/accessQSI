"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Loader2, Calendar, MapPin, QrCode, Edit2, Trash2, ArrowLeft, Plus, Download, X, CheckCircle2, FileSpreadsheet, FileText, Mail, Phone, IdCard, Ticket } from "lucide-react";
import { apiFetch, apiUrl, refreshSession } from "../../../lib/api";
import LoadingBar from "../../../components/LoadingBar";
import { useUserPlan } from "../../../lib/useUserPlan";
import PlanQuotaStatus from "../../../components/PlanQuotaStatus";

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

const normalizePhone = (phone) => phone.replace(/[^\d+]/g, "");

const formatInternationalPhone = (value) => {
    let cleaned = value.replace(/[^\d+]/g, "");

    if (cleaned.startsWith("00")) {
        cleaned = `+${cleaned.slice(2)}`;
    }

    cleaned = `${cleaned.startsWith("+") ? "+" : ""}${cleaned.replace(/\+/g, "")}`;

    if (cleaned && !cleaned.startsWith("+")) {
        cleaned = `+${cleaned}`;
    }

    const digits = cleaned.replace(/\D/g, "").slice(0, 15);
    if (!digits) return cleaned.startsWith("+") ? "+" : "";

    const groups = digits.match(/.{1,3}/g) || [];
    return `+${groups.join(" ")}`;
};

const validateQrContact = ({ email, phone }) => {
    const normalizedEmail = email.trim().toLowerCase();
    const normalizedPhone = normalizePhone(phone);
    const phoneDigits = normalizedPhone.replace(/\D/g, "");
    const errors = {};

    if (normalizedEmail && !emailPattern.test(normalizedEmail)) {
        errors.email = "Entrez une adresse email valide, par exemple nom@domaine.com.";
    }

    if (normalizedPhone && (!normalizedPhone.startsWith("+") || phoneDigits.length < 8 || phoneDigits.length > 15)) {
        errors.phone = "Entrez le numéro au format international, par exemple +243 812 345 678.";
    }

    return errors;
};

const getCardDownloadUrl = (cardUrl) => {
    if (!cardUrl) return "";
    return apiUrl(cardUrl);
};

const templateIconMap = {
    "event-ticket": Ticket,
    "compact-ticket": Ticket,
    "staff-card": IdCard,
    "wedding-invite": Mail,
};

const templateAccentClasses = {
    blue: "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-900/60 dark:bg-blue-950/25 dark:text-blue-200",
    amber: "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/60 dark:bg-amber-950/25 dark:text-amber-200",
    emerald: "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/25 dark:text-emerald-200",
    teal: "border-teal-200 bg-teal-50 text-teal-700 dark:border-teal-900/60 dark:bg-teal-950/25 dark:text-teal-200",
    rose: "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/25 dark:text-rose-200",
    navy: "border-blue-200 bg-blue-50 text-[#080d5f] dark:border-blue-900/60 dark:bg-blue-950/25 dark:text-blue-200",
    violet: "border-violet-200 bg-violet-50 text-violet-700 dark:border-violet-900/60 dark:bg-violet-950/25 dark:text-violet-200",
    slate: "border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
};

function CardTemplatePreview({ template }) {
    const isQrOnly = !template;
    const isWide = template?.layout === "wide" || template?.layout === "compact";
    const accentClass = template ? templateAccentClasses[template.accent] || templateAccentClasses.slate : "border-slate-200 bg-slate-50 text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200";
    const customStyle = template?.accent === "custom" ? { borderColor: template.primaryColor, backgroundColor: template.secondaryColor, color: template.primaryColor } : undefined;

    return (
        <div className={`relative overflow-hidden rounded-xl border ${accentClass} ${isWide ? "aspect-[16/6]" : "aspect-[9/13]"}`} style={customStyle}>
            {isQrOnly ? (
                <div className="flex h-full items-center justify-center">
                    <div className="grid h-16 w-16 grid-cols-3 gap-1 rounded-lg bg-white p-2 shadow-sm dark:bg-slate-950">
                        {Array.from({ length: 9 }).map((_, index) => (
                            <span key={index} className={`rounded-sm ${index % 2 === 0 ? "bg-slate-900 dark:bg-slate-100" : "bg-slate-300 dark:bg-slate-600"}`} />
                        ))}
                    </div>
                </div>
            ) : (
                <>
                    <div className={`absolute left-0 top-0 ${isWide ? "h-full w-[30%]" : "h-[28%] w-full"} bg-current opacity-90`} />
                    <div className="absolute inset-3 flex flex-col justify-between">
                        <div className={isWide ? "ml-[34%]" : "mt-[34%]"}>
                            <div className="h-2.5 w-24 rounded-full bg-slate-900/80 dark:bg-white/80" />
                            <div className="mt-2 h-2 w-16 rounded-full bg-slate-500/40" />
                            <div className="mt-2 h-2 w-20 rounded-full bg-slate-500/25" />
                        </div>
                        <div className="flex items-end justify-between gap-3">
                            <div className="space-y-1.5">
                                <div className="h-2 w-14 rounded-full bg-slate-500/30" />
                                <div className="h-2 w-10 rounded-full bg-slate-500/20" />
                            </div>
                            <div className="grid h-12 w-12 grid-cols-3 gap-0.5 rounded-md bg-white p-1.5 shadow-sm dark:bg-slate-950">
                                {Array.from({ length: 9 }).map((_, index) => (
                                    <span key={index} className={`rounded-[2px] ${index % 2 === 0 ? "bg-slate-900 dark:bg-slate-100" : "bg-slate-300 dark:bg-slate-600"}`} />
                                ))}
                            </div>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}

export default function EventDetailPage() {
    const params = useParams();
    const router = useRouter();
    const eventId = params.id;

    const [event, setEvent] = useState(null);
    const [qrCodes, setQrCodes] = useState([]);
    const [qrListError, setQrListError] = useState("");
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    // Modal states
    const [showQrModal, setShowQrModal] = useState(false);
    const [showEditModal, setShowEditModal] = useState(false);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [deleteConfirmationText, setDeleteConfirmationText] = useState("");
    const [isDeleting, setIsDeleting] = useState(false);
    const [showImportModal, setShowImportModal] = useState(false);
    const [importFile, setImportFile] = useState(null);
    const [importing, setImporting] = useState(false);
    const [importError, setImportError] = useState("");
    const [importSuccess, setImportSuccess] = useState("");
    const [importReport, setImportReport] = useState(null);
    const [areas, setAreas] = useState([]);
    const [loadingAreas, setLoadingAreas] = useState(true);
    const [toast, setToast] = useState({ show: false, message: "" });

    const showToast = (message) => {
        setToast({ show: true, message });
        setTimeout(() => setToast({ show: false, message: "" }), 4000);
    };



    // QR Generation Form
    const [qrForm, setQrForm] = useState({
        fullName: "", email: "", phone: "",
        accessType: 'single', limit: "1",
        validFrom: "", validUntil: "", level: "1",
        cardMessage: ""
    });
    const [generatingQr, setGeneratingQr] = useState(false);
    const [qrError, setQrError] = useState("");
    const [qrContactTouched, setQrContactTouched] = useState({ email: false, phone: false });
    const [qrSubmitAttempted, setQrSubmitAttempted] = useState(false);

    // Edit Form
    const [editForm, setEditForm] = useState({
        title: "", description: "", areaIds: [], startDate: "", endDate: ""
    });
    const [updatingEvent, setUpdatingEvent] = useState(false);
    const [editError, setEditError] = useState("");

    // Filters and Actions State
    const [searchQuery, setSearchQuery] = useState("");
    const [statusFilter, setStatusFilter] = useState("Tous les statuts");
    const [qrPage, setQrPage] = useState(1);
    const [qrPagination, setQrPagination] = useState({ page: 1, pageSize: 25, total: 0, totalPages: 1 });
    const [selectedQr, setSelectedQr] = useState(null);
    const [qrToRevoke, setQrToRevoke] = useState(null);
    const [revokingId, setRevokingId] = useState(null);
    const [qrToRecharge, setQrToRecharge] = useState(null);
    const [rechargeAmount, setRechargeAmount] = useState("1");
    const [rechargeError, setRechargeError] = useState("");
    const [rechargingId, setRechargingId] = useState(null);
    const [generatedAsset, setGeneratedAsset] = useState(null);
    const [cardGeneratingId, setCardGeneratingId] = useState(null);
    const [exportingFormat, setExportingFormat] = useState("");
    const [downloadingCards, setDownloadingCards] = useState(false);
    const [downloadingTemplate, setDownloadingTemplate] = useState(false);
    const [cardTemplates, setCardTemplates] = useState([]);
    const [selectedCardTemplateId, setSelectedCardTemplateId] = useState("");
    const { userProfile, isFreePlan, planName, planLimits, hasCapability, refreshPlan } = useUserPlan();
    const canManageEvent = userProfile?.role === "ORG_ADMIN" || userProfile?.role === "SUPER_ADMIN";
    const canCreateQr = canManageEvent || userProfile?.role === "ORG_AGENT";
    const eventQrLimit = event?.entitlement_type === "EVENT_PASS" || planLimits?.maxQrCodesPerEvent == null
        ? event?.qr_limit ?? Number.MAX_SAFE_INTEGER
        : planLimits?.maxQrCodesPerEvent || planLimits?.maxQrCodes || 50;
    const issuedQrCount = event?._count?.qr_codes || 0;
    const qrQuota = {
        used: issuedQrCount,
        limit: eventQrLimit,
        remaining: Math.max(0, eventQrLimit - issuedQrCount),
        reached: issuedQrCount >= eventQrLimit
    };
    const qrQuotaReached = Boolean(qrQuota?.reached);
    const canImportQr = hasCapability("bulk_qr_import");
    const canExportScans = hasCapability("scan_exports");

    const selectedCardTemplate = useMemo(
        () => cardTemplates.find(template => template.templateId === selectedCardTemplateId) || null,
        [cardTemplates, selectedCardTemplateId]
    );

    const fetchAreas = useCallback(async () => {
        try {
            const res = await apiFetch("/areas", {
                method: "GET",
                headers: { "Content-Type": "application/json" }
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
    }, []);

    const fetchAll = useCallback(async () => {
        setLoading(true);
        setError("");
        setQrListError("");
        try {
            const params = new URLSearchParams({
                page: String(qrPage),
                pageSize: "25"
            });
            if (searchQuery.trim()) params.set("search", searchQuery.trim());
            if (statusFilter !== "Tous les statuts") params.set("status", statusFilter);
            const [eventRes, qrRes] = await Promise.all([
                apiFetch(`/events/${eventId}`),
                apiFetch(`/qr/event/${eventId}?${params.toString()}`)
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
            if (qrData.success) {
                setQrCodes(qrData.qrs || []);
                if (qrData.pagination) setQrPagination(qrData.pagination);
            } else {
                setQrCodes([]);
                setQrPagination({ page: 1, pageSize: 25, total: 0, totalPages: 1 });
                setQrListError(qrData.message || "Impossible de charger les QR de cet événement.");
            }
        } catch (err) {
            setError("Erreur de connexion au serveur.");
        } finally {
            setLoading(false);
        }
    }, [eventId, qrPage, searchQuery, statusFilter]);

    useEffect(() => {
        if (eventId) {
            const timer = setTimeout(fetchAll, 250);
            return () => clearTimeout(timer);
        }
    }, [eventId, fetchAll]);

    useEffect(() => {
        if (eventId) fetchAreas();
    }, [eventId, fetchAreas]);

    useEffect(() => {
        const fetchCreationTemplates = async () => {
            try {
                const cardRes = await apiFetch("/card-templates/custom");
                const cardData = await cardRes.json();

                if (cardData.success) {
                    const templates = (cardData.templates || []).filter(template => (template.status || "PUBLISHED") === "PUBLISHED");
                    setCardTemplates(templates);
                    setSelectedCardTemplateId(current => {
                        if (current && templates.some(template => template.templateId === current)) return current;
                        if (templates.some(template => template.templateId === cardData.defaultTemplateId)) return cardData.defaultTemplateId;
                        return templates[0]?.templateId || "";
                    });
                }
            } catch {
                setCardTemplates([]);
            }
        };

        fetchCreationTemplates();
    }, []);

    const openQrGenerationModal = () => {
        if (qrQuotaReached) {
            showToast(`Le quota de cet événement est atteint (${qrQuota.used}/${qrQuota.limit}).`);
            return;
        }
        setShowQrModal(true);
        setQrError("");
        setGeneratedAsset(null);
        if (event && event.EventSchedules && event.EventSchedules.length > 0) {
            const schedules = event.EventSchedules;
            setQrForm(prev => ({
                ...prev,
                validFrom: new Date(schedules[0].start_date).toISOString().slice(0, 16),
                validUntil: new Date(schedules[schedules.length - 1].end_date).toISOString().slice(0, 16)
            }));
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
            const res = await apiFetch(`/events/${eventId}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
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
        const expectedConfirmation = `je veux supprimer ${event.title}`;
        if (deleteConfirmationText.trim() !== expectedConfirmation) {
            showToast("Veuillez écrire exactement la phrase de confirmation.");
            return;
        }

        setIsDeleting(true);
        try {
            const res = await apiFetch(`/events/${eventId}`, {
                method: "DELETE"
            });
            const data = await res.json();
            if (data.success) {
                router.push("/dashboard/events");
            } else {
                showToast(data.message || "Erreur lors de la suppression.");
                setShowDeleteConfirm(false);
                setDeleteConfirmationText("");
            }
        } catch {
            showToast("Erreur de connexion au serveur.");
        } finally {
            setIsDeleting(false);
        }
    };

    const handleGenerateQr = async (e) => {
        e.preventDefault();
        setQrError("");
        setQrSubmitAttempted(true);
        if (qrQuotaReached) {
            setQrError(`Le quota de cet événement est atteint (${qrQuota.used}/${qrQuota.limit}).`);
            return;
        }
        const contactErrors = validateQrContact(qrForm);
        if (Object.keys(contactErrors).length > 0) {
            setQrError("Veuillez corriger les informations de contact avant de générer le QR Code.");
            return;
        }
        setGeneratingQr(true);
        const holderName = qrForm.fullName.trim();
        const payload = {
            ...qrForm,
            email: qrForm.email.trim().toLowerCase(),
            phone: normalizePhone(qrForm.phone),
            cardTemplateId: selectedCardTemplateId
        };
        try {
            const res = await apiFetch(`/qr/generate/${eventId}`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload)
            });
            const data = await res.json();
            if (data.success) {
                setGeneratedAsset({
                    qrUrl: data.qrUrl,
                    cardUrl: data.cardUrl || null,
                    cardPdfUrl: data.cardPdfUrl || null,
                    holder: holderName,
                    templateName: selectedCardTemplate?.name || "QR seul"
                });
                setQrForm({ ...qrForm, fullName: "", email: "", phone: "", level: "1", cardMessage: "" });
                setQrContactTouched({ email: false, phone: false });
                setQrSubmitAttempted(false);
                showToast(selectedCardTemplateId ? "QR Code et carte générés avec succès." : "QR Code généré avec succès.");
                setQrPage(1);
                await Promise.all([fetchAll(), refreshPlan()]);
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
        setRevokingId(id);
        try {
            const res = await apiFetch(`/qr/revoke/${id}`, {
                method: "PUT"
            });
            const data = await res.json();
            if (data.success) {
                setQrCodes(qrCodes.map(qr => qr.id === id ? { ...qr, status: 'revoked' } : qr));
                setQrToRevoke(null);
            } else {
                showToast(data.message || "Erreur lors de la révocation.");
            }
        } catch (err) {
            showToast("Erreur de connexion au serveur.");
        } finally {
            setRevokingId(null);
        }
    };

    const handleRestore = async (id) => {
        setRevokingId(id);
        try {
            const res = await apiFetch(`/qr/restore/${id}`, {
                method: "PUT"
            });
            const data = await res.json();
            if (data.success) {
                setQrCodes(qrCodes.map(qr => qr.id === id ? { ...qr, status: 'active' } : qr));
                showToast("QR Code restauré avec succès.");
            } else {
                showToast(data.message || "Erreur lors de la restauration.");
            }
        } catch (err) {
            showToast("Erreur de connexion au serveur.");
        } finally {
            setRevokingId(null);
        }
    };

    const openRechargeModal = (qr) => {
        setQrToRecharge(qr);
        setRechargeAmount("1");
        setRechargeError("");
    };

    const handleRecharge = async (event) => {
        event.preventDefault();
        if (!qrToRecharge) return;

        const amount = Number(rechargeAmount);
        if (!Number.isInteger(amount) || amount < 1 || amount > 1_000_000) {
            setRechargeError("Entrez un nombre entier compris entre 1 et 1 000 000.");
            return;
        }

        setRechargingId(qrToRecharge.id);
        setRechargeError("");
        try {
            const res = await apiFetch(`/qr/recharge/${qrToRecharge.id}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ amount })
            });
            const data = await res.json();
            if (!data.success) {
                setRechargeError(data.message || "Erreur lors de la recharge.");
                return;
            }

            setQrCodes(current => current.map(qr => qr.id === qrToRecharge.id
                ? { ...qr, ...data.qr }
                : qr));
            setQrToRecharge(null);
            showToast(data.message || "QR Code rechargé avec succès.");
        } catch {
            setRechargeError("Erreur de connexion au serveur.");
        } finally {
            setRechargingId(null);
        }
    };

    const handleGenerateCardForQr = async (qr) => {
        showToast("Les anciens modèles de cartes sont suspendus. Utilisez le module Modèles pour générer un PDF.");
    };

    const handleExport = async (format) => {
        if (format !== "csv") {
            const totalScanLogs = qrCodes.reduce((sum, qr) => sum + (qr.scans_count || 0), 0);
            if (totalScanLogs === 0) {
                showToast("Aucune donnée de scan n'est disponible pour cet événement.");
                return;
            }
        }
        if (format === "csv" && qrPagination.total === 0) {
            showToast("Aucune donnée de scan n'est disponible pour cet événement.");
            return;
        }
        setExportingFormat(format);
        try {
            const session = await refreshSession();
            if (!session.ok) return;
            window.open(apiUrl(`/export/${format}?event_id=${eventId}`), '_blank');
        } finally {
            setExportingFormat("");
        }
    };

    const handleDownloadTemplate = async () => {
        setDownloadingTemplate(true);
        try {
            const session = await refreshSession();
            if (!session.ok) return;
            window.open(apiUrl(`/qr/template/${eventId}`), '_blank');
        } finally {
            setDownloadingTemplate(false);
        }
    };

    const handleDownloadAllCards = async () => {
        if (qrPagination.total === 0) {
            showToast("Aucun QR n'est disponible pour cet événement.");
            return;
        }
        setDownloadingCards(true);
        try {
            const totalFiles = Math.ceil(qrPagination.total / 200);
            for (let file = 1; file <= totalFiles; file += 1) {
                const response = await apiFetch(`/qr/event/${eventId}/cards.pdf?file=${file}`);
                if (!response.ok) {
                    const data = await response.json().catch(() => ({}));
                    throw new Error(data.message || `Impossible de préparer la partie ${file}.`);
                }
                const blob = await response.blob();
                const disposition = response.headers.get("content-disposition") || "";
                const filename = disposition.match(/filename="([^"]+)"/)?.[1]
                    || `badges-evenement-${eventId}-partie-${file}.pdf`;
                const url = URL.createObjectURL(blob);
                const link = document.createElement("a");
                link.href = url;
                link.download = filename;
                document.body.appendChild(link);
                link.click();
                link.remove();
                URL.revokeObjectURL(url);
            }
            if (totalFiles > 1) showToast(`${totalFiles} PDF de 200 pages maximum ont été préparés.`);
        } catch (error) {
            showToast(error.message || "Impossible de télécharger les badges.");
        } finally {
            setDownloadingCards(false);
        }
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
        setImportReport(null);

        const formData = new FormData();
        formData.append("file", importFile);

        try {
            const res = await apiFetch(`/qr/import/${eventId}`, {
                method: "POST",
                body: formData
            });
            const data = await res.json();
            if (data.success) {
                setImportSuccess(data.message);
                setImportReport(data);
                setImportFile(null);
                setQrPage(1);
                await fetchAll();
                
                if (!data.partial) {
                    setTimeout(() => {
                        setShowImportModal(false);
                        setImportSuccess("");
                        setImportReport(null);
                    }, 2000);
                }
            } else {
                setImportError(data.message || "Erreur lors de l'importation.");
                setImportReport(data);
            }
        } catch (err) {
            setImportError("Erreur de connexion au serveur.");
        } finally {
            setImporting(false);
        }
    };



    const filteredQrs = qrCodes;

    const getStatusStyle = (status) => {
        if (status === 'active') return 'bg-emerald-100 text-emerald-700';
        if (status === 'used_up') return 'bg-amber-100 text-amber-700';
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

    const qrContactErrors = validateQrContact(qrForm);
    const showEmailError = (qrSubmitAttempted || qrContactTouched.email) && Boolean(qrContactErrors.email);
    const showPhoneError = (qrSubmitAttempted || qrContactTouched.phone) && Boolean(qrContactErrors.phone);

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
                <Link href="/dashboard/events" className="mt-6 inline-flex items-center gap-2 px-5 py-2.5 bg-slate-900 dark:bg-[#BED3C3] text-white rounded-xl font-medium text-sm hover:bg-slate-800 dark:hover:bg-[#AEC5B3] transition-colors">
                    <ArrowLeft className="w-4 h-4" /> Retour aux événements
                </Link>
            </div>
        );
    }

    const evtStatus = getEventStatus();
    const expectedDeleteConfirmation = `je veux supprimer ${event.title}`;
    const canDeleteEvent = deleteConfirmationText.trim() === expectedDeleteConfirmation;

    return (
        <div className="max-w-7xl mx-auto space-y-6">
            {/* Retour à la liste et actions sur l'événement */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <Link href="/dashboard/events" className="inline-flex items-center gap-2 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors text-sm font-medium">
                    <ArrowLeft className="w-4 h-4" /> Retour aux événements
                </Link>
                {canManageEvent && <div className="flex items-center gap-3">
                    <button
                        onClick={() => { setShowEditModal(true); setEditError(""); }}
                        className="inline-flex items-center gap-2 px-4 py-2 border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-700 dark:text-slate-200 rounded-xl text-sm font-medium hover:bg-slate-50 dark:hover:bg-slate-800 active:scale-95 transition-all shadow-sm"
                    >
                        <Edit2 className="w-4 h-4" /> Modifier
                    </button>
                    <button
                        onClick={() => {
                            setDeleteConfirmationText("");
                            setShowDeleteConfirm(true);
                        }}
                        className="inline-flex items-center gap-2 px-4 py-2 bg-red-50 text-red-600 border border-red-100 rounded-xl text-sm font-medium hover:bg-red-100 active:scale-95 transition-all shadow-sm"
                    >
                        <Trash2 className="w-4 h-4" /> Supprimer
                    </button>
                </div>}
            </div>

            {/* Résumé de l'événement et actions d'export */}
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
                                <span className="text-sm font-medium">{qrPagination.total} QR code{qrPagination.total !== 1 ? 's' : ''}</span>
                            </div>
                        </div>
                    </div>
                    <div className="flex gap-2 flex-shrink-0">
                        <button
                            onClick={() => handleExport('csv')}
                            disabled={exportingFormat === "csv" || !canExportScans}
                            className="inline-flex items-center justify-center p-2.5 border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-700 dark:text-slate-200 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 active:scale-95 transition-all shadow-sm"
                            title={!canExportScans ? "Disponible à partir du plan Essential" : "Exporter en CSV"}
                        >
                            {exportingFormat === "csv" ? <Loader2 className="w-5 h-5 animate-spin" /> : <Download className="w-5 h-5" />}
                        </button>
                        {canManageEvent && <>
                            <button
                                onClick={handleDownloadAllCards}
                                disabled={downloadingCards || qrPagination.total === 0}
                                className="inline-flex items-center justify-center p-2.5 border border-emerald-200 dark:border-emerald-900/60 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-200 rounded-xl hover:bg-emerald-100 dark:hover:bg-emerald-950/50 active:scale-95 transition-all shadow-sm disabled:cursor-not-allowed disabled:opacity-50"
                                title={qrPagination.total > 200 ? "Télécharger en plusieurs PDF de 200 pages" : "Télécharger tous les badges dans un PDF"}
                            >
                                {downloadingCards ? <Loader2 className="w-5 h-5 animate-spin" /> : <FileText className="w-5 h-5" />}
                            </button>
                            <button
                                onClick={handleDownloadTemplate}
                                disabled={downloadingTemplate || !canImportQr}
                                className="inline-flex items-center justify-center p-2.5 border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-700 dark:text-slate-200 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 active:scale-95 transition-all shadow-sm"
                                title={!canImportQr ? "Disponible à partir du plan Essential" : "Télécharger le modèle d'import CSV"}
                            >
                                {downloadingTemplate ? <Loader2 className="w-5 h-5 animate-spin" /> : <FileSpreadsheet className="w-5 h-5" />}
                            </button>
                            <button
                                onClick={() => {
                                    setShowImportModal(true);
                                    setImportError("");
                                    setImportSuccess("");
                                    setImportReport(null);
                                }}
                                disabled={!canImportQr}
                                className="inline-flex items-center justify-center p-2.5 border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-700 dark:text-slate-200 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 active:scale-95 transition-all shadow-sm disabled:opacity-60"
                                title={!canImportQr ? "Disponible à partir du plan Essential" : "Importer CSV"}
                            >
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"></path></svg>
                            </button>
                        </>}
                        {canCreateQr && <button
                            onClick={openQrGenerationModal}
                            disabled={qrQuotaReached}
                            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-xl shadow-sm hover:shadow active:scale-95 transition-all text-sm disabled:cursor-not-allowed disabled:opacity-50"
                            title={qrQuotaReached ? "Quota de QR atteint" : "Générer un QR"}
                        >
                            <Plus className="w-5 h-5" /> Générer un QR
                        </button>}

                    </div>

                </div>
                <PlanQuotaStatus label="QR émis pour cet événement" quota={qrQuota} className="mt-6" />
                {isFreePlan && (
                    <div className="mt-6 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/20 dark:text-amber-200">
                        <span className="font-semibold">Plan {planName || "Découverte"}</span> · Passez à Essential ou Pro pour profiter des imports CSV et des exports.
                    </div>
                )}
                {(exportingFormat || downloadingTemplate) && (
                    <LoadingBar
                        label={downloadingTemplate ? "Préparation du modèle CSV" : `Préparation export ${exportingFormat.toUpperCase()}`}
                        className="mt-6"
                    />
                )}
            </div>

            {/* Gestion des codes QR de l'événement */}
            
            <div className="bg-white dark:bg-slate-950 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
                    <h2 className="text-lg font-bold text-slate-900 dark:text-white">Codes QR de cet événement</h2>
                    <span className="text-sm text-slate-500 dark:text-slate-400">{qrPagination.total} total</span>
                </div>

                {/* Recherche et filtres des codes QR */}
                <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/60 flex flex-col md:flex-row gap-4 items-center justify-between">
                    <div className="relative w-full md:w-96">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <svg className="h-5 w-5 text-slate-400 dark:text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                            </svg>
                        </div>
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => {
                                setSearchQuery(e.target.value);
                                setQrPage(1);
                            }}
                            placeholder="Rechercher par ID, Nom..."
                            className="block w-full pl-10 pr-3 py-2 border border-slate-200 dark:border-slate-700 rounded-xl leading-5 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 sm:text-sm transition-colors shadow-sm"
                        />
                    </div>

                    <div className="flex gap-2 w-full md:w-auto overflow-x-auto pb-1 md:pb-0">
                        <select value={statusFilter} onChange={(e) => {
                            setStatusFilter(e.target.value);
                            setQrPage(1);
                        }} className="px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-950 text-sm text-slate-700 dark:text-slate-200 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500">
                            <option value="Tous les statuts">Tous les statuts</option>
                            <option value="active">Actif</option>
                            <option value="used_up">Épuisé</option>
                            <option value="expired">Expiré</option>
                            <option value="revoked">Révoqué</option>
                        </select>
                    </div>
                </div>

                {qrListError && (
                    <div className="border-b border-red-200 bg-red-50 px-6 py-3 text-sm font-medium text-red-700 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-300">
                        {qrListError}
                    </div>
                )}

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
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-700 dark:text-slate-200 text-sm">
                            {filteredQrs.length === 0 && !qrListError ? (
                                <tr>
                                    <td colSpan="7" className="px-6 py-14 text-center">
                                        <div className="w-14 h-14 bg-slate-100 dark:bg-slate-800 text-slate-300 rounded-2xl flex items-center justify-center mx-auto mb-3">
                                            <QrCode className="w-7 h-7" />
                                        </div>
                                        <h3 className="text-base font-semibold text-slate-900 dark:text-white">Aucun QR code</h3>
                                        <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">{qrPagination.total === 0 && !searchQuery && statusFilter === "Tous les statuts" ? "Générez votre premier code QR pour cet événement." : "Aucun QR Code trouvé pour ces critères."}</p>
                                        {canCreateQr && <button
                                            onClick={openQrGenerationModal}
                                            disabled={qrQuotaReached}
                                            title={qrQuotaReached ? "Quota de QR atteint" : "Générer un QR"}
                                            className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-xl text-sm font-medium hover:bg-blue-700 transition-colors disabled:cursor-not-allowed disabled:opacity-50"
                                        >
                                            <Plus className="w-4 h-4" /> Générer un QR
                                        </button>}
                                    </td>
                                </tr>
                            ) : qrListError ? (
                                <tr>
                                    <td colSpan="7" className="px-6 py-10 text-center text-sm text-red-600 dark:text-red-300">
                                        La liste des QR n’a pas pu être chargée.
                                    </td>
                                </tr>
                            ) : (
                                filteredQrs.map((qr) => (
                                    <tr key={qr.id} className="table-row-hover group">
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
                                                {qr.status === "used_up" ? "Épuisé" : qr.status.charAt(0).toUpperCase() + qr.status.slice(1)}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-slate-500 dark:text-slate-400">{qr.createdAt}</td>
                                        <td className="px-6 py-4 text-right">
                                            <div className="flex items-center justify-end gap-2">
                                                <button onClick={() => setSelectedQr(qr)} className="p-1.5 table-action-neutral border rounded-lg transition-colors" title="Voir Ticket">
                                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"></path></svg>
                                                </button>
                                                <a
                                                    href={`${apiUrl(qr.qrUrl || `/qr/image/${qr.id}`)}?download=1`}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="p-1.5 text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 table-action-soft-hover rounded-lg transition-colors inline-block"
                                                    title="Télécharger le QR"
                                                >
                                                    <Download className="w-5 h-5" />
                                                </a>
                                                    {(qr.cardPdfUrl || qr.cardUrl) ? (
                                                    <a
                                                        href={getCardDownloadUrl(qr.cardPdfUrl || qr.cardUrl)}
                                                        download
                                                        className="p-1.5 text-emerald-600 dark:text-emerald-300 bg-white dark:bg-slate-900 border border-emerald-100 dark:border-emerald-900/50 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 rounded-lg transition-colors inline-block"
                                                        title={qr.cardPdfUrl ? "Télécharger l'invitation PDF" : "Télécharger l'invitation"}
                                                    >
                                                        {qr.cardPdfUrl ? <FileText className="w-5 h-5" /> : <FileSpreadsheet className="w-5 h-5" />}
                                                    </a>
                                                ) : canManageEvent ? (
                                                    <button
                                                        onClick={() => handleGenerateCardForQr(qr)}
                                                        disabled={cardGeneratingId === qr.id}
                                                        className="p-1.5 text-violet-600 dark:text-violet-300 bg-white dark:bg-slate-900 border border-violet-100 dark:border-violet-900/50 hover:bg-violet-50 dark:hover:bg-violet-950/40 rounded-lg transition-colors disabled:opacity-50"
                                                        title="Générer une carte"
                                                    >
                                                        {cardGeneratingId === qr.id ? <Loader2 className="w-5 h-5 animate-spin" /> : <FileSpreadsheet className="w-5 h-5" />}
                                                    </button>
                                                ) : null}
                                                {canManageEvent && qr.usage_limit > 0 && qr.status !== 'expired' && qr.status !== 'revoked' ? (
                                                    <button
                                                        onClick={() => openRechargeModal(qr)}
                                                        disabled={rechargingId === qr.id}
                                                        className="p-1.5 text-blue-600 dark:text-blue-300 bg-white dark:bg-slate-900 border border-blue-100 dark:border-blue-900/50 hover:bg-blue-50 dark:hover:bg-blue-950/40 rounded-lg transition-colors disabled:opacity-50"
                                                        title="Recharger les passages"
                                                    >
                                                        {rechargingId === qr.id ? <Loader2 className="w-5 h-5 animate-spin" /> : <Plus className="w-5 h-5" />}
                                                    </button>
                                                ) : null}
                                                {canManageEvent && qr.status === 'active' ? (
                                                    <button onClick={() => setQrToRevoke(qr)} disabled={revokingId === qr.id} className="p-1.5 text-red-600 dark:text-red-300 bg-white dark:bg-slate-900 border border-red-100 dark:border-red-900/50 hover:bg-red-50 dark:hover:bg-red-950/40 rounded-lg transition-colors disabled:opacity-50" title="Révoquer Accès">
                                                        {revokingId === qr.id ? <Loader2 className="w-5 h-5 animate-spin" /> : <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636"></path></svg>}
                                                    </button>
                                                ) : null}
                                                {canManageEvent && qr.status === 'revoked' ? (
                                                    <button onClick={() => handleRestore(qr.id)} disabled={revokingId === qr.id} className="p-1.5 text-emerald-600 dark:text-emerald-300 bg-white dark:bg-slate-900 border border-emerald-100 dark:border-emerald-900/50 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 rounded-lg transition-colors disabled:opacity-50" title="Restaurer Accès">
                                                        {revokingId === qr.id ? <Loader2 className="w-5 h-5 animate-spin" /> : <CheckCircle2 className="w-5 h-5" />}
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
                {qrPagination.totalPages > 1 && (
                    <div className="flex items-center justify-between border-t border-slate-100 px-6 py-4 dark:border-slate-800">
                        <span className="text-sm text-slate-500">
                            Page {qrPagination.page} sur {qrPagination.totalPages}
                        </span>
                        <div className="flex gap-2">
                            <button
                                type="button"
                                disabled={qrPagination.page <= 1}
                                onClick={() => setQrPage(page => Math.max(1, page - 1))}
                                className="rounded-lg border px-3 py-2 text-sm disabled:opacity-40"
                            >
                                Précédent
                            </button>
                            <button
                                type="button"
                                disabled={qrPagination.page >= qrPagination.totalPages}
                                onClick={() => setQrPage(page => Math.min(qrPagination.totalPages, page + 1))}
                                className="rounded-lg border px-3 py-2 text-sm disabled:opacity-40"
                            >
                                Suivant
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* Formulaire de génération d'un code QR */}
            {showQrModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm overflow-y-auto">
                    <div className="bg-white dark:bg-slate-950 w-full max-w-3xl rounded-3xl shadow-2xl relative my-8 overflow-hidden text-slate-900 dark:text-slate-100">
                        <button
                            onClick={() => {
                                setShowQrModal(false);
                                setQrError("");
                                setQrSubmitAttempted(false);
                            }}
                            className="absolute top-5 right-5 z-10 p-2 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-900 rounded-xl transition-colors"
                        >
                            <X className="w-5 h-5" />
                        </button>

                        <div className="border-b border-slate-100 dark:border-slate-800 px-6 py-5 sm:px-8">
                            <div className="flex items-start gap-4 pr-10">
                                <div className="flex h-11 w-11 flex-none items-center justify-center rounded-2xl bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-300">
                                    <QrCode className="h-5 w-5" />
                                </div>
                                <div className="min-w-0">
                                    <h2 className="text-xl font-bold text-slate-900 dark:text-white">Générer un QR Code</h2>
                                    <p className="mt-1 truncate text-sm text-slate-600 dark:text-slate-300">
                                        Événement : <span className="font-semibold text-slate-900 dark:text-white">{event.title}</span>
                                    </p>
                                </div>
                            </div>
                        </div>

                        <form onSubmit={handleGenerateQr}>
                            <div className="max-h-[72vh] overflow-y-auto px-6 py-6 sm:px-8">
                                {generatingQr && (
                                    <LoadingBar label="Génération du QR" className="mb-5" />
                                )}
                                {qrError && (
                                    <div className="mb-5 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-700 animate-in fade-in zoom-in duration-300 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-200">{qrError}</div>
                                )}

                                {generatedAsset && (
                                    <div className="mb-5 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-900/60 dark:bg-emerald-950/25">
                                        <div className="flex items-start gap-3">
                                            <div className="flex h-10 w-10 flex-none items-center justify-center rounded-xl bg-emerald-100 text-emerald-700 dark:bg-emerald-900/60 dark:text-emerald-200">
                                                <CheckCircle2 className="h-5 w-5" />
                                            </div>
                                            <div className="min-w-0 flex-1">
                                                <h3 className="text-sm font-bold text-emerald-900 dark:text-emerald-100">Support généré</h3>
                                                <p className="mt-1 text-xs text-emerald-800 dark:text-emerald-200">
                                                    {generatedAsset.holder} - {generatedAsset.templateName}
                                                </p>
                                                <div className="mt-3 flex flex-wrap gap-2">
                                                    <a
                                                        href={`${apiUrl(generatedAsset.qrUrl)}?download=1`}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="inline-flex items-center gap-1.5 rounded-lg bg-white px-3 py-2 text-xs font-bold text-slate-700 shadow-sm ring-1 ring-emerald-200 transition-colors hover:bg-emerald-100 dark:bg-slate-950 dark:text-slate-100 dark:ring-emerald-900/60 dark:hover:bg-emerald-950/40"
                                                    >
                                                        <Download className="h-3.5 w-3.5" />
                                                        Télécharger QR
                                                    </a>
                                                    {(generatedAsset.cardPdfUrl || generatedAsset.cardUrl) && (
                                                        <a
                                                            href={getCardDownloadUrl(generatedAsset.cardPdfUrl || generatedAsset.cardUrl)}
                                                            download
                                                            className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-700 px-3 py-2 text-xs font-bold text-white shadow-sm transition-colors hover:bg-emerald-800"
                                                        >
                                                            <FileText className="h-3.5 w-3.5" />
                                                            Télécharger PDF
                                                        </a>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                <div className="space-y-5">
                                    {/* Identité et coordonnées du détenteur */}
                                    <section className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-950">
                                        <div className="mb-4 flex items-center justify-between gap-4">
                                            <div>
                                                <h3 className="text-sm font-bold text-slate-900 dark:text-white">Titulaire</h3>
                                                <p className="text-xs text-slate-600 dark:text-slate-300">Identité et contact du détenteur </p>
                                            </div>
                                        </div>

                                        <div className="space-y-4">
                                            <div className="space-y-2">
                                                <label className="text-sm font-semibold text-slate-800 dark:text-slate-100">Nom complet *</label>
                                        <input
                                            required
                                            type="text"
                                                    placeholder="Ex. Jane Smith"
                                            value={qrForm.fullName}
                                            onChange={(e) => setQrForm({ ...qrForm, fullName: e.target.value })}
                                                    className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-500 dark:placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:bg-white dark:focus:bg-slate-950 transition-all"
                                        />
                                            </div>

                                            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                                                <div className="space-y-2">
                                                    <label className="text-sm font-semibold text-slate-800 dark:text-slate-100">Email</label>
                                            <div className="relative">
                                                        <Mail className={`absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 ${showEmailError ? "text-red-500" : "text-slate-500 dark:text-slate-400"}`} />
                                                <input
                                                    type="email"
                                                    inputMode="email"
                                                    autoComplete="email"
                                                    placeholder="nom@domaine.com"
                                                    value={qrForm.email}
                                                    aria-invalid={showEmailError}
                                                    onBlur={() => setQrContactTouched({ ...qrContactTouched, email: true })}
                                                    onChange={(e) => {
                                                        setQrError("");
                                                        setQrForm({ ...qrForm, email: e.target.value });
                                                    }}
                                                            className={`w-full pl-10 pr-4 py-3 bg-slate-50 dark:bg-slate-900 border rounded-xl text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-500 dark:placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:bg-white dark:focus:bg-slate-950 transition-all ${showEmailError ? "border-red-300 focus:ring-red-500/20" : "border-slate-200 dark:border-slate-800 focus:ring-blue-500/20"}`}
                                                />
                                            </div>
                                                    <p className={`text-xs leading-relaxed ${showEmailError ? "text-red-600 dark:text-red-300" : "text-slate-600 dark:text-slate-300"}`}>
                                                {showEmailError ? qrContactErrors.email : "Optionnel."}
                                            </p>
                                                </div>

                                                <div className="space-y-2">
                                                    <label className="text-sm font-semibold text-slate-800 dark:text-slate-100">Numéro de téléphone</label>
                                            <div className="relative">
                                                        <Phone className={`absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 ${showPhoneError ? "text-red-500" : "text-slate-500 dark:text-slate-400"}`} />
                                                <input
                                                    type="tel"
                                                    inputMode="tel"
                                                    autoComplete="tel"
                                                    placeholder="+243 812 345 678"
                                                    value={qrForm.phone}
                                                    aria-invalid={showPhoneError}
                                                    onBlur={() => setQrContactTouched({ ...qrContactTouched, phone: true })}
                                                    onChange={(e) => {
                                                        setQrError("");
                                                        setQrForm({ ...qrForm, phone: formatInternationalPhone(e.target.value) });
                                                    }}
                                                            className={`w-full pl-10 pr-4 py-3 bg-slate-50 dark:bg-slate-900 border rounded-xl text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-500 dark:placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:bg-white dark:focus:bg-slate-950 transition-all ${showPhoneError ? "border-red-300 focus:ring-red-500/20" : "border-slate-200 dark:border-slate-800 focus:ring-blue-500/20"}`}
                                                />
                                            </div>
                                                    <p className={`text-xs leading-relaxed ${showPhoneError ? "text-red-600 dark:text-red-300" : "text-slate-600 dark:text-slate-300"}`}>
                                                {showPhoneError ? qrContactErrors.phone : "Optionnel."}
                                            </p>
                                                </div>
                                            </div>
                                        </div>
                                    </section>

                                    {/* Choix et personnalisation du modèle de carte */}
                                    <section className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-950">
                                        <div className="mb-4">
                                            <h3 className="text-sm font-bold text-slate-900 dark:text-white">Accès</h3>
                                            <p className="text-xs text-slate-600 dark:text-slate-300">Définissez le niveau, le nombre d'utilisations et le support généré.</p>
                                        </div>

                                        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[180px_minmax(0,1fr)]">
                                            <div className="space-y-2">
                                                <label className="text-sm font-semibold text-slate-800 dark:text-slate-100">Niveau</label>
                                    <input
                                        type="number"
                                        min="1"
                                        value={qrForm.level}
                                        onChange={(e) => setQrForm({ ...qrForm, level: e.target.value })}
                                                    className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:bg-white dark:focus:bg-slate-950 transition-all"
                                    />
                                            </div>

                                            <div className="space-y-2">
                                                <label className="text-sm font-semibold text-slate-800 dark:text-slate-100">Type d'accès</label>
                                                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                                        {[
                                            { value: 'single', label: 'Simple', desc: '1 scan' },
                                            { value: 'multi', label: 'Multiple', desc: 'N scans' },
                                            { value: 'unlimited', label: 'Illimité', desc: '∞ scans' }
                                        ].map(({ value, label, desc }) => (
                                            <button
                                                key={value}
                                                type="button"
                                                onClick={() => setQrForm({ ...qrForm, accessType: value, limit: value === 'single' ? "1" : value === 'unlimited' ? "0" : (qrForm.limit == "1" ? "2" : qrForm.limit) })}
                                                            className={`px-3 py-3 rounded-xl border text-left transition-all ${qrForm.accessType === value ? 'bg-blue-50 border-blue-200 text-blue-700 shadow-sm dark:bg-blue-950/35 dark:border-blue-800 dark:text-blue-200' : 'bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-200 hover:border-[#7A90A4] dark:hover:border-[#7A90A4]'}`}
                                            >
                                                <div className="text-sm font-bold">{label}</div>
                                                            <div className="text-[10px] opacity-80 font-medium">{desc}</div>
                                            </button>
                                        ))}
                                                </div>
                                    </div>
                                </div>

                                        <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
                                            {qrForm.accessType === 'multi' && (
                                                <div className="space-y-2 animate-in fade-in slide-in-from-top-2 duration-300">
                                                    <label className="text-sm font-semibold text-slate-800 dark:text-slate-100">Nombre de scans</label>
                                                    <input
                                                        type="number"
                                                        min="2"
                                                        value={qrForm.limit}
                                                        onChange={(e) => setQrForm({ ...qrForm, limit: e.target.value })}
                                                        className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:bg-white dark:focus:bg-slate-950 transition-all"
                                                    />
                                                </div>
                                            )}

                                            <div className="space-y-2">
                                                <label className="text-sm font-semibold text-slate-800 dark:text-slate-100">Modèle de carte</label>
                                                <select
                                                    value={selectedCardTemplateId}
                                                    onChange={(e) => setSelectedCardTemplateId(e.target.value)}
                                                    className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:bg-white dark:focus:bg-slate-950 transition-all"
                                                >
                                                    <option value="">QR seul, sans carte</option>
                                                    {cardTemplates.map(template => (
                                                        <option key={template.templateId} value={template.templateId}>
                                                            {template.name}{template.isDefault ? " — par défaut" : ""}
                                                        </option>
                                                    ))}
                                                </select>
                                                <p className="text-xs leading-relaxed text-slate-600 dark:text-slate-300">
                                                    {cardTemplates.length > 0
                                                        ? "La carte personnalisée sera générée avec le QR et les informations du titulaire."
                                                        : "Aucun modèle personnalisé disponible. Créez-en un dans le module Modèles."}
                                                </p>
                                            </div>

                                        </div>

                                    

                                        <div className="mt-4 flex items-start gap-2 rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs leading-relaxed text-slate-700 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200">
                                            <FileSpreadsheet className="mt-0.5 h-4 w-4 flex-none text-[#7A90A4]" />
                                            <p>Choisissez un modèle de carte. Le modèle défini par défaut est présélectionné automatiquement.</p>
                                        </div>
                                    </section>

                                    {/* Limites d'utilisation et niveau d'accréditation */}
                                    <section className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-950">
                                        <div className="mb-4">
                                            <h3 className="text-sm font-bold text-slate-900 dark:text-white">Validité</h3>
                                            <p className="text-xs text-slate-600 dark:text-slate-300">Les dates sont préremplies depuis l'événement</p>
                                        </div>
                                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                                            <div className="space-y-2">
                                                <label className="text-sm font-semibold text-slate-800 dark:text-slate-100">Valide du</label>
                                        <input
                                            type="datetime-local"
                                            value={qrForm.validFrom}
                                            onChange={(e) => setQrForm({ ...qrForm, validFrom: e.target.value })}
                                                    className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:bg-white dark:focus:bg-slate-950 transition-all"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                                <label className="text-sm font-semibold text-slate-800 dark:text-slate-100">Valide jusqu'au</label>
                                        <input
                                            type="datetime-local"
                                            value={qrForm.validUntil}
                                            onChange={(e) => setQrForm({ ...qrForm, validUntil: e.target.value })}
                                                    className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:bg-white dark:focus:bg-slate-950 transition-all"
                                        />
                                            </div>
                                        </div>
                                    </section>
                                    </div>
                                </div>

                            <div className="border-t border-slate-100 bg-slate-50 px-6 py-4 dark:border-slate-800 dark:bg-slate-900/60 sm:px-8">
                                <button
                                    type="submit"
                                    disabled={generatingQr || qrQuotaReached}
                                    className="w-full py-4 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-2xl shadow-lg shadow-blue-600/20 active:scale-95 transition-all flex items-center justify-center gap-3 disabled:opacity-60"
                                >
                                    {generatingQr ? <Loader2 className="w-5 h-5 animate-spin" /> : <QrCode className="w-5 h-5" />}
                                    {generatingQr ? "Génération en cours..." : "Générer & Sauvegarder"}
                                </button>
                            </div>
                            </form>
                    </div>
                </div>
            )}

            {/* Aperçu et téléchargement du support généré */}
            {selectedQr && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
                    <div className="bg-white dark:bg-slate-950 w-full max-w-sm rounded-3xl shadow-2xl p-6 relative overflow-hidden text-center animate-in zoom-in duration-300">
                        <button onClick={() => setSelectedQr(null)} className="absolute top-4 right-4 p-2 hover:bg-slate-100 dark:hover:bg-slate-900 rounded-xl transition-colors">
                            <X className="w-5 h-5 text-slate-600 dark:text-slate-300" />
                        </button>
                        <h3 className="text-sm font-bold text-slate-600 dark:text-slate-300 uppercase tracking-widest mb-6">Détails du Ticket</h3>

                        <div className="w-full flex flex-col items-center">
                            <img src={apiUrl(selectedQr.qrUrl || `/qr/image/${selectedQr.id}`)} alt="QR Code" className="w-48 h-48 rounded-2xl border border-slate-100 dark:border-slate-800 p-2 shadow-inner bg-slate-50 dark:bg-slate-900 mb-6 object-contain" />

                            <div className="w-full space-y-4 text-left bg-slate-50 dark:bg-slate-900 p-4 rounded-2xl border border-slate-100 dark:border-slate-800">
                                <div>
                                    <p className="text-[10px] font-bold text-slate-600 dark:text-slate-300 uppercase tracking-tighter">Titulaire</p>
                                    <p className="text-sm font-black text-slate-900 dark:text-white truncate">{selectedQr.holder}</p>
                                </div>
                                <div>
                                    <p className="text-[10px] font-bold text-slate-600 dark:text-slate-300 uppercase tracking-tighter">Événement</p>
                                    <p className="text-sm font-bold text-slate-700 dark:text-slate-200">{event.title}</p>
                                </div>
                                <div className="flex justify-between items-end">
                                    <div>
                                        <p className="text-[10px] font-bold text-slate-600 dark:text-slate-300 uppercase tracking-tighter">Statut</p>
                                        <p className={`text-xs font-bold capitalize ${selectedQr.status === 'active' ? 'text-emerald-600' : selectedQr.status === 'revoked' ? 'text-red-600' : 'text-slate-600 dark:text-slate-300'}`}>
                                            {selectedQr.status}
                                        </p>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-[10px] font-bold text-slate-600 dark:text-slate-300 uppercase tracking-tighter">Scans</p>
                                        <p className="text-xs font-bold text-slate-700 dark:text-slate-200">{selectedQr.scans}</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Recharge d'un QR limité */}
            {qrToRecharge && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
                    <form onSubmit={handleRecharge} className="bg-white dark:bg-slate-950 w-full max-w-md rounded-2xl shadow-2xl p-6 animate-in zoom-in duration-300">
                        {rechargingId === qrToRecharge.id && (
                            <LoadingBar label="Recharge en cours" className="mb-5" />
                        )}
                        <div className="w-12 h-12 bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-300 rounded-2xl flex items-center justify-center mb-4">
                            <Plus className="w-6 h-6" />
                        </div>
                        <h3 className="text-lg font-bold text-slate-900 dark:text-white">Recharger ce QR code</h3>
                        <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
                            Ajoutez des passages au QR de <span className="font-semibold text-slate-700 dark:text-slate-200">{qrToRecharge.holder}</span>. Les {qrToRecharge.scans_count} passages déjà consommés et leur historique seront conservés.
                        </p>

                        <label className="block mt-5">
                            <span className="text-sm font-semibold text-slate-800 dark:text-slate-100">Passages à ajouter</span>
                            <input
                                type="number"
                                min="1"
                                max="1000000"
                                step="1"
                                required
                                autoFocus
                                value={rechargeAmount}
                                onChange={(event) => setRechargeAmount(event.target.value)}
                                disabled={rechargingId === qrToRecharge.id}
                                className="mt-2 w-full px-4 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 disabled:opacity-60"
                            />
                        </label>

                        <div className="mt-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 p-4 flex items-center justify-between">
                            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">Utilisations actuelles</span>
                            <span className="font-semibold text-slate-900 dark:text-white">{qrToRecharge.scans}</span>
                        </div>

                        {rechargeError && (
                            <p className="mt-3 text-sm font-medium text-red-600 dark:text-red-300">{rechargeError}</p>
                        )}

                        <div className="mt-6 flex gap-3">
                            <button
                                type="button"
                                onClick={() => setQrToRecharge(null)}
                                disabled={rechargingId === qrToRecharge.id}
                                className="flex-1 py-2.5 border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-700 dark:text-slate-200 rounded-xl font-medium text-sm hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors disabled:opacity-60"
                            >
                                Annuler
                            </button>
                            <button
                                type="submit"
                                disabled={rechargingId === qrToRecharge.id}
                                className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-medium text-sm transition-colors flex items-center justify-center gap-2 disabled:opacity-60"
                            >
                                {rechargingId === qrToRecharge.id && <Loader2 className="w-4 h-4 animate-spin" />}
                                Recharger
                            </button>
                        </div>
                    </form>
                </div>
            )}

            {/* Confirmation de révocation d'un code QR */}
            {qrToRevoke && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
                    <div className="bg-white dark:bg-slate-950 w-full max-w-md rounded-2xl shadow-2xl p-6 animate-in zoom-in duration-300">
                        {revokingId === qrToRevoke.id && (
                            <LoadingBar label="Révocation en cours" className="mb-5" />
                        )}
                        <div className="w-12 h-12 bg-red-50 text-red-600 rounded-2xl flex items-center justify-center mb-4">
                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636"></path></svg>
                        </div>
                        <h3 className="text-lg font-bold text-slate-900 dark:text-white">Révoquer ce QR code ?</h3>
                        <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
                            Le QR code de <span className="font-semibold text-slate-700 dark:text-slate-200">{qrToRevoke.holder}</span> ne pourra plus être utilisé pour accéder à <span className="font-semibold text-slate-700 dark:text-slate-200">"{event.title}"</span>.
                        </p>
                        <div className="mt-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 p-4">
                            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">QR ID</p>
                            <p className="font-semibold text-slate-900 dark:text-white">#{qrToRevoke.id}</p>
                        </div>
                        <div className="mt-6 flex gap-3">
                            <button
                                type="button"
                                onClick={() => setQrToRevoke(null)}
                                disabled={revokingId === qrToRevoke.id}
                                className="flex-1 py-2.5 border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-700 dark:text-slate-200 rounded-xl font-medium text-sm hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors disabled:opacity-60"
                            >
                                Annuler
                            </button>
                            <button
                                type="button"
                                onClick={() => handleRevoke(qrToRevoke.id)}
                                disabled={revokingId === qrToRevoke.id}
                                className="flex-1 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl font-medium text-sm transition-colors flex items-center justify-center gap-2 disabled:opacity-60"
                            >
                                {revokingId === qrToRevoke.id && <Loader2 className="w-4 h-4 animate-spin" />}
                                Révoquer
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Formulaire de modification de l'événement */}
            {showEditModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
                    <div className="bg-white dark:bg-slate-950 w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden">
                        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800">
                            <h2 className="text-lg font-bold text-slate-900 dark:text-white">Modifier l'événement</h2>
                            <button onClick={() => setShowEditModal(false)} className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-900 rounded-lg transition-colors">
                                <X className="w-5 h-5 text-slate-600 dark:text-slate-300" />
                            </button>
                        </div>
                        <form onSubmit={handleUpdateEvent} className="p-6 space-y-4">
                            {updatingEvent && (
                                <LoadingBar label="Mise à jour de l'événement" />
                            )}
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
                                    className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-900 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:bg-white dark:focus:bg-slate-950 transition-all"
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
                                        className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-900 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:bg-white dark:focus:bg-slate-950 transition-all text-slate-600 dark:text-slate-300"
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Date de fin</label>
                                    <input
                                        type="datetime-local"
                                        value={editForm.endDate}
                                        onChange={(e) => setEditForm({ ...editForm, endDate: e.target.value })}
                                        className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-900 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:bg-white dark:focus:bg-slate-950 transition-all text-slate-600 dark:text-slate-300"
                                    />
                                </div>
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Description</label>
                                <textarea
                                    rows="3"
                                    value={editForm.description}
                                    onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                                    className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-900 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:bg-white dark:focus:bg-slate-950 transition-all resize-none"
                                />
                            </div>
                            <button
                                type="submit"
                                disabled={updatingEvent}
                                className="w-full py-3 bg-slate-900 text-white hover:bg-black dark:bg-[#BED3C3] dark:text-slate-900 dark:hover:bg-[#AEC5B3] font-semibold rounded-xl shadow-sm active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-60"
                            >
                                {updatingEvent ? <Loader2 className="w-5 h-5 animate-spin" /> : <Edit2 className="w-5 h-5" />}
                                {updatingEvent ? "Mise à jour..." : "Enregistrer les modifications"}
                            </button>
                        </form>
                    </div>
                </div>
            )}

            {/* Confirmation de suppression de l'événement */}
            {showDeleteConfirm && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
                    <div className="bg-white dark:bg-slate-950 w-full max-w-sm rounded-2xl shadow-2xl p-6 text-center">
                        {isDeleting && (
                            <LoadingBar label="Suppression en cours" className="mb-5 text-left" />
                        )}
                        <div className="w-14 h-14 bg-red-50 text-red-500 rounded-2xl flex items-center justify-center mx-auto mb-4">
                            <Trash2 className="w-7 h-7" />
                        </div>
                        <h2 className="text-lg font-bold text-slate-900 dark:text-white">Supprimer l'événement ?</h2>
                        <p className="text-slate-500 dark:text-slate-400 text-sm mt-2 mb-6">
                            Cette action supprimera définitivement <span className="font-semibold text-slate-700 dark:text-slate-200">"{event.title}"</span> et tous ses codes QR associés.
                        </p>
                        <div className="text-left mb-6 space-y-2">
                            <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                                Phrase de confirmation
                            </label>
                            <p className="text-xs text-slate-500 dark:text-slate-400">
                                Écrivez exactement <span className="font-semibold text-slate-700 dark:text-slate-200">"{expectedDeleteConfirmation}"</span>
                            </p>
                            <input
                                type="text"
                                value={deleteConfirmationText}
                                onChange={(e) => setDeleteConfirmationText(e.target.value)}
                                className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500 transition-all"
                                autoComplete="off"
                            />
                        </div>
                        <div className="flex gap-3">
                            <button
                                onClick={() => {
                                    setShowDeleteConfirm(false);
                                    setDeleteConfirmationText("");
                                }}
                                className="flex-1 py-2.5 border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-700 dark:text-slate-200 rounded-xl font-medium text-sm hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                            >
                                Annuler
                            </button>
                            <button
                                onClick={handleDeleteEvent}
                                disabled={isDeleting || !canDeleteEvent}
                                className="flex-1 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl font-medium text-sm transition-colors flex items-center justify-center gap-2 disabled:opacity-60"
                            >
                                {isDeleting ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                                {isDeleting ? "Suppression..." : "Confirmer"}
                            </button>
                        </div>
                    </div>
                </div>
            )}
            {/* Formulaire d'import des codes QR par CSV */}
            {showImportModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
                    <div className="bg-white dark:bg-slate-950 w-full max-w-md rounded-2xl shadow-2xl p-6 relative">
                        <button onClick={() => setShowImportModal(false)} className="absolute top-4 right-4 p-2 hover:bg-slate-100 dark:hover:bg-slate-900 rounded-xl transition-colors">
                            <X className="w-5 h-5 text-slate-600 dark:text-slate-300" />
                        </button>
                        <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-2">Importer des QR Codes</h2>
                        <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">Téléchargez un fichier CSV pour générer des codes QR en masse.</p>

                        <form onSubmit={handleImportCSV} className="space-y-4">
                            {importing && (
                                <LoadingBar label="Import CSV et génération des QR" />
                            )}
                            {importError && (
                                <div className="p-3 bg-red-50 text-red-600 rounded-xl text-sm border border-red-100">{importError}</div>
                            )}
                            {importSuccess && (
                                <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl text-sm border border-emerald-100 flex items-center gap-2">
                                    <CheckCircle2 className="w-4 h-4" /> {importSuccess}
                                </div>
                            )}
                            {importReport?.errors?.length > 0 && (
                                <div className="max-h-44 overflow-y-auto rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
                                    <p className="mb-2 font-bold">
                                        Détail des lignes non terminées ({importReport.errors.length})
                                    </p>
                                    <ul className="space-y-1">
                                        {importReport.errors.map((error, index) => (
                                            <li key={`${error.line}-${error.stage}-${index}`}>
                                                Ligne {error.line} · {error.field || error.stage} : {error.message}
                                            </li>
                                        ))}
                                    </ul>
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
                                    <p className="text-xs text-slate-600 dark:text-slate-300">Format .csv uniquement</p>
                                </div>
                            </div>

                            <div className="bg-slate-50 dark:bg-slate-900 p-4 rounded-xl border border-slate-100 dark:border-slate-800">
                                <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">Instructions</p>
                                <ul className="text-xs text-slate-600 dark:text-slate-300 space-y-1 list-disc pl-4">
                                    <li>Utilisez le modèle CSV fourni ci-dessous.</li>
                                    <li>Les colonnes obligatoires sont : <code className="bg-slate-200 dark:bg-slate-700 px-1 rounded">fullName</code>.</li>
                                    <li>Les types d'accès valides : <code className="bg-slate-200 dark:bg-slate-700 px-1 rounded">single</code>, <code className="bg-slate-200 dark:bg-slate-700 px-1 rounded">multi</code>, <code className="bg-slate-200 dark:bg-slate-700 px-1 rounded">unlimited</code>.</li>
                                </ul>
                                <button
                                    type="button"
                                    onClick={handleDownloadTemplate}
                                    className="mt-3 inline-flex items-center gap-1.5 text-blue-600 hover:text-blue-700 font-bold text-xs"
                                >
                                    <FileSpreadsheet className="w-3 h-3" /> Télécharger le modèle CSV
                                </button>
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
            {/* Notification des actions utilisateur */}
            {toast.show && (
                <div className="fixed bottom-10 left-1/2 -translate-x-1/2 z-[100] animate-in slide-in-from-bottom-5 fade-in duration-300">
                    <div className="bg-slate-900 text-white dark:bg-[#BED3C3] dark:text-slate-900 px-6 py-4 rounded-2xl shadow-2xl flex items-center gap-3 border border-slate-700/50 dark:border-slate-200 backdrop-blur-md">
                        <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center">
                            <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                        </div>
                        <p className="text-sm font-bold tracking-tight">{toast.message}</p>
                        <button onClick={() => setToast({ show: false, message: "" })} className="ml-2 p-1 hover:bg-white/10 dark:hover:bg-slate-200 rounded-lg transition-colors">
                            <X className="w-4 h-4" />
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
