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
};

export default function HistoryPage() {
  const [history, setHistory] =
    useState<Screening[]>([]);

  const [loading, setLoading] =
    useState(true);

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
        .order("screening_date", {
          ascending: false,
        })
        .order("screening_time", {
          ascending: false,
        });

    if (error) {
      console.error(error);
      setHistory([]);
      setLoading(false);
      return;
    }

    const now =
      new Date();

    const past =
      (
        (data ?? []) as Screening[]
      ).filter(
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

    setHistory(past);
    setLoading(false);
  }

  useEffect(() => {
    loadHistory();

    const channel = supabase
      .channel("history-live")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "screenings",
        },
        () => loadHistory()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(
        channel
      );
    };
  }, []);

  function stars(
    rating: number | null
  ) {
    if (!rating) {
      return "Not rated yet";
    }

    return `${"★".repeat(
      rating
    )}${"☆".repeat(
      5 - rating
    )}  ${rating}/5`;
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
      <header className="header">
        <div>
          <h1
            className="brand"
            style={{
              fontSize: 34,
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
          }}
        >
          ← Movies
        </Link>
      </header>

      {history.length === 0 ? (
        <section
          className="admin-card"
          style={{
            textAlign:
              "center",
            padding:
              "52px 24px",
          }}
        >
          <div
            style={{
              fontSize: 42,
              marginBottom: 16,
            }}
          >
            🎬
          </div>

          <h2>
            No Watch History Yet
          </h2>

          <div className="status">
            Finished screenings
            will appear here.
          </div>
        </section>
      ) : (
        <div
          style={{
            display: "grid",
            gap: 20,
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
                  padding: 22,
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
                        fontSize: 24,
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
                        fontSize: 14,
                        opacity: 0.6,
                        marginBottom: 20,
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

                    <div
                      style={{
                        padding:
                          "13px 0",
                        borderTop:
                          "1px solid rgba(255,255,255,0.08)",
                      }}
                    >
                      <div
                        style={{
                          fontSize: 11,
                          letterSpacing: 1.5,
                          opacity: 0.45,
                          marginBottom: 5,
                        }}
                      >
                        牛
                      </div>

                      <div
                        style={{
                          fontSize: 15,
                        }}
                      >
                        {stars(
                          screening.niu_rating
                        )}
                      </div>
                    </div>

                    <div
                      style={{
                        padding:
                          "13px 0",
                        borderTop:
                          "1px solid rgba(255,255,255,0.08)",
                      }}
                    >
                      <div
                        style={{
                          fontSize: 11,
                          letterSpacing: 1.5,
                          opacity: 0.45,
                          marginBottom: 5,
                        }}
                      >
                        虾
                      </div>

                      <div
                        style={{
                          fontSize: 15,
                        }}
                      >
                        {stars(
                          screening.xia_rating
                        )}
                      </div>
                    </div>
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
