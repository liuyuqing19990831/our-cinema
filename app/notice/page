"use client";

import Link from "next/link";
import {
  useEffect,
  useState,
} from "react";
import { supabase } from "@/lib/supabase";

type Notice = {
  id: number;
  created_at: string;
  message: string;
  is_read: boolean;
};

export default function NoticePage() {
  const [notices, setNotices] =
    useState<Notice[]>([]);

  const [loading, setLoading] =
    useState(true);

  async function loadNotices() {
    const {
      data,
      error,
    } = await supabase
      .from("notices")
      .select("*")
      .order("created_at", {
        ascending: false,
      });

    if (error) {
      console.error(error);
      setLoading(false);
      return;
    }

    const items =
      (data ?? []) as Notice[];

    setNotices(items);
    setLoading(false);

    const unreadIds =
      items
        .filter(
          (notice) =>
            !notice.is_read
        )
        .map(
          (notice) =>
            notice.id
        );

    if (
      unreadIds.length >
      0
    ) {
      await supabase
        .from("notices")
        .update({
          is_read: true,
        })
        .in(
          "id",
          unreadIds
        );
    }
  }

  useEffect(() => {
    loadNotices();

    const channel =
      supabase
        .channel(
          "notice-page-live"
        )
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "notices",
          },
          () =>
            loadNotices()
        )
        .subscribe();

    return () => {
      supabase.removeChannel(
        channel
      );
    };
  }, []);

  function formatTime(
    value: string
  ) {
    return new Intl.DateTimeFormat(
      "en-US",
      {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      }
    ).format(
      new Date(value)
    );
  }

  return (
    <main className="shell">
      <header className="header">
        <div>
          <h1 className="brand">
            NOTICE
          </h1>

          <div className="subtitle">
            Inbox
          </div>
        </div>

        <Link
          href="/"
          className="secondary"
          style={{
            textDecoration:
              "none",
            padding:
              "10px 15px",
          }}
        >
          ← Cinema
        </Link>
      </header>

      <section className="admin-card">
        {loading ? (
          <div className="status">
            Loading…
          </div>
        ) : notices.length ===
          0 ? (
          <div
            className="status"
            style={{
              textAlign:
                "center",
              padding:
                "45px 0",
            }}
          >
            No notices yet.
          </div>
        ) : (
          notices.map(
            (
              notice,
              index
            ) => (
              <div
                key={
                  notice.id
                }
                style={{
                  padding:
                    "18px 2px",

                  borderTop:
                    index ===
                    0
                      ? "none"
                      : "1px solid rgba(255,255,255,0.08)",
                }}
              >
                <div
                  style={{
                    fontSize:
                      15,

                    lineHeight:
                      1.6,

                    whiteSpace:
                      "pre-wrap",

                    opacity:
                      notice.is_read
                        ? 0.68
                        : 1,

                    fontWeight:
                      notice.is_read
                        ? 400
                        : 600,
                  }}
                >
                  {
                    notice.message
                  }
                </div>

                <div
                  style={{
                    fontSize:
                      10,

                    opacity:
                      0.35,

                    marginTop:
                      7,
                  }}
                >
                  {formatTime(
                    notice.created_at
                  )}
                </div>
              </div>
            )
          )
        )}
      </section>
    </main>
  );
}
