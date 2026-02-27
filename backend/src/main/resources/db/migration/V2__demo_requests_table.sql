-- Demo requests table for marketing website contact form
-- No organization_id needed - this is a public/marketing table
CREATE TABLE IF NOT EXISTS public.demo_requests (
    id              BIGSERIAL PRIMARY KEY,
    name            VARCHAR(255) NOT NULL,
    email           VARCHAR(255) NOT NULL,
    firm_name       VARCHAR(255) NOT NULL,
    firm_size       VARCHAR(50)  NOT NULL,
    practice_areas  TEXT         NOT NULL,
    phone           VARCHAR(50),
    message         TEXT,
    created_at      TIMESTAMP    NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_demo_requests_email ON public.demo_requests(email);
CREATE INDEX IF NOT EXISTS idx_demo_requests_created_at ON public.demo_requests(created_at);
