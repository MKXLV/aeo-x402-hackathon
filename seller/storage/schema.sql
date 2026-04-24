CREATE TABLE IF NOT EXISTS orders (
    id              UUID PRIMARY KEY,
    state           TEXT NOT NULL,
    payer_address   TEXT NOT NULL,
    total_usdc      NUMERIC(20, 6) NOT NULL,
    callback_url    TEXT,
    metadata        JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS posts (
    id                  UUID PRIMARY KEY,
    order_id            UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    platform            TEXT NOT NULL,
    kind                TEXT NOT NULL,
    body                TEXT NOT NULL,
    topics              JSONB NOT NULL DEFAULT '[]'::jsonb,
    target              JSONB NOT NULL DEFAULT '{}'::jsonb,
    quantity            INTEGER NOT NULL DEFAULT 1,
    provider            TEXT NOT NULL,
    upstream            TEXT,
    provider_order_id   TEXT,
    state               TEXT NOT NULL,
    unit_price_usdc     NUMERIC(20, 6) NOT NULL,
    error               TEXT,
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS posts_order_idx ON posts(order_id);
CREATE INDEX IF NOT EXISTS posts_state_idx ON posts(state) WHERE state NOT IN ('posted', 'failed', 'refunded');
