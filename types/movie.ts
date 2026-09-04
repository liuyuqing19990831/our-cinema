export type Movie = {
  id: number;
  created_at: string;
  title: string;
  poster_url: string;
  status: "available" | "selected";
};
