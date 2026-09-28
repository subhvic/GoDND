"use client";

import { useId, useRef, useState } from "react";
import { FileText, ImageIcon, Loader2, Upload, X } from "lucide-react";

import { useSettings } from "@/components/settings/settings-provider";
import type { DocumentRef } from "@/lib/settings/model";
import { DOCUMENT_LIMITS, IMAGE_LIMITS } from "@/lib/settings/options";
import { createBrowserSupabase } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

/**
 * "Upload" and the file beside it (handoff: Operational Details › Any other
 * relevant certifications — a dark Upload button, then `doc.pdf`).
 *
 * The file goes straight from the browser to the agency-documents bucket
 * under the caller's session, so storage policies decide who may write it
 * and a 5 MB scan never passes through a server action. In a sample
 * workspace nothing is stored; the file is held in this tab so it can still
 * be opened.
 */

type Limits = typeof DOCUMENT_LIMITS | typeof IMAGE_LIMITS;

export function formatBytes(bytes: number) {
  if (!bytes) return "";
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function useUploader(folder: string, limits: Limits) {
  const { state, isDemo } = useSettings();
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const upload = async (file: File): Promise<DocumentRef | null> => {
    setError(null);
    if (!(limits.types as readonly string[]).includes(file.type)) {
      setError(`${file.name} can’t be used here — upload ${limits.label}`);
      return null;
    }
    if (file.size > limits.maxBytes) {
      setError(`${file.name} is ${formatBytes(file.size)} — the limit is ${formatBytes(limits.maxBytes)}`);
      return null;
    }

    const id = crypto.randomUUID();
    const base: DocumentRef = {
      id,
      name: file.name,
      sizeBytes: file.size,
      mimeType: file.type,
      uploadedAt: new Date().toISOString(),
      path: null,
      previewUrl: URL.createObjectURL(file),
    };
    if (isDemo) return base;

    setUploading(true);
    try {
      const safeName = file.name.replace(/[^\w.-]+/g, "-").slice(-80);
      const path = `${state.viewer.agencyId}/${folder}/${id}-${safeName}`;
      const { error: uploadError } = await createBrowserSupabase()
        .storage.from("agency-documents")
        .upload(path, file, { contentType: file.type, upsert: false });
      if (uploadError) {
        setError(`Couldn’t upload ${file.name}: ${uploadError.message}`);
        return null;
      }
      return { ...base, path };
    } catch {
      setError(`Couldn’t upload ${file.name} — check your connection and try again`);
      return null;
    } finally {
      setUploading(false);
    }
  };

  return { upload, uploading, error, setError };
}

/**
 * The field's title. Not a <label>: the control is the Upload button, and a
 * label would replace its visible "Upload" with the field name.
 */
function FieldTitle({ id, required, children }: { id: string; required?: boolean; children: React.ReactNode }) {
  return (
    <span id={id} className="field-label">
      {children}
      {required ? (
        <>
          <span aria-hidden className="req">*</span>
          <span className="sr-only"> (required)</span>
        </>
      ) : null}
    </span>
  );
}

function DocumentName({ document }: { document: DocumentRef }) {
  const href = document.previewUrl ?? (document.path ? `/dashboard/settings/file?path=${encodeURIComponent(document.path)}` : null);
  const size = formatBytes(document.sizeBytes);
  return (
    <span className="doc-file">
      {href ? (
        // A link rather than a button: it stays usable when a read-only
        // section disables every control around it.
        <a className="doc-name link-btn" href={href} target="_blank" rel="noopener noreferrer">
          {document.name}
          <span className="sr-only"> (opens in a new tab)</span>
        </a>
      ) : (
        <span className="doc-name" title="Sample document — nothing is stored in this preview">
          {document.name}
        </span>
      )}
      {size ? <span className="doc-size">{size}</span> : null}
    </span>
  );
}

export function DocumentField({
  label,
  required,
  value,
  onChange,
  folder,
  error,
  hint,
  disabled,
  image,
  className,
}: {
  label: string;
  required?: boolean;
  value: DocumentRef | null;
  onChange: (value: DocumentRef | null) => void;
  /** Folder under the agency's documents: the section it belongs to. */
  folder: string;
  error?: string;
  hint?: string;
  disabled?: boolean;
  /** A logo or photo: images only, shown as a thumbnail. */
  image?: boolean;
  className?: string;
}) {
  const id = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const limits = image ? IMAGE_LIMITS : DOCUMENT_LIMITS;
  const uploader = useUploader(folder, limits);
  const message = uploader.error ?? error;
  const describedBy = [message ? `${id}-error` : null, `${id}-hint`].filter(Boolean).join(" ");

  return (
    <div className={cn("field", className)}>
      <FieldTitle id={`${id}-title`} required={required}>
        {label}
      </FieldTitle>
      <div className={cn("doc-row", message && "is-invalid")}>
        {image ? (
          <span className="doc-thumb" aria-hidden>
            {value?.previewUrl ? (
              // eslint-disable-next-line @next/next/no-img-element -- a blob URL next/image can't optimise
              <img src={value.previewUrl} alt="" />
            ) : value ? (
              <span className="doc-thumb-mark">{value.name.charAt(0).toUpperCase()}</span>
            ) : (
              <ImageIcon />
            )}
          </span>
        ) : null}

        {!disabled ? (
          <>
            <input
              ref={inputRef}
              type="file"
              accept={limits.accept}
              className="sr-only"
              tabIndex={-1}
              aria-hidden
              onChange={async (event) => {
                const file = event.target.files?.[0];
                event.target.value = "";
                if (!file) return;
                const uploaded = await uploader.upload(file);
                if (uploaded) onChange(uploaded);
              }}
            />
            <button
              type="button"
              className="hbtn doc-upload"
              onClick={() => inputRef.current?.click()}
              disabled={uploader.uploading}
              aria-label={`${value ? "Replace" : "Upload"} ${label.toLowerCase()}`}
              aria-describedby={describedBy}
            >
              {uploader.uploading ? <Loader2 aria-hidden className="spin" /> : <Upload aria-hidden />}
              {uploader.uploading ? "Uploading…" : value ? "Replace" : "Upload"}
            </button>
          </>
        ) : null}

        {value ? (
          <>
            {!image ? <FileText aria-hidden className="doc-icon" /> : null}
            <DocumentName document={value} />
            {!disabled ? (
              <button
                type="button"
                className="doc-remove"
                aria-label={`Remove ${value.name}`}
                onClick={() => onChange(null)}
              >
                <X aria-hidden />
              </button>
            ) : null}
          </>
        ) : disabled ? (
          <span className="doc-none">Not uploaded</span>
        ) : null}
      </div>
      <p id={`${id}-hint`} className="field-hint">
        {hint ? `${hint} ` : ""}
        {!disabled ? limits.label + "." : ""}
      </p>
      {message ? (
        <p id={`${id}-error`} role="alert" className="field-error">
          {message}
        </p>
      ) : null}
    </div>
  );
}

/** Several files under one label — "Any other relevant certifications". */
export function DocumentListField({
  label,
  required,
  value,
  onChange,
  folder,
  max,
  error,
  hint,
  disabled,
}: {
  label: string;
  required?: boolean;
  value: DocumentRef[];
  onChange: (value: DocumentRef[]) => void;
  folder: string;
  max: number;
  error?: string;
  hint?: string;
  disabled?: boolean;
}) {
  const id = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const uploader = useUploader(folder, DOCUMENT_LIMITS);
  const message = uploader.error ?? error;
  const full = value.length >= max;

  return (
    <div className="field">
      <FieldTitle id={`${id}-title`} required={required}>
        {label}
      </FieldTitle>
      {value.length > 0 ? (
        <ul className="doc-list">
          {value.map((document) => (
            <li key={document.id}>
              <FileText aria-hidden className="doc-icon" />
              <DocumentName document={document} />
              {!disabled ? (
                <button
                  type="button"
                  className="doc-remove"
                  aria-label={`Remove ${document.name}`}
                  onClick={() => onChange(value.filter((entry) => entry.id !== document.id))}
                >
                  <X aria-hidden />
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      ) : disabled ? (
        <span className="doc-none">Nothing attached</span>
      ) : null}

      {!disabled ? (
        <div className="doc-row">
          <input
            ref={inputRef}
            type="file"
            accept={DOCUMENT_LIMITS.accept}
            multiple
            className="sr-only"
            tabIndex={-1}
            aria-hidden
            onChange={async (event) => {
              const files = Array.from(event.target.files ?? []).slice(0, max - value.length);
              event.target.value = "";
              const added: DocumentRef[] = [];
              for (const file of files) {
                const uploaded = await uploader.upload(file);
                if (uploaded) added.push(uploaded);
              }
              if (added.length) onChange([...value, ...added]);
            }}
          />
          <button
            type="button"
            className="hbtn doc-upload"
            onClick={() => inputRef.current?.click()}
            disabled={uploader.uploading || full}
            aria-label={`Upload ${label.toLowerCase()}`}
            aria-describedby={`${id}-hint${message ? ` ${id}-error` : ""}`}
          >
            {uploader.uploading ? <Loader2 aria-hidden className="spin" /> : <Upload aria-hidden />}
            {uploader.uploading ? "Uploading…" : "Upload"}
          </button>
          {full ? <span className="doc-none">That’s the most you can attach ({max}).</span> : null}
        </div>
      ) : null}
      <p id={`${id}-hint`} className="field-hint">
        {hint ? `${hint} ` : ""}
        {!disabled ? `${DOCUMENT_LIMITS.label}, up to ${max} files.` : ""}
      </p>
      {message ? (
        <p id={`${id}-error`} role="alert" className="field-error">
          {message}
        </p>
      ) : null}
    </div>
  );
}
