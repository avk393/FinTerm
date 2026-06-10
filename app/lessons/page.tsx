"use client";

import { useState } from "react";
import Link from "next/link";
import Header from "@/components/Header";

type LessonType = "thesis" | "academic" | "youtube";

const LESSON_TYPES: { value: LessonType; label: string }[] = [
  { value: "thesis", label: "My Thesis" },
  { value: "academic", label: "Academic Paper" },
  { value: "youtube", label: "YouTube Video" },
];

export default function LessonsPage() {
  const [lessonType, setLessonType] = useState<LessonType>("thesis");
  const [text, setText] = useState("");
  const [title, setTitle] = useState("");
  const [url, setUrl] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [message, setMessage] = useState("");

  async function handleSubmit() {
    setStatus("loading");
    setMessage("");

    const body =
      lessonType === "youtube"
        ? { type: lessonType, url }
        : lessonType === "academic"
        ? { type: lessonType, text, title }
        : { type: lessonType, text };

    try {
      const res = await fetch("/api/lessons/ingest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Ingestion failed");
      setStatus("success");
      setMessage(
        lessonType === "thesis"
          ? `Ingested ${data.beliefIds?.length ?? 0} belief(s)`
          : `Ingested "${data.title}" — ${data.chunkCount} chunk(s)`
      );
      setText("");
      setTitle("");
      setUrl("");
    } catch (err) {
      setStatus("error");
      setMessage(err instanceof Error ? err.message : "Unknown error");
    }
  }

  const isDisabled =
    status === "loading" ||
    (lessonType === "youtube" ? !url.trim() : !text.trim());

  return (
    <div className="min-h-screen bg-rh-bg">
      <Header />
      <main className="mx-auto max-w-[800px] px-8 pb-20">
        <div className="mb-8 flex items-center gap-4">
          <Link href="/" className="text-rh-muted hover:text-rh-text transition-colors text-sm">
            ← Back
          </Link>
          <h1 className="text-2xl font-bold text-rh-text">Technical Lessons</h1>
        </div>

        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <label className="text-xs text-rh-muted uppercase tracking-wide">Source type</label>
            <select
              value={lessonType}
              onChange={(e) => {
                setLessonType(e.target.value as LessonType);
                setMessage("");
                setStatus("idle");
              }}
              className="w-48 rounded-lg bg-rh-elevated px-4 py-2.5 text-sm text-rh-text focus:outline-none focus:ring-1 focus:ring-rh-border"
            >
              {LESSON_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>

          {lessonType === "academic" && (
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Paper title (optional)"
              className="w-full rounded-lg bg-rh-elevated px-4 py-3 text-sm text-rh-text placeholder:text-rh-muted focus:outline-none focus:ring-1 focus:ring-rh-border"
            />
          )}

          {lessonType === "youtube" ? (
            <input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="YouTube URL (e.g. https://youtu.be/...)"
              className="w-full rounded-lg bg-rh-elevated px-4 py-3 text-sm text-rh-text placeholder:text-rh-muted focus:outline-none focus:ring-1 focus:ring-rh-border"
            />
          ) : (
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={
                lessonType === "thesis"
                  ? "Paste your investment thesis..."
                  : "Paste the paper text or abstract..."
              }
              className="min-h-[200px] w-full resize-y rounded-lg bg-rh-elevated px-4 py-3 text-sm text-rh-text placeholder:text-rh-muted focus:outline-none focus:ring-1 focus:ring-rh-border"
            />
          )}

          <div className="flex items-center gap-4">
            <button
              onClick={handleSubmit}
              disabled={isDisabled}
              className="self-start rounded-lg bg-rh-green px-5 py-2.5 text-sm font-semibold text-black hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {status === "loading" ? "Adding..." : "Add theory or lesson"}
            </button>

            {message && (
              <span className={`text-sm ${status === "error" ? "text-red-400" : "text-rh-muted"}`}>
                {message}
              </span>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
