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

  niu_rating: number | null;
  xia_rating: number | null;
  niu_rated_at: string | null;
  xia_rated_at: string | null;

  rating_prompt_shown: boolean;
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
    useState<Screening | null>(null);

  const [showtimes, setShowtimes] =
    useState<Showtime[]>([]);

  const [loading, setLoading] =
    useState(true);

  const [
    chosenMovie,
    setChosenMovie,
  ] = useState<Movie | null>(null);

  const [
    chosenShowtime,
    setChosenShowtime,
  ] = useState<Showtime | null>(
    null
  );

  const [working, setWorking] =
    useState(false);

  /*
    RATING PROMPT
  */

  const [
    ratingScreening,
    setRatingScreening,
  ] = useState<Screening | null>(
    null
  );

  const [
    niuRating,
    setNiuRating,
  ] = useState<number | null>(
    null
  );

  const [
    xiaRating,
    setXiaRating,
  ] = useState<number | null>(
    null
  );

  const [
    savingRating,
    setSavingRating,
  ] = useState(false);

  /*
    LOAD MAIN PAGE
  */

  async function loadData() {
    setLoading(true);

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

  /*
    CHECK WHETHER A PAST MOVIE
    NEEDS ITS ONE-TIME RATING POPUP
  */

  async function checkRatingPrompt() {
    const { data, error } =
      await supabase
        .from("screenings")
        .select("*")
        .eq(
          "status",
          "scheduled"
        )
        .eq(
          "rating_prompt_shown",
          false
        )
        .not(
          "screening_date",
          "is",
          null
        )
        .not(
          "screening_time",
          "is",
          null
        )
        .order(
          "screening_date",
          {
            ascending: false,
          }
        )
        .order(
          "screening_time",
          {
            ascending: false,
          }
        );

    if (error) {
      console.error(error);
      return;
    }

    const now = new Date();

    const pastScreening =
      (
        (data ?? []) as Screening[]
      ).find((item) => {
        if (
          !item.screening_date ||
          !item.screening_time
        ) {
          return false;
        }

        const movieTime =
          new Date(
            `${item.screening_date}T${item.screening_time}`
          );

        return movieTime < now;
      });

    if (!pastScreening) {
      return;
    }

    /*
      IMPORTANT:
      Mark it as already shown BEFORE opening.
      Therefore this popup truly appears only once.
    */

    const { error: updateError } =
      await supabase
        .from("screenings")
        .update({
          rating_prompt_shown: true,
        })
        .eq(
          "id",
          pastScreening.id
        );

    if (updateError) {
      console.error(
        updateError
      );
      return;
    }

    setNiuRating(
      pastScreening.niu_rating
    );

    setXiaRating(
      pastScreening.xia_rating
    );

    setRatingScreening(
      pastScreening
    );
  }

  useEffect(() => {
    async function initialize() {
      await loadData();
      await checkRatingPrompt();
    }

    initialize();

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

  /*
    RATING FUNCTIONS
  */

  function chooseRating(
    person: "niu" | "xia",
    value: number
  ) {
    if (person === "niu") {
      setNiuRating(
        niuRating === value
          ? null
          : value
      );
    } else {
      setXiaRating(
        xiaRating === value
          ? null
          : value
      );
    }
  }

  async function saveRatings() {
    if (!ratingScreening) {
      return;
    }

    setSavingRating(true);

    const now =
      new Date().toISOString();

    const { error } =
      await supabase
        .from("screenings")
        .update({
          niu_rating:
            niuRating,
          xia_rating:
            xiaRating,

          niu_rated_at:
            niuRating
              ? now
              : null,

          xia_rated_at:
            xiaRating
              ? now
              : null,
        })
        .eq(
          "id",
          ratingScreening.id
        );

    setSavingRating(false);

    if (error) {
      alert(error.message);
      return;
    }

    setRatingScreening(null);

    router.push(
      "/history"
    );
  }

  function skipRating() {
    setRatingScreening(
      null
    );

    router.push(
      "/history"
    );
  }

  /*
    MOVIE SELECTION
  */

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

  /*
    SHOWTIME SELECTION
  */

  async function confirmShowtime(
    showtime: Showtime
  ) {
    if (!screening) {
      return;
    }

    setWorking(true);

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

    const {
      error:
        screeningError,
    } = await supabase
      .from("screenings")
      .update({
        status:
          "scheduled",

        screening_date:
          showtime.screening_date,

        screening_time:
          showtime.screening_time,

        rating_prompt_shown:
          false,
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

    router.push(
      "/ticket"
    );
  }

  /*
    DATE FORMAT
  */

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

  /*
    HEADER
  */

  function Header() {
    return (
      <header
        className="header"
        style={{
          alignItems:
            "center",
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

  /*
    STAR ROW FOR POPUP
  */

  function RatingStars({
    label,
    person,
    rating,
  }: {
    label: string;
    person:
      | "niu"
      | "xia";
    rating: number | null;
  }) {
    return (
      <div
        style={{
          padding:
            "18px 0",
          borderTop:
            "1px solid rgba(255,255,255,0.08)",
        }}
      >
        <div
          style={{
            display:
              "flex",
            justifyContent:
              "space-between",
            alignItems:
              "center",
            marginBottom: 12,
          }}
        >
          <div
            style={{
              fontSize: 16,
              fontWeight: 650,
            }}
          >
            {label}
          </div>

          <div
            style={{
              fontSize: 12,
              opacity: 0.45,
            }}
          >
            {rating
              ? `${rating}/5`
              : "Not rated"}
          </div>
        </div>

        <div
          style={{
            display: "flex",
            gap: 8,
            justifyContent:
              "center",
          }}
        >
          {[1, 2, 3, 4, 5].map(
            (star) => (
              <button
                key={star}
                onClick={() =>
                  chooseRating(
                    person,
                    star
                  )
                }
                style={{
                  border:
                    "none",
                  background:
                    "transparent",
                  cursor:
                    "pointer",
                  fontSize: 36,
                  padding:
                    "2px",
                  lineHeight: 1,

                  color:
                    rating &&
                    star <= rating
                      ? "inherit"
                      : "rgba(255,255,255,0.22)",
                }}
              >
                ★
              </button>
            )
          )}
        </div>
      </div>
    );
  }

  /*
    RATING POPUP
  */

  function RatingPopup() {
    if (
      !ratingScreening
    ) {
      return null;
    }

    return (
      <div className="modal-backdrop">
        <div
          className="modal"
          style={{
            width:
              "min(430px, 92vw)",
            textAlign:
              "center",
            padding:
              "28px 24px",
          }}
        >
          <div
            style={{
              fontSize: 11,
              letterSpacing: 2.4,
              opacity: 0.45,
              marginBottom: 16,
            }}
          >
            AFTER THE MOVIE
          </div>

          <img
            src={
              ratingScreening.poster_url
            }
            alt={
              ratingScreening.movie_title
            }
            style={{
              width: 105,
              aspectRatio:
                "2 / 3",
              objectFit:
                "cover",
              borderRadius: 10,
              marginBottom: 16,
            }}
          />

          <h2
            style={{
              marginBottom: 6,
            }}
          >
            How was the movie?
          </h2>

          <div
            style={{
              fontSize: 17,
              fontWeight: 600,
              marginBottom: 20,
            }}
          >
            {
              ratingScreening.movie_title
            }
          </div>

          <RatingStars
            label="牛"
            person="niu"
            rating={
              niuRating
            }
          />

          <RatingStars
            label="虾"
            person="xia"
            rating={
              xiaRating
            }
          />

          <button
            className="primary"
            disabled={
              savingRating
            }
            onClick={
              saveRatings
            }
            style={{
              width: "100%",
              marginTop: 12,
              padding: 15,
            }}
          >
            {savingRating
              ? "Saving…"
              : "Save Ratings"}
          </button>

          <button
            className="secondary"
            disabled={
              savingRating
            }
            onClick={
              skipRating
            }
            style={{
              width: "100%",
              marginTop: 10,
              padding: 13,
            }}
          >
            Skip for now
          </button>

          <div
            style={{
              fontSize: 11,
              opacity: 0.4,
              marginTop: 14,
              lineHeight: 1.5,
            }}
          >
            You can always rate or
            change ratings later in
            Watch History.
          </div>
        </div>
      </div>
    );
  }

  /*
    LOADING
  */

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
    SHOWTIME SELECTION PAGE
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

        <RatingPopup />
      </main>
    );
  }

  /*
    NORMAL MOVIE SELECTION PAGE
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

      <RatingPopup />
    </main>
  );
}
