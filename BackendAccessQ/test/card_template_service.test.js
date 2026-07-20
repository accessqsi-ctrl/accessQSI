const test = require("node:test");
const assert = require("node:assert/strict");

const cardTemplateService = require("../src/services/card_template.service");

const imageCustomization = {
    primaryColor: "#2563eb",
    secondaryColor: "#dbeafe",
    backgroundImageUrl: "/card-backgrounds/wedding-modern-navy-beige.png"
};

test("primary image uses centered cover rendering in supported templates", () => {
    const cases = [
        ["event-ticket", "horizontal-primary-zone"],
        ["staff-card", "vertical-primary-zone"],
        ["compact-ticket", "compact-primary-zone"]
    ];

    for (const [templateId, clipId] of cases) {
        const svg = cardTemplateService.renderPreview({
            templateId,
            customization: imageCustomization
        });

        assert.match(svg, new RegExp(`clipPath id="${clipId}"`));
        assert.match(svg, /data:image\/png;base64,/);
        assert.match(svg, /preserveAspectRatio="xMidYMid slice"/);
        assert.match(svg, new RegExp(`clip-path="url\\(#${clipId}\\)"`));
    }
});

test("wedding invitation ignores the primary image option", () => {
    const svg = cardTemplateService.renderPreview({
        templateId: "wedding-invite",
        customization: imageCustomization
    });

    assert.doesNotMatch(svg, /data:image\/png;base64,/);
    assert.doesNotMatch(svg, /primary-zone/);
    assert.match(svg, /<rect x="70" y="70" width="1060" height="1660" rx="58" fill="#ffffff"/);
});

test("supported templates keep their color when no image is provided", () => {
    const svg = cardTemplateService.renderPreview({
        templateId: "event-ticket",
        customization: {
            primaryColor: "#123456",
            secondaryColor: "#dbeafe",
            backgroundImageUrl: ""
        }
    });

    assert.match(svg, /<rect x="40" y="40" width="420" height="520" rx="28" fill="#123456"/);
    assert.doesNotMatch(svg, /horizontal-primary-zone/);
});
