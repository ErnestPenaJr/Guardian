# SubjectPhoto Component

A reusable, HIPAA-conscious photo upload and preview box for subject intake forms in React/TypeScript.  
Powered by **react-dropzone** (drag-and-drop) and **browser-image-compression** (client-side compression).

---

## Installation

```bash
npm install react-dropzone browser-image-compression
npm install --save-dev @types/browser-image-compression
```

---

## File Structure

```
src/
└── components/
    └── SubjectPhoto/
        ├── SubjectPhoto.tsx        ← main component (uses react-dropzone)
        ├── usePhotoCompression.ts  ← compression hook (browser-image-compression)
        ├── SubjectPhoto.css
        └── index.ts
```

---

## usePhotoCompression.ts

Wraps `browser-image-compression` in a hook that tracks compression state and exposes a typed `compress()` function.

```ts
import { useState, useCallback } from "react";
import imageCompression, { Options } from "browser-image-compression";

interface CompressionState {
  isCompressing: boolean;
  error: string | null;
}

interface UsePhotoCompressionOptions {
  maxSizeMB?: number;
  maxWidthOrHeight?: number;
  useWebWorker?: boolean;
}

const DEFAULT_OPTIONS: UsePhotoCompressionOptions = {
  maxSizeMB: 1,
  maxWidthOrHeight: 1024,
  useWebWorker: true,
};

export const usePhotoCompression = (options: UsePhotoCompressionOptions = {}) => {
  const [state, setState] = useState<CompressionState>({
    isCompressing: false,
    error: null,
  });

  const mergedOptions: Options = { ...DEFAULT_OPTIONS, ...options };

  const compress = useCallback(
    async (file: File): Promise<File | null> => {
      setState({ isCompressing: true, error: null });
      try {
        const compressed = await imageCompression(file, mergedOptions);
        // Cast back to File to preserve name/type metadata
        const result = new File([compressed], file.name, { type: file.type });
        setState({ isCompressing: false, error: null });
        return result;
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Compression failed.";
        setState({ isCompressing: false, error: msg });
        return null;
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [mergedOptions.maxSizeMB, mergedOptions.maxWidthOrHeight]
  );

  return { ...state, compress };
};
```

---

## SubjectPhoto.tsx

```tsx
import { useState, useCallback, useEffect } from "react";
import { useDropzone, FileRejection } from "react-dropzone";
import { usePhotoCompression } from "./usePhotoCompression";
import "./SubjectPhoto.css";

// ─── Types ───────────────────────────────────────────────────────────────────

interface SubjectPhotoState {
  file: File | null;
  previewUrl: string | null;
}

export interface SubjectPhotoProps {
  /** Controlled value — pass a server URL or base64 string for an existing photo */
  value?: string | null;
  /** Called with the compressed File whenever the user picks or drops a new photo */
  onChange?: (file: File) => void;
  /** Called when the user removes the photo */
  onRemove?: () => void;
  /** Max file size in bytes before rejection (default: 10MB pre-compression) */
  maxSizeBytes?: number;
  /** Whether the control is read-only */
  readOnly?: boolean;
  /** Label shown in the empty state */
  placeholder?: string;
  /** Compression target in MB (default: 1MB) */
  compressMaxMB?: number;
  /** Max pixel dimension after compression (default: 1024px) */
  compressMaxDimension?: number;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const DEFAULT_MAX_SIZE = 10 * 1024 * 1024; // 10 MB — pre-compression ceiling
const ACCEPTED_MIME = {
  "image/jpeg": [".jpg", ".jpeg"],
  "image/png": [".png"],
  "image/webp": [".webp"],
};

// ─── Component ────────────────────────────────────────────────────────────────

const SubjectPhoto = ({
  value = null,
  onChange,
  onRemove,
  maxSizeBytes = DEFAULT_MAX_SIZE,
  readOnly = false,
  placeholder = "Click or drag photo here",
  compressMaxMB = 1,
  compressMaxDimension = 1024,
}: SubjectPhotoProps) => {
  const [photo, setPhoto] = useState<SubjectPhotoState>({
    file: null,
    previewUrl: value ?? null,
  });
  const [error, setError] = useState<string | null>(null);

  const { isCompressing, compress } = usePhotoCompression({
    maxSizeMB: compressMaxMB,
    maxWidthOrHeight: compressMaxDimension,
    useWebWorker: true,
  });

  // Sync controlled value (e.g. existing subject loaded from API)
  useEffect(() => {
    if (value !== undefined) {
      setPhoto((prev) => ({ ...prev, previewUrl: value }));
    }
  }, [value]);

  // Cleanup blob URL on unmount
  useEffect(() => {
    return () => {
      if (photo.previewUrl && photo.file) {
        URL.revokeObjectURL(photo.previewUrl);
      }
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── File Processing ───────────────────────────────────────────────────────

  const processFile = useCallback(
    async (file: File) => {
      setError(null);

      // Compress before preview & upload
      const compressed = await compress(file);
      if (!compressed) {
        setError("Could not compress image. Please try a different file.");
        return;
      }

      // Revoke previous blob URL to free memory
      if (photo.previewUrl && photo.file) {
        URL.revokeObjectURL(photo.previewUrl);
      }

      const previewUrl = URL.createObjectURL(compressed);
      setPhoto({ file: compressed, previewUrl });
      onChange?.(compressed);
    },
    [photo.previewUrl, photo.file, compress, onChange]
  );

  // ── react-dropzone ────────────────────────────────────────────────────────

  const onDrop = useCallback(
    (accepted: File[], rejections: FileRejection[]) => {
      if (rejections.length > 0) {
        const reason = rejections[0].errors[0];
        if (reason.code === "file-too-large") {
          const mb = (maxSizeBytes / 1024 / 1024).toFixed(0);
          setError(`File exceeds the ${mb}MB limit.`);
        } else if (reason.code === "file-invalid-type") {
          setError("Only JPEG, PNG, or WebP images are allowed.");
        } else {
          setError(reason.message);
        }
        return;
      }
      if (accepted[0]) processFile(accepted[0]);
    },
    [processFile, maxSizeBytes]
  );

  const { getRootProps, getInputProps, isDragActive, isDragReject } = useDropzone({
    onDrop,
    accept: ACCEPTED_MIME,
    maxSize: maxSizeBytes,
    maxFiles: 1,
    disabled: readOnly || isCompressing,
    noClick: false,
    noKeyboard: false,
  });

  // ── Remove Handler ────────────────────────────────────────────────────────

  const handleRemove = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (photo.previewUrl && photo.file) {
      URL.revokeObjectURL(photo.previewUrl);
    }
    setPhoto({ file: null, previewUrl: null });
    setError(null);
    onRemove?.();
  };

  // ── Render ────────────────────────────────────────────────────────────────

  const hasPhoto = Boolean(photo.previewUrl);

  const boxClass = [
    "subject-photo-box",
    isDragActive && !isDragReject ? "dragging" : "",
    isDragReject ? "drag-reject" : "",
    hasPhoto ? "has-photo" : "",
    readOnly ? "read-only" : "",
    isCompressing ? "compressing" : "",
    error ? "has-error" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className="subject-photo-wrapper">
      <div
        {...getRootProps({ className: boxClass })}
        aria-label={hasPhoto ? "Subject photo — click to replace" : placeholder}
      >
        <input {...getInputProps()} aria-hidden="true" />

        {isCompressing ? (
          <div className="subject-photo-empty">
            <div className="subject-photo-spinner" aria-label="Compressing image…" />
            <span className="subject-photo-label">Compressing…</span>
          </div>
        ) : hasPhoto ? (
          <>
            <img
              src={photo.previewUrl!}
              alt="Subject"
              className="subject-photo-img"
            />
            {!readOnly && (
              <button
                className="subject-photo-remove"
                onClick={handleRemove}
                aria-label="Remove photo"
                title="Remove photo"
              >
                ✕
              </button>
            )}
            {!readOnly && (
              <div className="subject-photo-overlay">
                <span>Replace Photo</span>
              </div>
            )}
          </>
        ) : (
          <div className="subject-photo-empty">
            <svg
              className="subject-photo-icon"
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={1.5}
            >
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
              <circle cx="12" cy="7" r="4" />
            </svg>
            <span className="subject-photo-label">
              {isDragReject ? "Invalid file type" : placeholder}
            </span>
          </div>
        )}
      </div>

      {error && (
        <p className="subject-photo-error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
};

export default SubjectPhoto;
```

---

## SubjectPhoto.css

```css
.subject-photo-wrapper {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
}

/* ── Box ─────────────────────────────────────────────────────────────────── */

.subject-photo-box {
  position: relative;
  width: 160px;
  height: 200px;
  border: 2px dashed #cbd5e1;
  border-radius: 8px;
  background-color: #f8fafc;
  cursor: pointer;
  overflow: hidden;
  transition: border-color 0.2s, background-color 0.2s;
  outline: none;
}

.subject-photo-box:hover:not(.read-only):not(.compressing),
.subject-photo-box:focus-visible:not(.read-only) {
  border-color: #3b82f6;
  background-color: #eff6ff;
}

.subject-photo-box.dragging {
  border-color: #2563eb;
  background-color: #dbeafe;
}

.subject-photo-box.drag-reject {
  border-color: #ef4444;
  background-color: #fef2f2;
}

.subject-photo-box.read-only {
  cursor: default;
  border-style: solid;
}

.subject-photo-box.compressing {
  cursor: wait;
  opacity: 0.7;
}

.subject-photo-box.has-error {
  border-color: #ef4444;
}

/* ── Empty State ─────────────────────────────────────────────────────────── */

.subject-photo-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  gap: 0.5rem;
  padding: 1rem;
  color: #94a3b8;
  text-align: center;
}

.subject-photo-icon {
  width: 40px;
  height: 40px;
}

.subject-photo-label {
  font-size: 0.75rem;
  line-height: 1.3;
}

/* ── Compression Spinner ─────────────────────────────────────────────────── */

.subject-photo-spinner {
  width: 28px;
  height: 28px;
  border: 3px solid #e2e8f0;
  border-top-color: #3b82f6;
  border-radius: 50%;
  animation: spin 0.7s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

/* ── Populated State ─────────────────────────────────────────────────────── */

.subject-photo-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.subject-photo-overlay {
  position: absolute;
  inset: 0;
  background: rgba(0, 0, 0, 0.45);
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0;
  transition: opacity 0.2s;
  color: #fff;
  font-size: 0.8rem;
  font-weight: 600;
  letter-spacing: 0.02em;
}

.subject-photo-box:hover .subject-photo-overlay,
.subject-photo-box:focus-visible .subject-photo-overlay {
  opacity: 1;
}

.subject-photo-remove {
  position: absolute;
  top: 6px;
  right: 6px;
  width: 22px;
  height: 22px;
  border-radius: 50%;
  border: none;
  background: rgba(0, 0, 0, 0.55);
  color: #fff;
  font-size: 0.65rem;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 10;
  transition: background 0.15s;
}

.subject-photo-remove:hover {
  background: #ef4444;
}

/* ── Error ───────────────────────────────────────────────────────────────── */

.subject-photo-error {
  font-size: 0.75rem;
  color: #ef4444;
  max-width: 160px;
  text-align: center;
  margin: 0;
}
```

---

## index.ts

```ts
export { default } from "./SubjectPhoto";
export type { SubjectPhotoProps } from "./SubjectPhoto";
```

---

## Usage Examples

### Basic (uncontrolled)

```tsx
<SubjectPhoto
  onChange={(file) => console.log("Compressed file:", file.name, file.size)}
/>
```

### Pre-populated from API (controlled)

```tsx
<SubjectPhoto
  value={subject.photoUrl}
  onChange={(file) => setPhotoFile(file)}
  onRemove={() => setPhotoFile(null)}
/>
```

### Custom compression settings

```tsx
<SubjectPhoto
  compressMaxMB={0.5}             // compress down to 500 KB
  compressMaxDimension={800}      // max 800px width or height
  maxSizeBytes={15 * 1024 * 1024} // reject files over 15 MB before compressing
  onChange={(file) => setPhotoFile(file)}
/>
```

### Read-only / view mode

```tsx
<SubjectPhoto value={subject.photoUrl} readOnly />
```

### Submit via FormData

```ts
const handleSubmit = async (e: React.FormEvent) => {
  e.preventDefault();
  const formData = new FormData();
  if (photoFile) formData.append("subjectPhoto", photoFile);
  formData.append("subjectId", subject.id);
  await fetch("/api/subjects", { method: "POST", body: formData });
};
```

---

## Azure Blob Upload (Recommended for Guardian)

For PHI-sensitive photos, upload the compressed file directly to Azure Blob Storage
via a short-lived SAS token rather than routing the file through your API.

```ts
const uploadToAzure = async (file: File, subjectId: string): Promise<string> => {
  // 1. Get a short-lived SAS URL from your secured backend
  const { sasUrl } = await fetch(`/api/subjects/${subjectId}/photo-sas`)
    .then((r) => r.json());

  // 2. PUT the compressed file directly to Azure Blob Storage
  await fetch(sasUrl, {
    method: "PUT",
    headers: {
      "x-ms-blob-type": "BlockBlob",
      "Content-Type": file.type,
    },
    body: file,
  });

  // 3. Strip SAS query string — store only the clean blob URL
  return sasUrl.split("?")[0];
};
```

Wire it into the `onChange` handler:

```tsx
<SubjectPhoto
  value={subject.photoUrl}
  onChange={async (file) => {
    const blobUrl = await uploadToAzure(file, subject.id);
    setSubject((prev) => ({ ...prev, photoUrl: blobUrl }));
  }}
/>
```

---

## Library Reference

| Library | Purpose | Docs |
|---|---|---|
| `react-dropzone` | Drag-and-drop, file accept/reject, keyboard accessible | https://react-dropzone.js.org |
| `browser-image-compression` | Client-side compression via Web Worker | https://github.com/Donaldcwl/browser-image-compression |

---

## Notes

- **Compression runs before preview** — the blob URL and `onChange` callback always receive the compressed `File`, never the raw original.
- **Memory**: `URL.createObjectURL()` is always paired with `URL.revokeObjectURL()` on replace or unmount.
- **No localStorage**: Blob URLs must never be persisted to localStorage — they are session-only.
- **PHI handling**: Photos are PHI. Azure Blob containers must be private; access gated through SAS tokens with a minimal TTL (15–30 min).
- **Accepted types**: JPEG, PNG, WebP. Adjust `ACCEPTED_MIME` as needed.
- **Pre-compression size limit**: `maxSizeBytes` defaults to 10 MB. Files over this are rejected before compression runs.
