"use client";

import { useId, useRef, useState, useSyncExternalStore } from "react";
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  ImagePlus,
  LoaderCircle,
  RotateCcw,
  Trash2,
  X,
} from "lucide-react";

import { StoredImage } from "@/components/experiences/wizard/stored-image";
import { useWizard } from "@/components/experiences/wizard/wizard-provider";
import * as draftStore from "@/lib/experience-wizard/draft-store";
import * as uploads from "@/lib/experience-wizard/image-uploads";
import type { ImageRef } from "@/lib/experience-wizard/schema";
import { cn } from "@/lib/utils";

const STAGE_LABEL: Record<uploads.UploadStage, string> = {
  queued: "Waiting…",
  reading: "Reading",
  optimising: "Optimising",
  saving: "Saving",
};

/**
 * Photo uploader with every state on the tile it concerns:
 *
 *   empty       a full-width drop zone that says what it accepts, up front
 *   drag-over   the zone (or the grid, once it has photos) lights up
 *   queued      "Waiting…" — two photos process at a time
 *   processing  a real progress bar per photo, with cancel
 *   failed      the reason, on the photo it belongs to; retry when retrying
 *               could work, dismiss always
 *   added       the photo, its description field, move / remove controls
 *   full        the zone is replaced by a note saying why nothing more fits
 *
 * `gallery` holds up to `max` ordered photos (itinerary stops); `single` holds
 * one, and a new upload replaces it (the custom thumbnail).
 */
export function ImageUploader({
  owner,
  max,
  label,
  hint,
  mode = "gallery",
}: {
  owner: string;
  max: number;
  label: string;
  hint?: string;
  mode?: "gallery" | "single";
}) {
  const { draft } = useWizard();
  const { jobs, announcement } = useSyncExternalStore(
    uploads.subscribe,
    uploads.getSnapshot,
    uploads.getServerSnapshot,
  );

  const images = draft.images.filter((image) => image.owner === owner);
  const ownerJobs = jobs.filter((job) => job.owner === owner);
  const inFlight = ownerJobs.filter((job) => job.status === "active").length;
  const isSingle = mode === "single";
  const full = !isSingle && images.length + inFlight >= max;
  const isEmpty = images.length === 0 && ownerJobs.length === 0;

  const inputRef = useRef<HTMLInputElement>(null);
  const addRef = useRef<HTMLButtonElement>(null);
  const dragDepth = useRef(0);
  const [over, setOver] = useState(false);
  const hintId = useId();

  const addFiles = (files: FileList | File[]) => {
    const list = [...files];
    if (list.length === 0) return;
    uploads.addFiles(list, owner, { max: isSingle ? 1 : max, replace: isSingle });
  };

  const openPicker = () => inputRef.current?.click();

  const hasFiles = (event: React.DragEvent) => event.dataTransfer.types.includes("Files");

  const dragHandlers = {
    onDragEnter: (event: React.DragEvent) => {
      if (!hasFiles(event)) return;
      event.preventDefault();
      dragDepth.current += 1;
      setOver(true);
    },
    onDragOver: (event: React.DragEvent) => {
      if (!hasFiles(event)) return;
      event.preventDefault();
      event.dataTransfer.dropEffect = "copy";
    },
    onDragLeave: (event: React.DragEvent) => {
      if (!hasFiles(event)) return;
      dragDepth.current = Math.max(0, dragDepth.current - 1);
      if (dragDepth.current === 0) setOver(false);
    },
    onDrop: (event: React.DragEvent) => {
      if (!hasFiles(event)) return;
      event.preventDefault();
      dragDepth.current = 0;
      setOver(false);
      addFiles(event.dataTransfer.files);
    },
  };

  const remove = (image: ImageRef) => {
    draftStore.removeImage(image.id);
    // Focus would otherwise fall to <body> when the tile disappears.
    requestAnimationFrame(() => addRef.current?.focus());
  };

  const acceptsLine = `JPG, PNG or WebP · up to ${uploads.formatBytes(uploads.IMAGE_LIMITS.maxBytes)} each${isSingle ? "" : ` · up to ${max}`}`;

  return (
    <div className={cn("uploader", over && "is-over", full && "is-full")} {...dragHandlers}>
      <div className="uploader-head">
        <p className="field-label m-0">{label}</p>
        {!isSingle && !isEmpty ? (
          <span className="uploader-count">
            {images.length} of {max}
          </span>
        ) : null}
      </div>
      {hint ? <p className="m-0 field-hint">{hint}</p> : null}

      {isEmpty ? (
        <DropZone
          ref={addRef}
          over={over}
          hintId={hintId}
          acceptsLine={acceptsLine}
          title={isSingle ? "Upload a custom thumbnail" : "Add photos"}
          onClick={openPicker}
        />
      ) : (
        <ul className={cn("uploader-grid", isSingle && "is-single")} aria-label={label}>
          {images.map((image, index) => (
            <PhotoTile
              key={image.id}
              image={image}
              index={index}
              count={images.length}
              reorderable={!isSingle}
              lead={!isSingle && index === 0 && images.length > 1}
              onRemove={() => remove(image)}
            />
          ))}
          {ownerJobs.map((job) => (
            <JobTile key={job.id} job={job} />
          ))}
          {!full && !isSingle ? (
            <li className="dropzone-cell">
              <DropZone
                ref={addRef}
                compact
                over={over}
                hintId={hintId}
                acceptsLine={acceptsLine}
                title="Add photos"
                onClick={openPicker}
              />
            </li>
          ) : null}
        </ul>
      )}

      {isSingle && !isEmpty ? (
        <div className="flex flex-wrap items-center gap-[8px]">
          <button ref={addRef} type="button" className="hbtn small" onClick={openPicker}>
            <ImagePlus aria-hidden />
            {images.length ? "Replace" : "Choose another"}
          </button>
          <span className="field-hint">{acceptsLine}</span>
        </div>
      ) : null}

      {!isSingle && !isEmpty && !full ? (
        <p id={hintId} className="m-0 field-hint">
          {acceptsLine}
        </p>
      ) : null}

      {full ? (
        <p className="uploader-note" role="status">
          {over
            ? `This stop already has ${max} photos — remove one to add another.`
            : `${max} of ${max} photos. Remove one to add another.`}
        </p>
      ) : null}

      <input
        ref={inputRef}
        type="file"
        accept={uploads.ACCEPT_ATTR}
        multiple={!isSingle}
        className="sr-only"
        tabIndex={-1}
        aria-hidden
        onChange={(event) => {
          if (event.target.files) addFiles(event.target.files);
          // Reset so picking the same file again still fires a change.
          event.target.value = "";
        }}
      />

      <p className="sr-only" aria-live="polite">
        {announcement?.owner === owner ? (
          <span key={announcement.seq}>{announcement.text}</span>
        ) : null}
      </p>
    </div>
  );
}

function DropZone({
  ref,
  compact = false,
  over,
  hintId,
  acceptsLine,
  title,
  onClick,
}: {
  ref: React.Ref<HTMLButtonElement>;
  compact?: boolean;
  over: boolean;
  hintId: string;
  acceptsLine: string;
  title: string;
  onClick: () => void;
}) {
  return (
    <button
      ref={ref}
      type="button"
      onClick={onClick}
      aria-describedby={compact ? undefined : hintId}
      className={cn("dropzone", compact && "compact", over && "is-over")}
    >
      <ImagePlus aria-hidden className="dropzone-icon" />
      <span className="dropzone-title">{over ? "Drop to add" : title}</span>
      {compact ? null : (
        <>
          <span className="dropzone-sub">
            <span className="pointer-fine">Drag and drop, or </span>
            <span className="dropzone-link">
              <span className="pointer-fine">browse</span>
              <span className="pointer-coarse">Choose from your photos</span>
            </span>
          </span>
          <span id={hintId} className="dropzone-hint">
            {acceptsLine}
          </span>
        </>
      )}
    </button>
  );
}

function PhotoTile({
  image,
  index,
  count,
  reorderable,
  lead,
  onRemove,
}: {
  image: ImageRef;
  index: number;
  count: number;
  reorderable: boolean;
  lead: boolean;
  onRemove: () => void;
}) {
  const position = `photo ${index + 1}`;
  const saved =
    image.originalBytes > image.bytes
      ? `${uploads.formatBytes(image.bytes)} · was ${uploads.formatBytes(image.originalBytes)}`
      : uploads.formatBytes(image.bytes);

  return (
    <li className="upload-tile">
      <div className="upload-tile-media">
        <StoredImage id={image.id} alt={image.alt || image.name} />
        {lead ? <span className="tile-badge">Lead</span> : null}
        <div className="tile-actions">
          {reorderable ? (
            <>
              <button
                type="button"
                className="tile-action"
                aria-label={`Move ${position} earlier`}
                disabled={index === 0}
                onClick={() => draftStore.moveImage(image.id, -1)}
              >
                <ArrowLeft aria-hidden />
              </button>
              <button
                type="button"
                className="tile-action"
                aria-label={`Move ${position} later`}
                disabled={index === count - 1}
                onClick={() => draftStore.moveImage(image.id, 1)}
              >
                <ArrowRight aria-hidden />
              </button>
            </>
          ) : null}
          <button
            type="button"
            className="tile-action danger"
            aria-label={`Remove ${position}, ${image.name}`}
            onClick={onRemove}
          >
            <Trash2 aria-hidden />
          </button>
        </div>
      </div>
      <div className="tile-body">
        <input
          className="tile-alt"
          value={image.alt}
          maxLength={140}
          placeholder="Describe this photo"
          aria-label={`Description of ${position} (read aloud to guests using screen readers)`}
          onChange={(event) => draftStore.setImageAlt(image.id, event.target.value)}
        />
        <span className="tile-meta" title={image.name}>
          {saved}
        </span>
      </div>
    </li>
  );
}

function JobTile({ job }: { job: uploads.UploadJob }) {
  const percent = Math.round(job.progress * 100);

  if (job.status === "error") {
    return (
      <li className="upload-tile is-error">
        <div className="upload-tile-media is-error">
          <AlertCircle aria-hidden className="size-[18px]" />
          <span className="tile-state">Not added</span>
          <div className="tile-actions">
            <button
              type="button"
              className="tile-action"
              aria-label={`Dismiss ${job.fileName}`}
              onClick={() => uploads.dismiss(job.id)}
            >
              <X aria-hidden />
            </button>
          </div>
        </div>
        <div className="tile-body">
          <span className="tile-name" title={job.fileName}>
            {job.fileName}
          </span>
          <span className="tile-error">{job.error?.message}</span>
          {job.error?.retryable ? (
            <button type="button" className="hbtn small self-start" onClick={() => uploads.retry(job.id)}>
              <RotateCcw aria-hidden />
              Retry
            </button>
          ) : null}
        </div>
      </li>
    );
  }

  const label = job.stage === "queued" ? STAGE_LABEL.queued : `${STAGE_LABEL[job.stage]} · ${percent}%`;

  return (
    <li className="upload-tile is-busy" aria-busy="true">
      <div className="upload-tile-media is-busy">
        <LoaderCircle aria-hidden className={cn("size-[18px]", job.stage !== "queued" && "animate-spin")} />
        <span className="tile-state">{job.stage === "queued" ? "In line" : "Adding"}</span>
        <div className="tile-actions">
          <button
            type="button"
            className="tile-action"
            aria-label={`Cancel ${job.fileName}`}
            onClick={() => uploads.cancel(job.id)}
          >
            <X aria-hidden />
          </button>
        </div>
      </div>
      <div className="tile-body">
        <span className="tile-name" title={job.fileName}>
          {job.fileName}
        </span>
        <div
          className="upload-progress"
          role="progressbar"
          aria-label={`Adding ${job.fileName}`}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={percent}
          aria-valuetext={label}
        >
          <span style={{ width: `${Math.max(percent, job.stage === "queued" ? 0 : 4)}%` }} />
        </div>
        <span className="tile-meta">{label}</span>
      </div>
    </li>
  );
}
