"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { Movie } from "@/types/movie";

type Screening = {
  id: number;
  created_at: string;
  movie_id: number;
  movie_title: string;
  poster_url: string;
  status: "waiting_schedule" | "scheduled";
  screening_date: string | null;
  screening_time: string | null;
};

export default function AdminPage() {
  const [title, setTitle] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState("");
  const [movies, setMovies] = useState<Movie[]>([]);
  const [screenings, setScreenings] = useState<Screening[]>([]);
  const [saving, setSaving] = useState(false);

  const [dateValues, setDateValues] = useState<Record<number, string>>({});
  const [timeValues, setTimeValues] = useState<Record<number, string>>({});

  async function loadMovies() {
    const { data } = await supabase
      .from("movies")
      .select("*")
      .order("created_at", { ascending: true });

    setMovies((data ?? []) as Movie[]);
  }

  async function loadScreenings() {
    const { data } = await supabase
      .from("screenings")
      .select("*")
      .order("created_at", { ascending: false });

    setScreenings((data ?? []) as Screening[]);
  }

  async function loadAll() {
    await Promise.all([loadMovies(), loadScreenings()]);
  }

  useEffect(() => {
    loadAll();

    const movieChannel = supabase
      .channel("admin-movies-live")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "movies",
        },
        () => loadMovies()
      )
      .subscribe();

    const screeningChannel = supabase
      .channel("admin-screenings-live")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "screenings",
        },
        () => loadScreenings()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(movieChannel);
      supabase.removeChannel(screeningChannel);
    };
  }, []);

  function pickFile(f: File | null) {
    setFile(f);

    if (preview) {
      URL.revokeObjectURL(preview);
    }

    setPreview(f ? URL.createObjectURL(f) : "");
  }

  async function submitMovie(e: FormEvent) {
    e.preventDefault();

    if (!title.trim() || !file) {
      alert("Please add a poster and title.");
      return;
    }

    const available = movies.filter(
      (movie) => movie.status === "available"
    ).length;

    if (available >= 9) {
      alert("The movie pool already has 9 available movies.");
      return;
    }

    setSaving(true);

    const ext = file.name.split(".").pop() || "jpg";
    const path = `${Date.now()}-${Math.random()
      .toString(36)
      .slice(2)}.${ext}`;

    const uploadResult = await supabase.storage
      .from("posters")
      .upload(path, file, {
        upsert: false,
        contentType: file.type || "image/jpeg",
      });

    if (uploadResult.error) {
      setSaving(false);
      alert(uploadResult.error.message);
      return;
    }

    const { data: urlData } = supabase.storage
      .from("posters")
      .getPublicUrl(path);

    const insertResult = await supabase
      .from("movies")
      .insert({
        title: title.trim(),
        poster_url: urlData.publicUrl,
        status: "available",
      });

    setSaving(false);

    if (insertResult.error) {
      alert(insertResult.error.message);
      return;
    }

    setTitle("");
    pickFile(null);

    await loadMovies();
  }

  async function removeMovie(movie: Movie) {
    if (!confirm(`Delete "${movie.title}"?`)) {
      return;
    }

    const { error } = await supabase
      .from("movies")
      .delete()
      .eq("id", movie.id);

    if (error) {
      alert(error.message);
      return;
    }

    await loadMovies();
  }

  async function publishScreening(screening: Screening) {
    const date = dateValues[screening.id];
    const time = timeValues[screening.id];

    if (!date || !time) {
      alert("Please choose both date and time.");
      return;
    }

    const { error } = await supabase
      .from("screenings")
      .update({
        screening_date: date,
        screening_time: time,
        status: "scheduled",
      })
      .eq("id", screening.id);

    if (error) {
      alert(error.message);
      return;
    }

    alert("Screening published.");

    await loadScreenings();
  }

  const waitingScreenings = screenings.filter(
    (screening) => screening.status === "waiting_schedule"
  );

  const scheduledScreenings = screenings.filter(
    (screening) => screening.status === "scheduled"
  );

  return (
    <main className="shell">
      <header className="header">
        <div>
          <h1
            className="brand"
            style={{
              fontSize: 34,
            }}
          >
            ADMIN
          </h1>

          <div className="subtitle">
            Manage Our Cinema
          </div>
        </div>

        <Link
          href="/"
          className="admin-link"
        >
          Back
        </Link>
      </header>

      <section className="admin-card">
        <h2>Add Movie</h2>

        <form onSubmit={submitMovie}>
          <label className="label">
            Poster
          </label>

          <input
            className="file-input"
            type="file"
            accept="image/*"
            onChange={(e) =>
              pickFile(
                e.target.files?.[0] ?? null
              )
            }
          />

          {preview && (
            <img
              className="preview"
              src={preview}
              alt="preview"
            />
          )}

          <label className="label">
            Movie title
          </label>

          <input
            className="text-input"
            value={title}
            onChange={(e) =>
              setTitle(e.target.value)
            }
            placeholder="Enter movie title"
          />

          <div className="actions">
            <button
              className="primary"
              type="submit"
              disabled={saving}
            >
              {saving
                ? "Saving…"
                : "Add Movie"}
            </button>
          </div>
        </form>
      </section>

      <section className="admin-card">
        <h2>
          Waiting for Scheduling
        </h2>

        {waitingScreenings.length === 0 ? (
          <div className="status">
            No movie is waiting for scheduling.
          </div>
        ) : (
          <div className="admin-list">
            {waitingScreenings.map(
              (screening) => (
                <div
                  className="admin-row"
                  key={screening.id}
                  style={{
                    gridTemplateColumns:
                      "70px 1fr",
                    alignItems: "start",
                  }}
                >
                  <img
                    className="admin-thumb"
                    src={
                      screening.poster_url
                    }
                    alt={
                      screening.movie_title
                    }
                    style={{
                      width: 70,
                      height: 105,
                    }}
                  />

                  <div>
                    <div className="row-title">
                      {
                        screening.movie_title
                      }
                    </div>

                    <label className="label">
                      Screening date
                    </label>

                    <input
                      className="text-input"
                      type="date"
                      value={
                        dateValues[
                          screening.id
                        ] || ""
                      }
                      onChange={(e) =>
                        setDateValues({
                          ...dateValues,
                          [screening.id]:
                            e.target.value,
                        })
                      }
                    />

                    <label className="label">
                      Screening time
                    </label>

                    <input
                      className="text-input"
                      type="time"
                      value={
                        timeValues[
                          screening.id
                        ] || ""
                      }
                      onChange={(e) =>
                        setTimeValues({
                          ...timeValues,
                          [screening.id]:
                            e.target.value,
                        })
                      }
                    />

                    <div className="actions">
                      <button
                        className="primary"
                        onClick={() =>
                          publishScreening(
                            screening
                          )
                        }
                      >
                        Publish Screening
                      </button>
                    </div>
                  </div>
                </div>
              )
            )}
          </div>
        )}
      </section>

      <section className="admin-card">
        <h2>
          Scheduled Screenings
        </h2>

        {scheduledScreenings.length === 0 ? (
          <div className="status">
            No scheduled screenings yet.
          </div>
        ) : (
          <div className="admin-list">
            {scheduledScreenings.map(
              (screening) => (
                <div
                  className="admin-row"
                  key={screening.id}
                >
                  <img
                    className="admin-thumb"
                    src={
                      screening.poster_url
                    }
                    alt={
                      screening.movie_title
                    }
                  />

                  <div>
                    <div className="row-title">
                      {
                        screening.movie_title
                      }
                    </div>

                    <div className="row-status">
                      {
                        screening.screening_date
                      }{" "}
                      {
                        screening.screening_time
                      }
                    </div>
                  </div>
                </div>
              )
            )}
          </div>
        )}
      </section>

      <section className="admin-card">
        <h2>
          Movie Pool (
          {
            movies.filter(
              (movie) =>
                movie.status ===
                "available"
            ).length
          }
          /9 available)
        </h2>

        <div className="admin-list">
          {movies.length === 0 ? (
            <div className="status">
              No movies yet.
            </div>
          ) : (
            movies.map((movie) => (
              <div
                className="admin-row"
                key={movie.id}
              >
                <img
                  className="admin-thumb"
                  src={movie.poster_url}
                  alt={movie.title}
                />

                <div>
                  <div className="row-title">
                    {movie.title}
                  </div>

                  <div className="row-status">
                    {movie.status}
                  </div>
                </div>

                <button
                  className="danger"
                  onClick={() =>
                    removeMovie(movie)
                  }
                >
                  Delete
                </button>
              </div>
            ))
          )}
        </div>
      </section>
    </main>
  );
}
