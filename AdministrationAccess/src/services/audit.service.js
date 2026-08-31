const writeAudit = ({ actorId, action, targetType, targetId, organizationId = null, outcome = "SUCCESS" }) => {
    console.info(JSON.stringify({
        type: "ADMIN_SECURITY_AUDIT",
        timestamp: new Date().toISOString(),
        actor_id: Number(actorId),
        action,
        target_type: targetType,
        target_id: Number(targetId),
        organization_id: organizationId == null ? null : Number(organizationId),
        outcome
    }));
};

module.exports = { writeAudit };
