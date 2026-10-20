import { apiUrl } from "../../../../lib/api";

export const getCardDownloadUrl = (cardUrl) => {
    if (!cardUrl) return "";
    return apiUrl(cardUrl);
};
