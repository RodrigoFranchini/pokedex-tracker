create table dex_progress
(
    user_id    uuid        not null references users (id) on delete cascade,
    game       text        not null,
    dex        text        not null,
    caught     integer[]   not null,
    updated_at timestamptz not null,
    primary key (user_id, game, dex)
);
