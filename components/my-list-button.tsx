"use client";

import { useEffect, useState } from "react";
import { IconCheck, IconLike, IconPlus } from "./icons";
import type { Poster } from "./posters";
import { isInMyList, isLiked, toggleLike, toggleMyList } from "@/lib/my-list";

export function MyListButton({
  item,
  className = "",
  size = "md",
}: {
  item: Poster;
  className?: string;
  size?: "sm" | "md" | "lg";
}) {
  const [on, setOn] = useState(false);

  useEffect(() => {
    setOn(isInMyList(item));
    function sync() {
      setOn(isInMyList(item));
    }
    window.addEventListener("minuit-list", sync);
    return () => window.removeEventListener("minuit-list", sync);
  }, [item.id, item.kind]);

  const box =
    size === "lg" ? "h-12 w-12" : size === "sm" ? "h-7 w-7" : "h-10 w-10";
  const icon = size === "lg" ? "h-5 w-5" : size === "sm" ? "h-3.5 w-3.5" : "h-4 w-4";

  return (
    <button
      type="button"
      aria-label={on ? "Retirer de Ma liste" : "Ajouter à Ma liste"}
      title={on ? "Retirer de Ma liste" : "Ajouter à Ma liste"}
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        setOn(toggleMyList(item));
      }}
      className={`inline-flex items-center justify-center rounded-full border border-white/35 bg-black/40 text-white backdrop-blur transition hover:border-white hover:bg-white/10 ${box} ${className}`}
    >
      {on ? <IconCheck className={icon} /> : <IconPlus className={icon} />}
    </button>
  );
}

export function LikeButton({
  item,
  className = "",
}: {
  item: Pick<Poster, "id" | "kind">;
  className?: string;
}) {
  const [on, setOn] = useState(false);

  useEffect(() => {
    setOn(isLiked(item));
    function sync() {
      setOn(isLiked(item));
    }
    window.addEventListener("minuit-likes", sync);
    return () => window.removeEventListener("minuit-likes", sync);
  }, [item.id, item.kind]);

  return (
    <button
      type="button"
      aria-label={on ? "Retirer le like" : "J’aime"}
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        setOn(toggleLike(item));
      }}
      className={`inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/35 bg-black/40 text-white backdrop-blur transition hover:border-white hover:bg-white/10 ${
        on ? "border-[#e50914] text-[#e50914]" : ""
      } ${className}`}
    >
      <IconLike className="h-4 w-4" />
    </button>
  );
}
