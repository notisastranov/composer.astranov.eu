-- AstranoV brain: semantic memory with pgvector (gemini-embedding-001, 768d)
create extension if not exists vector;

alter table ai_memory add column if not exists embedding vector(768);
alter table ai_memory add column if not exists importance real default 1.0;

create index if not exists ai_memory_embedding_hnsw
  on ai_memory using hnsw (embedding vector_cosine_ops);

create or replace function match_memories(
  query_embedding vector(768),
  match_count int default 12,
  profile_ids uuid[] default '{}'
)
returns table (content text, similarity real, source text, profile_id uuid, is_owner boolean)
language sql stable as $$
  select m.content,
         (1 - (m.embedding <=> query_embedding))::real as similarity,
         m.source, m.profile_id,
         coalesce(p.is_owner, false) as is_owner
  from ai_memory m
  join profiles p on p.id = m.profile_id
  where m.is_private = false and m.embedding is not null
    and m.profile_id = any(profile_ids)
  order by m.embedding <=> query_embedding
  limit match_count;
$$;
