"use client";

import {
  useEffect,
  useState,
} from "react";
import { supabase } from "@/lib/supabase";

type Screening = {
  id: number;
  created_at: string;

  movie_id:
    | number
    | null;

  movie_title: string;

  poster_url: string;

  status: string;

  screening_date:
    | string
    | null;

  screening_time:
    | string
    | null;

  watch_url:
    | string
    | null;

  watch_code:
    | string
    | null;

  festival_id:
    | number
    | null;
};

type Festival = {
  id: number;
  title: string;
};

type Ticket = Screening & {
  festival_title:
    | string
    | null;
};

export default function TicketPage() {
  const [tickets, setTickets] =
    useState<Ticket[]>([]);

  const [loading, setLoading] =
    useState(true);

  const [copiedId, setCopiedId] =
    useState<number | null>(null);

  async function loadTickets() {
    setLoading(true);

    /*
      LOAD ALL FUTURE
      SCHEDULED SCREENINGS
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
      (
        screeningData ??
        []
      ) as Screening[];

    /*
      FIND FESTIVAL IDS
    */

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

    /*
      LOAD FESTIVAL TITLES
    */

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
            (
              festivalData ??
              []
            ) as Festival[]
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

    /*
      ONLY KEEP
      FUTURE TICKETS
    */

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
          ): Ticket => ({
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

  function goHome() {
    window.location.replace(
      "/"
    );
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

  async function copyCode(
    ticket: Ticket
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

      setTimeout(() => {
        setCopiedId(null);
      }, 1800);
    } catch {
      alert(
        `Access Code: ${ticket.watch_code}`
      );
    }
  }

  function BackButton({
    bottom = false,
  }: {
    bottom?: boolean;
  }) {
    return (
      <button
        type="button"
        onClick={goHome}
        className={
          bottom
            ? "secondary"
            : "primary"
        }
        style={{
          display:
            "inline-flex",

          alignItems:
            "center",

          justifyContent:
            "center",

          gap: 8,

          padding:
            bottom
              ? "10px 17px"
              : "11px 18px",

          fontSize: 13,

          fontWeight: 600,

          letterSpacing: 0.3,

          whiteSpace:
            "nowrap",

          cursor:
            "pointer",
        }}
      >
        <span
          style={{
            fontSize: 15,
            opacity: 0.75,
          }}
        >
          ←
        </span>

        Cinema
      </button>
    );
  }

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

          <div className="subtitle">
            Movie Tickets
          </div>
        </div>

        <BackButton />
      </header>
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

  if (
    tickets.length === 0
  ) {
    return (
      <main className="shell">
        <Header />

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
              fontSize: 44,
              marginBottom: 18,
            }}
          >
            🎟
          </div>

          <h2
            style={{
              fontSize: 26,
              marginBottom: 12,
            }}
          >
            No Ticket Yet
          </h2>

          <div
            className="status"
            style={{
              marginBottom: 30,

              lineHeight: 1.6,
            }}
          >
            Your tickets will
            appear here after
            you choose showtimes.
          </div>

          <BackButton />
        </section>
      </main>
    );
  }

  return (
    <main className="shell">
      <Header />

      <div
        style={{
          display: "grid",
          gap: 24,
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
                textAlign:
                  "center",

                padding: 30,
              }}
            >
              {/*
                FESTIVAL / NORMAL LABEL
              */}

              <div
                style={{
                  display:
                    "flex",

                  justifyContent:
                    "center",

                  marginBottom: 14,
                }}
              >
                <div
                  style={{
                    display:
                      "inline-flex",

                    alignItems:
                      "center",

                    border:
                      ticket.festival_id
                        ? "1px solid rgba(239,229,209,0.30)"
                        : "1px solid rgba(255,255,255,0.10)",

                    borderRadius:
                      999,

                    padding:
                      "6px 11px",

                    fontSize: 9,

                    letterSpacing:
                      1.8,

                    fontWeight:
                      700,

                    opacity:
                      ticket.festival_id
                        ? 0.92
                        : 0.52,
                  }}
                >
                  {ticket.festival_id
                    ? "✦ SPECIAL FESTIVAL"
                    : "OUR CINEMA"}
                </div>
              </div>

              {/*
                FESTIVAL TITLE
              */}

              {ticket.festival_title && (
                <div
                  style={{
                    fontSize: 13,

                    opacity: 0.62,

                    marginBottom: 18,

                    lineHeight: 1.4,
                  }}
                >
                  {
                    ticket.festival_title
                  }
                </div>
              )}

              <div
                style={{
                  fontSize: 11,

                  letterSpacing: 3,

                  opacity: 0.55,

                  marginBottom: 22,
                }}
              >
                ADMIT TWO
              </div>

              <img
                src={
                  ticket.poster_url
                }
                alt={
                  ticket.movie_title
                }
                style={{
                  width:
                    "min(240px, 76%)",

                  borderRadius: 12,

                  marginBottom: 26,
                }}
              />

              <h2
                style={{
                  fontSize: 30,

                  marginBottom: 22,

                  lineHeight: 1.15,
                }}
              >
                {
                  ticket.movie_title
                }
              </h2>

              <div
                style={{
                  fontSize: 17,

                  opacity: 0.75,

                  marginBottom: 8,
                }}
              >
                {ticket.screening_date
                  ? formatDate(
                      ticket.screening_date
                    )
                  : ""}
              </div>

              <div
                style={{
                  fontSize: 38,

                  fontWeight: 700,

                  letterSpacing: 2,
                }}
              >
                {ticket.screening_time?.slice(
                  0,
                  5
                )}
              </div>

              <div
                style={{
                  marginTop: 30,

                  paddingTop: 22,

                  borderTop:
                    "1px dashed rgba(255,255,255,0.25)",
                }}
              >
                {ticket.watch_url && (
                  <a
                    href={
                      ticket.watch_url
                    }
                    target="_blank"
                    rel="noopener noreferrer"
                    className="primary"
                    style={{
                      display:
                        "block",

                      width:
                        "100%",

                      boxSizing:
                        "border-box",

                      textDecoration:
                        "none",

                      padding:
                        "15px 20px",

                      fontSize: 16,

                      fontWeight: 650,

                      marginBottom:
                        ticket.watch_code
                          ? 14
                          : 24,
                    }}
                  >
                    ▶ Watch Movie
                  </a>
                )}

                {ticket.watch_code && (
                  <div
                    style={{
                      padding:
                        "16px 18px",

                      border:
                        "1px solid rgba(255,255,255,0.10)",

                      borderRadius: 12,

                      background:
                        "rgba(255,255,255,0.025)",

                      marginBottom: 24,

                      textAlign:
                        "left",
                    }}
                  >
                    <div
                      style={{
                        fontSize: 10,

                        letterSpacing: 2,

                        opacity: 0.45,

                        marginBottom: 9,
                      }}
                    >
                      ACCESS CODE
                    </div>

                    <div
                      style={{
                        display:
                          "flex",

                        justifyContent:
                          "space-between",

                        alignItems:
                          "center",

                        gap: 12,
                      }}
                    >
                      <div
                        style={{
                          fontSize: 22,

                          fontWeight: 700,

                          letterSpacing: 2,

                          wordBreak:
                            "break-all",
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
                        style={{
                          flexShrink: 0,

                          padding:
                            "9px 13px",

                          fontSize: 12,
                        }}
                      >
                        {copiedId ===
                        ticket.id
                          ? "Copied ✓"
                          : "Copy"}
                      </button>
                    </div>
                  </div>
                )}

                {!ticket.watch_url &&
                  !ticket.watch_code && (
                    <div
                      style={{
                        fontSize: 12,

                        opacity: 0.45,

                        marginBottom: 24,
                      }}
                    >
                      Watch info not added yet.
                    </div>
                  )}

                <div
                  style={{
                    fontSize: 11,

                    letterSpacing: 2,

                    opacity: 0.5,
                  }}
                >
                  {ticket.festival_id
                    ? "SPECIAL FESTIVAL · TWO SEATS"
                    : "OUR CINEMA · TWO SEATS"}
                </div>
              </div>
            </section>
          )
        )}
      </div>

      <div
        style={{
          marginTop: 28,
          textAlign: "center",
        }}
      >
        <BackButton bottom />
      </div>
    </main>
  );
}
