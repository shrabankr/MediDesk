# Patient Management & Duplicate Detection Architecture

**Status:** CURRENT (Phase 3 Verified)

---

## 1. Patient Identifiers & Indexing

1. **Human-Friendly Sequential Patient Number**:
   - Format: `MD-000001`, `MD-000002`, etc.
   - Scoped strictly per organization.
   - Generated using atomic sequential index calculation.
2. **Database Primary Key**:
   - Standard internal UUID (`crypto.randomUUID()`).
   - Insulates internal database keys from external display.

---

## 2. Normalization Engine

To guard against phonetic differences, spaces, and formatting quirks:
- `normalizeName(name)`: Lowercases, trims surrounding whitespace, and compresses multiple consecutive spaces into a single space (`name.toLowerCase().trim().replace(/\s+/g, ' ')`).
- `normalizeMobile(mobile)`: Extracts pure digits (`mobile.replace(/\D/g, '')`) and extracts the last 10 digits for Indian standard numbers.

---

## 3. Scored Duplicate Detection & Decision Flow

When registering a patient, `SqlitePatientRepository.findPotentialDuplicates` evaluates matches:
- **STRONG MATCH**: Exact normalized 10-digit mobile number match against existing active records.
- **MEDIUM MATCH**: Exact normalized full name + (same date of birth OR same gender).
- **LOW MATCH**: Exact normalized full name.

### Strict Decision Workflow (No Auto-Merge, No Silent Overwrite)
1. If a STRONG or MEDIUM match is detected and `forceCreateOnDuplicate` is false:
   - Throws `DuplicatePatientWarningError` with full details of matching candidates.
   - Generates `PATIENT_DUPLICATE_WARNING` audit event.
2. The UI renders an explicit decision card displaying candidate names, patient numbers, and mobiles:
   - **`[Use Existing Patient]`**: Staff clicks to immediately open the existing record and aborts new record creation.
   - **`[Ignore & Create New]`**: Staff explicitly confirms creation (e.g. family member sharing mobile), setting `forceCreateOnDuplicate = true`.
3. The system **never** silently overwrites or automatically merges patient records.
