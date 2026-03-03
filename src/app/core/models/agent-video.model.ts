export interface AgentVideoItem {
  id: number;
  slug: string;
  title: string;
  quote: string;
  source_file_name: string;
  uploaded_video_url: string;
  preview_url: string;
  poster_url: string;
  duration_sec: number;
  priority: number;
  is_active: boolean;
  show_in_hero: boolean;
  has_source: boolean;
  created_at: string | null;
  updated_at: string | null;
}

export interface AgentVideoListResponse {
  videos: AgentVideoItem[];
  count: number;
  active_count: number;
  hero_count: number;
}

