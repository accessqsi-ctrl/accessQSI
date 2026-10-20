import { useEffect, useRef, useState } from "react";
import { Camera, Loader2, Trash2, X } from "lucide-react";
import { deleteHolderPhoto, fetchHolderPhotoUrl, preparePhotoForUpload, uploadHolderPhoto } from "../../../../lib/holderPhoto";

export default function HolderPhotoModal({ qr, canEdit, onClose, onChanged }) {
    const [photoUrl, setPhotoUrl] = useState(null);
    const [loading, setLoading] = useState(Boolean(qr.hasPhoto));
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState("");
    const inputRef = useRef(null);

    useEffect(() => {
        if (!qr.hasPhoto) return undefined;
        let objectUrl = null;
        let cancelled = false;
        fetchHolderPhotoUrl(qr.id)
            .then(url => {
                objectUrl = url;
                if (!cancelled) setPhotoUrl(url);
            })
            .catch(reason => !cancelled && setError(reason.message))
            .finally(() => !cancelled && setLoading(false));
        return () => {
            cancelled = true;
            if (objectUrl) URL.revokeObjectURL(objectUrl);
        };
    }, [qr.id, qr.hasPhoto, qr.photoVersion]);

    const handleFile = async (file) => {
        if (!file) return;
        setError("");
        setSaving(true);
        try {
            const { blob, previewUrl } = await preparePhotoForUpload(file);
            const data = await uploadHolderPhoto(qr.id, blob);
            setPhotoUrl(current => {
                if (current) URL.revokeObjectURL(current);
                return previewUrl;
            });
            onChanged(qr.id, { hasPhoto: true, photoVersion: data.photoVersion });
        } catch (reason) {
            setError(reason.message);
        } finally {
            setSaving(false);
            if (inputRef.current) inputRef.current.value = "";
        }
    };

    const handleDelete = async () => {
        setError("");
        setSaving(true);
        try {
            await deleteHolderPhoto(qr.id);
            setPhotoUrl(current => {
                if (current) URL.revokeObjectURL(current);
                return null;
            });
            onChanged(qr.id, { hasPhoto: false, photoVersion: null });
        } catch (reason) {
            setError(reason.message);
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
            <div className="bg-white dark:bg-slate-950 w-full max-w-sm rounded-2xl shadow-2xl p-6 relative text-center">
                <button type="button" onClick={onClose} className="absolute top-4 right-4 p-1.5 hover:bg-slate-100 dark:hover:bg-slate-900 rounded-lg transition-colors" aria-label="Fermer">
                    <X className="w-5 h-5 text-slate-500" />
                </button>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">Photo du titulaire</h3>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{qr.holder}</p>

                <div className="mx-auto mt-5 flex h-48 w-48 items-center justify-center overflow-hidden rounded-2xl border border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-900">
                    {loading ? (
                        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
                    ) : photoUrl ? (
                        <img src={photoUrl} alt={`Photo de ${qr.holder}`} className="h-full w-full object-cover" />
                    ) : (
                        <Camera className="h-12 w-12 text-slate-300 dark:text-slate-600" />
                    )}
                </div>
                <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">
                    La photo s’affiche à l’agent lors du scan pour vérifier l’identité du porteur.
                </p>

                {error && <p className="mt-3 text-sm font-medium text-red-600 dark:text-red-400">{error}</p>}

                {canEdit && (
                    <div className="mt-5 flex gap-3">
                        <input
                            ref={inputRef}
                            type="file"
                            accept="image/jpeg,image/png,image/webp"
                            capture="user"
                            className="hidden"
                            onChange={(event) => handleFile(event.target.files?.[0])}
                        />
                        <button
                            type="button"
                            disabled={saving}
                            onClick={() => inputRef.current?.click()}
                            className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-blue-700 disabled:opacity-60"
                        >
                            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />}
                            {photoUrl ? "Remplacer" : "Ajouter une photo"}
                        </button>
                        {photoUrl && (
                            <button
                                type="button"
                                disabled={saving}
                                onClick={handleDelete}
                                className="inline-flex items-center justify-center rounded-xl border border-red-200 px-3 py-2.5 text-red-600 hover:bg-red-50 disabled:opacity-60 dark:border-red-900/50 dark:text-red-300 dark:hover:bg-red-950/40"
                                title="Supprimer la photo"
                            >
                                <Trash2 className="h-4 w-4" />
                            </button>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
