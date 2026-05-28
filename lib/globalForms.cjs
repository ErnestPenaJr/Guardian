// lib/globalForms.cjs
// Shared predicate + constants for JAFAR global workflow templates.
// A global template is a row in GUARDIAN.FORMS where ALL of:
//   COMPANY_ID IS NULL, ORGANIZATION_ID IS NULL, IS_PUBLIC = 1.

function isGlobalForm(row) {
    if (!row) return false;
    return row.COMPANY_ID == null
        && row.ORGANIZATION_ID == null
        && (row.IS_PUBLIC === 1 || row.IS_PUBLIC === true);
}

const GLOBAL_AUDIT_EVENTS = Object.freeze({
    CREATED: 'GLOBAL_TEMPLATE_CREATED',
    MODIFIED: 'GLOBAL_TEMPLATE_MODIFIED',
    DELETED: 'GLOBAL_TEMPLATE_DELETED',
    CLONED: 'GLOBAL_TEMPLATE_CLONED',
});

module.exports = {
    isGlobalForm,
    GLOBAL_AUDIT_EVENTS,
};
