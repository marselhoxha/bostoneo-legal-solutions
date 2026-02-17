-- Create PI Settlement Events table for tracking settlement negotiations
-- This stores the history of demands, offers, and counter-offers for each case

CREATE TABLE IF NOT EXISTS pi_settlement_events (
    id BIGSERIAL PRIMARY KEY,
    case_id BIGINT NOT NULL,
    organization_id BIGINT NOT NULL,
    event_date TIMESTAMP NOT NULL DEFAULT NOW(),
    demand_amount DECIMAL(15,2) NOT NULL,
    offer_amount DECIMAL(15,2),
    offer_date DATE,
    counter_amount DECIMAL(15,2),
    notes TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    created_by BIGINT,

    CONSTRAINT fk_settlement_case
        FOREIGN KEY (case_id)
        REFERENCES legal_cases(id)
        ON DELETE CASCADE,

    CONSTRAINT fk_settlement_organization
        FOREIGN KEY (organization_id)
        REFERENCES organizations(id)
        ON DELETE CASCADE,

    CONSTRAINT fk_settlement_created_by
        FOREIGN KEY (created_by)
        REFERENCES users(id)
        ON DELETE SET NULL
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_settlement_case_org
    ON pi_settlement_events(case_id, organization_id);

CREATE INDEX IF NOT EXISTS idx_settlement_event_date
    ON pi_settlement_events(event_date);

-- Add comment to table
COMMENT ON TABLE pi_settlement_events IS 'Stores settlement negotiation events for Personal Injury cases';
