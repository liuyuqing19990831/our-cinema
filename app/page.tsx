"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { Movie } from "@/types/movie";

export default function HomePage() {
  const [movies,setMovies]=useState<Movie[]>([]);
  const [loading,setLoading]=useState(true);
  const [chosen,setChosen]=useState<Movie|null>(null);
  const [working,setWorking]=useState(false);

  async function loadMovies(){
    setLoading(true);
    const {data}=await supabase.from("movies").select("*").eq("status","available").order("created_at",{ascending:true});
    setMovies((data??[]) as Movie[]);
    setLoading(false);
  }

  useEffect(()=>{
    loadMovies();
    const ch=supabase.channel("movies-live").on("postgres_changes",{event:"*",schema:"public",table:"movies"},()=>loadMovies()).subscribe();
    return()=>{supabase.removeChannel(ch)}
  },[]);

  function randomPick(){
    if(!movies.length)return;
    setChosen(movies[Math.floor(Math.random()*movies.length)]);
  }

  async function confirmPick(movie:Movie){
    setWorking(true);
    const {error}=await supabase.from("movies").update({status:"selected"}).eq("id",movie.id).eq("status","available");
    setWorking(false);
    if(error){alert(error.message);return}
    setChosen(null);
    await loadMovies();
  }

  return <main className="shell">
    <header className="header">
      <div><h1 className="brand">OUR CINEMA</h1><div className="subtitle">Tonight&apos;s Selection</div></div>
      <Link href="/admin" className="admin-link">Admin</Link>
    </header>

    <section className="movie-grid">
      {loading?<div className="empty">Loading movies…</div>:
      movies.length===0?<div className="empty">No available movies yet.</div>:
      movies.map(movie=><article key={movie.id}>
        <img className="poster" src={movie.poster_url} alt={movie.title}/>
        <div className="movie-title">{movie.title}</div>
        <button className="pick-button" onClick={()=>setChosen(movie)}>Choose</button>
      </article>)}
    </section>

    <div className="actions">
      <button className="primary" onClick={randomPick} disabled={!movies.length}>Random Pick</button>
    </div>

    {chosen&&<div className="modal-backdrop" onClick={()=>setChosen(null)}>
      <div className="modal" onClick={e=>e.stopPropagation()}>
        <img src={chosen.poster_url} alt={chosen.title}/>
        <h3>{chosen.title}</h3><p>Choose this movie?</p>
        <div className="modal-actions">
          <button className="primary" disabled={working} onClick={()=>confirmPick(chosen)}>{working?"Selecting…":"Confirm"}</button>
          <button className="secondary" onClick={()=>setChosen(null)}>Cancel</button>
        </div>
      </div>
    </div>}
  </main>
}
