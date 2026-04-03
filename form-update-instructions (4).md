# Subject Workup Form — UI Update Instructions
**For Claude Code Implementation**

This document describes all changes applied to the Subject Workup form. A reference HTML prototype has been provided alongside this file. Items marked `[TBD]` require input from Sean before implementation is complete.

---

## 1. Top of Form — Case Number Area

### 1a. Fraud Type Dropdown *(NEW)*
- Add a labeled dropdown directly in the top meta/subheader row, next to the Case Number field
- **Label:** `FRAUD TYPE`
- **Options:** `[TBD — Sean to provide full list]`
- Placeholder options in prototype: Check Fraud, Identity Theft, Wire Fraud, Phishing, Elder Fraud, Business Email Compromise, Debit Card, Credit Card, HSA Card, After Hours Trading, Stock Manipulation, Pump and Dump Scheme, Insider Trading, Basic Securities, Other

### 1b. Category Dropdown *(NEW)*
- Add a second labeled dropdown in the same top row, after Fraud Type
- **Label:** `CATEGORY`
- **Options:** Account Owner Fraud (AOF), Account Takeover (ATO), True Name Fraud (TNF), Scam Victim (SV), Victim Assisted Fraud (VAF), Other (OTH)

### 1c. Dollar Loss Amount Field *(NEW)*
- Add a manual text entry field in the same top row, after Category
- **Label:** `DOLLAR LOSS AMOUNT`
- Input type: numeric/currency with `$` prefix
- Manual entry only — no dropdown
- Strip non-numeric characters on input (allow decimals)
- Clarify with Sean: required vs. optional, any min/max validation

---

## 2. Minimum Collection Section (Left Table)

### 2a. Standing Instructions — Checkbox *(NEW)*
- Add **Standing Instructions** as a new row at the bottom of the Minimum Collection table
- Row structure must match all other rows in the table: label in the first column, then three checkbox columns (`+`, `−`, `N/R`)
- No special behavior — standard checkbox row

---

## 3. Source Section (Right Table)

### 3a. Restriction Codes *(NEW)*
- Add **Restriction Codes** as a new row in the Source table, after OSINT Notes
- Row structure: label column + three checkbox columns (`+`, `−`, `N/R`), matching all other rows
- Within the label cell, include:
  - A **4-character text input** always visible
    - Maximum length: **4 characters**
    - Auto-uppercase on input
    - Enforce `maxlength="4"`

### 3b. Asset Recovery — Checkbox *(NEW)*
- Add **Asset Recovery** as a new row in the Source table, after Restriction Codes
- Row structure must match all other rows: label column + three checkbox columns (`+`, `−`, `N/R`)
- No special behavior — standard checkbox row

---

## 4. Section Comments / IP Address Area

### 4a. Device Type — Dropdown with Conditional Text Field *(NEW)*
- Locate the **IP Address(es)** section
- Add a **Device Type** subsection directly below the IP address entry area
- **Label:** `DEVICE TYPE`
- **Dropdown options:** `[TBD — Sean to provide top 10]`
- Prototype placeholder options: Desktop / Laptop, Mobile Phone, Tablet, Smart TV, Gaming Console, ATM / Kiosk, POS Terminal, Smart Watch / Wearable, IoT Device, Virtual Machine / Emulator
- Include **"Other"** as the final option in the dropdown

**"Other" conditional behavior:**
- When user selects **"Other"**, dynamically show a free-text input field below the dropdown
- When any other option is selected, hide the text field and clear its value
- This pattern mirrors the existing **Physical Marks / Tattoos / Scars** field — follow that same show/hide UI behavior exactly

---

## Summary Checklist

| Location | Item | Type | Notes |
|---|---|---|---|
| Top of Form | Fraud Type | Dropdown | Options TBD from Sean |
| Top of Form | Category | Dropdown | Options TBD from Sean |
| Top of Form | Dollar Loss Amount | Currency text input | Confirm validation rules with Sean |
| Minimum Collection (left table) | Standing Instructions | Standard checkbox row | Ready to build |
| Source (right table) | Restriction Codes | Checkbox row + conditional 4-char input + scrollable code list | Confirm list/autocomplete pattern |
| Source (right table) | Asset Recovery | Standard checkbox row | Ready to build |
| IP Address Section | Device Type | Dropdown + conditional "Other" text field | Options TBD from Sean |

---

## Implementation Notes

- **Checkbox rows:** All new checkbox rows in both the Minimum Collection and Source tables must follow the exact same column structure as existing rows — label `td` first, then three separate `td` cells for `+`, `−`, and `N/R` checkboxes. Do not use `colspan` or wrapper divs that break column alignment.
- **Restriction Codes list:** Thousands of entries exist — confirm with Sean whether this should be an autocomplete search against a backend data source or a static scrollable reference panel alongside the input.
- **Dropdowns (Fraud Type, Category, Device Type):** Build UI components with placeholder/empty options now; swap in real lists once Sean provides them.
- **Dollar Loss Amount:** Confirm with Sean whether required/optional and if any validation rules apply.
- **"Other" text field (Device Type):** Reference the Physical Marks / Tattoos / Scars section as the UX model for conditional show/hide behavior.
