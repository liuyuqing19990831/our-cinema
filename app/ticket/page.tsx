"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
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
};

export default function TicketPage() {
  const [screening, setScreening] = useState<Screening | null>(null);
  const [loading, setLoading] = useState(true);

  async function loadTicket() {
    setLoading(true);

    const { data } = await supabase
      .from("screenings")
      .select("*")
      .eq("status", "scheduled")
      .order("created_at", { ascending: false })
      .limit(1);

    const ticket =
      data && data.length > 0
        ? (data[0] as Screening)
        : null;

    setScreening(ticket);
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
        loadTicket
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  function formatDate(date: string) {
    const parts = date.split("-");

    if (parts.length !== 3) return date;

    const year = Number(parts[0]);
    const month = Number(parts[1]);
    const day = Number(parts[2]);

    return new Intl.DateTimeFormat("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    }).format(
      new Date(
        Date.UTC(year, month - 1, day)
      )
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

  if (!screening) {
    return (
      <main className="shell">
        <header className="header">
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
            className="admin-link"
          >
            Back
          </Link>
        </header>

        <section
          className="admin-card"
          style={{
            textAlign: "center",
          }}
        >
          <h2>No Active Ticket</h2>

          <p className="status">
            Choose a movie and showtime first.
          </p>

          <div className="actions">
            <Link
              href="/"
              className="primary"
              style={{
                display: "inline-block",
                textDecoration: "none",
              }}
            >
              Choose Movie
            </Link>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="shell">
      <header className="header">
        <div>
          <h1 className="brand">
            OUR CINEMA
          </h1>

          <div className="subtitle">
            Your Movie Ticket
          </div>
        </div>

        <Link
          href="/"
          className="admin-link"
        >
          Movies
        </Link>
      </header>

      <section
        className="admin-card"
        style={{
          textAlign: "center",
          padding: 28,
        }}
      >
        <div
          style={{
            fontSize: 12,
            letterSpacing: 3,
            opacity: 0.65,
            marginBottom: 18,
          }}
        >
          ADMIT TWO
        </div>

        <img
          src={screening.poster_url}
          alt={screening.movie_title}
          style={{
            width: "min(220px, 70%)",
            borderRadius: 10,
            marginBottom: 22,
          }}
        />

        <h2
          style={{
            fontSize: 28,
            marginBottom: 20,
          }}
        >
          {screening.movie_title}
        </h2>

        <div
          style={{
            fontSize: 18,
            marginBottom: 8,
          }}
        >
          {screening.screening_date
            ? formatDate(
                screening.screening_date
              )
            : ""}
        </div>

        <div
          style={{
            fontSize: 32,
            fontWeight: 700,
            letterSpacing: 2,
          }}
        >
          {screening.screening_time?.slice(
            0,
            5
          )}
        </div>

        <div
          style={{
            marginTop: 28,
            paddingTop: 20,
            borderTop:
              "1px dashed rgba(255,255,255,0.25)",
            fontSize: 13,
            letterSpacing: 2,
            opacity: 0.65,
          }}
        >
          OUR CINEMA · TWO SEATS
        </div>
      </section>
    </main>
  );
}
