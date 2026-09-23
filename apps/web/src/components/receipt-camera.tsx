"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { captureFromVideo } from "@/lib/image";
import { cn } from "@/lib/utils";

type Mode = "idle" | "starting" | "live" | "preview";

const MAX_PHOTOS = 4;

const VIDEO_CONSTRAINTS: MediaStreamConstraints[] = [
  { audio: false, video: { facingMode: { ideal: "environment" }, width: { ideal: 1920 }, height: { ideal: 1080 } } },
  { audio: false, video: { facingMode: { ideal: "environment" } } },
  { audio: false, video: true },
];

async function requestCameraStream(): Promise<MediaStream> {
  if (!navigator.mediaDevices?.getUserMedia) {
    throw new Error("unsupported");
  }

  const tryAll = async () => {
    let lastError: unknown;
    for (const constraints of VIDEO_CONSTRAINTS) {
      try {
        return await navigator.mediaDevices.getUserMedia(constraints);
      } catch (error) {
        lastError = error;
      }
    }
    throw lastError instanceof Error ? lastError : new Error("permission");
  };

  return Promise.race([
    tryAll(),
    new Promise<MediaStream>((_, reject) => {
      window.setTimeout(() => reject(new Error("timeout")), 12000);
    }),
  ]);
}

function bindStream(video: HTMLVideoElement, stream: MediaStream) {
  video.muted = true;
  video.defaultMuted = true;
  video.playsInline = true;
  video.autoplay = true;
  video.setAttribute("playsinline", "true");
  video.setAttribute("webkit-playsinline", "true");
  video.srcObject = stream;
  return video.play();
}

export function ReceiptCamera({
  busy,
  onCapture,
}: {
  busy: boolean;
  onCapture: (files: File[]) => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const previewUrlsRef = useRef<string[]>([]);
  const [mode, setMode] = useState<Mode>("idle");
  const [shots, setShots] = useState<File[]>([]);
  const [previewUrls, setPreviewUrls] = useState<string[]>([]);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [videoReady, setVideoReady] = useState(false);

  function stopStream() {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setVideoReady(false);
  }

  function revokeUrls(urls: string[]) {
    urls.forEach((url) => URL.revokeObjectURL(url));
  }

  useEffect(() => {
    return () => {
      stopStream();
      revokeUrls(previewUrlsRef.current);
    };
  }, []);

  useLayoutEffect(() => {
    if (mode !== "live") return;
    const video = videoRef.current;
    const stream = streamRef.current;
    if (!video || !stream) return;
    if (video.srcObject !== stream) {
      void bindStream(video, stream).catch(() => {
        setCameraError("Couldn’t start the camera preview. Pick a photo instead.");
      });
    }
  }, [mode]);

  function addShots(files: File[]) {
    const room = MAX_PHOTOS - shots.length;
    const nextFiles = files.slice(0, room);
    if (nextFiles.length === 0) {
      setCameraError(`That’s ${MAX_PHOTOS} photos — enough for a long slip.`);
      return;
    }
    stopStream();
    const urls = nextFiles.map((file) => URL.createObjectURL(file));
    const nextUrls = [...previewUrls, ...urls];
    previewUrlsRef.current = nextUrls;
    setShots((current) => [...current, ...nextFiles]);
    setPreviewUrls(nextUrls);
    setMode("preview");
  }

  async function openLiveCamera() {
    setCameraError(null);
    setMode("starting");
    try {
      const stream = await requestCameraStream();
      streamRef.current = stream;
      const video = videoRef.current;
      if (video) {
        await bindStream(video, stream);
        setVideoReady(true);
      }
      setMode("live");
    } catch {
      stopStream();
      setMode(shots.length > 0 ? "preview" : "idle");
      setCameraError("This browser blocked the live camera. Use the phone’s camera app instead.");
    }
  }

  async function snap() {
    const video = videoRef.current;
    if (!video || video.videoWidth < 2) {
      setCameraError("Camera isn’t ready yet. Wait for the live picture, or pick a photo.");
      return;
    }
    try {
      addShots([await captureFromVideo(video)]);
    } catch {
      setCameraError("Couldn’t grab that frame. Try again.");
    }
  }

  function onPicked(list: FileList | null) {
    if (!list?.length) return;
    setCameraError(null);
    addShots(Array.from(list));
  }

  function removeLast() {
    const lastUrl = previewUrls[previewUrls.length - 1];
    if (lastUrl) URL.revokeObjectURL(lastUrl);
    const nextUrls = previewUrls.slice(0, -1);
    const nextShots = shots.slice(0, -1);
    previewUrlsRef.current = nextUrls;
    setPreviewUrls(nextUrls);
    setShots(nextShots);
    if (nextShots.length === 0) {
      setMode("idle");
      return;
    }
    setMode("preview");
  }

  function retakeLast() {
    removeLast();
    void openLiveCamera();
  }

  const canAddMore = shots.length < MAX_PHOTOS;
  const showChooser = mode === "idle" || mode === "starting";

  return (
    <div className="relative mt-6">
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        multiple
        className="sr-only"
        disabled={busy}
        onChange={(event) => {
          onPicked(event.target.files);
          event.target.value = "";
        }}
      />

      {showChooser ? (
        <div className="flex flex-col gap-2">
          <button
            type="button"
            disabled={busy || mode === "starting"}
            onClick={() => void openLiveCamera()}
            className="relative flex min-h-[280px] w-full flex-col items-center justify-center gap-3 rounded-[14px] border border-dashed border-perf bg-inset text-center hover:border-ink disabled:opacity-70"
          >
            <span className="inline-flex size-[54px] items-center justify-center rounded-full border border-perf bg-docket">
              <span className="block size-5 rounded-full border-2 border-ink" />
            </span>
            <span className="text-[17px] font-semibold text-ink">
              {mode === "starting" ? "Waiting for the camera…" : "Open the camera"}
            </span>
            <span className="text-[13px] text-mute">
              {mode === "starting"
                ? "Allow camera access on this phone if it asks"
                : "You’ll see the viewfinder, then snap the slip"}
            </span>
          </button>
          <label className="flex min-h-11 cursor-pointer items-center justify-center text-[13px] text-mute underline">
            Use the phone’s camera app instead
            <input
              type="file"
              accept="image/*"
              capture="environment"
              multiple
              className="sr-only"
              disabled={busy}
              onChange={(event) => {
                onPicked(event.target.files);
                event.target.value = "";
              }}
            />
          </label>
        </div>
      ) : null}

      <div className={cn(mode === "live" ? "overflow-hidden rounded-[14px] bg-ink" : "contents")}>
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          controls={false}
          onPlaying={() => setVideoReady(true)}
          className={cn(
            "bg-ink object-cover",
            mode === "live"
              ? "relative h-[min(70vh,440px)] w-full"
              : "pointer-events-none fixed top-0 left-[-10000px] h-[240px] w-[180px] opacity-0",
          )}
        />
        {mode === "live" ? (
          <div className="relative flex flex-col gap-2 bg-docket px-4 py-4">
            {!videoReady ? (
              <p className="absolute inset-x-4 -top-10 text-center text-[13px] text-docket">Point at the slip…</p>
            ) : null}
            <p className="text-center font-mono text-[11px] text-mute">
              {shots.length === 0 ? "Photo 1" : `Photo ${shots.length + 1} of the same slip`}
            </p>
            <Button type="button" disabled={busy || !videoReady} onClick={() => void snap()}>
              Snap
            </Button>
            <button
              type="button"
              className="min-h-11 bg-transparent font-sans text-[13px] text-mute underline"
              onClick={() => fileRef.current?.click()}
            >
              Pick a photo instead
            </button>
            {shots.length > 0 ? (
              <button
                type="button"
                className="min-h-11 bg-transparent font-sans text-[13px] text-mute underline"
                onClick={() => {
                  stopStream();
                  setMode("preview");
                }}
              >
                Back to the photos I have
              </button>
            ) : null}
          </div>
        ) : null}
      </div>

      {mode === "preview" && shots.length > 0 ? (
        <div className="overflow-hidden rounded-[14px] border border-perf bg-inset">
          {previewUrls.length > 1 ? (
            <div className="flex gap-2 overflow-x-auto border-b border-dashed border-rule px-3 py-3">
              {previewUrls.map((url, index) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  key={url}
                  src={url}
                  alt={`Receipt photo ${index + 1}`}
                  className="h-[72px] w-[52px] shrink-0 rounded-md border border-perf object-cover"
                />
              ))}
            </div>
          ) : null}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={previewUrls[previewUrls.length - 1]}
            alt="The receipt you just photographed"
            className="max-h-[min(70vh,440px)] w-full object-contain"
          />
          <div className="flex flex-col gap-2 bg-docket px-4 py-4">
            <p className="text-center text-[13px] leading-snug text-mute">
              {shots.length === 1
                ? "Long slip? Add a photo of the rest before we read it."
                : `${shots.length} photos of this slip. We’ll read them as one bill.`}
            </p>
            <Button type="button" disabled={busy} onClick={() => onCapture(shots)}>
              {busy ? "Reading the slip…" : shots.length > 1 ? "Looks good — read these" : "Looks good — read it"}
            </Button>
            {canAddMore ? (
              <Button
                type="button"
                variant="quiet"
                disabled={busy}
                onClick={() => void openLiveCamera()}
              >
                Add the rest of the slip
              </Button>
            ) : null}
            <button
              type="button"
              disabled={busy}
              className="min-h-11 bg-transparent font-sans text-[13px] text-mute underline"
              onClick={retakeLast}
            >
              Retake last photo
            </button>
          </div>
        </div>
      ) : null}

      {cameraError ? <p className={cn("mt-2.5 text-sm text-alert")}>{cameraError}</p> : null}
    </div>
  );
}
