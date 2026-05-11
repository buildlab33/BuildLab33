import api from "@/lib/api";

export interface NewsArticle {
  title: string;
  url: string;
  source: string;
  summary: string;
  published_at: string;
}

export const getNews = (brandId: string) =>
  api.get<NewsArticle[]>("/api/news", { params: { brand_id: brandId } });
