"use client";

import Link from "next/link";
import {
  useEffect,
  useState,
} from "react";
import { useRouter } from "next/navigation";
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

export default function HomePage() {
  const router = useRouter();

  const [movies, setMovies] =
    useState<Movie[]>([]);

  const [screening, setScreening] =
    useState<Screening | null>(
      null
    );

  const [showtimes, setShowtimes] =
    useState<Showtime[]>([]);

  const [loading, setLoading] =
    useState(true);

  const [
    chosenMovie,
    setChosenMovie,
  ] = useState<Movie | null>(
    null
  );

  const [
    chosenShowtime,
    setChosenShowtime,
  ] = useState<Showtime | null>(
    null
  );

  const [working, setWorking] =
    useState(false);

  async function loadData() {
    setLoading(true);

    /*
      AVAILABLE MOVIE POOL
    */
    const { data: movieData } =
      await supabase
        .from("movies")
        .select("*")
        .eq(
          "status",
          "available"
        )
        .order("created_at", {
          ascending: true,
        });

    setMovies(
      (movieData ?? []) as Movie[]
    );

    /*
      CURRENT MOVIE WAITING
      FOR SHOWTIME SELECTION
    */
    const {
      data: screeningData,
    } = await supabase
      .from("screenings")
      .select("*")
      .eq(
        "status",
        "waiting_schedule"
      )
      .order("created_at", {
        ascending: false,
      })
      .limit(1);

    const currentScreening =
      screeningData &&
      screeningData.length > 0
        ? (screeningData[0] as Screening)
        : null;

    setScreening(
      currentScreening
    );

    if (currentScreening) {
      const {
        data: showtimeData,
      } = await supabase
        .from("showtimes")
        .select("*")
        .eq(
          "screening_id",
          currentScreening.id
        )
        .eq(
          "status",
          "available"
        )
        .order(
          "screening_date",
          {
            ascending: true,
          }
        )
        .order(
          "screening_time",
          {
            ascending: true,
          }
        );

      setShowtimes(
        (showtimeData ??
          []) as Showtime[]
      );
    } else {
      setShowtimes([]);
    }

    setLoading(false);
  }

  useEffect(() => {
    loadData();

    const movieChannel =
      supabase
        .channel(
          "guest-movies-live"
        )
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "movies",
          },
          () => loadData()
        )
        .subscribe();

    const screeningChannel =
      supabase
        .channel(
          "guest-screenings-live"
        )
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "screenings",
          },
          () => loadData()
        )
        .subscribe();

    const showtimeChannel =
      supabase
        .channel(
          "guest-showtimes-live"
        )
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "showtimes",
          },
          () => loadData()
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

  function randomPick() {
    if (!movies.length) {
      return;
    }

    const movie =
      movies[
        Math.floor(
          Math.random() *
            movies.length
        )
      ];

    setChosenMovie(movie);
  }

  async function confirmMovie(
    movie: Movie
  ) {
    setWorking(true);

    /*
      CREATE SCREENING
    */
    const {
      error:
        screeningError,
    } = await supabase
      .from("screenings")
      .insert({
        movie_id:
          movie.id,
        movie_title:
          movie.title,
        poster_url:
          movie.poster_url,
        status:
          "waiting_schedule",
      });

    if (
      screeningError
    ) {
      setWorking(false);

      alert(
        screeningError.message
      );

      return;
    }

    /*
      REMOVE MOVIE FROM POOL
    */
    const {
      error: movieError,
    } = await supabase
      .from("movies")
      .update({
        status: "selected",
      })
      .eq(
        "id",
        movie.id
      )
      .eq(
        "status",
        "available"
      );

    setWorking(false);

    if (movieError) {
      alert(
        movieError.message
      );

      return;
    }

    setChosenMovie(null);

    await loadData();
  }

  async function confirmShowtime(
    showtime: Showtime
  ) {
    if (!screening) {
      return;
    }

    setWorking(true);

    /*
      MARK SHOWTIME SELECTED
    */
    const {
      error: showtimeError,
    } = await supabase
      .from("showtimes")
      .update({
        status: "selected",
      })
      .eq(
        "id",
        showtime.id
      )
      .eq(
        "status",
        "available"
      );

    if (
      showtimeError
    ) {
      setWorking(false);

      alert(
        showtimeError.message
      );

      return;
    }

    /*
      GENERATE TICKET
    */
    const {
      error:
        screeningError,
    } = await supabase
      .from("screenings")
      .update({
        status: "scheduled",
        screening_date:
          showtime.screening_date,
        screening_time:
          showtime.screening_time,
      })
      .eq(
        "id",
        screening.id
      );

    setWorking(false);

    if (
      screeningError
    ) {
      alert(
        screeningError.message
      );

      return;
    }

    setChosenShowtime(
      null
    );

    router.push("/ticket");
  }

  function formatDate(
    date: string
  ) {
    const parts =
      date.split("-");

    if (
      parts.length !== 3
    ) {
      return date;
    }

    const year =
      Number(parts[0]);

    const month =
      Number(parts[1]);

    const day =
      Number(parts[2]);

    return new Intl.DateTimeFormat(
      "en-US",
      {
        year: "numeric",
        month: "long",
        day: "numeric",
      }
    ).format(
      new Date(
        Date.UTC(
          year,
          month - 1,
          day
        )
      )
    );
  }

  function Header() {
    return (
      <header
        className="header"
        style={{
          alignItems: "center",
          gap: 16,
        }}
      >
        <div>
          <h1 className="brand">
            OUR CINEMA
          </h1>
        </div>

        <div
          style={{
            display: "flex",
            gap: 10,
            flexWrap: "wrap",
            justifyContent:
              "flex-end",
          }}
        >
          <Link
            href="/ticket"
            className="primary"
            style={{
              display:
                "inline-flex",
              alignItems:
                "center",
              gap: 7,
              textDecoration:
                "none",
              padding:
                "11px 17px",
              fontSize: 14,
              fontWeight: 600,
              whiteSpace:
                "nowrap",
            }}
          >
            🎟 View Ticket
          </Link>

          <Link
            href="/history"
            className="secondary"
            style={{
              display:
                "inline-flex",
              alignItems:
                "center",
              gap: 7,
              textDecoration:
                "none",
              padding:
                "11px 17px",
              fontSize: 14,
              fontWeight: 600,
              whiteSpace:
                "nowrap",
            }}
          >
            🎬 Watch History
          </Link>
        </div>
      </header>
    );
  }

  if (loading) {
    return (
      <main className="shell">
        <div className="empty">
          Loading…
        </div>
      </main>
    );
  }

  /*
    SHOWTIME SELECTION
  */
  if (screening) {
    return (
      <main className="shell">
        <Header />

        <section
          className="admin-card"
          style={{
            textAlign:
              "center",
            padding:
              "30px 22px",
          }}
        >
          <div
            style={{
              fontSize: 11,
              letterSpacing: 2.5,
              opacity: 0.48,
              marginBottom: 18,
            }}
          >
            CHOOSE A SHOWTIME
          </div>

          <img
            src={
              screening.poster_url
            }
            alt={
              screening.movie_title
            }
            style={{
              width:
                "min(175px, 60%)",
              borderRadius: 10,
              marginBottom: 18,
            }}
          />

          <h2
            style={{
              fontSize: 26,
              marginBottom: 8,
            }}
          >
            {
              screening.movie_title
            }
          </h2>

          <div
            style={{
              fontSize: 13,
              opacity: 0.48,
              marginBottom: 26,
            }}
          >
            Pick the time that
            works best for us.
          </div>

          {showtimes.length ===
          0 ? (
            <div
              className="status"
              style={{
                marginTop: 20,
                padding:
                  "22px 0",
              }}
            >
              Waiting for
              showtimes…
            </div>
          ) : (
            <div
              style={{
                display: "grid",
                gap: 12,
              }}
            >
              {showtimes.map(
                (showtime) => (
                  <button
                    key={
                      showtime.id
                    }
                    className="secondary"
                    style={{
                      padding:
                        "17px 18px",
                      fontSize: 16,
                      borderRadius: 10,
                    }}
                    onClick={() =>
                      setChosenShowtime(
                        showtime
                      )
                    }
                  >
                    {formatDate(
                      showtime.screening_date
                    )}
                    {" · "}
                    {showtime.screening_time.slice(
                      0,
                      5
                    )}
                  </button>
                )
              )}
            </div>
          )}
        </section>

        {chosenShowtime && (
          <div
            className="modal-backdrop"
            onClick={() =>
              setChosenShowtime(
                null
              )
            }
          >
            <div
              className="modal"
              onClick={(e) =>
                e.stopPropagation()
              }
            >
              <h3>
                Confirm Showtime
              </h3>

              <p>
                {formatDate(
                  chosenShowtime.screening_date
                )}
                {" · "}
                {chosenShowtime.screening_time.slice(
                  0,
                  5
                )}
              </p>

              <div className="modal-actions">
                <button
                  className="primary"
                  disabled={
                    working
                  }
                  onClick={() =>
                    confirmShowtime(
                      chosenShowtime
                    )
                  }
                >
                  {working
                    ? "Confirming…"
                    : "Confirm"}
                </button>

                <button
                  className="secondary"
                  onClick={() =>
                    setChosenShowtime(
                      null
                    )
                  }
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    );
  }

  /*
    MOVIE SELECTION
  */
  return (
    <main className="shell">
      <Header />

      <section className="movie-grid">
        {movies.length === 0 ? (
          <div className="empty">
            No available movies yet.
          </div>
        ) : (
          movies.map(
            (movie) => (
              <article
                key={movie.id}
              >
                <img
                  className="poster"
                  src={
                    movie.poster_url
                  }
                  alt={
                    movie.title
                  }
                />

                <div className="movie-title">
                  {
                    movie.title
                  }
                </div>

                <button
                  className="pick-button"
                  onClick={() =>
                    setChosenMovie(
                      movie
                    )
                  }
                >
                  Choose
                </button>
              </article>
            )
          )
        )}
      </section>

      <div className="actions">
        <button
          className="primary"
          onClick={randomPick}
          disabled={
            !movies.length
          }
        >
          Random Pick
        </button>
      </div>

      {chosenMovie && (
        <div
          className="modal-backdrop"
          onClick={() =>
            setChosenMovie(null)
          }
        >
          <div
            className="modal"
            onClick={(e) =>
              e.stopPropagation()
            }
          >
            <img
              src={
                chosenMovie.poster_url
              }
              alt={
                chosenMovie.title
              }
            />

            <h3>
              {
                chosenMovie.title
              }
            </h3>

            <p>
              Choose this movie?
            </p>

            <div className="modal-actions">
              <button
                className="primary"
                disabled={
                  working
                }
                onClick={() =>
                  confirmMovie(
                    chosenMovie
                  )
                }
              >
                {working
                  ? "Selecting…"
                  : "Confirm"}
              </button>

              <button
                className="secondary"
                onClick={() =>
                  setChosenMovie(
                    null
                  )
                }
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
