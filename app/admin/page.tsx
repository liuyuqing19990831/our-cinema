"use client";
import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { Movie } from "@/types/movie";

export default function AdminPage(){
  const [title,setTitle]=useState("");
  const [file,setFile]=useState<File|null>(null);
  const [preview,setPreview]=useState("");
  const [movies,setMovies]=useState<Movie[]>([]);
  const [saving,setSaving]=useState(false);

  async function loadMovies(){
    const {data}=await supabase.from("movies").select("*").order("created_at",{ascending:true});
    setMovies((data??[]) as Movie[]);
  }

  useEffect(()=>{
    loadMovies();
    const ch=supabase.channel("admin-live").on("postgres_changes",{event:"*",schema:"public",table:"movies"},()=>loadMovies()).subscribe();
    return()=>{supabase.removeChannel(ch)}
  },[]);

  function pickFile(f:File|null){
    setFile(f);
    setPreview(f?URL.createObjectURL(f):"");
  }

  async function submit(e:FormEvent){
    e.preventDefault();
    if(!title.trim()||!file){alert("Please add a poster and title.");return}
    const available=movies.filter(m=>m.status==="available").length;
    if(available>=9){alert("The movie pool already has 9 available movies.");return}

    setSaving(true);
    const ext=file.name.split(".").pop()||"jpg";
    const path=`${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
    const up=await supabase.storage.from("posters").upload(path,file,{upsert:false,contentType:file.type||"image/jpeg"});
    if(up.error){setSaving(false);alert(up.error.message);return}
    const {data:urlData}=supabase.storage.from("posters").getPublicUrl(path);
    const ins=await supabase.from("movies").insert({title:title.trim(),poster_url:urlData.publicUrl,status:"available"});
    setSaving(false);
    if(ins.error){alert(ins.error.message);return}
    setTitle(""); pickFile(null); await loadMovies();
  }

  async function remove(movie:Movie){
    if(!confirm(`Delete "${movie.title}"?`))return;
    const {error}=await supabase.from("movies").delete().eq("id",movie.id);
    if(error){alert(error.message);return}
    await loadMovies();
  }

  return <main className="shell">
    <header className="header">
      <div><h1 className="brand" style={{fontSize:34}}>ADMIN</h1><div className="subtitle">Manage the movie pool</div></div>
      <Link href="/" className="admin-link">Back</Link>
    </header>

    <section className="admin-card">
      <h2>Add Movie</h2>
      <form onSubmit={submit}>
        <label className="label">Poster</label>
        <input className="file-input" type="file" accept="image/*" onChange={e=>pickFile(e.target.files?.[0]??null)}/>
        {preview&&<img className="preview" src={preview} alt="preview"/>}
        <label className="label">Movie title</label>
        <input className="text-input" value={title} onChange={e=>setTitle(e.target.value)} placeholder="Enter movie title"/>
        <div className="actions"><button className="primary" type="submit" disabled={saving}>{saving?"Saving…":"Add Movie"}</button></div>
      </form>
    </section>

    <section className="admin-card">
      <h2>Movie Pool ({movies.filter(m=>m.status==="available").length}/9 available)</h2>
      <div className="admin-list">
        {movies.map(movie=><div className="admin-row" key={movie.id}>
          <img className="admin-thumb" src={movie.poster_url} alt={movie.title}/>
          <div><div className="row-title">{movie.title}</div><div className="row-status">{movie.status}</div></div>
          <button className="danger" onClick={()=>remove(movie)}>Delete</button>
        </div>)}
      </div>
    </section>
  </main>
}
