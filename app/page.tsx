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
  status: string;
  screening_date: string | null;
  screening_time: string | null;
};

type Showtime = {
  id: number;
  created_at: string;
  screening_id: number;
  screening_date: string;
  screening_time: string;
  status: string;
};

export default function AdminPage() {
  const [title, setTitle] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState("");

  const [movies, setMovies] = useState<Movie[]>([]);
  const [screenings, setScreenings] = useState<Screening[]>([]);
  const [showtimes, setShowtimes] = useState<Showtime[]>([]);

  const [dateValues, setDateValues] = useState<Record<number, string>>({});
  const [timeValues, setTimeValues] = useState<Record<number, string>>({});

  const [savingMovie, setSavingMovie] = useState(false);
  const [savingShowtime, setSavingShowtime] = useState<number | null>(null);

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

  async function loadShowtimes() {
    const { data } = await supabase
      .from("showtimes")
      .select("*")
      .order("screening_date", { ascending: true })
      .order("screening_time", { ascending: true });

    setShowtimes((data ?? []) as Showtime[]);
  }

  async function loadAll() {
    await Promise.all([
      loadMovies(),
      loadScreenings(),
      loadShowtimes(),
    ]);
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
        loadMovies
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
        loadScreenings
      )
      .subscribe();

    const showtimeChannel = supabase
      .channel("admin-showtimes-live")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "showtimes",
        },
        loadShowtimes
      )
      .subscribe();

    return () => {
      supabase.removeChannel(movieChannel);
      supabase.removeChannel(screeningChannel);
      supabase.removeChannel(showtimeChannel);
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

    const availableCount = movies.filter(
      (movie) => movie.status === "available"
    ).length;

    if (availableCount >= 9) {
      alert("The movie pool already has 9 available movies.");
      return;
    }

    setSavingMovie(true);

    const ext = file.name.split(".").pop() || "jpg";
    const path = `${Date.now()}-${Math.random()
      .toString(36)
      .slice(2)}.${ext}`;

    const upload = await supabase.storage
      .from("posters")
      .upload(path, file, {
        upsert: false,
        contentType: file.type || "image/jpeg",
      });

    if (upload.error) {
      setSavingMovie(false);
      alert(upload.error.message);
      return;
    }

    const { data: urlData } = supabase.storage
      .from("posters")
      .getPublicUrl(path);

    const insert = await supabase
      .from("movies")
      .insert({
        title: title.trim(),
        poster_url: urlData.publicUrl,
        status: "available",
      });

    setSavingMovie(false);

    if (insert.error) {
      alert(insert.error.message);
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

  async function addShowtime(screening: Screening) {
    const date = dateValues[screening.id];
    const time = timeValues[screening.id];

    if (!date || !time) {
      alert("Please choose both date and time.");
      return;
    }

    setSavingShowtime(screening.id);

    const { error } = await supabase
      .from("showtimes")
      .insert({
        screening_id: screening.id,
        screening_date: date,
        screening_time: time,
        status: "available",
      });

    setSavingShowtime(null);

    if (error) {
      alert(error.message);
      return;
    }

    setDateValues({
      ...dateValues,
      [screening.id]: "",
    });

    setTimeValues({
      ...timeValues,
      [screening.id]: "",
    });

    await loadShowtimes();
  }

  async function deleteShowtime(showtime: Showtime) {
    const { error } = await supabase
      .from("showtimes")
      .delete()
      .eq("id", showtime.id);

    if (error) {
      alert(error.message);
      return;
    }

    await loadShowtimes();
  }

  const waitingScreenings = screenings.filter(
    (screening) => screening.status === "waiting_schedule"
  );

  return (
    <main className="shell">
      <header className="header">
        <div>
          <h1 className="brand" style={{ fontSize: 34 }}>
            ADMIN
          </h1>

          <div className="subtitle">
            Manage Our Cinema
          </div>
        </div>

        <Link href="/" className="admin-link">
          Guest View
        </Link>
      </header>

      <section className="admin-card">
        <h2>Schedule Selected Movie</h2>

        {waitingScreenings.length === 0 ? (
          <div className="status">
            No movie is waiting for scheduling.
          </div>
        ) : (
          waitingScreenings.map((screening) => {
            const currentShowtimes = showtimes.filter(
              (showtime) =>
                showtime.screening_id === screening.id
            );

            return (
              <div
                key={screening.id}
                style={{
                  marginBottom: 28,
                  paddingBottom: 28,
                  borderBottom: "1px solid rgba(255,255,255,0.12)",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    gap: 16,
                    alignItems: "flex-start",
                    marginBottom: 20,
                  }}
                >
                  <img
                    src={screening.poster_url}
                    alt={screening.movie_title}
                    style={{
                      width: 82,
                      height: 123,
                      objectFit: "cover",
                      borderRadius: 8,
                    }}
                  />

                  <div>
                    <div
                      className="row-title"
                      style={{
                        fontSize: 20,
                        marginBottom: 6,
                      }}
                    >
                      {screening.movie_title}
                    </div>

                    <div className="row-status">
                      Add several possible showtimes.
                    </div>
                  </div>
                </div>

                <label className="label">
                  Date
                </label>

                <input
                  className="text-input"
                  type="date"
                  value={dateValues[screening.id] || ""}
                  onChange={(e) =>
                    setDateValues({
                      ...dateValues,
                      [screening.id]: e.target.value,
                    })
                  }
                />

                <label className="label">
                  Time
                </label>

                <input
                  className="text-input"
                  type="time"
                  value={timeValues[screening.id] || ""}
                  onChange={(e) =>
                    setTimeValues({
                      ...timeValues,
                      [screening.id]: e.target.value,
                    })
                  }
                />

                <div className="actions">
                  <button
                    className="primary"
                    onClick={() => addShowtime(screening)}
                    disabled={savingShowtime === screening.id}
                  >
                    {savingShowtime === screening.id
                      ? "Adding…"
                      : "Add Showtime"}
                  </button>
                </div>

                {currentShowtimes.length > 0 && (
                  <div
                    style={{
                      marginTop: 24,
                    }}
                  >
                    <div
                      className="label"
                      style={{
                        marginBottom: 10,
                      }}
                    >
                      Available for Guest
                    </div>

                    {currentShowtimes.map((showtime) => (
                      <div
                        key={showtime.id}
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          gap: 12,
                          padding: "12px 0",
                          borderTop:
                            "1px solid rgba(255,255,255,0.08)",
                        }}
                      >
                        <div>
                          <strong>
                            {showtime.screening_date}
                          </strong>
                          {" · "}
                          {showtime.screening_time.slice(0, 5)}
                          {showtime.status === "selected" && (
                            <span> · SELECTED</span>
                          )}
                        </div>

                        {showtime.status === "available" && (
                          <button
                            className="danger"
                            onClick={() =>
                              deleteShowtime(showtime)
                            }
                          >
                            Delete
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {currentShowtimes.some(
                  (showtime) =>
                    showtime.status === "available"
                ) && (
                  <div
                    style={{
                      marginTop: 22,
                    }}
                  >
                    <Link
                      href="/"
                      className="primary"
                      style={{
                        display: "inline-block",
                        textDecoration: "none",
                        textAlign: "center",
                      }}
                    >
                      Go to Guest View
                    </Link>
                  </div>
                )}
              </div>
            );
          })
        )}
      </section>

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
              pickFile(e.target.files?.[0] ?? null)
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
              disabled={savingMovie}
            >
              {savingMovie
                ? "Saving…"
                : "Add Movie"}
            </button>
          </div>
        </form>
      </section>

      <section className="admin-card">
        <h2>
          Movie Pool (
          {
            movies.filter(
              (movie) =>
                movie.status === "available"
            ).length
          }
          /9 available)
        </h2>

        <div className="admin-list">
          {movies.map((movie) => (
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
          ))}
        </div>
      </section>
    </main>
  );
}
