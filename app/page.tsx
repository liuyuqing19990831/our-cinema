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
  movie_id: number | null;
  movie_title: string;
  poster_url: string;
  status: string;
  screening_date: string | null;
  screening_time: string | null;
  watch_url: string | null;
  watch_code: string | null;
  festival_id: number | null;
};

type Festival = {
  id: number;
  title: string;
};

type TicketWithFestival =
  Screening & {
    festival_title:
      | string
      | null;
  };

export default function TicketPage() {
  const [tickets, setTickets] =
    useState<
      TicketWithFestival[]
    >([]);

  const [loading, setLoading] =
    useState(true);

  const [
    copiedId,
    setCopiedId,
  ] =
    useState<number | null>(
      null
    );

  async function loadTickets() {
    setLoading(true);

    const {
      data: screeningData,
      error:
        screeningError,
    } = await supabase
      .from("screenings")
      .select("*")
      .eq(
        "status",
        "scheduled"
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
      screeningError
    ) {
      console.error(
        screeningError
      );

      setTickets([]);
      setLoading(false);
      return;
    }

    const screenings =
      (screeningData ??
        []) as Screening[];

    const festivalIds = [
      ...new Set(
        screenings
          .map(
            (screening) =>
              screening.festival_id
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
      festivalIds.length > 0
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

    const now =
      new Date();

    const activeTickets =
      screenings
        .filter(
          (ticket) => {
            if (
              !ticket.screening_date ||
              !ticket.screening_time
            ) {
              return false;
            }

            const ticketTime =
              new Date(
                `${ticket.screening_date}T${ticket.screening_time}`
              );

            return (
              ticketTime >=
              now
            );
          }
        )
        .map(
          (
            ticket
          ): TicketWithFestival => ({
            ...ticket,
            festival_title:
              ticket.festival_id
                ? festivalMap[
                    ticket
                      .festival_id
                  ] ?? null
                : null,
          })
        );

    setTickets(
      activeTickets
    );

    setLoading(false);
  }

  useEffect(() => {
    loadTickets();

    const screeningChannel =
      supabase
        .channel(
          "ticket-screenings-live"
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
            loadTickets()
        )
        .subscribe();

    const festivalChannel =
      supabase
        .channel(
          "ticket-festivals-live"
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
            loadTickets()
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

  async function copyCode(
    ticket: TicketWithFestival
  ) {
    if (
      !ticket.watch_code
    ) {
      return;
    }

    try {
      await navigator.clipboard.writeText(
        ticket.watch_code
      );

      setCopiedId(
        ticket.id
      );

      setTimeout(
        () => {
          setCopiedId(
            null
          );
        },
        1500
      );
    } catch {
      alert(
        ticket.watch_code
      );
    }
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

  if (loading) {
    return (
      <main className="shell">
        <div className="empty">
          Loading tickets…
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
              fontSize: 34,
            }}
          >
            MOVIE TICKETS
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
          }}
        >
          ← Movies
        </Link>
      </header>

      {tickets.length ===
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
              fontSize: 48,
              marginBottom: 18,
            }}
          >
            🎟
          </div>

          <h2>
            No Ticket Yet
          </h2>

          <div className="status">
            Your future movie
            tickets will appear
            here.
          </div>
        </section>
      ) : (
        <div
          style={{
            display: "grid",
            gap: 28,
          }}
        >
          {tickets.map(
            (ticket) => (
              <section
                key={
                  ticket.id
                }
                className="admin-card"
                style={{
                  overflow:
                    "hidden",
                  padding: 0,
                }}
              >
                <div
                  style={{
                    display:
                      "grid",
                    gridTemplateColumns:
                      "minmax(120px, 180px) 1fr",
                  }}
                >
                  <img
                    src={
                      ticket.poster_url
                    }
                    alt={
                      ticket.movie_title
                    }
                    style={{
                      width: "100%",
                      height: "100%",
                      minHeight:
                        280,
                      objectFit:
                        "cover",
                    }}
                  />

                  <div
                    style={{
                      padding:
                        "28px 26px",
                    }}
                  >
                    <div
                      style={{
                        fontSize: 10,
                        letterSpacing: 2.4,
                        opacity: 0.42,
                        marginBottom: 8,
                      }}
                    >
                      {ticket.festival_id
                        ? "SPECIAL FESTIVAL"
                        : "OUR CINEMA"}
                    </div>

                    {ticket.festival_title && (
                      <div
                        style={{
                          fontSize: 13,
                          opacity: 0.7,
                          marginBottom: 10,
                        }}
                      >
                        {
                          ticket.festival_title
                        }
                      </div>
                    )}

                    <h2
                      style={{
                        fontSize: 29,
                        lineHeight: 1.1,
                        margin:
                          "0 0 20px",
                      }}
                    >
                      {
                        ticket.movie_title
                      }
                    </h2>

                    <div
                      style={{
                        display: "grid",
                        gap: 14,
                        marginBottom: 24,
                      }}
                    >
                      <div>
                        <div
                          style={{
                            fontSize: 10,
                            letterSpacing: 1.8,
                            opacity: 0.4,
                            marginBottom: 4,
                          }}
                        >
                          DATE
                        </div>

                        <div
                          style={{
                            fontSize: 16,
                          }}
                        >
                          {ticket.screening_date
                            ? formatDate(
                                ticket.screening_date
                              )
                            : ""}
                        </div>
                      </div>

                      <div>
                        <div
                          style={{
                            fontSize: 10,
                            letterSpacing: 1.8,
                            opacity: 0.4,
                            marginBottom: 4,
                          }}
                        >
                          TIME
                        </div>

                        <div
                          style={{
                            fontSize: 22,
                            fontWeight: 650,
                          }}
                        >
                          {ticket.screening_time?.slice(
                            0,
                            5
                          )}
                        </div>
                      </div>
                    </div>

                    {ticket.watch_url && (
                      <a
                        href={
                          ticket.watch_url
                        }
                        target="_blank"
                        rel="noreferrer"
                        className="primary"
                        style={{
                          display:
                            "block",
                          textAlign:
                            "center",
                          textDecoration:
                            "none",
                          padding:
                            "13px 16px",
                          marginBottom: 12,
                        }}
                      >
                        ▶ Watch Movie
                      </a>
                    )}

                    {ticket.watch_code && (
                      <div
                        style={{
                          padding: 16,
                          border:
                            "1px solid rgba(255,255,255,0.09)",
                          borderRadius: 12,
                        }}
                      >
                        <div
                          style={{
                            fontSize: 10,
                            letterSpacing: 1.8,
                            opacity: 0.4,
                            marginBottom: 7,
                          }}
                        >
                          ACCESS CODE
                        </div>

                        <div
                          style={{
                            display:
                              "flex",
                            alignItems:
                              "center",
                            justifyContent:
                              "space-between",
                            gap: 14,
                          }}
                        >
                          <div
                            style={{
                              fontSize: 21,
                              fontWeight: 650,
                              letterSpacing: 1.5,
                            }}
                          >
                            {
                              ticket.watch_code
                            }
                          </div>

                          <button
                            className="secondary"
                            onClick={() =>
                              copyCode(
                                ticket
                              )
                            }
                          >
                            {copiedId ===
                            ticket.id
                              ? "Copied!"
                              : "Copy"}
                          </button>
                        </div>
                      </div>
                    )}
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
