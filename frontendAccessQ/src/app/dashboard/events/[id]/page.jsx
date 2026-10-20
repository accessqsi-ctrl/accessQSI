"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Loader2, Calendar, MapPin, QrCode, Edit2, Trash2, ArrowLeft, Plus, Download, X, CheckCircle2, FileSpreadsheet, FileText, Camera } from "lucide-react";
import { apiFetch, apiUrl, refreshSession } from "../../../lib/api";
import LoadingBar from "../../../components/LoadingBar";
import { useUserPlan } from "../../../lib/useUserPlan";
import PlanQuotaStatus from "../../../components/PlanQuotaStatus";
import QrGenerationModal from "./_components/QrGenerationModal";
import QrPreviewModal from "./_components/QrPreviewModal";
import RechargeQrModal from "./_components/RechargeQrModal";
import RevokeQrModal from "./_components/RevokeQrModal";
import CardTemplateModal from "./_components/CardTemplateModal";
import EditEventModal from "./_components/EditEventModal";
import DeleteEventModal from "./_components/DeleteEventModal";
import ImportQrModal from "./_components/ImportQrModal";
import HolderPhotoModal from "./_components/HolderPhotoModal";
import { preparePhotoForUpload, uploadHolderPhoto } from "../../../lib/holderPhoto";
import { getCardDownloadUrl } from "./_components/cardDownload";
import { browserTimeZone, normalizePhone, selectTemplateForExistingQr, validateQrContact } from "../../../lib/eventQr.mjs";




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
        cardMessage: "", periodUnit: "", periodLimit: "1"
    });
    const [qrPhoto, setQrPhoto] = useState(null);
    const [photoQr, setPhotoQr] = useState(null);
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
    const [debouncedSearchQuery, setDebouncedSearchQuery] = useState("");
    const [qrListLoading, setQrListLoading] = useState(false);
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
    const [qrForCardTemplate, setQrForCardTemplate] = useState(null);
    const [replacementCardTemplateId, setReplacementCardTemplateId] = useState("");
    const [cardTemplateError, setCardTemplateError] = useState("");
    const [exportingFormat, setExportingFormat] = useState("");
    const [downloadingCards, setDownloadingCards] = useState(false);
    const [downloadingTemplate, setDownloadingTemplate] = useState(false);
    const [cardTemplates, setCardTemplates] = useState([]);
    const [selectedCardTemplateId, setSelectedCardTemplateId] = useState("");
    const { userProfile, planLimits, hasCapability, refreshPlan } = useUserPlan();
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
    const canUseCustomTemplates = hasCapability("custom_card_templates");

    const selectedCardTemplate = useMemo(
        () => cardTemplates.find(template => template.templateId === selectedCardTemplateId) || null,
        [cardTemplates, selectedCardTemplateId]
    );
    const replacementCardTemplate = useMemo(
        () => cardTemplates.find(template => template.templateId === replacementCardTemplateId) || null,
        [cardTemplates, replacementCardTemplateId]
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
        setQrListLoading(true);
        setError("");
        setQrListError("");
        try {
            const params = new URLSearchParams({
                page: String(qrPage),
                pageSize: "25"
            });
            if (debouncedSearchQuery) params.set("search", debouncedSearchQuery);
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
            setQrListLoading(false);
        }
    }, [eventId, qrPage, debouncedSearchQuery, statusFilter]);

    useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedSearchQuery(searchQuery.trim());
            setQrPage(1);
        }, 650);
        return () => clearTimeout(timer);
    }, [searchQuery]);

    useEffect(() => {
        if (eventId) fetchAll();
    }, [eventId, fetchAll]);

    useEffect(() => {
        if (eventId) fetchAreas();
    }, [eventId, fetchAreas]);

    useEffect(() => {
        const fetchCreationTemplates = async () => {
            if (!canUseCustomTemplates) {
                setCardTemplates([]);
                setSelectedCardTemplateId("");
                return;
            }
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
    }, [canUseCustomTemplates]);

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

    const handleQrPhotoChange = async (file) => {
        setQrPhoto(current => {
            if (current?.previewUrl) URL.revokeObjectURL(current.previewUrl);
            return null;
        });
        if (!file) return;
        try {
            setQrPhoto(await preparePhotoForUpload(file));
        } catch (reason) {
            setQrError(reason.message);
        }
    };

    const handleHolderPhotoChanged = (qrId, photo) => {
        setQrCodes(current => current.map(qr => qr.id === qrId ? { ...qr, ...photo } : qr));
        setPhotoQr(current => current?.id === qrId ? { ...current, ...photo } : current);
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
            // Send the complete controlled input explicitly. This avoids a
            // stale or browser-autofilled value being replaced by another field.
            fullName: holderName,
            email: qrForm.email.trim().toLowerCase(),
            phone: normalizePhone(qrForm.phone),
            cardTemplateId: selectedCardTemplateId,
            periodTimezone: browserTimeZone()
        };
        try {
            const res = await apiFetch(`/qr/generate/${eventId}`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload)
            });
            const data = await res.json();
            if (data.success) {
                // Le QR est créé : un échec d'envoi de la photo ne doit pas le faire disparaître.
                if (qrPhoto && data.qrCode?.qr_id) {
                    try {
                        await uploadHolderPhoto(data.qrCode.qr_id, qrPhoto.blob);
                    } catch (photoError) {
                        showToast(`QR créé, mais la photo n'a pas été enregistrée : ${photoError.message}`);
                    }
                    handleQrPhotoChange(null);
                }
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

    const openCardTemplateModal = (qr) => {
        if (cardTemplates.length === 0) {
            showToast("Publiez d’abord un modèle dans le module Modèles.");
            return;
        }

        setQrForCardTemplate(qr);
        setReplacementCardTemplateId(
            selectTemplateForExistingQr(qr, cardTemplates, selectedCardTemplateId)
        );
        setCardTemplateError("");
    };

    const handleGenerateCardForQr = async (event) => {
        event.preventDefault();
        if (!qrForCardTemplate || !replacementCardTemplateId) {
            setCardTemplateError("Sélectionnez un modèle de carte.");
            return;
        }

        setCardGeneratingId(qrForCardTemplate.id);
        setCardTemplateError("");
        try {
            const res = await apiFetch(`/qr/card/${qrForCardTemplate.id}`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ cardTemplateId: replacementCardTemplateId })
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok || !data.success) {
                setCardTemplateError(data.message || "Impossible de changer le modèle de cette carte.");
                return;
            }

            setQrCodes(current => current.map(qr => qr.id === qrForCardTemplate.id
                ? {
                    ...qr,
                    cardTemplateId: replacementCardTemplateId,
                    cardUrl: data.cardUrl || null,
                    cardPdfUrl: data.cardPdfUrl || qr.cardPdfUrl
                }
                : qr));
            setQrForCardTemplate(null);
            showToast("Le modèle de la carte a été mis à jour.");
        } catch {
            setCardTemplateError("Erreur de connexion au serveur.");
        } finally {
            setCardGeneratingId(null);
        }
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
        formData.append("periodTimezone", browserTimeZone());

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
        <div className="aq-page space-y-6">
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
            <div className="aq-page-header p-6 sm:p-8">
                <div className="w-full">
                <div className="flex w-full flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0 flex-1 space-y-3">
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
                    <div className="flex flex-wrap justify-start gap-2 sm:justify-end">
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
                {(exportingFormat || downloadingTemplate) && (
                    <LoadingBar
                        label={downloadingTemplate ? "Préparation du modèle CSV" : `Préparation export ${exportingFormat.toUpperCase()}`}
                        className="mt-6"
                    />
                )}
                </div>
            </div>

            {/* Gestion des codes QR de l'événement */}
            
            <div className="aq-panel">
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
                            onChange={(event) => setSearchQuery(event.target.value)}
                            onKeyDown={(event) => {
                                if (event.key === "Enter") {
                                    setDebouncedSearchQuery(searchQuery.trim());
                                    setQrPage(1);
                                }
                            }}
                            placeholder="Rechercher par ID, Nom..."
                            title="La recherche démarre après une courte pause ou en appuyant sur Entrée."
                            className="block w-full pl-10 pr-10 py-2 border border-slate-200 dark:border-slate-700 rounded-xl leading-5 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 sm:text-sm transition-colors shadow-sm"
                        />
                        {qrListLoading && (
                            <Loader2
                                className="absolute right-3 top-2.5 h-4 w-4 animate-spin text-blue-600"
                                aria-label="Recherche en cours"
                            />
                        )}
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
                                                <button
                                                    type="button"
                                                    onClick={() => setPhotoQr(qr)}
                                                    title={qr.hasPhoto ? "Voir la photo du titulaire" : "Ajouter une photo"}
                                                    className="relative w-8 h-8 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center font-bold text-xs hover:ring-2 hover:ring-blue-200 transition-shadow"
                                                >
                                                    {qr.holder?.charAt(0)?.toUpperCase() || '?'}
                                                    {qr.hasPhoto && (
                                                        <span className="absolute -bottom-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-emerald-500 text-white ring-2 ring-white dark:ring-slate-950">
                                                            <Camera className="h-2.5 w-2.5" />
                                                        </span>
                                                    )}
                                                </button>
                                                <span className="font-medium text-slate-900 dark:text-white">{qr.holder}</span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-slate-500 dark:text-slate-400">{qr.email}</td>
                                        <td className="px-6 py-4">
                                            <span className="font-medium text-slate-700 dark:text-slate-200">{qr.scans}</span>
                                            {qr.periodLabel && (
                                                <span className="block text-xs text-slate-500 dark:text-slate-400">max {qr.periodLabel}</span>
                                            )}
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
                                                {(qr.cardPdfUrl || qr.cardUrl) && (
                                                    <a
                                                        href={getCardDownloadUrl(qr.cardPdfUrl || qr.cardUrl)}
                                                        download
                                                        className="p-1.5 text-emerald-600 dark:text-emerald-300 bg-white dark:bg-slate-900 border border-emerald-100 dark:border-emerald-900/50 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 rounded-lg transition-colors inline-block"
                                                        title={qr.cardPdfUrl ? "Télécharger l'invitation PDF" : "Télécharger l'invitation"}
                                                    >
                                                        {qr.cardPdfUrl ? <FileText className="w-5 h-5" /> : <FileSpreadsheet className="w-5 h-5" />}
                                                    </a>
                                                )}
                                                {canManageEvent && (
                                                    <button
                                                        onClick={() => openCardTemplateModal(qr)}
                                                        disabled={cardGeneratingId === qr.id}
                                                        className="p-1.5 text-violet-600 dark:text-violet-300 bg-white dark:bg-slate-900 border border-violet-100 dark:border-violet-900/50 hover:bg-violet-50 dark:hover:bg-violet-950/40 rounded-lg transition-colors disabled:opacity-50"
                                                        title={qr.cardTemplateId ? "Changer le modèle de carte" : "Générer une carte"}
                                                    >
                                                        {cardGeneratingId === qr.id ? <Loader2 className="w-5 h-5 animate-spin" /> : <Edit2 className="w-5 h-5" />}
                                                    </button>
                                                )}
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
                <QrGenerationModal
                    cardTemplates={cardTemplates}
                    event={event}
                    generatedAsset={generatedAsset}
                    generatingQr={generatingQr}
                    handleGenerateQr={handleGenerateQr}
                    handleQrPhotoChange={handleQrPhotoChange}
                    qrContactErrors={qrContactErrors}
                    qrContactTouched={qrContactTouched}
                    qrError={qrError}
                    qrForm={qrForm}
                    qrPhoto={qrPhoto}
                    qrQuotaReached={qrQuotaReached}
                    selectedCardTemplateId={selectedCardTemplateId}
                    setQrContactTouched={setQrContactTouched}
                    setQrError={setQrError}
                    setQrForm={setQrForm}
                    setQrSubmitAttempted={setQrSubmitAttempted}
                    setSelectedCardTemplateId={setSelectedCardTemplateId}
                    setShowQrModal={setShowQrModal}
                    showEmailError={showEmailError}
                    showPhoneError={showPhoneError}
                />
            )}

            {/* Photo d'identification du titulaire */}
            {photoQr && (
                <HolderPhotoModal
                    qr={photoQr}
                    canEdit={canCreateQr}
                    onClose={() => setPhotoQr(null)}
                    onChanged={handleHolderPhotoChanged}
                />
            )}

            {/* Aperçu et téléchargement du support généré */}
            {selectedQr && (
                <QrPreviewModal
                    event={event}
                    selectedQr={selectedQr}
                    setSelectedQr={setSelectedQr}
                />
            )}

            {/* Recharge d'un QR limité */}
            {qrToRecharge && (
                <RechargeQrModal
                    handleRecharge={handleRecharge}
                    qrToRecharge={qrToRecharge}
                    rechargeAmount={rechargeAmount}
                    rechargeError={rechargeError}
                    rechargingId={rechargingId}
                    setQrToRecharge={setQrToRecharge}
                    setRechargeAmount={setRechargeAmount}
                />
            )}

            {/* Confirmation de révocation d'un code QR */}
            {qrToRevoke && (
                <RevokeQrModal
                    handleRevoke={handleRevoke}
                    qrToRevoke={qrToRevoke}
                    revokingId={revokingId}
                    setQrToRevoke={setQrToRevoke}
                />
            )}

            {qrForCardTemplate && (
                <CardTemplateModal
                    cardGeneratingId={cardGeneratingId}
                    cardTemplateError={cardTemplateError}
                    cardTemplates={cardTemplates}
                    handleGenerateCardForQr={handleGenerateCardForQr}
                    qrForCardTemplate={qrForCardTemplate}
                    replacementCardTemplate={replacementCardTemplate}
                    replacementCardTemplateId={replacementCardTemplateId}
                    setCardTemplateError={setCardTemplateError}
                    setQrForCardTemplate={setQrForCardTemplate}
                    setReplacementCardTemplateId={setReplacementCardTemplateId}
                />
            )}

            {/* Formulaire de modification de l'événement */}
            {showEditModal && (
                <EditEventModal
                    areas={areas}
                    editError={editError}
                    editForm={editForm}
                    handleAreaChange={handleAreaChange}
                    handleUpdateEvent={handleUpdateEvent}
                    loadingAreas={loadingAreas}
                    setEditForm={setEditForm}
                    setShowEditModal={setShowEditModal}
                    updatingEvent={updatingEvent}
                />
            )}

            {/* Confirmation de suppression de l'événement */}
            {showDeleteConfirm && (
                <DeleteEventModal
                    canDeleteEvent={canDeleteEvent}
                    deleteConfirmationText={deleteConfirmationText}
                    expectedDeleteConfirmation={expectedDeleteConfirmation}
                    handleDeleteEvent={handleDeleteEvent}
                    isDeleting={isDeleting}
                    setDeleteConfirmationText={setDeleteConfirmationText}
                    setShowDeleteConfirm={setShowDeleteConfirm}
                />
            )}
            {/* Formulaire d'import des codes QR par CSV */}
            {showImportModal && (
                <ImportQrModal
                    handleDownloadTemplate={handleDownloadTemplate}
                    handleImportCSV={handleImportCSV}
                    importError={importError}
                    importFile={importFile}
                    importReport={importReport}
                    importSuccess={importSuccess}
                    importing={importing}
                    setImportFile={setImportFile}
                    setShowImportModal={setShowImportModal}
                />
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
