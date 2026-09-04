"use client";

import Link from "next/link";
import {
  FormEvent,
  useEffect,
  useState,
} from "react";
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
  watch_url: string | null;
  watch_code: string | null;
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

  const [file, setFile] =
    useState<File | null>(null);

  const [preview, setPreview] =
    useState("");

  const [movies, setMovies] =
    useState<Movie[]>([]);

  const [screenings, setScreenings] =
    useState<Screening[]>([]);

  const [showtimes, setShowtimes] =
    useState<Showtime[]>([]);

  const [dateValues, setDateValues] =
    useState<Record<number, string>>({});

  const [timeValues, setTimeValues] =
    useState<Record<number, string>>({});

  const [watchValues, setWatchValues] =
    useState<Record<number, string>>({});

  const [codeValues, setCodeValues] =
    useState<Record<number, string>>({});

  const [savingMovie, setSavingMovie] =
    useState(false);

  const [
    savingShowtime,
    setSavingShowtime,
  ] = useState<number | null>(null);

  const [
    savingWatchInfo,
    setSavingWatchInfo,
  ] = useState<number | null>(null);

  async function loadMovies() {
    const { data } = await supabase
      .from("movies")
      .select("*")
      .order("created_at", {
        ascending: true,
      });

    setMovies(
      (data ?? []) as Movie[]
    );
  }

  async function loadScreenings() {
    const { data } = await supabase
      .from("screenings")
      .select("*")
      .order("created_at", {
        ascending: false,
      });

    const items =
      (data ?? []) as Screening[];

    setScreenings(items);

    setWatchValues(
      (currentValues) => {
        const nextValues = {
          ...currentValues,
        };

        items.forEach(
          (screening) => {
            if (
              nextValues[
                screening.id
              ] === undefined
            ) {
              nextValues[
                screening.id
              ] =
                screening.watch_url ??
                "";
            }
          }
        );

        return nextValues;
      }
    );

    setCodeValues(
      (currentValues) => {
        const nextValues = {
          ...currentValues,
        };

        items.forEach(
          (screening) => {
            if (
              nextValues[
                screening.id
              ] === undefined
            ) {
              nextValues[
                screening.id
              ] =
                screening.watch_code ??
                "";
            }
          }
        );

        return nextValues;
      }
    );
  }

  async function loadShowtimes() {
    const { data } = await supabase
      .from("showtimes")
      .select("*")
      .order("screening_date", {
        ascending: true,
      })
      .order("screening_time", {
        ascending: true,
      });

    setShowtimes(
      (data ?? []) as Showtime[]
    );
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

    const screeningChannel =
      supabase
        .channel(
          "admin-screenings-live"
        )
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

    const showtimeChannel =
      supabase
        .channel(
          "admin-showtimes-live"
        )
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
      supabase.removeChannel(
        movieChannel
      );

      supabase.removeChannel(
        screeningChannel
      );

      supabase.removeChannel(
        showtimeChannel
      );
    };
  }, []);

  function pickFile(
    f: File | null
  ) {
    setFile(f);

    if (preview) {
      URL.revokeObjectURL(
        preview
      );
    }

    setPreview(
      f
        ? URL.createObjectURL(f)
        : ""
    );
  }

  async function submitMovie(
    e: FormEvent
  ) {
    e.preventDefault();

    if (
      !title.trim() ||
      !file
    ) {
      alert(
        "Please add a poster and title."
      );
      return;
    }

    const availableCount =
      movies.filter(
        (movie) =>
          movie.status ===
          "available"
      ).length;

    if (
      availableCount >= 9
    ) {
      alert(
        "The movie pool already has 9 available movies."
      );
      return;
    }

    setSavingMovie(true);

    const ext =
      file.name
        .split(".")
        .pop() || "jpg";

    const path =
      `${Date.now()}-${Math.random()
        .toString(36)
        .slice(2)}.${ext}`;

    const upload =
      await supabase.storage
        .from("posters")
        .upload(
          path,
          file,
          {
            upsert: false,
            contentType:
              file.type ||
              "image/jpeg",
          }
        );

    if (upload.error) {
      setSavingMovie(false);

      alert(
        upload.error.message
      );

      return;
    }

    const { data: urlData } =
      supabase.storage
        .from("posters")
        .getPublicUrl(path);

    const insert =
      await supabase
        .from("movies")
        .insert({
          title:
            title.trim(),
          poster_url:
            urlData.publicUrl,
          status:
            "available",
        });

    setSavingMovie(false);

    if (insert.error) {
      alert(
        insert.error.message
      );

      return;
    }

    setTitle("");
    pickFile(null);

    await loadMovies();
  }

  async function removeMovie(
    movie: Movie
  ) {
    const ok = confirm(
      `Delete "${movie.title}"?`
    );

    if (!ok) return;

    const { error } =
      await supabase
        .from("movies")
        .delete()
        .eq(
          "id",
          movie.id
        );

    if (error) {
      alert(error.message);
      return;
    }

    await loadMovies();
  }

  async function saveWatchInfo(
    screening: Screening
  ) {
    const watchUrl =
      watchValues[
        screening.id
      ]?.trim() || null;

    const watchCode =
      codeValues[
        screening.id
      ]?.trim() || null;

    setSavingWatchInfo(
      screening.id
    );

    const { error } =
      await supabase
        .from("screenings")
        .update({
          watch_url:
            watchUrl,
          watch_code:
            watchCode,
        })
        .eq(
          "id",
          screening.id
        );

    setSavingWatchInfo(null);

    if (error) {
      alert(error.message);
      return;
    }

    alert(
      "Watch info saved."
    );

    await loadScreenings();
  }

  async function addShowtime(
    screening: Screening
  ) {
    const date =
      dateValues[
        screening.id
      ];

    const time =
      timeValues[
        screening.id
      ];

    if (
      !date ||
      !time
    ) {
      alert(
        "Please choose both date and time."
      );
      return;
    }

    setSavingShowtime(
      screening.id
    );

    const watchUrl =
      watchValues[
        screening.id
      ]?.trim() || null;

    const watchCode =
      codeValues[
        screening.id
      ]?.trim() || null;

    const {
      error: watchError,
    } = await supabase
      .from("screenings")
      .update({
        watch_url:
          watchUrl,
        watch_code:
          watchCode,
      })
      .eq(
        "id",
        screening.id
      );

    if (watchError) {
      setSavingShowtime(null);

      alert(
        watchError.message
      );

      return;
    }

    const { error } =
      await supabase
        .from("showtimes")
        .insert({
          screening_id:
            screening.id,
          screening_date:
            date,
          screening_time:
            time,
          status:
            "available",
        });

    setSavingShowtime(null);

    if (error) {
      alert(error.message);
      return;
    }

    setDateValues({
      ...dateValues,
      [screening.id]:
        "",
    });

    setTimeValues({
      ...timeValues,
      [screening.id]:
        "",
    });

    await loadAll();
  }

  async function deleteShowtime(
    showtime: Showtime
  ) {
    const { error } =
      await supabase
        .from("showtimes")
        .delete()
        .eq(
          "id",
          showtime.id
        );

    if (error) {
      alert(error.message);
      return;
    }

    await loadShowtimes();
  }

  async function cancelScreening(
    screening: Screening
  ) {
    const ok = confirm(
      `Cancel "${screening.movie_title}" screening? The movie ticket will disappear.`
    );

    if (!ok) return;

    const {
      error: showtimeError,
    } = await supabase
      .from("showtimes")
      .update({
        status:
          "cancelled",
      })
      .eq(
        "screening_id",
        screening.id
      );

    if (showtimeError) {
      alert(
        showtimeError.message
      );
      return;
    }

    const {
      error:
        screeningError,
    } = await supabase
      .from("screenings")
      .update({
        status:
          "cancelled",
        screening_date:
          null,
        screening_time:
          null,
      })
      .eq(
        "id",
        screening.id
      );

    if (
      screeningError
    ) {
      alert(
        screeningError.message
      );
      return;
    }

    alert(
      "Screening cancelled."
    );

    await loadAll();
  }

  const waitingScreenings =
    screenings.filter(
      (screening) =>
        screening.status ===
        "waiting_schedule"
    );

  const scheduledScreenings =
    screenings.filter(
      (screening) =>
        screening.status ===
        "scheduled"
    );

  function WatchInfoEditor({
    screening,
  }: {
    screening: Screening;
  }) {
    return (
      <div
        style={{
          padding: 18,
          border:
            "1px solid rgba(255,255,255,0.09)",
          borderRadius: 12,
          background:
            "rgba(255,255,255,0.025)",
        }}
      >
        <div
          style={{
            fontSize: 11,
            letterSpacing: 1.8,
            opacity: 0.5,
            marginBottom: 14,
          }}
        >
          WATCH INFO
        </div>

        <label
          className="label"
          style={{
            display: "block",
            marginBottom: 8,
          }}
        >
          Watch Link
        </label>

        <input
          className="text-input"
          type="url"
          value={
            watchValues[
              screening.id
            ] ?? ""
          }
          onChange={(e) =>
            setWatchValues({
              ...watchValues,
              [screening.id]:
                e.target.value,
            })
          }
          placeholder="Baidu, Drive, YouTube, Vimeo..."
          style={{
            width: "100%",
            boxSizing:
              "border-box",
            marginBottom: 14,
          }}
        />

        <label
          className="label"
          style={{
            display: "block",
            marginBottom: 8,
          }}
        >
          Access Code
        </label>

        <input
          className="text-input"
          type="text"
          value={
            codeValues[
              screening.id
            ] ?? ""
          }
          onChange={(e) =>
            setCodeValues({
              ...codeValues,
              [screening.id]:
                e.target.value,
            })
          }
          placeholder="e.g. 8X3A"
          style={{
            width: "100%",
            boxSizing:
              "border-box",
            marginBottom: 12,
            textTransform:
              "none",
          }}
        />

        <div
          style={{
            fontSize: 11,
            opacity: 0.45,
            lineHeight: 1.5,
            marginBottom: 12,
          }}
        >
          Optional. The access code
          will appear on the movie
          ticket.
        </div>

        <button
          className="secondary"
          onClick={() =>
            saveWatchInfo(
              screening
            )
          }
          disabled={
            savingWatchInfo ===
            screening.id
          }
          style={{
            width: "100%",
            padding:
              "11px 15px",
          }}
        >
          {savingWatchInfo ===
          screening.id
            ? "Saving…"
            : "Save Watch Info"}
        </button>
      </div>
    );
  }

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
          Guest View
        </Link>
      </header>

      {/* CURRENT SCREENING */}

      <section className="admin-card">
        <div
          style={{
            marginBottom: 22,
          }}
        >
          <div
            style={{
              fontSize: 11,
              letterSpacing: 2.2,
              opacity: 0.45,
              marginBottom: 6,
            }}
          >
            NOW BOOKED
          </div>

          <h2
            style={{
              margin: 0,
            }}
          >
            Current Screening
          </h2>
        </div>

        {scheduledScreenings.length ===
        0 ? (
          <div className="status">
            No active ticket.
          </div>
        ) : (
          scheduledScreenings.map(
            (screening) => (
              <div
                key={
                  screening.id
                }
                style={{
                  marginBottom: 28,
                }}
              >
                <div
                  style={{
                    display:
                      "grid",
                    gridTemplateColumns:
                      "90px 1fr",
                    gap: 20,
                    alignItems:
                      "start",
                    marginBottom: 22,
                  }}
                >
                  <img
                    src={
                      screening.poster_url
                    }
                    alt={
                      screening.movie_title
                    }
                    style={{
                      width: 90,
                      aspectRatio:
                        "2 / 3",
                      objectFit:
                        "cover",
                      borderRadius: 10,
                    }}
                  />

                  <div>
                    <div
                      style={{
                        fontSize: 22,
                        fontWeight: 650,
                        marginBottom: 8,
                      }}
                    >
                      {
                        screening.movie_title
                      }
                    </div>

                    <div
                      style={{
                        fontSize: 15,
                        opacity: 0.72,
                      }}
                    >
                      {
                        screening.screening_date
                      }
                      {" · "}
                      {screening.screening_time?.slice(
                        0,
                        5
                      )}
                    </div>
                  </div>
                </div>

                <div
                  style={{
                    marginBottom: 18,
                  }}
                >
                  <WatchInfoEditor
                    screening={
                      screening
                    }
                  />
                </div>

                <div
                  style={{
                    display:
                      "flex",
                    flexWrap:
                      "wrap",
                    gap: 10,
                  }}
                >
                  <Link
                    href="/ticket"
                    className="secondary"
                    style={{
                      display:
                        "inline-block",
                      textDecoration:
                        "none",
                      padding:
                        "10px 15px",
                    }}
                  >
                    View Ticket
                  </Link>

                  <button
                    className="danger"
                    onClick={() =>
                      cancelScreening(
                        screening
                      )
                    }
                  >
                    Cancel Screening
                  </button>
                </div>
              </div>
            )
          )
        )}
      </section>

      {/* SCHEDULE */}

      <section className="admin-card">
        <div
          style={{
            marginBottom: 26,
          }}
        >
          <div
            style={{
              fontSize: 11,
              letterSpacing: 2.2,
              opacity: 0.45,
              marginBottom: 6,
            }}
          >
            PROGRAMMING
          </div>

          <h2
            style={{
              margin: 0,
            }}
          >
            Schedule Selected Movie
          </h2>
        </div>

        {waitingScreenings.length ===
        0 ? (
          <div className="status">
            No movie is waiting for scheduling.
          </div>
        ) : (
          waitingScreenings.map(
            (screening) => {
              const currentShowtimes =
                showtimes.filter(
                  (showtime) =>
                    showtime.screening_id ===
                      screening.id &&
                    showtime.status !==
                      "cancelled"
                );

              return (
                <div
                  key={
                    screening.id
                  }
                  style={{
                    marginBottom: 20,
                  }}
                >
                  <div
                    style={{
                      display:
                        "grid",
                      gridTemplateColumns:
                        "110px 1fr",
                      gap: 22,
                      alignItems:
                        "center",
                      marginBottom: 30,
                    }}
                  >
                    <img
                      src={
                        screening.poster_url
                      }
                      alt={
                        screening.movie_title
                      }
                      style={{
                        width: 110,
                        aspectRatio:
                          "2 / 3",
                        objectFit:
                          "cover",
                        borderRadius: 12,
                      }}
                    />

                    <div>
                      <div
                        style={{
                          fontSize: 11,
                          letterSpacing: 2,
                          opacity: 0.45,
                          marginBottom: 8,
                        }}
                      >
                        SELECTED MOVIE
                      </div>

                      <div
                        style={{
                          fontSize: 25,
                          fontWeight: 650,
                          lineHeight: 1.15,
                          marginBottom: 10,
                        }}
                      >
                        {
                          screening.movie_title
                        }
                      </div>

                      <div
                        style={{
                          fontSize: 13,
                          opacity: 0.55,
                          lineHeight: 1.5,
                        }}
                      >
                        Offer possible
                        screening times.
                      </div>
                    </div>
                  </div>

                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns:
                        "repeat(auto-fit, minmax(150px, 1fr))",
                      gap: 14,
                      marginBottom: 18,
                    }}
                  >
                    <div>
                      <label
                        className="label"
                        style={{
                          display:
                            "block",
                          marginBottom: 8,
                        }}
                      >
                        Date
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
                              e.target
                                .value,
                          })
                        }
                        style={{
                          width: "100%",
                          boxSizing:
                            "border-box",
                        }}
                      />
                    </div>

                    <div>
                      <label
                        className="label"
                        style={{
                          display:
                            "block",
                          marginBottom: 8,
                        }}
                      >
                        Time
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
                              e.target
                                .value,
                          })
                        }
                        style={{
                          width: "100%",
                          boxSizing:
                            "border-box",
                        }}
                      />
                    </div>
                  </div>

                  <div
                    style={{
                      marginBottom: 18,
                    }}
                  >
                    <WatchInfoEditor
                      screening={
                        screening
                      }
                    />
                  </div>

                  <button
                    className="primary"
                    onClick={() =>
                      addShowtime(
                        screening
                      )
                    }
                    disabled={
                      savingShowtime ===
                      screening.id
                    }
                    style={{
                      width: "100%",
                      padding:
                        "15px 20px",
                      fontSize: 15,
                      fontWeight: 650,
                      marginBottom: 28,
                    }}
                  >
                    {savingShowtime ===
                    screening.id
                      ? "Adding…"
                      : "+ Add Showtime"}
                  </button>

                  {currentShowtimes.length >
                    0 && (
                    <div>
                      <div
                        style={{
                          fontSize: 11,
                          letterSpacing: 2,
                          opacity: 0.45,
                          marginBottom: 12,
                        }}
                      >
                        SHOWTIMES OFFERED
                      </div>

                      <div
                        style={{
                          display: "grid",
                          gap: 10,
                        }}
                      >
                        {currentShowtimes.map(
                          (
                            showtime
                          ) => (
                            <div
                              key={
                                showtime.id
                              }
                              style={{
                                display:
                                  "flex",
                                justifyContent:
                                  "space-between",
                                alignItems:
                                  "center",
                                gap: 14,
                                padding:
                                  "15px 16px",
                                border:
                                  "1px solid rgba(255,255,255,0.09)",
                                borderRadius: 10,
                                background:
                                  "rgba(255,255,255,0.025)",
                              }}
                            >
                              <div>
                                <div
                                  style={{
                                    fontSize: 15,
                                    fontWeight: 600,
                                    marginBottom: 3,
                                  }}
                                >
                                  {
                                    showtime.screening_date
                                  }
                                </div>

                                <div
                                  style={{
                                    fontSize: 13,
                                    opacity: 0.55,
                                  }}
                                >
                                  {showtime.screening_time.slice(
                                    0,
                                    5
                                  )}
                                </div>
                              </div>

                              {showtime.status ===
                                "available" && (
                                <button
                                  className="danger"
                                  onClick={() =>
                                    deleteShowtime(
                                      showtime
                                    )
                                  }
                                >
                                  Delete
                                </button>
                              )}
                            </div>
                          )
                        )}
                      </div>
                    </div>
                  )}

                  <div
                    style={{
                      marginTop: 24,
                    }}
                  >
                    <Link
                      href="/"
                      className="secondary"
                      style={{
                        display:
                          "block",
                        textDecoration:
                          "none",
                        textAlign:
                          "center",
                        padding:
                          "12px 18px",
                      }}
                    >
                      Preview Guest View →
                    </Link>
                  </div>
                </div>
              );
            }
          )
        )}
      </section>

      {/* ADD MOVIE */}

      <section className="admin-card">
        <div
          style={{
            fontSize: 11,
            letterSpacing: 2.2,
            opacity: 0.45,
            marginBottom: 6,
          }}
        >
          LIBRARY
        </div>

        <h2>Add Movie</h2>

        <form
          onSubmit={
            submitMovie
          }
        >
          <label className="label">
            Poster
          </label>

          <input
            className="file-input"
            type="file"
            accept="image/*"
            onChange={(e) =>
              pickFile(
                e.target.files?.[0] ??
                  null
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
              setTitle(
                e.target.value
              )
            }
            placeholder="Enter movie title"
          />

          <div className="actions">
            <button
              className="primary"
              type="submit"
              disabled={
                savingMovie
              }
            >
              {savingMovie
                ? "Saving…"
                : "Add Movie"}
            </button>
          </div>
        </form>
      </section>

      {/* MOVIE POOL */}

      <section className="admin-card">
        <div
          style={{
            fontSize: 11,
            letterSpacing: 2.2,
            opacity: 0.45,
            marginBottom: 6,
          }}
        >
          CURRENT POOL
        </div>

        <h2>
          Movies (
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
          {movies.map(
            (movie) => (
              <div
                className="admin-row"
                key={
                  movie.id
                }
              >
                <img
                  className="admin-thumb"
                  src={
                    movie.poster_url
                  }
                  alt={
                    movie.title
                  }
                />

                <div>
                  <div className="row-title">
                    {
                      movie.title
                    }
                  </div>

                  <div className="row-status">
                    {
                      movie.status
                    }
                  </div>
                </div>

                <button
                  className="danger"
                  onClick={() =>
                    removeMovie(
                      movie
                    )
                  }
                >
                  Delete
                </button>
              </div>
            )
          )}
        </div>
      </section>
    </main>
  );
}
