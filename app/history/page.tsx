"use client";

import Link from "next/link";
import {
  useEffect,
  useState,
} from "react";
import { supabase } from "@/lib/supabase";

type Screening = {
  id: number;
  created_at: string;
  movie_title: string;
  poster_url: string;
  status: string;
  screening_date: string | null;
  screening_time: string | null;

  niu_rating: number | null;
  xia_rating: number | null;
  niu_rated_at: string | null;
  xia_rated_at: string | null;

  festival_id: number | null;
};

type Festival = {
  id: number;
  title: string;
};

type HistoryItem =
  Screening & {
    festival_title:
      | string
      | null;
  };

export default function HistoryPage() {
  const [history, setHistory] =
    useState<HistoryItem[]>([]);

  const [loading, setLoading] =
    useState(true);

  const [saving, setSaving] =
    useState<string | null>(null);

  const [deletingId, setDeletingId] =
    useState<number | null>(null);

  async function loadHistory() {
    setLoading(true);

    const { data, error } =
      await supabase
        .from("screenings")
        .select("*")
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
      setHistory([]);
      setLoading(false);
      return;
    }

    const screenings =
      (data ??
        []) as Screening[];

    const now =
      new Date();

    const past =
      screenings.filter(
        (screening) => {
          if (
            !screening.screening_date ||
            !screening.screening_time
          ) {
            return false;
          }

          const screeningDate =
            new Date(
              `${screening.screening_date}T${screening.screening_time}`
            );

          return (
            screeningDate <
            now
          );
        }
      );

    const festivalIds = [
      ...new Set(
        past
          .map(
            (item) =>
              item.festival_id
          )
          .filter(
            (
              id
            ): id is number =>
              id !== null
          )
      ),
    ];

    let festivalMap:
      Record<
        number,
        string
      > = {};

    if (
      festivalIds.length >
      0
    ) {
      const {
        data:
          festivalData,
        error:
          festivalError,
      } = await supabase
        .from("festivals")
        .select(
          "id, title"
        )
        .in(
          "id",
          festivalIds
        );

      if (
        festivalError
      ) {
        console.error(
          festivalError
        );
      } else {
        festivalMap =
          (
            (festivalData ??
              []) as Festival[]
          ).reduce(
            (
              map,
              festival
            ) => {
              map[
                festival.id
              ] =
                festival.title;

              return map;
            },
            {} as Record<
              number,
              string
            >
          );
      }
    }

    const historyItems =
      past.map(
        (
          screening
        ): HistoryItem => ({
          ...screening,

          festival_title:
            screening.festival_id
              ? festivalMap[
                  screening
                    .festival_id
                ] ?? null
              : null,
        })
      );

    setHistory(
      historyItems
    );

    setLoading(false);
  }

  useEffect(() => {
    loadHistory();

    const screeningChannel =
      supabase
        .channel(
          "history-screenings-live"
        )
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table:
              "screenings",
          },
          () =>
            loadHistory()
        )
        .subscribe();

    const festivalChannel =
      supabase
        .channel(
          "history-festivals-live"
        )
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table:
              "festivals",
          },
          () =>
            loadHistory()
        )
        .subscribe();

    return () => {
      supabase.removeChannel(
        screeningChannel
      );

      supabase.removeChannel(
        festivalChannel
      );
    };
  }, []);

  async function setRating(
    screening: HistoryItem,
    person:
      | "niu"
      | "xia",
    rating: number
  ) {
    const key =
      `${screening.id}-${person}`;

    setSaving(key);

    const currentRating =
      person === "niu"
        ? screening.niu_rating
        : screening.xia_rating;

    const nextRating =
      currentRating === rating
        ? null
        : rating;

    const update =
      person === "niu"
        ? {
            niu_rating:
              nextRating,

            niu_rated_at:
              nextRating
                ? new Date().toISOString()
                : null,
          }
        : {
            xia_rating:
              nextRating,

            xia_rated_at:
              nextRating
                ? new Date().toISOString()
                : null,
          };

    const { error } =
      await supabase
        .from("screenings")
        .update(update)
        .eq(
          "id",
          screening.id
        );

    setSaving(null);

    if (error) {
      alert(
        error.message
      );
      return;
    }

    await loadHistory();
  }

  async function deleteRecord(
    screening: HistoryItem
  ) {
    const confirmed =
      window.confirm(
        `Delete "${screening.movie_title}" from Watch History?`
      );

    if (!confirmed) {
      return;
    }

    setDeletingId(
      screening.id
    );

    await supabase
      .from("showtimes")
      .delete()
      .eq(
        "screening_id",
        screening.id
      );

    const { error } =
      await supabase
        .from("screenings")
        .delete()
        .eq(
          "id",
          screening.id
        );

    setDeletingId(null);

    if (error) {
      alert(
        error.message
      );
      return;
    }

    await loadHistory();
  }

  function RatingRow({
    screening,
    person,
    label,
    rating,
  }: {
    screening: HistoryItem;
    person:
      | "niu"
      | "xia";
    label: string;
    rating:
      | number
      | null;
  }) {
    const key =
      `${screening.id}-${person}`;

    return (
      <div
        style={{
          padding:
            "16px 0",

          borderTop:
            "1px solid rgba(255,255,255,0.08)",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent:
              "space-between",
            alignItems:
              "center",
            gap: 12,
            marginBottom: 10,
          }}
        >
          <div
            style={{
              fontSize: 13,
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
            gap: 7,
            flexWrap: "wrap",
          }}
        >
          {[1, 2, 3, 4, 5].map(
            (star) => (
              <button
                key={star}
                disabled={
                  saving === key
                }
                onClick={() =>
                  setRating(
                    screening,
                    person,
                    star
                  )
                }
                style={{
                  border: "none",
                  background:
                    "transparent",
                  padding: 0,
                  cursor:
                    "pointer",
                  fontSize: 29,
                  lineHeight: 1,

                  color:
                    rating &&
                    star <= rating
                      ? "inherit"
                      : "rgba(255,255,255,0.22)",

                  opacity:
                    saving === key
                      ? 0.5
                      : 1,
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
          Loading history…
        </div>
      </main>
    );
  }

  return (
    <main className="shell">
      <header
        className="header"
        style={{
          alignItems:
            "center",
          gap: 16,
        }}
      >
        <div>
          <h1
            className="brand"
            style={{
              fontSize: 36,
            }}
          >
            WATCH HISTORY
          </h1>

          <div className="subtitle">
            Our Cinema Archive
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

      {history.length ===
      0 ? (
        <section
          className="admin-card"
          style={{
            textAlign:
              "center",

            padding:
              "56px 24px",
          }}
        >
          <div
            style={{
              fontSize: 46,
              marginBottom: 16,
            }}
          >
            🎬
          </div>

          <h2
            style={{
              fontSize: 27,
            }}
          >
            No Watch History Yet
          </h2>

          <div className="status">
            Finished screenings will appear here automatically.
          </div>
        </section>
      ) : (
        <div
          style={{
            display: "grid",
            gap: 24,
          }}
        >
          {history.map(
            (screening) => (
              <section
                key={
                  screening.id
                }
                className="admin-card"
                style={{
                  padding:
                    "26px 24px",
                }}
              >
                <div
                  style={{
                    display:
                      "grid",

                    gridTemplateColumns:
                      "130px 1fr",

                    gap: 24,

                    alignItems:
                      "start",
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
                      width: 130,

                      aspectRatio:
                        "2 / 3",

                      objectFit:
                        "cover",

                      borderRadius: 13,
                    }}
                  />

                  <div>
                    <div
                      style={{
                        display:
                          "flex",

                        alignItems:
                          "center",

                        gap: 8,

                        flexWrap:
                          "wrap",

                        marginBottom: 10,
                      }}
                    >
                      <div
                        style={{
                          display:
                            "inline-flex",

                          alignItems:
                            "center",

                          border:
                            screening.festival_id
                              ? "1px solid rgba(239,229,209,0.28)"
                              : "1px solid rgba(255,255,255,0.10)",

                          borderRadius:
                            999,

                          padding:
                            "5px 9px",

                          fontSize: 9,

                          letterSpacing:
                            1.6,

                          fontWeight: 700,

                          opacity:
                            screening.festival_id
                              ? 0.9
                              : 0.52,
                        }}
                      >
                        {screening.festival_id
                          ? "✦ SPECIAL FESTIVAL"
                          : "OUR CINEMA"}
                      </div>
                    </div>

                    {screening.festival_title && (
                      <div
                        style={{
                          fontSize: 13,

                          opacity: 0.62,

                          marginBottom: 8,

                          lineHeight: 1.4,
                        }}
                      >
                        {
                          screening.festival_title
                        }
                      </div>
                    )}

                    <div
                      style={{
                        fontSize: 25,

                        fontWeight: 650,

                        lineHeight: 1.15,

                        marginBottom: 9,
                      }}
                    >
                      {
                        screening.movie_title
                      }
                    </div>

                    <div
                      style={{
                        fontSize: 14,

                        opacity: 0.58,

                        marginBottom: 18,
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

                    <RatingRow
                      screening={
                        screening
                      }
                      person="niu"
                      label="牛"
                      rating={
                        screening.niu_rating
                      }
                    />

                    <RatingRow
                      screening={
                        screening
                      }
                      person="xia"
                      label="虾"
                      rating={
                        screening.xia_rating
                      }
                    />

                    <button
                      className="danger"
                      disabled={
                        deletingId ===
                        screening.id
                      }
                      onClick={() =>
                        deleteRecord(
                          screening
                        )
                      }
                      style={{
                        width: "100%",
                        marginTop: 14,
                        padding:
                          "12px 16px",
                      }}
                    >
                      {deletingId ===
                      screening.id
                        ? "Deleting…"
                        : "Delete Record"}
                    </button>
                  </div>
                </div>
              </section>
            )
          )}
        </div>
      )}
    </main>
  );
}
