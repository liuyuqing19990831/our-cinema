"use client";

import Link from "next/link";
import {
  FormEvent,
  useEffect,
  useState,
} from "react";
import { supabase } from "@/lib/supabase";

type Festival = {
  id: number;
  created_at: string;
  title: string;
  start_date: string;
  end_date: string;
  status: string;
};

export default function FestivalAdminPage() {
  const [festivals, setFestivals] =
    useState<Festival[]>([]);

  const [title, setTitle] =
    useState("");

  const [startDate, setStartDate] =
    useState("");

  const [endDate, setEndDate] =
    useState("");

  const [loading, setLoading] =
    useState(true);

  const [creating, setCreating] =
    useState(false);

  const [
    workingId,
    setWorkingId,
  ] = useState<number | null>(
    null
  );

  async function loadFestivals() {
    setLoading(true);

    const { data, error } =
      await supabase
        .from("festivals")
        .select("*")
        .order("created_at", {
          ascending: false,
        });

    if (error) {
      console.error(error);
      setFestivals([]);
      setLoading(false);
      return;
    }

    setFestivals(
      (data ?? []) as Festival[]
    );

    setLoading(false);
  }

  useEffect(() => {
    loadFestivals();

    const channel = supabase
      .channel(
        "festival-admin-live"
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "festivals",
        },
        () =>
          loadFestivals()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(
        channel
      );
    };
  }, []);

  async function createFestival(
    e: FormEvent
  ) {
    e.preventDefault();

    if (
      !title.trim() ||
      !startDate ||
      !endDate
    ) {
      alert(
        "Please enter the festival theme and dates."
      );
      return;
    }

    if (
      new Date(endDate) <
      new Date(startDate)
    ) {
      alert(
        "End date cannot be earlier than start date."
      );
      return;
    }

    setCreating(true);

    const { error } =
      await supabase
        .from("festivals")
        .insert({
          title: title.trim(),
          start_date:
            startDate,
          end_date:
            endDate,
          status:
            "inactive",
        });

    setCreating(false);

    if (error) {
      alert(error.message);
      return;
    }

    setTitle("");
    setStartDate("");
    setEndDate("");

    await loadFestivals();
  }

  async function activateFestival(
    festival: Festival
  ) {
    setWorkingId(
      festival.id
    );

    /*
      First turn all festivals off.
      This means only one festival
      can be active at a time.
    */
    const {
      error:
        deactivateError,
    } = await supabase
      .from("festivals")
      .update({
        status:
          "inactive",
      })
      .neq("id", -1);

    if (
      deactivateError
    ) {
      setWorkingId(null);

      alert(
        deactivateError.message
      );
      return;
    }

    /*
      Activate selected festival.
    */
    const { error } =
      await supabase
        .from("festivals")
        .update({
          status: "active",
        })
        .eq(
          "id",
          festival.id
        );

    setWorkingId(null);

    if (error) {
      alert(error.message);
      return;
    }

    await loadFestivals();
  }

  async function deactivateFestival(
    festival: Festival
  ) {
    setWorkingId(
      festival.id
    );

    const { error } =
      await supabase
        .from("festivals")
        .update({
          status:
            "inactive",
        })
        .eq(
          "id",
          festival.id
        );

    setWorkingId(null);

    if (error) {
      alert(error.message);
      return;
    }

    await loadFestivals();
  }

  async function deleteFestival(
    festival: Festival
  ) {
    const ok =
      window.confirm(
        `Delete "${festival.title}"?`
      );

    if (!ok) {
      return;
    }

    setWorkingId(
      festival.id
    );

    /*
      Delete festival movies first,
      so we do not leave orphaned films.
    */
    const {
      error:
        movieDeleteError,
    } = await supabase
      .from(
        "festival_movies"
      )
      .delete()
      .eq(
        "festival_id",
        festival.id
      );

    if (
      movieDeleteError
    ) {
      setWorkingId(null);

      alert(
        movieDeleteError.message
      );
      return;
    }

    const { error } =
      await supabase
        .from("festivals")
        .delete()
        .eq(
          "id",
          festival.id
        );

    setWorkingId(null);

    if (error) {
      alert(error.message);
      return;
    }

    await loadFestivals();
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
        month: "short",
        day: "numeric",
        year: "numeric",
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
            SPECIAL FESTIVAL
          </h1>

          <div className="subtitle">
            Festival Management
          </div>
        </div>

        <div
          style={{
            display: "flex",
            gap: 10,
            flexWrap: "wrap",
          }}
        >
          <Link
            href="/festival"
            className="secondary"
            style={{
              textDecoration:
                "none",
              padding:
                "10px 16px",
              whiteSpace:
                "nowrap",
            }}
          >
            Guest View
          </Link>

          <Link
            href="/admin"
            className="primary"
            style={{
              textDecoration:
                "none",
              padding:
                "10px 16px",
              whiteSpace:
                "nowrap",
            }}
          >
            ← Admin
          </Link>
        </div>
      </header>

      {/* CREATE FESTIVAL */}

      <section className="admin-card">
        <div
          style={{
            fontSize: 11,
            letterSpacing: 2.3,
            opacity: 0.45,
            marginBottom: 7,
          }}
        >
          NEW PROGRAM
        </div>

        <h2
          style={{
            marginTop: 0,
            marginBottom: 24,
          }}
        >
          Create Special Festival
        </h2>

        <form
          onSubmit={
            createFestival
          }
        >
          <label
            className="label"
            style={{
              display: "block",
              marginBottom: 8,
            }}
          >
            Festival Theme
          </label>

          <input
            className="text-input"
            type="text"
            value={title}
            onChange={(e) =>
              setTitle(
                e.target.value
              )
            }
            placeholder="e.g. Wong Kar-wai Night"
            style={{
              width: "100%",
              boxSizing:
                "border-box",
              marginBottom: 18,
            }}
          />

          <div
            style={{
              display: "grid",
              gridTemplateColumns:
                "repeat(auto-fit, minmax(160px, 1fr))",
              gap: 14,
              marginBottom: 20,
            }}
          >
            <div>
              <label
                className="label"
                style={{
                  display:
                    "block",
                  marginBottom: 8,
                }}
              >
                Start Date
              </label>

              <input
                className="text-input"
                type="date"
                value={
                  startDate
                }
                onChange={(e) =>
                  setStartDate(
                    e.target
                      .value
                  )
                }
                style={{
                  width: "100%",
                  boxSizing:
                    "border-box",
                }}
              />
            </div>

            <div>
              <label
                className="label"
                style={{
                  display:
                    "block",
                  marginBottom: 8,
                }}
              >
                End Date
              </label>

              <input
                className="text-input"
                type="date"
                value={
                  endDate
                }
                onChange={(e) =>
                  setEndDate(
                    e.target
                      .value
                  )
                }
                style={{
                  width: "100%",
                  boxSizing:
                    "border-box",
                }}
              />
            </div>
          </div>

          <button
            className="primary"
            type="submit"
            disabled={
              creating
            }
            style={{
              width: "100%",
              padding:
                "14px 18px",
              fontSize: 15,
            }}
          >
            {creating
              ? "Creating…"
              : "+ Create Festival"}
          </button>
        </form>
      </section>

      {/* FESTIVALS */}

      <section className="admin-card">
        <div
          style={{
            fontSize: 11,
            letterSpacing: 2.3,
            opacity: 0.45,
            marginBottom: 7,
          }}
        >
          FESTIVAL ARCHIVE
        </div>

        <h2
          style={{
            marginTop: 0,
            marginBottom: 24,
          }}
        >
          Special Festivals
        </h2>

        {loading ? (
          <div className="status">
            Loading festivals…
          </div>
        ) : festivals.length ===
          0 ? (
          <div className="status">
            No special festivals yet.
          </div>
        ) : (
          <div
            style={{
              display: "grid",
              gap: 16,
            }}
          >
            {festivals.map(
              (festival) => {
                const active =
                  festival.status ===
                  "active";

                return (
                  <div
                    key={
                      festival.id
                    }
                    style={{
                      padding: 20,
                      border:
                        active
                          ? "1px solid rgba(255,255,255,0.28)"
                          : "1px solid rgba(255,255,255,0.09)",
                      borderRadius: 14,
                      background:
                        active
                          ? "rgba(255,255,255,0.055)"
                          : "rgba(255,255,255,0.02)",
                    }}
                  >
                    <div
                      style={{
                        display:
                          "flex",
                        justifyContent:
                          "space-between",
                        alignItems:
                          "flex-start",
                        gap: 14,
                        marginBottom: 18,
                      }}
                    >
                      <div>
                        <div
                          style={{
                            fontSize: 11,
                            letterSpacing: 1.8,
                            opacity:
                              0.45,
                            marginBottom: 7,
                          }}
                        >
                          {active
                            ? "● ACTIVE FESTIVAL"
                            : "INACTIVE"}
                        </div>

                        <div
                          style={{
                            fontSize: 23,
                            fontWeight: 650,
                            lineHeight: 1.15,
                            marginBottom: 9,
                          }}
                        >
                          {
                            festival.title
                          }
                        </div>

                        <div
                          style={{
                            fontSize: 13,
                            opacity:
                              0.58,
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
                      </div>
                    </div>

                    <div
                      style={{
                        display:
                          "flex",
                        gap: 10,
                        flexWrap:
                          "wrap",
                      }}
                    >
                      {active ? (
                        <button
                          className="secondary"
                          disabled={
                            workingId ===
                            festival.id
                          }
                          onClick={() =>
                            deactivateFestival(
                              festival
                            )
                          }
                        >
                          {workingId ===
                          festival.id
                            ? "Saving…"
                            : "Deactivate"}
                        </button>
                      ) : (
                        <button
                          className="primary"
                          disabled={
                            workingId ===
                            festival.id
                          }
                          onClick={() =>
                            activateFestival(
                              festival
                            )
                          }
                        >
                          {workingId ===
                          festival.id
                            ? "Saving…"
                            : "Activate"}
                        </button>
                      )}

                      <button
                        className="danger"
                        disabled={
                          workingId ===
                          festival.id
                        }
                        onClick={() =>
                          deleteFestival(
                            festival
                          )
                        }
                      >
                        Delete Festival
                      </button>
                    </div>
                  </div>
                );
              }
            )}
          </div>
        )}
      </section>

      <section
        className="admin-card"
        style={{
          textAlign: "center",
        }}
      >
        <div
          style={{
            fontSize: 12,
            opacity: 0.5,
            lineHeight: 1.7,
          }}
        >
          Only one special
          festival can be active
          at a time.
          <br />
          If no festival is active,
          the guest page will show
          “暂无特殊影展安排”.
        </div>
      </section>
    </main>
  );
}
