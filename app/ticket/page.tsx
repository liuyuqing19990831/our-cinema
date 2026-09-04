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
  movie_id: number;
  movie_title: string;
  poster_url: string;
  status: string;
  screening_date: string | null;
  screening_time: string | null;
  watch_url: string | null;
  watch_code: string | null;
};

export default function TicketPage() {
  const [ticket, setTicket] =
    useState<Screening | null>(
      null
    );

  const [loading, setLoading] =
    useState(true);

  const [copied, setCopied] =
    useState(false);

  async function loadTicket() {
    setLoading(true);

    const { data, error } =
      await supabase
        .from("screenings")
        .select("*")
        .order("created_at", {
          ascending: false,
        })
        .limit(1);

    if (error) {
      console.error(error);
      setTicket(null);
      setLoading(false);
      return;
    }

    const latest =
      data &&
      data.length > 0
        ? (data[0] as Screening)
        : null;

    setTicket(
      latest?.status ===
        "scheduled"
        ? latest
        : null
    );

    setLoading(false);
  }

  useEffect(() => {
    loadTicket();

    const channel = supabase
      .channel("ticket-live")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "screenings",
        },
        () => loadTicket()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(
        channel
      );
    };
  }, []);

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

  async function copyCode() {
    if (
      !ticket?.watch_code
    ) {
      return;
    }

    try {
      await navigator.clipboard.writeText(
        ticket.watch_code
      );

      setCopied(true);

      setTimeout(() => {
        setCopied(false);
      }, 1800);
    } catch {
      alert(
        `Access Code: ${ticket.watch_code}`
      );
    }
  }

  function Header() {
    return (
      <header
        className="header"
        style={{
          alignItems: "center",
        }}
      >
        <div>
          <h1 className="brand">
            OUR CINEMA
          </h1>

          <div className="subtitle">
            Movie Ticket
          </div>
        </div>

        <Link
          href="/"
          className="primary"
          style={{
            display:
              "inline-flex",
            alignItems:
              "center",
            textDecoration:
              "none",
            padding:
              "11px 18px",
            fontSize: 14,
            fontWeight: 600,
            whiteSpace:
              "nowrap",
          }}
        >
          ← Movies
        </Link>
      </header>
    );
  }

  if (loading) {
    return (
      <main className="shell">
        <div className="empty">
          Loading ticket…
        </div>
      </main>
    );
  }

  if (!ticket) {
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
            Your ticket will
            appear here after
            you choose a
            showtime.
          </div>

          <Link
            href="/"
            className="primary"
            style={{
              display:
                "inline-block",
              textDecoration:
                "none",
              padding:
                "13px 22px",
              fontSize: 15,
              fontWeight: 600,
            }}
          >
            ← Browse Movies
          </Link>
        </section>
      </main>
    );
  }

  return (
    <main className="shell">
      <Header />

      <section
        className="admin-card"
        style={{
          textAlign:
            "center",
          padding: 30,
        }}
      >
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
                width: "100%",
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
                textAlign: "left",
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
                  display: "flex",
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
                  onClick={
                    copyCode
                  }
                  style={{
                    flexShrink: 0,
                    padding:
                      "9px 13px",
                    fontSize: 12,
                  }}
                >
                  {copied
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
            OUR CINEMA · TWO SEATS
          </div>
        </div>

        <div
          style={{
            marginTop: 26,
          }}
        >
          <Link
            href="/"
            className="secondary"
            style={{
              display:
                "inline-block",
              textDecoration:
                "none",
              padding:
                "11px 20px",
            }}
          >
            ← Movies
          </Link>
        </div>
      </section>
    </main>
  );
}
