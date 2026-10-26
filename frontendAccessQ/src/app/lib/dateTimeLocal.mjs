// Conversion entre les champs <input type="datetime-local"> (heure locale, sans fuseau)
// et les dates ISO échangées avec l'API. Le navigateur connaît le fuseau de l'utilisateur :
// c'est donc lui qui convertit, et le serveur reçoit toujours un instant UTC non ambigu.

const pad = (value) => String(value).padStart(2, "0");

// Date ou chaîne ISO → "YYYY-MM-DDTHH:mm" dans le fuseau du navigateur ("" si absente ou invalide).
export const toDateTimeLocal = (value) => {
    if (!value) return "";
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) return "";
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
};

// "YYYY-MM-DDTHH:mm" saisi en heure locale → ISO UTC ("" conservé pour les champs facultatifs).
export const fromDateTimeLocal = (value) => {
    if (!value) return "";
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? value : date.toISOString();
};
