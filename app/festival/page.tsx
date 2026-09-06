"use client";

import Link from "next/link";
import {
  useEffect,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

type Festival = {
  id: number;
  created_at: string;
  title: string;
  start_date: string;
  end_date: string;
  status: string;
};

type FestivalMovie = {
  id: number;
  created_at: string;
  festival_id: number;
  title: string;
  poster_url: string;
};

type Screening = {
  id: number;
  movie_title: string;
  festival_id: number | null;
};

export default function FestivalPage() {
  const router = useRouter();

  const [
    festival,
    setFestival,
  ] =
    useState<Festival | null>(
      null
    );

  const [
    movies,
    setMovies,
  ] =
    useState<
      FestivalMovie[]
    >([]);

  const [
    loading,
    setLoading,
  ] =
    useState(true);

  const [
    chosenMovie,
    setChosenMovie,
  ] =
    useState<
      FestivalMovie | null
    >(null);

  const [
    working,
    setWorking,
  ] =
    useState(false);

  async function loadFestival() {
    setLoading(true);

    /*
      FIND ACTIVE FESTIVAL
    */

    const {
      data:
        festivalData,
      error:
        festivalError,
    } = await supabase
      .from("festivals")
      .select("*")
      .eq(
        "status",
        "active"
      )
      .order(
        "created_at",
        {
          ascending:
            false,
        }
      )
      .limit(1);

    if (
      festivalError
    ) {
      console.error(
        festivalError
      );

      setFestival(
        null
      );

      setMovies(
        []
      );

      setLoading(
        false
      );

      return;
    }

    const activeFestival =
      festivalData &&
      festivalData.length >
        0
        ? (festivalData[0] as Festival)
        : null;

    /*
      CHECK DATE RANGE
    */

    const today =
      new Date().toLocaleDateString(
        "en-CA"
      );

    const visibleFestival =
      activeFestival &&
      activeFestival.start_date <=
        today &&
      activeFestival.end_date >=
        today
        ? activeFestival
        : null;

    setFestival(
      visibleFestival
    );

    if (
      !visibleFestival
    ) {
      setMovies(
        []
      );

      setLoading(
        false
      );

      return;
    }

    /*
      LOAD ALL FESTIVAL MOVIES
    */

    const {
      data:
        movieData,
      error:
        movieError,
    } = await supabase
      .from(
        "festival_movies"
      )
      .select("*")
      .eq(
        "festival_id",
        visibleFestival.id
      )
      .order(
        "created_at",
        {
          ascending:
            true,
        }
      );

    if (
      movieError
    ) {
      console.error(
        movieError
      );

      setMovies(
        []
      );

      setLoading(
        false
      );

      return;
    }

    const allMovies =
      (movieData ??
        []) as FestivalMovie[];

    /*
      FIND MOVIES ALREADY
      CHOSEN FROM THIS FESTIVAL
    */

    const {
      data:
        screeningData,
      error:
        screeningError,
    } = await supabase
      .from(
        "screenings"
      )
      .select(
        "id, movie_title, festival_id"
      )
      .eq(
        "festival_id",
        visibleFestival.id
      );

    if (
      screeningError
    ) {
      console.error(
        screeningError
      );

      /*
        If screening lookup fails,
        still show all movies instead
        of breaking the festival.
      */

      setMovies(
        allMovies
      );

      setLoading(
        false
      );

      return;
    }

    const chosenScreenings =
      (screeningData ??
        []) as Screening[];

    const chosenTitles =
      new Set(
        chosenScreenings.map(
          (
            screening
          ) =>
            screening.movie_title
        )
      );

    /*
      HIDE ALREADY CHOSEN MOVIES
      FROM GUEST FESTIVAL PAGE
    */

    const remainingMovies =
      allMovies.filter(
        (movie) =>
          !chosenTitles.has(
            movie.title
          )
      );

    setMovies(
      remainingMovies
    );

    setLoading(
      false
    );
  }

  useEffect(() => {
    loadFestival();

    const festivalChannel =
      supabase
        .channel(
          "festival-live"
        )
        .on(
          "postgres_changes",
          {
            event:
              "*",
            schema:
              "public",
            table:
              "festivals",
          },
          () =>
            loadFestival()
        )
        .subscribe();

    const movieChannel =
      supabase
        .channel(
          "festival-movies-live"
        )
        .on(
          "postgres_changes",
          {
            event:
              "*",
            schema:
              "public",
            table:
              "festival_movies",
          },
          () =>
            loadFestival()
        )
        .subscribe();

    const screeningChannel =
      supabase
        .channel(
          "festival-screenings-live"
        )
        .on(
          "postgres_changes",
          {
            event:
              "*",
            schema:
              "public",
            table:
              "screenings",
          },
          () =>
            loadFestival()
        )
        .subscribe();

    /*
      DATE MAY CHANGE
      WHILE PAGE IS OPEN
    */

    const timer =
      window.setInterval(
        () => {
          loadFestival();
        },
        60 * 1000
      );

    return () => {
      supabase.removeChannel(
        festivalChannel
      );

      supabase.removeChannel(
        movieChannel
      );

      supabase.removeChannel(
        screeningChannel
      );

      window.clearInterval(
        timer
      );
    };
  }, []);

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
    movie:
      FestivalMovie
  ) {
    if (
      !festival
    ) {
      return;
    }

    /*
      SAFETY CHECK
    */

    const today =
      new Date().toLocaleDateString(
        "en-CA"
      );

    if (
      festival.start_date >
        today ||
      festival.end_date <
        today
    ) {
      alert(
        "This festival is no longer available."
      );

      await loadFestival();

      return;
    }

    setWorking(
      true
    );

    /*
      EXTRA CHECK:
      PREVENT SAME FESTIVAL FILM
      FROM BEING CHOSEN TWICE
    */

    const {
      data:
        existingData,
      error:
        existingError,
    } = await supabase
      .from(
        "screenings"
      )
      .select("id")
      .eq(
        "festival_id",
        festival.id
      )
      .eq(
        "movie_title",
        movie.title
      )
      .limit(1);

    if (
      existingError
    ) {
      setWorking(
        false
      );

      alert(
        existingError.message
      );

      return;
    }

    if (
      existingData &&
      existingData.length >
        0
    ) {
      setWorking(
        false
      );

      setChosenMovie(
        null
      );

      await loadFestival();

      return;
    }

    /*
      CREATE SCREENING
    */

    const {
      error,
    } = await supabase
      .from(
        "screenings"
      )
      .insert({
        movie_id:
          null,

        movie_title:
          movie.title,

        poster_url:
          movie.poster_url,

        status:
          "waiting_schedule",

        festival_id:
          festival.id,
      });

    setWorking(
      false
    );

    if (error) {
      alert(
        error.message
      );

      return;
    }

    setChosenMovie(
      null
    );

    /*
      REFRESH FIRST,
      SO THE MOVIE IS ALREADY
      HIDDEN IF USER COMES BACK
    */

    await loadFestival();

    /*
      GO TO NORMAL CINEMA
      SCHEDULING FLOW
    */

    router.push(
      "/"
    );
  }

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

  if (
    loading
  ) {
    return (
      <main className="shell">
        <div className="empty">
          Loading festival…
        </div>
      </main>
    );
  }

  /*
    NO CURRENT FESTIVAL
  */

  if (
    !festival
  ) {
    return (
      <main className="shell">
        <header
          className="header"
          style={{
            alignItems:
              "center",

            gap:
              16,
          }}
        >
          <div>
            <h1 className="brand">
              SPECIAL FESTIVAL
            </h1>

            <div className="subtitle">
              Our Cinema
            </div>
          </div>

          <Link
            href="/"
            className="primary"
            style={{
              textDecoration:
                "none",

              padding:
                "11px 18px",

              whiteSpace:
                "nowrap",
            }}
          >
            ← Cinema
          </Link>
        </header>

        <section
          className="admin-card"
          style={{
            minHeight:
              320,

            display:
              "flex",

            flexDirection:
              "column",

            alignItems:
              "center",

            justifyContent:
              "center",

            textAlign:
              "center",

            padding:
              "50px 26px",
          }}
        >
          <div
            style={{
              fontSize:
                50,

              marginBottom:
                22,
            }}
          >
            🎞️
          </div>

          <div
            style={{
              fontSize:
                11,

              letterSpacing:
                3,

              opacity:
                0.4,

              marginBottom:
                14,
            }}
          >
            SPECIAL PROGRAM
          </div>

          <h2
            style={{
              fontSize:
                28,

              marginBottom:
                12,
            }}
          >
            暂无特殊影展安排
          </h2>

          <div
            style={{
              opacity:
                0.5,

              fontSize:
                14,

              lineHeight:
                1.7,
            }}
          >
            Please check back
            for the next special
            screening program.
          </div>
        </section>
      </main>
    );
  }

  /*
    ACTIVE FESTIVAL
  */

  return (
    <main className="shell">
      <header
        className="header"
        style={{
          alignItems:
            "center",

          gap:
            16,
        }}
      >
        <div>
          <h1 className="brand">
            SPECIAL FESTIVAL
          </h1>

          <div className="subtitle">
            Our Cinema
          </div>
        </div>

        <Link
          href="/"
          className="primary"
          style={{
            textDecoration:
              "none",

            padding:
              "11px 18px",

            whiteSpace:
              "nowrap",
          }}
        >
          ← Cinema
        </Link>
      </header>

      {/*
        FESTIVAL HERO
      */}

      <section
        className="admin-card"
        style={{
          textAlign:
            "center",

          padding:
            "44px 24px",

          marginBottom:
            28,
        }}
      >
        <div
          style={{
            fontSize:
              11,

            letterSpacing:
              3,

            opacity:
              0.4,

            marginBottom:
              18,
          }}
        >
          NOW SHOWING
        </div>

        <h2
          style={{
            fontSize:
              "clamp(30px, 6vw, 52px)",

            lineHeight:
              1.05,

            marginBottom:
              18,
          }}
        >
          {
            festival.title
          }
        </h2>

        <div
          style={{
            fontSize:
              15,

            opacity:
              0.65,

            letterSpacing:
              0.4,
          }}
        >
          {formatDate(
            festival.start_date
          )}

          {" — "}

          {formatDate(
            festival.end_date
          )}
        </div>
      </section>

      {/*
        MOVIE LIST
      */}

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
            ✓
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
            All festival films selected
          </div>

          <div className="status">
            Your selected films
            are waiting in the
            main cinema.
          </div>
        </section>
      ) : (
        <>
          <div
            style={{
              display:
                "flex",

              justifyContent:
                "space-between",

              alignItems:
                "center",

              gap:
                16,

              marginBottom:
                18,
            }}
          >
            <div>
              <div
                style={{
                  fontSize:
                    11,

                  letterSpacing:
                    2,

                  opacity:
                    0.4,

                  marginBottom:
                    5,
                }}
              >
                PROGRAM
              </div>

              <div
                style={{
                  fontSize:
                    20,

                  fontWeight:
                    650,
                }}
              >
                {movies.length}{" "}
                {movies.length ===
                1
                  ? "Film"
                  : "Films"}
              </div>
            </div>

            <button
              className="primary"
              onClick={
                randomPick
              }
              style={{
                padding:
                  "12px 18px",

                whiteSpace:
                  "nowrap",
              }}
            >
              ✦ Random Pick
            </button>
          </div>

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
        </>
      )}

      {/*
        CONFIRM MOVIE
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
              {
                festival.title
              }
            </div>

            <h3>
              {
                chosenMovie.title
              }
            </h3>

            <p>
              Choose this film
              from the special
              festival?
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
    </main>
  );
}
