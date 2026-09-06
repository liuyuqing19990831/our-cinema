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
  movie_id: number | null;
  movie_title: string;
  poster_url: string;
  status: string;

  screening_date: string | null;
  screening_time: string | null;

  watch_url: string | null;
  watch_code: string | null;

  festival_id: number | null;

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

type ShowtimeChoice = {
  screening: Screening;
  showtime: Showtime;
};

export default function HomePage() {
  const router = useRouter();

  const [movies, setMovies] =
    useState<Movie[]>([]);

  /*
    所有还在等待用户
    选择时间的电影
  */
  const [
    screenings,
    setScreenings,
  ] = useState<Screening[]>([]);

  /*
    每一部 screening
    都有自己的 showtimes
  */
  const [
    showtimesByScreening,
    setShowtimesByScreening,
  ] = useState<
    Record<number, Showtime[]>
  >({});

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
  ] =
    useState<ShowtimeChoice | null>(
      null
    );

  const [working, setWorking] =
    useState(false);

  /*
    RATING POPUP
  */

  const [
    ratingScreening,
    setRatingScreening,
  ] =
    useState<Screening | null>(
      null
    );

  const [
    niuRating,
    setNiuRating,
  ] =
    useState<number | null>(
      null
    );

  const [
    xiaRating,
    setXiaRating,
  ] =
    useState<number | null>(
      null
    );

  const [
    savingRating,
    setSavingRating,
  ] = useState(false);

  /*
    LOAD HOME PAGE
  */

  async function loadData() {
    setLoading(true);

    /*
      AVAILABLE MOVIES
    */

    const {
      data: movieData,
      error: movieError,
    } = await supabase
      .from("movies")
      .select("*")
      .eq(
        "status",
        "available"
      )
      .order(
        "created_at",
        {
          ascending: true,
        }
      );

    if (movieError) {
      console.error(
        movieError
      );
    }

    setMovies(
      (movieData ??
        []) as Movie[]
    );

    /*
      LOAD ALL MOVIES
      WAITING FOR SCHEDULE
    */

    const {
      data:
        screeningData,
      error:
        screeningError,
    } = await supabase
      .from("screenings")
      .select("*")
      .eq(
        "status",
        "waiting_schedule"
      )
      .order(
        "created_at",
        {
          ascending: true,
        }
      );

    if (
      screeningError
    ) {
      console.error(
        screeningError
      );

      setScreenings(
        []
      );

      setShowtimesByScreening(
        {}
      );

      setLoading(false);

      return;
    }

    const waitingScreenings =
      (screeningData ??
        []) as Screening[];

    setScreenings(
      waitingScreenings
    );

    /*
      LOAD SHOWTIMES FOR
      ALL WAITING MOVIES
    */

    if (
      waitingScreenings.length ===
      0
    ) {
      setShowtimesByScreening(
        {}
      );

      setLoading(false);

      return;
    }

    const screeningIds =
      waitingScreenings.map(
        (item) => item.id
      );

    const {
      data:
        showtimeData,
      error:
        showtimeError,
    } = await supabase
      .from("showtimes")
      .select("*")
      .in(
        "screening_id",
        screeningIds
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

    if (
      showtimeError
    ) {
      console.error(
        showtimeError
      );

      setShowtimesByScreening(
        {}
      );

      setLoading(false);

      return;
    }

    const grouped:
      Record<
        number,
        Showtime[]
      > = {};

    waitingScreenings.forEach(
      (item) => {
        grouped[
          item.id
        ] = [];
      }
    );

    (
      (showtimeData ??
        []) as Showtime[]
    ).forEach(
      (showtime) => {
        if (
          !grouped[
            showtime
              .screening_id
          ]
        ) {
          grouped[
            showtime
              .screening_id
          ] = [];
        }

        grouped[
          showtime
            .screening_id
        ].push(
          showtime
        );
      }
    );

    setShowtimesByScreening(
      grouped
    );

    setLoading(false);
  }

  /*
    CHECK ONE-TIME
    RATING POPUP
  */

  async function checkRatingPrompt() {
    const {
      data,
      error,
    } = await supabase
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
      console.error(
        error
      );

      return;
    }

    const now =
      new Date();

    const pastScreening =
      (
        (data ??
          []) as Screening[]
      ).find(
        (item) => {
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

          return (
            movieTime <
            now
          );
        }
      );

    if (
      !pastScreening
    ) {
      return;
    }

    /*
      MARK AS SHOWN FIRST
    */

    const {
      error:
        updateError,
    } = await supabase
      .from("screenings")
      .update({
        rating_prompt_shown:
          true,
      })
      .eq(
        "id",
        pastScreening.id
      );

    if (
      updateError
    ) {
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
            schema:
              "public",
            table:
              "movies",
          },
          () =>
            loadData()
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
            schema:
              "public",
            table:
              "screenings",
          },
          () =>
            loadData()
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
            schema:
              "public",
            table:
              "showtimes",
          },
          () =>
            loadData()
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
    NORMAL MOVIE PICK
  */

  function randomPick() {
    if (
      movies.length ===
      0
    ) {
      return;
    }

    const movie =
      movies[
        Math.floor(
          Math.random() *
            movies.length
        )
      ];

    setChosenMovie(
      movie
    );
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

        festival_id:
          null,
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
      REMOVE FROM
      AVAILABLE POOL
    */

    const {
      error:
        movieError,
    } = await supabase
      .from("movies")
      .update({
        status:
          "selected",
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

    if (
      movieError
    ) {
      alert(
        movieError.message
      );

      return;
    }

    setChosenMovie(
      null
    );

    await loadData();
  }

  /*
    CHOOSE SHOWTIME
  */

  async function confirmShowtime(
    screening:
      Screening,
    showtime:
      Showtime
  ) {
    setWorking(true);

    /*
      MARK CHOSEN
      SHOWTIME SELECTED
    */

    const {
      error:
        showtimeError,
    } = await supabase
      .from("showtimes")
      .update({
        status:
          "selected",
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
      CANCEL OTHER TIMES
      FOR THIS MOVIE ONLY
    */

    await supabase
      .from("showtimes")
      .update({
        status:
          "cancelled",
      })
      .eq(
        "screening_id",
        screening.id
      )
      .neq(
        "id",
        showtime.id
      )
      .eq(
        "status",
        "available"
      );

    /*
      CREATE TICKET
      FOR THIS MOVIE ONLY
    */

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
    RATINGS
  */

  function chooseRating(
    person:
      | "niu"
      | "xia",
    value: number
  ) {
    if (
      person === "niu"
    ) {
      setNiuRating(
        niuRating ===
          value
          ? null
          : value
      );
    } else {
      setXiaRating(
        xiaRating ===
          value
          ? null
          : value
      );
    }
  }

  async function saveRatings() {
    if (
      !ratingScreening
    ) {
      return;
    }

    setSavingRating(
      true
    );

    const now =
      new Date().toISOString();

    const {
      error,
    } = await supabase
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

    setSavingRating(
      false
    );

    if (error) {
      alert(
        error.message
      );

      return;
    }

    setRatingScreening(
      null
    );

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
    DATE FORMAT
  */

  function formatDate(
    date: string
  ) {
    const parts =
      date.split("-");

    if (
      parts.length !==
      3
    ) {
      return date;
    }

    const year =
      Number(
        parts[0]
      );

    const month =
      Number(
        parts[1]
      );

    const day =
      Number(
        parts[2]
      );

    return new Intl.DateTimeFormat(
      "en-US",
      {
        month:
          "short",

        day:
          "numeric",

        year:
          "numeric",
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

          gap:
            18,
        }}
      >
        <div>
          <h1
            className="brand"
            style={{
              marginBottom:
                4,
            }}
          >
            OUR CINEMA
          </h1>

          <div className="subtitle">
            A private cinema for two
          </div>
        </div>

        <div
          style={{
            display:
              "flex",

            gap:
              9,

            flexWrap:
              "wrap",

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

              textDecoration:
                "none",

              padding:
                "10px 15px",

              fontSize:
                13,

              fontWeight:
                600,

              whiteSpace:
                "nowrap",
            }}
          >
            🎟 Tickets
          </Link>

          <Link
            href="/history"
            className="secondary"
            style={{
              display:
                "inline-flex",

              alignItems:
                "center",

              textDecoration:
                "none",

              padding:
                "10px 15px",

              fontSize:
                13,

              fontWeight:
                600,

              whiteSpace:
                "nowrap",
            }}
          >
            ◷ History
          </Link>

          <Link
            href="/festival"
            className="secondary"
            style={{
              display:
                "inline-flex",

              alignItems:
                "center",

              textDecoration:
                "none",

              padding:
                "10px 15px",

              fontSize:
                13,

              fontWeight:
                600,

              whiteSpace:
                "nowrap",
            }}
          >
            ✦ Special Festival
          </Link>
        </div>
      </header>
    );
  }

  /*
    RATING STARS
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

    rating:
      | number
      | null;
  }) {
    return (
      <div
        style={{
          padding:
            "17px 0",

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

            marginBottom:
              12,
          }}
        >
          <div
            style={{
              fontSize:
                16,

              fontWeight:
                650,
            }}
          >
            {label}
          </div>

          <div
            style={{
              fontSize:
                12,

              opacity:
                0.45,
            }}
          >
            {rating
              ? `${rating}/5`
              : "Not rated"}
          </div>
        </div>

        <div
          style={{
            display:
              "grid",

            gridTemplateColumns:
              "repeat(5, 1fr)",

            gap:
              4,

            width:
              "100%",

            maxWidth:
              180,

            margin:
              "0 auto",
          }}
        >
          {[1, 2, 3, 4, 5].map(
            (star) => (
              <button
                key={
                  star
                }
                type="button"
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

                  padding:
                    0,

                  cursor:
                    "pointer",

                  fontSize:
                    22,

                  lineHeight:
                    1,

                  width:
                    "100%",

                  color:
                    rating &&
                    star <=
                      rating
                      ? "inherit"
                      : "rgba(255,255,255,0.20)",
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

  if (loading) {
    return (
      <main className="shell">
        <div className="empty">
          Loading cinema…
        </div>
      </main>
    );
  }

  return (
    <main className="shell">
      <Header />

      {/*
        ALL SELECTED FILMS
        WAITING FOR SCHEDULE
      */}

      {screenings.length >
        0 && (
        <div
          style={{
            marginBottom:
              34,
          }}
        >
          <div
            style={{
              marginBottom:
                18,
            }}
          >
            <div
              style={{
                fontSize:
                  10,

                letterSpacing:
                  2.4,

                opacity:
                  0.4,

                marginBottom:
                  6,
              }}
            >
              SELECTED FILMS
            </div>

            <h2
              style={{
                margin:
                  0,

                fontSize:
                  25,
              }}
            >
              Choose a Showtime
            </h2>
          </div>

          <div
            style={{
              display:
                "grid",

              gap:
                18,
            }}
          >
            {screenings.map(
              (
                screening
              ) => {
                const showtimes =
                  showtimesByScreening[
                    screening.id
                  ] ?? [];

                return (
                  <section
                    key={
                      screening.id
                    }
                    className="admin-card"
                    style={{
                      marginBottom:
                        0,
                    }}
                  >
                    <div
                      style={{
                        display:
                          "grid",

                        gridTemplateColumns:
                          "90px minmax(0, 1fr)",

                        gap:
                          18,

                        alignItems:
                          "center",

                        marginBottom:
                          showtimes.length >
                          0
                            ? 22
                            : 0,
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
                          width:
                            90,

                          aspectRatio:
                            "2 / 3",

                          objectFit:
                            "cover",

                          borderRadius:
                            10,
                        }}
                      />

                      <div
                        style={{
                          minWidth:
                            0,
                        }}
                      >
                        <div
                          style={{
                            fontSize:
                              10,

                            letterSpacing:
                              2,

                            opacity:
                              0.42,

                            marginBottom:
                              7,
                          }}
                        >
                          SELECTED FILM
                        </div>

                        <h2
                          style={{
                            fontSize:
                              23,

                            lineHeight:
                              1.15,

                            margin:
                              "0 0 9px",
                          }}
                        >
                          {
                            screening.movie_title
                          }
                        </h2>

                        <div
                          style={{
                            fontSize:
                              12,

                            opacity:
                              0.5,

                            lineHeight:
                              1.5,
                          }}
                        >
                          {showtimes.length ===
                          0
                            ? "Waiting for schedule…"
                            : "Showtimes are ready. Choose one below."}
                        </div>
                      </div>
                    </div>

                    {showtimes.length ===
                    0 ? (
                      <div
                        className="status"
                        style={{
                          textAlign:
                            "center",

                          padding:
                            "18px 0 4px",
                        }}
                      >
                        Waiting for showtimes…
                      </div>
                    ) : (
                      <div
                        style={{
                          display:
                            "grid",

                          gap:
                            10,
                        }}
                      >
                        {showtimes.map(
                          (
                            showtime
                          ) => (
                            <button
                              key={
                                showtime.id
                              }
                              className="secondary"
                              onClick={() =>
                                setChosenShowtime(
                                  {
                                    screening,

                                    showtime,
                                  }
                                )
                              }
                              style={{
                                width:
                                  "100%",

                                padding:
                                  "15px 17px",

                                textAlign:
                                  "left",

                                display:
                                  "flex",

                                justifyContent:
                                  "space-between",

                                alignItems:
                                  "center",

                                gap:
                                  16,
                              }}
                            >
                              <span>
                                {formatDate(
                                  showtime.screening_date
                                )}
                              </span>

                              <strong
                                style={{
                                  fontSize:
                                    17,
                                }}
                              >
                                {showtime.screening_time.slice(
                                  0,
                                  5
                                )}
                              </strong>
                            </button>
                          )
                        )}
                      </div>
                    )}
                  </section>
                );
              }
            )}
          </div>
        </div>
      )}

      {/*
        NORMAL PERMANENT
        MOVIE POOL
      */}

      <div
        style={{
          display:
            "flex",

          justifyContent:
            "space-between",

          alignItems:
            "flex-end",

          gap:
            18,

          marginBottom:
            20,
        }}
      >
        <div>
          <div
            style={{
              fontSize:
                10,

              letterSpacing:
                2.4,

              opacity:
                0.4,

              marginBottom:
                6,
            }}
          >
            NOW AVAILABLE
          </div>

          <h2
            style={{
              margin:
                0,

              fontSize:
                25,
            }}
          >
            Pick a Movie
          </h2>
        </div>

        {movies.length >
          0 && (
          <button
            className="primary"
            onClick={
              randomPick
            }
            style={{
              padding:
                "11px 17px",

              whiteSpace:
                "nowrap",
            }}
          >
            ✦ Random Pick
          </button>
        )}
      </div>

      {movies.length ===
      0 ? (
        <section
          className="admin-card"
          style={{
            textAlign:
              "center",

            padding:
              "48px 24px",
          }}
        >
          <div
            style={{
              fontSize:
                38,

              marginBottom:
                14,
            }}
          >
            🎬
          </div>

          <div
            style={{
              fontSize:
                20,

              fontWeight:
                650,

              marginBottom:
                8,
            }}
          >
            No movies available
          </div>

          <div className="status">
            New films will appear
            here when they are
            added.
          </div>
        </section>
      ) : (
        <section className="movie-grid">
          {movies.map(
            (movie) => (
              <article
                key={
                  movie.id
                }
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
          )}
        </section>
      )}

      {/*
        CONFIRM NORMAL MOVIE
      */}

      {chosenMovie && (
        <div
          className="modal-backdrop"
          onClick={() =>
            setChosenMovie(
              null
            )
          }
        >
          <div
            className="modal"
            onClick={(
              e
            ) =>
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

            <div
              style={{
                fontSize:
                  10,

                letterSpacing:
                  2,

                opacity:
                  0.4,

                marginTop:
                  15,
              }}
            >
              OUR CINEMA
            </div>

            <h3>
              {
                chosenMovie.title
              }
            </h3>

            <p>
              Choose this film?
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
                disabled={
                  working
                }
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

      {/*
        CONFIRM SHOWTIME
      */}

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
            onClick={(
              e
            ) =>
              e.stopPropagation()
            }
          >
            <img
              src={
                chosenShowtime
                  .screening
                  .poster_url
              }
              alt={
                chosenShowtime
                  .screening
                  .movie_title
              }
            />

            <h3>
              {
                chosenShowtime
                  .screening
                  .movie_title
              }
            </h3>

            <p>
              {formatDate(
                chosenShowtime
                  .showtime
                  .screening_date
              )}

              <br />

              <strong
                style={{
                  fontSize:
                    22,
                }}
              >
                {chosenShowtime
                  .showtime
                  .screening_time
                  .slice(
                    0,
                    5
                  )}
              </strong>
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
                      .screening,

                    chosenShowtime
                      .showtime
                  )
                }
              >
                {working
                  ? "Booking…"
                  : "Get Ticket"}
              </button>

              <button
                className="secondary"
                disabled={
                  working
                }
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

      {/*
        ONE-TIME RATING POPUP
      */}

      {ratingScreening && (
        <div className="modal-backdrop">
          <div
            className="modal"
            style={{
              maxWidth:
                430,
            }}
          >
            <img
              src={
                ratingScreening.poster_url
              }
              alt={
                ratingScreening.movie_title
              }
            />

            <div
              style={{
                fontSize:
                  10,

                letterSpacing:
                  2,

                opacity:
                  0.4,

                marginTop:
                  16,
              }}
            >
              HOW WAS THE MOVIE?
            </div>

            <h3>
              {
                ratingScreening.movie_title
              }
            </h3>

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

            <div
              className="modal-actions"
              style={{
                marginTop:
                  8,
              }}
            >
              <button
                className="primary"
                disabled={
                  savingRating
                }
                onClick={
                  saveRatings
                }
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
              >
                Skip for now
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
